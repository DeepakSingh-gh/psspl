import { db } from "../server/db.mjs";

console.log("Checking Anil Jena profile and targets...");
const profile = db.prepare("SELECT * FROM salesperson_profiles WHERE full_name='Anil Jena' AND employee_code='075709'").get();
if (!profile) {
  console.error("FAIL: Anil Jena profile with employee_code 075709 not found");
  process.exit(1);
}

const team = db.prepare("SELECT * FROM salesperson_profiles WHERE manager_user_id=?").all(profile.user_id);
if (team.length < 9) {
  console.error(`FAIL: Expected at least 9 team members, found ${team.length}`);
  process.exit(1);
}

const targets = db.prepare("SELECT SUM(target_lakh) total FROM tally_rm_targets WHERE rm_name='Anil Jena' AND (period LIKE '2026-%' OR period LIKE '2027-%')").get();
if (!targets || Math.round(targets.total) !== 501) {
  console.error(`FAIL: Expected 501 Lakh target in 2026-27, got ${targets?.total}`);
  process.exit(1);
}

console.log("PASS: Verification succeeded!");
