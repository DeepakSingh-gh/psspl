import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { Router, raw } from "express";
import { indiaBusinessDate } from "./field-activity.mjs";
import { authorizedScope, reportSnapshot } from "./report-snapshot.mjs";
import { sendWhatsAppTemplate, whatsappConfigured } from "./whatsapp.mjs";

const statusRanks = { accepted: 1, failed: 2, delivered: 3, read: 4 };
function applyBufferedStatus(db, messageId) {
  const event = db.prepare("SELECT status,updated_at FROM report_status_events WHERE provider_message_id=?").get(messageId);
  const current = db.prepare("SELECT status FROM report_deliveries WHERE provider_message_id=?").get(messageId);
  if (event && current && (statusRanks[event.status] ?? 0) > (statusRanks[current.status] ?? 0)) db.prepare("UPDATE report_deliveries SET status=?,error_code=?,updated_at=? WHERE provider_message_id=? AND status=?").run(event.status, event.status === "failed" ? "provider-delivery-failed" : null, event.updated_at, messageId, current.status);
}

export function scheduledPeriod(schedule, now) {
  const day = indiaBusinessDate(now);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  if (schedule.cadence === "daily") return time < schedule.send_time ? null : { from: day, to: day };
  // Monthly reports run on day 1 for the complete prior calendar month.
  if (day.slice(8) === "01" && time < schedule.send_time) return null;
  const last = new Date(`${day.slice(0, 7)}-01T00:00:00Z`);
  last.setUTCDate(0);
  const to = last.toISOString().slice(0, 10);
  return { from: `${to.slice(0, 7)}-01`, to };
}

export function formatReport(snapshot) {
  return `PSSPL ${snapshot.scope} report: ${snapshot.period.from} to ${snapshot.period.to}. Net Tally sales INR ${snapshot.sales.salesValue ?? "unavailable"}; invoices ${snapshot.sales.invoiceCount}. Target achievement ${snapshot.performance.achievementPercent ?? "unavailable"}. Current pending follow-ups ${snapshot.followUps.pending}, overdue ${snapshot.followUps.overdue}. Visits completed in period ${snapshot.visits.completedInPeriod}; past scheduled requiring confirmation ${snapshot.visits.pastScheduled}; upcoming today ${snapshot.visits.upcomingToday}. RM performance ${snapshot.rmPerformance.map(r => `${r.name}: ${r.performance.achievementPercent ?? "unavailable"}% of monthly targets; ${r.attention.length} review items`).join("; ") || "unavailable"}. Sync ${snapshot.data.status}, last completed ${snapshot.data.lastCompletedAt ?? "unavailable"}. Review source records and data coverage in CRM.`;
}

/** Unique occurrence + atomic claim survive overlaps/restarts. Sending/review is never replayed. */
export async function runReportSchedules(db, { now = new Date(), env = process.env, sender = sendWhatsAppTemplate } = {}) {
  if (!whatsappConfigured(env)) return { disabled: true, processed: 0 };
  let processed = 0;
  const schedules = db.prepare("SELECT * FROM report_schedules WHERE enabled=1 AND opted_in=1 AND template_approved=1").all();
  for (const schedule of schedules) {
    try { authorizedScope(db, schedule.recipient_user_id); } catch { continue; }
    if (!schedule.approval_reference) continue;
    const period = scheduledPeriod(schedule, now);
    if (period) db.prepare("INSERT OR IGNORE INTO report_deliveries (id,schedule_id,period_from,period_to,status,updated_at) VALUES (?,?,?,?,'pending',?)").run(randomUUID(), schedule.id, period.from, period.to, now.toISOString());
    const deliveries = db.prepare("SELECT * FROM report_deliveries WHERE schedule_id=? AND (status='pending' OR (status='retry' AND next_attempt_at<=?)) AND attempts<3").all(schedule.id, now.toISOString());
    for (const delivery of deliveries) {
      const claim = db.prepare("UPDATE report_deliveries SET status='sending',attempts=attempts+1,updated_at=? WHERE id=? AND status IN ('pending','retry') AND attempts=?").run(now.toISOString(), delivery.id, delivery.attempts);
      if (!claim.changes) continue;
      let result;
      try {
        // Recompute from current authorization on every attempt, never replay a stored sensitive payload.
        const snapshot = reportSnapshot(db, schedule.recipient_user_id, { from: delivery.period_from, to: delivery.period_to }, now);
        result = await sender(schedule, formatReport(snapshot), { env });
      } catch { result = { status: "review", error: "generation-or-provider-failure" }; }
      const status = result.status === "retry" && delivery.attempts >= 2 ? "failed" : result.status;
      db.prepare("UPDATE report_deliveries SET status=?,provider_message_id=?,error_code=?,next_attempt_at=?,updated_at=? WHERE id=? AND status='sending'").run(status, result.messageId ?? null, result.error ?? null, status === "retry" ? new Date(now.getTime() + 60000 * 2 ** delivery.attempts).toISOString() : null, now.toISOString(), delivery.id);
      if (result.messageId) applyBufferedStatus(db, result.messageId);
      processed++;
    }
  }
  return { processed };
}

export function createReportAutomationRouter(db) {
  const router = Router(); // Mounted inside the existing authenticated admin router.
  router.get("/", (_req, res) => res.json({ deliveryConfigured: whatsappConfigured(), timezone: "Asia/Kolkata", schedules: db.prepare("SELECT id,recipient_user_id,cadence,send_time,template_name,language,approval_reference,opted_in,template_approved,enabled FROM report_schedules").all(), deliveries: db.prepare("SELECT * FROM report_deliveries ORDER BY updated_at DESC LIMIT 100").all() }));
  router.post("/", (req, res, next) => {
    try {
      const b = req.body ?? {};
      authorizedScope(db, b.recipientUserId);
      if (!/^\+[1-9][0-9]{7,14}$/.test(b.phone ?? "") || !["daily", "monthly"].includes(b.cadence) || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(b.sendTime ?? "") || !/^[a-z0-9_]{1,100}$/.test(b.templateName ?? "") || !/^[a-z]{2}(?:_[A-Z]{2})?$/.test(b.language ?? "") || typeof b.approvalReference !== "string" || !b.approvalReference.trim() || b.approvalReference.length > 200) return res.status(400).json({ error: "Provide valid recipient, schedule, template and business approval reference" });
      const id = randomUUID();
      db.prepare("INSERT INTO report_schedules (id,recipient_user_id,phone,cadence,send_time,template_name,language,approval_reference,opted_in,template_approved,enabled,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?)").run(id, b.recipientUserId, b.phone, b.cadence, b.sendTime, b.templateName, b.language, b.approvalReference.trim(), b.optedIn === true ? 1 : 0, b.templateApproved === true ? 1 : 0, req.user.id, new Date().toISOString());
      res.status(201).json({ id, enabled: false });
    } catch (error) { if (String(error.code).includes("CONSTRAINT") || error.errcode === 2067) return res.status(409).json({ error: "A schedule already exists for this user and cadence" }); next(error); }
  });
  router.patch("/:id", (req, res) => {
    const s = db.prepare("SELECT * FROM report_schedules WHERE id=?").get(req.params.id);
    if (!s) return res.status(404).json({ error: "Schedule not found" });
    const enable = req.body?.enabled === true;
    if (req.body?.optedIn === false) {
      db.prepare("UPDATE report_schedules SET opted_in=0,enabled=0 WHERE id=?").run(s.id);
      return res.json({ id: s.id, enabled: false, optedIn: false });
    }
    if (enable && (!s.opted_in || !s.template_approved || !s.approval_reference || !whatsappConfigured())) return res.status(409).json({ error: "Approved opt-in, template and deployment configuration required" });
    db.prepare("UPDATE report_schedules SET enabled=? WHERE id=?").run(enable ? 1 : 0, s.id);
    res.json({ id: s.id, enabled: enable });
  });
  return router;
}

/** Signed status callbacks distinguish API acceptance from actual delivery. */
export function createWhatsAppWebhook(db, env = process.env) {
  const router = Router();
  router.get("/", (req, res) => {
    if (!env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || req.query["hub.mode"] !== "subscribe" || req.query["hub.verify_token"] !== env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) return res.sendStatus(403);
    res.type("text/plain").send(String(req.query["hub.challenge"] ?? ""));
  });
  router.post("/", raw({ type: "application/json", limit: "256kb" }), (req, res) => {
    if (!env.WHATSAPP_APP_SECRET || !Buffer.isBuffer(req.body)) return res.sendStatus(403);
    const signature = Buffer.from(req.get("x-hub-signature-256") ?? "");
    const expected = Buffer.from(`sha256=${createHmac("sha256", env.WHATSAPP_APP_SECRET).update(req.body).digest("hex")}`);
    if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return res.sendStatus(403);
    let body; try { body = JSON.parse(req.body.toString()); } catch { return res.sendStatus(400); }
    if (!Array.isArray(body.entry)) return res.sendStatus(400);
    for (const entry of body.entry) for (const change of Array.isArray(entry.changes) ? entry.changes : []) for (const s of Array.isArray(change.value?.statuses) ? change.value.statuses : []) {
      if (!["sent", "delivered", "read", "failed"].includes(s.status)) continue;
      if (typeof s.id !== "string" || s.id.length > 500) continue;
      const next = s.status === "sent" ? "accepted" : s.status;
      const old = db.prepare("SELECT status FROM report_status_events WHERE provider_message_id=?").get(s.id);
      if (!old || statusRanks[next] > statusRanks[old.status]) db.prepare("INSERT INTO report_status_events (provider_message_id,status,updated_at) VALUES (?,?,?) ON CONFLICT(provider_message_id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at WHERE (CASE excluded.status WHEN 'read' THEN 4 WHEN 'delivered' THEN 3 WHEN 'failed' THEN 2 ELSE 1 END) > (CASE report_status_events.status WHEN 'read' THEN 4 WHEN 'delivered' THEN 3 WHEN 'failed' THEN 2 ELSE 1 END)").run(s.id, next, new Date().toISOString());
      applyBufferedStatus(db, s.id);
    }
    res.sendStatus(200);
  });
  return router;
}
