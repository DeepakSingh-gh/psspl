import { db } from "../server/db.mjs";
import { buildRmDirectory, resolveRmId } from "../server/rm-directory.mjs";
import { calculateThrustProductsForNames } from "../server/admin.mjs";

console.log("Testing exact SQL LIKE simulation in JS...");

const directory = buildRmDirectory();
const thrustList = db.prepare("SELECT id, name, alias_keywords, sort_order FROM thrust_products WHERE active = 1 ORDER BY sort_order ASC").all();

function makeSqlLikeRegex(pattern) {
  // convert SQL LIKE pattern to regex:
  // % -> .*
  // _ -> .
  // escape special regex chars
  let p = pattern.trim();
  let rx = '^' + p
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\%/g, '.*')
    .replace(/_/g, '.') + '$';
  return new RegExp(rx, 'i');
}

const thrustMatchers = thrustList.map((tp) => {
  const regexes = tp.alias_keywords.split("|").map(p => makeSqlLikeRegex(p));
  return {
    tp,
    matches: (productName) => {
      const name = productName || "";
      return regexes.some(r => r.test(name));
    }
  };
});

// Load live invoice sums grouped by rm_name and product_name
const invoiceLines = db.prepare(`
  SELECT c.rm_name, l.product_name, SUM(l.amount) as amount, SUM(l.quantity) as qty
  FROM tally_invoice_lines l
  JOIN tally_invoices i ON i.id = l.invoice_id
  JOIN tally_customers c ON c.id = i.customer_id
  WHERE i.ingest_session_id IS NULL AND c.rm_name IS NOT NULL
  GROUP BY c.rm_name, l.product_name
`).all();

// Load fallback RM product sales
const rmProductSales = db.prepare(`
  SELECT rm_name, product_name, SUM(sales_value) as amount, SUM(quantity) as qty
  FROM tally_rm_product_sales
  WHERE rm_name IS NOT NULL
  GROUP BY rm_name, product_name
`).all();

// Group rows by rm_name exact
const invByRmName = new Map();
for (const r of invoiceLines) {
  if (!invByRmName.has(r.rm_name)) invByRmName.set(r.rm_name, []);
  invByRmName.get(r.rm_name).push(r);
}

const salesByRmName = new Map();
for (const r of rmProductSales) {
  if (!salesByRmName.has(r.rm_name)) salesByRmName.set(r.rm_name, []);
  salesByRmName.get(r.rm_name).push(r);
}

console.time("batch_calc");

let diffCount = 0;
for (const entry of directory) {
  const allNames = [entry.name, ...entry.aliases];
  const orig = calculateThrustProductsForNames(allNames);

  // Gather all rows matching any name in allNames
  const invRows = [];
  for (const n of allNames) {
    if (invByRmName.has(n)) invRows.push(...invByRmName.get(n));
  }

  const salesRows = [];
  for (const n of allNames) {
    if (salesByRmName.has(n)) salesRows.push(...salesByRmName.get(n));
  }

  let totalSalesRupees = 0;
  const products = thrustMatchers.map(({ tp, matches }) => {
    let salesVal = 0;
    let qtyVal = 0;
    for (const r of invRows) {
      if (matches(r.product_name)) {
        salesVal += r.amount || 0;
        qtyVal += r.qty || 0;
      }
    }

    if (salesVal === 0) {
      for (const r of salesRows) {
        if (matches(r.product_name)) {
          salesVal += r.amount || 0;
          qtyVal += r.qty || 0;
        }
      }
    }

    const ytdSalesLakh = Number((salesVal / 100000).toFixed(2));
    totalSalesRupees += salesVal;

    return {
      id: tp.id,
      name: tp.name,
      ytdSalesLakh,
      salesRupees: salesVal,
      quantitySold: qtyVal,
      isSold: salesVal > 0,
    };
  });

  const totalYtdLakh = Number((totalSalesRupees / 100000).toFixed(2));
  const activeCount = products.filter(p => p.isSold).length;

  if (orig.totalYtdLakh !== totalYtdLakh || orig.activeCount !== activeCount) {
    console.log(`Mismatch for ${entry.name}: orig total=${orig.totalYtdLakh}, batch total=${totalYtdLakh}, orig active=${orig.activeCount}, batch active=${activeCount}`);
    diffCount++;
  }
}
console.timeEnd("batch_calc");
console.log(`Exact comparison complete. Mismatches: ${diffCount} / ${directory.length}`);
