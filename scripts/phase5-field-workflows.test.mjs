import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const scratch = mkdtempSync(join(tmpdir(), "psspl-phase5-"));
process.env.CRM_DATABASE_PATH = join(scratch, "synthetic.sqlite");
process.env.NODE_ENV = "test";
process.env.CRM_DISABLE_BASELINE_RESTORE = "true";

let db, server, baseUrl, tokens = {};
const response = (path, token, method = "GET", body) => fetch(`${baseUrl}${path}`, {
  method,
  headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
  body: body ? JSON.stringify(body) : undefined,
});

before(async () => {
  ({ db } = await import("../server/db.mjs"));
  const { createSession } = await import("../server/auth.mjs");
  const { salesRouter } = await import("../server/sales-routes.mjs");
  const { createFollowUpRouter } = await import("../server/follow-up-routes.mjs");
  const { indiaBusinessDate } = await import("../server/field-activity.mjs");
  const users = [["admin", "admin"], ["rm-a", "rm"], ["rep-a", "salesperson"], ["rep-b", "salesperson"], ["rm-b", "rm"]];
  for (const [id, role] of users) db.prepare("INSERT INTO users(id,email,password_hash,role) VALUES(?,?,?,?)").run(id, `${id}@example.test`, "synthetic", role);
  for (const [id, role] of users) {
    db.prepare("INSERT INTO salesperson_profiles(user_id,employee_code,full_name,region,territory,manager_user_id) VALUES(?,?,?,?,?,?)")
      .run(id, `emp-${id}`, id, "test", "test", id === "rep-a" ? "rm-a" : id === "rep-b" ? "rm-b" : null);
    tokens[id] = createSession(id).token;
  }
  db.prepare("INSERT INTO tally_customers(id,name,owner_user_id) VALUES('cust-a','Assigned A','rep-a'),('cust-b','Assigned B','rep-b'),('cust-unassigned','No owner',NULL)").run();
  db.prepare("INSERT INTO tally_products(id,name) VALUES('prod-a','Synthetic product')").run();
  const app = express();
  app.use(express.json());
  app.use("/sales", salesRouter);
  app.use("/follow-ups", createFollowUpRouter({ buildSalesDay: async (userId) => ({ userId }) }));
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  assert.ok(indiaBusinessDate(new Date("2026-10-16T20:00:00.000Z")).endsWith("17"));
});

after(() => { server?.close(); db?.close(); rmSync(scratch, { recursive: true, force: true }); });

test("field date and GPS validation reject malformed or out-of-range evidence", async () => {
  const { isDateOnly, validateLocation } = await import("../server/field-activity.mjs");
  assert.equal(isDateOnly("2026-02-29"), false);
  assert.equal(isDateOnly("2026-10-17"), true);
  assert.equal(validateLocation({ latitude: 91, longitude: 77 }).ok, false);
  assert.equal(validateLocation({ latitude: 28.6, longitude: 77.2, accuracy: -1 }).ok, false);
  assert.deepEqual(validateLocation({ latitude: 28.6, longitude: 77.2, accuracy: 12 }), { ok: true, latitude: 28.6, longitude: 77.2, accuracy: 12 });
});

test("call logging validates saved details, owner access, follow-up and daily counts", async () => {
  const { dailyFieldActivity, indiaBusinessDate } = await import("../server/field-activity.mjs");
  assert.equal((await response("/sales/calls", tokens["rep-a"], "POST", { customerId: "cust-b", direction: "outgoing", purpose: "Quote", outcome: "Sent" })).status, 403);
  assert.equal((await response("/sales/calls", tokens["rep-a"], "POST", { customerId: "cust-unassigned", direction: "outgoing", purpose: "Quote", outcome: "Sent" })).status, 403);
  assert.equal((await response("/sales/calls", tokens["rep-a"], "POST", { customerId: "cust-a", direction: "missed", purpose: "Quote", outcome: "Sent" })).status, 400);
  const logged = await response("/sales/calls", tokens["rep-a"], "POST", { customerId: "cust-a", direction: "incoming", purpose: "Pricing", outcome: "Requested revised quote", notes: "Synthetic dictated note", followUpDate: "2026-10-20", occurredAt: "2026-10-16T20:00:00.000Z" });
  assert.equal(logged.status, 201);
  assert.equal((await logged.json()).verifiedByTelephony, false);
  const businessDate = indiaBusinessDate(new Date("2026-10-16T20:00:00.000Z"));
  db.prepare("INSERT INTO visits(id,user_id,business_date,tally_customer_id,scheduled_at,purpose,status) VALUES('visit-done','rep-a',?,'cust-a','2026-10-17T10:00:00','Meeting','completed'),('visit-pending','rep-a',?,'cust-a','2026-10-17T11:00:00','Review','planned')").run(businessDate, businessDate);
  db.prepare("INSERT INTO expected_orders(id,visit_id,user_id,tally_customer_id,tally_product_id,expected_value,created_at) VALUES('expect-today','visit-done','rep-a','cust-a','prod-a',125000,'2026-10-16 20:05:00')").run();
  db.prepare("INSERT INTO expected_orders(id,visit_id,user_id,tally_customer_id,tally_product_id,expected_value,created_at) VALUES('expect-old','visit-done','rep-a','cust-a','prod-a',800000,'2026-10-15 08:00:00')").run();
  const day = dailyFieldActivity(db, "rep-a", businessDate);
  assert.equal(day.summary.loggedCalls, 1);
  assert.equal(day.summary.plannedVisits, 2);
  assert.equal(day.summary.completedVisits, 1);
  assert.equal(day.summary.pendingVisits, 1);
  assert.equal(day.summary.expectedOrderValueToday, 125000);
  assert.equal(day.summary.expectedOrderCountToday, 1);
  assert.equal(day.calls[0].direction, "incoming");
  assert.match(day.calls[0].notes, /Synthetic dictated note/);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM follow_ups WHERE user_id='rep-a' AND due_date='2026-10-20'").get().count, 1);
  assert.equal(dailyFieldActivity(db, "rep-b", "2026-10-17").summary.loggedCalls, 0);
});

test("check-in persists once with truthful GPS state; check-out validates, saves once, and remains owner scoped", async () => {
  const { indiaBusinessDate, recordDailyCheckIn } = await import("../server/field-activity.mjs");
  const date = indiaBusinessDate();
  assert.equal(recordDailyCheckIn(db, (work) => work(), "rep-b", date, { latitude: 91, longitude: 77 }).status, 400);
  const checkedIn = recordDailyCheckIn(db, (work) => work(), "rep-b", date, { latitude: 28.6, longitude: 77.2, accuracy: 25 });
  assert.equal(checkedIn.ok, true);
  assert.equal(checkedIn.gpsCaptured, true);
  assert.equal(checkedIn.gpsAccuracyMeters, 25);
  assert.equal(recordDailyCheckIn(db, (work) => work(), "rep-b", date, {}).status, 409);
  const noGps = recordDailyCheckIn(db, (work) => work(), "rep-a", date, {});
  assert.equal(noGps.ok, true);
  assert.equal(noGps.gpsCaptured, false);
  assert.equal((await response("/sales/attendance/check-out", tokens["rm-a"], "POST")).status, 409);
  assert.equal((await response("/sales/attendance/check-out", tokens["rep-a"], "POST", { latitude: 100, longitude: 20 })).status, 400);
  const checkedOut = await response("/sales/attendance/check-out", tokens["rep-a"], "POST", { latitude: 28.6, longitude: 77.2, accuracy: 14 });
  assert.equal(checkedOut.status, 200);
  assert.equal((await checkedOut.json()).gpsAccuracyMeters, 14);
  assert.equal((await response("/sales/attendance/check-out", tokens["rep-a"], "POST")).status, 409);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM location_pings WHERE user_id='rep-a'").get().count, 1);
});

test("voice note access preflight hides visits owned by another user", async () => {
  db.prepare("INSERT INTO visits(id,user_id,business_date,tally_customer_id,scheduled_at,purpose) VALUES('visit-b','rep-b','2026-10-17','cust-b','2026-10-17T09:00:00','Customer visit')").run();
  const audioPath = join(scratch, "synthetic-note.webm");
  writeFileSync(audioPath, "synthetic recording bytes");
  db.prepare("UPDATE visits SET voice_note_path=? WHERE id='visit-b'").run(audioPath);
  const form = new FormData();
  form.append("audio", new Blob(["synthetic"], { type: "audio/webm" }), "note.webm");
  const result = await fetch(`${baseUrl}/sales/visits/visit-b/voice-note`, { method: "POST", headers: { Authorization: `Bearer ${tokens["rep-a"]}` }, body: form });
  assert.equal(result.status, 404);
  const deniedDownload = await response("/sales/visits/visit-b/voice-note", tokens["rep-a"]);
  assert.equal(deniedDownload.status, 404);
  const permittedTeamDownload = await response("/sales/visits/visit-b/voice-note", tokens["rm-b"]);
  assert.equal(permittedTeamDownload.status, 200);
  assert.match(permittedTeamDownload.headers.get("cache-control"), /no-store/);
  assert.equal(await permittedTeamDownload.text(), "synthetic recording bytes");
  assert.equal((await response("/sales/visits/visit-b/voice-note", tokens.admin)).status, 200);
});

test("past planned visits appear as review actions, never as confirmed missed visits", async () => {
  const { indiaBusinessDate } = await import("../server/field-activity.mjs");
  const yesterday = indiaBusinessDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
  db.prepare("INSERT INTO visits(id,user_id,business_date,tally_customer_id,scheduled_at,purpose,status) VALUES('past-plan','rep-a',?,'cust-a',?,'Confirm prior meeting','planned')")
    .run(yesterday, `${yesterday}T10:00:00`);
  const result = await response("/sales/alerts", tokens["rep-a"]);
  assert.equal(result.status, 200);
  const alerts = await result.json();
  assert.ok(alerts.pastScheduledVisits.some((visit) => visit.id === "past-plan"));
  assert.equal(Object.hasOwn(alerts, "missedVisits"), false);
  const otherTeam = await response("/sales/alerts", tokens["rep-b"]);
  assert.equal(otherTeam.status, 200);
  assert.ok(!(await otherTeam.json()).pastScheduledVisits.some((visit) => visit.id === "past-plan"));
});
