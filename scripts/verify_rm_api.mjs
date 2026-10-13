import { db } from "../server/db.mjs";

console.log("Checking print-report data model...");
const profile = db.prepare("SELECT * FROM salesperson_profiles WHERE full_name='Anil Jena' AND employee_code='075709'").get();
if (!profile) {
  console.error("FAIL: Profile not found");
  process.exit(1);
}

const weekly = db.prepare("SELECT COUNT(*) count FROM rm_weekly_purchases WHERE rm_name='Anil Jena'").get();
if (!weekly || weekly.count === 0) {
  console.error("FAIL: Weekly purchases not populated");
  process.exit(1);
}

const prevYear = db.prepare("SELECT COUNT(*) count, SUM(actual_lakh) actual FROM rm_historical_monthly_performance WHERE rm_name='Anil Jena' AND financial_year='2025-26'").get();
if (!prevYear || prevYear.count !== 12 || Math.round(prevYear.actual) !== 260) {
  console.error(`FAIL: Previous year data mismatch: count=${prevYear?.count}, actual=${prevYear?.actual}`);
  process.exit(1);
}

console.log("PASS: Database model for RM report validated!");
