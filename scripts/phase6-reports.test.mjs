import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const scratch = mkdtempSync(join(tmpdir(), "psspl-phase6-report-"));
process.env.CRM_DATABASE_PATH = join(scratch, "reports.sqlite");
process.env.NODE_ENV = "test";
process.env.CRM_DISABLE_BASELINE_RESTORE = "true";
let db, server, baseUrl, adminToken, repToken;

before(async () => {
  ({ db } = await import("../server/db.mjs"));
  const { createSession } = await import("../server/auth.mjs");
  const { adminRouter } = await import("../server/admin.mjs");
  db.prepare("INSERT INTO users(id,email,password_hash,role) VALUES('admin','admin@test.invalid','x','admin'),('rm','rm@test.invalid','x','rm'),('rep','rep@test.invalid','x','salesperson')").run();
  db.prepare("INSERT INTO salesperson_profiles(user_id,employee_code,full_name,region,territory,manager_user_id) VALUES('rm','rm','Team RM','North','Synthetic',NULL),('rep','rep','Rep North','North','Synthetic','rm')").run();
  adminToken = createSession("admin").token; repToken = createSession("rep").token;
  const app = express(); app.use(express.json()); app.use("/admin", adminRouter);
  server = app.listen(0, "127.0.0.1"); await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  db.prepare("INSERT INTO tally_products(id,name) VALUES(?,?)").run("product-a", "Coating A");
  const insertCustomer = db.prepare("INSERT INTO tally_customers(id,name,party_type,owner_user_id) VALUES(?,?, 'Distributor','rep')");
  const insertInvoice = db.prepare("INSERT INTO tally_invoices(id,company_name,voucher_type,invoice_date,customer_id,customer_name,amount,source_sync_id) VALUES(?, 'Synthetic', 'Sales', ?, ?, ?, 100, 'fixture')");
  const insertLine = db.prepare("INSERT INTO tally_invoice_lines(id,invoice_id,product_id,product_name,quantity,rate,amount) VALUES(?,?,? ,?,1,100,100)");
  for (let n = 1; n <= 105; n += 1) {
    const id = `customer-${n}`, invoice = `invoice-${n}`;
    insertCustomer.run(id, `Synthetic customer ${n}`);
    insertInvoice.run(invoice, n === 105 ? "2027-03-31" : "2026-04-15", id, `Synthetic customer ${n}`);
    insertLine.run(`line-${n}`, invoice, "product-a", n % 2 ? "Coating A" : "Coating B");
  }
});
after(() => { server?.close(); db?.close(); rmSync(scratch, { recursive: true, force: true }); });

const getReport = (params, token = adminToken) => fetch(`${baseUrl}/admin/reports/sales?${new URLSearchParams(params)}`, { headers: { Authorization: `Bearer ${token}` } });

test("advanced report filters apply to all Tally invoice aggregates and FY boundaries", async () => {
  const full = await getReport({ from: "2026-04-01", to: "2027-03-31" });
  assert.equal(full.status, 200);
  const data = await full.json();
  assert.equal(data.summary.invoiceCount, 105);
  assert.equal(data.byCustomer.length, 105, "complete customer aggregate is returned beyond 100 groups");
  assert.equal(data.byProduct.reduce((sum, row) => sum + row.salesValue, 0), data.summary.totalSales);
  const filtered = await getReport({ from: "2026-04-01", to: "2027-03-31", fy: "2026-27", productId: "product-a", territory: "Synthetic", salespersonId: "rm", dealer: "Distributor" });
  const scoped = await filtered.json();
  assert.equal(scoped.summary.invoiceCount, 105);
  assert.equal(scoped.summary.totalSales, 10_500);
  const one = await (await getReport({ from: "2026-04-01", to: "2027-03-31", customerId: "customer-1" })).json();
  assert.equal(one.summary.invoiceCount, 1);
  assert.equal(one.byProduct.reduce((sum, row) => sum + row.salesValue, 0), one.summary.totalSales);
  const fyOnly = await (await getReport({ fy: "2026-27" })).json();
  assert.equal(fyOnly.summary.invoiceCount, 105);
  assert.equal((await getReport({ fy: "2026-2027" })).status, 400);
});

test("sales report data is admin-only and export-facing aggregates are not truncated", async () => {
  assert.equal((await getReport({ from: "2026-04-01", to: "2027-03-31" }, repToken)).status, 403);
  const report = await (await getReport({ from: "2026-04-01", to: "2027-03-31" })).json();
  assert.equal(report.byCustomer.length, 105);
  assert.equal(report.summary.totalSales, 10_500);
  const saved = await fetch(`${baseUrl}/admin/reports/history`, { method: "POST", headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "2026-04-01", to: "2027-03-31", view: "customer", filters: { customerId: "customer-1" } }) });
  assert.equal(saved.status, 201);
  assert.equal((await saved.json()).summary.totalSales, 100);
  const history = await (await fetch(`${baseUrl}/admin/reports/history`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();
  assert.deepEqual(history.items[0].filters, { customerId: "customer-1" });
});
