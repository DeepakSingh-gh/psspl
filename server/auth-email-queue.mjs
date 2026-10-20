import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { db, transaction } from "./db.mjs";
import { emailProviderStatus, sendTransactionalEmail } from "./email-provider.mjs";
import { reconcilePendingResendEvent } from "./resend-webhook.mjs";

const digest = (value) => createHash("sha256").update(value).digest("hex");
const key = () => {
  const value = process.env.CRM_EMAIL_QUEUE_KEY?.trim();
  return value && /^[a-f0-9]{64}$/i.test(value) ? Buffer.from(value, "hex") : null;
};
export const emailQueueConfigured = () => Boolean(key());

function encrypt(value) {
  const secret = key();
  if (!secret) throw new Error("Email queue encryption key is not configured");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

function decrypt(value) {
  const secret = key();
  if (!secret) throw new Error("Email queue encryption key is not configured");
  const bytes = Buffer.from(value, "base64");
  const decipher = createDecipheriv("aes-256-gcm", secret, bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"));
}

export function enqueueAuthEmail({ userId, purpose, tokenHash, expiresAt, recipient, template }) {
  const id = randomUUID();
  db.prepare(`UPDATE auth_email_queue SET status='canceled',encrypted_payload='',updated_at=?
    WHERE user_id=? AND purpose=? AND status IN ('queued','processing')`)
    .run(new Date().toISOString(), userId, purpose);
  db.prepare(`INSERT INTO auth_email_queue
    (id,user_id,purpose,token_hash,encrypted_payload,idempotency_key,expires_at,next_attempt_at)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, userId, purpose, tokenHash, encrypt({ recipient, template }), digest(`${userId}:${purpose}:${tokenHash}`), expiresAt, new Date().toISOString());
  return id;
}

function finish(id, status, error = null) {
  db.prepare(`UPDATE auth_email_queue SET status=?,encrypted_payload='',lease_until=NULL,last_error=?,updated_at=? WHERE id=?`)
    .run(status, error, new Date().toISOString(), id);
}

function recordDelivery(job, status, emailId = null) {
  db.prepare(`INSERT INTO auth_email_delivery(id,user_id,purpose,email_id,status) VALUES(?,?,?,?,?)`)
    .run(job.id, job.user_id, job.purpose, emailId, status);
  if (emailId) reconcilePendingResendEvent(db, emailId);
}

export async function processAuthEmailQueue({ limit = 10 } = {}) {
  db.prepare("DELETE FROM auth_email_pending_events WHERE created_at<datetime('now','-7 days')").run();
  let processed = 0;
  for (; processed < limit; processed += 1) {
    const job = transaction(() => {
      const now = new Date().toISOString();
      const candidate = db.prepare(`SELECT * FROM auth_email_queue
        WHERE (status='queued' AND next_attempt_at<=?) OR (status='processing' AND lease_until<=?)
        ORDER BY created_at,id LIMIT 1`).get(now, now);
      if (!candidate) return null;
      db.prepare(`UPDATE auth_email_queue SET status='processing',attempts=attempts+1,lease_until=?,updated_at=? WHERE id=?`)
        .run(new Date(Date.now() + 120_000).toISOString(), now, candidate.id);
      return { ...candidate, attempts: candidate.attempts + 1 };
    });
    if (!job) break;
    const now = new Date().toISOString();
    const current = db.prepare(`SELECT u.email,u.active,t.token_hash FROM users u
      LEFT JOIN auth_tokens t ON t.user_id=u.id AND t.purpose=? AND t.token_hash=? AND t.expires_at>?
      WHERE u.id=?`).get(job.purpose, job.token_hash, now, job.user_id);
    if (job.expires_at <= now || !current?.token_hash || (job.purpose === "reset" && !current.active) || (job.purpose === "activate" && current.active)) {
      finish(job.id, job.expires_at <= now ? "expired" : "canceled");
      continue;
    }
    let payload;
    try { payload = decrypt(job.encrypted_payload); }
    catch { finish(job.id, "failed", "payload_unavailable"); continue; }
    if (payload.recipient !== current.email) { finish(job.id, "canceled", "recipient_changed"); continue; }
    const result = await sendTransactionalEmail({ to: payload.recipient, ...payload.template, purpose: job.purpose, idempotencyKey: job.idempotency_key });
    if (result.accepted) {
      transaction(() => { finish(job.id, "accepted"); recordDelivery(job, "accepted", result.emailId); });
    } else if (result.retryable && job.attempts < 5 && Date.now() + 30_000 < Date.parse(job.expires_at) && Date.now() - Date.parse(`${job.created_at.replace(" ", "T")}Z`) < 60 * 60_000) {
      const delay = Math.min(30_000 * 2 ** (job.attempts - 1), 240_000);
      db.prepare(`UPDATE auth_email_queue SET status='queued',lease_until=NULL,next_attempt_at=?,last_error=?,updated_at=? WHERE id=?`)
        .run(new Date(Date.now() + delay).toISOString(), result.reason ?? "provider_unavailable", new Date().toISOString(), job.id);
    } else {
      transaction(() => {
        finish(job.id, "failed", result.reason ?? "provider_unavailable");
        recordDelivery(job, result.status === "unknown" ? "unknown" : "failed");
      });
    }
  }
  return processed;
}

let workerRunning = false;
export async function kickAuthEmailQueue() {
  if (workerRunning || !emailQueueConfigured() || !emailProviderStatus().configured) return;
  workerRunning = true;
  try { await processAuthEmailQueue(); }
  finally { workerRunning = false; }
}
