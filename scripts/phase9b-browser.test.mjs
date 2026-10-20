import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { spawn, spawnSync, fork } from 'node:child_process';
import { createServer } from 'node:net';
import { chromium } from 'playwright';

const root = process.cwd();
const scratch = mkdtempSync(join(tmpdir(), 'psspl-phase9b-browser-'));
const copy = join(scratch, 'app');
const evidence = resolve(process.env.PSSPL_UAT_EVIDENCE_DIR || 'docs/uat/phase9b');
const skip = new Set(['.git', 'node_modules', '.next', '.next-runtime', 'data', 'docs', 'coverage', 'playwright-report', 'test-results']);
let api, web, browser;
let apiOutput = '', webOutput = '';
let appUrl = '', apiUrl = '';
const pageErrors = [];

function copyProject(source, target) {
  cpSync(source, target, { recursive: true, filter(item) {
    const rel = relative(root, item).split(/[\\/]/).filter(Boolean);
    if (rel.some(part => skip.has(part) || part.startsWith('.env'))) return false;
    return true;
  }});
  symlinkSync(join(root, 'node_modules'), join(target, 'node_modules'), 'junction');
}

async function freePort() {
  const probe = createServer();
  await new Promise((ok, fail) => probe.once('error', fail).listen(0, '127.0.0.1', ok));
  const port = probe.address().port;
  await new Promise((ok, fail) => probe.close(error => error ? fail(error) : ok()));
  return port;
}

function safeEnv(extra = {}) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/OPENAI|GEMINI|WHATSAPP|SUPABASE|DIRECT_URL|DATABASE_URL|CRM_ADMIN|NODE_OPTIONS/i.test(key)) delete env[key];
  return { ...env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', CRM_DISABLE_BASELINE_RESTORE: 'true', HOST: '127.0.0.1', WHATSAPP_DELIVERY_ENABLED: 'false', ...extra };
}

function capture(child, type) {
  child.stdout?.on('data', data => { if (type === 'api') apiOutput += data.toString(); else webOutput += data.toString(); });
  child.stderr?.on('data', data => { if (type === 'api') apiOutput += data.toString(); else webOutput += data.toString(); });
}

async function waitFor(url, child, getOutput, label) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`${label} exited early:\n${getOutput()}`);
    try { const response = await fetch(url); if (response.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error(`${label} did not become ready:\n${getOutput()}`);
}

async function signIn(page, role) {
  const email = `${role}@example.test`;
  await page.goto(`${appUrl}/login`);
  await page.getByLabel('Work email').fill(email);
  await page.locator('input[name="password"]').fill('Uat-only-2026!');
  await page.getByRole('button', { name: 'Sign in to CRM' }).click();
  const expectedPath = role === 'admin' ? '/admin' : role === 'rm' ? '/rm' : '/sales/my-day';
  try { await page.waitForURL(url => url.pathname === expectedPath, { timeout: 15000 }); }
  catch (error) { throw new Error(`${error.message}\nURL=${page.url()}\nForm error=${await page.locator('[role=alert]').allInnerTexts().catch(() => [])}`); }
}

async function blockExternal(context) {
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort();
  });
}

async function waitEnabled(locator) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (await locator.isEnabled()) return;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${await locator.innerText()} to become enabled`);
}

test.before(async () => {
  mkdirSync(evidence, { recursive: true });
  copyProject(root, copy);
  const layout = join(copy, 'src', 'app', 'layout.tsx');
  const layoutSource = readFileSync(layout, 'utf8')
    .replace('import { Inter } from "next/font/google";\n', '')
    .replace('const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });\n', '')
    .replace('className={inter.variable}', '');
  writeFileSync(layout, layoutSource);

  const port = await freePort();
  appUrl = `http://127.0.0.1:${port}`;
  api = fork(join(copy, 'scripts', 'phase8-fixture-server.mjs'), [], { cwd: copy, env: safeEnv({ NODE_ENV: 'test', CRM_ALLOWED_ORIGINS: appUrl }), silent: true });
  capture(api, 'api');
  const ready = await new Promise((resolveReady, reject) => {
    const timer = setTimeout(() => reject(new Error(`Synthetic API startup timeout:\n${apiOutput}`)), 20000);
    api.once('message', message => { clearTimeout(timer); resolveReady(message); });
    api.once('exit', code => { clearTimeout(timer); reject(new Error(`Synthetic API exited (${code}):\n${apiOutput}`)); });
  });
  assert.deepEqual(ready.schemaShim, [], 'fresh browser fixture must not patch schema');
  apiUrl = ready.base;

  const build = spawnSync(process.execPath, [join(copy, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build'], {
    cwd: copy,
    env: safeEnv({ CRM_DATABASE_PATH: join(scratch, 'unused-build.sqlite'), NEXT_PUBLIC_API_URL: `${apiUrl}/api` }),
    encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024,
  });
  writeFileSync(join(evidence, 'build.log'), `${build.stdout || ''}\n${build.stderr || ''}`);
  assert.equal(build.status, 0, `isolated browser build failed:\n${build.stdout}\n${build.stderr}`);

  web = spawn(process.execPath, [join(copy, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: copy, env: safeEnv({ NEXT_PUBLIC_API_URL: `${apiUrl}/api` }), stdio: ['ignore', 'pipe', 'pipe'],
  });
  capture(web, 'web');
  await waitFor(`${appUrl}/login`, web, () => webOutput, 'Next server');
  browser = await chromium.launch({ headless: true });
});

test.after(async () => {
  await browser?.close().catch(() => {});
  if (api?.connected && api.exitCode === null) api.send({ type: 'stop' });
  for (const child of [web, api]) {
    if (!child || child.exitCode !== null) continue;
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 5000))]);
    if (child.exitCode === null && process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    if (child.exitCode === null) child.kill();
    if (child.exitCode === null) await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 5000))]);
  }
  writeFileSync(join(evidence, 'server.log'), `API fixture:\n${apiOutput}\nNext production server:\n${webOutput}`);
  if (process.env.PSSPL_KEEP_PHASE9B_SCRATCH !== '1') rmSync(scratch, { recursive: true, force: true });
});

test('desktop role dashboards, reporting navigation, filters, and safe file downloads', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, acceptDownloads: true });
  await blockExternal(context);
  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));
  await signIn(page, 'admin');
  await page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ }).waitFor();
  await page.screenshot({ path: join(evidence, 'admin-dashboard-desktop.png'), fullPage: true });
  await page.getByRole('link', { name: 'Reports', exact: true }).click();
  await page.getByRole('heading', { name: 'Sales reports' }).waitFor();
  await page.getByLabel('Region').fill('North');
  await page.getByRole('button', { name: 'Generate report' }).click();
  await page.locator('.admin-stats').getByText('₹900', { exact: true }).waitFor();
  const csvButton = page.getByRole('button', { name: 'CSV', exact: true });
  await waitEnabled(csvButton);
  const csvPromise = page.waitForEvent('download'); await csvButton.click(); const csv = await csvPromise;
  assert.match(csv.suggestedFilename(), /\.csv$/);
  await csv.saveAs(join(evidence, csv.suggestedFilename()));
  const excelButton = page.getByRole('button', { name: 'Excel', exact: true });
  await waitEnabled(excelButton);
  const excelPromise = page.waitForEvent('download'); await excelButton.click(); const excel = await excelPromise;
  assert.match(excel.suggestedFilename(), /\.xls$/);
  await excel.saveAs(join(evidence, excel.suggestedFilename()));
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  assert.ok(pdf.length > 1000, 'print layout should produce a non-empty PDF');
  writeFileSync(join(evidence, 'sales-report-desktop.pdf'), pdf);
  await page.screenshot({ path: join(evidence, 'admin-reports-desktop.png'), fullPage: true });
  await context.close();

  const rmContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await blockExternal(rmContext);
  const rmPage = await rmContext.newPage();
  await signIn(rmPage, 'rm');
  await rmPage.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
  await rmPage.getByText('UAT Rep', { exact: true }).waitFor();
  await rmPage.goto(`${appUrl}/rm/team`);
  await rmPage.getByRole('heading', { name: 'My team performance' }).waitFor();
  await assertVisibleViewport(rmPage, 'RM team desktop');
  await rmContext.close();

  const repContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await blockExternal(repContext);
  const repPage = await repContext.newPage();
  await signIn(repPage, 'rep');
  await repPage.getByRole('heading', { name: 'My Day', exact: true }).waitFor();
  await assertVisibleViewport(repPage, 'salesperson My Day desktop');
  const callForm = repPage.locator('form').filter({ has: repPage.getByLabel('Purpose') });
  await callForm.getByLabel('Purpose').fill('Browser test');
  await callForm.getByRole('button', { name: 'Save call' }).click();
  assert.equal(await callForm.locator('[name="outcome"]').evaluate(el => el.validity.valueMissing), true, 'required call outcome blocks incomplete form submission');
  await repPage.getByRole('button', { name: /Add unplanned visit/i }).click();
  await repPage.getByText('UNPLANNED VISIT', { exact: true }).waitFor();
  await repPage.screenshot({ path: join(evidence, 'sales-visit-form-desktop.png'), fullPage: true });
  const visitFormButtons = repPage.locator('.visit-modal button');
  assert.ok(await visitFormButtons.count() >= 2, 'visit form and customer picker render');
  await visitFormButtons.nth(1).click();
  const customerOption = repPage.locator('.visit-modal form > label > div > div > div').first();
  await customerOption.waitFor({ state: 'visible' });
  assert.match(await customerOption.innerText(), /UAT Dealer/);
  await repPage.screenshot({ path: join(evidence, 'sales-visit-picker-desktop.png'), fullPage: true });
  await customerOption.click();
  assert.equal(await repPage.locator('.visit-modal input[name="customerId"]').inputValue(), 'customer');
  await repPage.screenshot({ path: join(evidence, 'sales-my-day-desktop.png'), fullPage: true });
  await repPage.locator('.visit-modal .close').click();
  await repPage.getByRole('link', { name: 'Customer DB' }).click();
  await repPage.waitForURL(/\/sales\/hub$/);
  for (const [tab, heading] of [['Pipeline', 'Lead Pipeline'], ['Requests', 'Sales support action'], ['Alerts', 'Overdue commitments'], ['Reports', 'Choose any date range']]) {
    await repPage.getByRole('button', { name: tab, exact: true }).click();
    await repPage.getByRole('heading', { name: heading, exact: true }).waitFor();
  }
  await repContext.close();
  assert.deepEqual(pageErrors, [], `browser page errors: ${pageErrors.join('; ')}`);
});

test('admin can resend invitation from an inactive account created without email delivery', async () => {
  const setProvider = async enabled => {
    const acknowledged = new Promise(resolve => api.once('message', resolve));
    api.send({ type: 'set-email-provider', enabled });
    await acknowledged;
  };
  await setProvider(false);
  try {
    const login = await fetch(`${apiUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.test', password: 'Uat-only-2026!' }) });
    assert.equal(login.status, 200);
    const { token } = await login.json();
    const created = await fetch(`${apiUrl}/api/admin/users`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ email: 'browser.late.invite@example.test', role: 'rm', fullName: 'Browser Late Invite' }) });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).user.invitationPending, false);
    await setProvider(true);

    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    try {
      await blockExternal(context);
      const page = await context.newPage();
      await signIn(page, 'admin');
      await page.goto(`${appUrl}/admin/users`);
      await page.getByLabel('Search people').fill('browser.late.invite@example.test');
      await page.getByRole('row').filter({ hasText: 'browser.late.invite@example.test' }).getByRole('button', { name: 'Manage' }).click();
      const resend = page.getByRole('button', { name: 'Resend invitation' });
      await resend.waitFor();
      await resend.click();
      await page.getByText(/Resend accepted a new invitation email/).waitFor();
    } finally {
      await context.close();
    }
  } finally {
    await setProvider(true);
  }
});

test('mobile viewport navigation and authenticated field forms remain usable without horizontal overflow', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await blockExternal(context);
  const page = await context.newPage();
  await signIn(page, 'rep');
  await page.getByRole('heading', { name: 'My Day', exact: true }).waitFor();
  await assertVisibleViewport(page, 'salesperson My Day mobile');
  const form = page.locator('form').filter({ has: page.getByLabel('Purpose') });
  await form.getByLabel('Purpose').scrollIntoViewIfNeeded();
  await assertVisibleViewport(page, 'salesperson call form mobile');
  await page.getByRole('link', { name: 'Customer DB' }).click();
  await page.waitForURL(/\/sales\/hub$/);
  await assertVisibleViewport(page, 'customer hub mobile');
  await page.screenshot({ path: join(evidence, 'customer-hub-mobile.png'), fullPage: true });
  await context.close();
});

async function assertVisibleViewport(page, label) {
  const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, height: innerHeight }));
  assert.ok(metrics.scrollWidth <= metrics.width + 2, `${label} overflows horizontally: ${JSON.stringify(metrics)}`);
}
