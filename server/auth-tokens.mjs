import { createHash, randomBytes } from "node:crypto";
import { db, transaction } from "./db.mjs";
import { emailProviderStatus } from "./email-provider.mjs";
import { authEmailTemplate } from "./email-templates.mjs";
import { emailQueueConfigured, enqueueAuthEmail, kickAuthEmailQueue } from "./auth-email-queue.mjs";
import { emailAppUrl, emailLinkAllowed } from "./email-link-policy.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const publicUrl = emailAppUrl;
const TOKEN_TTL_MINUTES = { activate: 48 * 60, reset: 15 };
const TOKEN_TTL_LABEL = { activate: "48 hours", reset: "15 minutes" };
const EMAIL_COOLDOWN_SECONDS = 60;
const accountIdentity = id => db.prepare(`SELECT u.email,u.login_id loginId,u.role,p.full_name displayName,p.mobile_number mobileNumber,p.employee_code employeeCode,p.region,p.territory,p.monthly_target monthlyTarget,m.full_name managerName FROM users u LEFT JOIN salesperson_profiles p ON p.user_id=u.id LEFT JOIN salesperson_profiles m ON m.user_id=p.manager_user_id WHERE u.id=?`).get(id);

export function queueAccountToken(user, purpose, { accountEmail = false, initialPassword, credentialVersion } = {}) {
  if (!Object.hasOwn(TOKEN_TTL_MINUTES, purpose)) throw new Error("Unsupported account token purpose");
  if (accountEmail && !emailLinkAllowed(user.email)) return queueAccountNotice(user, { initialPassword, credentialVersion });
  if (!publicUrl() || !emailProviderStatus().configured || !emailQueueConfigured())
    return { sent: false, reason: "email_not_configured", deliveryStatus: "not_configured" };
  if (!emailLinkAllowed(user.email)) return { sent: false, reason: "local_link_restricted", deliveryStatus: "not_configured" };
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES[purpose] * 60 * 1000).toISOString();
  const page = purpose === "activate" ? "activate-account" : "reset-password";
  // Fragments stay in the browser and do not enter HTTP access logs/referrers.
  const actionUrl = `${publicUrl()}/${page}#token=${encodeURIComponent(token)}`;
  const fullName = db.prepare("SELECT full_name FROM salesperson_profiles WHERE user_id=?").get(user.id)?.full_name;
  const loginId = db.prepare("SELECT login_id FROM users WHERE id=?").get(user.id)?.login_id;
  const template = authEmailTemplate({ ...(accountEmail ? accountIdentity(user.id) : {}), purpose, actionUrl, expiresIn: TOKEN_TTL_LABEL[purpose], displayName: fullName, accountEmail, loginId, initialPassword, crmUrl: publicUrl() });
  return transaction(() => {
    const recentToken = db.prepare("SELECT 1 FROM auth_tokens WHERE user_id=? AND purpose=? AND created_at>datetime('now',?)").get(user.id, purpose, `-${EMAIL_COOLDOWN_SECONDS} seconds`);
    if (recentToken) return { sent: false, reason: "cooldown", deliveryStatus: "recently_requested" };
    const pending = db.prepare("SELECT 1 FROM auth_email_queue WHERE user_id=? AND purpose=? AND status IN ('queued','processing') AND expires_at>? LIMIT 1").get(user.id, purpose, new Date().toISOString());
    if (pending) return { sent: false, reason: "delivery_pending", deliveryStatus: "queued" };
    db.prepare("DELETE FROM auth_tokens WHERE user_id=? AND purpose=?").run(user.id, purpose);
    db.prepare("INSERT INTO auth_tokens (token_hash,user_id,purpose,expires_at) VALUES (?,?,?,?)").run(hash(token), user.id, purpose, expiresAt);
    const id = enqueueAuthEmail({ userId: user.id, purpose, tokenHash: hash(token), expiresAt, recipient: user.email, template, credentialVersion, linkUrls: [publicUrl(), actionUrl] });
    return { sent: false, reason: "queued", deliveryStatus: "queued", queueId: id };
  });
}

function queueAccountNotice(user, { initialPassword, credentialVersion } = {}) {
  if (!emailProviderStatus().configured || !emailQueueConfigured()) return { sent: false, reason: "email_not_configured", deliveryStatus: "not_configured", setupLinkIncluded: false };
  const identity = db.prepare("SELECT u.login_id,p.full_name FROM users u LEFT JOIN salesperson_profiles p ON p.user_id=u.id WHERE u.id=? AND u.active=1 AND u.deleted_at IS NULL AND u.role IN ('rm','salesperson')").get(user.id);
  if (!identity) return { sent: false, reason: "account_unavailable", deliveryStatus: "canceled", setupLinkIncluded: false };
  return transaction(() => {
    if (db.prepare("SELECT 1 FROM auth_email_queue WHERE user_id=? AND purpose='account' AND created_at>datetime('now','-60 seconds')").get(user.id)) return { sent: false, reason: "cooldown", deliveryStatus: "recently_requested", setupLinkIncluded: false };
    if (db.prepare("SELECT 1 FROM auth_email_queue WHERE user_id=? AND purpose='account' AND status IN ('queued','processing') AND expires_at>?").get(user.id, new Date().toISOString())) return { sent: false, reason: "delivery_pending", deliveryStatus: "queued", setupLinkIncluded: false };
    const template = authEmailTemplate({ ...accountIdentity(user.id), accountEmail: true, initialPassword, crmUrl: "", actionUrl: "" });
    const id = enqueueAuthEmail({ userId: user.id, purpose: "account", tokenHash: hash(randomBytes(32)), expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(), recipient: user.email, template, appUrl: "", credentialVersion, linkUrls: [] });
    return { sent: false, reason: "queued", deliveryStatus: "queued", queueId: id, setupLinkIncluded: false };
  });
}

export async function issueAccountToken(user, purpose, options) {
  const queued = queueAccountToken(user, purpose, options);
  if (!queued.queueId) {
    if (options?.accountEmail && ["cooldown", "delivery_pending"].includes(queued.reason)) {
      const latest = db.prepare("SELECT COALESCE(d.status,q.status) status FROM auth_email_queue q LEFT JOIN auth_email_delivery d ON d.id=q.id WHERE q.user_id=? AND q.purpose=? ORDER BY q.created_at DESC,q.rowid DESC LIMIT 1").get(user.id, queued.setupLinkIncluded === false ? "account" : purpose);
      return { ...queued, previousDeliveryStatus: latest?.status ?? "unknown" };
    }
    return queued;
  }
  await kickAuthEmailQueue();
  const state = db.prepare("SELECT q.status, q.last_error, d.status delivery_status FROM auth_email_queue q LEFT JOIN auth_email_delivery d ON d.id=q.id WHERE q.id=?").get(queued.queueId);
  return { sent: state?.status === "accepted", reason: state?.last_error ?? state?.status, deliveryStatus: state?.delivery_status ?? state?.status ?? "unknown", ...(options?.accountEmail ? { setupLinkIncluded: queued.setupLinkIncluded !== false, passwordIncluded: Boolean(options.initialPassword) } : {}) };
}

export function consumeAccountToken(token, purpose) {
  if (typeof token !== "string" || token.length < 32 || token.length > 128) return null;
  const digest = hash(token);
  const record = db.prepare("DELETE FROM auth_tokens WHERE token_hash=? AND purpose=? AND expires_at>? RETURNING user_id").get(digest, purpose, new Date().toISOString());
  return record ? { userId: record.user_id, digest } : null;
}
