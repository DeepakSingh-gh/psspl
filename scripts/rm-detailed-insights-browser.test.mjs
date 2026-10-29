import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { db } from '../server/db.mjs';
import { createSession } from '../server/auth.mjs';

test('detailed AI insights explain reported figures in points and keep operational periods separate', { timeout: 120000 }, async () => {
  const user = db.prepare("SELECT id FROM users WHERE role='admin' AND active=1 LIMIT 1").get();
  const { token } = createSession(user.id);
  const browser = await chromium.launch({ headless: true });
  mkdirSync('scratch', { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => localStorage.setItem('psspl_crm_session', value), token);
    await page.route('**/api/admin/team/*/ai-analysis', route => route.fulfill({ json: { provider: 'claude', items: [
      { id: 'visit-completion', title: 'Planned visits remain incomplete', severity: 'medium' },
      { id: 'claude-monthly', title: 'Monthly performance', severity: 'high' },
    ] } }));
    await page.goto('http://localhost:3000/admin/team/raiskhan?fy=2026-27');
    await page.getByRole('tab', { name: 'AI Insights', exact: true }).click();
    const details = page.getByRole('region', { name: 'Detailed AI insights', exact: true });
    await details.waitFor();
    assert.equal(await details.locator('.rm-insight-detail-list > li').count(), 3);
    assert.equal(await page.locator('.rm-insight-tile').count(), 0);
    assert.equal(await page.locator('.rm-insight-tile').getByRole('heading', { name: /Best sales month|Months that reached target/ }).count(), 0);
    assert.equal(await page.getByRole('heading', { name: 'Quick sales summary', exact: true }).count(), 0);
    const text = await details.innerText();
    assert.match(text, /Latest month in the report: sales are ₹6\.56 L and the target is ₹11\.28 L/);
    assert.match(text, /₹4\.72 L more is needed/);
    assert.match(text, /₹78,000 lower/);
    assert.doesNotMatch(text, /Best sales month|Months that reached target|Months below target:/);
    assert.match(text, /The report does not give sales for each product/);
    assert.doesNotMatch(text, /North Star Traders|Pragati Chemicals/);
    await details.screenshot({ path: 'scratch/rm-detailed-insights-desktop.png' });
    await page.getByRole('button', { name: 'FYTD', exact: true }).click();
    await details.getByRole('heading', { name: 'So far this financial year: sales and target', exact: true }).waitFor();
    assert.equal(await details.locator('.rm-insight-detail-list > li').count(), 5);
    assert.equal(await details.getByRole('heading', { name: 'Best sales month', exact: true }).count(), 1);
    assert.equal(await details.getByRole('heading', { name: 'Months that reached target', exact: true }).count(), 1);
    assert.equal(await page.locator('.rm-insight-tile').count(), 0);
    assert.equal(await page.locator('.rm-insight-tile').getByRole('heading', { name: /Best sales month|Months that reached target/ }).count(), 0);
    assert.match(await details.innerText(), /Months below target:/);
    assert.match(await details.innerText(), /₹53\.14 L and the target is ₹62\.53 L/);
    await page.getByRole('button', { name: 'Today', exact: true }).click();
    await details.getByRole('heading', { name: 'Today: sales and target', exact: true }).waitFor();
    const today = await details.innerText();
    assert.match(today, /the target is not available/);
    assert.doesNotMatch(today, /Best sales month|Months that reached target/);
    assert.doesNotMatch(today, /Months below target|₹86,000|₹53\.14 L/);
    await page.getByRole('button', { name: 'This Week', exact: true }).click();
    await details.getByRole('heading', { name: 'This week: sales and target', exact: true }).waitFor();
    assert.doesNotMatch(await details.innerText(), /Best sales month|Months that reached target/);
    await page.getByRole('button', { name: 'This Month', exact: true }).click();
    await details.getByRole('heading', { name: 'Latest month in the report: sales and target', exact: true }).waitFor();
    assert.equal(await details.locator('.rm-insight-detail-list > li').count(), 3);
    assert.doesNotMatch(await details.innerText(), /Best sales month|Months that reached target/);
    await page.setViewportSize({ width: 390, height: 844 });
    await details.scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.querySelector('.admin-content').scrollWidth <= innerWidth));
    await details.screenshot({ path: 'scratch/rm-detailed-insights-mobile.png' });
    await page.getByRole('button', { name: 'View next steps', exact: true }).click();
    assert.equal(await page.getByRole('tab', { name: /Manager Action Plan/ }).getAttribute('aria-selected'), 'true');
    const plan = await page.locator('.admin-card').last().innerText();
    assert.match(plan, /Ask AI: "Rais Khan:/);
    assert.match(plan, /What happened\? Why might this have happened\? What should we do next\?/);
    assert.match(plan, /Ask the RM which visits are still pending/);
    assert.match(plan, /Save what happened during each visit, or set a new visit date/);
    assert.doesNotMatch(plan, /reschedule|outcomes|priority deals|shortfall/);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    db.prepare('DELETE FROM sessions WHERE token_hash=?').run(createHash('sha256').update(token).digest('hex'));
  }
});
