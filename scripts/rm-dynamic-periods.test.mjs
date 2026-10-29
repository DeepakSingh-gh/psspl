import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdtempSync, rmSync, readFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { rmReportPeriod, targetForRange } from '../shared/rm-report-period.mjs';

const scratch = mkdtempSync(join(tmpdir(), 'psspl-period-test-'));
process.env.NODE_ENV = 'test';
process.env.CRM_TEST_DATABASE_ROOT = scratch;
process.env.CRM_DATABASE_PATH = join(scratch, 'synthetic.sqlite');
process.env.CRM_DISABLE_BASELINE_RESTORE = 'true';
let db, server, base, tokens = {}, directory;
const selection = (reportType, extra = {}) => ({ reportType, financialYear: '2024-25', month: 4, week: 1, ...extra });
const call = (path, who = 'admin') => fetch(`${base}${path}`, { headers: tokens[who] ? { Authorization: `Bearer ${tokens[who]}` } : {} });
const report = async (query, who = 'admin', id = 'alicescope') => {
  const url = who === 'admin' ? `/admin/team/${id}` : '/rm/period-report';
  const response = await call(`${url}?${new URLSearchParams(query)}`, who);
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
};

before(async () => {
  ({ db } = await import('../server/db.mjs'));
  const { createSession } = await import('../server/auth.mjs');
  const { adminRouter } = await import('../server/admin.mjs');
  const { rmRouter } = await import('../server/rm-routes.mjs');
  for (const [id, role, name, manager] of [['admin','admin','Admin',null], ['alice','rm','Alice Scope',null], ['rep','salesperson','Field Rep','alice'], ['bob','rm','Bob Other',null], ['rais','rm','Rais Khan',null]]) {
    db.prepare('INSERT INTO users(id,email,password_hash,role) VALUES(?,?,?,?)').run(id, `${id}@example.test`, 'synthetic', role);
    db.prepare("INSERT INTO salesperson_profiles(user_id,full_name,employee_code,manager_user_id,region,territory) VALUES(?,?,?,?,'Test','Test')").run(id, name, `EMP-${id}`, manager);
    tokens[id] = createSession(id).token;
  }
  db.prepare("INSERT INTO tally_customers(id,name,rm_name,owner_user_id) VALUES('customer','Period Customer','Alice Scope','rep'),('other','Other Customer','Bob Other','bob')").run();
  db.prepare("INSERT INTO tally_products(id,name) VALUES('product','Period Product')").run();
  for (const month of ['2024-04','2024-05','2024-06','2024-07','2024-08','2024-09','2024-10','2024-11','2024-12','2025-01','2025-02','2025-03']) db.prepare('INSERT INTO tally_rm_targets(rm_name,period,target_lakh) VALUES(?,?,?)').run('Alice Scope',month,0.3);
  let index = 0;
  for (const [date, amount, customer = 'customer', type = 'Sales', source = null] of [
    ['2024-04-01',1000],['2024-04-07',2000],['2024-04-08',3000],['2024-04-30',4000],['2024-05-01',5000],['2025-03-31',6000],['2025-04-01',7000],['2024-04-06',100,'customer','Credit Note'],['2024-04-02',90000,'other'],['2024-04-02',100000,'customer','Sales','excel-import'],
  ]) {
    const id = `invoice-${index++}`;
    db.prepare('INSERT INTO tally_invoices(id,company_name,voucher_type,invoice_date,customer_id,customer_name,amount,source_sync_id) VALUES(?,?,?,?,?,?,?,?)').run(id,'Synthetic',type,date,customer,'Period Customer',amount,source);
    db.prepare('INSERT INTO tally_invoice_lines(id,invoice_id,product_id,product_name,quantity,amount) VALUES(?,?,?,?,?,?)').run(`line-${id}`,id,'product','Period Product',1,amount);
  }
  db.prepare("INSERT INTO visits(id,user_id,business_date,tally_customer_id,scheduled_at,purpose,status) VALUES('visit','rep','2024-04-02','customer','2024-04-02T09:00:00Z','Review','completed'),('later','rep','2024-04-08','customer','2024-04-08T09:00:00Z','Review','planned')").run();
  for (const [id, due, amount] of [['first','2024-04-03',500],['later','2024-05-03',800]]) {
    db.prepare('INSERT INTO expected_orders(id,visit_id,user_id,tally_customer_id,tally_product_id,expected_value,expected_date,created_at) VALUES(?,?,?,?,?,?,?,?)').run(id,'visit','rep','customer','product',amount,due,`${due}T09:00:00Z`);
    db.prepare('INSERT INTO follow_ups(id,user_id,tally_customer_id,title,due_date,created_at) VALUES(?,?,?,?,?,?)').run(id,'rep','customer',`Follow ${id}`,due,`${due}T09:00:00Z`);
  }
  const app = express();
  app.use(express.json());
  app.use('/admin',adminRouter);
  app.use('/rm',rmRouter);
  app.use((error,req,res,next) => res.status(500).json({ error: error.message }));
  server = app.listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  directory = (await (await call('/admin/rm-report-options')).json()).managers;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  db?.close();
  assert.ok(resolve(scratch).startsWith(resolve(tmpdir()) + '\\') || resolve(scratch).startsWith(resolve(tmpdir()) + '/'));
  rmSync(scratch,{ recursive:true, force:true });
});

test('period boundaries cover April–March, leap February and the short final week', () => {
  assert.deepEqual([rmReportPeriod(selection('yearly')).from,rmReportPeriod(selection('yearly')).to],['2024-04-01','2025-03-31']);
  assert.equal(rmReportPeriod(selection('weekly',{month:4,week:5})).to,'2024-04-30');
  assert.equal(rmReportPeriod(selection('weekly',{financialYear:'2023-24',month:2,week:5})).from,'2024-02-29');
  assert.throws(() => rmReportPeriod(selection('weekly',{month:2,week:5})),RangeError);
  assert.throws(() => rmReportPeriod(selection('yearly',{financialYear:'2024-26'})),RangeError);
  assert.equal(targetForRange(new Map([['2024-04',30000]]),'2024-04-01','2024-04-07'),7000);
  assert.equal(targetForRange(new Map([['2024-04',30000]]),'2024-04-01','2024-05-01'),null);
});

test('weekly, monthly and yearly actual totals match charts, tables, targets and CRM date filters', async () => {
  assert.ok(directory.some(row => row.id === 'alicescope'));
  for (const [type, sales, target, bars, visits, pipeline, followups] of [['weekly',2900,7000,7,1,500,1],['monthly',9900,30000,30,2,500,1],['yearly',20900,360000,12,2,1300,2]]) {
    const data = await report(selection(type));
    assert.equal(data.kpi.actualSalesValue,sales);
    assert.equal(data.kpi.targetValue,target);
    assert.equal(data.periodChartRows.length,bars);
    assert.equal(data.periodChartRows.reduce((sum,row) => sum+row.actual,0),sales);
    assert.equal(data.topProducts[0].salesValue,sales);
    assert.equal(data.topDealers[0].salesValue,sales);
    assert.equal(data.kpi.visitsPlanned,visits);
    assert.equal(data.kpi.expectedOrdersValue,pipeline);
    assert.equal(data.kpi.followUpsOpen,followups);
    assert.equal(data.pipeline.reduce((sum,row) => sum+row.expectedValue,0),pipeline);
    assert.equal(data.followUps.length,followups);
    assert.ok(data.actualSales.every(row => row.invoiceDate >= data.from && row.invoiceDate <= data.to));
    assert.ok(data.customerVisits.every(row => row.date >= data.from && row.date <= data.to));
    assert.equal(data.customerVisits.find(row => row.id === 'visit').expectedOrderValue,type === 'yearly' ? 1300 : 500);
    assert.ok(data.pipeline.every(row => row.expectedDate >= data.from && row.expectedDate <= data.to));
    assert.ok(data.followUps.every(row => row.dueDate >= data.from && row.dueDate <= data.to));
    assert.equal(data.actualOnly,true);
    assert.equal(data.reportSource,undefined);
    assert.equal(data.livePreviewDemo,undefined);
  }
  const finalWeek = await report(selection('weekly',{week:5}));
  assert.equal(finalWeek.from,'2024-04-29');
  assert.equal(finalWeek.to,'2024-04-30');
  assert.equal(finalWeek.kpi.actualSalesValue,4000);
  assert.equal(finalWeek.kpi.targetValue,2000);
});

test('RM uses the same data and cannot select another RM or call admin APIs',async () => {
  const admin = await report(selection('monthly'));
  const self = await report(selection('monthly'),'alice');
  assert.deepEqual(self.kpi,admin.kpi);
  assert.deepEqual(self.actualSales,admin.actualSales);
  assert.equal((await call('/rm/period-report?'+new URLSearchParams({...selection('monthly'),rmId:'bobother'}),'alice')).status,403);
  assert.equal((await call('/admin/team/bobother?'+new URLSearchParams(selection('monthly')),'alice')).status,403);
  assert.equal((await call('/rm/period-report?'+new URLSearchParams(selection('monthly')),'rep')).status,403);
  assert.equal((await call('/rm/period-report?'+new URLSearchParams(selection('monthly')),'anonymous')).status,401);
});

test('historical empty periods remain empty, missing targets stay unknown and invalid selections fail',async () => {
  const empty = await report(selection('monthly',{financialYear:'2020-21'}));
  assert.equal(empty.hasRecords,false);
  for (const key of ['actualSales','customerVisits','pipeline','followUps','topDealers','topProducts']) assert.deepEqual(empty[key],[]);
  assert.equal(empty.kpi.targetValue,null);
  const priorOnly = await report(selection('monthly',{financialYear:'2025-26',month:5}));
  assert.equal(priorOnly.hasRecords,false);
  assert.deepEqual(priorOnly.topProducts,[], 'previous-year products must not appear as sales in an empty selected month');
  const noTarget = await report(selection('monthly',{financialYear:'2025-26'}));
  assert.equal(noTarget.kpi.actualSalesValue,7000);
  assert.equal(noTarget.kpi.targetValue,null);
  assert.equal(noTarget.kpi.achievementPercent,null);
  const invalid = await call('/admin/team/alicescope?'+new URLSearchParams(selection('weekly',{week:9})));
  assert.equal(invalid.status,400);
});

// The V1 dropdown/two-page assertions are superseded by the V2 chart-navigation,
// responsive, permission and measured-pagination suite in rm-performance-v2.test.mjs.
test('legacy browser dropdown and fixed two-page layout', { skip: 'Superseded by rm-performance-v2.test.mjs; V2 intentionally removes these controls', timeout: 180000 }, async () => {
  const browser = await chromium.launch({ headless:true });
  try {
    const page = await browser.newPage({ viewport:{width:1440,height:1000}, acceptDownloads:true });
    const errors = [];
    const reportRequests = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:',error.message); });
    const connect = async (page, who) => {
      await page.addInitScript(token => localStorage.setItem('psspl_crm_session',token),tokens[who]);
      await page.route('**/api/**',async route => {
        const url = new URL(route.request().url());
        const path = url.pathname.replace(/^\/api/,'');
        if (url.searchParams.has('reportType')) reportRequests.push(path+url.search);
        if (path === '/auth/me') return route.fulfill({ json:{user:{id:who,email:`${who}@example.test`,role:who==='admin'?'admin':'rm'}} });
        if (path === '/rm/dashboard') return route.fulfill({json:{manager:{fullName:'Alice Scope',region:'Test'}}});
        const response = await call(path+url.search,who);
        await route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});
      });
    };
    await connect(page,'admin');
    await page.goto('http://localhost:3000/admin/team/alicescope');
    await page.getByLabel('Financial year',{exact:true}).locator('option').first().waitFor({state:'attached'});
    assert.deepEqual(await page.getByLabel('Financial year',{exact:true}).locator('option').evaluateAll(options=>options.map(option=>option.value)),['2026-27','2025-26','2024-25']);
    await page.getByRole('heading',{name:'Alice Scope',exact:true,level:1}).waitFor();
    const initialRequests = reportRequests.length;
    await page.getByLabel('Financial year',{exact:true}).selectOption('2024-25');
    await page.getByLabel('Month',{exact:true}).selectOption('4');
    await page.getByText('Select View Report to apply these filters.',{exact:true}).waitFor();
    assert.equal(reportRequests.length,initialRequests,'draft selections must not fetch until View Report is pressed');
    assert.equal(await page.getByRole('button',{name:'Download PDF',exact:true}).isDisabled(),false);
    await page.getByRole('button',{name:'Download PDF',exact:true}).click();
    await page.getByRole('dialog').waitFor();
    assert.match(await page.getByRole('dialog').innerText(),/Monthly.*01-04-2024/,'download applies pending filters before opening the preview');
    assert.match(await page.getByRole('dialog').locator('#rm-report-page-1').innerText(),/9,900/,'preview uses newly selected data');
    await page.keyboard.press('Escape');
    for (const [tab,bars,sales] of [['Weekly',7,'2,900'],['Monthly',30,'9,900'],['Yearly',12,'20,900']]) {
      await page.getByRole('tab',{name:tab,exact:true}).click();
      await page.getByRole('button',{name:'View Report',exact:true}).click();
      await page.waitForFunction(count => document.querySelectorAll('.rm-chart-plot rect[role="button"]').length===count,bars);
      assert.match(await page.locator('.rm-kpi-grid').innerText(),new RegExp(sales));
      assert.doesNotMatch(await page.locator('.rm-report-card').innerText(),/Demo|Illustrative|North Star Traders/);
      if (tab === 'Monthly') {
        await page.locator('.rm-period-filters').screenshot({path:'scratch/rm-period-filters-desktop.png'});
        assert.ok((await page.locator('.rm-period-filters').boundingBox()).height < 220,'desktop filter controls stay compact');
        const insights = await page.locator('.rm-report-insights').boundingBox();
        const actions = await page.locator('.rm-report-actions').boundingBox();
        assert.ok(actions.x >= insights.x + insights.width,'insights and actions share a desktop row');
        const kpis = await page.locator('.rm-kpi-grid').boundingBox();
        const chart = await page.locator('.rm-report-chart').boundingBox();
        assert.ok(chart.y >= kpis.y + kpis.height,'KPIs precede the graph');
      }
      await page.getByRole('button',{name:'Download PDF',exact:true}).click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      assert.match(await dialog.innerText(),new RegExp(`${tab}.*01-04-2024`));
      assert.match(await dialog.locator('#rm-report-page-1').innerText(),new RegExp(sales));
      assert.match(await dialog.locator('#rm-report-page-2').innerText(),/Period Customer[\s\S]*Period Product/);
      assert.doesNotMatch(await dialog.innerText(),/Demo|Illustrative|North Star Traders/);
      await dialog.locator('#rm-report-page-1').screenshot({path:`scratch/rm-dynamic-${tab.toLowerCase()}-pdf.png`});
      const downloadPromise = page.waitForEvent('download',{timeout:45000});
      await dialog.getByRole('button',{name:'Download PDF',exact:true}).click();
      const download = await downloadPromise;
      assert.match(download.suggestedFilename(),new RegExp(`Alice_Scope_RM_Report_${tab.toLowerCase()}_01-04-2024_to_`));
      await download.saveAs(join(scratch,`${tab}.pdf`));
      const bytes = readFileSync(join(scratch,`${tab}.pdf`));
      assert.equal(bytes.subarray(0,4).toString(),'%PDF');
      assert.equal((bytes.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length,2);
      copyFileSync(join(scratch,`${tab}.pdf`),`scratch/rm-dynamic-${tab.toLowerCase()}.pdf`);
      await page.keyboard.press('Escape');
    }
    await page.getByLabel('Regional manager',{exact:true}).selectOption('bobother');
    await page.getByRole('button',{name:'View Report',exact:true}).click();
    await page.getByRole('heading',{name:'Bob Other',exact:true,level:1}).waitFor();
    assert.match(await page.locator('.rm-kpi-grid').innerText(),/90,000/);
    assert.doesNotMatch(await page.locator('.rm-kpi-grid').innerText(),/20,900/);
    await page.getByLabel('Regional manager',{exact:true}).selectOption('alicescope');
    await page.getByLabel('Financial year',{exact:true}).selectOption('2025-26');
    await page.getByRole('tab',{name:'Monthly',exact:true}).click();
    await page.getByLabel('Month',{exact:true}).selectOption('5');
    await page.getByRole('button',{name:'View Report',exact:true}).click();
    await page.getByText('No Data Available',{exact:true}).first().waitFor();
    assert.equal(await page.locator('.rm-chart-plot svg').count(),1,'empty reports still show chart axes');
    await page.getByRole('button',{name:'Download PDF',exact:true}).click();
    assert.equal(await page.locator('#rm-report-page-1 svg').count(),1,'empty PDF reports still render a chart');
    assert.match(await page.locator('#rm-report-page-1').innerText(),/No Data Available/);
    await page.keyboard.press('Escape');
    await page.setViewportSize({width:390,height:844});
    await page.locator('.rm-period-filters').screenshot({path:'scratch/rm-dynamic-filters-mobile.png'});
    assert.ok(await page.locator('.rm-period-filters').evaluate(el=>el.scrollWidth<=el.clientWidth));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile report does not overflow horizontally');
    await page.setViewportSize({width:1440,height:1000});
    await page.getByRole('tab',{name:'Customer Visits',exact:true}).click();
    await page.getByLabel('Regional manager',{exact:true}).selectOption('raiskhan');
    await page.getByLabel('Financial year',{exact:true}).selectOption('2026-27');
    await page.getByRole('tab',{name:'Monthly',exact:true}).click();
    await page.getByLabel('Month',{exact:true}).selectOption('9');
    await page.getByRole('button',{name:'View Report',exact:true}).click();
    await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Selected RM report');
    assert.equal(await page.getByRole('tab',{name:/Report Card/}).getAttribute('aria-selected'),'true');
    await page.waitForFunction(()=>document.querySelector('.rm-report-section')?.getBoundingClientRect().top<=110);
    assert.match(await page.locator('.rm-kpi-grid').innerText(),/6\.56 L/);
    assert.match(await page.locator('.rm-report-card').innerText(),/Source as of/);
    const coverage = page.locator('.rm-report-card').getByRole('region',{name:'Executive Territory Coverage',exact:true});
    assert.equal(await coverage.locator('tbody tr').count(),4);
    assert.match(await coverage.innerText(),/Rais Khan[\s\S]*Chandigarh[\s\S]*Kundli/);
    assert.match(await coverage.innerText(),/Sartaj Khan[\s\S]*Ludhiana[\s\S]*Devendra Shingh[\s\S]*Rajkot[\s\S]*Wasim Khan[\s\S]*Ludhiana/);
    await page.locator('.rm-report-profile').screenshot({path:'scratch/rais-selected-report-profile.png'});
    assert.equal(await page.locator('.rm-chart-plot rect[role="button"]').count(),4);
    assert.match(await page.locator('.rm-report-card').innerText(),/North Star Traders/);
    await page.getByRole('button',{name:'Download PDF',exact:true}).click();
    assert.match(await page.getByRole('dialog').innerText(),/Rais Khan[\s\S]*Monthly[\s\S]*Supplied report/);
    assert.match(await page.locator('#rm-report-page-2').innerText(),/Top Customers \(5\)[\s\S]*Top Products \(5\)/);
    assert.equal(await page.locator('#rm-report-page-2').getByRole('region',{name:'Executive Territory Coverage',exact:true}).innerText(),await coverage.innerText(),'PDF and dashboard retain the same executive mappings');
    assert.ok(await page.locator('#rm-report-page-2').evaluate(el=>el.firstElementChild.getBoundingClientRect().bottom<=el.lastElementChild.getBoundingClientRect().top),'PDF details fit above the footer');
    await page.locator('#rm-report-page-2').screenshot({path:'scratch/rais-territory-pdf-page-2.png'});
    const sourceDownloadPromise = page.waitForEvent('download',{timeout:45000});
    await page.getByRole('dialog').getByRole('button',{name:'Download PDF',exact:true}).click();
    const sourceDownload = await sourceDownloadPromise;
    await sourceDownload.saveAs('scratch/rais-source-monthly.pdf');
    await page.locator('#rm-report-page-1').screenshot({path:'scratch/rais-source-monthly-preview.png'});
    await page.keyboard.press('Escape');
    for (const frequency of ['Weekly','Yearly']) {
      await page.getByRole('tab',{name:frequency,exact:true}).click();
      if (frequency === 'Weekly') {
        assert.equal(await page.getByLabel('Week',{exact:true}).locator('option').count(),4);
        await page.getByLabel('Week',{exact:true}).selectOption('2');
      }
      await page.getByRole('button',{name:'View Report',exact:true}).click();
      await page.waitForFunction(label=>document.querySelector('.rm-report-profile')?.textContent.includes(`Period: ${label}`),frequency);
      assert.match(await page.locator('.rm-report-card').innerText(),/Source as of/);
    }
    const rawRais = await report(selection('monthly',{financialYear:'2026-27',month:9}),'admin','raiskhan');
    assert.equal(rawRais.hasRecords,false,'display previews must not create API records');
    assert.deepEqual(rawRais.actualSales,[]);
    const own = await browser.newPage();
    await connect(own,'alice');
    await own.goto('http://localhost:3000/rm/report-card');
    await own.getByLabel('Financial year',{exact:true}).selectOption('2024-25');
    await own.getByLabel('Month',{exact:true}).selectOption('4');
    await own.getByRole('button',{name:'View Report',exact:true}).click();
    await own.waitForFunction(()=>document.querySelector('.rm-kpi-grid')?.textContent.includes('9,900'));
    assert.equal(await own.getByLabel('Regional manager',{exact:true}).count(),0);
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
});
