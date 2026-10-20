import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const scratch = mkdtempSync(join(tmpdir(), "psspl-phase6-"));
process.env.CRM_DATABASE_PATH = join(scratch, "phase6.sqlite");
process.env.NODE_ENV = "test";
process.env.CRM_DISABLE_BASELINE_RESTORE = "true";
let db, server, baseUrl, tokens = {};
const call = (path, token, method = "GET", body) => fetch(`${baseUrl}${path}`, {
  method,
  headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
  body: body ? JSON.stringify(body) : undefined,
});

before(async () => {
  ({ db } = await import("../server/db.mjs"));
  const { createSession } = await import("../server/auth.mjs");
  const { salesRouter } = await import("../server/sales-routes.mjs");
  for (const [id, role] of [["admin", "admin"], ["rm-a", "rm"], ["rm-b", "rm"], ["rep-a", "salesperson"], ["rep-b", "salesperson"]]) {
    db.prepare("INSERT INTO users(id,email,password_hash,role) VALUES(?,?,?,?)").run(id, `${id}@test.invalid`, "synthetic", role);
    db.prepare("INSERT INTO salesperson_profiles(user_id,employee_code,full_name,region,territory,manager_user_id) VALUES(?,?,?,?,?,?)").run(id, `e-${id}`, id, "synthetic", "synthetic", id === "rep-a" ? "rm-a" : id === "rep-b" ? "rm-b" : null);
    tokens[id] = createSession(id).token;
  }
  const app = express(); app.use(express.json()); app.use("/sales", salesRouter);
  server = app.listen(0, "127.0.0.1"); await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server?.close(); db?.close(); rmSync(scratch, { recursive: true, force: true }); });

test("lead creation validates expected value and scheduled action date", async () => {
  assert.equal((await call("/sales/leads", tokens["rep-a"], "POST", { name: "   " })).status, 400);
  assert.equal((await call("/sales/leads", tokens["rep-a"], "POST", { name: "A", expectedValue: -1 })).status, 400);
  assert.equal((await call("/sales/leads", tokens["rep-a"], "POST", { name: "A", nextActionDate: "2026-02-30" })).status, 400);
  const response = await call("/sales/leads", tokens["rep-a"], "POST", { name: "Synthetic lead", expectedValue: 1234, nextActionDate: "2026-10-20" });
  assert.equal(response.status, 201);
  const id = (await response.json()).id;
  const saved = db.prepare("SELECT expected_value,next_action_date,stage FROM leads WHERE id=?").get(id);
  assert.deepEqual({ ...saved }, { expected_value: 1234, next_action_date: "2026-10-20", stage: "lead" });
});

test("team pipeline visibility, assignment controls, stage history and conversion report are scoped", async () => {
  const created = await call("/sales/leads", tokens["rep-a"], "POST", { name: "Team lead", expectedValue: 10000 });
  const leadId = (await created.json()).id;
  assert.equal((await call(`/sales/leads/${leadId}/stage`, tokens["rm-a"], "PATCH", { stage: "not-a-stage" })).status, 400);
  assert.equal((await call("/sales/leads", tokens["rm-a"])).status, 200);
  assert.ok((await (await call("/sales/leads", tokens["rm-a"])).json()).some((lead) => lead.id === leadId));
  assert.ok(!(await (await call("/sales/leads", tokens["rm-b"])).json()).some((lead) => lead.id === leadId));
  assert.equal((await call(`/sales/leads/${leadId}`, tokens["rep-b"])).status, 404);
  assert.equal((await call(`/sales/leads/${leadId}/assignment`, tokens["rm-a"], "PATCH", { userId: "rep-b" })).status, 403);
  assert.equal((await call(`/sales/leads/${leadId}/assignment`, tokens["rep-a"], "PATCH", { userId: "rep-a" })).status, 403);
  const rmAssignees = await (await call("/sales/leads/assignees", tokens["rm-a"])).json();
  assert.ok(rmAssignees.some((person) => person.userId === "rep-a"));
  assert.ok(!rmAssignees.some((person) => person.userId === "rep-b"));
  assert.equal((await call(`/sales/leads/${leadId}/assignment`, tokens["rm-a"], "PATCH", { userId: "rep-a" })).status, 200);
  for (const stage of ["technical_discussion", "sample", "quotation", "follow_up", "expected_order", "won", "lost"]) {
    assert.equal((await call(`/sales/leads/${leadId}/stage`, tokens["rm-a"], "PATCH", { stage })).status, 200);
  }
  assert.equal((await call(`/sales/leads/${leadId}/stage`, tokens["rm-b"], "PATCH", { stage: "won" })).status, 404);
  const details = await (await call(`/sales/leads/${leadId}`, tokens["rm-a"])).json();
  assert.equal(details.history.length, 7);
  assert.equal((await call(`/sales/leads/${leadId}/stage`, tokens["rm-a"], "PATCH", { stage: "lost" })).status, 200, "same-stage update is idempotent");
  assert.equal((await (await call(`/sales/leads/${leadId}`, tokens["rm-a"])).json()).history.length, 7);
  assert.deepEqual(details.history[0] && [details.history[0].previous_stage, details.history[0].new_stage], ["lead", "technical_discussion"]);
  assert.ok(details.history.every((entry) => entry.actor_user_id === "rm-a" && entry.changed_at));
  const conversion = await (await call("/sales/leads/report/conversion", tokens["rm-a"])).json();
  assert.ok(conversion.total >= 1);
  assert.equal(conversion.won, 0);
  const won = await call("/sales/leads", tokens["rep-a"], "POST", { name: "Won lead" });
  const wonId = (await won.json()).id;
  assert.equal((await call(`/sales/leads/${wonId}/stage`, tokens["rep-a"], "PATCH", { stage: "won" })).status, 200);
  const updatedConversion = await (await call("/sales/leads/report/conversion", tokens["rm-a"])).json();
  assert.equal(updatedConversion.won, 1);
  assert.ok(updatedConversion.conversionPercent > 0);
  assert.equal((await call(`/sales/leads/${leadId}/assignment`, tokens.admin, "PATCH", { userId: "rep-b" })).status, 200);
  assert.ok(!(await (await call("/sales/leads", tokens["rm-a"])).json()).some((lead) => lead.id === leadId));
  assert.ok((await (await call("/sales/leads", tokens["rm-b"])).json()).some((lead) => lead.id === leadId));
});
