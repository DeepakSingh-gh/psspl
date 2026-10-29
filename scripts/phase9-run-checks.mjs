import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const output = resolve('docs/uat/phase9');
mkdirSync(output, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), 'psspl-phase9-run-'));
const env = { ...process.env };
for (const key of Object.keys(env)) if (/ANTHROPIC|CLAUDE|CRM_AI_PROVIDER|OPENAI|GEMINI|WHATSAPP|SUPABASE|DIRECT_URL|DATABASE_URL|CRM_ADMIN|CRM_DATABASE_PATH|CRM_TEST_DATABASE_ROOT|NODE_OPTIONS/i.test(key)) delete env[key];
Object.assign(env, { CRM_DATABASE_PATH: join(scratch, 'runner-default.sqlite'), CRM_TEST_DATABASE_ROOT: tmpdir(), CRM_DISABLE_BASELINE_RESTORE: 'true', NODE_ENV: 'test', HOST: '127.0.0.1', WHATSAPP_DELIVERY_ENABLED: 'false', NEXT_TELEMETRY_DISABLED: '1' });
const guard = pathToFileURL(resolve('scripts/phase8-isolation.mjs')).href;
env.NODE_OPTIONS = `--import=${guard}`;
const skip = new Set(['.git', 'node_modules', '.next', '.next-runtime', 'docs/uat']);
function snapshot(dir = '.', prefix = '') {
  const result = {};
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${item.name}` : item.name;
    if (skip.has(relative) || skip.has(item.name)) continue;
    const path = join(dir, item.name);
    if (item.isDirectory()) Object.assign(result, snapshot(path, relative));
    else if (item.isFile()) result[relative] = createHash('sha256').update(readFileSync(path)).digest('hex');
  }
  return result;
}
const before = snapshot();
// Protect a configured database outside data/ too, without publishing its path.
for (const name of ['.env', '.env.local']) {
  if (!existsSync(name)) continue;
  const match = readFileSync(name, 'utf8').match(/^CRM_DATABASE_PATH\s*=\s*["']?([^\r\n"']+)/m);
  if (match && existsSync(match[1].trim())) for (const suffix of ['', '-wal', '-shm']) {
    const file = match[1].trim() + suffix;
    if (existsSync(file) && statSync(file).isFile()) before[`external-configured-db${suffix}`] = createHash('sha256').update(readFileSync(file)).digest('hex');
  }
}
writeFileSync(join(scratch, 'preservation-before.json'), JSON.stringify(before, null, 2));
const suites = ['db-isolation', 'phase1-security', 'phase2-tally-accuracy', 'phase3-rm-report', 'phase4-management', 'phase5-field-workflows', 'phase6-leads', 'phase6-reports', 'phase7-automation', 'ai-provider', 'attendance-live', 'phase8-workflows', 'phase9-recovery', 'phase9b-browser'];
const results = [];
function run(name, args) {
  const start = Date.now();
  const suiteEnv = { ...env, CRM_DATABASE_PATH: join(scratch, `${name}.sqlite`) };
  const result = spawnSync(process.execPath, args, { env: suiteEnv, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
  const log = `${result.stdout || ''}\n${result.stderr || ''}${result.error ? `\n${result.error.message}` : ''}`;
  writeFileSync(join(output, `${name}.log`), log);
  const entry = { name, command: `node ${args.join(' ')}`, exitCode: result.status, signal: result.signal, durationMs: Date.now() - start, pass: Number(log.match(/# pass (\d+)/)?.[1] || 0), fail: Number(log.match(/# fail (\d+)/)?.[1] || 0) };
  results.push(entry);
  console.log(JSON.stringify(entry));
}
for (const suite of suites) if (existsSync(`scripts/${suite}.test.mjs`)) run(suite, ['--test', `scripts/${suite}.test.mjs`]);
run('phase6-my-day', ['scripts/phase6-my-day.test.mjs']);
run('typescript', ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false']);
const after = snapshot();
const changed = Object.keys(before).filter(key => !key.startsWith('external-configured-db') && before[key] !== after[key]);
for (const name of ['.env', '.env.local']) {
  if (!existsSync(name)) continue;
  const match = readFileSync(name, 'utf8').match(/^CRM_DATABASE_PATH\s*=\s*["']?([^\r\n"']+)/m);
  if (match) for (const suffix of ['', '-wal', '-shm']) {
    const key = `external-configured-db${suffix}`, file = match[1].trim() + suffix;
    if (before[key] && (!existsSync(file) || before[key] !== createHash('sha256').update(readFileSync(file)).digest('hex'))) changed.push(key);
  }
}
const applicationFilesChanged = changed.filter(name => !/^(data\\|data\/|external-configured-db)/i.test(name));
const protectedDatabaseChanges = changed.filter(name => /^(data\\|data\/|external-configured-db)/i.test(name));
const summary = { executedAt: new Date().toISOString(), results, testDatabaseIsolation: { enforcedBy: 'server/db.mjs CRM_TEST_DATABASE_ROOT guard', root: tmpdir(), databasePathPerSuite: true }, preservation: { baselineFiles: Object.keys(before).length, changedExistingFiles: changed, applicationFilesChangedDuringRun: applicationFilesChanged, protectedDatabaseFilesChangedDuringWindow: protectedDatabaseChanges, attribution: 'Suite database paths are isolated under OS temp; concurrent external process writes cannot be attributed by repository hashing alone', manifest: 'Temporary local manifest retained outside the repository' }, network: 'Loopback-only real sockets/fetch; provider mocks may replace fetch', scratch };
writeFileSync(join(output, 'results.json'), JSON.stringify(summary, null, 2));
console.log(`Application source/config changes during test window: ${applicationFilesChanged.length}`);
console.log(`Protected database/WAL differences during test window (attribution is separate): ${protectedDatabaseChanges.length}`);
process.exitCode = results.some(r => r.exitCode !== 0) || applicationFilesChanged.length ? 1 : 0;
