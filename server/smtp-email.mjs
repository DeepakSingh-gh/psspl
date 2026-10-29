import { createHash } from "node:crypto";
import nodemailer from "nodemailer";

export function smtpOptions() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT);
  const secureText = process.env.SMTP_SECURE?.trim().toLowerCase();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const from = (process.env.EMAIL_FROM || process.env.CRM_EMAIL_FROM || "").trim();
  const fromAddress = from.match(/<([^<>]+)>$/)?.[1] || from;
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !["true", "false"].includes(secureText) || !user || !pass?.trim()) return null;
  // Gmail rewrites unverified senders. Require the authenticated mailbox explicitly.
  if (fromAddress.toLowerCase() !== user.toLowerCase() || /[\r\n]/.test(from + user + host)) return null;
  if (host.toLowerCase() === "smtp.gmail.com" && (port !== 465 || secureText !== "true")) return null;
  return {
    host, port, secure: secureText === "true", requireTLS: true,
    auth: { user, pass }, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
    logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true,
  };
}

// SMTP has no idempotency contract. Retry only an explicit 4xx rejection or a
// failure before message submission; a lost DATA response must stay unknown.
export function smtpFailure(error) {
  const code = error?.code;
  const responseCode = error?.responseCode;
  if (code === "EAUTH") return { accepted: false, status: "failed", reason: "smtp_auth_failed", retryable: false };
  if (Number.isInteger(responseCode) && responseCode >= 400 && responseCode < 600) return {
    accepted: false, status: "failed", reason: responseCode < 500 ? "smtp_temporarily_rejected" : "smtp_rejected", retryable: responseCode < 500,
  };
  if (["EDNS", "ECONNECTION"].includes(code) || error?.command === "CONN") return { accepted: false, status: "failed", reason: "smtp_connection_failed", retryable: true };
  return { accepted: false, status: "unknown", reason: "smtp_submission_unknown", retryable: false };
}

export async function sendSmtpEmail({ to, subject, text, html, idempotencyKey }) {
  const options = smtpOptions();
  if (!options) return { accepted: false, status: "not_configured", reason: "email_not_configured" };
  const transport = nodemailer.createTransport(options);
  try {
    const key = createHash("sha256").update(idempotencyKey || `${to}:${subject}`).digest("hex");
    const result = await transport.sendMail({ from: (process.env.EMAIL_FROM || process.env.CRM_EMAIL_FROM).trim(), to, subject, text, html, messageId: `<${key}@psspl-crm.local>` });
    if (result.accepted?.some(address => String(address).toLowerCase() === to.toLowerCase())) {
      return { accepted: true, status: "accepted", emailId: `smtp:${result.messageId}` };
    }
    const failure = { accepted: false, status: "failed", reason: "smtp_recipient_rejected", retryable: false };
    console.warn("[email:smtp]", failure.reason);
    return failure;
  } catch (error) {
    const failure = smtpFailure(error);
    // Never log the error object, server response, recipients, message or credentials.
    console.warn("[email:smtp]", failure.reason);
    return failure;
  } finally { transport.close(); }
}
