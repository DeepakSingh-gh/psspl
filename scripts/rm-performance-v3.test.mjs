import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import express from 'express';
import { chromium } from '@playwright/test';

// Database-dependent modules must only load AFTER these isolated settings.
const scratch = mkdtempSync(join(tmpdir(), 'psspl-v3-'));
process.env.NODE_ENV = 'test';
process.env.CRM_TEST_DATABASE_ROOT = scratch;
process.env.CRM_DATABASE_PATH = join(scratch, 'fixture.sqlite');
process.env.CRM_DISABLE_BASELINE_RESTORE = 'true';
let db, server, base, token, rmToken, sourceSnapshot;
const output = 'scratch/rm-v3';
const selection = (extra = {}) => ({ reportVersion: '2', reportType: 'yearly', financialYear: '2026-27', weekScheme: 'four', ...extra });
const call = path => fetch(base + path, { headers: { Authorization: `Bearer ${token}` } });

before(async () => {
  ({ db } = await import('../server/db.mjs'));
  assert.equal(resolve(db.prepare('PRAGMA database_list').get().file), resolve(process.env.CRM_DATABASE_PATH));
  const { createSession } = await import('../server/auth.mjs');
  const { adminRouter } = await import('../server/admin.mjs');
  sourceSnapshot = (await import('../server/rm-feedback.mjs')).feedbackForIdentity({name:'Rais Khan'});
  for (const [id, role, name, manager] of [['v3admin','admin','Visual QA',null], ['v3rais','rm','Rais Khan',null], ['v3rep','salesperson','Verified Executive','v3rais'], ['v3alice','rm','Alice Scope',null]]) {
    db.prepare('INSERT INTO users(id,email,password_hash,role) VALUES(?,?,?,?)').run(id, `${id}@example.test`, 'fixture', role);
    db.prepare("INSERT INTO salesperson_profiles(user_id,full_name,employee_code,manager_user_id,region,territory,operating_city) VALUES(?,?,?,?, 'North','Punjab','Ludhiana')").run(id, name, id === 'v3rais' ? sourceSnapshot.rm.rmCode : id, manager);
  }
  token = createSession('v3admin').token;
  rmToken = createSession('v3rais').token;
  db.prepare("INSERT INTO tally_customers(id,name,rm_name,owner_user_id) VALUES('v3customer','Verified source customer','Rais Khan','v3rep'),('v3alicecustomer','Invoice Customer','Alice Scope','v3alice')").run();
  for (let month=4;month<=12;month++) db.prepare('INSERT INTO tally_rm_targets(rm_name,period,target_lakh) VALUES(?,?,?)').run('Alice Scope',`2026-${String(month).padStart(2,'0')}`,.4);
  for (let month=1;month<=3;month++) db.prepare('INSERT INTO tally_rm_targets(rm_name,period,target_lakh) VALUES(?,?,?)').run('Alice Scope',`2027-${String(month).padStart(2,'0')}`,.4);
  for(let index=0;index<24;index++){
    const id=`v3-invoice-${index}`,amount=(index+1)*1000;
    db.prepare('INSERT INTO tally_invoices(id,company_name,voucher_type,invoice_date,customer_id,customer_name,amount,voucher_number) VALUES(?,?,?,?,?,?,?,?)').run(id,'Isolated visual fixture',index===23?'Credit Note':'Sales','2026-09-20','v3alicecustomer','Invoice Customer',amount,`TEST-${index}`);
    db.prepare('INSERT INTO tally_invoice_lines(id,invoice_id,product_name,quantity,amount) VALUES(?,?,?,?,?)').run(`v3-line-${index}`,id,`Verified fixture product ${String(index+1).padStart(2,'0')}`,1,amount);
  }
  for (const [id, date, status, completed] of [['v3sep','2026-09-20','completed','2026-09-20T10:00:00Z'], ['v3oct','2026-10-22','planned',null]]) {
    db.prepare('INSERT INTO visits(id,user_id,business_date,tally_customer_id,scheduled_at,purpose,status,completed_at) VALUES(?,?,?,?,?,?,?,?)').run(id,'v3rep',date,'v3customer',`${date}T09:00:00Z`,id==='v3sep'?'September review':'October future visit',status,completed);
    db.prepare("INSERT INTO customer_activities(id,user_id,tally_customer_id,activity_type,subject,occurred_at) VALUES(?,?,?,'call',?,?)").run(`call-${id}`,'v3rep','v3customer',id,`${date}T09:00:00Z`);
  }
  const {rmRouter}=await import('../server/rm-routes.mjs');
  const {salesRouter}=await import('../server/sales-routes.mjs');
  const app = express(); app.use(express.json()); app.use('/admin', adminRouter);app.use('/rm',rmRouter);app.use('/sales',salesRouter);
  app.use((error,req,res,next) => res.status(500).json({ error: error.message }));
  server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening',r)); base = `http://127.0.0.1:${server.address().port}`;
  mkdirSync(output, { recursive: true });
});
after(async () => { if(server)await new Promise(r => server.close(r)); db?.close(); assert.ok(resolve(scratch).startsWith(resolve(tmpdir()))); rmSync(scratch,{recursive:true,force:true}); });

async function browserPage(browser, viewport, controls = {}) {
  const page = await browser.newPage({ viewport, acceptDownloads: true });
  await page.addInitScript(value => localStorage.setItem('psspl_crm_session', value), token);
  await page.addInitScript(enabled => { if(!localStorage.getItem('psspl_rais_demo_inputs'))localStorage.setItem('psspl_rais_demo_inputs',enabled?'on':'off'); },!!controls.demo);
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname.replace(/^\/api/,'');
    if(path==='/auth/me')return route.fulfill({json:{user:{id:'v3admin',email:'visual@example.test',role:'admin'}}});
    if(url.searchParams.get('reportVersion')==='2'){
      if(controls.failNext){controls.failNext=false;return route.fulfill({status:503,json:{error:'Synthetic refresh failure'}});}
      if(controls.delayNext){controls.delayNext=false;await new Promise(r=>setTimeout(r,1000));}
    }
    const response = await call(path + url.search);
    await route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});
  });
  return page;
}

test('financial-cutoff analysis stays historical while saved CRM entries use their own window', async () => {
  const response = await call('/admin/team/raiskhan?' + new URLSearchParams(selection()));
  assert.equal(response.status,200);
  const report = await response.json();
  assert.equal(report.asOf,'2026-09-30');
  assert.equal(report.kpi.visitsPlanned,1);
  assert.equal(report.kpi.visitsCompleted,1);
  assert.equal(report.kpi.callsLogged,1);
  assert.equal(report.kpi.followUpsOpen,null);
  assert.equal(report.kpi.expectedOrdersValue,null);
  assert.deepEqual(report.tables.find(t=>t.id==='visits').rows.map(row=>row[0]),['2026-09-20']);
  assert.deepEqual(report.myDayTables.find(t=>t.id==='input-visits').rows.map(row=>row[2]),['2026-10-22','2026-09-20']);
  assert.equal(report.myDaySummary.visitsPlanned,2);
  assert.equal(report.myDaySummary.visitsCompleted,1);
  assert.equal(report.summary.actual,Math.round(sourceSnapshot.monthlyMetrics.filter(row=>row.period<='2026-09').reduce((sum,row)=>sum+row.achieved,0)*100000));
  if(existsSync(`${output}/baseline-data.json`)){
    const baseline=JSON.parse(readFileSync(`${output}/baseline-data.json`,'utf8'));
    assert.deepEqual(report.summary,baseline.summary,'visual redesign and cutoff fix must not alter financial calculations');
    assert.deepEqual(report.yearRows,baseline.yearRows);
  }
  assert.equal(db.prepare("SELECT COUNT(*) count FROM visits WHERE id='v3oct'").get().count,1,'future scheduled record remains untouched');
  db.prepare("INSERT INTO visits(id,user_id,business_date,tally_customer_id,scheduled_at,purpose,status,completed_at) VALUES('v3late','v3rep','2026-09-25','v3customer','2026-09-25T09:00:00Z','Late completion','completed','2026-10-02T10:00:00Z')").run();
  try {
    const historical=await (await call('/admin/team/raiskhan?'+new URLSearchParams(selection({reportType:'monthly',month:9})))).json();
    assert.equal(historical.kpi.visitsPlanned,2);assert.equal(historical.kpi.visitsCompleted,1);
    assert.equal(historical.comparison.to,'2026-08-31','source monthly comparison must identify the full month actually supplied');
    assert.equal(historical.tables.find(t=>t.id==='visits').rows.find(row=>row[2]==='Late completion')[3],'Completion at cutoff unverified');
  } finally {db.prepare("DELETE FROM visits WHERE id='v3late'").run();}
});

test('V3 executive layout, all responsive breakpoints, interactions, refresh and context PDFs', {skip:process.env.CRM_BROWSER_TEST!=='1',timeout:240000}, async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const controls={failNext:false,delayNext:false};
    const page=await browserPage(browser,{width:1440,height:900},controls);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://localhost:3000/admin/team/raiskhan?fy=2026-27');
    await page.getByRole('heading',{name:'Rais Khan',exact:true}).waitFor();
    await page.waitForFunction(()=>document.querySelectorAll('.rm-v2-kpis article').length===8);
    const audit=[];
    for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[390,844]]) {
      await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:`${output}/executive-${width}.png`,fullPage:true});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`viewport overflow at ${width}`);
      assert.equal(await page.locator('.rm-v2-kpis article').count(),8);
      const columns=await page.locator('.rm-v2-kpis').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
      assert.equal(columns,width>1100?4:2);
      assert.equal(await page.getByRole('button',{name:'Refresh data on this page',exact:true}).count(),1);
      assert.equal(await page.locator('.page-refresh-button').count(),0);
      assert.equal(await page.locator('.rm-v3-refresh-button').evaluate(el=>getComputedStyle(el).position),'static');
      const header=await page.locator('.rm-v2-identity').boundingBox();
      if(width>=1366)assert.ok(header.height<210,`header too tall: ${header.height}`);
      const pageHeight=await page.evaluate(()=>document.documentElement.scrollHeight);
      audit.push({width,height,pageHeight,headerHeight:header.height,kpiColumns:columns});
      if(width===1440){
        const baselineHeight=existsSync(`${output}/baseline-1440.png`)?readFileSync(`${output}/baseline-1440.png`).readUInt32BE(20):null;
        const savedInputsHeight=(await page.locator('.rm-inputs').boundingBox()).height;
        assert.ok(pageHeight-savedInputsHeight<3700,'report chrome stays compact independently of the number of saved entries');
        if(baselineHeight)assert.ok(pageHeight-savedInputsHeight<baselineHeight*.8,'financial report remains compact as live CRM inputs grow');
        assert.ok((await page.locator('.rm-v2-chart').boundingBox()).y<750,'chart should be visible near the first fold');
      }
    }
    writeFileSync(`${output}/responsive-audit.json`,JSON.stringify(audit,null,2));
    await page.setViewportSize({width:1440,height:900});
    assert.equal(await page.getByLabel('Month',{exact:true}).count(),0);assert.equal(await page.getByLabel('Week',{exact:true}).count(),0);
    assert.equal(await page.locator('.rm-v3-insight-card').count(),5);
    for(const card of await page.locator('.rm-v3-insight-card:not(.unavailable)').all())assert.equal(await card.locator('li').count(),2);
    assert.equal(await page.locator('.rm-v3-action-row').count(),5);
    assert.equal(await page.locator('.rm-v3-thrust').getByText('N/A',{exact:true}).count(),0);
    assert.doesNotMatch(await page.locator('.rm-v3').innerText(),/No reliable records available for this context/);
    await page.locator('.rm-v3-coverage summary').click();
    assert.match(await page.getByRole('region',{name:'Executive Territory Coverage',exact:true}).innerText(),/Chandigarh[\s\S]*Kundli[\s\S]*Sartaj Khan/);
    await page.locator('.rm-v3-coverage summary').click();
    const refresh=page.getByRole('button',{name:'Refresh data on this page',exact:true});await refresh.click();await page.waitForFunction(()=>!document.querySelector('.rm-v3-refresh-button')?.disabled);
    assert.match(await page.locator('.rm-v2-summary').innerText(),/53\.15 L/);
    controls.failNext=true;await refresh.click();await page.getByRole('alert').filter({hasText:'Synthetic refresh failure'}).waitFor();await page.waitForFunction(()=>!document.querySelector('.rm-v3-refresh-button')?.disabled);
    await refresh.click();await page.waitForFunction(()=>!document.querySelector('.rm-v3-refresh-button')?.disabled);assert.equal(await page.getByRole('alert').filter({hasText:'Synthetic refresh failure'}).count(),0);
    const monthly=page.locator('.rm-v2-month-chart');const original=(await monthly.boundingBox()).width;
    controls.delayNext=true;await refresh.click();await page.waitForTimeout(100);
    await monthly.locator('g[role=button]').filter({hasText:'Sep'}).click();await page.waitForFunction(()=>document.querySelector('.rm-v2-toolbar small')?.textContent.includes('September'));
    await page.waitForTimeout(1100);assert.match(await page.locator('.rm-v2-toolbar small').innerText(),/September/,'slow old-context refresh must not replace the selected report');
    await page.waitForTimeout(450);assert.ok((await monthly.boundingBox()).width<original*.6);
    assert.equal(await page.locator('.rm-v2-week-chart g[role=button]').count(),4);
    await page.screenshot({path:`${output}/expanded-month.png`,fullPage:true});
    await page.locator('.rm-v2-week-chart g[role=button]').nth(1).focus();assert.match(await page.locator('.rm-v2-tooltip').innerText(),/Target variation[\s\S]*Period growth/);
    await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.rm-v2-toolbar small')?.textContent.includes('Week 2'));
    await page.screenshot({path:`${output}/week-context.png`,fullPage:true});
    const sections=await page.locator('[data-report-section]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-report-section')));assert.deepEqual(sections.slice(-2),['insights','actions']);
    async function exportPdf(name){
      await page.getByRole('button',{name:'Download PDF',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();await page.locator('[data-pagination-ready=true]').waitFor();
      const count=await page.locator('[data-rm-report-page]').count();assert.ok(count>0);
      const overlap=await page.locator('[data-rm-report-page]').evaluateAll(pages=>pages.filter(p=>p.querySelector('.rm-v2-pdf-page-content').getBoundingClientRect().bottom>p.querySelector('footer').getBoundingClientRect().top-4).length);assert.equal(overlap,0);
      assert.doesNotMatch(await dialog.innerText(),/No reliable records available for this context/);
      assert.match(await dialog.innerText(),/Manager Action Review/);
      const download=page.waitForEvent('download',{timeout:60000});await dialog.getByRole('button',{name:'Download PDF',exact:true}).click();const file=await download;await file.saveAs(`${output}/${name}.pdf`);assert.ok(existsSync(`${output}/${name}.pdf`));
      await page.keyboard.press('Escape');return count;
    }
    const weekPages=await exportPdf('week');await page.getByRole('button',{name:'Back to month',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.rm-v2-toolbar small')?.textContent.includes('September')&&!document.querySelector('.rm-v2-toolbar small')?.textContent.includes('Week'));
    const monthPages=await exportPdf('month');await page.getByRole('button',{name:'Back to Full Year',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.rm-v2-summary')?.textContent.includes('53.15 L'));
    const yearPages=await exportPdf('year');writeFileSync(`${output}/pdf-audit.json`,JSON.stringify({yearPages,monthPages,weekPages},null,2));
    await page.goto('http://localhost:3000/admin/team/alicescope');await page.waitForFunction(()=>document.querySelector('.rm-v2-identity h1')?.textContent==='Alice Scope');
    const productPanel=page.locator('[data-report-section=products]');assert.equal(await productPanel.locator('tbody tr').count(),5);await productPanel.getByRole('button',{name:'Show all 24 records',exact:true}).click();assert.equal(await productPanel.locator('tbody tr').count(),24);
    await page.screenshot({path:`${output}/rich-data.png`,fullPage:true});
    await page.getByRole('button',{name:'Download PDF',exact:true}).click();await page.locator('[data-pagination-ready=true]').waitFor();const pdfText=(await page.locator('[data-rm-report-page]').allTextContents()).join(' ');for(let index=1;index<=24;index++)assert.ok(pdfText.includes(`Verified fixture product ${String(index).padStart(2,'0')}`),'PDF retains every product');await page.keyboard.press('Escape');
    await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await monthly.evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
});

test('baseline Rais Khan source-report screenshots', { skip: process.env.CRM_V3_BASELINE !== '1', timeout: 120000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browserPage(browser,{width:1440,height:900});
    await page.goto('http://localhost:3000/admin/team/raiskhan?fy=2026-27');
    await page.getByRole('heading',{name:'Rais Khan',exact:true}).waitFor();
    await page.locator('.rm-v2-summary').waitFor();
    for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[1024,768],[768,1024],[390,844]]) {
      await page.setViewportSize({width,height}); await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:`${output}/baseline-${width}.png`,fullPage:true});
    }
    const response = await call('/admin/team/raiskhan?' + new URLSearchParams(selection()));
    writeFileSync(`${output}/baseline-data.json`,JSON.stringify(await response.json(),null,2));
  } finally { await browser.close(); }
});

test('all saved My Day inputs retain fields, isolate RM scope, respect cutoff and export without clipping', {timeout:180000}, async () => {
  db.prepare("INSERT INTO tally_products(id,name) VALUES('input-product','Input Product')").run();
  db.prepare("UPDATE visits SET notes='Detailed discussion from RM',visit_tags='[\"technical_support\",\"sample\"]',priority='high',outcome='Quotation required' WHERE id='v3sep'").run();
  db.prepare("INSERT INTO visit_products(visit_id,tally_product_id) VALUES('v3sep','input-product')").run();
  db.prepare("INSERT INTO follow_ups(id,user_id,visit_id,tally_customer_id,title,due_date,follow_up_type,notes,completed,created_at) VALUES('input-followup','v3rep','v3sep','v3customer','Future review','2026-10-15','visit','Preparation notes',1,'2026-09-20T10:00:00Z')").run();
  db.prepare("INSERT INTO expected_orders(id,visit_id,user_id,tally_customer_id,tally_product_id,expected_value,expected_date,status,created_at) VALUES('input-order','v3sep','v3rep','v3customer','input-product',12345,'2026-10-16','won','2026-09-20T10:00:00Z')").run();
  db.prepare("INSERT INTO leads(id,user_id,name,company,phone,email,city,source,interested_product_id,expected_value,next_action_date,notes,created_at) VALUES('input-lead','v3rais','Input Prospect','Sample Company','1234567890','prospect@example.test','Delhi','Exhibition','input-product',67890,'2026-10-17','Lead background','2026-09-20T10:00:00Z')").run();
  db.prepare("INSERT INTO service_requests(id,user_id,tally_customer_id,lead_id,request_type,product_id,details,responsible_person,due_date,created_at) VALUES('input-request','v3rep','v3customer','input-lead','sample_request','input-product',?,'Service Executive','2026-10-18','2026-09-20T10:00:00Z')").run('Full request details '.repeat(110));
  db.prepare("INSERT INTO attendance(id,user_id,business_date,check_in_at,latitude,longitude) VALUES('input-attendance','v3rais','2026-09-20','2026-09-20T04:00:00Z',28.61,77.20)").run();
  db.prepare("INSERT INTO location_pings(id,user_id,latitude,longitude,accuracy,captured_at) VALUES('input-gps','v3rais',28.61,77.20,12,'2026-09-20T04:00:00Z')").run();
  db.prepare("INSERT INTO customer_activities(id,user_id,tally_customer_id,activity_type,subject,notes,occurred_at) VALUES('input-private','v3alice','v3alicecustomer','call_incoming','PRIVATE OTHER RM','Never disclose','2026-09-20T10:00:00Z'),('input-boundary','v3rais','v3customer','call_outgoing','After India cutoff','October entry','2026-09-30T19:00:00Z')").run();
  const report=await (await call('/admin/team/raiskhan?'+new URLSearchParams(selection()))).json();
  const input=id=>report.myDayTables.find(t=>t.id===`input-${id}`);
  const field=(id,column)=>(id==='visits'?input(id).rows.find(row=>row[2]==='2026-09-20'):input(id).rows[0])[input(id).columns.indexOf(column)];
  assert.equal(report.myDayTables.length,7);
  assert.equal(field('visits','Products discussed'),'Input Product');
  assert.equal(field('visits','Discussion notes'),'Detailed discussion from RM');
  assert.equal(field('visits','Visit tags'),'technical_support, sample');
  assert.equal(field('followups','Follow-up mode'),'visit');
  assert.equal(field('followups','Due date'),'2026-10-15','future scheduled action on an in-period entry is retained');
  assert.equal(field('followups','Recorded status'),'Completed','completed input is retained independently of open KPI');
  assert.equal(field('orders','Expected value'),12345);
  assert.equal(field('requests','Responsible person'),'Service Executive');
  assert.equal(field('leads','Phone'),'1234567890');
  assert.equal(field('attendance','GPS accuracy (m)'),12);
  assert.doesNotMatch(JSON.stringify(report.myDayTables),/PRIVATE OTHER RM/);
  const september=await (await call('/admin/team/raiskhan?'+new URLSearchParams(selection({reportType:'monthly',month:9})))).json();
  assert.doesNotMatch(JSON.stringify(september.myDayTables),/After India cutoff|October future visit/);
  assert.equal(report.kpi.followUpsOpen,null,'saved current status must not become a historical open KPI');
  const future=await (await call('/admin/team/raiskhan?'+new URLSearchParams(selection({financialYear:'2027-28'})))).json();
  assert.ok(future.myDayTables.every(t=>t.rows.length===0));
  if(process.env.CRM_BROWSER_TEST!=='1')return;
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browserPage(browser,{width:1440,height:900});
    await page.goto('http://localhost:3000/admin/team/raiskhan');
    const inputs=page.getByRole('region',{name:'RM My Day inputs',exact:true});
    await inputs.waitFor();
    await inputs.getByRole('button',{name:/Visits /}).click();
    assert.match(await inputs.innerText(),/Detailed discussion from RM|September review/);
    await inputs.getByRole('button',{name:/Service requests /}).click();
    assert.match(await inputs.innerText(),/Service Executive/);
    await inputs.getByLabel('Search saved entries').fill('no-match-value');
    assert.match(await inputs.innerText(),/No entries match/);
    await inputs.getByLabel('Search saved entries').fill('');
    await inputs.getByRole('button',{name:/All entries /}).click();
    await inputs.getByRole('button',{name:'Next entries',exact:true}).click();
    assert.match(await inputs.innerText(),/Showing 7/);
    for(const width of [1440,1024,768,390]) {
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await inputs.screenshot({path:`${output}/my-day-inputs-${width}.png`});
    }
    await page.setViewportSize({width:1440,height:900});
    await page.getByRole('button',{name:'Download PDF',exact:true}).click();
    await page.locator('[data-pagination-ready=true]').waitFor();
    const text=(await page.locator('[data-rm-report-page]').allTextContents()).join(' ');
    assert.match(text,/Preparation notes/);assert.match(text,/prospect@example.test/);assert.match(text,/Service Executive/);
    assert.equal(await page.locator('[data-rm-report-page]').evaluateAll(pages=>pages.filter(p=>p.querySelector('.rm-v2-pdf-page-content').getBoundingClientRect().bottom>p.querySelector('footer').getBoundingClientRect().top-4).length),0);
    await page.screenshot({path:`${output}/my-day-pdf-preview.png`});
  } finally {await browser.close();}
});

test('Rais Khan has seven complete fictional examples per category with labeled reversible preview', {timeout:180000}, async () => {
  const {raisKhanMyDayDemo}=await import('../shared/rais-khan-my-day-demo.mjs');
  const report=await (await call('/admin/team/raiskhan?'+new URLSearchParams(selection()))).json();
  const before=JSON.stringify(report);
  const tables=raisKhanMyDayDemo(report);
  assert.equal(tables.length,7);
  for(const table of tables){
    assert.equal(table.rows.length,7);
    for(const row of table.rows){assert.equal(row.length,table.columns.length);assert.ok(row.every(v=>v!==null&&v!==''));}
  }
  assert.equal(JSON.stringify(report),before,'preview never mutates actual report');
  assert.equal(raisKhanMyDayDemo({...report,id:'alicescope'}),null);
  assert.equal(raisKhanMyDayDemo({...report,future:true}),null);
  assert.doesNotMatch(JSON.stringify(report.myDayTables),/Demo · Sutlej/);
  if(process.env.CRM_BROWSER_TEST!=='1')return;
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browserPage(browser,{width:1440,height:900},{demo:true});
    await page.goto('http://localhost:3000/admin/team/raiskhan');
    const inputs=page.getByRole('region',{name:'RM My Day inputs',exact:true});
    await inputs.getByRole('button',{name:'Show demo entries',exact:true}).click();
    await inputs.getByText('DEMO PREVIEW · Rais Khan',{exact:true}).waitFor();
    assert.match(await inputs.innerText(),/49 demo records/);
    for(const table of tables){
      await inputs.getByRole('button',{name:`${table.title} 7`,exact:true}).click();
      assert.equal(await inputs.locator('.rm-input-record').count(),7);
      assert.doesNotMatch(await inputs.locator('.rm-input-records').innerText(),/Not recorded/);
    }
    await inputs.getByRole('button',{name:'Visits 7',exact:true}).click();
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await inputs.screenshot({path:`${output}/rais-seven-demo-${width}.png`});
    }
    await page.setViewportSize({width:1440,height:900});
    await page.getByRole('button',{name:'Download PDF',exact:true}).click();
    await page.locator('[data-pagination-ready=true]').waitFor({timeout:60000});
    const text=(await page.locator('[data-rm-report-page]').allTextContents()).join(' ');
    assert.match(text,/DEMO INPUTS/);assert.match(text,/49 fictional examples/);assert.match(text,/Demo Prospect 7/);
    assert.equal(await page.locator('[data-rm-report-page]').evaluateAll(pages=>pages.filter(p=>p.querySelector('.rm-v2-pdf-page-content').getBoundingClientRect().bottom>p.querySelector('footer').getBoundingClientRect().top-4).length),0);
    await page.keyboard.press('Escape');
    await inputs.getByRole('button',{name:'Show actual entries',exact:true}).click();
    assert.doesNotMatch(await inputs.innerText(),/49 demo records|Demo · Sutlej/);
    await page.reload();await inputs.getByRole('button',{name:'Show demo entries',exact:true}).waitFor();
    await page.goto('http://localhost:3000/admin/team/alicescope');
    await page.getByRole('heading',{name:'Alice Scope',exact:true}).waitFor();
    assert.equal(await page.locator('.rm-input-demo-banner').count(),0);
  }finally{await browser.close();}
});

test('RM manual save appears in admin with old sales snapshot and automatic refresh', {timeout:120000}, async () => {
  const path='/admin/team/raiskhan?'+new URLSearchParams(selection());
  const before=await (await call(path)).json();
  const rmResponse=await fetch(base+'/rm/period-report?'+new URLSearchParams(selection()),{headers:{Authorization:`Bearer ${rmToken}`}});
  assert.equal(rmResponse.status,200);
  const own=await rmResponse.json();
  assert.deepEqual(own.myDayTables,before.myDayTables,'RM and admin resolve the same saved entries');
  let browser,page,inputs;
  if(process.env.CRM_BROWSER_TEST==='1'){
    browser=await chromium.launch({headless:true});
    page=await browserPage(browser,{width:1440,height:900},{demo:true});
    await page.goto('http://localhost:3000/admin/team/raiskhan');
    inputs=page.getByRole('region',{name:'RM My Day inputs',exact:true});
    await inputs.getByRole('button',{name:'Show demo entries',exact:true}).waitFor();
    assert.doesNotMatch(await inputs.innerText(),/49 demo records/,'legacy demo preference cannot hide actual records');
    await inputs.getByRole('button',{name:/^Leads /}).click();
    await inputs.getByLabel('Search saved entries').fill('Manual save sync regression');
  }
  try{
    const saved=await fetch(base+'/sales/leads',{method:'POST',headers:{Authorization:`Bearer ${rmToken}`,'Content-Type':'application/json'},body:JSON.stringify({name:'Manual save sync regression',company:'Isolated CRM sync fixture',notes:'Manually saved after the September sales snapshot',expectedValue:82000})});
    assert.equal(saved.status,201);
    const after=await (await call(path)).json();
    assert.equal(after.asOf,'2026-09-30');
    assert.ok(after.myDayRange.to>'2026-09-30');
    assert.deepEqual(after.summary,before.summary,'manual operational inputs cannot alter financial actuals');
    assert.match(JSON.stringify(after.myDayTables),/Manual save sync regression/);
    const historical=await (await call('/admin/team/raiskhan?'+new URLSearchParams(selection({reportType:'monthly',month:9})))).json();
    assert.doesNotMatch(JSON.stringify(historical.myDayTables),/Manual save sync regression/);
    const other=await (await call('/admin/team/alicescope?'+new URLSearchParams(selection()))).json();
    assert.doesNotMatch(JSON.stringify(other.myDayTables),/Manual save sync regression/);
    if(page){
      await inputs.getByRole('heading',{name:'Manual save sync regression',exact:true}).waitFor({timeout:30000});
      assert.match(await inputs.innerText(),/Manually saved after the September sales snapshot/);
      assert.match(await page.locator('.rm-input-live-banner').innerText(),/Financial source through 30-09-2026/);
      await page.screenshot({path:`${output}/manual-save-admin-sync.png`,fullPage:true});
      await page.getByRole('button',{name:'Download PDF',exact:true}).click();
      await page.locator('[data-pagination-ready=true]').waitFor();
      const text=(await page.locator('[data-rm-report-page]').allTextContents()).join(' ');
      assert.match(text,/Manual save sync regression/);assert.doesNotMatch(text,/DEMO INPUTS/);
      assert.equal(await page.locator('[data-rm-report-page]').evaluateAll(pages=>pages.filter(p=>p.querySelector('.rm-v2-pdf-page-content').getBoundingClientRect().bottom>p.querySelector('footer').getBoundingClientRect().top-4).length),0);
    }
  }finally{await browser?.close();}
});

test('salesperson selector scopes every report projection and PDF to a verified subordinate', {timeout:180000}, async()=>{
  db.prepare("INSERT INTO users(id,email,password_hash,role) VALUES('scope-second','scope-second@example.test','fixture','salesperson'),('scope-inactive','scope-inactive@example.test','fixture','salesperson')").run();
  db.prepare("UPDATE users SET active=0 WHERE id='scope-inactive'").run();
  db.prepare("INSERT INTO salesperson_profiles(user_id,employee_code,full_name,region,territory,manager_user_id,monthly_target) VALUES('scope-second','scope-second','Second Executive','North','Delhi','v3rais',99),('scope-inactive','scope-inactive','Inactive Executive','North','Delhi','v3rais',99)").run();
  db.prepare("INSERT INTO tally_customers(id,name,rm_name,owner_user_id) VALUES('scope-other-customer','Other executive private customer','Rais Khan','scope-second')").run();
  for(const [id,customer,value,type,product] of [['scope-first-sale','v3customer',88000,'Sales','Selected executive product'],['scope-first-return','v3customer',1000,'Credit Note','Selected executive product'],['scope-second-sale','scope-other-customer',222000,'Sales','Other executive private product']]){
    db.prepare('INSERT INTO tally_invoices(id,company_name,voucher_type,invoice_date,customer_id,customer_name,amount,voucher_number) VALUES(?,?,?,?,?,?,?,?)').run(id,'Scope fixture',type,'2026-09-20',customer,customer,value,id);
    db.prepare('INSERT INTO tally_invoice_lines(id,invoice_id,product_name,quantity,amount) VALUES(?,?,?,?,?)').run(`${id}-line`,id,product,1,value);
  }
  db.prepare("INSERT INTO leads(id,user_id,name,notes,created_at) VALUES('scope-other-lead','scope-second','Other executive private lead','Do not mix with the first executive','2026-09-20T09:00:00Z')").run();
  const path=(id,extra={})=>'/admin/team/raiskhan?'+new URLSearchParams(selection({salespersonId:id,...extra}));
  const selected=await (await call(path('v3rep'))).json();
  assert.equal(selected.name,'Verified Executive');assert.equal(selected.selectedSalespersonId,'v3rep');
  assert.deepEqual(selected.salespeople.map(p=>p.id).sort(),['scope-second','v3rep']);
  assert.equal(selected.manager.name,'Rais Khan');
  assert.equal(selected.source,'Tally net invoices');assert.equal(selected.sourceAsOf,null);
  assert.equal(selected.summary.actual,87000,'only selected owned invoices and signed credit notes');
  assert.equal(selected.summary.target,null,'never inherit RM targets or ambiguous profile target units');
  assert.equal(selected.annualTarget,null);assert.equal(selected.executiveTerritoryCoverage,null);
  assert.equal(selected.yearRows.find(row=>row.month===9).actual,87000);
  assert.doesNotMatch(JSON.stringify([selected.tables,selected.myDayTables,selected.narratives]),/Other executive private|Manual save sync regression/);
  assert.equal(selected.myDayTables.find(t=>t.id==='input-leads').rows.length,0,'RM-owned leads are not selected salesperson leads');
  const second=await (await call(path('scope-second'))).json();assert.equal(second.summary.actual,222000);
  assert.match(JSON.stringify(second.myDayTables),/Other executive private lead/);
  for(const id of ['v3alice','scope-inactive','missing'])assert.equal((await call(path(id))).status,403);
  const rmOwn=await fetch(base+'/rm/period-report?'+new URLSearchParams(selection({salespersonId:'v3rep'})),{headers:{Authorization:`Bearer ${rmToken}`}});
  assert.equal(rmOwn.status,200);assert.deepEqual((await rmOwn.json()).myDayTables,selected.myDayTables);
  const denied=await fetch(base+'/rm/period-report?'+new URLSearchParams(selection({salespersonId:'v3alice'})),{headers:{Authorization:`Bearer ${rmToken}`}});assert.equal(denied.status,403);
  assert.equal((await (await call(path('v3rep',{reportType:'monthly',month:9}))).json()).summary.actual,87000);
  if(process.env.CRM_BROWSER_TEST!=='1')return;
  const browser=await chromium.launch({headless:true});
  try{
    const controls={delayNext:false};
    const page=await browserPage(browser,{width:1440,height:900},controls);
    page.on('pageerror',error=>console.error('Salesperson browser error:',error.message));
    await page.goto('http://localhost:3000/admin/team/raiskhan');
    const picker=page.getByLabel('Salesperson',{exact:true});
    try{await picker.waitFor({timeout:10000});}catch(error){console.error((await page.locator('body').innerText()).slice(0,2200));await page.screenshot({path:`${output}/salesperson-selector-error.png`});throw error;}
    assert.equal(await page.getByLabel('Regional manager',{exact:true}).count(),0);
    await page.waitForFunction(()=>document.querySelector('select[aria-label=Salesperson]')?.options.length===3);
    controls.delayNext=true;
    await picker.selectOption('v3rep');await picker.selectOption('scope-second');
    await page.getByRole('heading',{name:'Second Executive',exact:true}).waitFor();
    await page.waitForTimeout(1200);assert.equal(await picker.inputValue(),'scope-second');
    assert.match(await page.locator('.rm-v2-summary').innerText(),/2\.22 L/);
    await picker.selectOption('v3rep');await page.getByRole('heading',{name:'Verified Executive',exact:true}).waitFor();
    assert.match(await page.locator('.rm-v2-summary').innerText(),/87,000/);
    assert.doesNotMatch(await page.locator('.rm-v3-period-content').allTextContents().then(items=>items.join(' ')),/Other executive private/);
    await page.locator('.rm-v2-month-chart g[role=button]').filter({hasText:'Sep'}).click();
    await page.waitForFunction(()=>document.querySelector('.rm-v2-toolbar small')?.textContent.includes('September'));
    assert.equal(await picker.inputValue(),'v3rep');assert.match(await page.locator('.rm-v2-summary').innerText(),/87,000/);
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:`${output}/selected-salesperson-${width}.png`,fullPage:true});
    }
    await page.setViewportSize({width:1440,height:900});
    await page.getByRole('button',{name:'Download PDF',exact:true}).click();await page.locator('[data-pagination-ready=true]').waitFor();
    const text=(await page.locator('[data-rm-report-page]').allTextContents()).join(' ');
    assert.match(text,/Verified Executive/);assert.match(text,/Selected executive product/);assert.doesNotMatch(text,/Other executive private|Demo · Sutlej/);
    assert.equal(await page.locator('[data-rm-report-page]').evaluateAll(pages=>pages.filter(p=>p.querySelector('.rm-v2-pdf-page-content').getBoundingClientRect().bottom>p.querySelector('footer').getBoundingClientRect().top-4).length),0);
    await page.keyboard.press('Escape');await picker.selectOption('');await page.getByRole('heading',{name:'Rais Khan',exact:true}).waitFor();
    await page.goto('http://localhost:3000/admin/team/alicescope');
    await page.getByRole('heading',{name:'Alice Scope',exact:true}).waitFor();assert.equal(await picker.isDisabled(),true);
    assert.match(await picker.innerText(),/No salespeople assigned/);
  }finally{await browser.close();}
});
