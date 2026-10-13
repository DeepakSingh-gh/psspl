import { db } from "../server/db.mjs";
import { buildRmDirectory } from "../server/rm-directory.mjs";
import { calculateThrustProductsForNames } from "../server/admin.mjs";

console.log("Profiling parts of buildTeam...");

const directory = buildRmDirectory();

console.time("thrust_loop");
for (const entry of directory) {
  const allNames = [entry.name, ...entry.aliases];
  calculateThrustProductsForNames(allNames);
}
console.timeEnd("thrust_loop");

console.time("live_sales");
const liveSales = db.prepare(`
  SELECT i.invoice_date, i.amount, c.rm_name
  FROM tally_invoices i
  LEFT JOIN tally_customers c ON c.id=i.customer_id
  WHERE i.ingest_session_id IS NULL
`).all();
console.timeEnd("live_sales");
console.log("liveSales count:", liveSales.length);

console.time("live_top_products");
const startYear = 2026;
const liveTopProducts = db.prepare(`
  SELECT c.rm_name, l.product_name, SUM(l.amount) sales_value, SUM(l.quantity) quantity
  FROM tally_invoice_lines l
  JOIN tally_invoices i ON i.id=l.invoice_id
  LEFT JOIN tally_customers c ON c.id=i.customer_id
  WHERE i.ingest_session_id IS NULL AND i.invoice_date>=? AND i.invoice_date<?
  GROUP BY c.rm_name, l.product_name
  ORDER BY sales_value DESC
`).all(`${startYear}-04-01`, `${startYear + 1}-04-01`);
console.timeEnd("live_top_products");
console.log("liveTopProducts count:", liveTopProducts.length);
