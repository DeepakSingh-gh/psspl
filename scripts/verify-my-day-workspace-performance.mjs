import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {db} from '../server/db.mjs';
import {createSession} from '../server/auth.mjs';
import {chromium} from '@playwright/test';
const browser=await chromium.launch();
try {
 for(const email of ['rais.khan@psspl.com','anil.jena@psspl.com']) {
 const user=db.prepare('SELECT id FROM users WHERE email=? AND active=1').get(email);
 const {token}=createSession(user.id);
 const context=await browser.newContext();
 try {
 const headers={Authorization:`Bearer ${token}`};
 const start=performance.now();
 const full=await (await fetch('http://localhost:4000/api/salespeople/me/my-day',{headers})).json();
 const fullMs=Math.round(performance.now()-start);
 const next=performance.now();
 const slim=await (await fetch('http://localhost:4000/api/salespeople/me/my-day?view=workspace',{headers})).json();
 const slimMs=Math.round(performance.now()-next);
 assert.equal(slim.insights,undefined);
 const fullBytes=JSON.stringify(full).length;
 const {insights,...rest}=structuredClone(full);
 rest.referenceData.products=rest.referenceData.products.map(({id,name})=>({id,name}));
 assert.deepEqual(slim,rest);
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(t=>localStorage.setItem('psspl_crm_session',t),token);
 const opened=performance.now();
 await page.goto('http://localhost:3000/sales/my-day');
 await page.getByRole('heading',{name:'My Day',exact:true}).waitFor();
 await page.getByRole('heading',{name:email.startsWith('rais')?'Rais Khan':'Anil Jena',exact:true}).waitFor();
 console.log(JSON.stringify({email,fullMs,slimMs,fullBytes,slimBytes:JSON.stringify(slim).length,browserMs:Math.round(performance.now()-opened),products:slim.referenceData.products.length}));
 assert.deepEqual(errors,[]);
 }finally{await context.close();db.prepare('DELETE FROM sessions WHERE token_hash=?').run(createHash('sha256').update(token).digest('hex'));}
 }
}finally{await browser.close();}
