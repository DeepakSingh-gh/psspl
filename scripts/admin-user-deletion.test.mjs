import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const scratch = mkdtempSync(join(tmpdir(), 'psspl-user-delete-'));
Object.assign(process.env, { NODE_ENV: 'test', CRM_DATABASE_PATH: join(scratch, 'synthetic.sqlite'), CRM_DISABLE_BASELINE_RESTORE: 'true', CRM_EMAIL_PROVIDER: 'disabled' });
let db, createSession, server, base;
const tokens = {};
const call = (path, actor, method = 'GET', body) => fetch(`${base}${path}`, { method,
  headers: { 'Content-Type': 'application/json', ...(tokens[actor] ? { Authorization: `Bearer ${tokens[actor]}` } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body) });
const add = (id, role = 'salesperson', manager = 'rm') => {
  db.prepare('INSERT INTO users(id,email,login_id,password_hash,role) VALUES(?,?,?,?,?)').run(id, `${id}@example.test`, id, 'synthetic-hash', role);
  db.prepare('INSERT INTO salesperson_profiles(user_id,employee_code,full_name,region,territory,manager_user_id,mobile_number) VALUES(?,?,?,?,?,?,?)').run(id, id, id, 'North', 'Test', role === 'salesperson' ? manager : null, '+919876543210');
  tokens[id] = createSession(id).token;
};
before(async () => {
  ({ db } = await import('../server/db.mjs'));
  ({ createSession } = await import('../server/auth.mjs'));
  const { authenticate } = await import('../server/auth.mjs');
  const { adminRouter } = await import('../server/admin.mjs');
  add('admin', 'admin'); add('rm', 'rm'); add('rep');
  const app = express(); app.use(express.json()); app.use('/admin', adminRouter);
  app.get('/me', authenticate, (req, res) => res.json({ user: req.user }));
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); db?.close(); rmSync(scratch, { recursive: true, force: true }); });

test('deletion requires admin access, matching confirmation and protects the signed-in admin', async () => {
  for (const actor of [null, 'rm', 'rep']) assert.equal((await call('/admin/users/rep', actor, 'DELETE', { confirmEmail: 'rep@example.test' })).status, actor ? 403 : 401);
  assert.equal((await call('/admin/users/rep', 'admin', 'DELETE', {})).status, 400);
  assert.equal((await call('/admin/users/rep', 'admin', 'DELETE', { confirmEmail: 'wrong@example.test' })).status, 400);
  assert.equal((await call('/admin/users/admin', 'admin', 'DELETE', { confirmEmail: 'admin@example.test' })).status, 400);
  assert.equal((await call('/me', 'rep')).status, 200, 'rejected deletions do not revoke sessions');
});

test('deleting an account preserves linked CRM records, revokes access and cannot be undone through account APIs', async () => {
  add('history');
  db.exec("INSERT INTO tally_customers(id,name,owner_user_id) VALUES('delete-customer','Preserved Customer','history')");
  db.exec("INSERT INTO leads(id,user_id,name) VALUES('delete-lead','history','Preserved lead')");
  db.exec("INSERT INTO visits(id,user_id,business_date,tally_customer_id,scheduled_at,purpose) VALUES('delete-visit','history','2026-10-20','delete-customer','2026-10-20T10:00','Preserved visit')");
  db.exec("INSERT INTO follow_ups(id,user_id,tally_customer_id,title,due_date,visit_id) VALUES('delete-follow','history','delete-customer','Preserved follow-up','2026-10-21','delete-visit')");
  db.exec("INSERT INTO attendance(id,user_id,business_date,check_in_at) VALUES('delete-attendance','history','2026-10-20','2026-10-20T10:00:00Z')");
  db.exec("INSERT INTO customer_activities(id,user_id,lead_id,activity_type,subject) VALUES('delete-activity','history','delete-lead','call','Preserved call')");
  db.prepare('INSERT INTO auth_tokens(token_hash,user_id,purpose,expires_at) VALUES(?,?,?,?)').run('synthetic-reset-hash', 'history', 'reset', '2030-01-01');
  db.prepare('INSERT INTO auth_email_queue(id,user_id,purpose,token_hash,encrypted_payload,idempotency_key,expires_at) VALUES(?,?,?,?,?,?,?)').run(randomUUID(), 'history', 'reset', 'synthetic-reset-hash', 'synthetic-encrypted-payload', randomUUID(), '2030-01-01');
  db.exec("INSERT INTO report_schedules(id,recipient_user_id,phone,cadence,send_time,template_name,language,approval_reference,enabled,created_by,created_at) VALUES('delete-schedule','history','+919876543210','daily','09:00','test','en','test',1,'admin','2026-10-20')");
  const tables = ['tally_customers', 'leads', 'visits', 'follow_ups', 'attendance', 'customer_activities'];
  const snapshot = () => tables.map(table => db.prepare(`SELECT * FROM ${table} ORDER BY id`).all());
  const before = snapshot();
  assert.equal((await call('/admin/users/history', 'admin', 'DELETE', { confirmEmail: 'HISTORY@example.test' })).status, 200);
  assert.deepEqual(snapshot(), before);
  const user = db.prepare("SELECT * FROM users WHERE id='history'").get();
  assert.equal(user.active, 0); assert.ok(user.deleted_at); assert.equal(user.login_id, null);
  assert.equal(user.password_hash, '!deleted'); assert.notEqual(user.email, 'history@example.test');
  assert.equal(db.prepare("SELECT full_name FROM salesperson_profiles WHERE user_id='history'").get().full_name, 'history');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM sessions WHERE user_id='history'").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM auth_tokens WHERE user_id='history'").get().n, 0);
  const job = db.prepare("SELECT status,encrypted_payload FROM auth_email_queue WHERE user_id='history'").get();
  assert.equal(job.status, 'canceled'); assert.equal(job.encrypted_payload, '');
  assert.equal(db.prepare("SELECT enabled FROM report_schedules WHERE id='delete-schedule'").get().enabled, 0);
  assert.equal((await call('/me', 'history')).status, 401);
  const listed = await (await call('/admin/users', 'admin')).json();
  assert.equal(listed.currentUserId, 'admin'); assert.ok(!listed.items.some(item => item.id === 'history'));
  assert.equal((await call('/admin/users/history', 'admin', 'PATCH', { active: true })).status, 404);
  assert.equal((await call('/admin/users/history/password', 'admin', 'POST', { password: 'Synthetic-Password-2026!' })).status, 404);
  assert.equal((await call('/admin/users/history/invitation', 'admin', 'POST', {})).status, 404);
  assert.equal((await call('/admin/users/history', 'admin', 'DELETE', { confirmEmail: 'history@example.test' })).status, 404);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  assert.ok(db.prepare("SELECT id FROM audit_logs WHERE action='DELETE /users/history'").get(), 'deletion is audited');
});

test('an RM must have their reporting employees reassigned before deletion', async () => {
  assert.equal((await call('/admin/users/rm', 'admin', 'DELETE', { confirmEmail: 'rm@example.test' })).status, 409);
  assert.equal((await call('/me', 'rm')).status, 200);
  assert.equal(db.prepare("SELECT manager_user_id FROM salesperson_profiles WHERE user_id='rep'").get().manager_user_id, 'rm');
  add('replacement-rm', 'rm');
  db.prepare("UPDATE salesperson_profiles SET manager_user_id='replacement-rm' WHERE manager_user_id='rm'").run();
  assert.equal((await call('/admin/users/rm', 'admin', 'DELETE', { confirmEmail: 'rm@example.test' })).status, 200);
  assert.equal((await call('/me', 'rm')).status, 401);
});

test('deleted login credentials can be reused while historical identity and records stay attached to the original user', async () => {
  const created = await call('/admin/users', 'admin', 'POST', { email: 'history@example.test', loginId: 'history', employeeCode: 'history-replacement', role: 'salesperson', fullName: 'Replacement Employee', initialPassword: 'Synthetic-Password-2026!', managerUserId: 'replacement-rm' });
  assert.equal(created.status, 201);
  const { user } = await created.json(); assert.notEqual(user.id, 'history');
  assert.equal(db.prepare("SELECT user_id FROM visits WHERE id='delete-visit'").get().user_id, 'history');
  assert.equal(db.prepare("SELECT owner_user_id FROM tally_customers WHERE id='delete-customer'").get().owner_user_id, 'history');
  assert.equal(db.prepare("SELECT employee_code FROM salesperson_profiles WHERE user_id='history'").get().employee_code, 'history');
});
