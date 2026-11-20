import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import cors from 'cors';

const root = mkdtempSync(join(tmpdir(), 'psspl-pipeline-sync-'));
Object.assign(process.env, { NODE_ENV: 'test', CRM_DATABASE_PATH: join(root, 'test.sqlite'), CRM_TEST_DATABASE_ROOT: root, CRM_DISABLE_BASELINE_RESTORE: 'true' });
let db, transaction, server, base, tokens, revision, summary;
const call = (path, owner, method = 'GET', body) => fetch(base + path, { method, headers: { Authorization: `Bearer ${tokens[owner]}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
before(async () => {
  ({ db, transaction } = await import('../server/db.mjs'));
  const sync = await import('../server/pipeline-sync.mjs');
  revision = sync.pipelineRevision; summary = sync.pipelineSummary;
  const { createSession, authenticate } = await import('../server/auth.mjs');
  for (const [id, role, manager] of [['admin','admin',null],['a','rm',null],['b','rm',null],['rep','salesperson','a']]) {
    db.prepare('INSERT INTO users(id,email,password_hash,role) VALUES(?,?,?,?)').run(id, id+'@test.invalid', 'test-hash', role);
    db.prepare("INSERT INTO salesperson_profiles(user_id,employee_code,full_name,manager_user_id,region,territory) VALUES(?,?,?,?,'Test','Test')").run(id,id,id,manager);
  }
  tokens = Object.fromEntries(['admin','a','b','rep'].map(id => [id,createSession(id).token]));
  const { salesRouter } = await import('../server/sales-routes.mjs');
  const app = express(); app.use(cors({origin:true,credentials:true})); app.use(express.json()); app.use('/pipeline', sync.pipelineRouter); app.use('/sales', salesRouter);
  app.use('/api/pipeline',sync.pipelineRouter);app.use('/api/sales',salesRouter);
  app.get('/api/auth/me',authenticate,(req,res)=>res.json({user:req.user}));
  const {adminRouter}=await import('../server/admin.mjs'); const {rmRouter}=await import('../server/rm-routes.mjs');
  app.use('/api/admin',adminRouter);app.use('/api/rm',rmRouter);
  server = app.listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server?.closeAllConnections(); server?.close(); db?.close(); rmSync(root,{recursive:true,force:true}); });
const user = id => db.prepare('SELECT id,role FROM users WHERE id=?').get(id);
test('committed changes invalidate only authorized scopes; rolled back changes never publish', () => {
  const a = revision(db,user('a')), b = revision(db,user('b'));
  db.prepare("INSERT INTO leads(id,user_id,name,stage,expected_value) VALUES('one','rep','Opportunity','sample',12500)").run();
  assert.notEqual(revision(db,user('a')),a); assert.equal(revision(db,user('b')),b);
  const saved = revision(db,user('a'));
  assert.throws(()=>transaction(()=>{db.exec("UPDATE leads SET stage='quotation' WHERE id='one'");throw Error('rollback');}));
  assert.equal(revision(db,user('a')),saved); assert.equal(summary(db,user('a')).stages[0].stage,'sample');
});
test('SSE signals a saved RM stage change, totals remain exact, invalid writes do not invalidate', async () => {
  assert.equal((await fetch(base+'/pipeline/events')).status,401);
  const controller = new AbortController();
  const stream = await fetch(base+'/pipeline/events',{headers:{Authorization:`Bearer ${tokens.admin}`},signal:controller.signal});
  assert.match(stream.headers.get('content-type'),/text\/event-stream/);
  const reader = stream.body.getReader(); await reader.read();
  const before = revision(db,user('admin'));
  assert.equal((await call('/sales/leads/one/stage','b','PATCH',{stage:'quotation'})).status,404);
  assert.equal(revision(db,user('admin')),before);
  assert.equal((await call('/sales/leads/one/stage','a','PATCH',{stage:'quotation'})).status,200);
  const next = await Promise.race([reader.read(),new Promise((_,reject)=>setTimeout(()=>reject(Error('SSE update timed out')),3000).unref())]);
  assert.match(new TextDecoder().decode(next.value),/event: pipeline/);
  const data = await (await call('/pipeline/summary','admin')).json();
  assert.equal(data.total,1); assert.equal(data.stages.find(x=>x.stage==='quotation').count,1);
  assert.equal(data.stages.find(x=>x.stage==='quotation').expectedValue,12500);
  assert.equal(data.recent[0].stage,'quotation');
  assert.equal((await call('/sales/leads/one/stage','rep','PATCH',{stage:'won'})).status,200,'authorized salesperson can update their own lead');
  const salespersonFrame=await Promise.race([reader.read(),new Promise((_,reject)=>setTimeout(()=>reject(Error('salesperson SSE timeout')),3000).unref())]);
  assert.match(new TextDecoder().decode(salespersonFrame.value),/event: pipeline/);
  assert.equal(summary(db,user('admin')).stages.find(row=>row.stage==='won').expectedValue,12500);
  controller.abort();
});
test('assignment invalidates both teams and removes old scope data; deletion stays exact', async () => {
  const a = revision(db,user('a')), b = revision(db,user('b'));
  assert.equal((await call('/sales/leads/one/assignment','admin','PATCH',{userId:'b'})).status,200);
  assert.notEqual(revision(db,user('a')),a); assert.notEqual(revision(db,user('b')),b);
  assert.equal(summary(db,user('a')).total,0); assert.equal(summary(db,user('b')).total,1);
  assert.equal((await call('/sales/leads/one','b','DELETE')).status,200);
  assert.equal(summary(db,user('admin')).total,0);
});
test('owner display-name removal invalidates pipeline and dashboard scope excludes inactive reports',()=>{
  db.prepare("INSERT INTO leads(id,user_id,name,expected_value) VALUES('inactive-lead','rep','Retained historical lead',1)").run();
  db.exec("UPDATE users SET active=0 WHERE id='rep'");
  assert.equal(summary(db,user('a'),{teamDashboard:true}).total,0);
  assert.equal(summary(db,user('a')).total,1,'LeadBoard retains its existing broader REST scope');
  const before=revision(db,user('admin'));
  db.exec("DELETE FROM salesperson_profiles WHERE user_id='rep'");
  assert.notEqual(revision(db,user('admin')),before);
  db.exec("DELETE FROM leads WHERE id='inactive-lead'; UPDATE users SET active=1 WHERE id='rep'");
});
test('concurrent updates converge, reconnect starts at latest revision and revoked streams close',async()=>{
  db.prepare("INSERT INTO leads(id,user_id,name,expected_value) VALUES('parallel-1','a','Concurrent one',100),('parallel-2','b','Concurrent two',200)").run();
  const results=await Promise.all([call('/sales/leads/parallel-1/stage','a','PATCH',{stage:'sample'}),call('/sales/leads/parallel-2/stage','b','PATCH',{stage:'quotation'})]);
  assert.deepEqual(results.map(r=>r.status),[200,200]);
  const data=summary(db,user('admin'));assert.equal(data.total,2);assert.equal(data.stages.reduce((s,r)=>s+r.expectedValue,0),300);
  const controller=new AbortController();const stream=await fetch(base+'/pipeline/events',{headers:{Authorization:`Bearer ${tokens.b}`},signal:controller.signal});
  const reader=stream.body.getReader();const frame=new TextDecoder().decode((await reader.read()).value);
  assert.ok(frame.includes(revision(db,user('b'))),'new connection receives latest persisted revision');
  db.prepare('DELETE FROM sessions WHERE user_id=?').run('b');
  const end=await Promise.race([reader.read(),new Promise((_,reject)=>setTimeout(()=>reject(Error('revocation timeout')),3000).unref())]);
  assert.equal(end.done,true);controller.abort();
  const {createSession}=await import('../server/auth.mjs');tokens.b=createSession('b').token;
  db.exec("DELETE FROM leads WHERE id LIKE 'parallel-%'");
});
test('separate browsers update Admin automatically and recover missed offline changes',{skip:process.env.CRM_PIPELINE_BROWSER_TEST!=='1',timeout:120000},async()=>{
  const {chromium,expect}=await import('@playwright/test');
  db.prepare("INSERT INTO leads(id,user_id,name,company,stage,expected_value) VALUES('browser-lead','a','Browser opportunity','Browser customer','sample',12500)").run();
  db.exec("INSERT INTO tally_rm_targets(rm_name,period,target_lakh) VALUES('a','2026-04',1),('a','2025-04',1)");
  const first=await chromium.launch(),second=await chromium.launch();
  const contexts=[];
  try{
    async function page(browser,id){
      const context=await browser.newContext();contexts.push(context);
      await context.addInitScript(({token,id})=>{localStorage.setItem('psspl_crm_session',token);localStorage.setItem('psspl_crm_user',JSON.stringify({id,email:id+'@test.invalid',role:id==='admin'?'admin':'rm'}));},{token:tokens[id],id});
      // Forward real HTTP requests to the isolated test API; responses are never mocked.
      await context.route('**/api/**',route=>{const url=new URL(route.request().url());return route.continue({url:base+url.pathname+url.search});});
      return {context,page:await context.newPage()};
    }
    const admin=await page(first,'admin'),rm=await page(second,'a');
    const errors=[];admin.page.on('pageerror',error=>errors.push(error.message));rm.page.on('pageerror',error=>errors.push(error.message));
    await admin.page.goto('http://localhost:3000/admin');await rm.page.goto('http://localhost:3000/rm/customers');
    await rm.page.getByRole('tab',{name:'Leads',exact:true}).click();
    const pipeline=admin.page.getByRole('region',{name:'Lead pipeline'});
    await expect(pipeline).toContainText('1 total leads',{timeout:30000});
    await expect(rm.page.getByText('Browser opportunity',{exact:true})).toBeVisible();
    const stageCard=label=>pipeline.locator('div').filter({has:admin.page.locator('small',{hasText:new RegExp('^'+label+'$')})}).filter({has:admin.page.locator('strong')}).last();
    await expect(stageCard('Sample').locator('strong')).toHaveText('1');
    let overviewRequests=0,documents=0;
    admin.page.on('request',request=>{if(new URL(request.url()).pathname==='/api/admin/overview')overviewRequests++;if(request.isNavigationRequest())documents++;});
    const fy=admin.page.locator('select').first();const fyValue=await fy.inputValue();
    await pipeline.scrollIntoViewIfNeeded();const scroll=await admin.page.evaluate(()=>window.scrollY);
    const lead=rm.page.locator('.kanban-card').filter({hasText:'Browser opportunity'});
    const quotation=rm.page.locator('.kanban-col').filter({hasText:'Quotation'}).first();
    await lead.getByRole('button',{name:'Next Stage',exact:true}).click();
    await expect(stageCard('Sample').locator('strong')).toHaveText('0',{timeout:10000});
    await expect(stageCard('Quotation').locator('strong')).toHaveText('1');
    await expect(pipeline.locator('tbody tr')).toContainText('Quotation');
    await expect(stageCard('Quotation')).toContainText('12,500');
    assert.equal(await fy.inputValue(),fyValue);assert.equal(await admin.page.evaluate(()=>window.scrollY),scroll);
    assert.equal(overviewRequests,0,'pipeline events must not refetch the whole dashboard');assert.equal(documents,0,'no document navigation');
    await admin.context.setOffline(true);
    assert.equal((await call('/sales/leads/browser-lead/stage','a','PATCH',{stage:'won'})).status,200);
    await admin.context.setOffline(false);
    await expect(stageCard('Won').locator('strong')).toHaveText('1',{timeout:20000});
    await expect(stageCard('Quotation').locator('strong')).toHaveText('0');
    await expect(pipeline.locator('tbody tr')).toHaveCount(1);
    assert.equal((await call('/sales/leads/browser-lead/stage','admin','PATCH',{stage:'expected_order'})).status,200);
    await expect(rm.page.locator('.kanban-col').filter({hasText:'Order Expected'}).first().locator('.kanban-card')).toHaveCount(1,{timeout:10000});
    await expect(rm.page.getByRole('tab',{name:'Leads',exact:true})).toHaveAttribute('aria-selected','true');
    await expect(stageCard('Order expected').locator('strong')).toHaveText('1');
    await rm.page.setViewportSize({width:390,height:844});
    await expect(rm.page.locator('.pipeline-board-viewport')).toBeVisible();
    assert.equal(errors.length,0,errors.join('\n'));
    await admin.page.screenshot({path:'scratch/pipeline-sync-admin.png',fullPage:true});
  }finally{for(const context of contexts)await context.close();await first.close();await second.close();db.exec("DELETE FROM leads WHERE id='browser-lead'");}
});
