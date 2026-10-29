// Starts an isolated local preview backed by Phase 9B synthetic data.
// The repository's .env files and data directory are deliberately excluded.
import { cpSync, mkdtempSync, rmSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fork, spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';

const source = process.cwd();
const scratch = mkdtempSync(join(tmpdir(), 'psspl-local-preview-'));
const copy = join(scratch, 'app');
const skip = new Set(['.git', 'node_modules', '.next', '.next-runtime', 'data', 'docs', 'coverage', 'playwright-report', 'test-results']);
let api, web, stopping = false;

function safeEnv(extra = {}) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/ANTHROPIC|CLAUDE|CRM_AI_PROVIDER|OPENAI|GEMINI|WHATSAPP|SUPABASE|DIRECT_URL|DATABASE_URL|CRM_ADMIN|NODE_OPTIONS/i.test(key)) delete env[key];
  return { ...env, NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', CRM_DISABLE_BASELINE_RESTORE: 'true', HOST: '127.0.0.1', WHATSAPP_DELIVERY_ENABLED: 'false', ...extra };
}
async function freePort() {
  const probe = createServer();
  await new Promise((ok, fail) => probe.once('error', fail).listen(0, '127.0.0.1', ok));
  const port = probe.address().port;
  await new Promise((ok, fail) => probe.close(error => error ? fail(error) : ok()));
  return port;
}
function stopTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGTERM');
}
async function cleanup() {
  if (stopping) return;
  stopping = true;
  stopTree(web);
  if (api?.connected) api.send({ type: 'stop' });
  await new Promise(resolve => setTimeout(resolve, 500));
  rmSync(scratch, { recursive: true, force: true });
}
process.on('SIGINT', () => { void cleanup().finally(() => process.exit(130)); });
process.on('SIGTERM', () => { void cleanup().finally(() => process.exit(143)); });

try {
  cpSync(source, copy, { recursive: true, filter(item) {
    const rel = relative(source, item).split(/[\\/]/).filter(Boolean);
    return !rel.some(part => skip.has(part) || part.startsWith('.env'));
  }});
  symlinkSync(join(source, 'node_modules'), join(copy, 'node_modules'), 'junction');

  // Avoid a Google Fonts download in the isolated local preview.
  const layout = join(copy, 'src', 'app', 'layout.tsx');
  let layoutText = readFileSync(layout, 'utf8');
  layoutText = layoutText.replace('import { Inter } from "next/font/google";\n', '')
    .replace('const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });\n', '')
    .replace('className={inter.variable}', '');
  writeFileSync(layout, layoutText);

  api = fork(join(copy, 'scripts', 'phase8-fixture-server.mjs'), [], {
    cwd: copy, env: safeEnv({ NODE_ENV: 'production' }), silent: true,
  });
  const fixture = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Synthetic API fixture startup timed out')), 30000);
    api.on('message', message => {
      if (message?.type === 'ready') { clearTimeout(timeout); resolve(message); }
    });
    api.once('error', error => { clearTimeout(timeout); reject(error); });
    api.once('exit', code => { if (code !== 0) { clearTimeout(timeout); reject(new Error(`Synthetic API exited (${code})`)); } });
  });
  const webPort = await freePort();
  web = spawn(process.execPath, [join(copy, 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-H', '127.0.0.1', '-p', String(webPort)], {
    cwd: copy,
    env: safeEnv({ CRM_API_PORT: new URL(fixture.base).port, NEXT_TELEMETRY_DISABLED: '1' }),
    stdio: 'inherit',
  });
  web.once('exit', code => { if (!stopping) { console.error(`Local preview exited (${code})`); void cleanup(); } });
  const url = `http://127.0.0.1:${webPort}`;
  const deadline = Date.now() + 90000;
  let ready = false;
  while (Date.now() < deadline) {
    if (web.exitCode !== null) throw new Error(`Next dev server exited (${web.exitCode})`);
    try { const response = await fetch(`${url}/login`); if (response.ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 350));
  }
  if (!ready) throw new Error('Next dev server did not become ready within 90 seconds');
  console.log(`\nPSSPL isolated local preview: ${url}`);
  console.log('Synthetic sign-in: admin@example.test / UAT-only-2026!');
  console.log('Synthetic sign-in: rm@example.test, rep@example.test, other@example.test / UAT-only-2026!');
  console.log('Data is temporary and synthetic; configured .env files and repository data were not used. Press Ctrl+C to stop and clean up.\n');
  await new Promise(resolve => web.once('exit', resolve));
} catch (error) {
  console.error(error);
  await cleanup();
  process.exitCode = 1;
}
