/**
 * WhatsApp Cloud API integration.
 * Set WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_RECIPIENT_NUMBER in .env
 * to enable real message delivery. Without credentials, operations return a graceful stub.
 */

const WA_API = "https://graph.facebook.com/v19.0";

function isConfigured() {
  return !!(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_RECIPIENT_NUMBER);
}

/**
 * Send a text message.
 * @param {string} text  — plain text body (max 4096 chars)
 * @param {string} [to]  — E.164 recipient number; falls back to WHATSAPP_RECIPIENT_NUMBER
 * @returns {{ ok: boolean; message: string; messageId?: string }}
 */
export async function sendWhatsAppText(text, to) {
  if (!isConfigured()) {
    return { ok: false, message: "WhatsApp is not configured. Add WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN and WHATSAPP_RECIPIENT_NUMBER to .env." };
  }
  const recipient = to ?? process.env.WHATSAPP_RECIPIENT_NUMBER;
  const url = `${WA_API}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` },
      body: JSON.stringify({ messaging_product: "whatsapp", to: recipient, type: "text", text: { body: text.slice(0, 4096) } }),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("[WhatsApp] API error:", json);
      return { ok: false, message: `WhatsApp API error: ${json?.error?.message ?? resp.statusText}` };
    }
    return { ok: true, message: "WhatsApp message sent", messageId: json?.messages?.[0]?.id };
  } catch (e) {
    if (e.name === "AbortError") return { ok: false, message: "WhatsApp request timed out" };
    console.error("[WhatsApp] Error:", e);
    return { ok: false, message: "WhatsApp delivery failed" };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Format and send the EOD summary for a given RM's team to WhatsApp.
 */
export async function sendEodSummary(db) {
  const today = new Date().toISOString().slice(0, 10);
  const visits = db.prepare("SELECT COUNT(*) total, COALESCE(SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END),0) completed FROM visits WHERE business_date=?").get(today);
  const checkins = db.prepare("SELECT COUNT(*) count FROM attendance WHERE business_date=? AND check_in_at IS NOT NULL").get(today);
  const followUps = db.prepare("SELECT COUNT(*) count FROM follow_ups WHERE completed=0").get();
  const expectedOrders = db.prepare("SELECT COALESCE(SUM(expected_value),0) total, COUNT(*) count FROM expected_orders WHERE status='open'").get();

  const text = [
    `📊 *PSSPL CRM — EOD Summary for ${today}*`,
    ``,
    `✅ Check-ins today: ${checkins.count}`,
    `🗓 Visits completed: ${visits.completed} of ${visits.total}`,
    `📌 Open follow-ups: ${followUps.count}`,
    `💰 Expected orders: ${expectedOrders.count} worth ₹${(expectedOrders.total / 100000).toFixed(2)} L`,
    ``,
    `Detailed reports at: ${process.env.CRM_PUBLIC_URL ?? "http://127.0.0.1:4000"}/admin`,
  ].join("\n");

  return sendWhatsAppText(text);
}
