import { db } from "../server/db.mjs";
import { buildRmDirectory, resolveRmId } from "../server/rm-directory.mjs";
import { calculateThrustProductsForNames } from "../server/admin.mjs";

console.log("Verifying accuracy of batch vs per-RM calculation...");

const directory = buildRmDirectory();
const thrustList = db.prepare("SELECT id, name, alias_keywords, sort_order FROM thrust_products WHERE active = 1 ORDER BY sort_order ASC").all();

// Original results
const originalMap = new Map();
for (const entry of directory) {
  const allNames = [entry.name, ...entry.aliases];
  const res = calculateThrustProductsForNames(allNames);
  originalMap.set(entry.id, res);
}

// Optimized Batch calculation
console.time("batch_calc");

// Precompile regexes for each thrust product
const thrustMatchers = thrustList.map((tp) => {
  const patterns = tp.alias_keywords.split("|").map(p => p.trim().replace(/^%|%$/g, ''));
  // SQL LIKE '%patinas%' in JS is case-insensitive includes
  return {
    tp,
    matches: (productName) => {
      const lower = (productName || "").toLowerCase();
      return patterns.some(pat => lower.includes(pat.toLowerCase()));
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

// Group rows by resolved RM id
const rmInvoiceByRmId = new Map();
for (const row of invoiceLines) {
  const rmId = resolveRmId(directory, row.rm_name);
  if (!rmId) continue;
  if (!rmInvoiceByRmId.has(rmId)) rmInvoiceByRmId.set(rmId, []);
  rmInvoiceByRmId.get(rmId).push(row);
}

const rmSalesByRmId = new Map();
for (const row of rmProductSales) {
  const rmId = resolveRmId(directory, row.rm_name);
  if (!rmId) continue;
  if (!rmSalesByRmId.has(rmId)) rmSalesByRmId.set(rmId, []);
  rmSalesByRmId.get(rmId).push(row);
}

const batchMap = new Map();
for (const entry of directory) {
  const invRows = rmInvoiceByRmId.get(entry.id) || [];
  const salesRows = rmSalesByRmId.get(entry.id) || [];

  let totalSalesRupees = 0;
  const products = thrustMatchers.map(({ tp, matches }) => {
    // 1. check live invoices
    let salesVal = 0;
    let qtyVal = 0;
    for (const r of invRows) {
      if (matches(r.product_name)) {
        salesVal += r.amount || 0;
        qtyVal += r.qty || 0;
      }
    }

    // 2. fallback to rmProductSales if 0
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

  batchMap.set(entry.id, {
    products,
    totalYtdLakh,
    totalSalesRupees,
    activeCount,
    totalCount: products.length,
  });
}
console.timeEnd("batch_calc");

// Compare results
let diffCount = 0;
for (const entry of directory) {
  const orig = originalMap.get(entry.id);
  const bat = batchMap.get(entry.id);
  if (orig.totalYtdLakh !== bat.totalYtdLakh || orig.activeCount !== bat.activeCount) {
    console.log(`Mismatch for ${entry.name}: orig total=${orig.totalYtdLakh}, batch total=${bat.totalYtdLakh}`);
    diffCount++;
  }
}
console.log(`Verification complete. Mismatches: ${diffCount} / ${directory.length}`);
