import { createHash, randomBytes } from "node:crypto";
import { db, transaction } from "./db.mjs";
import { emailProviderStatus } from "./email-provider.mjs";
import { authEmailTemplate } from "./email-templates.mjs";
import { emailQueueConfigured, enqueueAuthEmail, kickAuthEmailQueue } from "./auth-email-queue.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const publicUrl = () => {
  const configured = (process.env.APP_BASE_URL || process.env.CRM_PUBLIC_URL || "").trim();
  if (!configured) return "";
  try {
    const url = new URL(configured);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) return "";
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") return "";
    return configured.replace(/\/+$/, "");
  } catch { return ""; }
};
const TOKEN_TTL_MINUTES = { activate: 48 * 60, reset: 15 };
const TOKEN_TTL_LABEL = { activate: "48 hours", reset: "15 minutes" };
const EMAIL_COOLDOWN_SECONDS = 60;

export function queueAccountToken(user, purpose) {
  if (!Object.hasOwn(TOKEN_TTL_MINUTES, purpose)) throw new Error("Unsupported account token purpose");
  if (!publicUrl() || !emailProviderStatus().configured || !emailQueueConfigured())
    return { sent: false, reason: "email_not_configured", deliveryStatus: "not_configured" };
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES[purpose] * 60 * 1000).toISOString();
  const page = purpose === "activate" ? "activate-account" : "reset-password";
  const actionUrl = `${publicUrl()}/${page}?token=${encodeURIComponent(token)}`;
  const fullName = db.prepare("SELECT full_name FROM salesperson_profiles WHERE user_id=?").get(user.id)?.full_name;
  const template = authEmailTemplate({ purpose, actionUrl, expiresIn: TOKEN_TTL_LABEL[purpose], displayName: fullName });
  return transaction(() => {
    const recentToken = db.prepare("SELECT 1 FROM auth_tokens WHERE user_id=? AND purpose=? AND created_at>datetime('now',?)").get(user.id, purpose, `-${EMAIL_COOLDOWN_SECONDS} seconds`);
    if (recentToken) return { sent: false, reason: "cooldown", deliveryStatus: "recently_requested" };
    const pending = db.prepare("SELECT 1 FROM auth_email_queue WHERE user_id=? AND purpose=? AND status IN ('queued','processing') AND expires_at>? LIMIT 1").get(user.id, purpose, new Date().toISOString());
    if (pending) return { sent: false, reason: "delivery_pending", deliveryStatus: "queued" };
    db.prepare("DELETE FROM auth_tokens WHERE user_id=? AND purpose=?").run(user.id, purpose);
    db.prepare("INSERT INTO auth_tokens (token_hash,user_id,purpose,expires_at) VALUES (?,?,?,?)").run(hash(token), user.id, purpose, expiresAt);
    const id = enqueueAuthEmail({ userId: user.id, purpose, tokenHash: hash(token), expiresAt, recipient: user.email, template });
    return { sent: false, reason: "queued", deliveryStatus: "queued", queueId: id };
  });
}

export async function issueAccountToken(user, purpose) {
  const queued = queueAccountToken(user, purpose);
  if (!queued.queueId) return queued;
  await kickAuthEmailQueue();
  const state = db.prepare("SELECT status,last_error FROM auth_email_queue WHERE id=?").get(queued.queueId);
  return { sent: state?.status === "accepted", reason: state?.last_error ?? state?.status, deliveryStatus: state?.status ?? "unknown" };
}

export function consumeAccountToken(token, purpose) {
  if (typeof token !== "string" || token.length < 32 || token.length > 128) return null;
  const digest = hash(token);
  const record = db.prepare("DELETE FROM auth_tokens WHERE token_hash=? AND purpose=? AND expires_at>? RETURNING user_id").get(digest, purpose, new Date().toISOString());
  return record ? { userId: record.user_id, digest } : null;
}
