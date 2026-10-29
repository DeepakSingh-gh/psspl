import test from 'node:test';
import assert from 'node:assert/strict';
import {accountDetailsTemplate} from '../server/account-email-template.mjs';

test('professional account email contains every input field, preserves password characters, and escapes HTML',()=>{
  const details={displayName:'Name <script> & Co',loginId:'00014',email:'person@example.test',initialPassword:'Synthetic<&>"\'Password!',mobileNumber:'+919876543210',role:'salesperson',managerName:'Manager <RM>',region:'West',territory:'Test City',employeeCode:'EMP-014',monthlyTarget:0,crmUrl:'',actionUrl:''};
  const mail=accountDetailsTemplate(details);
  for(const value of [details.displayName,details.loginId,details.email,details.initialPassword,details.mobileNumber,details.managerName,details.region,details.territory,details.employeeCode,'Monthly target (INR crore): 0']) assert.ok(mail.text.includes(value));
  assert.ok(mail.html.includes('&lt;script&gt;'));assert.ok(!mail.html.includes('<script>'));
  assert.ok(mail.html.includes('Synthetic&lt;&amp;&gt;&quot;&#39;Password!'));
  assert.ok(!mail.text.includes('localhost')&&!mail.text.includes('token='));
  assert.ok(!mail.html.includes('Confirm initial password'));
});

test('account email without supplied password does not pretend that credentials were retrieved',()=>{
  const mail=accountDetailsTemplate({displayName:'Employee',loginId:'rep',role:'rm',monthlyTarget:1,crmUrl:'https://crm.example.test',actionUrl:'https://crm.example.test/reset-password#token=synthetic',expiresIn:'15 minutes'});
  assert.ok(mail.text.includes('administrator will share the initial password separately'));
  assert.ok(mail.html.includes('15 minutes'));assert.ok(mail.text.includes('Not applicable'));
  assert.ok(!mail.text.includes('Initial password:'));
});
