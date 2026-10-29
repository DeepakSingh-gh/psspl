import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { db } from '../server/db.mjs';
import { createSession } from '../server/auth.mjs';
import { presentAiAnswer } from '../server/ai-answer-presentation.mjs';

test('Ask AI shows readable facts, grouped missing data and a focused RM answer on desktop and mobile', { timeout: 120000 }, async () => {
  const { token } = createSession(db.prepare("SELECT id FROM users WHERE role='admin' AND active=1 LIMIT 1").get().id);
  const browser = await chromium.launch({ headless: true });
  const snapshot = {
    scope: 'admin', period: { from: '2026-04-01', to: '2026-10-22' },
    data: { status: 'age-requires-review', lastCompletedAt: '2026-10-10T12:31:53.237Z', ageHours: 281.3 },
    sales: { salesValue: 180565444.28, invoiceCount: 1496 },
    rmPerformance: [
      ...['Gowri Shankar', 'Harsh Shah', 'Ketan Bhat', 'Nazmul Islam', 'Pradeep Mulik', 'Rais Khan', 'Sourav Ranjit', 'V Ramesh Kumar', 'Vilas Kharabe', 'YP Sharma'].map(name => ({ name, performance: { actual: null, target: null, achievementPercent: null } })),
      { name: 'Anil Jena', performance: { actual: 140136103.33, target: 30062000, achievementPercent: 466 } },
    ],
    pipeline: [{ stage: 'lead', count: 1, value: 2000000 }, { stage: 'won', count: 1, value: 2000000000000 }],
    followUps: { pending: 0, overdue: 0, dueToday: 0 },
    visits: { completedInPeriod: 5, upcomingToday: 0, pastScheduled: 9 },
  };
  try {
    mkdirSync('scratch', { recursive: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => localStorage.setItem('psspl_crm_session', value), token);
    await page.route('**/api/admin/ask-ai', route => {
      const question = route.request().postDataJSON().question;
      return route.fulfill({ json: { ...presentAiAnswer(snapshot, ['rmPerformance', 'sales', 'pipeline', 'followUps', 'visits'], question), from: snapshot.period.from, to: snapshot.period.to, source: 'Tally' } });
    });
    await page.goto('http://localhost:3000/admin/ask-ai');
    await page.getByRole('textbox', { name: 'Your question', exact: true }).fill('Show the overall business summary');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    const answer = page.locator('.askai-simple-answer');
    await answer.waitFor();
    assert.match(await answer.innerText(), /₹18\.06 crore/);
    assert.match(await answer.innerText(), /₹2,00,000 crore/);
    assert.doesNotMatch(await answer.innerText(), /evidence:|age-requires-review|281\.3|actual INR unavailable/);
    assert.equal(await page.locator('.askai-simple-missing').getAttribute('open'), null);
    await page.getByText('RMs with missing numbers (10)', { exact: true }).click();
    assert.match(await page.locator('.askai-simple-missing').innerText(), /Rais Khan/);
    await page.getByText('RMs with missing numbers (10)', { exact: true }).click();
    await answer.screenshot({ path: 'scratch/ask-ai-simple-desktop.png' });
    await page.getByRole('button', { name: 'Copy', exact: true }).click();
    assert.doesNotMatch(await page.evaluate(() => navigator.clipboard.readText()), /evidence:|age-requires-review/);
    await page.getByRole('textbox', { name: 'Your question', exact: true }).fill('Why are Rais Khan monthly sales below target?');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await answer.getByRole('heading', { name: 'Rais Khan: sales check', exact: true }).waitFor();
    assert.doesNotMatch(await answer.innerText(), /Anil Jena|across the business|₹18\.06 crore/);
    assert.match(await answer.innerText(), /does not mean sales are zero/);
    await page.setViewportSize({ width: 390, height: 844 });
    await answer.screenshot({ path: 'scratch/ask-ai-simple-mobile.png' });
    const overflow = await page.evaluate(() => [...document.querySelectorAll('.admin-content *')].filter(element => element.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(element => ({ tag: element.tagName, class: element.className, right: element.getBoundingClientRect().right })));
    assert.ok(await page.evaluate(() => document.querySelector('.admin-content').scrollWidth <= innerWidth), JSON.stringify(overflow));
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    db.prepare('DELETE FROM sessions WHERE token_hash=?').run(createHash('sha256').update(token).digest('hex'));
  }
});
