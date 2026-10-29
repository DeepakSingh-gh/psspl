import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { db } from '../server/db.mjs';
import { createSession } from '../server/auth.mjs';

test('sales reports generate, filter, refresh, group and export the displayed report', { timeout: 120000 }, async () => {
  const user = db.prepare("SELECT id FROM users WHERE role='admin' AND active=1 LIMIT 1").get();
  const { token } = createSession(user.id);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => localStorage.setItem('psspl_crm_session', value), token);
    let requests = 0;
    page.on('request', request => { if (request.url().includes('/api/admin/reports/sales?')) requests++; });
    const response = () => page.waitForResponse(r => r.url().includes('/api/admin/reports/sales?') && r.status() === 200);
    const initial = response();
    await page.goto('http://localhost:3000/admin/reports');
    await initial;
    const ready = () => page.getByRole('button', { name: 'Save report', exact: true }).waitFor();
    await ready();
    const loaded = response();
    await page.getByRole('button', { name: 'Financial year to date', exact: true }).click();
    const report = await (await loaded).json();
    assert.ok(report.summary.invoiceCount > 0);
    for (const key of ['monthly', 'bySalesperson', 'byRegion', 'byCustomer']) {
      assert.ok(Math.abs(report[key].reduce((sum, row) => sum + row.salesValue, 0) - report.summary.totalSales) < 0.01, key);
    }
    await page.getByRole('button', { name: 'CSV', exact: true }).waitFor();
    for (const view of ['monthly', 'product', 'salesperson', 'region', 'customer']) {
      await page.getByRole('combobox', { name: 'Group report by' }).selectOption(view);
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'CSV', exact: true }).click();
      const file = await download;
      const content = readFileSync(await file.path(), 'utf8');
      assert.ok(content.includes(String(report.summary.totalSales)));
      const rows = view === 'monthly' ? report.monthly : report[{ product: 'byProduct', salesperson: 'bySalesperson', region: 'byRegion', customer: 'byCustomer' }[view]];
      assert.equal(content.split('\n').length, rows.length + 6, 'export includes all rows, independently of pagination');
    }
    const excel = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Excel', exact: true }).click();
    assert.match(readFileSync(await (await excel).path(), 'utf8'), /<table>/);
    await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
    await page.getByRole('button', { name: 'Print / Save PDF', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__printed), true);
    assert.equal(await page.locator('.sales-report-print tbody tr').count(), report.byCustomer.length);
    let saved;
    let failSave = false;
    await page.route('**/api/admin/reports/history', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      saved = route.request().postDataJSON();
      await route.fulfill({ status: failSave ? 500 : 201, json: failSave ? { error: 'Save failed for verification' } : { id: 'browser-only', summary: report.summary } });
    });
    await page.getByRole('button', { name: 'Save report', exact: true }).click();
    await page.getByText('Filtered report saved to history.', { exact: true }).waitFor();
    assert.deepEqual(saved, { from: report.from, to: report.to, view: 'customer', filters: report.filters });
    failSave = true;
    await page.getByRole('button', { name: 'Save report', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Save failed for verification' }).waitFor();
    const count = requests;
    await page.locator('input[type=date]').first().fill('2026-10-16');
    assert.equal(requests, count, 'draft filters do not load on every keystroke');
    assert.equal(await page.getByRole('button', { name: 'CSV', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Save report', exact: true }).isDisabled(), true);
    const filtered = response();
    await page.getByRole('button', { name: 'Generate report', exact: true }).click();
    assert.equal((await (await filtered).json()).summary.invoiceCount, 0);
    await page.getByText('No invoices match this period.', { exact: false }).waitFor();
    const regenerated = response();
    await page.getByRole('button', { name: 'Generate report', exact: true }).click();
    await regenerated;
    await page.locator('input[type=date]').first().fill('2027-01-01');
    await page.getByRole('button', { name: 'Generate report', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Choose a valid' }).waitFor();
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    db.prepare('DELETE FROM sessions WHERE token_hash=?').run(createHash('sha256').update(token).digest('hex'));
  }
});
