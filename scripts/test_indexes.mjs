import { db } from "../server/db.mjs";

console.log("Checking index impact...");

console.time("create_indexes");
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_tally_customers_rm_name ON tally_customers(rm_name);
  CREATE INDEX IF NOT EXISTS idx_tally_invoices_session_date ON tally_invoices(ingest_session_id, invoice_date);
  CREATE INDEX IF NOT EXISTS idx_tally_invoice_lines_inv_prod ON tally_invoice_lines(invoice_id, product_name);
  CREATE INDEX IF NOT EXISTS idx_tally_rm_product_sales_rm ON tally_rm_product_sales(rm_name);
`);
console.timeEnd("create_indexes");

console.time("run_query");
const invoiceLines = db.prepare(`
  SELECT c.rm_name, l.product_name, SUM(l.amount) as amount, SUM(l.quantity) as qty
  FROM tally_invoice_lines l
  JOIN tally_invoices i ON i.id = l.invoice_id
  JOIN tally_customers c ON c.id = i.customer_id
  WHERE i.ingest_session_id IS NULL AND c.rm_name IS NOT NULL
  GROUP BY c.rm_name, l.product_name
`).all();
console.timeEnd("run_query");
console.log("Invoice lines aggregated:", invoiceLines.length);
