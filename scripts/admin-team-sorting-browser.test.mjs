import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

test('poor/good sorting uses achievement despite a missing target and shows historical sales separately', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const members = [
      ['nazmul', 'Nazmul Islam', 140, 1049000], ['vijay', 'Vijay Nair', null, 0],
      ['anil', 'Anil Jena', 45, 11424000], ['pradeep', 'Pradeep Mulik', 593, 39792000],
    ].map(([id, name, achievementPercent, salesValue]) => ({ id, name, achievementPercent, salesValue, aliases: [], sources: [], targetValue: achievementPercent == null ? 0 : 1000000, monthlyTargetValue: 100000, customerCount: 0, outstanding: 0, salespeopleCount: 0, topProduct: null, previousSalesValue: 0, growthPercent: null, visitsTotal: 0, visitsCompleted: 0, followUpsOpen: 0, checkedInToday: false, crmUser: null, financialDataStatus: id === 'vijay' ? 'unavailable' : 'available', reportSource: id === 'vijay' ? null : { kind: 'supplied_pdf_snapshot', asOf: '2026-09-30', financialYear: '2026-27' }, historicalSales: id === 'vijay' ? [{ financialYear: '2025-26', salesValue: 7880696.03, source: 'imported_workbook' }, { financialYear: '2024-25', salesValue: 6791033.39, source: 'imported_workbook' }] : [] }));
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      const data = path.endsWith('/auth/me') ? { user: { id: 'fixture', email: 'fixture@example.test', role: 'admin' } }
        : path.endsWith('/admin/team') ? { financialYear: '2026-27', financialYears: ['2026-27'], targetMonths: 6, members, thrustLeaderboard: [], unassignedCustomers: 0, unassignedSalesValue: 0, liveInvoiceCount: 0, hasTargets: true } : {};
      return route.fulfill({ json: data });
    });
    await page.goto(`${process.env.CRM_BROWSER_TEST_URL || 'http://localhost:3000'}/admin/team`);
    await page.locator('.rm-name-link').first().waitFor();
    const order = () => page.locator('.rm-name-link').evaluateAll(links => links.map(link => new URL(link.href).pathname.split('/').pop()));
    assert.deepEqual(await order(), ['anil', 'nazmul', 'pradeep', 'vijay']);
    const vijay = page.getByRole('row').filter({ has: page.locator('.rm-name-link[href*="vijay"]') });
    await vijay.getByText('Selected FY data unavailable', { exact: true }).waitFor();
    assert.match(await vijay.innerText(), /78\.81 L/);
    assert.match(await vijay.innerText(), /67\.91 L/);
    await page.getByLabel('Sort performance').selectOption('desc');
    assert.deepEqual(await order(), ['pradeep', 'nazmul', 'anil', 'vijay']);
    await page.getByLabel('Sort performance').selectOption('asc');
    assert.deepEqual(await order(), ['anil', 'nazmul', 'pradeep', 'vijay']);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
