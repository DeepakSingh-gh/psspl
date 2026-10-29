import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const scratch = mkdtempSync(join(tmpdir(), "psspl-visit-lead-"));
process.env.CRM_DATABASE_PATH = join(scratch, "crm.sqlite");
process.env.CRM_TEST_DATABASE_ROOT = scratch;
process.env.CRM_DISABLE_BASELINE_RESTORE = "true";
process.env.NODE_ENV = "test";

let db, transaction, server, base, tokens;
const call = (path, token, method = "GET", body) => fetch(`${base}${path}`, {
  method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
  body: body ? JSON.stringify(body) : undefined,
});

before(async () => {
  ({ db, transaction } = await import("../server/db.mjs"));
  const { createSession } = await import("../server/auth.mjs");
  const { salesRouter } = await import("../server/sales-routes.mjs");
  const { adminRouter } = await import("../server/admin.mjs");
  for (const [id, role] of [["admin", "admin"], ["rm-a", "rm"], ["rm-b", "rm"]]) {
    db.prepare("INSERT INTO users(id,email,password_hash,role) VALUES(?,?,?,?)").run(id, `${id}@example.test`, "synthetic", role);
    db.prepare("INSERT INTO salesperson_profiles(user_id,employee_code,full_name,region,territory) VALUES(?,?,?,?,?)")
      .run(id, id, id, "Test", "Test");
  }
  tokens = Object.fromEntries(["admin", "rm-a", "rm-b"].map((id) => [id, createSession(id).token]));
  db.prepare("INSERT INTO tally_customers(id,name,contact_name,phone,city,owner_user_id) VALUES('customer-a','Acme Ltd','A Customer','1234567890','Pune','rm-a')").run();
  db.prepare("INSERT INTO tally_products(id,name) VALUES('product-a','Synthetic product')").run();
  db.prepare("INSERT INTO visits(id,user_id,business_date,tally_customer_id,scheduled_at,purpose,status) VALUES('visit-a','rm-a','2026-10-23','customer-a','2026-10-23T10:00:00','Unplanned','in_progress')").run();
  const app = express(); app.use(express.json()); app.use("/sales", salesRouter); app.use("/admin", adminRouter);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server?.close(); db?.close(); rmSync(scratch, { recursive: true, force: true }); });

test("completed RM visit creates one exact-customer lead, drag stage persists and admin sees it", async () => {
  const { completeVisitWithLead, upsertLeadFromCompletedVisit } = await import("../server/visit-lead.mjs");
  const visit = db.prepare("SELECT * FROM visits WHERE id='visit-a'").get();
  const completion = { productId: "product-a", outcome: "Quotation required", expectedOrderValue: 25000, nextFollowUp: "2026-10-30", notes: "Discussed samples" };
  const leadId = completeVisitWithLead(db, transaction, visit, completion);
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(leadId);
  assert.equal(lead.name, "A Customer");
  assert.equal(lead.company, "Acme Ltd");
  assert.equal(lead.tally_customer_id, "customer-a");
  assert.equal(lead.source_visit_id, "visit-a");
  assert.equal(lead.expected_value, 25000);
  assert.equal(lead.stage, "lead");
  assert.equal(db.prepare("SELECT status FROM visits WHERE id='visit-a'").get().status, "completed");
  assert.equal(db.prepare("SELECT COUNT(*) count FROM follow_ups WHERE visit_id='visit-a'").get().count, 1);
  assert.equal(db.prepare("SELECT expected_value FROM expected_orders WHERE visit_id='visit-a'").get().expected_value, 25000);
  assert.equal((await call("/sales/leads", tokens["rm-a"])).status, 200);
  assert.equal((await (await call("/sales/leads", tokens["rm-b"])).json()).length, 0);
  assert.equal((await call(`/sales/leads/${leadId}/stage`, tokens["rm-b"], "PATCH", { stage: "quotation" })).status, 404);
  assert.equal((await call(`/sales/leads/${leadId}/stage`, tokens["rm-a"], "PATCH", { stage: "quotation" })).status, 200);
  assert.equal(db.prepare("SELECT stage FROM leads WHERE id=?").get(leadId).stage, "quotation");
  assert.equal(db.prepare("SELECT new_stage FROM lead_stage_history WHERE lead_id=?").get(leadId).new_stage, "quotation");
  const { rmMyDayEntries } = await import("../server/rm-my-day-entries.mjs");
  const savedEntries = rmMyDayEntries(db, { ids: ["rm-a"], from: "2026-10-01", asOf: "2026-10-31", available: true });
  assert.equal(savedEntries.length, 1, "a completed visit and its generated order, follow-up, and lead form one saved entry");
  assert.equal(savedEntries[0].id, "visit:visit-a");
  assert.equal(savedEntries[0].leadStage, "quotation");
  assert.equal(savedEntries[0].expectedValue, 25000);
  assert.equal(savedEntries[0].followUpDate, "2026-10-30");
  db.prepare("INSERT INTO visits(id,user_id,business_date,tally_customer_id,scheduled_at,purpose,status) VALUES('visit-planned','rm-a','2026-10-23','customer-a','2026-10-23T13:00:00','Next visit','planned')").run();
  assert.equal(rmMyDayEntries(db, { ids: ["rm-a"], from: "2026-10-01", asOf: "2026-10-31", available: true }).length, 1,
    "an uncompleted route plan is not a saved visit outcome");
  assert.equal((await call("/admin/overview", tokens["rm-a"])).status, 403);
  const overviewResponse = await call("/admin/overview", tokens.admin);
  assert.equal(overviewResponse.status, 200);
  const overview = await overviewResponse.json();
  assert.equal(overview.leadPipeline.recent.find((row) => row.id === leadId).stage, "quotation");
  assert.equal(overview.leadPipeline.stages.find((row) => row.stage === "quotation").count, 1);

  db.prepare("INSERT INTO visits(id,user_id,business_date,tally_customer_id,scheduled_at,purpose,status) VALUES('visit-b','rm-a','2026-10-23','customer-a','2026-10-23T11:00:00','Repeat','completed')").run();
  const again = upsertLeadFromCompletedVisit(db, db.prepare("SELECT * FROM visits WHERE id='visit-b'").get(), { ...completion, expectedOrderValue: 30000 });
  assert.equal(again, leadId);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM leads").get().count, 1);
  assert.equal(db.prepare("SELECT stage,expected_value FROM leads WHERE id=?").get(leadId).stage, "quotation");
  assert.equal(rmMyDayEntries(db, { ids: ["rm-a"], from: "2026-10-01", asOf: "2026-10-31", available: true })
    .find((entry) => entry.id === "visit:visit-b").leadStage, "quotation");
  const thirdVisit = { ...visit, id: "visit-c" };
  db.prepare("INSERT INTO visits(id,user_id,business_date,tally_customer_id,scheduled_at,purpose,status) VALUES('visit-c','rm-a','2026-10-23','customer-a','2026-10-23T12:00:00','Another repeat','completed')").run();
  upsertLeadFromCompletedVisit(db, thirdVisit, { ...completion, expectedOrderValue: 0 });
  assert.equal(db.prepare("SELECT expected_value FROM leads WHERE id=?").get(leadId).expected_value, 30000);
});
