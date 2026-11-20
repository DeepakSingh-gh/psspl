import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';

const denied = () => new Error('Dummy data requires an explicitly isolated fixture database beneath CRM_TEST_DATABASE_ROOT in the operating system temporary directory.');
const inside = (root, path) => {
  const rel = relative(root, path);
  return Boolean(rel) && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
};

/** Validate before importing db.mjs, which can restore a baseline and migrate. */
export function fixtureDatabasePath(env = process.env) {
  if (env.NODE_ENV !== 'test' || env.CRM_FIXTURE_DATABASE !== 'true' || !env.CRM_TEST_DATABASE_ROOT || !env.CRM_DATABASE_PATH) throw denied();
  const root = resolve(env.CRM_TEST_DATABASE_ROOT), target = resolve(env.CRM_DATABASE_PATH);
  const temporary = realpathSync(tmpdir());
  if (!existsSync(root) || !inside(temporary, realpathSync(root)) || !inside(root, target)) throw denied();
  for (let path = target; ; path = dirname(path)) {
    if (lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink()) throw denied();
    if (path === root) break;
  }
  return target;
}

export function configureFixtureDatabase() {
  const path = fixtureDatabasePath();
  process.env.CRM_DATABASE_PATH = path;
  process.env.CRM_DISABLE_BASELINE_RESTORE = 'true';
  return path;
}

/** A flag alone cannot authorize a different open connection. */
export function assertFixtureConnection(db, env = process.env) {
  const path = fixtureDatabasePath(env);
  const main = db.prepare('PRAGMA database_list').all().find(row => row.name === 'main');
  if (!main?.file || resolve(main.file) !== path) throw denied();
}
