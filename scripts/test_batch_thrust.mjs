import { db } from "../server/db.mjs";
import { buildRmDirectory, resolveRmId } from "../server/rm-directory.mjs";

console.log("Testing batch thrust computation...");

console.time("batch_thrust");

const thrustList = db.prepare("SELECT id, name, alias_keywords, sort_order FROM thrust_products WHERE active = 1 ORDER BY sort_order ASC").all();

// Precompile regex / patterns for in-memory matching or single-query group by
// Let's see how many invoice lines exist and how fast an in-memory scan is:
console.time("invoice_lines_load");
const invoiceLines = db.prepare(`
  SELECT c.rm_name, l.product_name, SUM(l.amount) as amount, SUM(l.quantity) as qty
  FROM tally_invoice_lines l
  JOIN tally_invoices i ON i.id = l.invoice_id
  JOIN tally_customers c ON c.id = i.customer_id
  WHERE i.ingest_session_id IS NULL AND c.rm_name IS NOT NULL
  GROUP BY c.rm_name, l.product_name
`).all();
console.timeEnd("invoice_lines_load");
console.log("Aggregated invoice product groups:", invoiceLines.length);

console.time("rm_product_sales_load");
const rmProductSales = db.prepare(`
  SELECT rm_name, product_name, SUM(sales_value) as amount, SUM(quantity) as qty
  FROM tally_rm_product_sales
  WHERE rm_name IS NOT NULL
  GROUP BY rm_name, product_name
`).all();
console.timeEnd("rm_product_sales_load");
console.log("RM product sales groups:", rmProductSales.length);

console.timeEnd("batch_thrust");
