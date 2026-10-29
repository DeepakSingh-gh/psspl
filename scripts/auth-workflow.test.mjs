import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../server/migrations.mjs';

let child, base, admin;
let output;
const initialPassword = 'Synthetic-Initial-2026!';
const newPassword = 'Synthetic-New-2026!';
const call = (path, token, method = 'GET', body) => fetch(`${base}/api${path}`, {
  method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const message = async (value) => {
  const pending = once(child, 'message', { signal: AbortSignal.timeout(10000) });
  child.send(value);
  return (await pending)[0];
};
const emails = async () => (await message({ type: 'get-test-emails' })).messages;
const state = async (userId) => (await message({ type: 'get-auth-state', userId })).state;
async function login(identifier, password = initialPassword, field = 'loginId') {
  const response = await call('/auth/login', null, 'POST', { [field]: identifier, password });
  assert.equal(response.status, 200);
  return response.json();
}
const create = (extra = {}) => call('/admin/users', admin, 'POST', {
  loginId: 'rep.new', email: 'new@example.test', role: 'salesperson', initialPassword,
  fullName: 'Synthetic Employee', managerUserId: 'rm', ...extra,
});
const resetToken = (mail) => decodeURIComponent(mail.text.match(/token=([^\s]+)/)[1]);

beforeEach(async () => {
  output = '';
  child = fork('scripts/phase8-fixture-server.mjs', process.env.CRM_TEST_SMTP === 'true' ? ['--smtp'] : [], { silent: true });
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const [ready] = await once(child, 'message', { signal: AbortSignal.timeout(15000) });
  base = ready.base;
  admin = (await login('admin@example.test', 'Uat-only-2026!', 'email')).token;
});
afterEach(async () => {
  if (child?.connected) {
    const exited = once(child, 'exit', { signal: AbortSignal.timeout(10000) });
    child.send({ type: 'stop' });
    assert.equal((await exited)[0], 0);
  }
  assert.ok(!output.includes(initialPassword) && !output.includes(newPassword), 'passwords never appear in server logs');
});

for (const role of ['rm', 'salesperson']) {
  test(`admin-created ${role} signs in immediately; password change verifies current password and revokes every session/link`, async () => {
    const created = await create({ role, managerUserId: role === 'salesperson' ? 'rm' : null });
    assert.equal(created.status, 201);
    const data = await created.json();
    const { user } = data;
    assert.equal(user.active, true);
    assert.equal(user.loginId, 'rep.new');
    assert.equal(data.invitation, undefined);
    assert.ok(!JSON.stringify(data).includes(initialPassword));
    assert.ok(!JSON.stringify(data).includes('password_hash'));
    assert.equal((await emails()).length, 0, 'creating an account never sends an email');
    const first = await login('REP.NEW');
    const second = await login(user.email, initialPassword, 'email');
    assert.equal((await call('/admin/users', first.token)).status, 403);
    assert.equal((await call('/auth/password', null, 'POST', {})).status, 401);
    const before = await state(user.id);
    assert.equal(before.hashLooksSecure, true);
    assert.equal(before.sessions, 2);

    assert.equal((await call('/auth/password-reset', null, 'POST', { email: user.email })).status, 202);
    const token = resetToken((await emails()).at(-1));
    const invalid = [
      { currentPassword: 'wrong', newPassword, confirmPassword: newPassword },
      { currentPassword: initialPassword, newPassword, confirmPassword: 'Different-Password-2026!' },
      { currentPassword: initialPassword, newPassword: 'short', confirmPassword: 'short' },
    ];
    for (const body of invalid) assert.equal((await call('/auth/password', first.token, 'POST', body)).status, 400);
    assert.equal((await state(user.id)).sessions, 2, 'failed changes do not revoke sessions');
    assert.equal((await call('/auth/password', first.token, 'POST', { currentPassword: initialPassword, newPassword, confirmPassword: newPassword, userId: 'admin', role: 'admin' })).status, 200);
    for (const session of [first, second]) assert.equal((await call('/auth/me', session.token)).status, 401);
    assert.equal((await call('/auth/password-reset/complete', null, 'POST', { token, password: 'Attacker-Password-2026!' })).status, 400);
    const after = await state(user.id);
    assert.equal(after.sessions, 0);
    assert.equal(after.tokens, 0);
    assert.equal(after.pendingEmails, 0);
    assert.equal(after.role, role);
    assert.equal(after.managerUserId, before.managerUserId);
    assert.equal(after.crm, before.crm);
    assert.equal((await call('/auth/login', null, 'POST', { loginId: user.loginId, password: initialPassword })).status, 401);
    assert.equal((await login(user.loginId, newPassword)).user.role, role);
    assert.equal((await call('/auth/me', admin)).status, 200, 'another account is unaffected');
    const audit = await (await call('/admin/audit', admin)).json();
    assert.ok(!JSON.stringify(audit).includes(initialPassword));
    assert.ok(JSON.stringify(audit).includes('[redacted]'));
  });
}

test('creation requires Login ID/password, enforces uniqueness and rejects employee administration', async () => {
  for (const extra of [{ loginId: undefined }, { initialPassword: undefined }, { initialPassword: 'short' }, { loginId: 'invalid@email.test' }, { managerUserId: 'rep' }]) {
    assert.equal((await create(extra)).status, 400);
  }
  assert.equal((await create()).status, 201);
  assert.equal((await create({ email: 'other-new@example.test', loginId: 'REP.NEW' })).status, 409);
  assert.equal((await create({ loginId: 'rep.different', email: 'NEW@example.test' })).status, 409);
  for (const role of ['rm', 'rep']) {
    const employee = await login(`${role}@example.test`, 'Uat-only-2026!', 'email');
    assert.equal((await call('/admin/users', employee.token, 'POST', {})).status, 403);
    assert.equal((await call('/admin/users/admin/password', employee.token, 'POST', { password: newPassword })).status, 403);
  }
  assert.equal((await emails()).length, 0);
});

test('the registered work email and Login ID resolve to the same employee with the same password', async () => {
  const { user } = await (await create({ email: 'Work.Email@Example.Test' })).json();
  const byId = await login('  REP.NEW  ');
  const byEmail = await login('  WORK.EMAIL@EXAMPLE.TEST  ', initialPassword, 'email');
  const oldClientEmail = await login('work.email@example.test', initialPassword, 'loginId');
  assert.equal(byId.user.id, user.id);
  assert.equal(byEmail.user.id, user.id);
  assert.equal(oldClientEmail.user.id, user.id);
  assert.equal((await call('/auth/login', null, 'POST', { email: 'different@example.test', password: initialPassword })).status, 401);
});

test('admin reset invalidates sessions and encrypted queued recovery jobs without changing assignments or emailing credentials', async () => {
  const { user } = await (await create()).json();
  const session = await login(user.loginId);
  const before = await state(user.id);
  await message({ type: 'hold-email' });
  try {
    assert.equal((await call('/auth/password-reset', null, 'POST', { email: user.email })).status, 202);
    const token = resetToken((await emails()).at(-1));
    const count = (await emails()).length;
    assert.equal((await call(`/admin/users/${user.id}/password`, admin, 'POST', { password: newPassword })).status, 200);
    assert.equal((await call('/auth/me', session.token)).status, 401);
    assert.equal((await call('/auth/password-reset/complete', null, 'POST', { token, password: initialPassword })).status, 400);
    const after = await state(user.id);
    assert.equal(after.tokens, 0);
    assert.equal(after.sessions, 0);
    assert.equal(after.pendingEmails, 0);
    assert.equal(after.managerUserId, before.managerUserId);
    assert.equal(after.crm, before.crm);
    assert.equal((await login(user.loginId, newPassword)).user.id, user.id);
    assert.equal((await emails()).length, count, 'admin reset sends no credentials');
  } finally { await message({ type: 'release-email' }); }
});

test('password recovery is private, expiring, single-use and invalidates all existing sessions', async () => {
  const { user } = await (await create()).json();
  const session = await login(user.loginId);
  const known = await call('/auth/password-reset', null, 'POST', { email: user.email });
  const unknown = await call('/auth/password-reset', null, 'POST', { email: 'missing@example.test' });
  assert.equal(known.status, 202);
  assert.deepEqual(await known.json(), await unknown.json());
  const mail = (await emails()).at(-1);
  assert.ok(!mail.text.includes(initialPassword) && !mail.html.includes(initialPassword));
  assert.match(mail.text, /15 minutes/);
  const token = resetToken(mail);
  await call('/auth/password-reset', null, 'POST', { email: user.email });
  assert.equal((await emails()).length, 1, 'cooldown prevents duplicate messages');
  const completed = await Promise.all([1, 2].map(() => call('/auth/password-reset/complete', null, 'POST', { token, password: newPassword })));
  assert.deepEqual(completed.map(response => response.status).sort(), [200, 400]);
  assert.equal((await call('/auth/me', session.token)).status, 401);
  assert.equal((await state(user.id)).tokens, 0);
  await login(user.loginId, newPassword);
  await call('/auth/password-reset', null, 'POST', { email: user.email });
  const expired = resetToken((await emails()).at(-1));
  await message({ type: 'expire-latest-auth-token', email: user.email, purpose: 'reset' });
  assert.equal((await call('/auth/password-reset/complete', null, 'POST', { token: expired, password: initialPassword })).status, 400);
});

test('concurrent current-password changes cannot overwrite each other and revoke the winning session', async () => {
  const { user } = await (await create()).json();
  const session = await login(user.loginId);
  const results = await Promise.all([1, 2].map(() => call('/auth/password', session.token, 'POST', { currentPassword: initialPassword, newPassword, confirmPassword: newPassword })));
  assert.deepEqual(results.map(response => response.status).sort(), [200, 401]);
  assert.equal((await state(user.id)).sessions, 0);
  await login(user.loginId, newPassword);
});

test('additive Login ID migration preserves existing accounts and pending invitations', () => {
  const database = new DatabaseSync(':memory:');
  try {
    runMigrations(database);
    database.exec("DROP INDEX idx_users_login_id; ALTER TABLE users DROP COLUMN login_id; DELETE FROM schema_migrations WHERE version='011'");
    database.prepare('INSERT INTO users(id,email,password_hash,role,active) VALUES(?,?,?,?,0)').run('legacy', 'legacy@example.test', 'existing-hash', 'rm');
    database.prepare('INSERT INTO auth_tokens(token_hash,user_id,purpose,expires_at) VALUES(?,?,?,?)').run('existing-token-hash', 'legacy', 'activate', '2030-01-01');
    const users = database.prepare('SELECT * FROM users').all().map(row => ({ ...row }));
    const tokens = database.prepare('SELECT * FROM auth_tokens').all();
    assert.deepEqual(runMigrations(database).map(item => item.version), ['011']);
    const after = database.prepare('SELECT * FROM users').all().map(({ login_id, ...row }) => { assert.equal(login_id, null); return row; });
    assert.deepEqual(after, users);
    assert.deepEqual(database.prepare('SELECT * FROM auth_tokens').all(), tokens);
    assert.deepEqual(runMigrations(database), []);
  } finally { database.close(); }
});


for (const onboardingRole of ['rm', 'salesperson']) {
test(`explicit ${onboardingRole} onboarding keeps initial password usable and includes a single-use 15-minute setup link`, async () => {
  const { user } = await (await create({ role: onboardingRole, managerUserId: onboardingRole === 'salesperson' ? 'rm' : null })).json();
  for (const role of ['rm', 'rep']) {
    const actor = await login(`${role}@example.test`, 'Uat-only-2026!', 'email');
    assert.equal((await call(`/admin/users/${user.id}/account-email`, actor.token, 'POST', { confirmSend: true })).status, 403);
    assert.equal((await call('/admin/email/test', actor.token, 'POST', { recipient: 'test@example.test', confirmSend: true })).status, 403);
    assert.equal((await call('/admin/email/status', actor.token)).status, 403);
  }
  assert.equal((await call(`/admin/users/${user.id}/account-email`, null, 'POST', { confirmSend: true })).status, 401);
  assert.equal((await call(`/admin/users/${user.id}/account-email`, admin, 'POST', {})).status, 400);
  assert.equal((await emails()).length, 0);
  const result = await (await call(`/admin/users/${user.id}/account-email`, admin, 'POST', { confirmSend: true })).json();
  assert.equal(result.email.deliveryStatus, 'accepted');
  assert.equal(result.email.sent, true);
  const mail = (await emails()).at(-1);
  assert.ok(mail.text.includes('Synthetic Employee'));
  assert.ok(mail.text.includes('rep.new'));
  assert.ok(mail.text.includes('http://crm.example.test'));
  assert.ok(mail.text.includes('15 minutes'));
  assert.ok(mail.text.includes('/reset-password#token='), 'new tokens stay out of HTTP request URLs');
  assert.ok(!mail.text.includes(initialPassword));
  const token = resetToken(mail);
  assert.ok(!JSON.stringify(result).includes(token));
  await login(user.loginId);
  const repeated = await (await call(`/admin/users/${user.id}/account-email`, admin, 'POST', { confirmSend: true })).json();
  assert.equal(repeated.email.reason, 'cooldown');
  assert.equal((await emails()).length, 1);
  assert.equal((await call('/auth/password-reset/complete', null, 'POST', { token, password: newPassword })).status, 200);
  assert.equal((await call('/auth/password-reset/complete', null, 'POST', { token, password: newPassword })).status, 400);
  await login(user.loginId, newPassword);
});

}

test('admin test email requires a recipient and explicit approval, contains no account data, and only reports acceptance', async () => {
  const status = await (await call('/admin/email/status', admin)).json();
  assert.equal(status.configured, true); assert.equal(status.connectionStatus, 'not_checked');
  assert.ok(!JSON.stringify(status).includes('synthetic-app-password'));
  for (const body of [{}, {recipient:'test@example.test'}, {recipient:'invalid',confirmSend:true}]) assert.equal((await call('/admin/email/test', admin, 'POST', body)).status, 400);
  assert.equal((await emails()).length, 0);
  const response = await (await call('/admin/email/test', admin, 'POST', {recipient:'test@example.test',confirmSend:true})).json();
  assert.equal(response.email.deliveryStatus, 'accepted');
  assert.equal(response.email.accepted, true);
  const mail = (await emails()).at(-1);
  assert.equal(mail.to, 'test@example.test');
  assert.ok(!mail.text.includes('token=') && !mail.text.includes(initialPassword));
});

test('admin can email a verified password and every saved employee field without exposing credentials in responses or audit logs', async () => {
  const profile={fullName:'Synthetic Employee',mobileNumber:'+919876543210',employeeCode:'SYN-014',region:'West',territory:'Test City',monthlyTarget:2.5};
  const {user}=await (await create(profile)).json();
  assert.equal((await call(`/admin/users/${user.id}/account-email`,admin,'POST',{confirmSend:true,initialPassword:'Wrong-Password-2026!'})).status,400);
  assert.equal((await emails()).length,0);
  const response=await call(`/admin/users/${user.id}/account-email`,admin,'POST',{confirmSend:true,initialPassword});
  assert.equal(response.status,200);
  const result=await response.json();assert.equal(result.email.passwordIncluded,true);assert.equal(result.email.sent,true);
  assert.ok(!JSON.stringify(result).includes(initialPassword));
  const mail=(await emails()).at(-1);
  for(const value of [...Object.values(profile),'rep.new','new@example.test',initialPassword,'UAT Manager','Salesperson']) assert.ok(mail.text.includes(String(value)));
  assert.ok(mail.html.includes('Employee details')&&mail.html.includes('Sign-in details'));
  const audit=await (await call('/admin/audit',admin)).json();
  assert.ok(!JSON.stringify(audit).includes(initialPassword));
  await login(user.loginId,initialPassword);
});
