import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { db } from '../server/db.mjs';
import { createSession } from '../server/auth.mjs';

test('RM navigation shares prefetch, renders without waiting for AI and refreshes on demand', { timeout: 120000 }, async () => {
  const user = db.prepare("SELECT id FROM users WHERE role='admin' AND active=1 LIMIT 1").get();
  const { token } = createSession(user.id);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    let detailRequests = 0;
    let snapshotRequests = 0;
    let aiRequests = 0;
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname === '/api/admin/team/pradeepmulik') detailRequests++;
      if (url.pathname === '/api/admin/rm-feedback/pradeepmulik') snapshotRequests++;
    });
    await page.addInitScript(value => localStorage.setItem('psspl_crm_session', value), token);
    // Keep the AI provider out of this loading test; delayed AI must not block the report.
    let releaseAnalysis;
    const analysisGate = new Promise(resolve => { releaseAnalysis = resolve; });
    await page.route('**/api/admin/team/*/ai-analysis', async route => {
      aiRequests++;
      await analysisGate;
      await route.fulfill({ json: { provider: 'claude', items: [] } });
    });
    await page.goto('http://localhost:3000/admin/team');
    const link = page.locator('.rm-name-link[href*="pradeepmulik"]');
    await link.waitFor();
    assert.equal(await page.getByRole('columnheader', { name: 'CRM account', exact: true }).count(), 0);
    const prefetched = page.waitForResponse(response => new URL(response.url()).pathname === '/api/admin/team/pradeepmulik');
    await link.hover();
    assert.equal((await prefetched).status(), 200);
    const started = performance.now();
    await link.click();
    await page.getByRole('heading', { name: 'Pradeep Mulik', exact: true }).waitFor();
    await page.getByRole('tab', { name: /Report Card/ }).waitFor();
    console.log(JSON.stringify({ prefetchedNavigationMs: Math.round(performance.now() - started) }));
    assert.equal(detailRequests, 1, 'navigation reuses the prefetched report');
    assert.equal(snapshotRequests, 0, 'PDF snapshot arrives with the report');
    releaseAnalysis();
    await page.getByRole('tab', { name: 'AI Insights', exact: true }).click();
    await page.getByRole('tab', { name: /Manager Action Plan/ }).click();
    assert.equal(aiRequests, 1, 'switching AI tabs reuses the analysis');
    const refreshed = page.waitForResponse(response => new URL(response.url()).pathname === '/api/admin/team/pradeepmulik');
    await page.getByRole('button', { name: 'Refresh data on this page', exact: true }).click();
    assert.equal((await refreshed).status(), 200);
    assert.equal(detailRequests, 2, 'explicit refresh bypasses cached data');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    db.prepare('DELETE FROM sessions WHERE token_hash=?').run(createHash('sha256').update(token).digest('hex'));
  }
});
