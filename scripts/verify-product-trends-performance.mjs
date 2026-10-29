import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { db } from '../server/db.mjs';
import { adminRouter } from '../server/admin.mjs';

const handler = adminRouter.stack.find(layer => layer.route?.path === '/product-trends').route.stack[0].handle;
const prepare = db.prepare.bind(db);
let timings = [];
db.prepare = sql => {
  const statement = prepare(sql);
  for (const method of ['get', 'all']) {
    const execute = statement[method].bind(statement);
    statement[method] = (...args) => {
      const start = performance.now();
      try { return execute(...args); }
      finally { timings.push({ ms: performance.now() - start, sql: sql.replace(/\s+/g, ' ').slice(0, 140) }); }
    };
  }
  return statement;
};
const results = {};
for (const fy of ['2026-27', '2025-26']) {
  timings = [];
  const start = performance.now();
  handler({ query: { fy } }, { json(body) { results[fy] = body; } }, error => { throw error; });
  console.log(JSON.stringify({ fy, ms: Math.round(performance.now() - start), queries: timings.length, slowest: timings.sort((a, b) => b.ms - a.ms).slice(0, 4) }));
}
if (process.argv[2] === '--save') writeFileSync(process.argv[3], JSON.stringify(results));
if (process.argv[2] === '--compare') {
  assert.deepEqual(JSON.parse(JSON.stringify(results)), JSON.parse(readFileSync(process.argv[3], 'utf8')));
  console.log('Product, territory and monthly figures exactly match the baseline.');
}
