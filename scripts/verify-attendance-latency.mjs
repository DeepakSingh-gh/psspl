import assert from "node:assert/strict";
import { DatabaseSync, backup } from "node:sqlite";
import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";

// Only mutate an isolated snapshot, never the user's local/live attendance.
mkdirSync("scratch", { recursive: true });
const directory = mkdtempSync(join(process.cwd(), "scratch", "attendance-latency-"));
const databasePath = join(directory, "test.sqlite");
const source = new DatabaseSync(process.env.CRM_DATABASE_PATH || "data/crm.sqlite", { readOnly: true });
await backup(source, databasePath);
source.close();
const db = new DatabaseSync(databasePath);
const date = new Date().toISOString().slice(0, 10);
const admin = db.prepare("SELECT id FROM users WHERE role='admin' AND active=1 LIMIT 1").get();
const rep = db.prepare("SELECT u.id FROM users u JOIN salesperson_profiles p ON p.user_id=u.id WHERE u.role='salesperson' AND u.active=1 AND p.full_name LIKE 'Anil%' LIMIT 1").get();
assert.ok(admin && rep, "Snapshot needs an admin and the Anil field account");
db.prepare("DELETE FROM attendance WHERE user_id=? AND business_date=?").run(rep.id, date);
function session(user) {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").run(createHash("sha256").update(token).digest("hex"), user.id, new Date(Date.now()+600000).toISOString());
  return token;
}
const adminToken = session(admin), repToken = session(rep);
const reservation = createServer();
await new Promise(resolve => reservation.listen(0,"127.0.0.1",resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const base = `http://127.0.0.1:${port}/api`;
const server = spawn(process.execPath, ["server/app.mjs"], {
  env: { ...process.env, CRM_DATABASE_PATH: databasePath, PORT: String(port), HOST: "127.0.0.1" },
  stdio: ["ignore", "pipe", "pipe"],
});
server.stderr.on("data", () => {});
const ready = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("Isolated API startup timed out")),15000);
  server.stdout.on("data", chunk => { if (String(chunk).includes("PSSPL API running")) { clearTimeout(timeout); resolve(); } });
  server.once("exit", code => { clearTimeout(timeout); reject(new Error("Isolated API exited: "+code)); });
});
async function request(path, token, method = "GET") {
  const response = await fetch(base+path, { method, headers: { ...(token ? {Authorization:"Bearer "+token}:{}), "Content-Type":"application/json" }, ...(method === "POST" ? {body:"{}"}:{}), signal:AbortSignal.timeout(15000) });
  return { response, json: await response.json() };
}
try {
  await ready;
  assert.equal((await request("/admin/attendance/revision")).response.status,401);
  assert.equal((await request("/admin/attendance/revision",repToken)).response.status,403);
  const initial = await request("/admin/attendance/revision",adminToken);
  assert.equal(initial.response.headers.get("cache-control"),"no-store");
  assert.equal((await request("/admin/attendance/revision",adminToken)).json.revision,initial.json.revision);
  assert.equal((await request("/salespeople/me/check-in",repToken,"POST")).response.status,200);
  let started = performance.now();
  const checkedIn = await request("/admin/attendance/revision",adminToken);
  assert.notEqual(checkedIn.json.revision,initial.json.revision);
  let activity = await request("/admin/activity",adminToken);
  let row = activity.json.attendance.find(a=>a.userId===rep.id && a.businessDate===date);
  assert.ok(row?.checkInAt);
  assert.equal(row.checkOutAt,null);
  console.log("Check-in visible immediately in Admin API; revision + activity fetch "+Math.round(performance.now()-started)+" ms");
  assert.equal((await request("/sales/attendance/check-out",repToken,"POST")).response.status,200);
  started = performance.now();
  const checkedOut = await request("/admin/attendance/revision",adminToken);
  assert.notEqual(checkedOut.json.revision,checkedIn.json.revision);
  activity = await request("/admin/activity",adminToken);
  row = activity.json.attendance.find(a=>a.userId===rep.id && a.businessDate===date);
  assert.ok(row.checkOutAt);
  const detail = await request("/admin/team/aniljena",adminToken);
  assert.equal(detail.response.status,200);
  assert.equal(detail.json.attendance.checkOutAt,row.checkOutAt);
  console.log("Check-out visible in Admin activity and canonical RM detail; verification "+Math.round(performance.now()-started)+" ms");
  console.log("Authorization, no-cache and unchanged-revision checks passed. Original database unchanged.");
} finally {
  if (server.exitCode === null) { const exited = once(server,"exit"); server.kill(); await exited; }
  db.close();
}
