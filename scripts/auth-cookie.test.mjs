import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';

let child, base, cookies, csrf;
const origin = 'http://127.0.0.1';
before(async () => {
  child = fork('scripts/phase8-fixture-server.mjs', [], { silent: true, env: { ...process.env, CRM_SESSION_COOKIE_ENABLED: 'true', CRM_ALLOWED_ORIGINS: origin } });
  child.stderr.on('data', chunk => process.stderr.write(chunk));
  const [ready] = await once(child, 'message', { signal: AbortSignal.timeout(15000) });
  base = ready.base;
});
after(async () => { if (child?.connected) { child.send({ type: 'stop' }); const [code] = await once(child, 'exit'); assert.equal(code, 0); } });

test('optional HttpOnly session cookie requires a same-origin CSRF token for unsafe requests', async () => {
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ email: 'admin@example.test', password: 'Uat-only-2026!' }) });
  assert.equal(login.status, 200);
  const body = await login.json();
  assert.equal(body.token, undefined, 'cookie mode never returns the session token to browser JavaScript');
  const setCookies = login.headers.getSetCookie();
  assert.ok(setCookies.some(value => /psspl_session=.*HttpOnly/.test(value)));
  cookies = setCookies.map(value => value.split(';')[0]).join('; ');
  csrf = cookies.match(/psspl_csrf=([^;]+)/)?.[1];
  assert.ok(csrf);

  const me = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookies } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.id, 'admin');
  const rejected = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { Cookie: cookies, Origin: origin, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(rejected.status, 403);
  const wrongOrigin = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { Cookie: cookies, Origin: 'https://attacker.example', 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(wrongOrigin.status, 403);
  const accepted = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { Cookie: cookies, Origin: origin, 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(accepted.status, 200);
  assert.equal((await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookies } })).status, 401);
});

test('cookie-authenticated password change requires CSRF and clears the revoked session cookies', async () => {
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ email: 'rm@example.test', password: 'Uat-only-2026!' }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const csrfToken = cookie.match(/psspl_csrf=([^;]+)/)[1];
  const headers = { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' };
  const body = JSON.stringify({ currentPassword: 'Uat-only-2026!', newPassword: 'Cookie-New-Password-2026!', confirmPassword: 'Cookie-New-Password-2026!' });
  assert.equal((await fetch(`${base}/api/auth/password`, { method: 'POST', headers, body })).status, 403);
  const changed = await fetch(`${base}/api/auth/password`, { method: 'POST', headers: { ...headers, 'X-CSRF-Token': csrfToken }, body });
  assert.equal(changed.status, 200);
  assert.ok(changed.headers.getSetCookie().every(value => value.includes('Max-Age=0')));
  assert.equal((await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } })).status, 401);
});
