import test from 'node:test';
import { once } from 'node:events';
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
const skip = new Set(['.git', 'node_modules', '.next', '.next-dev', '.next-runtime', 'data', 'docs', 'coverage', 'playwright-report', 'test-results']);
let api, web, browser;
let apiOutput = '', webOutput = '';
let appUrl = '', apiUrl = '';
const pageErrors = [];
let cachedAdminToken;

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
  await page.getByLabel('Login ID or work email').fill(email);
  await page.locator('input[name="password"]').fill('Uat-only-2026!');
  await page.getByRole('button', { name: 'Sign in to CRM' }).click();
  const expectedPath = role === 'admin' ? '/admin' : role === 'rm' ? '/rm' : '/sales/my-day';
  try { await page.waitForURL(url => url.pathname === expectedPath, { timeout: 15000 }); }
  catch (error) { throw new Error(`${error.message}\nURL=${page.url()}\nForm error=${await page.locator('[role=alert]').allInnerTexts().catch(() => [])}`); }
  if (role === 'admin') cachedAdminToken = await page.evaluate(() => localStorage.getItem('psspl_crm_session'));
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
    const acknowledged = once(api, 'message');
    api.send({ type: 'create-legacy-account', account: { email: 'browser.late.invite@example.test', role: 'rm', fullName: 'Browser Late Invite' } });
    await acknowledged;
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

test('team performance sort puts low sales first when target coverage is incomplete and reverses on selection', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await blockExternal(context);
  // Exercise the reported one-target/many-no-target case without client data.
  await context.route('**/api/admin/team*', async route => {
    const response = await route.fetch();
    const data = await response.json();
    const template = data.members[0];
    assert.ok(template, 'synthetic RM fixture exists');
    data.members = [
      { ...template, id: 'top', name: 'High performer', salesValue: 14_010_000, achievementPercent: 280 },
      { ...template, id: 'zero', name: 'No sales', salesValue: 0, achievementPercent: null, targetValue: 0 },
      { ...template, id: 'middle', name: 'Some sales', salesValue: 500_000, achievementPercent: null, targetValue: 0 },
    ];
    await route.fulfill({ response, json: data });
  });
  try {
    const page = await context.newPage();
    await signIn(page, 'admin');
    await page.goto(`${appUrl}/admin/team`);
    await page.getByText('Sorted by sales value because some team members have no target, lowest first.', { exact: true }).waitFor({ timeout: 15000 });
    const order = () => page.locator('.admin-table tbody .rm-name-link').evaluateAll(links => links.map(link => new URL(link.href).pathname.split('/').at(-1)));
    assert.deepEqual(await order(), ['zero', 'middle', 'top']);
    await page.getByLabel('Sort performance').selectOption('desc');
    await page.getByText('Sorted by sales value because some team members have no target, highest first.', { exact: true }).waitFor();
    assert.deepEqual(await order(), ['top', 'middle', 'zero']);
    await page.getByLabel('Sort performance').selectOption('asc');
    await page.getByText('Sorted by sales value because some team members have no target, lowest first.', { exact: true }).waitFor();
    assert.deepEqual(await order(), ['zero', 'middle', 'top']);
    await page.screenshot({ path: join(evidence, 'team-poor-to-good.png'), fullPage: true });
  } finally { await context.close(); }
});

test('archived employees page shows preserved history, pagination and filters on desktop and mobile', async () => {
  const acknowledged = once(api,'message'); api.send({ type: 'create-archive-fixture' }); await acknowledged;
  if (!cachedAdminToken) {
    const response = await fetch(`${apiUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.test', password: 'Uat-only-2026!' }) });
    assert.equal(response.status,200); cachedAdminToken=(await response.json()).token;
  }
  for (const viewport of [{ width:1440,height:960 },{ width:390,height:844 }]) {
    const context=await browser.newContext({viewport}); await blockExternal(context);
    await context.addInitScript(token=>localStorage.setItem('psspl_crm_session',token),cachedAdminToken);
    try {
      const page=await context.newPage(); page.setDefaultTimeout(15000);
      const errors=[]; page.on('pageerror',error=>errors.push(error.message));
      await page.goto(`${appUrl}/admin/users`);
      await page.locator('.admin-page-actions').getByRole('link',{name:'Archived employees',exact:true}).click();
      await page.getByRole('heading',{name:'Archived employees',exact:true}).waitFor();
      await page.getByLabel('Search archived employees').fill('Archived Browser Rep');
      await page.getByRole('button',{name:/Archived Browser Rep/}).click();
      const history=page.getByRole('region',{name:'History for Archived Browser Rep',exact:true});
      await history.locator('.admin-table tbody tr').first().waitFor();
      assert.equal(await history.locator('.admin-table tbody tr').count(),25);
      await history.getByRole('button',{name:'Next',exact:true}).click();
      await history.getByText('Page 2 of 2',{exact:true}).waitFor();
      assert.equal(await history.locator('.admin-table tbody tr').count(),2);
      const tabs=[['Leads','Archived browser lead'],['Follow-ups','Archived follow-up'],['Attendance','20 Oct'],['Activities','Archived customer call'],['Requests','Archived sample request'],['Customers','Archived Test Customer'],['Expected orders','UAT Product'],['Saved reports','archive-test']];
      for (const [label,text] of tabs) {
        await history.getByRole('group',{name:'History sections'}).getByRole('button',{name:new RegExp(`^${label}`)}).click();
        await history.locator('.admin-table').getByText(new RegExp(text)).first().waitFor();
      }
      assert.equal(await history.getByRole('button',{name:/Delete account|Reactivate|Reset password/}).count(),0);
      await page.getByLabel('Search archived employees').fill('no-match-exists');
      await page.getByRole('status').filter({hasText:'No archived employees match'}).waitFor();
      await page.getByRole('button',{name:'Clear filters',exact:true}).click();
      await page.getByRole('button',{name:/Archived Empty RM/}).click();
      await page.getByText('No visits were recorded for this employee.',{exact:true}).waitFor();
      await page.getByLabel('Archived role').selectOption('salesperson');
      assert.equal(await page.getByRole('button',{name:/Archived Empty RM/}).count(),0);
      await page.getByRole('button',{name:/Archived Browser Rep/}).click();
      await history.locator('.admin-table tbody tr').first().waitFor();
      await assertVisibleViewport(page,`archived employees ${viewport.width}`);
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.screenshot({path:join(evidence,`archived-employees-${viewport.width}.png`),fullPage:true});
      assert.deepEqual(errors,[]);
    } finally { await context.close(); }
  }
});

test('reporting structure shows all RM teams, exact counts and searchable salespeople on desktop and mobile', async () => {
  if (!cachedAdminToken) {
    const response = await fetch(`${apiUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.test', password: 'Uat-only-2026!' }) });
    assert.equal(response.status, 200); cachedAdminToken = (await response.json()).token;
  }
  for (const viewport of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    await blockExternal(context);
    await context.addInitScript(token => localStorage.setItem('psspl_crm_session', token), cachedAdminToken);
    await context.route('**/api/admin/users', async route => {
      const response = await route.fetch(); const data = await response.json();
      const template = data.items.find(person => person.role === 'salesperson');
      const person = (id, role, name, managerUserId = null, extra = {}) => ({ ...template, id, role, fullName: name, email: `${id}@example.test`, employeeCode: `CODE-${id}`, managerUserId, active: true, invitationPending: false, ...extra });
      data.items = [person('admin', 'admin', 'UAT Admin'), person('rm-a', 'rm', 'Same Name'), person('rm-b', 'rm', 'Same Name', null, { active: false }), person('rm-empty', 'rm', 'Empty Manager'), person('rep-a', 'salesperson', 'Alice Sales', 'rm-a'), person('rep-b', 'salesperson', 'Bob Sales', 'rm-b', { active: false, invitationPending: true }), person('rep-c', 'salesperson', 'Carol Sales', 'rm-a'), person('rep-none', 'salesperson', 'Unassigned Rep'), person('rep-missing', 'salesperson', 'Missing Manager Rep', 'missing-manager')];
      await route.fulfill({ response, json: data });
    });
    try {
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${appUrl}/admin/users`);
      await page.getByRole('link', { name: 'View team structure', exact: true }).click();
      await page.getByRole('heading', { name: 'Team structure', exact: true }).waitFor();
      await page.locator('[data-testid="org-rm-total"]').getByText('3', { exact: true }).waitFor();
      assert.equal(await page.locator('[data-testid="org-salesperson-total"]').innerText(), '5');
      assert.equal(await page.locator('[data-testid="org-unassigned-total"]').innerText(), '2');
      assert.match(await page.getByRole('region', { name: 'Admin oversight', exact: true }).innerText(), /1 administrator.*3 RMs.*5 salespeople/);
      const teamA = page.locator('[data-manager-id="rm-a"]'); const teamB = page.locator('[data-manager-id="rm-b"]');
      assert.equal(await teamA.locator('[data-person-id]').count(), 2);
      assert.equal(await teamB.locator('[data-person-id]').count(), 1);
      assert.match(await teamA.innerText(), /Alice Sales/); assert.doesNotMatch(await teamA.innerText(), /Bob Sales/);
      assert.match(await teamB.innerText(), /Invitation pending/);
      assert.match(await page.locator('[data-manager-id="rm-empty"]').innerText(), /No salespeople assigned/);
      if (viewport.width > 600) {
        assert.equal(await page.getByRole('link', { name: 'Team structure', exact: true }).getAttribute('aria-current'), 'page');
        assert.equal(await page.getByRole('link', { name: 'Team performance', exact: true }).getAttribute('aria-current'), null);
      }
      await page.getByRole('button', { name: 'Collapse all', exact: true }).click();
      assert.equal(await teamA.locator('.org-team-body').isVisible(), false);
      await page.getByRole('button', { name: 'Expand all', exact: true }).click();
      assert.equal(await teamA.locator('.org-team-body').isVisible(), true);
      await page.getByLabel('Search reporting structure').fill('Bob Sales');
      assert.equal(await page.locator('[data-manager-id]').count(), 1);
      assert.equal(await teamB.locator('[data-person-id]').count(), 1);
      assert.equal(await page.locator('[data-testid="org-rm-total"]').innerText(), '3', 'search does not change whole-organisation totals');
      await page.getByLabel('Search reporting structure').fill('nobody-matches');
      await page.getByRole('status').filter({ hasText: 'No RM or salesperson matches' }).waitFor();
      await page.getByRole('button', { name: 'Clear search', exact: true }).click();
      await assertVisibleViewport(page, `reporting structure ${viewport.width}`);
      await page.screenshot({ path: join(evidence, `reporting-structure-${viewport.width}.png`), fullPage: true });
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
});

test('email and Login ID entries submit their matching credential fields without modifying passwords', async () => {
  const context = await browser.newContext();
  await blockExternal(context);
  const submissions = [];
  await context.route('**/api/auth/login', async route => {
    submissions.push(route.request().postDataJSON());
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic login response' }) });
  });
  try {
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    await page.goto(`${appUrl}/login`);
    const password = '  Synthetic-Only-Password-2026!  ';
    await page.getByLabel('Login ID or work email').fill('  Work.Email@Example.Test  ');
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole('button', { name: 'Sign in to CRM' }).click();
    await page.getByRole('alert').filter({ hasText: 'Synthetic login response' }).waitFor();
    assert.deepEqual(submissions[0], { email: 'work.email@example.test', password });
    await page.getByLabel('Login ID or work email').fill('  rep.new  ');
    await page.getByRole('button', { name: 'Sign in to CRM' }).click();
    await page.waitForFunction(() => document.querySelector('[role="alert"]')?.textContent?.includes('Synthetic login response'));
    assert.deepEqual(submissions[1], { loginId: 'rep.new', password });
  } finally { await context.close(); }
});

test('pagination stays above Refresh Data on desktop and mobile and Next remains clickable', async () => {
  if (!cachedAdminToken) {
    const response = await fetch(`${apiUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.test', password: 'Uat-only-2026!' }) });
    assert.equal(response.status, 200);
    cachedAdminToken = (await response.json()).token;
  }
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    await blockExternal(context);
    await context.addInitScript(token => localStorage.setItem('psspl_crm_session', token), cachedAdminToken);
    await context.route('**/api/admin/users', async route => {
      const response = await route.fetch();
      const data = await response.json();
      const template = data.items.find(user => user.role === 'salesperson');
      data.items = Array.from({ length: 31 }, (_, index) => ({ ...template, id: `pagination-${index}`, fullName: `Person ${String(index + 1).padStart(2, '0')}`, email: `person${index}@example.test` }));
      await route.fulfill({ response, json: data });
    });
    try {
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      await page.goto(`${appUrl}/admin/users`);
      await page.locator('.admin-pager-count').getByText('Page 1 of 2', { exact: true }).waitFor();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const next = page.getByRole('button', { name: 'Next', exact: true });
      const refresh = page.getByRole('button', { name: 'Refresh data on this page', exact: true });
      const nextBox = await next.boundingBox(); const refreshBox = await refresh.boundingBox();
      assert.ok(nextBox && refreshBox);
      assert.ok(nextBox.y + nextBox.height <= refreshBox.y, `Next overlaps Refresh Data at viewport ${viewport.width}`);
      await next.click();
      await page.locator('.admin-pager-count').getByText('Page 2 of 2', { exact: true }).waitFor();
      assert.equal(await page.locator('.admin-table tbody tr').count(), 6);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const previous = page.getByRole('button', { name: 'Previous', exact: true });
      await previous.click();
      await page.locator('.admin-pager-count').getByText('Page 1 of 2', { exact: true }).waitFor();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.screenshot({ path: join(evidence, `pagination-clearance-${viewport.width}.png`), fullPage: false });
    } finally { await context.close(); }
  }
});

test('delete person requires confirmation, supports cancel and removes the account from the user table', async () => {
  if (!cachedAdminToken) {
    const login = await fetch(`${apiUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.test', password: 'Uat-only-2026!' }) });
    assert.equal(login.status, 200);
    cachedAdminToken = (await login.json()).token;
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await blockExternal(context);
  await context.addInitScript(token => localStorage.setItem('psspl_crm_session', token), cachedAdminToken);
  try {
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    await page.goto(`${appUrl}/admin/users`);
    const row = page.getByRole('row').filter({ hasText: 'other@example.test' });
    await row.getByRole('button', { name: 'Delete', exact: true }).waitFor();
    const self = page.getByRole('row').filter({ hasText: 'admin@example.test' });
    assert.equal(await self.getByRole('button', { name: 'Delete', exact: true }).count(), 0);
    await row.getByRole('button', { name: 'Delete', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete person', exact: true });
    assert.equal(await dialog.getByRole('button', { name: 'Delete account', exact: true }).isEnabled(), false);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await row.count(), 1);
    await row.getByRole('button', { name: 'Delete', exact: true }).click();
    await dialog.getByLabel('Type their email to confirm').fill('wrong@example.test');
    assert.equal(await dialog.getByRole('button', { name: 'Delete account', exact: true }).isEnabled(), false);
    await dialog.getByLabel('Type their email to confirm').fill('other@example.test');
    await dialog.getByRole('button', { name: 'Delete account', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'CRM history has been preserved.' }).waitFor();
    await row.waitFor({ state: 'detached' });
    await page.screenshot({ path: join(evidence, 'user-account-deleted.png'), fullPage: true });
  } finally { await context.close(); }
});

test('admin creates immediately usable accounts; RM and salesperson voluntarily change passwords from Profile Security', async () => {
  const initial = 'Browser-Initial-2026!';
  const replacement = 'Browser-Replacement-2026!';
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await blockExternal(adminContext);
  const adminPage = await adminContext.newPage();
  await signIn(adminPage, 'admin');
  try {
    // Admin can reach credential management through the original account shortcut,
    // and can leave their own optional Security page without submitting a password.
    await adminPage.getByRole('link', { name: 'Manage employee accounts', exact: true }).click();
    await adminPage.waitForURL(url => url.pathname === '/admin/users');
    await adminPage.getByRole('button', { name: 'Add user', exact: true }).waitFor();
    await adminPage.getByRole('link', { name: 'My profile', exact: true }).click();
    await adminPage.getByRole('heading', { name: 'Security', exact: true }).waitFor();
    assert.equal(await adminPage.getByLabel('Current password', { exact: true }).isVisible(), false, 'password form starts collapsed');
    assert.match(await adminPage.locator('main').innerText(), /Changing your own password is optional/);
    await adminPage.getByRole('link', { name: 'Manage employee accounts', exact: true }).click();
    await adminPage.waitForURL(url => url.pathname === '/admin/users');
    await adminPage.getByRole('button', { name: 'Add user', exact: true }).waitFor();
    for (const role of ['rm', 'salesperson']) {
      await adminPage.goto(`${appUrl}/admin/users`);
      await adminPage.getByRole('button', { name: 'Add user', exact: true }).click();
      await adminPage.locator('input[name="fullName"]').fill(`Browser ${role}`);
      await adminPage.locator('input[name="loginId"]').fill(`browser.${role}`);
      await adminPage.locator('input[name="email"]').fill(`browser.${role}@example.test`);
      await adminPage.locator('select[name="role"]').selectOption(role);
      if (role === 'salesperson') await adminPage.locator('select[name="managerUserId"]').selectOption('rm');
      await adminPage.locator('input[name="initialPassword"]').fill(initial);
      await adminPage.locator('input[name="confirmPassword"]').fill(initial);
      await adminPage.getByRole('button', { name: 'Create user', exact: true }).click();
      await adminPage.getByRole('status').filter({ hasText: 'The initial password works immediately. No email was sent.' }).waitFor();
      assert.equal(await adminPage.getByText(initial, { exact: true }).count(), 0);

      const employeeContext = await browser.newContext({ viewport: role === 'salesperson' ? { width: 390, height: 844 } : { width: 1440, height: 960 } });
      await blockExternal(employeeContext);
      try {
        const page = await employeeContext.newPage();
        page.on('pageerror', error => pageErrors.push(error.message));
        await page.goto(`${appUrl}/login`);
        await page.getByLabel('Login ID or work email').fill(`browser.${role}`);
        await page.locator('input[name="password"]').fill(initial);
        await page.getByRole('button', { name: 'Sign in to CRM' }).click();
        await page.waitForURL(url => url.pathname === (role === 'rm' ? '/rm' : '/sales/my-day'));
        await page.getByRole('link', { name: 'Profile', exact: true }).click();
        await page.getByRole('heading', { name: 'Security', exact: true }).waitFor();
        await page.getByText('Change my password', { exact: true }).click();
        await page.getByLabel('Current password', { exact: true }).fill(initial);
        await page.getByLabel('New password', { exact: true }).fill(replacement);
        await page.getByLabel('Confirm new password', { exact: true }).fill(`${replacement}mismatch`);
        await page.getByRole('button', { name: 'Change password', exact: true }).click();
        await page.getByRole('alert').filter({ hasText: 'New passwords do not match' }).waitFor();
        await page.getByLabel('Confirm new password', { exact: true }).fill(replacement);
        await page.getByRole('button', { name: 'Change password', exact: true }).click();
        await page.getByRole('status').filter({ hasText: 'All sessions have been signed out.' }).waitFor();
        assert.equal(await page.evaluate(() => localStorage.getItem('psspl_crm_session')), null);
        await assertVisibleViewport(page, `${role} Profile Security`);
        await page.screenshot({ path: join(evidence, `${role}-profile-security.png`), fullPage: true });
      } finally { await employeeContext.close(); }
    }
  } finally { await adminContext.close(); }
  assert.deepEqual(pageErrors, []);
});
