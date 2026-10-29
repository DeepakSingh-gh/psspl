import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { feedbackCatalog, feedbackById, feedbackForIdentity } from '../server/rm-feedback.mjs';

test('all twelve PDFs have distinct immutable snapshots, leading-zero codes and complete financial matrices', () => {
  assert.equal(feedbackCatalog.length, 12);
  assert.equal(new Set(feedbackCatalog.map(item => item.rm.rmCode)).size, 12);
  for (const item of feedbackCatalog) {
    const report = feedbackById(item.id);
    assert.equal(report.asOf, '2026-09-30');
    assert.equal(report.financialYear, '2026-27');
    assert.match(report.source.sha256, /^[a-f0-9]{64}$/);
    assert.equal(report.monthlyMetrics.length, 12);
    assert.equal(report.weeklySummary.length, 4);
    assert.equal(report.previousYearPerformance.length, 12);
    assert.equal(report.monthlyMetrics[0].period, '2026-04');
    assert.equal(report.monthlyMetrics[11].period, '2027-03');
    for (const week of report.weeklySummary) {
      assert.equal(week.targets.length, 12); assert.equal(week.achieved.length, 12);
    }
    assert.ok(report.monthlyMetrics.slice(6).every(month => month.achieved === null), 'future source dashes must not become actual sales');
    assert.equal(feedbackById(item.id), report, 'lookups reuse the preloaded object');
    assert.throws(() => { report.annual.currentYearActual = -1; }, TypeError);
    assert.ok(report.sourceText.includes('30.09.2026'));
  }
  assert.equal(feedbackById('aniljena').rm.rmCode, '075709');
  assert.equal(feedbackById('nazmulislam').rm.rmCode, '000739');
  assert.equal(feedbackById('raiskhan').rm.rmCode, '033705');
  assert.deepEqual(feedbackById('raiskhan').teamEntries[0], { name: 'Rais Khan', citiesCovered: 'Ludhiana, Jalandhar, Amritsar and Chandigarh' });
  assert.equal(feedbackById('aniljena').teamEntries.length, 9);
  assert.equal(feedbackById('pradeepmulik').teamEntries[2].citiesCovered, 'Aurangabad');
  assert.equal(feedbackById('souravranjit').teamEntries[1].citiesCovered, 'Ranaghat, Bongaon');
});

test('source figures are RM-specific and preserve source totals and notes', () => {
  const actuals={ketanbhatt:378.05,aniljena:114.24,gowrishankar:25.55,harshshah:122.25,jithinthomas:80.37,nazmulislam:10.49,pradeepmulik:397.92,raiskhan:53.14,souravranjit:74.93,vrameshkumar:227.27,vilaskharabe:103.33,ypsharma:167.67};
  for (const [id, expected] of Object.entries(actuals)) assert.equal(feedbackById(id).annual.currentYearActual, expected);
  const anil=feedbackById('aniljena');
  assert.equal(anil.annual.currentYearPct,45);
  assert.equal(anil.monthlyTotals.pct,23,'YTD and full annual denominator percentages remain distinct');
  assert.equal(anil.monthlyMetrics[0].achieved,35.64);
  assert.equal(anil.weeklySummary[0].achieved[0],null,'blank week cell is not invented zero');
  assert.equal(anil.weeklySummary[0].achieved[4],13.72);
  assert.equal(anil.thrustProductGroups[0].achievedText,'');
  assert.equal(anil.thrustProductGroups[1].achievedText,'0.09');
  assert.match(feedbackById('pradeepmulik').specialAchievementsNotes,/78300/);
});

test('exact known spelling aliases resolve without fuzzy cross-person fallback', () => {
  assert.equal(feedbackForIdentity({name:'Ketan Bhat'}).id,'ketanbhatt');
  assert.equal(feedbackForIdentity({name:'Gauri Shankar'}).id,'gowrishankar');
  assert.equal(feedbackForIdentity({name:'Y.P. Sharma'}).id,'ypsharma');
  assert.equal(feedbackForIdentity({rmCode:'075709'}).id,'aniljena');
  assert.equal(feedbackForIdentity({name:'Anil Jena',rmCode:'271704'}),null);
  assert.equal(feedbackForIdentity({name:'Anil New Employee'}),null);
  assert.equal(feedbackById('missing'),null);
});

const scratch=mkdtempSync(join(tmpdir(),'psspl-rm-feedback-'));
Object.assign(process.env,{NODE_ENV:'test',CRM_DATABASE_PATH:join(scratch,'synthetic.sqlite'),CRM_DISABLE_BASELINE_RESTORE:'true',CRM_EMAIL_PROVIDER:'disabled'});
let db,server,base;
const tokens={};
before(async()=>{
  ({db}=await import('../server/db.mjs'));
  const {createSession}=await import('../server/auth.mjs');
  const {adminRouter}=await import('../server/admin.mjs');
  const {rmRouter}=await import('../server/rm-routes.mjs');
  for (const [id,role,name,code] of [['admin','admin','Test Admin','admin-code'],['anil','rm','Anil Jena','075709'],['ketan','rm','Ketan Bhat','271704'],['unknown','rm','Unmapped Test RM','test-code'],['rep','salesperson','Test Rep','rep-code']]) {
    db.prepare('INSERT INTO users(id,email,password_hash,role,active) VALUES(?,?,?,?,1)').run(id,`${id}@example.test`,'synthetic',role);
    db.prepare('INSERT INTO salesperson_profiles(user_id,employee_code,full_name,region,territory) VALUES(?,?,?,?,?)').run(id,code,name,'Synthetic','Test');
    tokens[id]=createSession(id).token;
  }
  const app=express();app.use(express.json());app.use('/admin',adminRouter);app.use('/rm',rmRouter);
  server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));base=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));db?.close();rmSync(scratch,{recursive:true,force:true});});
const call=(path,actor)=>fetch(base+path,{headers:tokens[actor]?{Authorization:`Bearer ${tokens[actor]}`}:{}});

test('catalog and report enforce admin-only access; salespeople cannot retrieve RM snapshots',async()=>{
  for(const path of ['/admin/rm-feedback','/admin/rm-feedback/aniljena']){
    assert.equal((await call(path)).status,401);
    for(const actor of ['anil','ketan','rep'])assert.equal((await call(path,actor)).status,403);
  }
  assert.equal((await (await call('/admin/rm-feedback','admin')).json()).items.length,12);
  for(const report of feedbackCatalog)assert.equal((await (await call(`/admin/rm-feedback/${report.id}`,'admin')).json()).rm.name,report.rm.name);
  assert.equal((await call('/admin/rm-feedback/missing','admin')).status,404);
  assert.equal((await call('/rm/print-report','rep')).status,403);
});

test('RM print endpoint uses signed-in identity only and never returns Anil figures for another RM',async()=>{
  assert.equal((await call('/rm/print-report')).status,401);
  const anil=await (await call('/rm/print-report','anil')).json();
  const ketan=await (await call('/rm/print-report?id=aniljena','ketan')).json();
  assert.equal(anil.annual.currentYearActual,114.24);
  assert.equal(ketan.annual.currentYearActual,378.05);
  assert.equal(ketan.rm.name,'Ketan Bhatt');
  assert.equal((await call('/rm/print-report','unknown')).status,404);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM tally_invoices').get().n,0,'snapshot retrieval creates no live sales');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM users').get().n,5,'snapshot retrieval creates no employee accounts');
});

test('team performance includes every supplied RM and uses their own FYTD sales, target and thrust total', async () => {
  const response = await call('/admin/team?fy=2026-27', 'admin');
  assert.equal(response.status, 200);
  const data = await response.json();
  for (const report of feedbackCatalog) {
    const member = data.members.find(item => item.feedbackSnapshotId === report.id);
    assert.ok(member, `${report.rm.name} must appear even without a CRM login`);
    assert.equal(member.salesValue, Math.round(report.annual.currentYearActual * 100000));
    assert.equal(member.targetValue, Math.round(report.annual.currentYearTargetTillMonth * 100000));
    assert.equal(member.achievementPercent, report.annual.currentYearPct);
    assert.equal(member.thrustSalesLakh, feedbackById(report.id).thrustTotalLakh);
    assert.equal(member.thrustActiveCount, null);
  }
  assert.equal(data.members.filter(item => item.feedbackSnapshotId === 'aniljena').length, 1);
  const jithin = data.members.find(item => item.feedbackSnapshotId === 'jithinthomas');
  assert.equal(jithin.crmUser, null, 'adding supplied reports must not manufacture login accounts');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM users').get().n, 5);
});

test('historical workbook sales remain visible as historical evidence without turning missing current invoices into zero sales', async () => {
  for (const [year, amount] of [['2024-25', 6791033.39], ['2025-26', 7880696.03]]) {
    db.prepare('INSERT INTO tally_rm_product_sales(rm_name,product_name,financial_year,quantity,sales_value) VALUES(?,?,?,?,?)').run('Vijay Nair','Synthetic historical product',year,1,amount);
  }
  const data = await (await call('/admin/team?fy=2026-27', 'admin')).json();
  const vijay = data.members.find(item => item.name === 'Vijay Nair');
  assert.ok(vijay);
  assert.equal(vijay.financialDataStatus, 'unavailable');
  assert.equal(vijay.achievementPercent, null);
  assert.equal(vijay.reportSource, null);
  assert.deepEqual(vijay.historicalSales, [
    { financialYear: '2025-26', salesValue: 7880696.03, source: 'imported_workbook' },
    { financialYear: '2024-25', salesValue: 6791033.39, source: 'imported_workbook' },
  ]);
  assert.equal(vijay.currentInvoiceCount, 0);
});

test('archived RMs stay out of active team pages despite retained workbook rows; an archived alias does not hide its active RM', async () => {
  for (const [id, name] of [['retired-vijay', 'Vijay Nair'], ['retired-anil-alias', 'Anil Jena']]) {
    db.prepare("INSERT INTO users(id,email,password_hash,role,active,deleted_at) VALUES(?,?,?,'rm',0,?)").run(id, `${id}@deleted.invalid`, '!deleted', new Date().toISOString());
    db.prepare('INSERT INTO salesperson_profiles(user_id,employee_code,full_name,region,territory) VALUES(?,?,?,?,?)').run(id, id, name, 'Synthetic', 'Test');
  }
  const team = await (await call('/admin/team?fy=2026-27', 'admin')).json();
  assert.equal(team.members.some(member => member.name === 'Vijay Nair'), false);
  assert.equal(team.members.filter(member => member.feedbackSnapshotId === 'aniljena').length, 1);
  assert.equal((await call('/admin/team/vijaynair', 'admin')).status, 404);
  assert.equal((await call('/admin/team/aniljena', 'admin')).status, 200);
  const users = await (await call('/admin/users', 'admin')).json();
  assert.equal(users.items.some(user => user.id === 'retired-vijay'), false);
  assert.equal(db.prepare("SELECT SUM(sales_value) total FROM tally_rm_product_sales WHERE rm_name='Vijay Nair' AND financial_year='2025-26'").get().total, 7880696.03);
});

test('Claude RM analysis uses server snapshot facts, caches results and rejects invented evidence', async () => {
  const { generateRmAnalysis } = await import('../server/rm-ai-analysis.mjs');
  const input = { from: '2026-04-01', to: '2026-10-21', period: 'fytd' };
  let calls = 0;
  const provider = async (_system, question) => {
    calls++;
    const evidence = JSON.parse(question);
    assert.equal(evidence.source, 'supplied_pdf_snapshot');
    assert.equal(evidence.facts.find(fact => fact.id === 'fytd').actual, 11424000);
    return JSON.stringify({ items: [{ evidenceId: 'fytd', title: 'Review the reported target gap', action: 'Review the qualified pipeline and agree on practical next actions with the manager.' }] });
  };
  const result = await generateRmAnalysis(db, { id: 'admin', role: 'admin' }, 'aniljena', input, provider);
  assert.equal(result.provider, 'claude');
  assert.match(result.items[0].metric, /11424000/);
  assert.equal(result.items[0].period.to, '2026-09-30');
  assert.equal(await generateRmAnalysis(db, { id: 'admin', role: 'admin' }, 'aniljena', input, provider), result);
  assert.equal(calls, 1);
  const endpoint = await fetch(base + '/admin/team/aniljena/ai-analysis', { method: 'POST', headers: { Authorization: `Bearer ${tokens.admin}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  assert.equal(endpoint.status, 200);
  assert.equal((await endpoint.json()).provider, 'claude');
  assert.equal(calls, 1, 'route must reuse the validated cached analysis');
  await assert.rejects(generateRmAnalysis(db, { id: 'rep', role: 'salesperson' }, 'aniljena', input, provider), { status: 403 });
  await assert.rejects(generateRmAnalysis(db, { id: 'admin', role: 'admin' }, 'ketanbhatt', input, async () => JSON.stringify({ items: [{ evidenceId: 'invented', title: 'Fake', action: 'Fake recommendation' }] })), { status: 503 });
  for (const actor of ['anil', 'rep']) {
    const response = await fetch(base + '/admin/team/aniljena/ai-analysis', { method: 'POST', headers: { Authorization: `Bearer ${tokens[actor]}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    assert.equal(response.status, 403);
  }
});
