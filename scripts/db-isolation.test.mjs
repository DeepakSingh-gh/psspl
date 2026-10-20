import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../server/migrations.mjs';

const scratch = mkdtempSync(join(tmpdir(), 'psspl-db-isolation-'));
const dbModule = fileURLToPath(new URL('../server/db.mjs', import.meta.url));
const project = fileURLToPath(new URL('../', import.meta.url));
const isolatedPath = join(scratch, 'synthetic.sqlite');

function openDatabase(path, root = scratch) {
  const childEnv = { ...process.env };
  for (const key of Object.keys(childEnv)) if (/DATABASE_URL|DIRECT_URL|CRM_DATABASE_PATH|CRM_TEST_DATABASE_ROOT|NODE_OPTIONS/i.test(key)) delete childEnv[key];
  Object.assign(childEnv, {
    NODE_ENV: 'test',
    CRM_DATABASE_PATH: path,
    CRM_TEST_DATABASE_ROOT: root,
    CRM_DISABLE_BASELINE_RESTORE: 'true',
  });
  return spawnSync(process.execPath, ['--input-type=module', '-e', `const {db}=await import(${JSON.stringify(pathToFileURL(dbModule).href)});db.close();`], {
    cwd: project,
    env: childEnv,
    encoding: 'utf8',
    timeout: 30000,
  });
}

test.after(() => rmSync(scratch, { recursive: true, force: true }));

test('test-mode database opens only under the configured isolated root', () => {
  const denied = openDatabase(join(project, 'data', 'crm.sqlite'));
  assert.notEqual(denied.status, 0, 'a project database path must be rejected before SQLite opens it');
  assert.match(denied.stderr, /Refusing to open a test database outside CRM_TEST_DATABASE_ROOT/);

  const deniedRoot = openDatabase(join(project, 'data', 'crm.sqlite'), project);
  assert.notEqual(deniedRoot.status, 0, 'a repository directory must not be accepted as the test root');
  assert.match(deniedRoot.stderr, /Refusing a test database root outside the operating system temporary directory/);

  const allowed = openDatabase(isolatedPath);
  assert.equal(allowed.status, 0, `${allowed.stdout}\n${allowed.stderr}`);
  assert.equal(existsSync(isolatedPath), true, 'the allowed test database is created inside disposable scratch');
});

test('migration 010 repairs a database that recorded 009 before pending webhook events existed', () => {
  const repairPath = join(scratch, 'legacy-email-queue.sqlite');
  const initialized = openDatabase(repairPath);
  assert.equal(initialized.status, 0, initialized.stderr);
  const database = new DatabaseSync(repairPath);
  try {
    database.exec('DROP TABLE auth_email_pending_events');
    database.prepare("DELETE FROM schema_migrations WHERE version='010'").run();
    assert.equal(database.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='auth_email_pending_events'").get(), undefined);
    const applied = runMigrations(database);
    assert.deepEqual(applied.map((migration) => migration.version), ['010']);
    assert.ok(database.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='auth_email_pending_events'").get());
    assert.ok(database.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='auth_email_queue'").get());
  } finally {
    database.close();
  }
});
