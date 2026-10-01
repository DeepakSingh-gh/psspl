import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runMigrations } from "../server/migrations.mjs";

const databasePath = resolve(process.env.CRM_DATABASE_PATH || "data/crm.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });

const database = new DatabaseSync(databasePath);
try {
  database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  const applied = runMigrations(database, { log: true });
  console.log(applied.length ? `[database] ${applied.length} migration(s) completed.` : "[database] Schema is already up to date.");
  console.log(`[database] ${databasePath}`);
} finally {
  database.close();
}
