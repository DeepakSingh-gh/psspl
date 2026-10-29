import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

// Run against a local Next dev server. Every API request is mocked: no account,
// sales, email-provider or production database requests are issued by this test.
const appUrl = process.env.CRM_BROWSER_TEST_URL || 'http://localhost:3000';
const reports = JSON.parse(readFileSync(new URL('../server/data/rm-feedback-snapshots.json', import.meta.url), 'utf8')).reports;

test('original admin and RM report cards receive snapshots without extra tabs or replacement layouts', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let role = 'admin';
    const anil = reports.find(report => report.id === 'aniljena');
    const ketan = reports.find(report => report.id === 'ketanbhatt');
    let mapped = true;
    const live = { id: 'aniljena', name: 'Anil Jena', ownershipMapping: 'ambiguous', feedbackSnapshotId: 'aniljena', kpi: {}, reportingThresholds: {}, managementInsights: [], actualSales: [], customerVisits: [], pipeline: [], followUps: [], topProducts: [], topDealers: [], dormantDealers: [], monthlyTargetVsActual: [] };
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let data = {};
      if (path.endsWith('/auth/me')) data = { user: { id: 'fixture', name: role === 'rm' ? 'Ketan Bhat' : 'Test Admin', role, email: 'fixture@example.test' } };
      else if (path.endsWith('/rm/dashboard')) data = { manager: { fullName: 'Ketan Bhat', region: 'Test', territory: 'Test' }, members: [], summary: {}, pipeline: [] };
      else if (path.endsWith('/rm/report-card')) data = { profile: { fullName: 'Ketan Bhat', region: 'Test' }, period: { from: '2026-10-01', to: '2026-10-21' }, fieldActivity: {}, pipeline: { high: {}, medium: {}, low: {} }, topProducts: [], topDealers: [], dormantDealers: [] };
      else if (path.endsWith('/rm/print-report')) {
        await route.fulfill(mapped ? { json: ketan } : { status: 404, json: { error: 'No supplied report' } });
        return;
      } else if (path.endsWith('/ai-analysis')) data = { provider: 'claude', items: [{ id: 'claude-monthly', severity: 'high', title: 'Claude recovery recommendation', action: 'Review qualified pipeline with the manager.', metric: '43% of reported month (Sep 2026) target (supplied PDF)', period: { from: '2026-09-01', to: '2026-09-30' }, thresholdsProvisional: true }] };
      else if (path.includes('/admin/rm-feedback/')) data = anil;
      else if (path.includes('/admin/team/')) {
        const parameters = new URL(route.request().url()).searchParams;
        data = { ...live, from: parameters.get('from'), to: parameters.get('to'), feedbackSnapshotId: mapped ? 'aniljena' : null };
      }
      await route.fulfill({ json: data });
    });
    await page.goto(`${appUrl}/admin/team/aniljena?fy=2026-27`);
    await page.getByText('43% of reported month (Sep 2026) target (supplied PDF)', { exact: true }).first().waitFor();
    await page.getByText('Claude recovery recommendation', { exact: true }).first().waitFor();
    assert.equal(await page.getByRole('tab', { name: /Manager Action Plan/ }).getAttribute('aria-selected'), 'true');
    assert.equal(await page.getByRole('tab').count(), 8);
    assert.equal(await page.getByRole('tab', { name: 'PDF Feedback', exact: true }).count(), 0);
    assert.equal(await page.locator('.feedback-report').count(), 0);
    await page.getByRole('tab', { name: 'AI Insights', exact: true }).click();
    await page.getByText(/Claude recommendations from the selected report evidence/).waitFor();
    await page.getByText('Claude recovery recommendation', { exact: true }).first().waitFor();
    await page.getByRole('button', { name: 'This Month', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Download Report', exact: true }).waitFor();
    await page.getByRole('tab', { name: /Report Card/ }).click();
    await page.getByText('Monthly Sales Target vs Achievement', { exact: true }).waitFor();
    await page.getByText('Total Thrust Sales', { exact: true }).waitFor();
    await page.screenshot({ path: 'scratch/rm-feedback/original-admin-ui-restored.png', fullPage: true });
    await page.getByRole('button', { name: 'FYTD', exact: true }).click();
    await page.getByRole('button', { name: 'Download Report', exact: true }).click();
    await page.getByText(/Ready for direct PDF download/).waitFor();
    assert.equal(await page.locator('.feedback-report').count(), 0);
    role = 'rm';
    await page.goto(`${appUrl}/rm/report-card`);
    await page.getByText(/reported month \(Sep 2026\).*PDF as of/).first().waitFor();
    assert.equal(await page.locator('.feedback-report').count(), 0);
    await page.screenshot({ path: 'scratch/rm-feedback/original-rm-ui-restored.png', fullPage: true });
    await page.goto(`${appUrl}/rm/print-report`);
    await page.locator('.print-report-container').waitFor();
    assert.match(await page.locator('.print-report-container').innerText(), /Ketan Bhatt/);
    assert.doesNotMatch(await page.locator('.print-report-container').innerText(), /Anil Jena|Sandeep/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
