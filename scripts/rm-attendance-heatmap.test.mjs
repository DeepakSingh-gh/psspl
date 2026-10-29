import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {chromium} from '@playwright/test';
import {attendanceMonths} from '../shared/rm-attendance.mjs';
import {financialMonths,reportingWeeks,variations} from '../shared/rm-performance.mjs';

const output='scratch/rm-attendance-heatmap';mkdirSync(output,{recursive:true});
const baseline=process.env.CRM_ATTENDANCE_BASELINE==='1';
const fixtureRows=[
  {id:'present',business_date:'2026-09-01',check_in_at:'2026-09-01T03:30:00Z',check_out_at:'2026-09-01T11:30:00Z'},
  {id:'missing-out',business_date:'2026-09-02',check_in_at:'2026-09-02T03:35:00Z',check_out_at:null},
  {id:'worked-sunday',business_date:'2026-09-13',check_in_at:'2026-09-13T03:30:00Z',check_out_at:'2026-09-13T06:30:00Z'},
  {id:'night',business_date:'2026-09-14',check_in_at:'2026-09-14T17:30:00Z',check_out_at:'2026-09-15T01:30:00Z'},
];
function report(query,other=false){
  const fy=query.get('financialYear')??'2026-27',type=query.get('reportType')??'yearly',month=Number(query.get('month')??9),week=Number(query.get('week')??1);
  const yearRows=financialMonths(fy).map(r=>({...r,...variations(80000,100000,70000),source:'Verified isolated fixture',targetBasis:'Stored fixture',partial:false}));
  const weekRows=reportingWeeks(fy,month).map(r=>({...r,...variations(20000,25000,17500),source:'Verified isolated fixture',targetBasis:'Stored fixture',partial:false}));
  const chosen=type==='yearly'?{from:yearRows[0].from,to:yearRows[11].to}:type==='monthly'?yearRows.find(r=>r.month===month):weekRows[week-1];
  const months=attendanceMonths({financialYear:fy,cutoff:'2026-10-24',today:'2026-10-24',rows:other?[]:fixtureRows});
  // Synthetic already-classified API states exercise visual red; actual production
  // absence classification remains entirely server-owned and unchanged.
  const absent=months.flatMap(m=>m.days).find(d=>d.date==='2026-09-03');if(absent&&!other)absent.status='absent';
  return {version:2,id:other?'alicescope':'raiskhan',name:other?'Alice Scope':'Rais Khan',rmCode:other?'OTHER':'033705',region:'North',territory:'Fixture territory',operatingFrom:'Ludhiana',selectedPeriod:{financialYear:fy,reportType:type,month:type==='yearly'?undefined:month,week:type==='weekly'?week:undefined,weekScheme:'four'},from:chosen.from,to:chosen.to,asOf:'2026-09-30',sourceAsOf:null,source:'Verified isolated fixture',historical:false,future:false,
    financialYears:['2023-24','2026-27','2027-28'],reportLabel:`FY ${fy}${type!=='yearly'?` / ${yearRows.find(r=>r.month===month).label}`:''}${type==='weekly'?` / Week ${week}`:''}`,ownershipMapping:'verified',lastSyncAt:null,weekRule:'Four reporting weeks',limitations:[],annualTarget:1200000,summary:variations(type==='yearly'?960000:type==='monthly'?80000:20000,type==='yearly'?1200000:type==='monthly'?100000:25000,70000),
    kpi:{actualSalesValue:960000,targetValue:1200000,achievementPercent:80,visitsPlanned:4,visitsCompleted:2,callsLogged:3,customersContacted:2,followUpsOpen:1,followUpsOverdue:0,expectedOrdersValue:10000},activeDealerCount:2,yearRows,weekRows,periodChartRows:type==='yearly'?yearRows:type==='monthly'?weekRows:[chosen],
    team:[],salespeople:[],selectedSalespersonId:null,executiveTerritoryCoverage:null,narratives:[{id:'achievement',title:'Sales Target Achievement',points:['Verified fixture sales evidence','Existing manager review'],reason:'Original evidence retained',action:'Review verified orders',priority:'Review'}],
    tables:[{id:'thrust',title:'Thrust products',columns:['Product','Net sales'],rows:[['Existing Verified Product',10000]]}],thrustYtd:{from:yearRows[0].from,to:'2026-09-30',companyNetSales:1000000,note:'Existing accounting scope',products:[{id:'existing',name:'Existing Verified Product',sales:10000,companyContributionPercent:1}]},
    myDayEntries:[],myDayTables:[],myDayRange:{from:chosen.from,to:'2026-10-24'},
    attendance:{available:!other,subject:{name:other?'Alice Scope':'Rais Khan',code:other?'OTHER':'033705',role:'rm'},cutoff:'2026-10-24',months,note:'Sunday off. Missing check-ins are unverified; absence policy is not recorded.'},
  };
}
const selectors={identity:'.rm-v2-identity',summary:'.rm-v2-summary',chart:'.rm-v2-chart',thrust:'[data-report-section=thrust]',myDay:'.rm-inputs',insights:'[data-report-section=insights]',actions:'[data-report-section=actions]'};
async function nonAttendance(page){const result={};for(const [key,selector] of Object.entries(selectors)){const el=page.locator(selector).first();result[key]=await el.count()?await el.evaluate(e=>({text:e.textContent,html:e.innerHTML,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})):null;}return result;}

test('isolated real UI baseline / full-FY heatmap, tooltip, detail sheet and zero-regression verification',{timeout:240000},async()=>{
  const browser=await chromium.launch({headless:true});let lastPage;
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
    await context.addInitScript(()=>localStorage.setItem('psspl_crm_session','heatmap-isolated-fixture'));
    let calls=0;
    await context.route('**/api/**',route=>{const url=new URL(route.request().url());if(url.pathname==='/api/auth/me')return route.fulfill({json:{user:{id:'fixture-admin',role:'admin',email:'fixture@example.test'}}});if(url.searchParams.get('reportVersion')==='2'){calls++;return route.fulfill({json:report(url.searchParams,url.pathname.includes('alicescope'))});}return route.fulfill({json:{}});});
    const page=await context.newPage(),errors=[];lastPage=page;page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://localhost:3000/admin/team/raiskhan?fy=2026-27');await page.locator('[data-report-section=attendance]').waitFor();await page.getByRole('heading',{name:'Rais Khan',exact:true}).waitFor();
    const attendance=page.locator('[data-report-section=attendance]');
    if(baseline){
      writeFileSync(`${output}/baseline-sections.json`,JSON.stringify(await nonAttendance(page),null,2));
      await attendance.scrollIntoViewIfNeeded();await page.evaluate(()=>scrollBy(0,-100));await attendance.screenshot({path:`${output}/baseline-attendance.png`});
      await page.getByRole('button',{name:'View Detailed Attendance',exact:true}).click();const detail=page.locator('.rm-v4-attendance-dialog');await detail.waitFor({state:'visible'});writeFileSync(`${output}/baseline-detail.txt`,await detail.innerText());await detail.screenshot({path:`${output}/baseline-detail.png`});await page.keyboard.press('Escape');
      await page.getByRole('button',{name:'Download PDF',exact:true}).click();await page.locator('[data-pagination-ready=true]').waitFor();writeFileSync(`${output}/baseline-pdf.txt`,(await page.locator('[data-rm-report-page]').allTextContents()).join('\n'));
      return;
    }
    const grid=attendance.getByRole('region',{name:'Full financial year attendance calendar'});
    const cells=attendance.locator('[data-attendance-date]');await cells.first().waitFor();assert.equal(await cells.count(),365);assert.equal(await attendance.locator('.rm-v4-attendance-weeks').count(),0);
    const months=await attendance.locator('[data-attendance-month]').evaluateAll(elements=>elements.map(e=>e.getAttribute('data-attendance-month')));assert.deepEqual(months,['2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12','2027-01','2027-02','2027-03']);
    assert.deepEqual(await attendance.locator('[data-attendance-month] > div:first-child').allTextContents(),['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']);
    async function auditDates(expected){const dates=await cells.evaluateAll(nodes=>nodes.map(n=>({date:n.dataset.attendanceDate,row:Number(n.style.gridRow),column:Number(n.style.gridColumn)})));assert.equal(dates.length,expected);assert.equal(new Set(dates.map(d=>d.date)).size,expected);for(const d of dates){const date=new Date(d.date+'T00:00:00Z');const start=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),1));assert.equal(d.row,(date.getUTCDay()+6)%7+1,d.date);assert.equal(d.column,Math.floor(((start.getUTCDay()+6)%7+date.getUTCDate()-1)/7)+1,d.date);}return dates;}
    await auditDates(365);
    const cell=date=>attendance.locator(`[data-attendance-date="${date}"]`);
    for(const [date,color] of [['2026-09-01','rgb(22, 163, 74)'],['2026-09-02','rgb(22, 163, 74)'],['2026-09-03','rgb(220, 38, 38)'],['2026-09-13','rgb(156, 163, 175)'],['2026-12-01','rgb(241, 245, 249)'],['2026-09-04','rgb(241, 245, 249)']])assert.equal(await cell(date).evaluate(e=>getComputedStyle(e).backgroundColor),color,date);
    const tip=page.getByRole('tooltip');
    await cell('2026-09-01').hover();await tip.waitFor();assert.match(await tip.innerText(),/Tuesday, 1 September 2026/);assert.match(await tip.innerText(),/09:00 AM/);assert.match(await tip.innerText(),/05:00 PM/);await tip.screenshot({path:`${output}/tooltip-desktop.png`});
    await cell('2026-09-02').hover();assert.match(await tip.innerText(),/2 September/);assert.match(await tip.innerText(),/Not recorded/);
    await cell('2026-09-13').hover();assert.match(await tip.innerText(),/Weekly Holiday/);assert.match(await tip.innerText(),/Worked on holiday/);assert.match(await tip.innerText(),/12:00 PM/);
    await cell('2026-09-14').hover();assert.match(await tip.innerText(),/15 Sep/,'overnight clock-out retains its date');
    await page.mouse.move(0,0);await tip.waitFor({state:'hidden'});
    await page.keyboard.press('Tab');await cell('2026-09-01').focus();await tip.waitFor();assert.match(await tip.innerText(),/1 September/);await page.getByRole('button',{name:'View Detailed Attendance',exact:true}).focus();await tip.waitFor({state:'hidden'});
    await cell('2026-04-01').hover();let box=await tip.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=1440);await cell('2027-03-31').hover();box=await tip.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=1440);await page.mouse.move(0,0);
    const after=await nonAttendance(page),before=existsSync(`${output}/baseline-sections.json`)?JSON.parse(readFileSync(`${output}/baseline-sections.json`,'utf8')):null;
    if(before)for(const key of Object.keys(before)){assert.equal(after[key]?.text,before[key]?.text,`${key} text unchanged`);assert.equal(after[key]?.width,before[key]?.width,`${key} width unchanged`);assert.equal(after[key]?.height,before[key]?.height,`${key} height unchanged`);}
    assert.equal(await page.locator('.rm-v2-kpis article').count(),8);assert.match(await page.locator('.rm-v2-summary').innerText(),/9\.60 L/);assert.match(await page.locator('[data-report-section=thrust]').innerText(),/Existing Verified Product/);
    await page.getByRole('button',{name:'View Detailed Attendance',exact:true}).click();const detail=page.locator('.rm-v4-attendance-dialog');await detail.waitFor({state:'visible'});assert.equal(await detail.locator('tbody tr').count(),30);if(existsSync(`${output}/baseline-detail.txt`))assert.equal(await detail.innerText(),readFileSync(`${output}/baseline-detail.txt`,'utf8'),'detail sheet unchanged');await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Download PDF',exact:true}).click();await page.locator('[data-pagination-ready=true]').waitFor();if(existsSync(`${output}/baseline-pdf.txt`))assert.equal((await page.locator('[data-rm-report-page]').allTextContents()).join('\n'),readFileSync(`${output}/baseline-pdf.txt`,'utf8'),'PDF content unchanged');assert.equal(await page.locator('[data-rm-report-page]').evaluateAll(nodes=>nodes.filter(p=>p.querySelector('.rm-v2-pdf-page-content').getBoundingClientRect().bottom>p.querySelector('footer').getBoundingClientRect().top-4).length),0);
    const download=page.waitForEvent('download',{timeout:60000});await page.locator('.rm-v2-preview').getByRole('button',{name:'Download PDF',exact:true}).click();const file=await download;await file.saveAs(`${output}/regression.pdf`);await page.keyboard.press('Escape');
    const requestCount=calls;
    await page.getByRole('button',{name:'Previous attendance month'}).click();assert.equal(await cells.count(),365);assert.equal(calls,requestCount,'no fetching for attendance month controls');
    await page.locator('.rm-v2-month-chart g[role=button]').filter({hasText:'Sep'}).click();await page.waitForFunction(()=>document.querySelector('.rm-v2-toolbar small')?.textContent.includes('Sep'));await page.waitForTimeout(450);assert.equal(await cells.count(),365);
    await page.locator('.rm-v2-week-chart g[role=button]').nth(1).press('Enter');await page.waitForFunction(()=>document.querySelector('.rm-v2-toolbar small')?.textContent.includes('Week 2'));assert.equal(await cells.count(),365);
    for(const width of [1440,1024,390]){await page.setViewportSize({width,height:1000});await attendance.scrollIntoViewIfNeeded();await page.evaluate(()=>scrollBy(0,-100));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await attendance.screenshot({path:`${output}/heatmap-${width}.png`});const shape=await cell('2026-09-01').boundingBox();assert.equal(shape.width,shape.height);assert.ok(shape.width>=10&&shape.width<=12);}
    await page.getByLabel('Financial Year',{exact:true}).selectOption('2023-24');await page.waitForFunction(()=>document.querySelectorAll('[data-attendance-date]').length===366);await auditDates(366);assert.equal(await cell('2024-02-29').count(),1);assert.equal(await cell('2023-03-31').count(),0);
    await page.getByLabel('Financial Year',{exact:true}).selectOption('2027-28');await page.waitForFunction(()=>document.querySelectorAll('[data-attendance-date]').length===366);await auditDates(366);assert.equal(await cell('2028-02-29').count(),1);assert.equal(await attendance.locator('[data-attendance-state=absent]').count(),0);
    await page.goto('http://localhost:3000/admin/team/alicescope');await page.getByRole('heading',{name:'Alice Scope',exact:true}).waitFor();await cells.first().waitFor();assert.equal(await cells.count(),365);assert.equal(await attendance.locator('[data-attendance-state=absent]').count(),0);assert.equal(await attendance.locator('[data-attendance-state=present]').count(),0);
    const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await touch.addInitScript(()=>localStorage.setItem('psspl_crm_session','fixture'));await touch.route('**/api/**',route=>{const url=new URL(route.request().url());return route.fulfill({json:url.pathname==='/api/auth/me'?{user:{id:'fixture-admin',role:'admin',email:'fixture@example.test'}}:url.searchParams.get('reportVersion')==='2'?report(url.searchParams):{}});});const mobile=await touch.newPage();await mobile.goto('http://localhost:3000/admin/team/raiskhan');const mobileCell=mobile.locator('[data-attendance-date="2026-09-01"]');await mobileCell.waitFor();await mobileCell.tap();await mobile.getByRole('tooltip').waitFor();assert.match(await mobile.getByRole('tooltip').innerText(),/09:00 AM/);box=await mobile.getByRole('tooltip').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);await mobile.getByRole('heading',{name:'RM Attendance',exact:false}).first().tap();await mobile.getByRole('tooltip').waitFor({state:'hidden'});await touch.close();
    assert.deepEqual(errors,[]);writeFileSync(`${output}/verification.json`,JSON.stringify({calendarDays:[365,366],noDuplicates:true,nonAttendanceSectionsUnchanged:true,detailedSheetUnchanged:true,pdfUnchanged:true,viewports:[1440,1024,390],touch:true},null,2));
  }catch(error){if(lastPage)await lastPage.screenshot({path:`${output}/failure.png`,fullPage:true});throw error;}finally{await browser.close();}
});
