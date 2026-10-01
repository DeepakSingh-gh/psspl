import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { db } from "./db.mjs";

export function passwordHash(password, salt = randomBytes(16).toString("hex")) {
  const digest = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${digest}`;
}

export function verifyPassword(password, stored) {
  const [salt, expectedHex] = stored.split(":");
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function seedUsers() {
  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get("anil.jaina@psspl.com");
  if (exists) {
    db.prepare("UPDATE salesperson_profiles SET full_name=?,region=?,territory=? WHERE user_id=?").run("Anil Jena", "North Region", "Gurugram / Delhi NCR", exists.id);
    return;
  }
  db.prepare("INSERT INTO users (id,email,password_hash,role) VALUES (?,?,?,?)").run("sp-001", "anil.jaina@psspl.com", passwordHash("demo123"), "salesperson");
  db.prepare("INSERT INTO salesperson_profiles (user_id,employee_code,full_name,region,territory,monthly_target) VALUES (?,?,?,?,?,?)").run("sp-001", "PSSPL-S-001", "Anil Jena", "North Region", "Gurugram / Delhi NCR", 2.4);
}

/**
 * Ensures an admin account exists so the admin console is reachable on a fresh
 * database. Override with CRM_ADMIN_EMAIL / CRM_ADMIN_PASSWORD before first run;
 * the default password is for local development only and must be changed.
 */
export function seedAdmin() {
  const email = (process.env.CRM_ADMIN_EMAIL || "admin@psspl.com").toLowerCase();
  const existing = db.prepare("SELECT id FROM users WHERE email=?").get(email);
  if (existing) return;
  if (db.prepare("SELECT COUNT(*) count FROM users WHERE role='admin'").get().count) return;

  const password = process.env.CRM_ADMIN_PASSWORD || "psspl-admin-2026";
  const id = "admin-001";
  db.prepare("INSERT INTO users (id,email,password_hash,role) VALUES (?,?,?,?)").run(id, email, passwordHash(password), "admin");
  db.prepare("INSERT INTO salesperson_profiles (user_id,employee_code,full_name,region,territory,monthly_target) VALUES (?,?,?,?,?,?)")
    .run(id, "PSSPL-A-001", "PSSPL Administrator", "Head office", "All regions", 0);
  if (!process.env.CRM_ADMIN_PASSWORD) console.warn(`[auth] Seeded admin ${email} with the default development password. Change it before deploying.`);
}

export function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Please sign in" });
    if (!allowed.includes(req.user.role)) return res.status(403).json({ error: "You do not have access to this area" });
    next();
  };
}

/**
 * Sessions slide: each authenticated request pushes the idle deadline forward,
 * so an active user is never signed out mid-day. A session still dies after
 * IDLE_HOURS of no activity, and can never outlive MAX_DAYS from sign-in.
 */
const IDLE_HOURS = Number(process.env.CRM_SESSION_IDLE_HOURS) || 168;   // 7 days unused
const MAX_DAYS = Number(process.env.CRM_SESSION_MAX_DAYS) || 30;        // hard ceiling
const RENEW_AFTER_MS = 5 * 60 * 1000;                                   // throttle the write

const idleDeadline = (from = Date.now()) => new Date(from + IDLE_HOURS * 60 * 60 * 1000).toISOString();

/** SQLite CURRENT_TIMESTAMP is UTC without a zone marker. */
const asUtc = (value) => new Date(String(value).includes("T") ? value : `${String(value).replace(" ", "T")}Z`);

export function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = idleDeadline();
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(new Date().toISOString());
  db.prepare("INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)").run(tokenHash, userId, expiresAt);
  return { token, expiresAt };
}

export function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Please sign in" });
  const hash = createHash("sha256").update(token).digest("hex");
  const session = db.prepare(`SELECT u.id,u.email,u.role,s.expires_at,s.created_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND u.active=1`).get(hash);
  const now = Date.now();
  if (!session || new Date(session.expires_at).getTime() <= now) return res.status(401).json({ error: "Session expired" });

  // Absolute ceiling, so a continuously used token cannot live forever.
  if (now - asUtc(session.created_at).getTime() > MAX_DAYS * 24 * 60 * 60 * 1000) {
    db.prepare("DELETE FROM sessions WHERE token_hash=?").run(hash);
    return res.status(401).json({ error: "Session expired" });
  }

  // Slide the idle deadline, writing at most once every few minutes.
  const slideTo = idleDeadline(now);
  if (new Date(slideTo).getTime() - new Date(session.expires_at).getTime() > RENEW_AFTER_MS) {
    db.prepare("UPDATE sessions SET expires_at=? WHERE token_hash=?").run(slideTo, hash);
    session.expires_at = slideTo;
  }

  req.user = session;
  req.sessionTokenHash = hash;
  next();
}
