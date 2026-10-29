import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import express from 'express';
import { chromium } from '@playwright/test';
import { attendanceMonths } from '../shared/rm-attendance.mjs';
import { reportThrustYtd } from '../server/rm-report-v4.mjs';

const scratch=mkdtempSync(join(tmpdir(),'psspl-v4-'));
process.env.NODE_ENV='test';process.env.CRM_TEST_DATABASE_ROOT=scratch;process.env.CRM_DATABASE_PATH=join(scratch,'fixture.sqlite');process.env.CRM_DISABLE_BASELINE_RESTORE='true';
let db,server,base,adminToken,rmToken,repToken;
const output='scratch/rm-v4';
const selection=(extra={})=>({reportVersion:'2',reportType:'yearly',financialYear:'2026-27',weekScheme:'four',...extra});
const call=(path,token=adminToken)=>fetch(base+path,{headers:token?{Authorization:`Bearer ${token}`}:{}});
const report=(extra={},token=adminToken,route='/admin/team/raiskhan')=>call(route+'?'+new URLSearchParams(selection(extra)),token);

before(async()=>{
  ({db}=await import('../server/db.mjs'));assert.equal(resolve(db.prepare('PRAGMA database_list').get().file),resolve(process.env.CRM_DATABASE_PATH));
  const {createSession}=await import('../server/auth.mjs');
  for(const [id,role,name,manager] of [['v4admin','admin','V4 QA',null],['v4rais','rm','Rais Khan',null],['v4rep','salesperson','Assigned Salesperson','v4rais'],['v4alice','rm','Alice Scope',null]]){
    db.prepare('INSERT INTO users(id,email,password_hash,role) VALUES(?,?,?,?)').run(id,id+'@example.test','fixture',role);
    db.prepare('INSERT INTO salesperson_profiles(user_id,employee_code,full_name,region,territory,manager_user_id) VALUES(?,?,?,?,?,?)').run(id,id,name,'North','Fixture',manager);
  }
  adminToken=createSession('v4admin').token;rmToken=createSession('v4rais').token;repToken=createSession('v4rep').token;
  db.prepare("INSERT INTO tally_customers(id,name,rm_name,owner_user_id) VALUES('v4customer','RM customer','Rais Khan','v4rais'),('v4other','Other customer','Alice Scope','v4alice')").run();
  db.exec('DELETE FROM thrust_products');
  for(let i=0;i<19;i++)db.prepare('INSERT INTO thrust_products(id,name,alias_keywords,sort_order) VALUES(?,?,?,?)').run('v4product-'+i,i===0?'Configured Brightener':i===1?'Configured Return':`Configured Product ${i+1}`,i===0?'%Brightener%':i===1?'%Returned product%':`%Never matched ${i}%`,i);
  const invoice=(id,date,type,amount,customer,product,source=null,company='Fixture PSSPL')=>{
    db.prepare('INSERT INTO tally_invoices(id,company_name,voucher_type,invoice_date,customer_id,customer_name,amount,voucher_number,source_sync_id) VALUES(?,?,?,?,?,?,?,?,?)').run(id,company,type,date,customer,customer,amount,id,source);
    if(product)db.prepare('INSERT INTO tally_invoice_lines(id,invoice_id,product_name,quantity,amount) VALUES(?,?,?,?,?)').run('line-'+id,id,product,1,amount);
  };
  invoice('v4apr','2026-04-10','Sales',100000,'v4customer','Brightener');invoice('v4sep','2026-09-10','Sales',200000,'v4customer','Brightener');invoice('v4credit','2026-09-11','Credit Note',50000,'v4customer','Brightener');invoice('v4return','2026-09-11','Sales Return',50000,'v4customer','Returned product');invoice('v4company','2026-09-10','Sales',800000,'v4other','Brightener');invoice('v4excluded','2026-09-10','Sales',999999,'v4customer','Brightener','excel-import');
  for(const [id,user,date,begin,end] of [
    ['v4present','v4rais','2026-09-01','2026-09-01T03:30:00Z','2026-09-01T11:30:00Z'],
    ['v4sunday','v4rais','2026-09-13','2026-09-13T03:30:00Z','2026-09-13T06:30:00Z'],
    ['v4incomplete','v4rais','2026-09-14','2026-09-14T03:30:00Z',null],
    ['v4rollover','v4rais','2026-09-15','2026-09-14T20:00:00Z','2026-09-15T04:00:00Z'],
    ['v4overnight','v4rais','2026-09-20','2026-09-20T17:30:00Z','2026-09-21T01:30:00Z'],
    ['v4team','v4rep','2026-09-02','2026-09-02T03:30:00Z','2026-09-02T11:30:00Z'],
    ['v4private','v4alice','2026-09-03','2026-09-03T04:30:00Z','2026-09-03T12:30:00Z'],
  ])db.prepare('INSERT INTO attendance(id,user_id,business_date,check_in_at,check_out_at) VALUES(?,?,?,?,?)').run(id,user,date,begin,end);
  const {adminRouter}=await import('../server/admin.mjs');const {rmRouter}=await import('../server/rm-routes.mjs');
  const app=express();app.use(express.json());app.use('/admin',adminRouter);app.use('/rm',rmRouter);app.use((err,req,res,next)=>res.status(500).json({error:err.message}));
  server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}`;mkdirSync(output,{recursive:true});
});
after(async()=>{if(server)await new Promise(r=>server.close(r));db?.close();assert.ok(resolve(scratch).startsWith(resolve(tmpdir())));rmSync(scratch,{recursive:true,force:true});});

test('calendar has real weekdays, 28/29/30/31 dates, policy-safe absences and future/unknown states',()=>{
  for(const [fy,key,length] of [['2026-27','2026-09',30],['2026-27','2026-10',31],['2026-27','2027-02',28],['2023-24','2024-02',29]]){
    const month=attendanceMonths({financialYear:fy,cutoff:'2030-01-01',today:'2030-01-02'}).find(m=>m.key===key);assert.equal(month.days.length,length);assert.equal(month.days.slice(21).length,length-21);
    for(const day of month.days){assert.equal(day.weekday,new Date(day.date+'T00:00:00Z').getUTCDay());assert.equal(day.status,day.weekday===0?'holiday':'unverified');}
    assert.equal(month.summary.attendancePercent,null);assert.equal(month.summary.absent,null);
  }
  const policy={weeklyHolidays:[0],absenceVerified:true,employmentFrom:'2026-09-01',coverageFrom:'2026-09-01',coverageTo:'2026-09-30'};
  const rows=[{id:'a',business_date:'2026-09-01',check_in_at:'2026-09-01 03:30:00',check_out_at:'2026-09-01 11:30:00'},{id:'bad',business_date:'2026-09-03',check_in_at:'bad',check_out_at:null}];
  const month=attendanceMonths({financialYear:'2026-27',cutoff:'2026-09-16',today:'2026-09-17',policy,rows}).find(m=>m.key==='2026-09');
  assert.equal(month.days[0].status,'present');assert.equal(month.days[1].status,'absent');assert.equal(month.days[2].status,'unverified');assert.equal(month.days[5].status,'holiday');assert.equal(month.days[16].status,'upcoming');assert.equal(month.summary.attendancePercent,null,'invalid record must not produce an asserted attendance denominator');
  const clean=attendanceMonths({financialYear:'2026-27',cutoff:'2026-09-16',today:'2026-09-17',policy,rows:rows.slice(0,1)}).find(m=>m.key==='2026-09');assert.equal(clean.summary.eligibleWorkingDays,14);assert.equal(clean.summary.absent,13);assert.ok(Math.abs(clean.summary.attendancePercent-100/14)<1e-10);
  const unavailable=attendanceMonths({financialYear:'2026-27',cutoff:'2026-09-16',today:'2026-09-17',available:false,policy,rows}).find(m=>m.key==='2026-09');assert.equal(unavailable.days[0].status,'unverified');assert.equal(unavailable.summary.attendancePercent,null);
});

test('sessions preserve missing clock-out, overnight hours, India rollover, breaks and overlapping intervals',()=>{
  const row=(id,begin,end,date='2026-09-01')=>({id,business_date:date,check_in_at:begin,check_out_at:end});
  const first=row('a','2026-09-01T03:30:00Z','2026-09-01T06:30:00Z');
  const rows=[first,first,row('b','2026-09-01T07:30:00Z','2026-09-01T11:30:00Z'),row('overlap','2026-09-01T08:30:00Z','2026-09-01T10:30:00Z'),row('open','2026-09-02T04:00:00Z',null,'2026-09-02'),row('night','2026-09-13T17:30:00Z','2026-09-14T01:30:00Z','2026-09-13'),row('india','2026-09-14T20:00:00Z','2026-09-15T04:00:00Z','2026-09-15')];
  const month=attendanceMonths({financialYear:'2026-27',cutoff:'2026-09-30',today:'2026-10-01',rows}).find(m=>m.key==='2026-09');assert.equal(month.days[0].workedMinutes,420);assert.equal(month.days[0].sessions.length,3);assert.equal(month.days[1].incompleteCount,1);assert.equal(month.days[1].workedMinutes,null);assert.equal(month.days[12].workedHoliday,true);assert.equal(month.days[12].workedMinutes,480);assert.equal(month.days[14].workedMinutes,480);assert.equal(month.summary.attendancePercent,null);
});

test('authenticated API isolates RM attendance, salesperson scope, YTD signed sales and company denominator',async()=>{
  const snapshotBefore=db.prepare('SELECT * FROM attendance ORDER BY id').all();
  const response=await report();assert.equal(response.status,200);const data=await response.json();
  const month=data.attendance.months.find(m=>m.key==='2026-09');assert.equal(month.summary.present,5);assert.equal(month.days[1].status,'unverified');assert.equal(month.days[2].status,'unverified');assert.equal(month.days[12].workedHoliday,true);assert.equal(month.summary.workedMinutes,1620);assert.equal(month.summary.absent,null);assert.equal(data.attendance.subject.code,'033705');assert.doesNotMatch(JSON.stringify(data.attendance),/latitude|longitude|password|v4private/);
  assert.equal(data.thrustYtd.products.length,19);assert.equal(new Set(data.thrustYtd.products.map(p=>p.id)).size,19);assert.equal(data.thrustYtd.products[0].sales,250000);assert.equal(data.thrustYtd.products[0].companyContributionPercent,25);assert.equal(data.thrustYtd.products[1].sales,-50000);assert.equal(data.thrustYtd.products[1].companyContributionPercent,-5);assert.equal(data.thrustYtd.products[2].sales,0);assert.equal(data.thrustYtd.products[2].companyContributionPercent,0);assert.equal(data.thrustYtd.companyNetSales,1000000);assert.equal(data.thrustYtd.from,'2026-04-01');
  const week=await (await report({reportType:'weekly',month:9,week:2})).json();assert.equal(week.thrustYtd.from,'2026-04-01');assert.equal(week.thrustYtd.to,'2026-09-14');assert.equal(week.thrustYtd.products[0].sales,250000);
  const own=await (await report({},rmToken,'/rm/period-report')).json();assert.deepEqual(own.attendance,data.attendance);assert.equal(own.thrustYtd.companyNetSales,null);assert.equal(own.thrustYtd.products[0].companyContributionPercent,25);
  const person=await (await report({salespersonId:'v4rep'})).json();assert.equal(person.attendance.subject.name,'Assigned Salesperson');assert.equal(person.attendance.months.find(m=>m.key==='2026-09').summary.present,1);assert.equal(person.thrustYtd.products[0].sales,null);
  assert.equal((await report({salespersonId:'v4alice'},rmToken,'/rm/period-report')).status,403);assert.equal((await report({},repToken)).status,403);assert.equal((await report({},null)).status,401);
  assert.deepEqual(db.prepare('SELECT * FROM attendance ORDER BY id').all(),snapshotBefore,'report reads must not mutate attendance');
});

test('product missing/zero denominator, missing lines and multiple-company scope never fabricate contribution',()=>{
  const get=()=>reportThrustYtd(db,{ids:['v4rais'],from:'2026-04-01',to:'2026-09-30',available:true,discloseCompanyTotal:true,thrust:()=>({products:[{id:'p',name:'Configured Brightener',salesRupees:250000}]})});
  db.exec('SAVEPOINT v4_product');try{db.prepare("UPDATE tally_invoices SET amount=0 WHERE source_sync_id IS NULL").run();assert.equal(get().products[0].companyContributionPercent,null);assert.equal(get().companyNetSales,0);db.prepare("UPDATE tally_invoices SET company_name='Other company' WHERE id='v4company'").run();assert.equal(get().products[0].sales,null);}finally{db.exec('ROLLBACK TO v4_product; RELEASE v4_product');}
  db.exec('SAVEPOINT v4_lines');try{db.prepare("DELETE FROM tally_invoice_lines WHERE invoice_id='v4apr'").run();assert.equal(get().products[0].sales,null);}finally{db.exec('ROLLBACK TO v4_lines; RELEASE v4_lines');}
  db.exec('SAVEPOINT v4_missing_amount');try{db.prepare("UPDATE tally_invoice_lines SET amount='unverified' WHERE invoice_id='v4apr'").run();assert.equal(get().products[0].sales,null);}finally{db.exec('ROLLBACK TO v4_missing_amount; RELEASE v4_missing_amount');}
  db.exec('SAVEPOINT v4_missing_company_amount');try{db.prepare("UPDATE tally_invoices SET amount='unverified' WHERE id='v4company'").run();assert.equal(get().products[0].sales,250000);assert.equal(get().companyNetSales,null);assert.equal(get().products[0].companyContributionPercent,null);}finally{db.exec('ROLLBACK TO v4_missing_company_amount; RELEASE v4_missing_company_amount');}
  const missing=reportThrustYtd(db,{ids:['v4rais'],from:'2025-04-01',to:'2025-09-30',available:true,thrust:()=>({products:[{id:'p',name:'Configured Brightener',salesRupees:0}]})});assert.equal(missing.products[0].sales,null);assert.equal(missing.products[0].companyContributionPercent,null);
});

test('actual browser: compact attendance, chart sync, independent navigation, detail sheet, responsive grid and PDF', {skip:process.env.CRM_BROWSER_TEST!=='1',timeout:240000},async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(token=>localStorage.setItem('psspl_crm_session',token),adminToken);
    let requestCount=0;
    await page.route('**/api/**',async route=>{const url=new URL(route.request().url()),path=url.pathname.replace(/^\/api/,'');if(path==='/auth/me')return route.fulfill({json:{user:{id:'v4admin',email:'v4admin@example.test',role:'admin'}}});requestCount++;const response=await call(path+url.search);await route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});});
    await page.goto('http://localhost:3000/admin/team/raiskhan?fy=2026-27');await page.locator('[data-report-section=attendance]').waitFor();
    const attendance=page.locator('[data-report-section=attendance]');const thrust=page.locator('[data-report-section=thrust]');
    assert.equal(await page.getByText('Data availability & reporting scope',{exact:false}).count(),0);assert.equal(await page.locator('.rm-v2-limitations').count(),0);
    await page.locator('.rm-v2-month-chart g[role=button]').filter({hasText:'Sep'}).click();await page.waitForFunction(()=>document.querySelector('.rm-v2-toolbar small')?.textContent.includes('September'));assert.match(await attendance.locator('h2').first().innerText(),/September 2026/);assert.equal(await attendance.locator('.rm-v4-attendance-day').count(),30);assert.equal(await attendance.locator('[data-date="2026-09-01"]').getAttribute('data-status'),'present');assert.equal(await attendance.locator('[data-date="2026-09-06"]').getAttribute('data-status'),'holiday');assert.equal(await attendance.locator('[data-date="2026-09-02"]').getAttribute('data-status'),'unverified');
    await page.locator('.rm-v2-week-chart g[role=button]').nth(1).click();await page.waitForFunction(()=>document.querySelector('.rm-v2-toolbar small')?.textContent.includes('Week 2'));assert.match(await attendance.locator('.rm-v4-attendance-week.selected').innerText(),/Week 2/i);
    const count=requestCount;await page.getByRole('button',{name:'Next attendance month'}).click();assert.match(await attendance.locator('h2').first().innerText(),/October 2026/);assert.match(await page.locator('.rm-v2-toolbar small').innerText(),/Week 2/i);assert.equal(requestCount,count,'local attendance navigation must reuse the FY payload');await page.getByRole('button',{name:'Previous attendance month'}).click();
    await page.getByRole('button',{name:'View Detailed Attendance',exact:true}).click();const dialog=page.locator('.rm-v4-attendance-dialog');await dialog.waitFor({state:'visible'});assert.match(await dialog.innerText(),/Rais Khan|033705/);assert.match(await dialog.innerText(),/Incomplete — clock-out not recorded/);assert.match(await dialog.innerText(),/Worked on holiday/);assert.match(await dialog.innerText(),/8h 0m/);assert.equal(await dialog.locator('tbody tr').count(),30);await dialog.screenshot({path:`${output}/attendance-details-desktop.png`});await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);
    const audit=[];
    for(const [width,columns,blocks] of [[1440,3,4],[1024,2,2],[390,1,2]]){
      await page.setViewportSize({width,height:1000});await attendance.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await thrust.locator('.rm-v4-thrust-grid > article').count(),21);assert.equal(await thrust.getByText('Demo Data · Client Snapshot 30 Sep 2026',{exact:true}).count(),2);assert.equal(await thrust.locator('.rm-v4-thrust-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),columns);assert.equal(await attendance.locator('.rm-v4-attendance-weeks').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),blocks);await page.evaluate(()=>window.scrollBy(0,-110));await attendance.screenshot({path:`${output}/attendance-${width}.png`});await thrust.scrollIntoViewIfNeeded();await page.evaluate(()=>window.scrollBy(0,-110));await thrust.screenshot({path:`${output}/thrust-${width}.png`});audit.push({width,columns,blocks,attendanceHeight:(await attendance.boundingBox()).height});
    }
    await page.getByRole('button',{name:'View Detailed Attendance',exact:true}).click();await dialog.screenshot({path:`${output}/attendance-details-mobile.png`});await page.keyboard.press('Escape');
    await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'Download PDF',exact:true}).click();await page.locator('[data-pagination-ready=true]').waitFor();const pdf=page.locator('[data-rm-report-page]');const text=(await pdf.allTextContents()).join(' ');assert.match(text,/Thrust Products — YTD Performance/);assert.match(text,/Company Contribution: 25.00%/);assert.match(text,/YTD Sales: ₹2.50 L/);assert.match(text,/RM Attendance — September 2026/);assert.doesNotMatch(text,/Data availability|Source & scope limitations|Unversioned historical/);assert.equal(await pdf.evaluateAll(pages=>pages.filter(p=>p.querySelector('.rm-v2-pdf-page-content').getBoundingClientRect().bottom>p.querySelector('footer').getBoundingClientRect().top-4).length),0);await pdf.first().screenshot({path:`${output}/pdf-first-page.png`});
    const download=page.waitForEvent('download',{timeout:90000});await page.getByRole('dialog',{name:/report/i}).getByRole('button',{name:'Download PDF',exact:true}).click();const file=await download;await file.saveAs(`${output}/rm-v4.pdf`);await page.keyboard.press('Escape');
    await page.getByLabel('Salesperson',{exact:true}).selectOption('v4rep');await page.getByRole('heading',{name:'Assigned Salesperson',exact:true}).waitFor();assert.match(await attendance.locator('h2').first().innerText(),/Salesperson Attendance/);
    await page.getByLabel('Financial Year',{exact:true}).selectOption('2025-26');await page.waitForFunction(()=>document.querySelector('.rm-v2-toolbar small')?.textContent.includes('2025-26'));assert.match(await attendance.locator('h2').first().innerText(),/March 2026/);
    await page.goto('http://localhost:3000/admin/team/alicescope');await page.getByRole('heading',{name:'Alice Scope',exact:true}).waitFor();assert.match(await attendance.innerText(),/Alice Scope/);assert.doesNotMatch(await attendance.innerText(),/033705/);
    assert.deepEqual(errors,[]);writeFileSync(`${output}/audit.json`,JSON.stringify(audit,null,2));
  }finally{await browser.close();}
});
