// Synthetic-only full API fixture. No baseline, .env, client records or real providers.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
const originalCwd = process.cwd();
const scratch = mkdtempSync(join(tmpdir(), 'psspl-phase8-api-'));
process.chdir(scratch); // Multer's relative voice-note directory stays disposable too.
process.env.CRM_DATABASE_PATH = join(scratch, 'synthetic.sqlite');
process.env.CRM_DISABLE_BASELINE_RESTORE = 'true';
process.env.NODE_ENV = 'test';
process.env.HOST = '127.0.0.1';
process.env.WHATSAPP_DELIVERY_ENABLED = 'false';
for (const key of Object.keys(process.env)) if (/SMTP_|CRM_EMAIL_LOCAL_TEST_RECIPIENT|ANTHROPIC|CLAUDE|CRM_AI_PROVIDER|OPENAI|GEMINI|WHATSAPP.*TOKEN|SUPABASE|DIRECT_URL|DATABASE_URL|CRM_ADMIN|CRM_EMAIL|RESEND_API_KEY|EMAIL_FROM|APP_BASE_URL|RESEND_WEBHOOK_SECRET/i.test(key)) delete process.env[key];
process.env.OPENAI_API_KEY = 'sk-synthetic-uat-only';
process.env.CRM_EMAIL_PROVIDER = 'resend';
process.env.RESEND_API_KEY = 'synthetic-email-provider-key';
process.env.CRM_EMAIL_QUEUE_KEY = '5'.repeat(64);
process.env.CRM_EMAIL_FROM = 'PSSPL CRM <crm@example.test>';
process.env.CRM_PUBLIC_URL = 'http://crm.example.test';
process.env.RESEND_WEBHOOK_SECRET = 'whsec_dGVzdC13ZWJob29rLXNlY3JldA==';
const fixtureProvider = process.argv.includes('--smtp') ? 'smtp' : 'resend';
const testEmailMessages = [];
let holdEmail = false;
const pendingEmailResponses = [];
const guardedFetch = globalThis.fetch;
globalThis.fetch = (input, options) => String(input) === 'https://api.openai.com/v1/audio/transcriptions'
  ? Promise.resolve(Response.json({ text: 'Synthetic mocked transcription' }))
  : String(input) === 'https://api.resend.com/emails'
    ? (() => { const payload = JSON.parse(options.body); const id = `synthetic-email-${testEmailMessages.length + 1}`; testEmailMessages.push({ ...payload, __testEmailId: id }); return holdEmail ? new Promise(resolve => pendingEmailResponses.push(() => resolve(Response.json({ id })))) : Promise.resolve(Response.json({ id })); })()
  : guardedFetch(input, options);
if (fixtureProvider === 'smtp') {
  Object.assign(process.env, { CRM_EMAIL_PROVIDER: 'smtp', SMTP_HOST: 'smtp.gmail.com', SMTP_PORT: '465', SMTP_SECURE: 'true', SMTP_USER: 'synthetic@gmail.com', SMTP_PASS: 'synthetic-app-password', EMAIL_FROM: 'synthetic@gmail.com' });
  const { default: nodemailer } = await import('nodemailer');
  nodemailer.createTransport = () => ({ close() {}, async sendMail(payload) {
    const id = `synthetic-email-${testEmailMessages.length + 1}`;
    testEmailMessages.push({ ...payload, __testEmailId: id });
    if (holdEmail) await new Promise(resolve => pendingEmailResponses.push(resolve));
    return { accepted: [payload.to], messageId: id };
  }});
}
const probe = createServer();
await new Promise(r => probe.listen(0, '127.0.0.1', r));
process.env.PORT = String(probe.address().port);
await new Promise(r => probe.close(r));
const { db } = await import('../server/db.mjs');
const { passwordHash } = await import('../server/auth.mjs');
const { indiaBusinessDate } = await import('../server/field-activity.mjs');
const missingColumns = ['operating_city', 'reg_code_1', 'reg_code_2'].filter(name => !db.prepare('PRAGMA table_info(salesperson_profiles)').all().some(row => row.name === name));
// Initialization must now provide these columns; fixtures never repair the schema.
if (missingColumns.length) throw new Error(`Fresh initialization omitted profile columns: ${missingColumns.join(", ")}`);
const hash = passwordHash('Uat-only-2026!');
for (const [id, role, manager, name] of [['admin','admin',null,'UAT Admin'],['rm','rm',null,'UAT Manager'],['rep','salesperson','rm','UAT Rep'],['other','salesperson',null,'UAT Other']]) {
  db.prepare('INSERT INTO users(id,email,password_hash,role) VALUES(?,?,?,?)').run(id, `${id}@example.test`, hash, role);
  db.prepare('INSERT INTO salesperson_profiles(user_id,employee_code,full_name,region,territory,manager_user_id) VALUES(?,?,?,?,?,?)').run(id, `uat-${id}`, name, id === 'other' ? 'South' : 'North', 'Synthetic', manager);
}
const date = indiaBusinessDate();
db.prepare("INSERT INTO tally_customers(id,name,owner_user_id,rm_name,party_type) VALUES('customer','UAT Dealer','rep','UAT Manager','Distributor'),('private','Other Team Dealer','other','Other Manager','Distributor')").run();
const overflowCustomers = db.prepare("INSERT INTO tally_customers(id,name,owner_user_id,rm_name,party_type) VALUES(?,?, 'rep','UAT Manager','Distributor')");
for (let index = 1; index <= 105; index++) overflowCustomers.run(`customer-${index}`, `UAT Dealer ${index}`);
db.prepare("INSERT INTO tally_products(id,name) VALUES('product','UAT Product')").run();
db.prepare("INSERT INTO tally_invoices(id,company_name,voucher_type,invoice_date,customer_id,customer_name,amount,source_sync_id) VALUES('sale','Synthetic','Sales',?,'customer','UAT Dealer',1000,'uat'),('return','Synthetic','Credit Note',?,'customer','UAT Dealer',100,'uat'),('private-sale','Synthetic','Sales',?,'private','Other Team Dealer',5000,'uat')").run(date,date,date);
db.prepare("INSERT INTO tally_invoice_lines(id,invoice_id,product_id,product_name,quantity,rate,amount) VALUES('line-sale','sale','product','UAT Product',1,1000,1000),('line-return','return','product','UAT Product',1,100,100)").run();
process.on('message', message => {
  if (message?.type === 'create-archive-fixture') {
    db.prepare("INSERT INTO users(id,email,password_hash,role,active,deleted_at) VALUES('archive-browser','archive-browser@deleted.invalid','!deleted','salesperson',0,'2026-10-20T12:00:00Z'),('archive-empty','archive-empty@deleted.invalid','!deleted','rm',0,'2026-10-19T12:00:00Z')").run();
    db.prepare("INSERT INTO salesperson_profiles(user_id,employee_code,full_name,region,territory,manager_user_id) VALUES('archive-browser','ARCHIVE-001','Archived Browser Rep','North','Synthetic','rm'),('archive-empty','ARCHIVE-002','Archived Empty RM','North','Synthetic',NULL)").run();
    db.prepare("INSERT INTO tally_customers(id,name,owner_user_id) VALUES('archive-customer','Archived Test Customer','archive-browser')").run();
    const insertVisit = db.prepare("INSERT INTO visits(id,user_id,business_date,tally_customer_id,scheduled_at,purpose,notes) VALUES(?,'archive-browser','2026-10-20','archive-customer','2026-10-20T09:00','Archived test visit',?)");
    for (let index=0; index<27; index++) insertVisit.run(`archive-visit-${String(index).padStart(3,'0')}`, `Preserved notes ${index}`);
    db.exec("INSERT INTO leads(id,user_id,name,company) VALUES('archive-lead','archive-browser','Archived browser lead','Archive Company'); INSERT INTO follow_ups(id,user_id,tally_customer_id,title,due_date) VALUES('archive-follow','archive-browser','archive-customer','Archived follow-up','2026-10-20'); INSERT INTO attendance(id,user_id,business_date,check_in_at) VALUES('archive-attendance','archive-browser','2026-10-20','2026-10-20T09:00:00Z'); INSERT INTO customer_activities(id,user_id,lead_id,activity_type,subject) VALUES('archive-call','archive-browser','archive-lead','call','Archived customer call'); INSERT INTO service_requests(id,user_id,lead_id,request_type,details) VALUES('archive-request','archive-browser','archive-lead','sample','Archived sample request'); INSERT INTO expected_orders(id,visit_id,user_id,tally_customer_id,tally_product_id,expected_value) VALUES('archive-order','archive-visit-000','archive-browser','archive-customer','product',100); INSERT INTO generated_reports(id,user_id,report_type,date_from,date_to,payload_json) VALUES('archive-report','archive-browser','archive-test','2026-10-01','2026-10-20','{}')");
    process.send?.({ type: 'archive-fixture-created' });
  }
  if (message?.type === 'get-auth-state') {
    const user = db.prepare('SELECT id,active,role,login_id loginId,password_hash FROM users WHERE id=?').get(message.userId);
    process.send?.({ type: 'auth-state', state: user ? {
      active: Boolean(user.active), role: user.role, loginId: user.loginId,
      hashLooksSecure: /^[a-f0-9]{32}:[a-f0-9]{128}$/.test(user.password_hash),
      sessions: db.prepare('SELECT COUNT(*) n FROM sessions WHERE user_id=?').get(user.id).n,
      tokens: db.prepare('SELECT COUNT(*) n FROM auth_tokens WHERE user_id=?').get(user.id).n,
      pendingEmails: db.prepare("SELECT COUNT(*) n FROM auth_email_queue WHERE user_id=? AND (status IN ('queued','processing') OR encrypted_payload<>'')").get(user.id).n,
      managerUserId: db.prepare('SELECT manager_user_id FROM salesperson_profiles WHERE user_id=?').get(user.id)?.manager_user_id,
      crm: JSON.stringify({ customers: db.prepare('SELECT id,owner_user_id FROM tally_customers ORDER BY id').all(), visits: db.prepare('SELECT * FROM visits ORDER BY id').all(), followUps: db.prepare('SELECT * FROM follow_ups ORDER BY id').all() }),
    } : null });
  }
  if (message?.type === 'create-legacy-account') {
    // Model a pending account created by the old release, without production data.
    const input = message.account;
    const id = `legacy-${input.email}`;
    db.prepare('INSERT INTO users(id,email,password_hash,role,active) VALUES(?,?,?,?,0)').run(id, input.email, hash, input.role);
    db.prepare('INSERT INTO salesperson_profiles(user_id,employee_code,full_name,mobile_number,region,territory,manager_user_id) VALUES(?,?,?,?,?,?,?)')
      .run(id, id, input.fullName, input.mobileNumber || null, 'North', 'Synthetic', input.managerUserId || null);
    process.send?.({ type: 'legacy-account-created', id });
  }
  if (message?.type === 'get-test-emails') process.send?.({ type: 'test-emails', messages: testEmailMessages });
  if (message?.type === 'set-email-provider') { process.env.CRM_EMAIL_PROVIDER = message.enabled ? fixtureProvider : 'disabled'; process.send?.({ type: 'email-provider-set' }); }
  if (message?.type === 'hold-email') { holdEmail = true; process.send?.({ type: 'email-held' }); }
  if (message?.type === 'release-email') { holdEmail = false; pendingEmailResponses.splice(0).forEach(resolve => resolve()); process.send?.({ type: 'email-released' }); }
  if (message?.type === 'expire') {
    db.prepare("UPDATE sessions SET expires_at='2000-01-01T00:00:00.000Z' WHERE user_id=?").run(message.userId);
    process.send?.({ type: 'expired' });
  }
  if (message?.type === 'expire-latest-auth-token') {
    const result = db.prepare("UPDATE auth_tokens SET expires_at='2000-01-01T00:00:00.000Z' WHERE purpose=? AND user_id=(SELECT id FROM users WHERE email=?)").run(message.purpose, message.email);
    process.send?.({ type: 'auth-token-expired', updated: result.changes });
  }
  if (message?.type === 'stop') {
    db.close();
    process.chdir(originalCwd);
    rmSync(scratch, { recursive: true, force: true });
    process.exit(0);
  }
});
await import('../server/app.mjs');
for (let attempt = 0; ; attempt++) {
  try { if ((await fetch(`http://127.0.0.1:${process.env.PORT}/api/health`)).ok) break; } catch {}
  if (attempt >= 40) throw new Error('Synthetic API did not become ready');
  await new Promise(r => setTimeout(r, 50));
}
process.send?.({ type: 'ready', base: `http://127.0.0.1:${process.env.PORT}`, date, schemaShim: missingColumns });
console.log(`UAT_FIXTURE_READY ${JSON.stringify({ base: `http://127.0.0.1:${process.env.PORT}`, date, schemaShim: missingColumns })}`);
