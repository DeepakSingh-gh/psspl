import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("encrypted auth email jobs survive restart, retry safely, and skip stale links", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "psspl-auth-mail-"));
  const databasePath = join(scratch, "synthetic.sqlite");
  const sendLog = join(scratch, "send.log");
  Object.assign(process.env, {
    NODE_ENV: "test", CRM_TEST_DATABASE_ROOT: scratch, CRM_DATABASE_PATH: databasePath,
    CRM_DISABLE_BASELINE_RESTORE: "true", CRM_EMAIL_PROVIDER: "resend",
    RESEND_API_KEY: "synthetic-provider-key", EMAIL_FROM: "PSSPL <crm@example.test>",
    APP_BASE_URL: "http://crm.example.test", CRM_EMAIL_QUEUE_KEY: "6".repeat(64),
    CRM_TEST_SEND_LOG: sendLog,
  });
  const { db } = await import("../server/db.mjs");
  const { queueAccountToken } = await import("../server/auth-tokens.mjs");
  const { recordResendEmailEvent } = await import("../server/resend-webhook.mjs");
  const worker = (fail = false, emailId = "") => {
    const result = spawnSync(process.execPath, ["scripts/auth-email-queue-worker.mjs"], {
      cwd: process.cwd(), env: { ...process.env, CRM_TEST_PROVIDER_FAILURE: String(fail), CRM_TEST_EMAIL_ID: emailId }, encoding: "utf8", timeout: 15_000,
    });
    assert.equal(result.status, 0, result.stderr);
  };
  const attempts = () => readFileSync(sendLog, "utf8").trim().split("\n").length;
  try {
    db.prepare("INSERT INTO users(id,email,password_hash,role,active) VALUES('invite','invite@example.test','synthetic','salesperson',0),('reset','reset@example.test','synthetic','salesperson',1),('expired','expired@example.test','synthetic','salesperson',0),('rejected','rejected@example.test','synthetic','rm',0)").run();
    const invite = queueAccountToken({ id: "invite", email: "invite@example.test" }, "activate");
    assert.equal(invite.deliveryStatus, "queued");
    assert.equal(queueAccountToken({ id: "invite", email: "invite@example.test" }, "activate").reason, "cooldown");
    const queued = db.prepare("SELECT encrypted_payload,token_hash FROM auth_email_queue WHERE id=?").get(invite.queueId);
    assert.ok(queued.encrypted_payload && !queued.encrypted_payload.includes("invite@example.test"));
    assert.match(queued.token_hash, /^[a-f0-9]{64}$/);
    const earlyEmailId = "synthetic-invite-before-response";
    assert.equal(recordResendEmailEvent(db, { type: "email.delivered", created_at: new Date().toISOString(), data: { email_id: earlyEmailId } }), true);
    worker(false, earlyEmailId);
    assert.equal(db.prepare("SELECT status,encrypted_payload FROM auth_email_queue WHERE id=?").get(invite.queueId).status, "accepted");
    assert.equal(db.prepare("SELECT encrypted_payload FROM auth_email_queue WHERE id=?").get(invite.queueId).encrypted_payload, "");
    assert.equal(db.prepare("SELECT status FROM auth_email_delivery WHERE id=?").get(invite.queueId).status, "delivered");
    worker();
    assert.equal(attempts(), 1, "accepted jobs are not sent again after restart");

    const reset = queueAccountToken({ id: "reset", email: "reset@example.test" }, "reset");
    worker(true);
    assert.equal(db.prepare("SELECT status,attempts FROM auth_email_queue WHERE id=?").get(reset.queueId).status, "queued");
    assert.equal(db.prepare("SELECT attempts FROM auth_email_queue WHERE id=?").get(reset.queueId).attempts, 1);
    db.prepare("UPDATE auth_tokens SET created_at='2000-01-01' WHERE user_id='reset'").run();
    assert.equal(queueAccountToken({ id: "reset", email: "reset@example.test" }, "reset").reason, "delivery_pending");
    db.prepare("UPDATE auth_email_queue SET next_attempt_at='2000-01-01' WHERE id=?").run(reset.queueId);
    worker();
    assert.equal(db.prepare("SELECT status,attempts FROM auth_email_queue WHERE id=?").get(reset.queueId).status, "accepted");
    assert.equal(db.prepare("SELECT attempts FROM auth_email_queue WHERE id=?").get(reset.queueId).attempts, 2);

    const stale = queueAccountToken({ id: "expired", email: "expired@example.test" }, "activate");
    db.prepare("UPDATE auth_tokens SET expires_at='2000-01-01' WHERE user_id='expired'").run();
    const before = attempts();
    worker();
    assert.equal(db.prepare("SELECT status FROM auth_email_queue WHERE id=?").get(stale.queueId).status, "canceled");
    assert.equal(attempts(), before, "expired token is never submitted to Resend");

    const rejected = queueAccountToken({ id: "rejected", email: "rejected@example.test" }, "activate");
    worker("permanent");
    const rejectedJob = db.prepare("SELECT status,encrypted_payload FROM auth_email_queue WHERE id=?").get(rejected.queueId);
    assert.equal(rejectedJob.status, "failed");
    assert.equal(rejectedJob.encrypted_payload, "");
    assert.equal(db.prepare("SELECT status FROM auth_email_delivery WHERE id=?").get(rejected.queueId).status, "failed");
  } finally {
    db.close();
    rmSync(scratch, { recursive: true, force: true });
  }
});
