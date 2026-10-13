import { db } from "./db.mjs";
db.prepare("CREATE TABLE IF NOT EXISTS dormant_reasons (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id TEXT, rm_id TEXT, reason TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)").run();
console.log("Migration complete");
