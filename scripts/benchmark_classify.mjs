import { db } from "../server/db.mjs";
import { performance } from "perf_hooks";

console.log("Analyzing regex compilation & execution...");

const thrustList = db.prepare("SELECT id, name, alias_keywords, sort_order FROM thrust_products WHERE active = 1 ORDER BY sort_order ASC").all();

function makeSqlLikeRegex(pattern) {
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
    regexes,
  };
});

// Load distinct products
const distinctProducts = db.prepare(`SELECT DISTINCT product_name FROM tally_invoice_lines WHERE product_name IS NOT NULL`).all().map(r => r.product_name);
console.log("Distinct product count:", distinctProducts.length);

console.time("classify_products");
// Pre-classify every distinct product once!
const productToThrustIds = new Map();
for (const p of distinctProducts) {
  const matchedIds = [];
  for (const { tp, regexes } of thrustMatchers) {
    if (regexes.some(r => r.test(p))) {
      matchedIds.push(tp.id);
    }
  }
  if (matchedIds.length) {
    productToThrustIds.set(p, matchedIds);
  }
}
console.timeEnd("classify_products");
console.log("Products classified in Map:", productToThrustIds.size);
