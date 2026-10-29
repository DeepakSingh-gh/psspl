import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { db } from '../server/db.mjs';
import { createSession } from '../server/auth.mjs';
import { reportDateRange } from '../shared/business-date.mjs';

test('all four RM periods show matching report data and render the selected PDF', { timeout: 120000, skip: reportDateRange('fy').from !== '2026-04-01' }, async () => {
  const user = db.prepare("SELECT id FROM users WHERE role='admin' AND active=1 LIMIT 1").get();
  assert.ok(user, 'an active administrator is required');
  const { token } = createSession(user.id);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => localStorage.setItem('psspl_crm_session', value), token);
    const legacyItems = ['monthly', 'fytd'].map(id => ({ id: `claude-${id}`, title: 'A long historical analysis title that previously repeated the entire reporting context', metric: 'Legacy numeric paragraph', action: 'Legacy essay recommendation that repeats the entire history and explains several possible follow-ups in a long paragraph rather than giving a clear main point.', severity: id === 'monthly' ? 'high' : 'medium' }));
    await page.route('**/api/admin/team/*/ai-analysis', route => route.fulfill({ json: { provider: 'claude', items: ['month', 'fytd'].includes(route.request().postDataJSON().period) ? legacyItems : [] } }));
    await page.goto('http://localhost:3000/admin/team/raiskhan?fy=2026-27');
    await page.getByRole('tab', { name: /Report Card/ }).click();
    const cases = [
      { button: 'Today', period: 'Today', source: false },
      { button: 'This Week', period: 'This Week', source: false },
      { button: 'This Month', period: 'Reported month', source: true },
      { button: 'FYTD', period: 'FYTD', source: true },
    ];
    for (const item of cases) {
      await page.getByRole('button', { name: item.button, exact: true }).click();
      await page.locator('.rm-detail-period-btn.active').getByText(item.button, { exact: true }).waitFor();
      await page.waitForFunction(({ period, source }) => {
        const text = document.querySelector('.rm-kpi-grid')?.parentElement?.innerText ?? '';
        return text.includes(`Period: ${period}`) && (source ? text.includes('as of 30-09-2026') : !text.includes('Reported month (as of'));
      }, { period: item.period, source: item.source });
      const visibleReport = page.locator('.rm-kpi-grid').locator('..');
      const text = await visibleReport.innerText();
      // The support assignment stays consistent across all reporting periods.
      const serviceText = await visibleReport.locator('section[aria-label="Technical service"]').innerText();
      assert.match(serviceText, /Ludhiana/);
      assert.match(serviceText, /Sartaj Khan/);
      if (item.button === 'Today' || item.button === 'This Week') {
        assert.doesNotMatch(text, /Demo live-data preview for Rais Khan/);
        assert.match(text, new RegExp(`${item.button} Sales vs Target.*Demo`));
        assert.doesNotMatch(text, /Monthly Sales Target vs Achievement/);
        const bars = page.locator('.rm-chart-plot rect[role="button"]');
        assert.equal(await bars.count(), item.button === 'Today' ? 1 : 6, 'chart must follow the selected period');
        if (item.button === 'This Week') {
          assert.equal(await bars.first().getAttribute('aria-label'), 'Mon performance details');
          assert.equal(await bars.last().getAttribute('aria-label'), 'Sat performance details');
          assert.match(text, /Day-wise sales and target for the selected week/);
        }
        assert.match(text, /Sales vs Target \([^)]*\) · Demo/);
        assert.match(text, item.button === 'Today' ? /₹86,000/ : /₹3\.85 L/);
        if (item.button === 'Today') {
          const plot = page.locator('.rm-chart-plot');
          const details = page.locator('.rm-chart-details');
          assert.equal(await details.count(), 0, 'month details should be hidden before hover');
          await plot.locator('rect[role="button"]').first().hover();
          assert.match(await details.innerText(), /Performance[\s\S]*Target:[\s\S]*Actual Sales:[\s\S]*Achievement:/);
          const plotBox = await plot.boundingBox();
          const detailBox = await details.boundingBox();
          assert.ok(plotBox && detailBox && detailBox.x >= plotBox.x + plotBox.width - 1, 'month details should sit beside the chart');
          await page.mouse.move(1, 1);
          assert.equal(await details.count(), 0, 'month details should disappear after leaving the chart');
        }
      } else {
        assert.doesNotMatch(text, /Demo live-data preview for Rais Khan/);
      }
      assert.doesNotMatch(text, /Presentation preview|Illustrative/);
      assert.match(text, /Pipeline \(Expected Orders\) · Demo/);
      assert.match(text, /Top 5 Dealers by Revenue[^\n]*Demo/);
      assert.match(text, /Product Performance \(Top 5\) · Demo/);
      assert.match(text, /North Star Traders/);
      assert.match(text, new RegExp(`Period: ${item.period}`));
      assert.equal(text.includes('PDF data as of'), false);
      if (item.source) assert.match(text, /as of 30-09-2026/);
      else assert.doesNotMatch(text, /Reported month \(as of/);
      if (item.source) {
        await page.getByRole('tab', { name: /Manager Action Plan/ }).click();
        await page.getByText('Review missed orders with the RM.', { exact: true }).waitFor();
        assert.doesNotMatch(await page.locator('.admin-card').last().innerText(), /Legacy essay|Manager review checklist|Accountability Log/);
        await page.getByRole('tab', { name: 'AI Insights', exact: true }).click();
        const brief = await page.locator('.rm-insight').innerText();
        assert.match(brief, /Recent sales trend/);
        assert.match(brief, /Best sales month/);
        assert.match(brief, /Target consistency/);
        assert.match(brief, /2 \/ 6/);
        assert.match(brief, /4 reported months were below target/);
        assert.match(brief, /Sales fell from the previous reported month/);
        assert.equal(await page.locator(".rm-insight-tile").count(), 3);
        assert.doesNotMatch(brief, /Monthly sales below target|FYTD sales below target/);
        assert.doesNotMatch(brief, /Legacy|full.year target/);
        if (item.button === 'This Month') await page.locator('.rm-insight').screenshot({ path: 'scratch/rm-insight-desktop.png' });
        await page.getByRole('button', { name: 'View next steps', exact: true }).click();
        await page.getByText('Review missed orders with the RM.', { exact: true }).waitFor();
        await page.getByRole('tab', { name: /Report Card/ }).click();
      }
      await page.getByRole('button', { name: 'Download Report' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      assert.match(await dialog.innerText(), new RegExp(item.button));
      assert.equal(await page.locator('#rm-report-page-1').count(), 1);
      assert.equal(await page.locator('#rm-report-page-2').count(), 1);
      const layout = await page.evaluate(() => {
        const first = document.getElementById('rm-report-page-1');
        const second = document.getElementById('rm-report-page-2');
        const bounds = second.getBoundingClientRect();
        const rows = [...second.querySelectorAll('table tbody tr')];
        return { siblings: first.parentElement === second.parentElement, count: rows.length, contained: rows.every(row => {
          const rect = row.getBoundingClientRect();
          return rect.top >= bounds.top && rect.bottom <= bounds.bottom && rect.left >= bounds.left && rect.right <= bounds.right;
        }) };
      });
      assert.equal(layout.siblings, true, 'A4 pages must be siblings, never nested');
      assert.equal(layout.count, 10, 'five customer and five product rows should be rendered');
      assert.equal(layout.contained, true, 'every table row must be inside the visible second page');
      const preview = await dialog.innerText();
      assert.match(await dialog.locator('section[aria-label="Technical service"]').innerText(), /Ludhiana[\s\S]*Sartaj Khan/);
      assert.doesNotMatch(preview, /Legacy essay|Suggested action:|Direct Action:|Algorithmic synthesis/);
      if (item.source) {
        assert.match(preview, /Review missed orders with the RM/);
        assert.match(preview, /Recent sales trend[\s\S]*Best sales month[\s\S]*Target consistency/);
      }
      assert.match(preview, item.source ? /Monthly Sales Target vs Achievement Trend/ : new RegExp(`${item.button} Sales vs Target`));
      if (item.button === 'Today' || item.button === 'This Week') assert.match(preview, /Demo preview/);
      else assert.doesNotMatch(preview, /Demo preview/);
      assert.match(preview, /Top Customers \(5\) · Demo/);
      assert.match(preview, /Top Products \(5\) · Demo/);
      if (item.source) assert.match(preview, /PDF as of 30-09-2026/);
      else assert.doesNotMatch(preview, /PDF as of 30-09-2026/);
      if (item.button === 'FYTD') {
        await page.locator('#rm-report-page-2').screenshot({ path: 'scratch/rm-page2-layout.png' });
        const downloadPromise = page.waitForEvent('download');
        await dialog.getByRole('button', { name: 'Download PDF' }).click();
        const download = await downloadPromise;
        assert.match(download.suggestedFilename(), /fytd_30-09-2026\.pdf$/);
        await download.saveAs('scratch/rm-layout-check.pdf');
        const file = await download.path();
        assert.ok(statSync(file).size > 10000);
        const pdf = readFileSync(file);
        assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
        assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length, 2);
      }
      await dialog.getByRole('button', { name: /Close/ }).click();
      const originalKpis = await page.locator('.rm-kpi-grid').innerText();
      for (const sample of [
        { tab: 'Customer Visits', heading: /Customer visit log.*Demo/, rows: 3, dateColumn: 0 },
        { tab: 'Pipeline', heading: /Sales pipeline.*Demo/, rows: 3, dateColumn: 3 },
        { tab: 'Actual Sales', heading: /Actual sales invoices.*Demo/, rows: 5, dateColumn: 0 },
        { tab: 'Products', heading: /Top products sold by.*Demo/, rows: 5 },
        { tab: 'Follow-ups', heading: /Open follow-ups.*Demo/, rows: 3, dateColumn: 2 },
      ]) {
        await page.getByRole('tab', { name: sample.tab, exact: true }).click();
        await page.getByRole('heading', { name: sample.heading }).waitFor();
        const rows = page.locator('.admin-card .admin-table tbody tr');
        assert.equal(await rows.count(), sample.rows);
        if (sample.dateColumn != null) assert.match(await rows.first().locator('td').nth(sample.dateColumn).innerText(), /^\d{2}-\d{2}-\d{4}$/);
      }
      await page.getByRole('tab', { name: /Report Card/ }).click();
      assert.equal(await page.locator('.rm-kpi-grid').innerText(), originalKpis, 'sample tab rows must not change report KPIs');
    }
    await page.goto('http://localhost:3000/admin/team/pradeepmulik?fy=2026-27');
    await page.getByRole('tab', { name: /Report Card/ }).click();
    await page.getByRole('button', { name: 'Today', exact: true }).click();
    await page.locator('.rm-detail-period-btn.active').getByText('Today', { exact: true }).waitFor();
    await page.getByText('Pradeep Mulik', { exact: true }).first().waitFor();
    assert.doesNotMatch(await page.locator('.rm-kpi-grid').locator('..').innerText(), /Demo live-data preview for Rais Khan/);
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobile.addInitScript(value => localStorage.setItem('psspl_crm_session', value), token);
    await mobile.route('**/api/admin/team/*/ai-analysis', route => route.fulfill({ json: { provider: 'claude', items: [] } }));
    await mobile.goto('http://localhost:3000/admin/team/raiskhan?fy=2026-27');
    await mobile.getByRole('tab', { name: /Report Card/ }).click();
    await mobile.getByRole('button', { name: 'FYTD', exact: true }).click();
    await mobile.locator('.rm-detail-period-btn.active').getByText('FYTD', { exact: true }).waitFor();
    await mobile.locator('.rm-report-kpis').waitFor();
    assert.ok(await mobile.evaluate(() => document.querySelector('.admin-content').scrollWidth <= innerWidth), 'mobile report should fit the viewport');
    assert.ok(await mobile.locator('.rm-report-kpis').isVisible());
    await mobile.getByRole('tab', { name: 'AI Insights', exact: true }).click();
    await mobile.locator('.rm-insight-tile').last().waitFor();
    assert.equal(await mobile.locator('.rm-insight-tile').count(), 3);
    assert.ok(await mobile.evaluate(() => document.querySelector('.admin-content').scrollWidth <= innerWidth), 'mobile insight cards must fit the viewport');
    await mobile.locator('.rm-insight').screenshot({ path: 'scratch/rm-insight-mobile.png' });
    await mobile.close();
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    db.prepare('DELETE FROM sessions WHERE token_hash=?').run(createHash('sha256').update(token).digest('hex'));
  }
});
