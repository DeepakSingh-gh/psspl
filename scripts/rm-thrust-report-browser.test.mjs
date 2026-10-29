import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { db } from '../server/db.mjs';
import { createSession } from '../server/auth.mjs';

test('two-page report keeps AI points, actions and thrust products without a third page', { timeout: 180000 }, async () => {
  const user = db.prepare("SELECT id FROM users WHERE role='admin' AND active=1 LIMIT 1").get();
  const { token } = createSession(user.id);
  const browser = await chromium.launch({ headless: true });
  mkdirSync('scratch', { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => localStorage.setItem('psspl_crm_session', value), token);
    await page.route('**/api/admin/team/*/ai-analysis', route => route.fulfill({ json: { provider: 'claude', items: [] } }));
    await page.goto('http://localhost:3000/admin/team/raiskhan?fy=2026-27');
    await page.getByRole('tab', { name: /Report Card/ }).click();
    for (const period of ['Today', 'This Week', 'This Month', 'FYTD']) {
      await page.getByRole('button', { name: period, exact: true }).click();
      await page.locator('.rm-report-thrust').waitFor();
      const dashboardNames = await page.locator('.rm-report-thrust').innerText();
      if (period === 'This Month') {
        const chart = page.locator('.rm-report-chart');
        assert.equal(await chart.locator('.rm-chart-plot rect[role="button"]').count(), 4);
        for (let week = 1; week <= 4; week++) assert.equal(await chart.getByRole('button', { name: `Week ${week} performance details`, exact: true }).count(), 1);
        assert.match(await chart.innerText(), /₹6\.56 L/);
        assert.doesNotMatch(await chart.innerText(), /₹53\.14 L|Full-year target achieved|Top Revenue Milestone/);
        await chart.screenshot({ path: 'scratch/rm-month-weekly-chart.png' });
      }
      if (period === 'FYTD') assert.equal(await page.locator('.rm-chart-plot rect[role="button"]').count(), 12);
      const onScreenDetails = await page.getByRole('region', { name: 'Detailed AI insights', exact: true }).innerText();
      assert.match(onScreenDetails, /sales and target/);
      await page.getByRole('button', { name: 'Download Report', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      if (period === 'This Month') {
        assert.match(await dialog.innerText(), /This Month: Weekly Sales vs Target/);
        for (let week = 1; week <= 4; week++) assert.match(await dialog.innerText(), new RegExp(`Week ${week}`));
        assert.doesNotMatch(await dialog.innerText(), /12-Month Financial Year Quota Trajectory/);
      }
      assert.match(await dialog.locator('#rm-report-page-1').innerText(), /Ask AI:.*What happened\?/);
      assert.ok(await dialog.locator('#rm-report-page-1 .pdf-ai-points > li').count() > 0);
      assert.equal(await dialog.locator('#rm-report-page-1 .pdf-ai-points strong').first().innerText(), await page.locator('.rm-insight-detail-list > li h4').first().innerText());
      await page.evaluate(() => document.fonts.ready);
      const section = dialog.getByRole('region', { name: 'Strategic Thrust Products', exact: true });
      await section.waitFor();
      const products = section.locator('.pdf-thrust-product');
      assert.ok(await products.count() > 0);
      for (const product of await products.all()) {
        const name = (await product.locator('div').first().innerText()).replace(/^\d+\. /, '');
        assert.ok(dashboardNames.includes(name), `${name} matches the dashboard portfolio`);
      }
      if (period === 'FYTD' || period === 'This Month') {
        assert.match(await section.innerText(), /Demo sales/);
      }
      assert.equal(await dialog.locator('#rm-report-page-3').count(), 0);
      assert.equal(await dialog.locator('[data-rm-report-page]').count(), 2);
      assert.doesNotMatch(await dialog.innerText(), /continue from page 3|Full details follow/);
      for (const title of ['Top Customers', 'Top Products', 'Recent Field Visits', 'Open Follow-ups']) assert.match(await dialog.locator('#rm-report-page-2').innerText(), new RegExp(title));
      for (const insight of (await page.locator('.rm-insight-detail-list > li').all()).slice(0, 2)) {
        for (const point of await insight.locator('ul > li').allTextContents()) assert.ok((await dialog.innerText()).includes(point));
      }
      const extraPageLayout = await dialog.locator('[data-rm-report-page]').evaluateAll(elements => elements.map(element => {
        const footer = element.lastElementChild.getBoundingClientRect();
        const content = element.firstElementChild.getBoundingClientRect();
        return { id: element.id, fits: content.bottom <= footer.top && footer.bottom <= element.getBoundingClientRect().bottom };
      }));
      assert.ok(extraPageLayout.every(item => item.fits), JSON.stringify(extraPageLayout));
      const layout = await page.locator('#rm-report-page-2').evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const footer = element.lastElementChild.getBoundingClientRect();
        const content = element.firstElementChild.getBoundingClientRect();
        return { contained: [...element.querySelectorAll('.pdf-thrust-product, tbody tr')].every(row => {
          const box = row.getBoundingClientRect();
          return box.top >= bounds.top && box.bottom <= footer.top && box.left >= bounds.left && box.right <= bounds.right;
        }), noOverlap: content.bottom <= footer.top };
      });
      assert.deepEqual(layout, { contained: true, noOverlap: true }, `${period} page content fits above the footer`);
      if (period === 'This Month' || period === 'FYTD') {
        await page.locator('#rm-report-page-2').screenshot({ path: 'scratch/rm-thrust-report-page2.png' });
        const downloadPromise = page.waitForEvent('download');
        const expectedPages = await dialog.locator('[data-rm-report-page]').count();
        assert.equal(expectedPages, 2);
        await dialog.getByRole('button', { name: 'Download PDF', exact: true }).click();
        const download = await downloadPromise;
        await download.saveAs('scratch/rm-thrust-report.pdf');
        if (period === 'This Month') await download.saveAs('scratch/rm-month-weekly.pdf');
        const pdf = readFileSync('scratch/rm-thrust-report.pdf');
        assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
        assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length, expectedPages);
      }
      await dialog.getByRole('button', { name: /Close/ }).click();
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    db.prepare('DELETE FROM sessions WHERE token_hash=?').run(createHash('sha256').update(token).digest('hex'));
  }
});
