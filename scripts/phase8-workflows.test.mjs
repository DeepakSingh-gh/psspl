import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fork, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createHmac } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
let child, base, date, visitId;
const tokens = {};
const call = (path, role, method='GET', body) => fetch(`${base}/api${path}`, { method, headers: { ...(tokens[role] ? { Authorization: `Bearer ${tokens[role]}` } : {}), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
const fixtureMessage = async (message) => { const pending = once(child, 'message'); child.send(message); return (await pending)[0]; };
const testEmails = async () => (await fixtureMessage({ type: 'get-test-emails' })).messages;
const expireLatestAuthToken = async (email, purpose) => fixtureMessage({ type: 'expire-latest-auth-token', email, purpose });
const createLegacyAccount = async (account) => {
  const { id } = await fixtureMessage({ type: 'create-legacy-account', account });
  const invitation = await (await call(`/admin/users/${encodeURIComponent(id)}/invitation`, 'admin', 'POST', {})).json();
  const { items } = await (await call('/admin/users', 'admin')).json();
  return { user: items.find(user => user.id === id), ...invitation };
};
before(async () => {
  child = fork('scripts/phase8-fixture-server.mjs', [], { silent: true });
  child.stderr.on('data', chunk => process.stderr.write(chunk));
  const [ready] = await once(child, 'message', { signal: AbortSignal.timeout(15000) });
  ({ base, date } = ready);
  assert.deepEqual(ready.schemaShim, []);
});
after(async () => { if (child?.connected) { child.send({ type: 'stop' }); const [code]=await once(child, 'exit'); assert.equal(code,0); } });

test('real login validates credentials for all roles; protected routes deny unauthenticated requests', async () => {
  assert.equal((await call('/auth/login', null, 'POST', { email: 'bad', password: '' })).status, 400);
  assert.equal((await call('/auth/login', null, 'POST', { email: 'admin@example.test', password: 'wrong' })).status, 401);
  assert.equal((await call('/admin/overview')).status, 401);
  for (const role of ['admin','rm','rep','other']) {
    const response = await call('/auth/login', null, 'POST', { email: `${role}@example.test`, password: 'Uat-only-2026!' });
    assert.equal(response.status, 200);
    const data = await response.json(); tokens[role] = data.token;
    assert.equal((await (await call('/auth/me', role)).json()).user.id, role);
  }
});

test('admin invitation, verified delivery events, activation, expiry, reset and session revocation work securely', async () => {
  const createdData = await createLegacyAccount({ email: 'new.rep@example.test', role: 'salesperson', fullName: 'New Test Rep', initialPassword: 'Admin-Temporary-Password-2026!', mobileNumber: '+91 98765 43210', managerUserId: 'rm', region: 'North', territory: 'Synthetic' });
  assert.equal(createdData.user.active, false);
  assert.equal(createdData.user.managerUserId, 'rm');
  assert.equal(createdData.user.mobileNumber, '+91 98765 43210');
  assert.equal(createdData.invitation.sent, true);
  assert.equal((await call('/admin/users', 'admin', 'POST', { email: 'NEW.REP@example.test', loginId: 'duplicate-rep', initialPassword: 'Synthetic-Initial-2026!', role: 'salesperson', fullName: 'Duplicate Test Rep', managerUserId: 'rm' })).status, 409);
  const invite = (await testEmails()).at(-1);
  assert.equal(invite.to, 'new.rep@example.test');
  assert.match(invite.html, /PSSPL CRM/);
  assert.match(invite.text, /48 hours/);
  assert.doesNotMatch(invite.text, /Admin-Temporary-Password-2026!/);
  let listed = await (await call('/admin/users', 'admin')).json();
  assert.equal(listed.items.find(user => user.email === 'new.rep@example.test').invitationEmailStatus, 'accepted');

  const webhookSecret = Buffer.from('test-webhook-secret');
  const eventAt = new Date(Date.now() + 1000).toISOString();
  const eventBody = JSON.stringify({ type: 'email.delivered', created_at: eventAt, data: { email_id: invite.__testEmailId } });
  const webhookId = 'evt-synthetic-delivered';
  const webhookTimestamp = String(Math.floor(Date.now() / 1000));
  const webhookSignature = createHmac('sha256', webhookSecret).update(`${webhookId}.${webhookTimestamp}.${eventBody}`).digest('base64');
  const webhookHeaders = { 'Content-Type': 'application/json', 'svix-id': webhookId, 'svix-timestamp': webhookTimestamp, 'svix-signature': `v1,${webhookSignature}` };
  assert.equal((await fetch(`${base}/api/webhooks/resend`, { method: 'POST', headers: { ...webhookHeaders, 'svix-signature': 'v1,invalid' }, body: eventBody })).status, 400);
  assert.equal((await fetch(`${base}/api/webhooks/resend`, { method: 'POST', headers: webhookHeaders, body: eventBody })).status, 200);
  const olderSentBody = JSON.stringify({ type: 'email.sent', created_at: new Date(Date.now() - 1000).toISOString(), data: { email_id: invite.__testEmailId } });
  const olderId = 'evt-synthetic-sent';
  const olderTimestamp = String(Math.floor(Date.now() / 1000));
  const olderSignature = createHmac('sha256', webhookSecret).update(`${olderId}.${olderTimestamp}.${olderSentBody}`).digest('base64');
  assert.equal((await fetch(`${base}/api/webhooks/resend`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'svix-id': olderId, 'svix-timestamp': olderTimestamp, 'svix-signature': `v1,${olderSignature}` }, body: olderSentBody })).status, 200);
  listed = await (await call('/admin/users', 'admin')).json();
  assert.equal(listed.items.find(user => user.email === 'new.rep@example.test').invitationEmailStatus, 'delivered');

  const activationToken = decodeURIComponent(invite.text.match(/token=([^\s]+)/)[1]);
  const activation = await call('/auth/activate', null, 'POST', { token: activationToken, password: 'New-Account-Password-2026!' });
  assert.equal(activation.status, 200);
  assert.equal((await call('/auth/activate', null, 'POST', { token: activationToken, password: 'Another-Password-2026!' })).status, 400);
  await createLegacyAccount({ email: 'expired.rm@example.test', role: 'rm', fullName: 'Expired Test RM' });
  const expiredInvitation = (await testEmails()).at(-1);
  assert.equal((await expireLatestAuthToken('expired.rm@example.test', 'activate')).updated, 1);
  const expiredActivationToken = decodeURIComponent(expiredInvitation.text.match(/token=([^\s]+)/)[1]);
  assert.equal((await call('/auth/activate', null, 'POST', { token: expiredActivationToken, password: 'Expired-Invitation-Password-2026!' })).status, 400);

  const login = await call('/auth/login', null, 'POST', { email: 'new.rep@example.test', password: 'New-Account-Password-2026!' });
  assert.equal(login.status, 200);
  const session = await login.json();
  tokens.recovery = session.token;
  await fixtureMessage({ type: 'hold-email' });
  let known, unknown;
  try {
    known = await fetch(`${base}/api/auth/password-reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'new.rep@example.test' }), signal: AbortSignal.timeout(1500) });
    unknown = await call('/auth/password-reset', null, 'POST', { email: 'not-a-user@example.test' });
  } finally {
    await fixtureMessage({ type: 'release-email' });
  }
  assert.equal(known.status, 202); assert.equal(unknown.status, 202);
  assert.deepEqual(await known.json(), await unknown.json());
  const emailCount = (await testEmails()).length;
  assert.equal((await call('/auth/password-reset', null, 'POST', { email: 'new.rep@example.test' })).status, 202);
  assert.equal((await testEmails()).length, emailCount, 'the cooldown prevents duplicate reset emails');
  const resetEmail = (await testEmails()).at(-1);
  assert.match(resetEmail.text, /15 minutes/);
  const resetToken = decodeURIComponent(resetEmail.text.match(/token=([^\s]+)/)[1]);
  assert.equal((await call('/auth/password-reset/complete', null, 'POST', { token: resetToken, password: 'Reset-Password-Safely-2026!' })).status, 200);
  assert.equal((await call('/auth/me', 'recovery')).status, 401);
  assert.equal((await call('/auth/password-reset/complete', null, 'POST', { token: resetToken, password: 'Replay-Password-Safely-2026!' })).status, 400);
  assert.equal((await call('/auth/login', null, 'POST', { email: 'new.rep@example.test', password: 'Reset-Password-Safely-2026!' })).status, 200);

  await call('/auth/password-reset', null, 'POST', { email: 'new.rep@example.test' });
  assert.equal((await expireLatestAuthToken('new.rep@example.test', 'reset')).updated, 1);
  const expiredResetEmail = (await testEmails()).at(-1);
  const expiredResetToken = decodeURIComponent(expiredResetEmail.text.match(/token=([^\s]+)/)[1]);
  assert.equal((await call('/auth/password-reset/complete', null, 'POST', { token: expiredResetToken, password: 'Expired-Reset-Password-2026!' })).status, 400);
  assert.equal((await call('/auth/password-reset/complete', null, 'POST', { token: randomBytes(32).toString('base64url'), password: 'Invalid-Reset-Password-2026!' })).status, 400);
});

test('admin can invite an inactive account created before email was configured', async () => {
  await fixtureMessage({ type: 'set-email-provider', enabled: false });
  try {
    const data = await createLegacyAccount({ email: 'later.invite@example.test', role: 'salesperson', fullName: 'Later Invite', managerUserId: 'rm' });
    assert.equal(data.user.active, false);
    assert.equal(data.user.invitationPending, false);
    assert.equal(data.invitation.deliveryStatus, 'not_configured');
    assert.equal((await call(`/admin/users/${data.user.id}/invitation`, 'rm', 'POST', {})).status, 403);
    await fixtureMessage({ type: 'set-email-provider', enabled: true });
    const resent = await call(`/admin/users/${data.user.id}/invitation`, 'admin', 'POST', {});
    assert.equal(resent.status, 200);
    assert.equal((await resent.json()).invitation.sent, true);
    assert.equal((await testEmails()).at(-1).to, 'later.invite@example.test');
  } finally {
    await fixtureMessage({ type: 'set-email-provider', enabled: true });
  }
});

test('legacy invited RM activates with their own password and old links cannot override admin account changes', async () => {
  const { user, invitation } = await createLegacyAccount({ email: 'new.manager@example.test', role: 'rm', fullName: 'New Test Manager' });
  assert.equal(user.active, false);
  assert.equal(user.role, 'rm');
  assert.equal(invitation.sent, true);
  const invite = (await testEmails()).at(-1);
  const activationToken = decodeURIComponent(invite.text.match(/token=([^\s]+)/)[1]);
  assert.equal((await call('/auth/activate', null, 'POST', { token: activationToken, password: 'Manager-Own-Password-2026!' })).status, 200);
  const login = await call('/auth/login', null, 'POST', { email: user.email, password: 'Manager-Own-Password-2026!' });
  assert.equal(login.status, 200);
  tokens.newManager = (await login.json()).token;
  assert.equal((await call('/rm/dashboard', 'newManager')).status, 200);
  assert.equal((await call('/admin/users', 'newManager')).status, 403);

  assert.equal((await call('/auth/password-reset', null, 'POST', { email: user.email })).status, 202);
  const resetEmail = (await testEmails()).at(-1);
  const resetToken = decodeURIComponent(resetEmail.text.match(/token=([^\s]+)/)[1]);
  assert.equal((await call(`/admin/users/${user.id}/password`, 'admin', 'POST', { password: 'Admin-New-Manager-Password-2026!' })).status, 200);
  assert.equal((await call('/auth/password-reset/complete', null, 'POST', { token: resetToken, password: 'Stale-Reset-Password-2026!' })).status, 400);
  assert.equal((await call('/auth/login', null, 'POST', { email: user.email, password: 'Admin-New-Manager-Password-2026!' })).status, 200);

  const { user: pendingUser } = await createLegacyAccount({ email: 'manual.manager@example.test', role: 'rm', fullName: 'Manual Test Manager' });
  const pendingInvite = (await testEmails()).at(-1);
  const pendingToken = decodeURIComponent(pendingInvite.text.match(/token=([^\s]+)/)[1]);
  assert.equal((await call(`/admin/users/${pendingUser.id}`, 'admin', 'PATCH', { active: true })).status, 200);
  assert.equal((await call('/auth/activate', null, 'POST', { token: pendingToken, password: 'Stale-Activation-Password-2026!' })).status, 400);
  const users = await (await call('/admin/users', 'admin')).json();
  assert.equal(users.items.find(item => item.id === pendingUser.id).active, true);
});

test('sales day persists attendance, visit transitions, order, follow-up, call and checkout across real app routes', async () => {
  assert.equal((await call('/salespeople/me/check-in','rep','POST',{latitude:91,longitude:77})).status,400);
  assert.equal((await call('/salespeople/me/check-in','rep','POST',{latitude:28.6,longitude:77.2,accuracy:12})).status,200);
  assert.equal((await call('/salespeople/me/check-in','rep','POST',{})).status,409);
  assert.equal((await call('/sales/visits/unplanned','rep','POST',{customerId:'private',purpose:'Denied'})).status,403);
  const response = await call('/sales/visits/unplanned','rep','POST',{customerId:'customer',purpose:'UAT visit'});
  assert.equal(response.status,201); const {id} = await response.json();
  visitId=id;
  const payload = {productId:'product',outcome:'Quotation requested',expectedOrderValue:2500,expectedOrderDate:date,nextFollowUp:date,notes:'Synthetic UAT'};
  assert.equal((await call(`/visits/${id}/complete`,'rep','POST',payload)).status,409);
  assert.equal((await call(`/visits/${id}/start`,'other','POST',{})).status,409);
  assert.equal((await call(`/visits/${id}/start`,'rep','POST',{})).status,200);
  assert.equal((await call(`/visits/${id}/complete`,'rep','POST',{...payload,nextFollowUp:'2026-02-30'})).status,400);
  assert.equal((await call(`/visits/${id}/complete`,'rep','POST',payload)).status,200);
  assert.equal((await call(`/visits/${id}/complete`,'rep','POST',payload)).status,409);
  assert.equal((await call('/sales/calls','rep','POST',{customerId:'customer',direction:'outgoing',purpose:'Quote',outcome:'Discussed',followUpDate:date})).status,201);
  const day = await (await call('/salespeople/me/my-day','rep')).json();
  assert.equal(day.summary.completedVisits,1);
  assert.equal(day.summary.loggedCalls,1);
  assert.equal(day.summary.expectedOrderValueToday,2500);
  assert.equal(day.visits.find(v=>v.id===id).status,'completed');
  assert.ok(day.followUps.length>=2);
  const follow = day.followUps[0].id;
  assert.equal((await call(`/follow-ups/${follow}/toggle`,'other','PATCH',{})).status,404);
  assert.equal((await call(`/follow-ups/${follow}/toggle`,'rep','PATCH',{})).status,200);
  assert.equal((await call('/sales/attendance/check-out','rep','POST',{})).status,200);
  assert.equal((await call('/sales/attendance/check-out','rep','POST',{})).status,409);
});

test('synthetic audio upload/download is protected and authenticated STT uses a mocked provider', async () => {
  const form=()=>{const value=new FormData();value.append('audio',new Blob(['synthetic UAT audio bytes'],{type:'audio/webm'}),'uat.webm');return value;};
  assert.equal((await fetch(`${base}/api/stt`,{method:'POST',body:form()})).status,401);
  const transcript=await fetch(`${base}/api/stt`,{method:'POST',headers:{Authorization:`Bearer ${tokens.rep}`},body:form()});
  assert.equal(transcript.status,200); assert.equal((await transcript.json()).text,'Synthetic mocked transcription');
  const upload=await fetch(`${base}/api/sales/visits/${visitId}/voice-note`,{method:'POST',headers:{Authorization:`Bearer ${tokens.rep}`},body:form()});
  assert.equal(upload.status,201);
  assert.equal((await call(`/sales/visits/${visitId}/voice-note`,'other')).status,404);
  const download=await call(`/sales/visits/${visitId}/voice-note`,'rm');
  assert.equal(download.status,200); assert.equal(await download.text(),'synthetic UAT audio bytes');
  assert.match(download.headers.get('cache-control'),/no-store/);
});

test('manager team visibility and lead progression persist; admin reports reconcile net synthetic sales', async () => {
  assert.equal((await call('/admin/overview','rm')).status,403);
  assert.equal((await call('/sales/customers/private','rm')).status,403);
  assert.equal((await call('/sales/customers/customer','rm')).status,200);
  const customerList = await (await call('/sales/customers','rep')).json();
  assert.equal(customerList.length,106,'customer selection includes all matching records beyond the former 100-row cap');
  assert.equal((await (await call('/sales/customers?q=Dealer 105','rep')).json()).length,1);
  const created = await call('/sales/leads','rep','POST',{name:'UAT Lead',expectedValue:2500,nextActionDate:date});
  assert.equal(created.status,201); const {id}=await created.json();
  assert.equal((await call(`/sales/leads/${id}/stage`,'other','PATCH',{stage:'won'})).status,404);
  for(const stage of ['technical_discussion','sample','quotation','follow_up','expected_order','won']) assert.equal((await call(`/sales/leads/${id}/stage`,'rm','PATCH',{stage})).status,200);
  const detail = await (await call(`/sales/leads/${id}`,'rm')).json();
  assert.equal(detail.lead.stage,'won');
  assert.equal(detail.history.length,6);
  const conversion=await (await call('/sales/leads/report/conversion','rm')).json(); assert.equal(conversion.won,1);
  const report=await call(`/admin/reports/sales?from=${date}&to=${date}&customerId=customer`,'admin');
  assert.equal(report.status,200); const data=await report.json();
  assert.equal(data.summary.totalSales,900); assert.equal(data.summary.invoiceCount,2);
  assert.equal(data.byProduct.reduce((sum,p)=>sum+p.salesValue,0),900);
});

test('logout revokes the actual session and expired sessions deny further access', async () => {
  assert.equal((await call('/auth/logout','rep','POST',{})).status,200);
  assert.equal((await call('/auth/me','rep')).status,401);
  child.send({type:'expire',userId:'rm'}); await once(child,'message');
  assert.equal((await call('/auth/me','rm')).status,401);
});

test('fresh database login and My Day succeed without any schema compatibility shim', async () => {
  const fresh = fork('scripts/phase8-fixture-server.mjs', [], { silent: true });
  try {
    const [ready] = await once(fresh, 'message', { signal: AbortSignal.timeout(15000) });
    assert.deepEqual(ready.schemaShim, []);
    const login = await fetch(ready.base+'/api/auth/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'rep@example.test',password:'Uat-only-2026!'})});
    assert.equal(login.status,200); const {token}=await login.json();
    const day=await fetch(ready.base+'/api/salespeople/me/my-day',{headers:{Authorization:'Bearer '+token}});
    assert.equal(day.status,200); const data=await day.json();assert.equal(data.salesperson.id,'rep');assert.equal(data.summary.completedVisits,0);
  } finally {if(fresh.connected){fresh.send({type:'stop'});const [code]=await once(fresh,'exit');assert.equal(code,0);}}
});

test('encrypted synthetic backup refuses a wrong restore key', () => {
  const scratch=mkdtempSync(join(tmpdir(),'psspl-phase8-backup-'));
  try {
    const source=join(scratch,'source.sqlite'), directory=join(scratch,'backups');
    const db=new DatabaseSync(source); db.exec("CREATE TABLE marker(value TEXT); INSERT INTO marker VALUES('synthetic only');"); db.close();
    const env={...process.env,CRM_DATABASE_PATH:source,CRM_BACKUP_DIR:directory,CRM_BACKUP_ENCRYPTION_KEY:randomBytes(32).toString('hex')};
    const backup=spawnSync(process.execPath,['scripts/backup-sqlite.mjs','backup'],{env,encoding:'utf8'}); assert.equal(backup.status,0,backup.stderr);
    const file=join(directory,readdirSync(directory).find(name=>name.endsWith('.sqlite.enc')));
    const restore=spawnSync(process.execPath,['scripts/backup-sqlite.mjs','restore',file,join(scratch,'wrong-key.sqlite')],{env:{...env,CRM_BACKUP_ENCRYPTION_KEY:randomBytes(32).toString('hex')},encoding:'utf8'});
    assert.notEqual(restore.status,0); assert.match(restore.stderr,/authenticate|Unsupported state/);
  } finally {rmSync(scratch,{recursive:true,force:true});}
});

test('India-time report preset retains the intended calendar day', async () => {
 const {reportDateRange}=await import('../shared/business-date.mjs');
 assert.deepEqual(reportDateRange('month',new Date('2026-09-30T18:30:00Z')),{from:'2026-10-01',to:'2026-10-01'});
});
