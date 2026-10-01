/**
 * Seeds a small set of demo field-activity rows so the Field activity screens
 * and the live map have something to show.
 *
 *   node seed_demo_field.mjs          seed
 *   node seed_demo_field.mjs --remove delete every demo row
 *
 * Every row id starts with "demo-", so nothing else is touched and cleanup is
 * exact. Only CRM tables are written; Tally data is never modified.
 */
import { DatabaseSync } from "node:sqlite";

const DB = "C:/Users/khushi/Downloads/psspl-dashboard/psspl-dashboard/data/crm.sqlite";
const db = new DatabaseSync(DB);
const REMOVE = process.argv.includes("--remove");

const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
/** Minutes before now, so nothing is ever timestamped in the future. */
const ago = (minutes) => new Date(now.getTime() - minutes * 60000).toISOString();

function clear() {
  const tables = [
    ["visit_products", "visit_id LIKE 'demo-%'"],
    ["expected_orders", "id LIKE 'demo-%'"],
    ["follow_ups", "id LIKE 'demo-%'"],
    ["visits", "id LIKE 'demo-%'"],
    ["attendance", "id LIKE 'demo-%'"],
    ["location_pings", "id LIKE 'demo-%'"],
  ];
  let removed = 0;
  for (const [table, where] of tables) {
    const before = db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE ${where}`).get().n;
    db.prepare(`DELETE FROM ${table} WHERE ${where}`).run();
    removed += before;
  }
  return removed;
}

if (REMOVE) {
  console.log(`removed ${clear()} demo rows`);
  db.close();
  process.exit(0);
}

clear(); // make the seed repeatable

const rep = db.prepare("SELECT id FROM users WHERE email='anil.jaina@psspl.com' AND active=1").get();
if (!rep) { console.log("salesperson account not found"); process.exit(1); }

// Real customers, so names and links resolve everywhere.
const customers = db.prepare(`SELECT c.id, c.name FROM tally_customers c
  JOIN users u ON u.id = c.owner_user_id WHERE u.email = 'anil@psspl.com' LIMIT 3`).all();
if (customers.length < 3) { console.log("need 3 owned customers"); process.exit(1); }

// Gurugram / Delhi NCR — matches this salesperson's territory.
const route = [
  [28.4595, 77.0266], [28.4689, 77.0521], [28.4820, 77.0890],
  [28.5012, 77.1134], [28.5194, 77.1402],
];

db.exec("BEGIN IMMEDIATE");
try {
  db.prepare(`INSERT INTO attendance (id,user_id,business_date,check_in_at,check_out_at,latitude,longitude)
    VALUES (?,?,?,?,?,?,?)`)
    .run("demo-att-1", rep.id, today, ago(215), null, route[0][0], route[0][1]);

  const visits = [
    ["demo-visit-1", customers[0].id, ago(180), "Product discussion", "completed", ago(182), ago(139),
      "Order confirmed for Ultec 3005", route[1]],
    ["demo-visit-2", customers[1].id, ago(110), "Payment follow-up", "completed", ago(112), ago(75),
      "Cheque collected, ledger to be reconciled", route[2]],
    ["demo-visit-3", customers[2].id, ago(25), "New requirement", "in_progress", ago(27), null, null, route[3]],
  ];
  const addVisit = db.prepare(`INSERT INTO visits
    (id,user_id,business_date,tally_customer_id,scheduled_at,started_at,completed_at,purpose,outcome,notes,latitude,longitude,status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const [id, customerId, scheduled, purpose, status, started, completed, outcome, point] of visits) {
    addVisit.run(id, rep.id, today, customerId, scheduled, started, completed, purpose, outcome, outcome, point[0], point[1], status);
  }

  const addFollowUp = db.prepare(`INSERT INTO follow_ups
    (id,user_id,visit_id,tally_customer_id,title,due_date,priority,completed,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  addFollowUp.run("demo-follow-1", rep.id, "demo-visit-1", customers[0].id, "Share revised Ultec 3005 quotation", today, "today", 0, ago(135));
  addFollowUp.run("demo-follow-2", rep.id, "demo-visit-2", customers[1].id, "Confirm cheque clearance with accounts", yesterday, "overdue", 0, ago(70));
  addFollowUp.run("demo-follow-3", rep.id, null, customers[2].id, "Send technical datasheet", today, "today", 1, ago(20));

  const addPing = db.prepare("INSERT INTO location_pings (id,user_id,latitude,longitude,accuracy,captured_at) VALUES (?,?,?,?,?,?)");
  route.forEach((point, index) => {
    addPing.run(`demo-ping-${index + 1}`, rep.id, point[0], point[1], 12, ago(210 - index * 45));
  });

  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}

console.log("seeded for", today);
for (const t of ["attendance", "visits", "follow_ups", "location_pings"]) {
  console.log(`  ${t}: ${db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n} rows`);
}
console.log("\ncustomers used:", customers.map((c) => c.name).join(", "));
console.log("remove with: node seed_demo_field.mjs --remove");
db.close();
