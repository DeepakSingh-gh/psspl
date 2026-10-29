import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const scratch = mkdtempSync(join(tmpdir(), "psspl-phase1-"));
process.env.CRM_DATABASE_PATH = join(scratch, "synthetic.sqlite");
process.env.NODE_ENV = "test";
process.env.CRM_DISABLE_BASELINE_RESTORE = "true";

let db, createSession, salesRouter, createFollowUpRouter, rmRouter, adminRouter, sttRouter, buildContext, server, baseUrl;
const tokens = {};
const response = (path, token, method = "GET", body) => fetch(`${baseUrl}${path}`, {
  method,
  headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
  body: body ? JSON.stringify(body) : undefined,
});

before(async () => {
  ({ db } = await import("../server/db.mjs"));
  ({ createSession } = await import("../server/auth.mjs"));
  ({ salesRouter } = await import("../server/sales-routes.mjs"));
  ({ createFollowUpRouter } = await import("../server/follow-up-routes.mjs"));
  ({ rmRouter } = await import("../server/rm-routes.mjs"));
  ({ adminRouter } = await import("../server/admin.mjs"));
  ({ sttRouter } = await import("../server/stt.mjs"));
  ({ buildContext } = await import("../server/ai-context.mjs"));
  const { buildRmDirectory, resolveRmId } = await import("../server/rm-directory.mjs");

  const users = [
    ["admin", "admin@example.test", "admin"],
    ["alice", "alice@example.test", "salesperson"],
    ["bob", "bob@example.test", "salesperson"],
    ["manager", "manager@example.test", "rm"],
    ["manager2", "manager2@example.test", "rm"],
    ["charlie", "charlie@example.test", "salesperson"],
  ];
  for (const [id, email, role] of users) db.prepare("INSERT INTO users (id,email,password_hash,role) VALUES (?,?,?,?)").run(id, email, "synthetic", role);
  for (const [id, email, role] of users) {
    db.prepare("INSERT INTO salesperson_profiles (user_id,employee_code,full_name,region,territory,manager_user_id) VALUES (?,?,?,?,?,?)")
      .run(id, `code-${id}`, id === "manager" ? "Ketan Bhatt" : id === "manager2" ? "Gowri Shankar" : id, "North", "Synthetic", ["alice", "bob"].includes(id) ? "manager" : id === "charlie" ? "manager2" : null);
    tokens[id] = createSession(id).token;
  }
  db.prepare("INSERT INTO tally_customers (id,name,owner_user_id,rm_name) VALUES ('customer-a','Alice customer','alice','Ketan Bhatt'),('customer-b','Bob customer','bob','Ketan Bhatt'),('customer-c','Charlie customer','charlie','Ketan Bhat'),('customer-unassigned-alias','Unassigned alias customer',NULL,'Ketan Bhat'),('customer-unassigned','Unassigned customer',NULL,NULL)").run();
  const rmDirectory = buildRmDirectory();
  assert.equal(resolveRmId(rmDirectory, "Ketan Bhat"), resolveRmId(rmDirectory, "Ketan Bhatt"), "fixture must represent an existing RM spelling alias");
  db.prepare("INSERT INTO leads (id,user_id,name) VALUES ('lead-a','alice','Alice lead'),('lead-b','bob','Bob lead')").run();
  db.prepare("INSERT INTO customer_activities (id,user_id,lead_id,activity_type,subject) VALUES ('activity-b','bob','lead-b','call','Bob private activity')").run();
  db.prepare("INSERT INTO customer_activities (id,user_id,tally_customer_id,activity_type,subject) VALUES ('activity-b-on-a','bob','customer-a','call','Cross-user customer activity')").run();
  db.prepare("INSERT INTO customer_activities (id,user_id,tally_customer_id,activity_type,subject) VALUES ('activity-c-on-a','charlie','customer-a','call','Out-of-team customer activity')").run();
  db.prepare("INSERT INTO service_requests (id,user_id,lead_id,request_type,details) VALUES ('request-b','bob','lead-b','sample','Bob private request')").run();
  db.prepare("INSERT INTO follow_ups (id,user_id,tally_customer_id,title,due_date) VALUES ('follow-a','alice','customer-a','Alice follow-up','2026-10-20'),('follow-b','bob','customer-b','Bob follow-up','2026-10-20'),('follow-c','charlie','customer-c','Charlie follow-up','2026-10-20')").run();
  db.prepare("INSERT INTO tally_products (id,name) VALUES ('product-a','Alice Product'),('product-b','Bob Product')").run();
  db.prepare("INSERT INTO tally_invoices (id,company_name,voucher_type,invoice_date,customer_id,customer_name,amount) VALUES ('invoice-a','Test','Sales','2026-10-01','customer-a','Alice customer',100),('invoice-b','Test','Sales','2026-10-01','customer-b','Bob customer',900)").run();
  db.prepare("INSERT INTO tally_invoice_lines (id,invoice_id,product_id,product_name,quantity,rate,amount) VALUES ('line-a','invoice-a','product-a','Alice Product',1,100,100),('line-b','invoice-b','product-b','Bob Product',1,900,900)").run();

  const app = express();
  app.use(express.json());
  app.use("/sales", salesRouter);
  app.use("/follow-ups", createFollowUpRouter({ buildSalesDay: async (id) => ({ userId: id }) }));
  app.use("/rm", rmRouter);
  app.use("/admin", adminRouter);
  app.use("/", sttRouter);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
  db?.close();
  rmSync(scratch, { recursive: true, force: true });
});

test("lead mutations and child creation are confined to the authenticated owner", async () => {
  assert.equal((await response("/sales/leads/lead-b", tokens.alice, "PATCH", { name: "stolen" })).status, 404);
  assert.equal((await response("/sales/leads/lead-b", tokens.alice, "DELETE")).status, 404);
  assert.equal(db.prepare("SELECT name FROM leads WHERE id='lead-b'").get().name, "Bob lead");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM customer_activities WHERE id='activity-b'").get().n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM service_requests WHERE id='request-b'").get().n, 1);
  assert.equal((await response("/sales/activities", tokens.alice, "POST", { leadId: "lead-b", activityType: "call", subject: "attempt" })).status, 404);
  assert.equal((await response("/sales/requests", tokens.alice, "POST", { leadId: "lead-b", requestType: "sample", details: "attempt" })).status, 404);
  assert.equal((await response("/sales/leads/lead-a", tokens.alice, "PATCH", { name: "Alice updated" })).status, 200);
  assert.equal((await response("/sales/leads/lead-a", tokens.alice, "DELETE")).status, 200);
});

test("follow-up updates/deletes and customer-linked creation enforce ownership", async () => {
  assert.equal((await response("/follow-ups/follow-b/toggle", tokens.alice, "PATCH")).status, 404);
  assert.equal((await response("/follow-ups/follow-b", tokens.alice, "PATCH", { notes: "stolen" })).status, 404);
  assert.equal((await response("/follow-ups/follow-b", tokens.alice, "DELETE")).status, 404);
  assert.equal(db.prepare("SELECT completed,notes FROM follow_ups WHERE id='follow-b'").get().completed, 0);
  assert.equal((await response("/follow-ups", tokens.alice, "POST", { customerId: "customer-c", title: "bad", dueDate: "2026-10-20" })).status, 403);
  assert.equal((await response("/follow-ups/follow-a/toggle", tokens.alice, "PATCH")).status, 200);
  assert.equal(db.prepare("SELECT completed FROM follow_ups WHERE id='follow-a'").get().completed, 1);
});

test("RM dormant-reason mutations are limited to the RM's assigned team", async () => {
  assert.equal((await response("/rm/customers/customer-c/dormant-reason", tokens.manager, "POST", { reason: "unauthorized" })).status, 404);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM dormant_reasons WHERE customer_id='customer-c'").get().n, 0);
  assert.equal((await response("/rm/customers/customer-b/dormant-reason", tokens.manager, "POST", { reason: "Synthetic follow-up needed" })).status, 200);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM dormant_reasons WHERE customer_id='customer-b' AND rm_id='manager'").get().n, 1);
});

test("customer details exclude another user's activity and transcription rejects unauthenticated calls", async () => {
  const detail = await response("/sales/customers/customer-c", tokens.alice);
  assert.equal(detail.status, 403);
  const peerCustomer = await response("/sales/customers/customer-b", tokens.alice);
  assert.equal(peerCustomer.status, 403, "a salesperson cannot open a peer's customer, even under the same RM");
  const ownCustomer = await response("/sales/customers/customer-a", tokens.alice);
  assert.equal(ownCustomer.status, 200);
  const activityIds = (await ownCustomer.json()).activities.map((item) => item.id);
  assert.ok(!activityIds.includes("activity-b-on-a"), "customer detail shows only the signed-in salesperson's activity");
  assert.ok(!activityIds.includes("activity-c-on-a"));
  const stt = await response("/stt", null, "POST");
  assert.equal(stt.status, 401);
  const invalidAudio = await fetch(`${baseUrl}/stt`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokens.alice}`, "Content-Type": "application/json" },
    body: JSON.stringify({ audio: "not an upload" }),
  });
  assert.equal(invalidAudio.status, 400);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const limited = await response("/stt", tokens.alice, "POST");
    if (attempt === 11) assert.equal(limited.status, 429);
    else assert.equal(limited.status, 400);
  }
});

test("owner IDs and manager relationships govern access; RM aliases never override ownership", async () => {
  // Salespeople retain only their own records; RM team access uses the RM API.
  assert.equal((await response("/sales/customers/customer-a", tokens.alice)).status, 200);
  assert.equal((await response("/rm/customers/customer-a", tokens.manager)).status, 200);

  // The same RM alias cannot override a different explicit owner or claim an unassigned row.
  assert.equal((await response("/sales/customers/customer-c", tokens.manager)).status, 403);
  assert.equal((await response("/sales/customers/customer-unassigned-alias", tokens.manager)).status, 403);
  assert.equal((await response("/sales/customers/customer-unassigned", tokens.alice)).status, 403);
  assert.equal((await response("/rm/customers/customer-c", tokens.manager)).status, 403);
  assert.equal((await response("/rm/customers/customer-unassigned-alias", tokens.manager)).status, 403);
  assert.equal((await response("/sales/customers/customer-a", tokens.manager2)).status, 403);

  // Admin authority is role-based and company-wide, including intentionally unassigned rows.
  assert.equal((await response("/admin/attendance/revision", tokens.admin)).status, 200);
  assert.equal((await response("/admin/attendance/revision", tokens.manager)).status, 403);
  assert.equal((await response("/admin/attendance/revision", tokens.alice)).status, 403);
  assert.equal((await response("/sales/customers/customer-c", tokens.admin)).status, 200);
  assert.equal((await response("/sales/customers/customer-unassigned", tokens.admin)).status, 200);
});

test("admin can assign and reassign a salesperson to an RM; each RM dashboard follows that assignment", async () => {
  assert.equal((await response("/admin/users", tokens.admin, "POST", { email: "unassigned@example.test", role: "salesperson", fullName: "No Manager" })).status, 400);
  const created = await response("/admin/users", tokens.admin, "POST", {
    email: "new-rep@example.test", loginId: "new-rep", initialPassword: "Synthetic-Initial-2026!", role: "salesperson",
    fullName: "New Rep", managerUserId: "manager", region: "North", territory: "Synthetic",
  });
  assert.equal(created.status, 201);
  const createResult = await created.json();
  const createdUser = createResult.user;
  assert.equal(createdUser.managerUserId, "manager");
  assert.equal(createdUser.managerName, "Ketan Bhatt");
  assert.equal(createdUser.active, true);
  assert.equal(createResult.invitation, undefined);
  const pendingTeam = await (await response("/rm/dashboard", tokens.manager)).json();
  assert.ok(pendingTeam.members.some((member) => member.id === createdUser.id), "new account is immediately visible to its assigned RM");

  assert.equal((await response("/rm/dashboard", tokens.manager)).status, 200);
  const firstTeam = await (await response("/rm/dashboard", tokens.manager)).json();
  assert.ok(firstTeam.members.some((member) => member.id === createdUser.id));
  assert.ok(!firstTeam.members.some((member) => member.id === "charlie"));

  const reassigned = await response(`/admin/users/${createdUser.id}`, tokens.admin, "PATCH", { managerUserId: "manager2" });
  assert.equal(reassigned.status, 200);
  assert.equal((await reassigned.json()).user.managerUserId, "manager2");
  const formerTeam = await (await response("/rm/dashboard", tokens.manager)).json();
  const newTeam = await (await response("/rm/dashboard", tokens.manager2)).json();
  assert.ok(!formerTeam.members.some((member) => member.id === createdUser.id));
  assert.ok(newTeam.members.some((member) => member.id === createdUser.id));

  assert.equal((await response(`/admin/users/${createdUser.id}`, tokens.alice, "PATCH", { managerUserId: "manager" })).status, 403);
  const invalidRm = await response(`/admin/users/${createdUser.id}`, tokens.admin, "PATCH", { managerUserId: "alice" });
  assert.equal(invalidRm.status, 400);
});

test("AI product aggregates obey individual and RM team scope", async () => {
  const aliceContext = JSON.parse(await buildContext("alice", "salesperson"));
  assert.ok(aliceContext.topProducts.some((p) => p.name === "Alice Product"));
  assert.ok(!aliceContext.topProducts.some((p) => p.name === "Bob Product"));
  const managerContext = JSON.parse(await buildContext("manager", "rm"));
  assert.ok(managerContext.topProducts.some((p) => p.name === "Bob Product"));
  assert.ok(managerContext.topProducts.some((p) => p.name === "Alice Product"));
});

test("encrypted SQLite backup and restore preserve synthetic rows in disposable files", async () => {
  const backupDir = join(scratch, "backups");
  const restorePath = join(scratch, "synthetic-restored.sqlite");
  const key = "ab".repeat(32);
  const env = { ...process.env, CRM_DATABASE_PATH: join(scratch, "synthetic.sqlite"), CRM_BACKUP_DIR: backupDir, CRM_BACKUP_ENCRYPTION_KEY: key };
  const staleTemp = join(backupDir, `.psspl-backup-${"a".repeat(32)}.tmp`);
  const activeTemp = join(backupDir, `.psspl-backup-${"b".repeat(32)}.tmp`);
  mkdirSync(backupDir, { recursive: true });
  writeFileSync(staleTemp, "interrupted old write");
  writeFileSync(activeTemp, "active or recent write");
  const staleDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  utimesSync(staleTemp, staleDate, staleDate);
  const backupResult = spawnSync(process.execPath, ["scripts/backup-sqlite.mjs", "backup"], { cwd: process.cwd(), encoding: "utf8", env });
  assert.equal(backupResult.status, 0, backupResult.stderr);
  assert.equal(existsSync(staleTemp), false, "stale tool temp should be cleaned");
  assert.equal(existsSync(activeTemp), true, "recent/concurrent-looking temp must be preserved");
  const unpublishedRestore = spawnSync(process.execPath, ["scripts/backup-sqlite.mjs", "restore", activeTemp, join(scratch, "unpublished.sqlite")], { cwd: process.cwd(), encoding: "utf8", env });
  assert.notEqual(unpublishedRestore.status, 0);
  assert.match(unpublishedRestore.stderr, /completed, published/);
  const backupName = readdirSync(backupDir).find((name) => name.endsWith(".sqlite.enc"));
  assert.ok(backupName);
  assert.match(backupName, /^psspl-.*-[0-9a-f]{16}\.sqlite\.enc$/);
  const encryptedPath = join(backupDir, backupName);
  const encrypted = readFileSync(encryptedPath);
  assert.ok(encrypted.subarray(0, 8).toString() === "PSSPLBK1");
  assert.ok(!encrypted.includes(Buffer.from("Alice customer")));
  const restoreResult = spawnSync(process.execPath, ["scripts/backup-sqlite.mjs", "restore", encryptedPath, restorePath], { cwd: process.cwd(), encoding: "utf8", env });
  assert.equal(restoreResult.status, 0, restoreResult.stderr);
  const overwriteResult = spawnSync(process.execPath, ["scripts/backup-sqlite.mjs", "restore", encryptedPath, restorePath], { cwd: process.cwd(), encoding: "utf8", env });
  assert.notEqual(overwriteResult.status, 0);
  assert.match(overwriteResult.stderr, /target already exists/);
  const tamperedPath = join(backupDir, `psspl-2026-10-17T00-00-00-000Z-${"c".repeat(16)}.sqlite.enc`);
  const tampered = Buffer.from(encrypted);
  tampered[tampered.length - 1] ^= 1;
  writeFileSync(tamperedPath, tampered);
  const tamperedRestore = spawnSync(process.execPath, ["scripts/backup-sqlite.mjs", "restore", tamperedPath, join(scratch, "tampered.sqlite")], { cwd: process.cwd(), encoding: "utf8", env });
  assert.notEqual(tamperedRestore.status, 0);
  assert.match(tamperedRestore.stderr, /Unsupported|Unsupported state|authenticate|Unsupported message/);
  assert.equal(readFileSync(join(scratch, "synthetic.sqlite")).length > 0, true);
  const restored = new DatabaseSync(restorePath, { readOnly: true });
  assert.equal(restored.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
  assert.equal(restored.prepare("SELECT COUNT(*) n FROM tally_customers").get().n, 5);
  restored.close();
});

test("backup command fails closed without destination or valid key", () => {
  const result = spawnSync(process.execPath, ["scripts/backup-sqlite.mjs", "backup"], {
    cwd: process.cwd(), encoding: "utf8", env: { ...process.env, CRM_DATABASE_PATH: join(scratch, "synthetic.sqlite"), CRM_BACKUP_DIR: "", CRM_BACKUP_ENCRYPTION_KEY: "" },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CRM_BACKUP_DIR/);
});

test("production startup guard leaves an existing database unchanged unless explicitly approved", () => {
  const guardedPath = join(scratch, "synthetic-existing-production.sqlite");
  const guarded = new DatabaseSync(guardedPath);
  guarded.exec("CREATE TABLE synthetic_marker(value TEXT); INSERT INTO synthetic_marker VALUES ('preserve');");
  guarded.close();
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", "await import('./server/db.mjs')"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "production", CRM_DATABASE_PATH: guardedPath, CRM_DISABLE_BASELINE_RESTORE: "true", CRM_ALLOW_STARTUP_SCHEMA_CHANGES: "" },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Refusing to start against an existing production database/);
  const verify = new DatabaseSync(guardedPath, { readOnly: true });
  assert.equal(verify.prepare("SELECT value FROM synthetic_marker").get().value, "preserve");
  assert.equal(verify.prepare("SELECT name FROM sqlite_schema WHERE name='schema_migrations'").get(), undefined);
  verify.close();
});

test("rate limiter isolates keys and resets its window", async () => {
  const { createRateLimiter } = await import("../server/rate-limit.mjs");
  let now = 1000;
  let allowed = 0;
  const middleware = createRateLimiter({ windowMs: 1000, max: 2, key: (req) => req.user.id, now: () => now });
  const invoke = (userId) => {
    const headers = {};
    const res = { setHeader: (name, value) => { headers[name] = value; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    middleware({ user: { id: userId } }, res, () => { allowed += 1; });
    return res;
  };
  invoke("alice"); invoke("alice");
  assert.equal(invoke("alice").code, 429);
  assert.equal(invoke("bob").code, undefined);
  now += 1001;
  assert.equal(invoke("alice").code, undefined);
  assert.equal(allowed, 4);
});
