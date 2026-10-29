import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { db } from '../server/db.mjs';
import { createSession } from '../server/auth.mjs';

test('admin navigation shares in-flight trends prefetch, reuses fresh data and refreshes on demand', { timeout: 120000 }, async () => {
  const user = db.prepare("SELECT id FROM users WHERE role='admin' AND active=1 LIMIT 1").get();
  const { token } = createSession(user.id);
  const browser = await chromium.launch({ headless: true });
  let release;
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    let requests = 0;
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => localStorage.setItem('psspl_crm_session', value), token);
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/api/admin/product-trends*', async route => {
      requests++;
      if (requests === 1) await gate;
      await route.continue();
    });
    await page.goto('http://localhost:3000/admin/products');
    await page.getByRole('heading', { name: 'Products', exact: true }).waitFor();
    const trends = page.locator('.admin-sidebar').getByRole('link', { name: 'Product trends', exact: true });
    const pending = page.waitForRequest(request => new URL(request.url()).pathname === '/api/admin/product-trends');
    await trends.hover();
    await pending;
    const start = performance.now();
    await trends.click();
    await page.getByRole('heading', { name: 'Product & territory trends' }).waitFor();
    release();
    await page.locator('.pi-summary').waitFor();
    assert.equal(requests, 1, 'page must reuse the hover request even when it is still running');
    console.log(JSON.stringify({ firstNavigationMs: Math.round(performance.now() - start) }));
    const summary = await page.locator('.pi-summary').innerText();
    await page.locator('.admin-sidebar').getByRole('link', { name: 'Products', exact: true }).click();
    await page.getByRole('heading', { name: 'Products', exact: true }).waitFor();
    const revisit = performance.now();
    await page.locator('.admin-sidebar').getByRole('link', { name: 'Product trends', exact: true }).click();
    await page.locator('.pi-summary').waitFor();
    console.log(JSON.stringify({ cachedNavigationMs: Math.round(performance.now() - revisit) }));
    assert.equal(requests, 1, 'fresh cache must prevent another trends calculation');
    assert.equal(await page.locator('.pi-summary').innerText(), summary);
    const refreshed = page.waitForResponse(response => new URL(response.url()).pathname === '/api/admin/product-trends');
    await page.getByRole('button', { name: 'Refresh data on this page', exact: true }).click();
    assert.equal((await refreshed).status(), 200);
    assert.equal(requests, 2, 'explicit refresh must request current data');
    assert.deepEqual(errors, []);
  } finally {
    release?.();
    await browser.close();
    db.prepare('DELETE FROM sessions WHERE token_hash=?').run(createHash('sha256').update(token).digest('hex'));
  }
});
