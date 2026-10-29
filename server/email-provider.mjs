import { createHash } from "node:crypto";
import { Resend } from "resend";
import { smtpOptions, sendSmtpEmail } from "./smtp-email.mjs";

const providerName = () => (process.env.CRM_EMAIL_PROVIDER || "disabled").trim().toLowerCase();
const apiKey = () => process.env.RESEND_API_KEY?.trim();
const sender = () => process.env.EMAIL_FROM?.trim() || process.env.CRM_EMAIL_FROM?.trim();
let client;
class SafeResend extends Resend {
  // The SDK's development logger prints raw provider responses, which may echo
  // message content. Preserve SDK behavior while emitting only a fixed label.
  logError() { console.warn("[email:resend] provider_request_failed"); }
}

export function emailProviderStatus() {
  if (providerName() === "smtp") return { configured: Boolean(smtpOptions()), provider: "smtp" };
  const configured = providerName() === "resend" && Boolean(apiKey()) && Boolean(sender());
  return { configured, provider: configured ? "resend" : "disabled" };
}

function getClient() {
  if (!client || client.key !== apiKey()) client = new SafeResend(apiKey());
  return client;
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Submit a transactional message. Idempotency protects retries from duplicate sends. */
export async function sendTransactionalEmail({ to, subject, text, html, purpose, idempotencyKey }) {
  if (!emailProviderStatus().configured) return { accepted: false, status: "not_configured", reason: "email_not_configured" };
  if (providerName() === "smtp") return sendSmtpEmail({ to, subject, text, html, idempotencyKey });
  const stableKey = idempotencyKey || createHash("sha256").update(`${purpose || "transactional"}:${to}:${subject}`).digest("hex");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { data, error } = await getClient().emails.send({
        from: sender(), to, subject, text, html,
        tags: purpose ? [{ name: "purpose", value: purpose }] : undefined,
      }, { idempotencyKey: stableKey, signal: AbortSignal.timeout(10_000) });
      if (!error && data?.id) return { accepted: true, emailId: data.id, status: "accepted" };
      const statusCode = error?.statusCode;
      const retryable = statusCode === 429 || (typeof statusCode === "number" && statusCode >= 500)
        || error?.name === "concurrent_idempotent_requests"
        || error?.name === "rate_limit_exceeded" || error?.name === "internal_server_error";
      if (retryable && attempt < 2) { await pause(250 * (2 ** attempt)); continue; }
      return { accepted: false, status: "failed", reason: "provider_rejected", retryable };
    } catch {
      // The outcome of a network failure can be ambiguous. Retry only with the same idempotency key.
      if (attempt < 2) { await pause(250 * (2 ** attempt)); continue; }
      return { accepted: false, status: "unknown", reason: "provider_unavailable", retryable: true };
    }
  }
  return { accepted: false, status: "unknown", reason: "provider_unavailable", retryable: true };
}
