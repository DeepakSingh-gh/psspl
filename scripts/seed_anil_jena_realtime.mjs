import { db, transaction } from "../server/db.mjs";
import crypto from "crypto";

function hashPassword(pwd) {
  const salt = crypto.randomBytes(16).toString("hex");
  const dig = crypto.scryptSync(pwd, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
  return `${salt}:${dig}`;
}

transaction(() => {
  console.log("Seeding Anil Jena real-time data from PDF...");

  // 1. Create table for weekly purchases if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS rm_weekly_purchases (
      rm_name TEXT NOT NULL,
      year_month TEXT NOT NULL,
      week_num INTEGER NOT NULL,
      achieved_lakh REAL NOT NULL DEFAULT 0,
      PRIMARY KEY(rm_name, year_month, week_num)
    );

    CREATE TABLE IF NOT EXISTS rm_historical_monthly_performance (
      rm_name TEXT NOT NULL,
      financial_year TEXT NOT NULL,
      month_idx INTEGER NOT NULL,
      month_name TEXT NOT NULL,
      target_lakh REAL NOT NULL,
      actual_lakh REAL NOT NULL,
      PRIMARY KEY(rm_name, financial_year, month_idx)
    );
  `);

  // Add registration codes to salesperson_profiles if columns don't exist
  try { db.exec("ALTER TABLE salesperson_profiles ADD COLUMN operating_city TEXT;"); } catch {}
  try { db.exec("ALTER TABLE salesperson_profiles ADD COLUMN reg_code_1 TEXT;"); } catch {}
  try { db.exec("ALTER TABLE salesperson_profiles ADD COLUMN reg_code_2 TEXT;"); } catch {}

  // 2. Update Anil Jena RM profile
  // One canonical RM login; do not recreate the retired duplicate alias account.
  const anilPwd = hashPassword("psspl-rm-2026");
  db.prepare(`
    INSERT OR REPLACE INTO users (id, email, password_hash, role, active)
    VALUES ('rm-anil-jena', 'anil.jena@psspl.com', ?, 'rm', 1)
  `).run(anilPwd);

  db.prepare(`
    INSERT OR REPLACE INTO salesperson_profiles 
    (user_id, employee_code, full_name, region, territory, operating_city, reg_code_1, reg_code_2, monthly_target)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('rm-anil-jena', '075709', 'Anil Jena', 'North Region', 'Gurugram', 'Gurugram', '2111C126', '2111S126', 41.75);

  // 3. Team (Sales Executives, Gurugram)
  const salesTeam = [
    { name: "Sandeep Kumar", city: "Ghaziabad (Tech Serv Center)" },
    { name: "Sushil Kumar", city: "Delhi, Sonepat, Bahadurgarh" },
    { name: "Tika Prasad Yadav", city: "Delhi, Sonepat, Bahadurgarh, Sahibabad" },
    { name: "Purshottam Sarang", city: "Rudrapur" },
    { name: "Atal Trevidi", city: "Gurgaon" },
    { name: "Girand Kumar", city: "Gurgaon" },
    { name: "Soumya Das", city: "Gurgaon" },
    { name: "Prashant Jadon", city: "Faridabad" },
    { name: "Vikrant Jadon", city: "Noida" },
  ];

  const defaultRepPwd = hashPassword("demo123");
  salesTeam.forEach((member, i) => {
    const userId = `sp-aj-${i + 1}`;
    const email = `${member.name.toLowerCase().replace(/\s+/g, ".")}@psspl.com`;
    const empCode = `AJ-SE-${String(i + 1).padStart(3, "0")}`;

    db.prepare(`
      INSERT OR REPLACE INTO users (id, email, password_hash, role, active)
      VALUES (?, ?, ?, 'salesperson', 1)
    `).run(userId, email, defaultRepPwd);

    db.prepare(`
      INSERT OR REPLACE INTO salesperson_profiles 
      (user_id, employee_code, full_name, region, territory, operating_city, manager_user_id, monthly_target)
      VALUES (?, ?, ?, 'North Region', ?, 'Gurugram', 'rm-anil-jena', 10.0)
    `).run(userId, empCode, member.name, member.city);
  });

  // Also link field alias rep if any
  db.prepare(`
    UPDATE salesperson_profiles SET manager_user_id='rm-anil-jena' WHERE user_id='sp-101'
  `).run();

  // 4. Monthly Target vs Achievement (Rs. Lakh) for Current Year (FY 2026-27)
  // Total Target: 501.00 Lakh
  const monthlyTargets2026 = [
    { period: "2026-04", month: "Apr", target: 37.58, actual: 35.64 },
    { period: "2026-05", month: "May", target: 50.10, actual: 7.64 },
    { period: "2026-06", month: "Jun", target: 41.75, actual: 20.20 },
    { period: "2026-07", month: "Jul", target: 37.58, actual: 7.89 },
    { period: "2026-08", month: "Aug", target: 41.75, actual: 23.02 },
    { period: "2026-09", month: "Sep", target: 45.93, actual: 19.85 },
    { period: "2026-10", month: "Oct", target: 45.93, actual: 0.0 },
    { period: "2026-11", month: "Nov", target: 37.58, actual: 0.0 },
    { period: "2026-12", month: "Dec", target: 33.40, actual: 0.0 },
    { period: "2027-01", month: "Jan", target: 37.58, actual: 0.0 },
    { period: "2027-02", month: "Feb", target: 41.75, actual: 0.0 },
    { period: "2027-03", month: "Mar", target: 50.10, actual: 0.0 },
  ];

  for (const m of monthlyTargets2026) {
    db.prepare(`
      INSERT OR REPLACE INTO tally_rm_targets (rm_name, period, target_lakh)
      VALUES ('Anil Jena', ?, ?)
    `).run(m.period, m.target);
  }

  // 5. Weekly Purchases Breakdown
  const weeklyMatrix = [
    { period: "2026-04", w1: 0.00, w2: 27.25, w3: 4.15, w4: 4.24 },
    { period: "2026-05", w1: 0.00, w2: 1.01, w3: 2.34, w4: 4.29 },
    { period: "2026-06", w1: 0.00, w2: 9.73, w3: 4.11, w4: 6.36 },
    { period: "2026-07", w1: 0.00, w2: 2.35, w3: 0.00, w4: 5.54 },
    { period: "2026-08", w1: 13.72, w2: 4.66, w3: 1.65, w4: 2.99 },
    { period: "2026-09", w1: 4.16, w2: 4.55, w3: 0.42, w4: 10.71 },
  ];

  for (const wm of weeklyMatrix) {
    db.prepare("INSERT OR REPLACE INTO rm_weekly_purchases (rm_name, year_month, week_num, achieved_lakh) VALUES ('Anil Jena', ?, 1, ?)").run(wm.period, wm.w1);
    db.prepare("INSERT OR REPLACE INTO rm_weekly_purchases (rm_name, year_month, week_num, achieved_lakh) VALUES ('Anil Jena', ?, 2, ?)").run(wm.period, wm.w2);
    db.prepare("INSERT OR REPLACE INTO rm_weekly_purchases (rm_name, year_month, week_num, achieved_lakh) VALUES ('Anil Jena', ?, 3, ?)").run(wm.period, wm.w3);
    db.prepare("INSERT OR REPLACE INTO rm_weekly_purchases (rm_name, year_month, week_num, achieved_lakh) VALUES ('Anil Jena', ?, 4, ?)").run(wm.period, wm.w4);
  }

  // 6. Previous Year Performance (FY 2025-26)
  // Target: 606.00, Actual Sales: 260.43
  const previousYearData = [
    { idx: 0, month: "Apr", target: 45.45, actual: 21.59 },
    { idx: 1, month: "May", target: 60.60, actual: 20.51 },
    { idx: 2, month: "Jun", target: 50.50, actual: 38.58 },
    { idx: 3, month: "Jul", target: 45.45, actual: 10.18 },
    { idx: 4, month: "Aug", target: 50.50, actual: 22.70 },
    { idx: 5, month: "Sep", target: 55.55, actual: 23.43 },
    { idx: 6, month: "Oct", target: 55.55, actual: 13.03 },
    { idx: 7, month: "Nov", target: 45.45, actual: 21.57 },
    { idx: 8, month: "Dec", target: 40.40, actual: 21.00 },
    { idx: 9, month: "Jan", target: 45.45, actual: 17.12 },
    { idx: 10, month: "Feb", target: 50.50, actual: 13.46 },
    { idx: 11, month: "Mar", target: 60.60, actual: 37.27 },
  ];

  for (const py of previousYearData) {
    db.prepare(`
      INSERT OR REPLACE INTO rm_historical_monthly_performance 
      (rm_name, financial_year, month_idx, month_name, target_lakh, actual_lakh)
      VALUES ('Anil Jena', '2025-26', ?, ?, ?, ?)
    `).run(py.idx, py.month, py.target, py.actual);
  }

  // 7. Territory Expansion: New Dealers
  // Chem X Enterprises and S.B.Refractory
  db.prepare(`
    UPDATE tally_customers 
    SET rm_name='Anil Jena', rm_code='075709', owner_user_id='rm-anil-jena', city='Gurugram'
    WHERE name LIKE '%Chem X%' OR name LIKE '%Refractory%'
  `).run();

  // 8. Seed Thrust Products Schedule for Anil Jena
  const pdfThrustProducts = [
    "Zpn Blue 15", "Zpn 200", "Zpn Black", "Shimaclad", "Peony",
    "Clearclad", "Lcbh", "Enilex", "Chorme Catalyst", "POP",
    "Uviclad 612", "Patinas"
  ];

  pdfThrustProducts.forEach((pName, idx) => {
    const tpId = `tp-pdf-${idx + 1}`;
    const alias = `%${pName.toUpperCase()}%`;
    db.prepare(`
      INSERT OR REPLACE INTO thrust_products (id, name, alias_keywords, sort_order, active)
      VALUES (?, ?, ?, ?, 1)
    `).run(tpId, pName, alias, idx + 1);
  });

  console.log("Successfully seeded Anil Jena real-time data!");
});
