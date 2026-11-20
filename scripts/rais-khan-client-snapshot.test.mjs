import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { raisKhanClientSnapshot } from '../src/lib/rais-khan-client-snapshot.mjs';
import { finalReportFixture } from './fixtures/rm-report-finalization.mjs';

test('retired snapshot adapter preserves source amounts, precision, zeros and input identity', () => {
  const raw = finalReportFixture();
  raw.weekRows[1].achievementPercent = 50.71;
  raw.yearRows[0].actual = 0;
  const before = structuredClone(raw);
  assert.equal(raisKhanClientSnapshot(raw), raw);
  assert.deepEqual(raw, before);
});

test('source blanks and future actuals stay missing without allocating monthly or weekly values', () => {
  for (const financialYear of ['2025-26', '2026-27', '2027-28']) {
    const raw = finalReportFixture({ financialYear, reportType: 'monthly', month: 8 });
    raw.weekRows[1].actual = null;
    raw.weekRows[1].target = null;
    raw.yearRows[4].actual = null;
    raw.yearRows[4].target = 0;
    raw.summary.actual = null;
    raw.summary.growthPercent = null;
    const before = structuredClone(raw);
    assert.equal(raisKhanClientSnapshot(raw), raw);
    assert.deepEqual(raw, before);
    assert.equal(raw.weekRows[1].actual, null);
    assert.equal(raw.yearRows[4].actual, null);
  }
});

test('empty identity, CRM entries and configured portfolio never acquire client snapshot content', () => {
  const raw = finalReportFixture();
  Object.assign(raw, { operatingFrom: null, territory: null, technicalService: null, myDayEntries: [] });
  raw.thrustYtd.products = [];
  const result = raisKhanClientSnapshot(raw);
  assert.equal(result.operatingFrom, null);
  assert.equal(result.territory, null);
  assert.equal(result.technicalService, null);
  assert.deepEqual(result.myDayEntries, []);
  assert.deepEqual(result.thrustYtd.products, []);
  assert.equal(result.clientSnapshotFallback, undefined);
});

test('browser preserves API blanks in Rais report, drill-down and PDF', { skip: process.env.CRM_BROWSER_TEST !== '1', timeout: 120000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.addInitScript(() => localStorage.setItem('psspl_crm_session', 'isolated-fixture'));
    await page.route('**/api/**', route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/auth/me') return route.fulfill({ json: { user: { id: 'test-admin', role: 'admin', email: 'fixture@example.test' } } });
      if (url.searchParams.get('reportVersion') === '2') {
        const data = finalReportFixture(Object.fromEntries(url.searchParams));
        data.myDayEntries = [];
        data.weekRows[1].actual = null;
        data.weekRows[1].achievementPercent = null;
        data.weekRows[1].variation = null;
        return route.fulfill({ json: data });
      }
      return route.fulfill({ json: {} });
    });
    await page.goto('http://localhost:3000/admin/team/raiskhan');
    await page.getByRole('heading', { name: 'Rais Khan', exact: true }).waitFor();
    assert.match(await page.locator('.rm-v2-summary').innerText(), /53\.00 L/);
    assert.equal(await page.locator('[data-thrust-product]').count(), 15);
    assert.match(await page.locator('[data-thrust-product=zero]').innerText(), /0\.00 L/);
    assert.match(await page.locator('[data-report-section=my-day-inputs]').innerText(), /No saved entries/);
    assert.equal(await page.getByRole('button', { name: /Start.*Preview/ }).count(), 0);
    await page.locator('.rm-v2-month-chart g[role=button]').filter({ hasText: 'Aug' }).click();
    await page.locator('.rm-v2-week-chart g[role=button]').nth(1).waitFor();
    await page.locator('.rm-v2-week-chart g[role=button]').nth(1).focus();
    assert.match(await page.locator('.rm-v2-tooltip').innerText(), /Actual sales\s+N\/A/);
    await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
    await page.locator('[data-pagination-ready=true]').waitFor();
    const pages = page.locator('[data-rm-report-page]');
    const text = (await pages.allTextContents()).join(' ');
    assert.match(text, /No saved entries/);
    assert.doesNotMatch(text, /Capital Marketing Corp|Al Sarah Chemicals|Demo Data|14\.07%|41\.93 L/);
    assert.equal(await pages.evaluateAll(nodes => nodes.filter(p => p.querySelector('.rm-v2-pdf-page-content').getBoundingClientRect().bottom > p.querySelector('footer').getBoundingClientRect().top - 4).length), 0);
  } finally { await browser.close(); }
});
