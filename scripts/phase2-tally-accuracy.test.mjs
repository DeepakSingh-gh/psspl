import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import express from "express";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { authoritativeInvoiceWhere, financialYearForDate, netInvoiceAmount, netInvoiceLineAmount, rupeesToCrore, rupeesToLakh } from "../server/tally/metrics.mjs";

const scratch = mkdtempSync(join(tmpdir(), "psspl-phase2-"));
process.env.CRM_DATABASE_PATH = join(scratch, "synthetic.sqlite");
process.env.NODE_ENV = "test";
process.env.CRM_DISABLE_BASELINE_RESTORE = "true";
let appServer, appUrl, crmDb, adminToken, tallyClient;

test.before(async () => {
  ({ db: crmDb } = await import("../server/db.mjs"));
  // Match the deployed profile columns consumed by RM reporting; the base
  // synthetic schema predates these fields.
  const { createSession } = await import("../server/auth.mjs");
  const { adminRouter } = await import("../server/admin.mjs");
  const { rmRouter } = await import("../server/rm-routes.mjs");
  const { connectorRouter } = await import("../server/connector-api.mjs");
  ({ tally: tallyClient } = await import("../server/tally/connector.mjs"));
  crmDb.prepare("INSERT INTO users (id,email,password_hash,role) VALUES ('phase2-admin','admin@phase2.test','synthetic','admin'),('phase2-rm','rm@phase2.test','synthetic','rm'),('phase2-zero-rm','zero@phase2.test','synthetic','rm'),('phase2-sales','sales@phase2.test','synthetic','salesperson'),('phase2-other','other@phase2.test','synthetic','salesperson')").run();
  crmDb.prepare("INSERT INTO salesperson_profiles (user_id,employee_code,full_name,region,territory,manager_user_id,monthly_target) VALUES ('phase2-rm','rm-code','RM Phase2','North','Synthetic',NULL,2.4),('phase2-zero-rm','zero-code','RM Zero Sales','North','Synthetic',NULL,0),('phase2-sales','sales-code','Sales Phase2','North','Synthetic','phase2-rm',1.2),('phase2-other','other-code','Other Phase2','South','Synthetic',NULL,1.0)").run();
  crmDb.prepare("INSERT INTO tally_customers (id,name,owner_user_id,rm_name) VALUES ('phase2-customer','Assigned Synthetic Customer','phase2-sales','RM Phase2'),('phase2-other-customer','Other Team Customer','phase2-other','Other Phase2'),('phase2-unassigned','Unassigned Synthetic Customer',NULL,'RM Phase2')").run();
  const addInvoice = crmDb.prepare("INSERT INTO tally_invoices (id,company_name,voucher_type,invoice_date,customer_id,customer_name,amount,source_sync_id) VALUES (?, 'Synthetic Tally','Sales','2026-04-15',?,'Synthetic Customer',100,'sync-1')");
  const addLine = crmDb.prepare("INSERT INTO tally_invoice_lines (id,invoice_id,product_name,quantity,rate,amount) VALUES (?,?,'Synthetic Product',1,100,100)");
  for (let n = 1; n <= 60; n += 1) {
    const id = `phase2-sales-${n}`;
    addInvoice.run(id, "phase2-customer");
    addLine.run(`phase2-line-${n}`, id);
  }
  crmDb.prepare("INSERT INTO tally_invoices (id,company_name,voucher_type,invoice_date,customer_id,customer_name,amount,source_sync_id) VALUES ('phase2-return','Synthetic Tally','Credit Note','2026-04-20','phase2-customer','Synthetic Customer',25,'sync-1'),('phase2-excel','Synthetic Tally','Sales','2026-04-20','phase2-customer','Synthetic Customer',999999,'excel-import'),('phase2-other-invoice','Synthetic Tally','Sales','2026-04-20','phase2-other-customer','Other Team Customer',500,'sync-1')").run();
  crmDb.prepare("INSERT INTO tally_invoice_lines (id,invoice_id,product_name,quantity,rate,amount) VALUES ('phase2-return-line','phase2-return','Synthetic Product',1,25,25),('phase2-excel-line','phase2-excel','Synthetic Product',1,999999,999999),('phase2-other-line','phase2-other-invoice','Other Product',1,500,500)").run();
  crmDb.prepare("INSERT INTO tally_rm_targets (rm_name,period,target_lakh) VALUES ('RM Phase2','2026-04',0.05975)").run();
  crmDb.prepare("INSERT INTO follow_ups (id,user_id,tally_customer_id,title,due_date,priority,completed) VALUES ('phase2-overdue','phase2-sales','phase2-customer','Synthetic overdue follow-up','2026-04-01','today',0)").run();
  adminToken = createSession("phase2-admin").token;
  const rmToken = createSession("phase2-rm").token;
  const app = express();
  app.use(express.json());
  app.use("/admin", adminRouter);
  app.use("/rm", rmRouter);
  app.use("/connector", connectorRouter);
  appServer = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => appServer.once("listening", resolve));
  appUrl = `http://127.0.0.1:${appServer.address().port}`;
  process.env.PHASE2_RM_TOKEN = rmToken;
});

test.after(() => {
  appServer?.close();
  crmDb?.close();
  rmSync(scratch, { recursive: true, force: true });
});

test("authoritative sales reconcile over all eligible invoices, excluding workbook projections and netting returns", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`CREATE TABLE tally_invoices (id TEXT PRIMARY KEY, ingest_session_id TEXT, source_sync_id TEXT, voucher_type TEXT, invoice_date TEXT, customer_id TEXT, amount REAL);
      CREATE TABLE tally_invoice_lines (id TEXT PRIMARY KEY, invoice_id TEXT, amount REAL, quantity REAL);
      CREATE TABLE tally_customers (id TEXT PRIMARY KEY, owner_user_id TEXT, rm_name TEXT);`);
    const invoice = db.prepare("INSERT INTO tally_invoices VALUES (?,?,?,?,?,?,?)");
    const line = db.prepare("INSERT INTO tally_invoice_lines VALUES (?,?,?,?)");
    db.prepare("INSERT INTO tally_customers VALUES ('assigned','sales-a','RM A'),('unmapped',NULL,NULL)").run();
    for (let n = 1; n <= 60; n += 1) {
      const id = `sales-${n}`;
      invoice.run(id, null, "sync-1", "Sales", "2026-04-15", "assigned", 100_000);
      line.run(`line-${n}`, id, 100_000, 1);
    }
    invoice.run("sales-return", null, "sync-1", "Credit Note", "2026-04-20", "assigned", 25_000);
    line.run("line-return", "sales-return", 25_000, 1);
    invoice.run("excel-projection", null, "excel-import", "Sales", "2026-04-15", "assigned", 9_999_999);
    line.run("line-excel", "excel-projection", 9_999_999, 1);
    invoice.run("pending-sync", "session-open", "sync-2", "Sales", "2026-04-15", "assigned", 88_000);

    const where = authoritativeInvoiceWhere("i");
    const headers = db.prepare(`SELECT COUNT(*) invoices,SUM(${netInvoiceAmount("i")}) sales FROM tally_invoices i WHERE ${where}`).get();
    const lines = db.prepare(`SELECT SUM(${netInvoiceLineAmount("i", "l")}) sales FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id WHERE ${where}`).get();
    assert.equal(headers.invoices, 61, "all 60 invoices plus credit note are included, without a 50-invoice cap");
    assert.equal(headers.sales, 5_975_000, "60 invoices less the credit note; synthetic and staged rows excluded");
    assert.equal(lines.sales, headers.sales, "product total reconciles to net invoice total for complete line coverage");
    assert.equal(db.prepare("SELECT COUNT(*) n FROM tally_invoices WHERE id='excel-projection'").get().n, 1, "excluded historical projection is retained");
  } finally { db.close(); }
});

test("financial year and display-unit conversions use explicit rupee factors", () => {
  assert.equal(financialYearForDate("2026-03-31"), "2025-26");
  assert.equal(financialYearForDate("2026-04-01"), "2026-27");
  assert.equal(financialYearForDate("bad-date"), null);
  assert.equal(rupeesToLakh(1_250_000), 12.5);
  assert.equal(rupeesToCrore(25_000_000), 2.5);
});

test("voucher identity remains idempotent for duplicate imports and ownership gaps stay explicit", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE invoices (id TEXT PRIMARY KEY, amount REAL)");
    const upsert = db.prepare("INSERT INTO invoices VALUES (?,?) ON CONFLICT(id) DO UPDATE SET amount=excluded.amount");
    upsert.run("company-guid-voucher-guid", 500);
    upsert.run("company-guid-voucher-guid", 500);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM invoices").get().n, 1);
    db.exec("CREATE TABLE tally_customers (id TEXT PRIMARY KEY, owner_user_id TEXT)");
    db.prepare("INSERT INTO tally_customers VALUES ('unmapped',NULL)").run();
    assert.equal(db.prepare("SELECT COUNT(*) n FROM tally_customers WHERE owner_user_id IS NULL").get().n, 1);
  } finally { db.close(); }
});

test("Tally chunk ingestion safely deduplicates retried voucher chunks", async () => {
  const pairingCode = "PHASE2-TEST-CODE";
  const codeHash = createHash("sha256").update(pairingCode).digest("hex");
  crmDb.prepare("INSERT INTO tally_connector_pairing_codes (id,code_hash,code_hint,created_by,expires_at) VALUES ('phase2-pairing',?,?, 'phase2-admin',datetime('now','+10 minutes'))")
    .run(codeHash, pairingCode.slice(-4));

  const pairingResponse = await fetch(`${appUrl}/connector/connectors/pair`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairingCode, installationId: "phase2-synthetic-agent", machineName: "Synthetic test", agentVersion: "test" }),
  });
  assert.equal(pairingResponse.status, 200);
  const { accessToken } = await pairingResponse.json();
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  const startResponse = await fetch(`${appUrl}/connector/ingest/tally/chunks`, {
    method: "POST", headers,
    body: JSON.stringify({ action: "start", company: "Synthetic Tally", from: "2026-04-01", to: "2026-04-30", syncId: "phase2-replay" }),
  });
  assert.equal(startResponse.status, 200);
  const { sessionId } = await startResponse.json();
  const voucherXml = "<VOUCHER><GUID>phase2-replay-guid</GUID><VOUCHERTYPENAME>Sales</VOUCHERTYPENAME><DATE>20260415</DATE><PARTYLEDGERNAME>Replay Customer</PARTYLEDGERNAME><VOUCHERNUMBER>R-1</VOUCHERNUMBER><AMOUNT>-100</AMOUNT><ALLINVENTORYENTRIES.LIST><STOCKITEMNAME>Replay Product</STOCKITEMNAME><ACTUALQTY>1 Nos</ACTUALQTY><RATE>100</RATE><AMOUNT>-100</AMOUNT></ALLINVENTORYENTRIES.LIST></VOUCHER>";
  const append = () => fetch(`${appUrl}/connector/ingest/tally/chunks`, {
    method: "POST", headers,
    body: JSON.stringify({ action: "append", sessionId, field: "vouchersXml", sequence: 0, content: voucherXml }),
  });
  const first = await append();
  assert.equal(first.status, 200);
  assert.deepEqual((await first.json()).processed, { duplicate: false, vouchers: 1, invoices: 1, invoiceLines: 1, payments: 0, purchases: 0, purchaseLines: 0 });
  const replay = await append();
  assert.equal(replay.status, 200);
  assert.deepEqual((await replay.json()).processed, { duplicate: true });

  const invoice = crmDb.prepare("SELECT id,amount,ingest_session_id FROM tally_invoices WHERE voucher_guid='phase2-replay-guid'").get();
  assert.ok(invoice?.id);
  assert.equal(invoice.amount, 100);
  assert.ok(invoice.ingest_session_id, "the unfinalized test import remains staged");
  assert.equal(crmDb.prepare("SELECT COUNT(*) count FROM tally_invoices WHERE voucher_guid='phase2-replay-guid'").get().count, 1);
  assert.equal(crmDb.prepare("SELECT COUNT(*) count FROM tally_invoice_lines WHERE invoice_id=?").get(invoice.id).count, 1);

  const nextChunk = await fetch(`${appUrl}/connector/ingest/tally/chunks`, {
    method: "POST", headers,
    body: JSON.stringify({ action: "append", sessionId, field: "vouchersXml", sequence: 1, content: voucherXml }),
  });
  assert.equal(nextChunk.status, 200);
  assert.equal((await nextChunk.json()).processed.duplicate, false);
  assert.equal(crmDb.prepare("SELECT COUNT(*) count FROM tally_invoices WHERE voucher_guid='phase2-replay-guid'").get().count, 1,
    "the same stable voucher identity in a later chunk must upsert, not duplicate");

  const replaySessionResponse = await fetch(`${appUrl}/connector/ingest/tally/chunks`, {
    method: "POST", headers,
    body: JSON.stringify({ action: "start", company: "Synthetic Tally", from: "2026-04-01", to: "2026-04-30", syncId: "phase2-replay-again" }),
  });
  assert.equal(replaySessionResponse.status, 200);
  const { sessionId: replaySessionId } = await replaySessionResponse.json();
  const updatedVoucher = voucherXml.replaceAll("-100", "-125").replace("R-1", "R-1-updated");
  const newSessionReplay = await fetch(`${appUrl}/connector/ingest/tally/chunks`, {
    method: "POST", headers,
    body: JSON.stringify({ action: "append", sessionId: replaySessionId, field: "vouchersXml", sequence: 0, content: updatedVoucher }),
  });
  assert.equal(newSessionReplay.status, 200);
  assert.equal((await newSessionReplay.json()).processed.invoices, 1);
  const replayed = crmDb.prepare("SELECT id,amount,ingest_session_id FROM tally_invoices WHERE voucher_guid='phase2-replay-guid'").get();
  assert.equal(replayed.id, invoice.id);
  assert.equal(replayed.amount, 125, "a replay updates the existing voucher with the latest source value");
  assert.equal(replayed.ingest_session_id, replaySessionId);
  assert.equal(crmDb.prepare("SELECT COUNT(*) count FROM tally_invoices WHERE voucher_guid='phase2-replay-guid'").get().count, 1);
  assert.equal(crmDb.prepare("SELECT COUNT(*) count FROM tally_invoice_lines WHERE invoice_id=?").get(invoice.id).count, 1);
});

test("admin sales report reconciles full invoice population and connector reads obey owner relationships", async () => {
  const response = await fetch(`${appUrl}/admin/reports/sales?from=2026-04-01&to=2026-04-30`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(response.status, 200);
  const report = await response.json();
  assert.equal(report.summary.invoiceCount, 62);
  assert.equal(report.summary.totalSales, 6_475);
  assert.equal(report.bySalesperson.reduce((sum, row) => sum + row.salesValue, 0), report.summary.totalSales);
  assert.equal(report.monthly.reduce((sum, row) => sum + row.salesValue, 0), report.summary.totalSales);
  const assigned = await tallyClient.customers({ salespersonId: "phase2-sales" });
  assert.deepEqual(assigned.map((row) => row.id), ["phase2-customer"]);
  assert.deepEqual(await tallyClient.customers({ salespersonId: "phase2-other" }).then((rows) => rows.map((row) => row.id)), ["phase2-other-customer"]);
  assert.deepEqual(await tallyClient.customers({ salespersonId: "phase2-rm" }).then((rows) => rows.map((row) => row.id)), ["phase2-customer"]);
  assert.equal((await tallyClient.customers({ salespersonId: "phase2-sales" })).some((row) => row.id === "phase2-unassigned"), false);
});

test("dashboard, team, product, management and RM report endpoints remain query-compatible", async () => {
  const paths = [
    "/admin/overview?fy=2026-27",
    "/admin/team?fy=2026-27",
    "/admin/product-trends?fy=2026-27",
    "/admin/management-reports?fy=2026-27",
    "/rm/report-card",
  ];
  for (const path of paths) {
    const isRm = path.startsWith("/rm/");
    const response = await fetch(`${appUrl}${path}`, { headers: { Authorization: `Bearer ${isRm ? process.env.PHASE2_RM_TOKEN : adminToken}` } });
    assert.equal(response.status, 200, `${path} should return 200; got ${response.status}`);
  }
  const detailResponse = await fetch(`${appUrl}/admin/team/rmphase2?from=2026-04-01&to=2026-04-30`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(detailResponse.status, 200, `RM detail should return 200; got ${detailResponse.status} (${await detailResponse.clone().text()})`);
  const detail = await detailResponse.json();
  assert.equal(detail.kpi.actualSalesValue, 5_975);
  assert.equal(detail.salesInvoiceCount, 61, "invoice total must exceed the 50-row detail window");
  assert.equal(detail.actualSales.length, 50, "detail list stays bounded while aggregate count remains complete");
  assert.equal(detail.activeDealerCount, 1);
  assert.equal(detail.topFiveDealerConcentrationPercent, 100);
  assert.equal(detail.newCustomersCount, null, "new customer origin is not fabricated from invoice history");
  assert.equal(detail.ownershipMapping, "verified");
  assert.equal(detail.monthlyPerformance.actual, 5_975);
  assert.equal(detail.monthlyPerformance.target, 5_975);
  assert.equal(detail.monthlyPerformance.achievementPercent, 100);
  assert.equal(detail.ytdPerformance.actual, 5_975);
  assert.equal(detail.kpi.followUpsOverdue, 1);
  assert.equal(detail.managementInsights.some((item) => item.id === "overdue-followups"), true);
  assert.equal(detail.dealerIntelligence.all.reduce((sum, dealer) => sum + dealer.salesValue, 0), detail.kpi.actualSalesValue);

  const zeroResponse = await fetch(`${appUrl}/admin/team/rmzerosales?from=2026-04-01&to=2026-04-30`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(zeroResponse.status, 200, `zero-sales RM should return 200; got ${await zeroResponse.clone().text()}`);
  const zeroReport = await zeroResponse.json();
  assert.equal(zeroReport.kpi.actualSalesValue, 0);
  assert.equal(zeroReport.monthlyPerformance.target, null);
  assert.equal(zeroReport.monthlyPerformance.achievementPercent, null);
  assert.equal(zeroReport.managementInsights.some((item) => item.id === "target-achievement"), false);

  const rmDashboardResponse = await fetch(`${appUrl}/rm/dashboard?from=2026-04-01&to=2026-04-30`, { headers: { Authorization: `Bearer ${process.env.PHASE2_RM_TOKEN}` } });
  assert.equal(rmDashboardResponse.status, 200);
  const rmDashboard = await rmDashboardResponse.json();
  assert.equal(rmDashboard.summary.salesValue, 5_975);
  assert.equal(rmDashboard.members.some((member) => member.id === "phase2-other"), false, "cross-team members must not enter RM totals");
});

test("management attention reconciles MTD/FYTD to RM report card and requires admin authorization", async () => {
  const asOf = new Date().toISOString().slice(0, 10);
  const monthStart = `${asOf.slice(0, 7)}-01`;
  const invoiceId = "phase4-current-month-invoice";
  crmDb.prepare("INSERT INTO tally_invoices (id,company_name,voucher_type,invoice_date,customer_id,customer_name,amount,source_sync_id) VALUES (?,'Synthetic Tally','Sales',?,'phase2-customer','Synthetic Customer',75,'sync-phase4')").run(invoiceId, asOf);
  crmDb.prepare("INSERT INTO tally_invoice_lines (id,invoice_id,product_name,quantity,rate,amount) VALUES ('phase4-current-month-line',?,'Synthetic Product',1,75,75)").run(invoiceId);
  crmDb.prepare("INSERT INTO tally_rm_targets (rm_name,period,target_lakh) VALUES (?, ?, 0.00075)").run("RM Phase2", asOf.slice(0, 7));

  const past = new Date(`${asOf}T00:00:00Z`); past.setUTCDate(past.getUTCDate() - 1);
  const pastDate = past.toISOString().slice(0, 10);
  const futureToday = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  crmDb.prepare("INSERT INTO visits (id,user_id,business_date,tally_customer_id,scheduled_at,purpose,status) VALUES ('phase4-past-visit','phase2-sales',?,'phase2-customer',?,'Synthetic visit','planned')").run(pastDate, `${pastDate}T10:00:00.000Z`);
  crmDb.prepare("INSERT INTO visits (id,user_id,business_date,tally_customer_id,scheduled_at,purpose,status) VALUES ('phase4-pending-visit','phase2-sales',?,'phase2-customer',?,'Synthetic visit','planned')").run(asOf, futureToday);
  crmDb.prepare("INSERT INTO visits (id,user_id,business_date,tally_customer_id,scheduled_at,purpose,status) VALUES ('phase4-completed-visit','phase2-sales',?,'phase2-customer',?,'Synthetic visit','completed')").run(asOf, new Date(Date.now() - 60 * 60 * 1000).toISOString());

  const response = await fetch(`${appUrl}/admin/management-attention?fy=2026-27`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(response.status, 200);
  const attention = await response.json();
  const rm = attention.team.find((entry) => entry.name === "RM Phase2");
  assert.ok(rm, "synthetic RM should be present with a verified mapping");
  const noTargetRm = attention.team.find((entry) => entry.name === "RM Zero Sales");
  assert.equal(noTargetRm.monthlyPerformance.target, null);
  assert.equal(noTargetRm.monthlyPerformance.achievementPercent, null);
  assert.equal(noTargetRm.ytdPerformance.target, null);
  assert.equal(noTargetRm.ytdPerformance.achievementPercent, null);
  const detailResponse = await fetch(`${appUrl}/admin/team/rmphase2?from=2026-04-01&to=${asOf}`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(detailResponse.status, 200);
  const detail = await detailResponse.json();
  assert.equal(rm.ytdPerformance.actual, detail.ytdPerformance.actual, "FYTD actual reconciles to the RM report card");
  assert.equal(rm.ytdPerformance.target, detail.ytdPerformance.target, "FYTD target reconciles to the RM report card");
  const mtdDetailResponse = await fetch(`${appUrl}/admin/team/rmphase2?from=${monthStart}&to=${asOf}`, { headers: { Authorization: `Bearer ${adminToken}` } });
  const mtdDetail = await mtdDetailResponse.json();
  assert.equal(rm.monthlyPerformance.actual, mtdDetail.monthlyPerformance.actual, "MTD actual reconciles to the RM report card");
  assert.equal(rm.monthlyPerformance.target, mtdDetail.monthlyPerformance.target, "MTD target reconciles to the RM report card");
  assert.equal(rm.concentrationPercent, detail.topFiveDealerConcentrationPercent);
  assert.ok(attention.dealerActions.some((item) => item.kind === "declining-dealer" || item.kind === "dormant-dealer") === false, "no dealer alert should be fabricated without supporting history");
  assert.ok(attention.visits.pastScheduled.some((visit) => visit.id === "phase4-past-visit"));
  assert.ok(attention.visits.pendingToday.some((visit) => visit.id === "phase4-pending-visit"));
  assert.equal(attention.visits.scheduledToday, 2);
  assert.equal(attention.visits.completedToday, 1);
  assert.ok(attention.visits.byRm.some((row) => row.rmName === "RM Phase2" && row.pastScheduled >= 1 && row.completedToday === 1));
  const denied = await fetch(`${appUrl}/admin/management-attention?fy=2026-27`, { headers: { Authorization: `Bearer ${process.env.PHASE2_RM_TOKEN}` } });
  assert.equal(denied.status, 403, "RM users cannot access the admin management aggregation");
});
