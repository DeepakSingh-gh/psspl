import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const defaultMigrationsDirectory = join(projectRoot, "database", "migrations");

function migrationFiles(directory) {
  return readdirSync(directory)
    .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/i.test(name))
    .sort((left, right) => left.localeCompare(right));
}

function hasApplicationTables(database) {
  return Boolean(database.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name IN ('users','tally_invoices') LIMIT 1").get());
}

export function runMigrations(database, { directory = defaultMigrationsDirectory, log = false } = {}) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const files = migrationFiles(directory);
  const applied = new Set(database.prepare("SELECT version FROM schema_migrations").all().map((row) => row.version));
  const baselineExisting = applied.size === 0 && hasApplicationTables(database);
  const results = [];

  for (const [index, filename] of files.entries()) {
    const version = filename.split("_", 1)[0];
    if (applied.has(version)) continue;

    database.exec("BEGIN IMMEDIATE");
    try {
      if (!(baselineExisting && index === 0)) {
        database.exec(readFileSync(join(directory, filename), "utf8"));
      }
      database.prepare("INSERT INTO schema_migrations (version,filename) VALUES (?,?)").run(version, filename);
      database.exec("COMMIT");
      results.push({ version, filename, baseline: baselineExisting && index === 0 });
      if (log) console.log(`[database] ${baselineExisting && index === 0 ? "Baselined" : "Applied"} ${filename}`);
    } catch (error) {
      database.exec("ROLLBACK");
      throw new Error(`Migration ${filename} failed: ${error.message}`, { cause: error });
    }
  }

  database.exec("PRAGMA optimize;");
  return results;
}

export function migrationsDirectory() {
  return defaultMigrationsDirectory;
}
