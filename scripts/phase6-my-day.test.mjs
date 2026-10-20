import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";

const scratch = mkdtempSync(join(tmpdir(), "psspl-my-day-test-"));
const portProbe = createServer();
await new Promise((resolve) => portProbe.listen(0, "127.0.0.1", resolve));
const port = portProbe.address().port;
await new Promise((resolve) => portProbe.close(resolve));
process.env.CRM_DATABASE_PATH = join(scratch, "crm.sqlite");
process.env.CRM_DISABLE_BASELINE_RESTORE = "true";
process.env.NODE_ENV = "test";
process.env.PORT = String(port);

const { db } = await import("../server/db.mjs");
db.prepare("INSERT INTO users(id,email,password_hash,role) VALUES('synthetic-rep','rep@test.invalid','x','salesperson')").run();
db.prepare("INSERT INTO salesperson_profiles(user_id,employee_code,full_name,region,territory,monthly_target) VALUES('synthetic-rep','rep','Synthetic Rep','Test','Test',0)").run();
const { createSession } = await import("../server/auth.mjs");
const token = createSession("synthetic-rep").token;
await import("../server/app.mjs");
let response;
for (let attempt = 0; attempt < 30; attempt += 1) {
  try {
    response = await fetch(`http://127.0.0.1:${port}/api/salespeople/me/my-day`, { headers: { Authorization: `Bearer ${token}` } });
    break;
  } catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
}
console.log(`Isolated synthetic My Day response: ${response?.status ?? "unavailable"}`);
if (response) console.log((await response.text()).slice(0, 500));
db.close();
rmSync(scratch, { recursive: true, force: true });
process.exit(response?.ok ? 0 : 1);
