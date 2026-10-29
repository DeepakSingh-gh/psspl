import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { db } from '../server/db.mjs';
import { adminRouter } from '../server/admin.mjs';

// Invoke the read-only route directly to isolate SQL work from development compilation.
const handler = adminRouter.stack.find(layer => layer.route?.path === '/team/:id' && layer.route.methods.get).route.stack[0].handle;
const prepare = db.prepare.bind(db);
let timings = [];
db.prepare = sql => {
  const statement = prepare(sql);
  for (const method of ['get', 'all']) {
    const execute = statement[method].bind(statement);
    statement[method] = (...args) => {
      const start = performance.now();
      try { return execute(...args); }
      finally { timings.push({ ms: performance.now() - start, sql: sql.replace(/\s+/g, ' ').trim().slice(0, 220) }); }
    };
  }
  return statement;
};
const results = {};
for (const id of ['pradeepmulik', 'aniljena', 'ketanbhatt']) {
  timings = [];
  let body;
  const start = performance.now();
  handler({ params: { id }, query: { from: '2026-04-01', to: '2026-10-22' } }, {
    json(value) { body = value; },
    status(code) { throw new Error(`Unexpected status ${code}`); },
  }, error => { throw error; });
  assert.equal(body.id, id);
  results[id] = body;
  console.log(JSON.stringify({ id, ms: Math.round(performance.now() - start), queries: timings.length, slowest: timings.sort((a, b) => b.ms - a.ms).slice(0, 5) }));
}
if (process.argv[2] === '--save') writeFileSync(process.argv[3], JSON.stringify(results));
if (process.argv[2] === '--compare') {
  assert.deepEqual(JSON.parse(JSON.stringify(results)), JSON.parse(readFileSync(process.argv[3], 'utf8')));
  console.log('All RM detail response fields match the baseline.');
}
