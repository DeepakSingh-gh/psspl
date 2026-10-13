import { db } from "../server/db.mjs";
import { performance } from "perf_hooks";

console.log("=== DB Indexes ===");
const indexes = db.prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL").all();
console.log(indexes.map(i => `${i.tbl_name}: ${i.name}`).join("\n"));

console.log("\n=== Table Counts ===");
for (const t of ['tally_invoices', 'tally_invoice_lines', 'tally_customers', 'tally_products', 'tally_rm_product_sales', 'thrust_products', 'users', 'visits']) {
  try {
    const c = db.prepare(`SELECT COUNT(*) count FROM ${t}`).get();
    console.log(`${t}: ${c.count}`);
  } catch(e) {
    console.log(`${t}: ${e.message}`);
  }
}
