import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { emailProviderStatus, sendTransactionalEmail } from '../server/email-provider.mjs';
import { emailAppUrl, emailLinkAllowed } from '../server/email-link-policy.mjs';
import { smtpFailure } from '../server/smtp-email.mjs';

const originalEnv = { ...process.env };
const originalCreateTransport = nodemailer.createTransport;
test.after(() => { process.env = originalEnv; nodemailer.createTransport = originalCreateTransport; });
const setup = () => Object.assign(process.env, { NODE_ENV: 'test', CRM_EMAIL_PROVIDER: 'smtp', SMTP_HOST: 'smtp.gmail.com', SMTP_PORT: '465', SMTP_SECURE: 'true', SMTP_USER: 'sender@gmail.com', SMTP_PASS: 'synthetic-app-secret', EMAIL_FROM: 'sender@gmail.com', APP_BASE_URL: 'http://localhost:3000', CRM_EMAIL_LOCAL_TEST_RECIPIENT: '' });

test('SMTP validates configuration without network traffic and enforces the authenticated sender', async () => {
  setup();
  nodemailer.createTransport = () => { throw new Error('Configuration must not connect'); };
  assert.deepEqual(emailProviderStatus(), {configured:true,provider:'smtp'});
  for (const [key, value] of [['SMTP_PASS',''],['SMTP_PORT','invalid'],['SMTP_PORT','587'],['SMTP_SECURE','false'],['EMAIL_FROM','someone-else@gmail.com']]) {
    setup(); process.env[key]=value;
    assert.equal(emailProviderStatus().configured,false);
    assert.equal((await sendTransactionalEmail({to:'test@example.test'})).status,'not_configured');
  }
});

test('SMTP sends with TLS, disabled debug logging and a stable message ID; acceptance is never delivery', async () => {
  setup(); let capturedOptions, mail, closed=false;
  nodemailer.createTransport = options => { capturedOptions=options; return {sendMail:async message => { mail=message; return {accepted:[message.to],messageId:message.messageId}; },close(){closed=true;}}; };
  const result=await sendTransactionalEmail({to:'test@example.test',subject:'Test',text:'Synthetic content',html:'<p>Synthetic content</p>',idempotencyKey:'stable-synthetic-key'});
  assert.equal(result.status,'accepted'); assert.equal(result.accepted,true); assert.match(result.emailId,/^smtp:/);
  assert.equal(capturedOptions.secure,true); assert.equal(capturedOptions.port,465); assert.equal(capturedOptions.logger,false); assert.equal(capturedOptions.debug,false);
  assert.equal(capturedOptions.auth.pass,'synthetic-app-secret'); assert.equal(capturedOptions.disableFileAccess,true); assert.equal(capturedOptions.disableUrlAccess,true);
  assert.equal(mail.from,'sender@gmail.com'); assert.ok(closed);
});

test('SMTP errors are classified safely and only definitely rejected or pre-submit failures can retry', async () => {
  setup(); const logs=[]; const originalWarn=console.warn;
  console.warn=(...args)=>logs.push(args.join(' '));
  try {
    for (const [error,status,retryable] of [
      [{code:'EAUTH',responseCode:535},'failed',false],
      [{code:'EENVELOPE',responseCode:550},'failed',false],
      [{code:'EMESSAGE',responseCode:451},'failed',true],
      [{code:'ECONNECTION',command:'CONN'},'failed',true],
      [{code:'ETIMEDOUT',command:'DATA'},'unknown',false],
      [{code:'ESOCKET',command:'DATA'},'unknown',false],
    ]) {
      nodemailer.createTransport=()=>({sendMail:async()=>{throw {...error,message:'synthetic-app-secret token=synthetic-private-token',response:'private SMTP server reply'};},close(){}});
      const result=await sendTransactionalEmail({to:'test@example.test',subject:'test',text:'synthetic-private-token'});
      assert.equal(result.status,status); assert.equal(result.retryable,retryable);
    }
    assert.ok(!logs.join('\n').includes('synthetic-app-secret'));
    assert.ok(!logs.join('\n').includes('synthetic-private-token'));
    assert.ok(!logs.join('\n').includes('private SMTP server reply'));
    assert.equal(smtpFailure({code:'unexpected'}).status,'unknown');
  } finally {console.warn=originalWarn;}
});

test('localhost links are restricted to a single local tester; production requires HTTPS and rejects loopback', () => {
  setup();
  assert.equal(emailLinkAllowed('employee@example.test'),false);
  assert.equal(emailLinkAllowed('sender@gmail.com'),true);
  process.env.CRM_EMAIL_LOCAL_TEST_RECIPIENT='tester@example.test';
  assert.equal(emailLinkAllowed('tester@example.test'),true);
  assert.equal(emailLinkAllowed('sender@gmail.com'),false);
  for (const url of ['http://127.0.0.1:3000','http://[::1]:3000','http://local.localhost:3000','http://0.0.0.0:3000']) assert.equal(emailLinkAllowed('employee@example.test',url),false);
  process.env.NODE_ENV='production';
  assert.equal(emailAppUrl(),'');
  assert.equal(emailLinkAllowed('tester@example.test','https://localhost:3000'),false);
  process.env.APP_BASE_URL='https://crm.example.test';
  assert.equal(emailLinkAllowed('employee@example.test'),true);
  process.env.APP_BASE_URL='https://user:secret@crm.example.test';
  assert.equal(emailAppUrl(),'');
});
