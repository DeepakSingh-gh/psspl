import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

test('Pradeep annual/monthly ratios remain uncapped and missing months never show zero achievement', { timeout: 90000 }, async () => {
  const reports = JSON.parse(readFileSync(new URL('../server/data/rm-feedback-snapshots.json', import.meta.url), 'utf8')).reports;
  let snapshot = reports.find(report => report.id === 'pradeepmulik');
  let role = 'admin';
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let data = {};
      if (path.endsWith('/auth/me')) data = { user: { id: 'fixture', email: 'fixture@example.test', role } };
      else if (path.endsWith('/ai-analysis')) data = { provider: 'claude', items: [] };
      else if (path.includes('/admin/rm-feedback/')) data = snapshot;
      else if (path.includes('/admin/team/')) data = { name: snapshot.rm.name, from: '2026-10-01', to: '2026-10-21', feedbackSnapshotId: snapshot.id, kpi: {}, actualSales: [], customerVisits: [], pipeline: [], followUps: [], monthlyTargetVsActual: [] };
      else if (path.endsWith('/rm/report-card')) data = { profile: { fullName: snapshot.rm.name }, period: { from: '2026-10-01', to: '2026-10-21' }, fieldActivity: {}, pipeline: { high: {}, medium: {}, low: {} }, topProducts: [], topDealers: [], dormantDealers: [] };
      else if (path.endsWith('/rm/print-report')) data = snapshot;
      await route.fulfill({ json: data });
    });
    const appUrl = process.env.CRM_BROWSER_TEST_URL || 'http://localhost:3000';
    await page.goto(`${appUrl}/admin/team/pradeepmulik?fy=2026-27`);
    await page.getByRole('tab', { name: /Report Card/ }).click();
    await page.locator('.rm-kpi-grid').getByText('1030%', { exact: true }).waitFor();
    const annual = page.getByText('Annual Target Achievement', { exact: true }).locator('..');
    assert.match(await annual.innerText(), /301% achieved/);
    const svg = page.locator('svg').filter({ hasText: "Dec '26" }).first();
    assert.equal(await svg.locator('rect[fill="#0284c7"]').count(), 0, 'no fake blue zero bars for missing months');
    assert.equal(await svg.locator('rect[fill="#16a34a"]').count(), 6);
    await svg.locator('rect[fill="transparent"]').nth(8).hover();
    const december = page.getByText("Dec '26 Performance", { exact: true }).locator('..');
    assert.match(await december.innerText(), /Data unavailable/);
    assert.doesNotMatch(await december.innerText(), /0%/);
    await svg.locator('rect[fill="transparent"]').nth(4).hover();
    assert.match(await page.getByText("Aug '26 Performance", { exact: true }).locator('..').innerText(), /1461%/);
    await page.getByRole('button', { name: 'FYTD', exact: true }).click();
    await page.locator('.rm-kpi-grid').getByText('593%', { exact: true }).waitFor();
    role = 'rm';
    await page.goto(`${appUrl}/rm/report-card`);
    await page.locator('.rm-kpi-grid').getByText('1030%', { exact: true }).waitFor();
    snapshot = reports.find(report => report.id === 'nazmulislam');
    await page.goto(`${appUrl}/rm/report-card`);
    await page.getByText('Achievement unavailable', { exact: true }).waitFor();
    assert.equal(await page.getByText('0% of monthly target achieved', { exact: true }).count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
