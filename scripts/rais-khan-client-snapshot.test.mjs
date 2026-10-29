import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { raisKhanClientSnapshot,CLIENT_SNAPSHOT_LABEL } from '../src/lib/rais-khan-client-snapshot.mjs';
import { financialMonths,reportingWeeks,variations } from '../shared/rm-performance.mjs';
import { feedbackForIdentity } from '../server/rm-feedback.mjs';

const snapshot=feedbackForIdentity({name:'Rais Khan'});
function fixture(extra={}) {
  const selectedPeriod={financialYear:'2026-27',reportType:'yearly',weekScheme:'four',...extra};
  const month=Number(selectedPeriod.month??9);
  const yearRows=financialMonths(selectedPeriod.financialYear).map((r,i)=>({...r,...variations(snapshot.monthlyMetrics[i].achieved==null?null:Math.round(snapshot.monthlyMetrics[i].achieved*100000),Math.round(snapshot.monthlyMetrics[i].target*100000),null),source:'Existing verified source',targetBasis:'Existing target',partial:false}));
  const weekRows=reportingWeeks(selectedPeriod.financialYear,month).map((r,i)=>({...r,...variations(snapshot.weeklySummary[i].achieved[(month+8)%12]==null?null:Math.round(snapshot.weeklySummary[i].achieved[(month+8)%12]*100000),Math.round(snapshot.weeklySummary[i].targets[(month+8)%12]*100000),null),source:'Existing verified source',targetBasis:'Existing target',partial:false}));
  const active=selectedPeriod.reportType==='yearly'?{from:'2026-04-01',to:'2027-03-31',...variations(5315000,6254000,6333000)}:selectedPeriod.reportType==='monthly'?yearRows.find(r=>r.month===month):weekRows[Number(selectedPeriod.week)-1];
  return {version:2,id:'raiskhan',name:'Rais Khan',rmCode:'033705',operatingFrom:'Ludhiana',region:'Existing North',territory:'Existing CRM territory',technicalService:{...snapshot.technicalService},selectedPeriod,
    from:active.from,to:active.to,asOf:'2026-09-30',source:'Supplied PDF snapshot',sourceAsOf:'2026-09-30',lastSyncAt:null,reportLabel:`FY 2026-27${selectedPeriod.reportType==='yearly'?'':` / ${new Date(`2026-${String(month).padStart(2,'0')}-01T00:00:00Z`).toLocaleString('en-IN',{month:'long',timeZone:'UTC'})}`}${selectedPeriod.reportType==='weekly'?` / Week ${selectedPeriod.week}`:''}`,financialYears:['2026-27','2025-26'],ownershipMapping:'verified',historical:false,future:false,weekRule:'Reporting dates 1–7, 8–14, 15–21, 22–month end',annualTarget:12303000,
    summary:Object.fromEntries(Object.keys(variations(null,null)).map(key=>[key,active[key]??null])),yearRows,weekRows,periodChartRows:selectedPeriod.reportType==='yearly'?yearRows:selectedPeriod.reportType==='monthly'?weekRows:[active],
    kpi:{actualSalesValue:active.actual,targetValue:active.target,achievementPercent:active.achievementPercent,visitsPlanned:0,visitsCompleted:0,callsLogged:0,customersContacted:0,followUpsOpen:0,followUpsOverdue:0,expectedOrdersValue:0},
    myDaySummary:{visitsPlanned:0,visitsCompleted:0,callsLogged:0,followUpsOpen:0,followUpsOverdue:0,expectedOrdersValue:0},myDayRange:{from:active.from,to:'2026-09-30'},
    tables:[{id:'thrust',title:'Thrust products',columns:['Product','Net sales'],rows:[['Existing Zero Product',0]]}],thrustYtd:{from:'2026-04-01',to:'2026-09-30',companyNetSales:100000,note:'Existing source note',products:[{id:'existing',name:'Existing Zero Product',sales:0,companyContributionPercent:0}]},
    executiveTerritoryCoverage:{asOf:'2026-09-30',entries:snapshot.teamEntries},team:[],salespeople:[],selectedSalespersonId:null,limitations:['Original validation retained'],narratives:[],
  };
}
// Existing non-missing leaf values, rows and order must survive every fallback.
function assertPreserved(before,after,path='report'){
  if(before==null||typeof before==='string'&&!before.trim()||typeof before==='number'&&!Number.isFinite(before))return;
  if(typeof before!=='object'){assert.equal(after,before,path);return;}
  if(Array.isArray(before))assert.ok(after.length>=before.length,path);
  for(const key of Object.keys(before))assertPreserved(before[key],after[key],`${path}.${key}`);
}
function deepFreeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;}

test('real fields, legitimate zero, targets, calculations, source dates and original input are preserved',()=>{
  const raw=deepFreeze(fixture()),text=JSON.stringify(raw),next=raisKhanClientSnapshot(raw);
  assertPreserved(raw,next);assert.equal(JSON.stringify(raw),text);assert.deepEqual(next.summary,raw.summary);assert.equal(next.annualTarget,12303000);assert.equal(next.thrustYtd.products[0].sales,0);assert.equal(next.thrustYtd.products[0].companyContributionPercent,0);assert.deepEqual(next.kpi,raw.kpi);assert.deepEqual(next.narratives,raw.narratives);
  assert.equal(next.thrustYtd.products.length,3);assert.equal(next.thrustYtd.products[1].sales,null);assert.equal(next.thrustYtd.products[2].companyContributionPercent,null);assert.equal(next.territory,'Existing CRM territory');assert.equal(next.technicalService.center,'Ludhiana');assert.match(next.territoryExpansion,/Deeper Chandigarh/);assert.equal(raisKhanClientSnapshot(next),next);
});
test('August missing week-two amount is filled, populated conflicting weeks remain unchanged, unknown future cells stay blank',()=>{
  const raw=fixture({reportType:'monthly',month:8}),next=raisKhanClientSnapshot(raw);assert.equal(raw.weekRows[1].actual,null);assert.equal(next.weekRows[1].actual,311000);assert.equal(next.periodChartRows[1].actual,311000);assert.deepEqual(next.summary,raw.summary);assert.deepEqual(next.weekRows[1].clientSnapshotFields,['actual']);assertPreserved(raw,next);
  const may=fixture({reportType:'monthly',month:5});const preserved=raisKhanClientSnapshot(may);assert.equal(preserved.weekRows[1].actual,381000);assert.notEqual(preserved.weekRows[1].actual,537000);assert.ok(preserved.clientSnapshotFallback.conflicts.some(c=>c.field==='weekRows.1.actual'));
  for(const row of next.yearRows.slice(6)){assert.equal(row.actual,null);assert.equal(row.achievementPercent,null);assert.equal(row.variation,null);}
  const zero=fixture({reportType:'monthly',month:8});zero.weekRows[1].actual=0;zero.periodChartRows=zero.weekRows;assert.equal(raisKhanClientSnapshot(zero).weekRows[1].actual,0);
});
test('only missing matching financial fields fill; no new formulas or wrong-period annual totals',()=>{
  const raw=fixture();raw.annualTarget=null;raw.summary.actual=null;raw.summary.target=null;raw.summary.achievementPercent=null;raw.summary.previousActual=null;raw.summary.variation=null;raw.summary.growthPercent=null;
  const next=raisKhanClientSnapshot(raw);assert.equal(next.annualTarget,12300000);assert.equal(next.summary.actual,5314000);assert.equal(next.summary.target,6253000);assert.equal(next.summary.achievementPercent,85);assert.equal(next.summary.previousActual,6334000);assert.equal(next.summary.variation,null);assert.equal(next.summary.growthPercent,null);
  raw.asOf='2026-10-24';assert.equal(raisKhanClientSnapshot(raw).summary.actual,null,'September total cannot become October YTD actual');
  const early=fixture();early.asOf='2026-08-10';early.yearRows[4].actual=null;early.yearRows[4].target=0;const transformed=raisKhanClientSnapshot(early);assert.equal(transformed.yearRows[4].actual,null);assert.equal(transformed.yearRows[4].target,0);
  const mismatched=fixture({reportType:'monthly',month:4});mismatched.yearRows[0].actual=0;mismatched.summary.actual=null;mismatched.summary.achievementPercent=null;assert.equal(raisKhanClientSnapshot(mismatched).summary.actual,null);
});
test('other RMs, salesperson selections, other FYs and wrong codes receive no fallback; product names deduplicate',()=>{
  for(const patch of [{id:'alicescope',name:'Alice',rmCode:'OTHER'},{selectedSalespersonId:'rep'},{rmCode:'OTHER'},{selectedPeriod:{financialYear:'2024-25',reportType:'yearly'}}]){const raw={...fixture(),...patch};assert.equal(raisKhanClientSnapshot(raw),raw);}
  const raw=fixture();raw.thrustYtd.products.push({id:'real',name:'ACID ZINC BRIGHTENERS',sales:0,companyContributionPercent:0});const next=raisKhanClientSnapshot(raw);assert.equal(next.thrustYtd.products.filter(p=>p.name.toLowerCase()==='acid zinc brighteners').length,1);assert.equal(next.thrustYtd.products[1].clientSnapshot,undefined);assert.equal(next.thrustYtd.products[1].sales,0);
});

test('missing identity and prior-FY monthly fields fill without changing populated technical details or inventing annual actuals',()=>{
  const raw=fixture();Object.assign(raw,{name:'',rmCode:null,operatingFrom:null,territory:null,technicalService:{center:'Existing service center',executive:null}});
  const next=raisKhanClientSnapshot(raw);assert.equal(next.rmCode,'033705');assert.equal(next.name,'Rais Khan');assert.equal(next.operatingFrom,'Ludhiana');assert.equal(next.technicalService.center,'Existing service center');assert.equal(next.technicalService.executive,'Sartaj Khan');assertPreserved(raw,next);
  const prior=fixture();prior.selectedPeriod={financialYear:'2025-26',reportType:'yearly',weekScheme:'four'};prior.from='2025-04-01';prior.to='2026-03-31';prior.asOf='2026-03-31';prior.annualTarget=null;prior.summary={...variations(null,null)};prior.yearRows=financialMonths('2025-26').map(r=>({...r,...variations(null,null),source:'Existing source',targetBasis:'Existing basis',partial:false}));prior.periodChartRows=prior.yearRows;
  const result=raisKhanClientSnapshot(prior);assert.equal(result.yearRows[0].actual,1197000);assert.equal(result.yearRows[11].actual,865000);assert.equal(result.annualTarget,13800000);assert.equal(result.summary.actual,null);assert.equal(result.yearRows[0].achievementPercent,null);
});

test('browser preserves populated KPIs and zero, labels fallback fields, keeps drill-down and PDF consistent', {skip:process.env.CRM_BROWSER_TEST!=='1',timeout:120000},async()=>{
  const browser=await chromium.launch({headless:true});mkdirSync('scratch/rais-client-snapshot',{recursive:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('psspl_crm_session','isolated-fixture'));
    await page.route('**/api/**',route=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/api/auth/me')return route.fulfill({json:{user:{id:'test-admin',role:'admin',email:'fixture@example.test'}}});
      if(url.searchParams.get('reportVersion')==='2'){
        const raw=fixture({reportType:url.searchParams.get('reportType')??'yearly',...(url.searchParams.get('month')?{month:Number(url.searchParams.get('month'))}:{}),...(url.searchParams.get('week')?{week:Number(url.searchParams.get('week'))}:{})});
        if(url.pathname.includes('alicescope'))Object.assign(raw,{id:'alicescope',name:'Alice Scope',rmCode:'OTHER'});
        return route.fulfill({json:raw});
      }
      return route.fulfill({json:{}});
    });
    await page.goto('http://localhost:3000/admin/team/raiskhan?fy=2026-27');await page.getByRole('heading',{name:'Rais Khan',exact:true}).waitFor();assert.match(await page.locator('.rm-v2-summary').innerText(),/53.15 L/);
    const products=page.locator('[data-report-section=thrust]');assert.equal(await products.locator('article').count(),3);assert.match(await products.locator('article').first().innerText(),/₹0.00 L/);assert.equal(await products.locator('article').first().getByText(CLIENT_SNAPSHOT_LABEL,{exact:true}).count(),0);assert.match(await products.locator('article').nth(1).innerText(),/Acid Zinc Brighteners/);assert.equal(await products.locator('article').nth(1).getByText(CLIENT_SNAPSHOT_LABEL,{exact:true}).count(),1);
    await page.locator('.rm-v3-coverage summary').click();assert.match(await page.locator('.rm-v3-coverage-content').innerText(),/Deeper Chandigarh/);await page.locator('.rm-v3-coverage summary').click();
    await page.locator('.rm-v2-month-chart g[role=button]').filter({hasText:'Aug'}).click();await page.waitForFunction(()=>document.querySelector('.rm-v2-toolbar small')?.textContent.includes('August'));await page.waitForTimeout(450);await page.mouse.move(0,0);await page.locator('.rm-v2-week-chart g[role=button]').nth(1).focus();assert.match(await page.locator('.rm-v2-tooltip').innerText(),/3.11 L/);assert.match(await page.locator('.rm-v2-tooltip').innerText(),/Demo Data/);await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.rm-v2-toolbar small')?.textContent.includes('Week 2'));
    await page.locator('.rm-v2-week-chart').scrollIntoViewIfNeeded();await page.screenshot({path:'scratch/rais-client-snapshot/august-fallback.png',fullPage:true});
    await page.getByRole('button',{name:'Download PDF',exact:true}).click();await page.locator('[data-pagination-ready=true]').waitFor();const pdf=page.locator('[data-rm-report-page]');const text=(await pdf.allTextContents()).join(' ');assert.match(text,/Demo Data · Client Snapshot 30 Sep 2026/);assert.match(text,/₹3.11 L/);assert.match(text,/Acid Zinc Brighteners/);assert.equal(await pdf.evaluateAll(nodes=>nodes.filter(p=>p.querySelector('.rm-v2-pdf-page-content').getBoundingClientRect().bottom>p.querySelector('footer').getBoundingClientRect().top-4).length),0);const download=page.waitForEvent('download',{timeout:60000});await page.locator('.rm-v2-preview').getByRole('button',{name:'Download PDF',exact:true}).click();const file=await download;await file.saveAs('scratch/rais-client-snapshot/report.pdf');await page.keyboard.press('Escape');
    await page.setViewportSize({width:390,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await products.scrollIntoViewIfNeeded();await page.evaluate(()=>scrollBy(0,-100));await products.screenshot({path:'scratch/rais-client-snapshot/products-mobile.png'});
    await page.goto('http://localhost:3000/admin/team/alicescope');await page.getByRole('heading',{name:'Alice Scope',exact:true}).waitFor();assert.equal(await page.getByText(CLIENT_SNAPSHOT_LABEL,{exact:true}).count(),0);assert.equal(await page.locator('[data-report-section=thrust] article').count(),1);assert.deepEqual(errors,[]);
    writeFileSync('scratch/rais-client-snapshot/browser-check.json',JSON.stringify({passed:true,viewportWidths:[1440,390],pdfFooterOverlap:0}));
  }finally{await browser.close();}
});
