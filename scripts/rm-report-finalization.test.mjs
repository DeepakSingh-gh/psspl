import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {chromium} from '@playwright/test';
import {finalReportFixture} from './fixtures/rm-report-finalization.mjs';
import {localReportPreview,canUseLocalReportPreview} from '../src/lib/rm-client-demo.mjs';
const output='scratch/rm-report-finalization';mkdirSync(output,{recursive:true});
const options={enabled:true,role:'admin',audience:'admin',hostname:'localhost',today:'2026-10-24'};
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
test('live/leap export and chart interaction preserve current data and permissions',{timeout:90000},async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    await page.addInitScript(()=>localStorage.setItem('psspl_crm_session','fixture-admin'));
    await page.route('**/api/**',route=>{const url=new URL(route.request().url());if(url.pathname==='/api/auth/me')return route.fulfill({json:{user:{id:'fixture-admin',role:'admin',email:'fixture@example.test'}}});return route.fulfill({json:url.searchParams.get('reportVersion')==='2'?finalReportFixture(Object.fromEntries(url.searchParams)): {}});});
    await page.goto('http://localhost:3000/admin/team/raiskhan');await page.locator('[data-attendance-date]').first().waitFor();
    const missing=page.locator('[data-thrust-product=partial-sales] .rm-product-unavailable > .sr-only');assert.equal(await missing.evaluate(el=>getComputedStyle(el).position),'absolute');
    await page.locator('.rm-v2-month-chart g[role=button]').filter({hasText:'Sep'}).focus();assert.match(await page.locator('.rm-v2-tooltip').innerText(),/Target variation[\s\S]*Previous comparable sales/);
    await page.keyboard.press('Enter');await page.locator('.rm-v2-week-chart g[role=button]').first().waitFor();await page.locator('.rm-v2-week-chart g[role=button]').nth(1).focus();assert.match(await page.locator('.rm-v2-tooltip').innerText(),/Target variation/);await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.rm-v2-toolbar small')?.textContent.includes('Week 2'));
    await page.getByLabel('Financial Year',{exact:true}).selectOption('2027-28');await page.getByRole('button',{name:'Download PDF',exact:true}).click();await page.locator('[data-pagination-ready=true]').waitFor();const pages=page.locator('[data-rm-report-page]');assert.equal(await pages.locator('[data-attendance-date]').count(),366);assert.equal(await pages.locator('[data-attendance-demo=true]').count(),0);assert.equal(await pages.locator('[role=tooltip]').count(),0);await page.keyboard.press('Escape');
    await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.rm-v2-month-chart').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
    const own=await browser.newPage();await own.addInitScript(()=>localStorage.setItem('psspl_crm_session','fixture-rm'));await own.route('**/api/**',route=>{const url=new URL(route.request().url());return route.fulfill({json:url.pathname==='/api/auth/me'?{user:{id:'fixture-rm',role:'rm',email:'fixture@example.test'}}:url.searchParams.get('reportVersion')==='2'?finalReportFixture(Object.fromEntries(url.searchParams)): {}});});await own.goto('http://localhost:3000/rm/report-card');await own.locator('[data-attendance-date]').first().waitFor();assert.equal(await own.getByRole('button',{name:'Start Demo Preview',exact:true}).count(),0);assert.equal(await own.locator('[data-attendance-demo=true]').count(),0);
  }finally{await browser.close();}
});
test('retired preview cannot alter recorded attendance, products or KPIs for any caller',()=>{
  const raw=freeze(finalReportFixture()),before=JSON.stringify(raw);
  for(const settings of [{},{...options,enabled:false},options,{...options,role:'rm'},{...options,audience:'rm'},{...options,hostname:'crm.example.com'}])assert.equal(localReportPreview(raw,settings),raw);
  assert.equal(canUseLocalReportPreview({role:'admin',audience:'admin',hostname:'localhost'}),false);
  assert.equal(JSON.stringify(raw),before);
});

test('recorded reports preserve filters, responsive layout, complete entries and PDF export without synthetic data',{timeout:180000},async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
    await page.addInitScript(()=>localStorage.setItem('psspl_crm_session','fixture-admin'));
    const errors=[],apiCalls=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/api/**',route=>{
      const url=new URL(route.request().url());apiCalls.push({method:route.request().method(),url:url.pathname+url.search});
      if(url.pathname==='/api/auth/me')return route.fulfill({json:{user:{id:'fixture-admin',role:'admin',email:'fixture@example.test'}}});
      if(url.searchParams.get('reportVersion')==='2')return route.fulfill({json:finalReportFixture(Object.fromEntries(url.searchParams),url.pathname.includes('alicescope')?'alicescope':'raiskhan')});
      return route.fulfill({json:{}});
    });
    await page.goto('http://localhost:3000/admin/team/raiskhan');
    await page.getByRole('heading',{name:'Rais Khan',exact:true}).waitFor();
    const att=page.locator('[data-report-section=attendance]'),products=page.locator('[data-report-section=thrust]'),saved=page.locator('[data-report-section=my-day-inputs]');
    await att.locator('[data-attendance-date]').first().waitFor();
    assert.equal(await page.getByRole('button',{name:/Start.*Preview/}).count(),0);
    assert.equal(await att.locator('[data-attendance-demo=true]').count(),0);
    assert.equal(await att.locator('[data-attendance-date]').count(),365);
    assert.match(await products.locator('[data-thrust-product=real]').innerText(),/1.00 L/);
    assert.match(await products.locator('[data-thrust-product=zero]').innerText(),/0.00 L/);
    assert.match(await products.locator('[data-thrust-product=partial-sales]').innerText(),/0.75 L/);
    assert.equal(await products.locator('.rm-product-demo-example').count(),0);
    assert.match(await saved.innerText(),/25 entries/);
    await saved.getByRole('button',{name:'Next',exact:true}).click();assert.match(await saved.innerText(),/Saved customer 25/);
    const before=await page.locator('.rm-v2-kpis article > strong').allTextContents();
    for(const width of [1440,1024,390]){
      await page.setViewportSize({width,height:1000});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.getByRole('button',{name:'Download PDF',exact:true}).click();
    await page.locator('[data-pagination-ready=true]').waitFor();
    const pages=page.locator('[data-rm-report-page]'),text=(await pages.allTextContents()).join(' ');
    assert.deepEqual(await pages.locator('.rm-v2-kpis article > strong').allTextContents(),before);
    assert.match(text,/Saved customer 01/);assert.match(text,/Saved customer 25/);
    assert.doesNotMatch(text,/Demo Attendance|Demo Data|Sample Customer|14\.07%|41\.93 L/);
    assert.equal(await pages.locator('[data-attendance-date]').count(),365);
    assert.equal(await pages.locator('[data-attendance-demo=true]').count(),0);
    assert.equal(await pages.evaluateAll(nodes=>nodes.filter(p=>p.querySelector('.rm-v2-pdf-page-content').getBoundingClientRect().bottom>p.querySelector('footer').getBoundingClientRect().top-4).length),0);
    const fileReady=page.waitForEvent('download',{timeout:120000});
    await page.locator('.rm-v2-preview').getByRole('button',{name:'Download PDF',exact:true}).click();
    const file=await fileReady;await file.saveAs(`${output}/recorded-report.pdf`);
    assert.equal(readFileSync(`${output}/recorded-report.pdf`).subarray(0,4).toString(),'%PDF');
    await page.keyboard.press('Escape');
    await page.locator('.rm-v2-month-chart g[role=button]').filter({hasText:'Sep'}).click();
    await page.locator('.rm-v2-week-chart g[role=button]').nth(1).waitFor();
    await page.locator('.rm-v2-week-chart g[role=button]').nth(1).click();
    await page.waitForFunction(()=>document.querySelector('.rm-v2-toolbar small')?.textContent.includes('Week 2'));
    assert.equal(await page.getByRole('button',{name:'Download PDF',exact:true}).isEnabled(),true);
    assert.ok(apiCalls.every(call=>call.method==='GET'));assert.ok(apiCalls.every(call=>!/[?&](demo|preview)=/.test(call.url)));
    assert.deepEqual(errors,[]);
    writeFileSync(`${output}/real-data-browser-audit.json`,JSON.stringify({noSyntheticData:true,apiWrites:0,responsiveWidths:[1440,1024,390],allSavedEntriesExported:true,pdfDownloaded:true},null,2));
  }finally{await browser.close();}
});
