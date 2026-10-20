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
for (const key of Object.keys(process.env)) if (/OPENAI|GEMINI|WHATSAPP.*TOKEN|SUPABASE|DIRECT_URL|DATABASE_URL|CRM_ADMIN|CRM_EMAIL|RESEND_API_KEY|EMAIL_FROM|APP_BASE_URL|RESEND_WEBHOOK_SECRET/i.test(key)) delete process.env[key];
process.env.OPENAI_API_KEY = 'sk-synthetic-uat-only';
process.env.CRM_EMAIL_PROVIDER = 'resend';
process.env.RESEND_API_KEY = 'synthetic-email-provider-key';
process.env.CRM_EMAIL_QUEUE_KEY = '5'.repeat(64);
process.env.CRM_EMAIL_FROM = 'PSSPL CRM <crm@example.test>';
process.env.CRM_PUBLIC_URL = 'http://crm.example.test';
process.env.RESEND_WEBHOOK_SECRET = 'whsec_dGVzdC13ZWJob29rLXNlY3JldA==';
const testEmailMessages = [];
let holdEmail = false;
const pendingEmailResponses = [];
const guardedFetch = globalThis.fetch;
globalThis.fetch = (input, options) => String(input) === 'https://api.openai.com/v1/audio/transcriptions'
  ? Promise.resolve(Response.json({ text: 'Synthetic mocked transcription' }))
  : String(input) === 'https://api.resend.com/emails'
    ? (() => { const payload = JSON.parse(options.body); const id = `synthetic-email-${testEmailMessages.length + 1}`; testEmailMessages.push({ ...payload, __testEmailId: id }); return holdEmail ? new Promise(resolve => pendingEmailResponses.push(() => resolve(Response.json({ id })))) : Promise.resolve(Response.json({ id })); })()
  : guardedFetch(input, options);
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
  if (message?.type === 'get-test-emails') process.send?.({ type: 'test-emails', messages: testEmailMessages });
  if (message?.type === 'set-email-provider') { process.env.CRM_EMAIL_PROVIDER = message.enabled ? 'resend' : 'disabled'; process.send?.({ type: 'email-provider-set' }); }
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
