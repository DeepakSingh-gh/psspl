import { db } from "../server/db.mjs";

console.log("=== USERS & PROFILES ===");
const users = db.prepare(`
  SELECT u.id, u.email, u.role, p.full_name, p.employee_code, p.manager_user_id
  FROM users u
  LEFT JOIN salesperson_profiles p ON p.user_id = u.id
`).all();
console.log(users);

console.log("\n=== PROTEC FINISH CUSTOMER ===");
const cust = db.prepare(`
  SELECT id, name, rm_name, owner_user_id, city
  FROM tally_customers
  WHERE name LIKE '%Protec%' OR name LIKE '%Finish%'
`).all();
console.log(cust);
