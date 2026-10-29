// Local links are useful only on the CRM host. Never send them to the employee list.
export function emailAppUrl() {
  try {
    const url = new URL((process.env.APP_BASE_URL || process.env.CRM_PUBLIC_URL || "").trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) return "";
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") return "";
    return url.href.replace(/\/+$/, "");
  } catch { return ""; }
}

export function isLocalEmailUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "localhost" || host.endsWith(".localhost") || host === "[::1]" || host === "0.0.0.0" || /^127\./.test(host);
  } catch { return true; }
}

export function localTestRecipient() {
  return (process.env.CRM_EMAIL_LOCAL_TEST_RECIPIENT || process.env.SMTP_USER || "").trim().toLowerCase();
}

export function emailLinkAllowed(recipient, url = emailAppUrl()) {
  if (!url) return false;
  if (!isLocalEmailUrl(url)) return true;
  return process.env.NODE_ENV !== "production" && Boolean(localTestRecipient()) && recipient.trim().toLowerCase() === localTestRecipient();
}
