import { DatabaseSync } from "node:sqlite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const sourcePath = resolve(process.env.CRM_DATABASE_PATH || "data/crm.sqlite");
const destination = resolve("database/migrations/001_initial_schema.sql");
const database = new DatabaseSync(sourcePath, { readOnly: true });

try {
  const rows = database.prepare(`
    SELECT type,name,sql FROM sqlite_schema
    WHERE sql IS NOT NULL
      AND name NOT LIKE 'sqlite_%'
      AND name <> 'schema_migrations'
    ORDER BY CASE type WHEN 'table' THEN 1 WHEN 'index' THEN 2 ELSE 3 END, name
  `).all();
  const sql = [
    "-- PSSPL CRM SQLite baseline. Generated from the reviewed application schema.",
    "-- Do not place customer or Tally data in migration files.",
    "PRAGMA foreign_keys = ON;",
    "",
    ...rows.flatMap((row) => [`-- ${row.type}: ${row.name}`, `${row.sql};`, ""]),
    "PRAGMA optimize;",
    "",
  ].join("\n");
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, sql, "utf8");
  console.log(`[database] Wrote ${destination}`);
} finally {
  database.close();
}
