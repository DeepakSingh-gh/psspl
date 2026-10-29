import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readdirSync } from "node:fs";
import { runMigrations, migrationsDirectory } from "../server/migrations.mjs";

function legacyDatabase(withExistingColumns) {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE leads(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,stage TEXT NOT NULL DEFAULT 'lead'${withExistingColumns ? ',tally_customer_id TEXT,source_visit_id TEXT' : ''});
    CREATE TABLE schema_migrations(version TEXT PRIMARY KEY,filename TEXT NOT NULL,applied_at TEXT DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO leads(id,user_id,stage) VALUES('saved-lead','saved-rm','quotation');`);
  for (const filename of readdirSync(migrationsDirectory()).filter((name) => /^\d+_.*\.sql$/.test(name) && Number(name.slice(0, 3)) < 16))
    db.prepare("INSERT INTO schema_migrations(version,filename) VALUES(?,?)").run(filename.slice(0, 3), filename);
  return db;
}

for (const existing of [false, true]) test(`visit-lead migration handles ${existing ? 'existing' : 'missing'} link columns`, () => {
  const db = legacyDatabase(existing);
  try {
    assert.deepEqual(runMigrations(db).map((row) => row.version), ["016"]);
    assert.deepEqual(runMigrations(db), []);
    const columns = db.prepare("PRAGMA table_info(leads)").all().map((row) => row.name);
    assert.ok(columns.includes("tally_customer_id"));
    assert.ok(columns.includes("source_visit_id"));
    assert.equal(db.prepare("SELECT stage FROM leads WHERE id='saved-lead'").get().stage, "quotation");
  } finally { db.close(); }
});
