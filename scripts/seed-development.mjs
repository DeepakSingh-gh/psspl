import { randomUUID } from "node:crypto";
import { db, transaction } from "../server/db.mjs";
import { passwordHash, seedAdmin } from "../server/auth.mjs";

if (process.env.NODE_ENV === "production") throw new Error("Development seed data cannot be loaded in production.");

seedAdmin();

const email = "demo.salesperson@local.test";
const existing = db.prepare("SELECT id FROM users WHERE email=?").get(email);
const userId = existing?.id || randomUUID();

transaction(() => {
  if (!existing) {
    db.prepare("INSERT INTO users (id,email,password_hash,role) VALUES (?,?,?,?)")
      .run(userId, email, passwordHash("demo123"), "salesperson");
    db.prepare("INSERT INTO salesperson_profiles (user_id,employee_code,full_name,region,territory,monthly_target) VALUES (?,?,?,?,?,?)")
      .run(userId, "DEMO-S-001", "Demo Salesperson", "Demo Region", "Demo Territory", 1);
  }
});

console.log("[database] Development seed is ready.");
console.log("[database] Salesperson: demo.salesperson@local.test / demo123");
console.log("[database] Admin credentials come from CRM_ADMIN_EMAIL and CRM_ADMIN_PASSWORD.");
