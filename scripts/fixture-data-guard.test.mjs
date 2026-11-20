import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, rmSync, rmdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const seedScripts = ['seed-dummy-data.mjs', 'seed-demo-field.mjs', 'seed-development.mjs', 'generate_sample_test_data.mjs', 'seed_anil_jena_realtime.mjs'];
test('every standalone fixture seeder validates isolation before opening the database', () => {
  for (const script of seedScripts) {
    const source = readFileSync(new URL(script, import.meta.url), 'utf8');
    assert.match(source, /configureFixtureDatabase\(\)/, script);
    assert.doesNotMatch(source, /import\s+\{[^}]*\bdb\b[^}]*\}\s+from\s+["'][^"']*db\.mjs/, script);
    const result = spawnSync(process.execPath, [fileURLToPath(new URL(script, import.meta.url))], {
      env: { ...process.env, NODE_ENV: 'production', CRM_FIXTURE_DATABASE: '', CRM_DATABASE_PATH: '' }, encoding: 'utf8',
    });
    assert.notEqual(result.status, 0, script);
    assert.match(result.stderr, /isolated fixture database/i, script);
  }
});

test('explicit fixture script writes only its temporary database and validates the open connection', async () => {
  const { assertFixtureConnection } = await import('../server/fixture-data-guard.mjs');
  const root = mkdtempSync(join(tmpdir(), 'psspl-fixture-script-'));
  const path = join(root, 'fixture.sqlite');
  const env = { ...process.env, NODE_ENV: 'test', CRM_FIXTURE_DATABASE: 'true', CRM_TEST_DATABASE_ROOT: root, CRM_DATABASE_PATH: path };
  const db = new DatabaseSync(path);
  try {
    db.exec('CREATE TABLE tally_customers(id TEXT PRIMARY KEY, name TEXT, city TEXT, total_sales REAL, outstanding REAL, owner_user_id TEXT)');
    assert.doesNotThrow(() => assertFixtureConnection(db, env));
    assert.throws(() => assertFixtureConnection(db, { ...env, CRM_DATABASE_PATH: join(root, 'different.sqlite') }), /isolated fixture database/i);
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('seed-dummy-data.mjs', import.meta.url))], { env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(db.prepare('SELECT COUNT(*) count FROM tally_customers').get().count, 9);
  } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
});

test('fixture guard permits only explicit temporary fixture databases', async () => {
  const { fixtureDatabasePath } = await import('../server/fixture-data-guard.mjs');
  const root = mkdtempSync(join(tmpdir(), 'psspl-fixture-guard-'));
  try {
    const env = { NODE_ENV: 'test', CRM_FIXTURE_DATABASE: 'true', CRM_TEST_DATABASE_ROOT: root, CRM_DATABASE_PATH: join(root, 'fixture.sqlite') };
    assert.equal(fixtureDatabasePath(env), resolve(env.CRM_DATABASE_PATH));
    for (const change of [{ NODE_ENV: 'production' }, { CRM_FIXTURE_DATABASE: '' }, { CRM_DATABASE_PATH: resolve('data/crm.sqlite') }, { CRM_TEST_DATABASE_ROOT: tmpdir() }, { CRM_DATABASE_PATH: join(root, '..', 'outside.sqlite') }]) {
      assert.throws(() => fixtureDatabasePath({ ...env, ...change }), /isolated fixture database/i);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('fixture guard rejects dangling directory links before SQLite can follow them', async () => {
  const { fixtureDatabasePath } = await import('../server/fixture-data-guard.mjs');
  const directory = mkdtempSync(join(tmpdir(), 'psspl-fixture-links-'));
  const root = join(directory, 'fixture'), outside = join(directory, 'outside');
  mkdirSync(root); mkdirSync(outside);
  try {
    symlinkSync(outside, join(root, 'redirect'), process.platform === 'win32' ? 'junction' : 'dir');
    rmdirSync(outside);
    assert.throws(() => fixtureDatabasePath({ NODE_ENV: 'test', CRM_FIXTURE_DATABASE: 'true', CRM_TEST_DATABASE_ROOT: root, CRM_DATABASE_PATH: join(root, 'redirect', 'fixture.sqlite') }), /isolated fixture database/i);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('webinar fixture rejects ordinary databases before any business SQL', async () => {
  const { seedWebinarDemo } = await import('../server/webinar-demo.mjs');
  const db = new DatabaseSync(':memory:');
  try { assert.throws(() => seedWebinarDemo(db), /isolated fixture database/i); }
  finally { db.close(); }
});

test('webinar fixtures remain available and repeatable in an explicitly isolated test database', () => {
  const root = mkdtempSync(join(tmpdir(), 'psspl-webinar-fixture-'));
  const path = join(root, 'fixture.sqlite');
  try {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import { configureFixtureDatabase } from './server/fixture-data-guard.mjs';
      configureFixtureDatabase();
      const { db } = await import('./server/db.mjs');
      const { seedWebinarDemo } = await import('./server/webinar-demo.mjs');
      try {
        db.prepare("INSERT INTO users(id,email,password_hash,role) VALUES('fixture-person','person@example.test','fixture-hash','rm')").run();
        db.prepare("INSERT INTO salesperson_profiles(user_id,employee_code,full_name,region,territory) VALUES('fixture-person','FIXTURE-1','Fixture Person','Fixture region','Fixture territory')").run();
        seedWebinarDemo(db,'2026-11-20');
        seedWebinarDemo(db,'2026-11-20');
        assert.equal(db.prepare('SELECT COUNT(*) count FROM tally_invoices').get().count,2);
        assert.equal(db.prepare('SELECT COUNT(*) count FROM tally_customers').get().count,2);
        assert.equal(db.prepare('SELECT COUNT(*) count FROM visits').get().count,2);
      } finally { db.close(); }
    `], { env: { ...process.env, NODE_ENV: 'test', CRM_FIXTURE_DATABASE: 'true', CRM_TEST_DATABASE_ROOT: root, CRM_DATABASE_PATH: path }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('workbook importer preserves invoice evidence and never fabricates detail or employee credentials', () => {
  const source = readFileSync(new URL('import_psspldata.py', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /INSERT OR REPLACE INTO (?:tally_invoices|tally_invoice_lines|visits|follow_ups|expected_orders|users|salesperson_profiles)/);
  assert.doesNotMatch(source, /DELETE FROM/i);
  assert.match(source, /invoice_detail.*unavailable/);
  assert.match(source, /tally_customer_monthly_sales/);
  assert.match(source, /tally_rm_product_sales/);
});

test('normal startup and database setup never invoke dummy seeders', () => {
  const startup = readFileSync(new URL('../server/app.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(startup, /seedWebinarDemo|CRM_ENABLE_WEBINAR_DEMO_DATA/);
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['db:setup'], 'npm run db:migrate');
});

test('missing databases initialize empty in development and test unless baseline restore is explicitly approved', () => {
  for (const mode of ['development', 'test']) {
    const root = mkdtempSync(join(tmpdir(), 'psspl-empty-bootstrap-'));
    try {
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
        import assert from 'node:assert/strict';
        const { db } = await import('./server/db.mjs');
        try {
          assert.equal(db.prepare('SELECT COUNT(*) count FROM tally_customers').get().count,0);
          assert.equal(db.prepare('SELECT COUNT(*) count FROM tally_invoices').get().count,0);
          assert.equal(db.prepare('SELECT COUNT(*) count FROM users').get().count,0);
        } finally { db.close(); }
      `], { env: { ...process.env, NODE_ENV: mode, CRM_DATABASE_PATH: join(root, 'empty.sqlite'), CRM_TEST_DATABASE_ROOT: root, CRM_ALLOW_BASELINE_RESTORE: '', CRM_DISABLE_BASELINE_RESTORE: '' }, encoding: 'utf8' });
      assert.equal(result.status, 0, mode + ': ' + result.stderr);
      assert.doesNotMatch(result.stdout, /Initializing database from/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('bundled baseline restoration requires opt-in and the disable setting takes precedence', () => {
  assert.ok(existsSync(new URL('../data/crm-baseline.sqlite.gz', import.meta.url)), 'bundled restore source must exist for this regression');
  const root = mkdtempSync(join(tmpdir(), 'psspl-approved-restore-'));
  try {
    for (const disabled of [false, true]) {
      const path = join(root, disabled ? 'disabled.sqlite' : 'approved.sqlite');
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
        import assert from 'node:assert/strict';
        const { db } = await import('./server/db.mjs');
        try {
          const customers = db.prepare('SELECT COUNT(*) count FROM tally_customers').get().count;
          assert.ok(${disabled ? 'customers === 0' : 'customers > 0'});
        } finally { db.close(); }
      `], { env: { ...process.env, NODE_ENV: 'test', CRM_DATABASE_PATH: path, CRM_TEST_DATABASE_ROOT: root, CRM_ALLOW_BASELINE_RESTORE: 'true', CRM_DISABLE_BASELINE_RESTORE: disabled ? 'true' : '' }, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      if (disabled) assert.doesNotMatch(result.stdout, /Initializing database from/);
      else assert.match(result.stdout, /Initializing database from crm-baseline/);
    }
    const productionPath = join(root, 'production.sqlite');
    const denied = spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./server/db.mjs')"], { env: { ...process.env, NODE_ENV: 'production', CRM_DATABASE_PATH: productionPath, CRM_ALLOW_BASELINE_RESTORE: '', CRM_DISABLE_BASELINE_RESTORE: '' }, encoding: 'utf8' });
    assert.notEqual(denied.status, 0);
    assert.match(denied.stderr, /Refusing to initialize a production database.*without explicit approval/);
    assert.equal(existsSync(productionPath), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
