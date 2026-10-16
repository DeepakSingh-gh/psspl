import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { db } from '../server/db.mjs';
import { tally } from '../server/tally/connector.mjs';
import { buildRmDirectory, resolveRmId } from '../server/rm-directory.mjs';

// Compare with the previous query on the actual local ledger, without writing data.
const directory = buildRmDirectory();
const users = db.prepare("SELECT u.id,p.full_name FROM users u JOIN salesperson_profiles p ON p.user_id=u.id WHERE u.active=1 AND u.role IN ('rm','salesperson')").all();
users.push({id:'nonexistent-performance-check',full_name:''});
let beforeMs = 0;
let afterMs = 0;
for (const user of users) {
  const rm = directory.find(e => e.id === user.id || e.keys?.includes(user.id) || resolveRmId(directory, user.full_name) === e.id);
  const names = rm ? [rm.name,...rm.aliases] : [user.full_name].filter(Boolean);
  const ph = names.map(() => '?').join(',');
  const started = performance.now();
  const expected = db.prepare(`
    SELECT l.product_name name,SUM(l.amount) salesValue,SUM(l.quantity) quantity
    FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id
    JOIN tally_customers c ON c.id=i.customer_id
    WHERE i.ingest_session_id IS NULL
      AND (c.owner_user_id=? OR c.owner_user_id IN (SELECT user_id FROM salesperson_profiles WHERE manager_user_id=?) OR c.rm_name IN (${ph}))
    GROUP BY l.product_name ORDER BY salesValue DESC LIMIT 5
  `).all(user.id,user.id,...names);
  beforeMs += performance.now()-started;
  const optimizedStart = performance.now();
  const actual = await tally.overview({salespersonId:user.id,directory});
  afterMs += performance.now()-optimizedStart;
  assert.equal(actual.topProducts.length,expected.length);
  for (let i=0;i<expected.length;i++) {
    assert.equal(actual.topProducts[i].name,expected[i].name);
    for (const field of ['salesValue','quantity']) {
      assert.ok(Math.abs(actual.topProducts[i][field]-expected[i][field]) < 0.01, 'Aggregate differs for '+field);
    }
  }
}
// Supplying a request-local directory must not change customer or target scope.
for (const user of users.slice(0,3)) {
  for (const method of ['customers','salesSummary']) {
    assert.deepEqual(await tally[method]({salespersonId:user.id,directory}),await tally[method]({salespersonId:user.id}));
  }
}
console.log(JSON.stringify({verifiedScopes:users.length,legacyQueryTotalMs:Math.round(beforeMs),optimizedOverviewTotalMs:Math.round(afterMs),speedup:Number((beforeMs/afterMs).toFixed(1))}));
