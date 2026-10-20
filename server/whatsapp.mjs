/** External delivery requires an explicit deployment gate and an approved per-user schedule. */
export function whatsappConfigured(env = process.env) {
  return env.WHATSAPP_DELIVERY_ENABLED === "true" && Boolean(env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN && /^v[0-9]+\.0$/.test(env.WHATSAPP_GRAPH_VERSION ?? ""));
}
export async function sendWhatsAppTemplate(schedule, text, { env = process.env, fetcher = fetch } = {}) {
  if (!whatsappConfigured(env)) return { status: "disabled", error: "delivery-disabled" };
  if (!schedule.enabled || !schedule.opted_in || !schedule.template_approved || !schedule.approval_reference || !/^\+[1-9][0-9]{7,14}$/.test(schedule.phone)) return { status: "blocked", error: "approval-required" };
  if (typeof text !== "string" || text.length > 1024) return { status: "blocked", error: "report-exceeds-approved-template-parameter" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetcher(`https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION}/${encodeURIComponent(env.WHATSAPP_PHONE_NUMBER_ID)}/messages`, {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
      body: JSON.stringify({ messaging_product: "whatsapp", to: schedule.phone, type: "template", template: { name: schedule.template_name, language: { code: schedule.language }, components: [{ type: "body", parameters: [{ type: "text", text }] }] } })
    });
    const json = await response.json().catch(() => ({}));
    if (response.ok && typeof json.messages?.[0]?.id === "string") return { status: "accepted", messageId: json.messages[0].id };
    // A timeout/5xx/invalid success can mean accepted remotely. Never auto-retry ambiguous results.
    if (response.status === 429) return { status: "retry", error: "rate-limited" };
    if (response.status >= 400 && response.status < 500) return { status: "failed", error: `http-${response.status}` };
    return { status: "review", error: "ambiguous-provider-result" };
  } catch { return { status: "review", error: "ambiguous-network-result" }; }
  finally { clearTimeout(timeout); }
}
// Legacy free-text and global EOD paths cannot bypass approval/template/deduplication controls.
export async function sendWhatsAppText() { return { ok: false, message: "Use an approved report schedule; free-text report delivery is disabled." }; }
export async function sendEodSummary() { return { ok: false, message: "Use approved per-user report schedules." }; }
