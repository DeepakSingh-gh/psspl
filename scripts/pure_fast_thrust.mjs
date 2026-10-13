import { performance } from "perf_hooks";
import { db } from "../server/db.mjs";
import { buildRmDirectory } from "../server/rm-directory.mjs";

const directory = buildRmDirectory();
const thrustList = db.prepare("SELECT id, name, alias_keywords, sort_order FROM thrust_products WHERE active = 1 ORDER BY sort_order ASC").all();

function makeSqlLikeRegex(pattern) {
  let p = pattern.trim();
  let rx = '^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\%/g, '.*').replace(/_/g, '.') + '$';
  return new RegExp(rx, 'i');
}
const thrustMatchers = thrustList.map(tp => ({ tp, regexes: tp.alias_keywords.split('|').map(p => makeSqlLikeRegex(p)) }));

console.time("PURE_FAST_THRUST");

const invoiceLines = db.prepare(`
  SELECT c.rm_name, l.product_name, SUM(l.amount) as amount, SUM(l.quantity) as qty
  FROM tally_invoice_lines l
  JOIN tally_invoices i ON i.id = l.invoice_id
  JOIN tally_customers c ON c.id = i.customer_id
  WHERE i.ingest_session_id IS NULL AND c.rm_name IS NOT NULL
  GROUP BY c.rm_name, l.product_name
`).all();

const rmProductSales = db.prepare(`
  SELECT rm_name, product_name, SUM(sales_value) as amount, SUM(quantity) as qty
  FROM tally_rm_product_sales
  WHERE rm_name IS NOT NULL
  GROUP BY rm_name, product_name
`).all();

const productToThrust = new Map();
function classify(p) {
  if (!p) return [];
  if (productToThrust.has(p)) return productToThrust.get(p);
  const matched = [];
  for (const { tp, regexes } of thrustMatchers) {
    if (regexes.some(r => r.test(p))) matched.push(tp.id);
  }
  productToThrust.set(p, matched);
  return matched;
}

const invThrustByRm = new Map();
for (const r of invoiceLines) {
  const tIds = classify(r.product_name);
  if (!tIds.length) continue;
  if (!invThrustByRm.has(r.rm_name)) invThrustByRm.set(r.rm_name, new Map());
  const rmMap = invThrustByRm.get(r.rm_name);
  for (const tid of tIds) {
    if (!rmMap.has(tid)) rmMap.set(tid, { sales: 0, qty: 0 });
    const cur = rmMap.get(tid);
    cur.sales += r.amount || 0; cur.qty += r.qty || 0;
  }
}

const salesThrustByRm = new Map();
for (const r of rmProductSales) {
  const tIds = classify(r.product_name);
  if (!tIds.length) continue;
  if (!salesThrustByRm.has(r.rm_name)) salesThrustByRm.set(r.rm_name, new Map());
  const rmMap = salesThrustByRm.get(r.rm_name);
  for (const tid of tIds) {
    if (!rmMap.has(tid)) rmMap.set(tid, { sales: 0, qty: 0 });
    const cur = rmMap.get(tid);
    cur.sales += r.amount || 0; cur.qty += r.qty || 0;
  }
}

const results = [];
for (const entry of directory) {
  const allNames = [entry.name, ...entry.aliases];
  let totalSalesRupees = 0;
  const products = thrustList.map(tp => {
    let salesVal = 0; let qtyVal = 0;
    for (const name of allNames) {
      const invM = invThrustByRm.get(name);
      if (invM && invM.has(tp.id)) {
        salesVal += invM.get(tp.id).sales; qtyVal += invM.get(tp.id).qty;
      }
    }
    if (salesVal === 0) {
      for (const name of allNames) {
        const salesM = salesThrustByRm.get(name);
        if (salesM && salesM.has(tp.id)) {
          salesVal += salesM.get(tp.id).sales; qtyVal += salesM.get(tp.id).qty;
        }
      }
    }
    totalSalesRupees += salesVal;
    return { id: tp.id, name: tp.name, ytdSalesLakh: Number((salesVal / 100000).toFixed(2)), salesRupees: salesVal, quantitySold: qtyVal, isSold: salesVal > 0 };
  });
  results.push({ entry, totalSalesRupees, activeCount: products.filter(p => p.isSold).length });
}
console.timeEnd("PURE_FAST_THRUST");
console.log("Processed RMs:", results.length);
