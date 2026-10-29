import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'psspl-archive-'));
Object.assign(process.env, { NODE_ENV: 'test', CRM_DATABASE_PATH: join(scratch, 'synthetic.sqlite'), CRM_DISABLE_BASELINE_RESTORE: 'true', CRM_EMAIL_PROVIDER: 'disabled' });
let db, server, base;
const tokens = {};
const call = (path, actor = 'admin', body) => fetch(`${base}/admin${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(tokens[actor] ? { Authorization: `Bearer ${tokens[actor]}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
const snapshot = () => JSON.stringify(['users','salesperson_profiles','visits','leads','follow_ups','attendance','customer_activities','service_requests','tally_customers','expected_orders','generated_reports'].map(table => db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()));
before(async () => {
  ({ db } = await import('../server/db.mjs'));
  const { createSession } = await import('../server/auth.mjs');
  const { adminRouter } = await import('../server/admin.mjs');
  for (const [id, role, deletedAt] of [['admin','admin',null],['rm','rm',null],['rep','salesperson',null],['archived-a','salesperson','2026-10-21T00:00:00Z'],['archived-b','rm','2026-10-20T00:00:00Z'],['inactive','salesperson',null]]) {
    db.prepare('INSERT INTO users(id,email,password_hash,role,active,deleted_at) VALUES(?,?,?,?,?,?)').run(id, `${id}@deleted.invalid`, 'never-expose-this-hash', role, deletedAt || id === 'inactive' ? 0 : 1, deletedAt);
    db.prepare('INSERT INTO salesperson_profiles(user_id,employee_code,full_name,region,territory,manager_user_id) VALUES(?,?,?,?,?,?)').run(id,id,id,'North','Synthetic',role === 'salesperson' ? 'rm' : null);
    if (!deletedAt && id !== 'inactive') tokens[id] = createSession(id).token;
  }
  db.exec("INSERT INTO tally_customers(id,name,owner_user_id,city) VALUES('customer-a','Preserved Customer','archived-a','Test City'),('customer-b','Other Customer','archived-b','Other City'); INSERT INTO tally_products(id,name) VALUES('product','Preserved Product')");
  const visit = db.prepare('INSERT INTO visits(id,user_id,business_date,tally_customer_id,scheduled_at,purpose,notes) VALUES(?,?,?,?,?,?,?)');
  for (let index = 0; index < 27; index++) visit.run(`a-${String(index).padStart(3,'0')}`,'archived-a','2026-10-01','customer-a','2026-10-01T10:00','Preserved visit',`Notes ${index}`);
  visit.run('other-visit','archived-b','2026-10-01','customer-b','2026-10-01T10:00','Other employee visit','Other notes');
  db.exec("INSERT INTO leads(id,user_id,name,company) VALUES('lead-a','archived-a','Preserved lead','Test Company'); INSERT INTO follow_ups(id,user_id,tally_customer_id,title,due_date) VALUES('follow-a','archived-a','customer-a','Preserved follow-up','2026-10-20'); INSERT INTO attendance(id,user_id,business_date,check_in_at) VALUES('attendance-a','archived-a','2026-10-01','2026-10-01T10:00:00Z'); INSERT INTO customer_activities(id,user_id,lead_id,activity_type,subject) VALUES('activity-a','archived-a','lead-a','call','Preserved call'); INSERT INTO service_requests(id,user_id,lead_id,request_type,details) VALUES('request-a','archived-a','lead-a','sample','Preserved request'); INSERT INTO expected_orders(id,visit_id,user_id,tally_customer_id,tally_product_id,expected_value) VALUES('order-a','a-000','archived-a','customer-a','product',100); INSERT INTO generated_reports(id,user_id,report_type,date_from,date_to,payload_json) VALUES('report-a','archived-a','sales','2026-10-01','2026-10-20','{}')");
  const app = express(); app.use(express.json()); app.use('/admin', adminRouter);
  server = app.listen(0,'127.0.0.1'); await new Promise(resolve => server.once('listening',resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); db?.close(); rmSync(scratch,{recursive:true,force:true}); });

test('archive list and detail enforce administrator access', async () => {
  for (const path of ['/archived-users','/archived-users/archived-a/history']) {
    assert.equal((await call(path,null)).status,401);
    assert.equal((await call(path,'rm')).status,403);
    assert.equal((await call(path,'rep')).status,403);
  }
});
test('list includes only deleted accounts with preserved identity and exact history counts, excluding sign-in fields', async () => {
  const response = await call('/archived-users'); assert.equal(response.status,200);
  const data = await response.json(); assert.deepEqual(data.items.map(item=>item.id),['archived-a','archived-b']);
  const person = data.items[0]; assert.equal(person.fullName,'archived-a'); assert.equal(person.managerName,'rm');
  assert.equal(person.counts.visits,27);
  for (const section of ['leads','followUps','attendance','activities','requests','customers','orders','reports']) assert.equal(person.counts[section],1);
  assert.equal(person.email,undefined); assert.equal(person.password_hash,undefined); assert.equal(person.loginId,undefined);
  assert.ok(!JSON.stringify(data).includes('never-expose-this-hash'));
});
test('all history sections return only the selected employee records without changing stored data', async () => {
  const before = snapshot();
  for (const section of ['visits','leads','followUps','attendance','activities','requests','customers','orders','reports']) {
    const response = await call(`/archived-users/archived-a/history?section=${section}`); assert.equal(response.status,200);
    const data = await response.json(); assert.equal(data.employee.id,'archived-a'); assert.equal(data.section,section);
    assert.ok(data.items.length>0); assert.ok(!JSON.stringify(data.items).includes('Other employee visit'));
    assert.ok(!JSON.stringify(data).includes('never-expose-this-hash'));
  }
  assert.equal(snapshot(),before);
});
test('server pagination exposes every record once, with deterministic order and bounded page size', async () => {
  const first=await (await call('/archived-users/archived-a/history?section=visits')).json();
  const last=await (await call('/archived-users/archived-a/history?section=visits&page=2')).json();
  assert.equal(first.total,27); assert.equal(first.pages,2); assert.equal(first.items.length,25); assert.equal(last.items.length,2);
  assert.equal(new Set([...first.items,...last.items].map(item=>item.id)).size,27);
  assert.deepEqual((await (await call('/archived-users/archived-a/history?page=999')).json()).items,last.items);
});
test('active, inactive-but-not-deleted, unknown and malformed requests are rejected safely', async () => {
  for (const id of ['rep','inactive','missing']) assert.equal((await call(`/archived-users/${id}/history`)).status,404);
  for (const query of ['section=users','page=0','page=-1','page=not-a-number','pageSize=101','pageSize=0']) assert.equal((await call(`/archived-users/archived-a/history?${query}`)).status,400);
});


const credentials = { email: 'restored@example.test', loginId: 'Restored.Rep', initialPassword: 'Synthetic-Restore-2026!', managerUserId: 'rm' };
test('restore enforces admin access and validates credentials, uniqueness and active RM without changing the archive', async () => {
  const before = snapshot();
  for (const actor of [null, 'rm', 'rep']) assert.equal((await call('/archived-users/archived-a/restore', actor, credentials)).status, actor ? 403 : 401);
  for (const patch of [{ initialPassword: 'short' }, { email: 'invalid' }, { loginId: 'bad id' }, { managerUserId: null }, { managerUserId: 'inactive' }, { managerUserId: 'archived-b' }, { managerUserId: 'rep' }]) {
    assert.equal((await call('/archived-users/archived-a/restore', 'admin', { ...credentials, ...patch })).status, 400);
  }
  assert.equal((await call('/archived-users/archived-a/restore', 'admin', { ...credentials, email: 'ADMIN@deleted.invalid' })).status, 409);
  db.prepare("UPDATE users SET login_id='taken' WHERE id='rep'").run();
  assert.equal((await call('/archived-users/archived-a/restore', 'admin', { ...credentials, loginId: 'TAKEN' })).status, 409);
  db.prepare("UPDATE users SET login_id=NULL WHERE id='rep'").run();
  for (const id of ['rep', 'inactive', 'missing']) assert.equal((await call(`/archived-users/${id}/restore`, 'admin', credentials)).status, 404);
  assert.equal(snapshot(), before);
});

test('restore preserves employee identity and CRM history, replaces credentials, revokes stale access and records a redacted audit entry', async () => {
  const { createSession, verifyPassword } = await import('../server/auth.mjs');
  createSession('archived-a');
  const history = () => JSON.stringify(['visits','leads','follow_ups','attendance','customer_activities','service_requests','tally_customers','expected_orders','generated_reports'].map(table => db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()));
  const before = history();
  assert.equal((await call('/archived-users/archived-a/restore', 'admin', credentials)).status, 200);
  const user = db.prepare("SELECT * FROM users WHERE id='archived-a'").get();
  assert.equal(user.deleted_at, null); assert.equal(user.active, 1); assert.equal(user.email, credentials.email); assert.equal(user.login_id, 'restored.rep');
  assert.ok(await verifyPassword(credentials.initialPassword, user.password_hash));
  assert.equal(db.prepare("SELECT COUNT(*) n FROM sessions WHERE user_id='archived-a'").get().n, 0);
  assert.equal(db.prepare("SELECT employee_code FROM salesperson_profiles WHERE user_id='archived-a'").get().employee_code, 'archived-a');
  assert.equal(history(), before);
  assert.ok(!(await (await call('/archived-users')).json()).items.some(item => item.id === 'archived-a'));
  assert.ok((await (await call('/users')).json()).items.some(item => item.id === 'archived-a' && item.active));
  assert.equal((await call('/archived-users/archived-a/restore', 'admin', credentials)).status, 404);
  const audit = db.prepare("SELECT details_json FROM audit_logs WHERE path LIKE '%/archived-a/restore' ORDER BY created_at DESC LIMIT 1").get();
  assert.equal(JSON.parse(audit.details_json).initialPassword, '[redacted]');
  assert.ok(!audit.details_json.includes(credentials.initialPassword));
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('regional managers can be restored without a reporting manager', async () => {
  assert.equal((await call('/archived-users/archived-b/restore', 'admin', { ...credentials, email: 'restored-rm@example.test', loginId: 'restored-rm', managerUserId: null })).status, 200);
  assert.equal(db.prepare("SELECT role FROM users WHERE id='archived-b'").get().role, 'rm');
});
