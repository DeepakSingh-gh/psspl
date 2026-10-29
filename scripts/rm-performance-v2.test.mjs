import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import express from 'express';
import {chromium} from '@playwright/test';
import {rmReportPeriod} from '../shared/rm-report-period.mjs';
import {financialMonths,reportingWeeks,variations,comparisonRange} from '../shared/rm-performance.mjs';
import {indiaBusinessDate} from '../shared/business-date.mjs';

const scratch=mkdtempSync(join(tmpdir(),'psspl-rm-v2-'));
process.env.NODE_ENV='test';
process.env.CRM_TEST_DATABASE_ROOT=scratch;
process.env.CRM_DATABASE_PATH=join(scratch,'synthetic.sqlite');
process.env.CRM_DISABLE_BASELINE_RESTORE='true';
let db,server,base,enrichPerformanceReview,tokens={};
const selection=(reportType='yearly',extra={})=>({reportType,financialYear:'2024-25',weekScheme:'four',reportVersion:'2',...extra});
const call=(path,who='admin')=>fetch(base+path,{headers:{Authorization:`Bearer ${tokens[who]}`}});
const report=async(query,who='admin',id='alicescope')=>{
  const response=await call(`${who==='admin'?`/admin/team/${id}`:'/rm/period-report'}?${new URLSearchParams(query)}`,who);
  assert.equal(response.status,200,await response.clone().text());return response.json();
};
before(async()=>{
  ({db}=await import('../server/db.mjs'));
  // Import database-dependent modules only after the isolated path is configured.
  ({enrichPerformanceReview}=await import('../server/rm-ai-analysis.mjs'));
  assert.equal(db.prepare('PRAGMA database_list').get().file,process.env.CRM_DATABASE_PATH);
  const {createSession}=await import('../server/auth.mjs');
  const {adminRouter}=await import('../server/admin.mjs');
  const {rmRouter}=await import('../server/rm-routes.mjs');
  for(const [id,role,name,manager] of [['admin','admin','Test Admin',null],['alice','rm','Alice Scope',null],['rep','salesperson','Field Rep','alice'],['bob','rm','Bob Other',null],['rais','rm','Rais Khan',null]]){
    db.prepare('INSERT INTO users(id,email,password_hash,role) VALUES(?,?,?,?)').run(id,`${id}@example.test`,'synthetic',role);
    db.prepare("INSERT INTO salesperson_profiles(user_id,full_name,employee_code,manager_user_id,region,territory) VALUES(?,?,?,?, 'Test','Test City')").run(id,name,`TEST-${id}`,manager);
    tokens[id]=createSession(id).token;
  }
  db.prepare("INSERT INTO tally_customers(id,name,rm_name,owner_user_id) VALUES('customer','Verified Customer','Alice Scope','rep'),('other','Other Customer','Bob Other','bob')").run();
  db.prepare("INSERT INTO tally_products(id,name) VALUES('product','Verified Product')").run();
  for(const m of financialMonths('2024-25'))db.prepare('INSERT INTO tally_rm_targets(rm_name,period,target_lakh) VALUES(?,?,?)').run('Alice Scope',m.key,.3);
  const current=indiaBusinessDate(),currentYear=Number(current.slice(0,4))-(Number(current.slice(5,7))<4?1:0);
  for(const m of financialMonths(`${currentYear}-${String(currentYear+1).slice(-2)}`))db.prepare('INSERT INTO tally_rm_targets(rm_name,period,target_lakh) VALUES(?,?,?)').run('Alice Scope',m.key,.31);
  const dates=[['2024-03-01',500],['2024-04-01',1000],['2024-04-07',2000],['2024-04-08',3000],['2024-04-30',4000],['2024-05-01',5000],['2024-05-08',9000,'customer','Credit Note'],['2025-03-31',6000],['2025-04-01',7000],['2024-04-06',100,'customer','Credit Note'],['2024-04-03',99999,'other'],['2024-04-03',99999,'customer','Sales','excel-import'],['2024-04-04',99999,'customer','Sales',null,'staging']];
  for(const [index,[date,amount,customer='customer',type='Sales',source=null,ingest=null]] of dates.entries()){
    db.prepare('INSERT INTO tally_invoices(id,company_name,voucher_type,invoice_date,customer_id,customer_name,amount,source_sync_id,ingest_session_id) VALUES(?,?,?,?,?,?,?,?,?)').run(`i-${index}`,'Synthetic',type,date,customer,'Verified Customer',amount,source,ingest);
    db.prepare('INSERT INTO tally_invoice_lines(id,invoice_id,product_id,product_name,quantity,amount) VALUES(?,?,?,?,?,?)').run(`l-${index}`,`i-${index}`,'product','Verified Product',1,amount);
  }
  db.prepare("INSERT INTO visits(id,user_id,business_date,tally_customer_id,scheduled_at,purpose,status,completed_at) VALUES('done','rep','2024-04-02','customer','2024-04-02T09:00:00Z','Review','completed','2024-04-02T10:00:00Z'),('late','rep','2024-04-02','customer','2024-04-02T09:00:00Z','Late completion','completed','2024-05-02T10:00:00Z'),('missing','rep','2024-04-02','customer','2024-04-02T09:00:00Z','Missing completion date','completed',NULL)").run();
  db.prepare("INSERT INTO follow_ups(id,user_id,tally_customer_id,title,due_date) VALUES('follow','rep','customer','Review','2024-04-03')").run();
  const app=express();app.use(express.json());app.use('/admin',adminRouter);app.use('/rm',rmRouter);
  app.use((error,req,res,next)=>res.status(500).json({error:error.message}));
  server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{if(server)await new Promise(r=>server.close(r));db?.close();assert.ok(resolve(scratch).startsWith(resolve(tmpdir())));rmSync(scratch,{recursive:true,force:true});});

test('FY order, four buckets, leap February and comparison boundaries',()=>{
  const months=financialMonths('2026-27');assert.equal(months.length,12);assert.equal(months[0].from,'2026-04-01');assert.equal(months.at(-1).to,'2027-03-31');
  for(const fy of ['2023-24','2024-25','2026-27'])for(const month of financialMonths(fy)){
    const weeks=reportingWeeks(fy,month.month);assert.equal(weeks.length,4);assert.equal(weeks[0].from,month.from);assert.equal(weeks.at(-1).to,month.to);
    assert.equal(weeks.reduce((n,w)=>n+(Date.parse(w.to)-Date.parse(w.from))/86400000+1,0),Number(month.to.slice(8)));
    for(let i=1;i<4;i++)assert.equal(Date.parse(weeks[i].from)-Date.parse(weeks[i-1].to),86400000);
  }
  assert.equal(reportingWeeks('2023-24',2)[3].to,'2024-02-29');
  assert.deepEqual(comparisonRange(selection('monthly',{month:5}),'2024-05-10'),{from:'2024-04-01',to:'2024-04-10',label:'Previous month, comparable elapsed days'});
  assert.deepEqual(comparisonRange(selection('weekly',{month:5,week:1}),'2024-05-07'),{from:'2024-04-22',to:'2024-04-28',label:'Previous reporting week, comparable elapsed days'});
  assert.equal(comparisonRange(selection('yearly',{financialYear:'2023-24'}),'2024-02-29').to,'2023-02-28');
});
test('financial formulas preserve negatives, nulls, zero denominators and consistent rounding',()=>{
  assert.deepEqual(variations(656000,1128000,734000),{actual:656000,target:1128000,previousActual:734000,achievementPercent:58.16,variation:-472000,variationPercent:-41.84,growthPercent:-10.63});
  assert.equal(variations(-4000,30000).variation,-34000);assert.equal(variations(100,null).achievementPercent,null);assert.equal(variations(null,100).variation,null);assert.equal(variations(100,0,0).growthPercent,null);assert.equal(variations(100,0).achievementPercent,null);assert.equal(variations(120,100).variation,20);
});
test('V2 year/month/week reconcile and keep RM ownership, credit notes and authoritative sources',async()=>{
  const year=await report(selection());assert.equal(year.version,2);assert.equal(year.summary.actual,11900);assert.equal(year.yearRows.length,12);assert.equal(year.yearRows.reduce((s,r)=>s+r.actual,0),year.summary.actual);
  const month=await report(selection('monthly',{month:4}));assert.equal(month.summary.actual,9900);assert.equal(month.summary.target,30000);assert.equal(month.weekRows.length,4);assert.equal(month.weekRows.reduce((s,r)=>s+r.actual,0),9900);assert.equal(month.weekRows.reduce((s,r)=>s+r.target,0),30000);
  for(let week=1;week<=4;week++){
    const result=await report(selection('weekly',{month:4,week}));assert.equal(result.summary.actual,month.weekRows[week-1].actual);assert.equal(result.summary.target,month.weekRows[week-1].target);assert.deepEqual(result.weekRows,month.weekRows,'overview chart remains stable after week selection');
    assert.ok(result.tables.find(t=>t.id==='invoices').rows.every(row=>row[0]>=result.from&&row[0]<=result.to));
  }
  assert.equal(month.kpi.visitsPlanned,3);assert.equal(month.kpi.visitsCompleted,1,'later or missing completion timestamps are not historical completions');
  assert.equal(month.kpi.followUpsOpen,null);assert.equal(month.kpi.expectedOrdersValue,null);assert.ok(month.limitations.some(x=>x.includes('Historical follow-up')));
  assert.ok(month.narratives.some(n=>n.id==='visits'));assert.ok(month.narratives.every(n=>n.action.includes('retrospective')));
  assert.equal((await report(selection('monthly',{month:5}))).summary.actual,-4000);
  for (const result of [year,month,...await Promise.all([1,2,3,4].map(week=>report(selection('weekly',{month:4,week}))))]) {
    assert.equal(result.topSales.totalSales,result.summary.actual);
    assert.equal(result.topSales.customerTotal,result.summary.actual);
    assert.equal(result.topSales.productTotal,result.summary.actual);
    assert.equal(result.topSales.productVariance,0);
    if (!result.tables.find(t=>t.id==='invoices').rows.length) {assert.deepEqual(result.topSales.customers,[]);assert.deepEqual(result.topSales.products,[]);continue;}
    assert.equal(result.topSales.customers[0].name,'Verified Customer');
    assert.equal(result.topSales.products[0].name,'Verified Product');
    assert.equal(result.topSales.customers[0].sharePercent,100);
    assert.equal(result.topSales.products[0].sharePercent,100);
  }
  const self=await report(selection('monthly',{month:4}),'alice');assert.deepEqual(self.summary,month.summary);
  assert.equal((await call('/admin/team/alicescope?'+new URLSearchParams(selection()),'alice')).status,403);
  assert.equal((await call('/rm/period-report?'+new URLSearchParams({...selection(),rmId:'bobother'}),'alice')).status,403);
});
test('future months, missing targets, active FY and stored source weekly values are explicit',async()=>{
  const current=indiaBusinessDate(),year=Number(current.slice(0,4))-(Number(current.slice(5,7))<4?1:0),fy=`${year}-${String(year+1).slice(-2)}`;
  const active=await report(selection('yearly',{financialYear:fy}));assert.equal(active.asOf,current);assert.ok(active.yearRows.filter(r=>r.from>current).every(r=>r.actual===null));assert.equal(active.annualTarget,372000);
  const empty=await report(selection('monthly',{financialYear:'2022-23',month:4}));assert.equal(empty.summary.actual,null);assert.equal(empty.summary.target,null);assert.equal(empty.summary.achievementPercent,null);
  const rais=await report(selection('monthly',{financialYear:'2026-27',month:9}),'admin','raiskhan');assert.equal(rais.source,'Supplied PDF snapshot');assert.equal(rais.summary.actual,656000);assert.equal(rais.weekRows[0].targetBasis,'Stored source weekly target (blank means unavailable)');assert.equal(rais.tables.find(t=>t.id==='invoices').rows.length,0);assert.ok(!JSON.stringify(rais).includes('North Star Traders'));
  assert.deepEqual(rais.topSales.customers,[]);assert.deepEqual(rais.topSales.products,[]);assert.match(rais.topSales.reason,/aggregate snapshot/);
  const prior=await report(selection('monthly',{financialYear:'2025-26',month:4}),'admin','raiskhan');assert.equal(prior.source,'Supplied PDF snapshot');assert.ok(prior.summary.actual>0);assert.ok(prior.weekRows.every(w=>w.actual===null&&w.target===null),'previous-year monthly aggregates do not establish weekly splits');
  const future=await report(selection('monthly',{financialYear:'2028-29',month:4}));assert.equal(future.summary.actual,null);assert.equal(future.kpi.visitsCompleted,null);
  const bad=await call('/admin/team/alicescope?'+new URLSearchParams(selection('weekly',{month:4,week:5})));assert.equal(bad.status,400);
});
test('AI may reorder supported findings but cannot change metrics or invent a finding',async()=>{
  const data=await report(selection('monthly',{month:4}));
  const reordered=await enrichPerformanceReview(data,{configured:true,provider:async(system,payload)=>{
    assert.ok(system.includes('untrusted data'));assert.equal(JSON.parse(payload).summary.actual,9900);
    return JSON.stringify({order:[...data.narratives].reverse().map(n=>n.id)});
  }});
  assert.equal(reordered.analysisMethod,'ai-assisted');assert.deepEqual(reordered.summary,data.summary);assert.deepEqual(reordered.narratives[0],data.narratives.at(-1));
  const invalid=await enrichPerformanceReview({...data,id:'invalid-ai-test'},{configured:true,provider:async()=>JSON.stringify({order:['invented-finding'],actual:999999})});
  assert.equal(invalid.analysisMethod,'rule-based');assert.deepEqual(invalid.narratives,data.narratives);assert.deepEqual(invalid.summary,data.summary);
});

test('V2 interactive navigation, tooltips, race protection, mobile and multi-page PDFs',{skip:process.env.CRM_BROWSER_TEST!=='1',timeout:240000},async()=>{
  mkdirSync('scratch/rm-v2',{recursive:true});
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1536,height:1100},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    async function connect(p,who){
      await p.addInitScript(token=>localStorage.setItem('psspl_crm_session',token),tokens[who]);
      await p.route('**/api/**',async route=>{
        const url=new URL(route.request().url()),path=url.pathname.replace(/^\/api/,'');
        if(path==='/auth/me')return route.fulfill({json:{user:{id:who,email:`${who}@example.test`,role:who==='admin'?'admin':'rm'}}});
        if(path==='/rm/dashboard')return route.fulfill({json:{manager:{fullName:'Alice Scope',region:'Test'}}});
        if(url.searchParams.get('month')==='5')await new Promise(r=>setTimeout(r,450));
        const response=await call(path+url.search,who);let body=await response.text();
        if(url.searchParams.get('month')==='6'&&url.searchParams.get('reportVersion')==='2'&&response.ok){
          const data=JSON.parse(body);data.tables.find(t=>t.id==='products').rows=Array.from({length:90},(_,i)=>[`Large dataset product ${i+1}`,i*100,1]);body=JSON.stringify(data);
        }
        await route.fulfill({status:response.status,contentType:'application/json',body});
      });
    }
    await connect(page,'admin');await page.goto('http://localhost:3000/admin/team/alicescope');
    await page.getByRole('heading',{name:'Alice Scope',exact:true}).waitFor();
    await page.getByLabel('Financial Year',{exact:true}).selectOption('2024-25');
    await page.waitForFunction(()=>document.querySelector('.rm-v2-toolbar small')?.textContent.includes('FY 2024-25'));
    assert.equal(await page.locator('.rm-v2-month-chart g[role=button]').count(),12);
    assert.equal(await page.getByLabel('Month',{exact:true}).count(),0);assert.equal(await page.getByLabel('Week',{exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:'View Report',exact:true}).count(),0);
    const monthly=page.locator('.rm-v2-month-chart');const beforeWidth=(await monthly.boundingBox()).width;
    await monthly.locator('g[role=button]').filter({hasText:'Apr'}).click();
    await page.waitForFunction(()=>document.querySelector('.rm-v2-toolbar small')?.textContent.includes('/ April'));
    await page.locator('.rm-v2-week-chart g[role=button]').first().waitFor();
    await page.waitForTimeout(450);assert.ok((await monthly.boundingBox()).width<beforeWidth*.6);
    assert.equal(await page.locator('.rm-v2-week-chart g[role=button]').count(),4);
    assert.match(await page.locator('.rm-v2-summary').innerText(),/9,900/);
    await page.screenshot({path:'scratch/rm-v2/desktop-expanded.png',fullPage:true});
    await page.locator('.rm-v2-week-chart g[role=button]').nth(1).focus();assert.match(await page.locator('.rm-v2-tooltip').innerText(),/Target variation[\s\S]*Previous comparable sales/);
    await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.rm-v2-toolbar small')?.textContent.includes('Week 2'));
    assert.match(await page.locator('.rm-v2-summary').innerText(),/3,000/);
    const sections=await page.locator('[data-report-section]').evaluateAll(els=>els.map(el=>el.getAttribute('data-report-section')));assert.deepEqual(sections.slice(-2),['insights','actions']);
    async function pdf(name){
      await page.getByRole('button',{name:'Download PDF',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();
      await page.locator('[data-pagination-ready=true]').waitFor();
      assert.match(await dialog.innerText(),/FY 2024-25/);
      const overflow=await page.locator('[data-rm-report-page]').evaluateAll(pages=>pages.map(p=>({bottom:p.querySelector('.rm-v2-pdf-page-content').getBoundingClientRect().bottom,footer:p.querySelector('footer').getBoundingClientRect().top})).filter(x=>x.bottom>x.footer-4));assert.deepEqual(overflow,[],'no PDF content overlaps footers');
      const pages=await page.locator('[data-rm-report-page]').count();assert.ok(pages>=2);
      const reportCounts=await page.locator('#rm-report-render-target .rm-v2-pdf-page-content .rm-v2-pdf-block').count();assert.ok(reportCounts>15);
      await page.locator('[data-rm-report-page]').first().screenshot({path:`scratch/rm-v2/${name}-page-1.png`});
      const download=page.waitForEvent('download',{timeout:90000});await dialog.getByRole('button',{name:'Download PDF',exact:true}).click();const file=await download;await file.saveAs(`scratch/rm-v2/${name}.pdf`);assert.ok(existsSync(`scratch/rm-v2/${name}.pdf`));
      assert.match(file.suggestedFilename(),new RegExp(name==='week'?'weekly':name==='year'?'yearly':'monthly'));
      await page.keyboard.press('Escape');return pages;
    }
    await pdf('week');await page.getByRole('button',{name:'Back to month',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.rm-v2-toolbar small')?.textContent.includes('/ April')&&!document.querySelector('.rm-v2-toolbar small')?.textContent.includes('Week'));
    await pdf('month');
    // A slower May response must not overwrite the later June selection.
    await monthly.locator('g[role=button]').filter({hasText:'May'}).click();await monthly.locator('g[role=button]').filter({hasText:'Jun'}).click();
    await page.waitForFunction(()=>document.querySelector('.rm-v2-toolbar small')?.textContent.includes('/ June'));await page.waitForTimeout(600);assert.match(await page.locator('.rm-v2-toolbar small').innerText(),/June/);
    const largePages=await pdf('large-month');assert.ok(largePages>=3,'large datasets expand pagination');
    await page.getByRole('button',{name:'Back to Full Year',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.rm-v2-summary')?.textContent.includes('11,900'));await pdf('year');
    await page.getByLabel('Financial Year',{exact:true}).selectOption('2025-26');await page.waitForFunction(()=>document.querySelector('.rm-v2-toolbar small')?.textContent.includes('2025-26'));assert.equal(await page.locator('.rm-v2-chart-split.expanded').count(),0);
    await page.setViewportSize({width:390,height:844});await monthly.locator('g[role=button]').filter({hasText:'Apr'}).click();await page.locator('.rm-v2-week-chart g[role=button]').first().waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:'scratch/rm-v2/mobile.png',fullPage:true});
    await page.setViewportSize({width:1536,height:1100});
    await page.goto('http://localhost:3000/admin/team/raiskhan');await page.getByLabel('Financial Year',{exact:true}).selectOption('2026-27');
    await page.waitForFunction(()=>document.querySelector('.rm-v2-identity h1')?.textContent==='Rais Khan'&&document.querySelector('.rm-v2-toolbar small')?.textContent.includes('2026-27'));
    await page.locator('.rm-v2-month-chart g[role=button]').filter({hasText:'Sep'}).click();
    await page.waitForFunction(()=>document.querySelector('.rm-v2-summary')?.textContent.includes('6.56 L'));
    assert.match(await page.locator('.rm-v2-identity').innerText(),/Supplied PDF snapshot.*dated 30-09-2026/);
    await page.locator('.rm-v3-coverage summary').click();
    const coverage=page.getByRole('region',{name:'Executive Territory Coverage',exact:true});assert.match(await coverage.innerText(),/Rais Khan[\s\S]*Chandigarh/);
    await page.getByRole('button',{name:'Download PDF',exact:true}).click();await page.locator('[data-pagination-ready=true]').waitFor();
    assert.match(await page.getByRole('dialog').innerText(),/6.56 L/);assert.equal(await page.getByRole('dialog').getByRole('region',{name:'Executive Territory Coverage',exact:true}).innerText(),await coverage.first().innerText());await page.keyboard.press('Escape');
    await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.rm-v2-month-chart').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
    const own=await browser.newPage();await connect(own,'alice');await own.goto('http://localhost:3000/rm/report-card');await own.getByLabel('Financial Year',{exact:true}).waitFor();assert.equal(await own.getByLabel('Regional manager',{exact:true}).count(),0);
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});
