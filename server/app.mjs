import cors from "cors";
import compression from "compression";
import express from "express";
import { randomBytes, randomUUID } from "node:crypto";
import { Resend } from "resend";
import { z } from "zod";
import { adminRouter } from "./admin.mjs";
import { authenticate, createSession, passwordHash, revokeAccountAccess, seedAdmin, sessionCookieName, verifyPassword } from "./auth.mjs";
import { db, transaction } from "./db.mjs";
import { tally } from "./tally/connector.mjs";
import { salesRouter } from "./sales-routes.mjs";
import { createFollowUpRouter } from "./follow-up-routes.mjs";
import { connectorRouter } from "./connector-api.mjs";
import { rmRouter } from "./rm-routes.mjs";
import { sttRouter } from "./stt.mjs";
import { buildRmDirectory, resolveRmId } from "./rm-directory.mjs";
import { createRateLimiter } from "./rate-limit.mjs";
import { consumeAccountToken, queueAccountToken } from "./auth-tokens.mjs";
import { kickAuthEmailQueue } from "./auth-email-queue.mjs";
import { recordResendEmailEvent } from "./resend-webhook.mjs";
import { dailyFieldActivity, indiaBusinessDate, isDateOnly, recordDailyCheckIn, validateLocation } from "./field-activity.mjs";
import { completeVisitWithLead } from "./visit-lead.mjs";
import { seedWebinarDemo } from "./webinar-demo.mjs";

seedAdmin();
if (process.env.CRM_ENABLE_WEBINAR_DEMO_DATA === "true") seedWebinarDemo(db);
const app = express();
const configuredOrigins = (process.env.CRM_ALLOWED_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean);
const allowedOrigins = configuredOrigins.length ? configuredOrigins : (process.env.NODE_ENV === "production" ? [] : ["http://localhost:3000", "http://127.0.0.1:3000"]);
app.use(cors({ origin(origin, callback) { callback(null, !origin || allowedOrigins.includes(origin)); }, credentials: true }));
// Compress large JSON responses without changing their data or caching user activity.
app.use(compression({ level: 1, threshold: 1024 }));
app.use("/api/whatsapp/webhook", createWhatsAppWebhook(db));
app.post("/api/webhooks/resend", express.raw({ type: "application/json", limit: "256kb" }), (req, res) => {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(503).json({ error: "Email status webhook is not configured" });
  const headers = {
    id: req.get("svix-id"),
    timestamp: req.get("svix-timestamp"),
    signature: req.get("svix-signature"),
  };
  if (!Buffer.isBuffer(req.body) || Object.values(headers).some((value) => !value)) return res.status(400).json({ error: "Invalid webhook request" });
  try {
    const event = new Resend().webhooks.verify({ payload: req.body.toString("utf8"), headers, webhookSecret });
    recordResendEmailEvent(db, event);
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(400).json({ error: "Invalid webhook signature or payload" });
  }
});
app.use(express.json({ limit: "8mb" }));
app.use("/api", (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
app.use("/api", connectorRouter);
app.use("/api", sttRouter);
app.use("/api/sales", salesRouter);
app.use("/api/rm", rmRouter);
const today = () => indiaBusinessDate();

// Keep the email field for older clients while accepting the new Login ID field.
const loginSchema = z.object({ email: z.string().trim().min(1).max(254).optional(), loginId: z.string().trim().min(1).max(254).optional(), password: z.string().min(1).max(200) }).refine((value) => value.loginId || value.email);
const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
const resetRequestLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });
const resetCompletionLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });
const activationLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });
const passwordChangeLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5, key: (req) => req.user.id });
const visitSchema = z.object({ productId: z.string().min(1), outcome: z.string().trim().min(1).max(500), expectedOrderValue: z.number().finite().min(0), expectedOrderDate: z.string().optional(), nextFollowUp: z.string().min(1), nextFollowUpType: z.enum(["call", "visit"]).optional(), nextFollowUpNotes: z.string().max(4000).optional(), visitTags: z.array(z.enum(["sample_required", "quotation_required", "technical_support", "complaint"])).max(4).optional(), notes: z.string().max(4000).optional() });

async function buildSalesDay(userId, { workspace = false } = {}) {
  // Reuse this request's directory across all queries, with no stale cross-request cache.
  const directory = workspace ? [] : buildRmDirectory();
  const scope = { salespersonId: userId, directory };
  const [customers, products, sales, connector, insights] = await Promise.all([tally.customers(scope), workspace ? db.prepare("SELECT id,name FROM tally_products ORDER BY total_value DESC").all() : tally.products(), tally.salesSummary({ ...scope, includeRepeat: !workspace }), tally.status(), workspace ? undefined : tally.overview(scope)]);
  const customerMap = new Map(customers.map((item) => [item.id, item]));
  const productMap = new Map(products.map((item) => [item.id, item]));
  const profile = db.prepare("SELECT u.id,u.email,u.role,p.full_name,p.employee_code,p.region,p.territory,manager.full_name manager_name FROM users u JOIN salesperson_profiles p ON p.user_id=u.id LEFT JOIN salesperson_profiles manager ON manager.user_id=p.manager_user_id WHERE u.id=? AND u.role IN ('salesperson','rm')").get(userId);
  const attendance = db.prepare("SELECT check_in_at,check_out_at,latitude,longitude FROM attendance WHERE user_id=? AND business_date=?").get(userId, today());
  const visitRows = db.prepare("SELECT v.*,vp.tally_product_id, f.due_date as next_follow_up_date FROM visits v LEFT JOIN visit_products vp ON vp.visit_id=v.id LEFT JOIN follow_ups f ON f.visit_id=v.id WHERE v.user_id=? AND v.business_date=? ORDER BY v.scheduled_at").all(userId, today());
  const followRows = db.prepare("SELECT * FROM follow_ups WHERE user_id=? ORDER BY completed,due_date").all(userId);
  const fieldActivity = dailyFieldActivity(db, userId, today());
  const attendanceHistory = db.prepare(`SELECT a.business_date businessDate,a.check_in_at checkInAt,a.check_out_at checkOutAt,a.latitude,a.longitude,(SELECT lp.accuracy FROM location_pings lp WHERE lp.user_id=a.user_id AND date(lp.captured_at,'+5 hours','+30 minutes')=a.business_date ORDER BY lp.captured_at LIMIT 1) gpsAccuracyMeters FROM attendance a WHERE a.user_id=? ORDER BY a.business_date DESC`).all(userId);
  const expected = db.prepare("SELECT COALESCE(SUM(expected_value),0) total,COUNT(*) count FROM expected_orders WHERE user_id=? AND status='open'").get(userId);
  return {
    salesperson: { id: profile.id, email: profile.email, role: profile.role, name: profile.full_name, employeeCode: profile.employee_code, managerName: profile.manager_name, region: profile.region, territory: profile.territory, checkedInAt: attendance ? new Date(attendance.check_in_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : null, checkedOutAt: attendance?.check_out_at ? new Date(attendance.check_out_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : null, trackingActive: Boolean(attendance?.check_in_at && !attendance?.check_out_at) },
    visits: visitRows.map((row) => ({ id: row.id, customerId: row.tally_customer_id, customer: customerMap.get(row.tally_customer_id)?.name ?? row.tally_customer_id, location: customerMap.get(row.tally_customer_id)?.city ?? "", scheduledAt: row.scheduled_at, dateLabel: new Date(row.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }), time: new Date(row.scheduled_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }), productId: row.tally_product_id, product: productMap.get(row.tally_product_id)?.name ?? "Product", purpose: row.purpose, notes: row.notes || "", priority: row.priority || "medium", status: row.status, nextFollowUpDate: row.next_follow_up_date, voiceNoteAvailable: Boolean(row.voice_note_path) })),
    followUps: followRows.map((row) => ({ id: row.id, title: row.title, customer: customerMap.get(row.tally_customer_id)?.name ?? row.tally_customer_id, dueLabel: row.priority === "overdue" ? "Overdue" : "Due", dueDate: row.due_date, priority: row.priority, completed: Boolean(row.completed), followUpType: row.follow_up_type || "call", notes: row.notes || "" })),
    performance: {
      actual: sales.actual,
      target: sales.target,
      actualRupees: sales.actualRupees,
      targetRupees: sales.targetRupees,
      achievement: sales.achievement,
      periodLabel: sales.periodLabel,
      currencyLabel: sales.currencyLabel
    },
    summary: { expectedOrderValue: expected.total, expectedOrderCount: expected.count, followUpsCreated: followRows.length, productsDiscussed: new Set(visitRows.map((row) => row.tally_product_id).filter(Boolean)).size, ...fieldActivity.summary },
    calls: fieldActivity.calls,
    attendanceHistory,
    tally: connector,
    referenceData: { customers, products }, insights
  };
}

app.use("/api/follow-ups", createFollowUpRouter({ buildSalesDay }));

app.use("/api/admin", adminRouter);
app.get("/api/health", async (_req, res) => res.json({ status: "ok", database: "sqlite", tally: await tally.status() }));
app.post("/api/auth/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter a Login ID or email and password" });
  const identifier = (parsed.data.loginId || parsed.data.email).toLowerCase();
  const user = db.prepare("SELECT id,email,login_id,role,password_hash FROM users WHERE active=1 AND (email=? COLLATE NOCASE OR login_id=? COLLATE NOCASE)").get(identifier, identifier);
  if (!user || !(await verifyPassword(parsed.data.password, user.password_hash))) return res.status(401).json({ error: "Incorrect Login ID, email or password" });
  // Verification yields to other requests. Reject a password/account changed meanwhile.
  const session = transaction(() => {
    const current = db.prepare("SELECT role FROM users WHERE id=? AND active=1 AND password_hash=?").get(user.id, user.password_hash);
    if (!current) return null;
    user.role = current.role;
    return createSession(user.id);
  });
  if (!session) return res.status(401).json({ error: "Incorrect Login ID, email or password" });
  const publicUser = { id: user.id, email: user.email, loginId: user.login_id, role: user.role };
  res.setHeader("Cache-Control", "no-store");
  if (process.env.CRM_SESSION_COOKIE_ENABLED === "true") {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    const csrf = randomBytes(24).toString("base64url");
    res.setHeader("Set-Cookie", [`${sessionCookieName}=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`, `psspl_csrf=${csrf}; Path=/; SameSite=Strict; Max-Age=2592000${secure}`]);
    return res.json({ expiresAt: session.expiresAt, user: publicUser });
  }
  return res.json({ ...session, user: publicUser });
});
app.get("/api/auth/me", authenticate, (req, res) => { res.setHeader("Cache-Control", "no-store"); res.json({ user: req.user }); });
app.post("/api/auth/logout", authenticate, (req, res) => { db.prepare("DELETE FROM sessions WHERE token_hash=?").run(req.sessionTokenHash); const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""; res.setHeader("Set-Cookie", [`${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`, `psspl_csrf=; Path=/; SameSite=Strict; Max-Age=0${secure}`]); res.setHeader("Cache-Control", "no-store"); res.json({ ok: true }); });
app.post("/api/auth/password", authenticate, passwordChangeLimiter, async (req, res) => {
  const parsed = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(12).max(200), confirmPassword: z.string().min(12).max(200) })
    .refine((value) => value.newPassword === value.confirmPassword).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter your current password and matching new passwords of 12 to 200 characters" });
  const user = db.prepare("SELECT password_hash FROM users WHERE id=? AND active=1").get(req.user.id);
  if (!user || !(await verifyPassword(parsed.data.currentPassword, user.password_hash))) return res.status(400).json({ error: "Current password is incorrect" });
  const newHash = passwordHash(parsed.data.newPassword);
  const changed = transaction(() => {
    const updated = db.prepare("UPDATE users SET password_hash=? WHERE id=? AND active=1 AND password_hash=? AND EXISTS(SELECT 1 FROM sessions WHERE token_hash=? AND user_id=users.id AND expires_at>?)")
      .run(newHash, req.user.id, user.password_hash, req.sessionTokenHash, new Date().toISOString());
    if (!updated.changes) return false;
    revokeAccountAccess(req.user.id);
    return true;
  });
  if (!changed) return res.status(401).json({ error: "Your account changed. Please sign in again" });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", [`${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`, `psspl_csrf=; Path=/; SameSite=Strict; Max-Age=0${secure}`]);
  res.json({ ok: true });
});
app.post("/api/auth/password-reset", resetRequestLimiter, async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (email.length <= 254) {
    const user = db.prepare("SELECT id,email FROM users WHERE email=? AND active=1").get(email);
    // Do not make the public response depend on Resend latency for known accounts.
    if (user) {
      try {
        const queued = queueAccountToken(user, "reset");
        if (queued.queueId) void kickAuthEmailQueue().catch(() => {});
      } catch { /* keep response indistinguishable for known and unknown users */ }
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 150));
  res.status(202).json({ ok: true, message: "If the account can be recovered, instructions will be sent to its work email." });
});
app.post("/api/auth/password-reset/complete", resetCompletionLimiter, (req, res) => {
  const parsed = z.object({ token: z.string().min(32).max(128), password: z.string().min(12).max(200) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Use a valid reset link and a password of at least 12 characters" });
  const newHash = passwordHash(parsed.data.password);
  const completed = transaction(() => {
    const record = consumeAccountToken(parsed.data.token, "reset");
    if (!record) return false;
    const updated = db.prepare("UPDATE users SET password_hash=? WHERE id=? AND active=1").run(newHash, record.userId);
    if (!updated.changes) return false;
    revokeAccountAccess(record.userId);
    return true;
  });
  if (!completed) return res.status(400).json({ error: "This reset link is invalid or expired" });
  res.json({ ok: true });
});
app.post("/api/auth/activate", activationLimiter, (req, res) => {
  const parsed = z.object({ token: z.string().min(32).max(128), password: z.string().min(12).max(200) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Use a valid invitation and a password of at least 12 characters" });
  const newHash = passwordHash(parsed.data.password);
  const completed = transaction(() => {
    const record = consumeAccountToken(parsed.data.token, "activate");
    if (!record) return false;
    const updated = db.prepare("UPDATE users SET password_hash=?,active=1 WHERE id=? AND active=0").run(newHash, record.userId);
    if (!updated.changes) return false;
    revokeAccountAccess(record.userId);
    return true;
  });
  if (!completed) return res.status(400).json({ error: "This invitation is invalid or expired" });
  res.json({ ok: true });
});
app.get("/api/tally/status", authenticate, async (_req, res) => res.json(await tally.status()));
app.get("/api/tally/customers", authenticate, async (req, res) => res.json(await tally.customers(req.user.role === "admin" ? {} : { salespersonId: req.user.id })));
app.get("/api/tally/products", authenticate, async (_req, res) => res.json(await tally.products()));
app.get("/api/reports/overview", authenticate, async (req, res) => res.json(await tally.overview({ salespersonId: req.user.id })));
app.get("/api/salespeople/me/my-day", authenticate, async (req, res, next) => { try { res.json(await buildSalesDay(req.user.id, { workspace: req.query.view === "workspace" })); } catch (error) { next(error); } });
app.post("/api/salespeople/me/check-in", authenticate, async (req, res, next) => { try { const checkIn = recordDailyCheckIn(db, transaction, req.user.id, today(), req.body); if (!checkIn.ok) return res.status(checkIn.status).json({ error: checkIn.error }); res.json(await buildSalesDay(req.user.id)); } catch (error) { next(error); } });
app.post("/api/visits/:id/start", authenticate, async (req, res, next) => { try { const location = req.body?.latitude === undefined && req.body?.longitude === undefined ? null : validateLocation(req.body); if (location && !location.ok) return res.status(400).json({ error: location.error }); const result = db.prepare("UPDATE visits SET status='in_progress',started_at=?,latitude=COALESCE(?,latitude),longitude=COALESCE(?,longitude) WHERE id=? AND user_id=? AND status='planned'").run(new Date().toISOString(), location?.latitude ?? null, location?.longitude ?? null, req.params.id, req.user.id); if (!result.changes) return res.status(409).json({ error: "Visit is unavailable or has already started" }); if (location) db.prepare("INSERT INTO location_pings (id,user_id,latitude,longitude,accuracy) VALUES (?,?,?,?,?)").run(randomUUID(), req.user.id, location.latitude, location.longitude, location.accuracy); res.json(await buildSalesDay(req.user.id)); } catch (error) { next(error); } });
app.post("/api/visits/:id/complete", authenticate, async (req, res, next) => {
  try {
    const parsed = visitSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Complete the required visit fields" });
    const visit = db.prepare("SELECT * FROM visits WHERE id=? AND user_id=? AND status='in_progress'").get(req.params.id, req.user.id);
    if (!visit) return res.status(409).json({ error: "Start this visit before completing it" });
    if (!isDateOnly(parsed.data.nextFollowUp) || (parsed.data.expectedOrderDate && !isDateOnly(parsed.data.expectedOrderDate)))
      return res.status(400).json({ error: "Visit dates must use valid YYYY-MM-DD dates" });
    if (!db.prepare("SELECT 1 FROM tally_products WHERE id=?").get(parsed.data.productId))
      return res.status(400).json({ error: "Select a product from the current product list" });
    completeVisitWithLead(db, transaction, visit, parsed.data);
    res.json(await buildSalesDay(req.user.id));
  } catch (error) { next(error); }
});
app.delete("/api/visits/:id", authenticate, async (req, res, next) => {
  try {
    const visit = db.prepare("SELECT id,status FROM visits WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
    if (!visit) return res.status(404).json({ error: "Visit not found" });
    transaction(() => {
      // Orders and product links cascade from visits. Visit-generated follow-ups
      // are removed explicitly so deleting a completed visit clears its action.
      const followUps = db.prepare("DELETE FROM follow_ups WHERE visit_id=? AND user_id=?").run(visit.id, req.user.id).changes;
      db.prepare("DELETE FROM visits WHERE id=? AND user_id=?").run(visit.id, req.user.id);
      db.prepare("INSERT INTO audit_logs (id,user_id,user_email,action,path,entity_id,status_code,details_json,ip_address,user_agent) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .run(randomUUID(), req.user.id, req.user.email, "DELETE visit", req.originalUrl, visit.id, 200,
          JSON.stringify({ status: visit.status, linkedFollowUpsDeleted: followUps }), req.ip ?? null,
          String(req.headers["user-agent"] ?? "").slice(0, 500));
    });
    res.json(await buildSalesDay(req.user.id));
  } catch (error) { next(error); }
});
app.patch("/api/visits/:id", authenticate, async (req, res, next) => { try { const { purpose, priority, scheduledAt } = req.body ?? {}; if (purpose !== undefined && (typeof purpose !== "string" || !purpose.trim() || purpose.length > 200)) return res.status(400).json({ error: "Visit purpose is required and must be 200 characters or fewer" }); if (priority !== undefined && !["high", "medium", "low"].includes(priority)) return res.status(400).json({ error: "Invalid visit priority" }); if (scheduledAt !== undefined && (typeof scheduledAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(scheduledAt) || !isDateOnly(scheduledAt.slice(0, 10)) || !Number.isFinite(Date.parse(scheduledAt)))) return res.status(400).json({ error: "Visit schedule is invalid" }); const result = db.prepare("UPDATE visits SET purpose=COALESCE(?,purpose), priority=COALESCE(?,priority), scheduled_at=COALESCE(?,scheduled_at),business_date=COALESCE(?,business_date) WHERE id=? AND user_id=? AND status='planned'").run(purpose?.trim() ?? null, priority ?? null, scheduledAt ?? null, scheduledAt?.slice(0, 10) ?? null, req.params.id, req.user.id); if (!result.changes) return res.status(409).json({ error: "Only a planned visit can be updated" }); res.json(await buildSalesDay(req.user.id)); } catch (error) { next(error); } });
import cron from "node-cron";
import { runReportSchedules, createWhatsAppWebhook } from "./report-automation.mjs";

app.use((error, _req, res, _next) => {
  if (error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "Uploaded file exceeds the 25 MB limit." });
  if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) return res.status(error.status).json({ error: error.message });
  if (error.status === 503) return res.status(503).json({ error: error.message });
  console.error(error);
  res.status(500).json({ error: "Something went wrong" });
});
const port = Number(process.env.PORT) || Number(process.env.CRM_API_PORT) || 4000;
const host = process.env.HOST || "0.0.0.0";

const reportTick = () => runReportSchedules(db).catch(() => console.error("[Reports] Scheduler failed; review delivery records"));
// Local development must never deliver scheduled customer communications by
// accident. Enable explicitly for an authorized sandbox; production retains
// its established scheduler behavior.
if (process.env.NODE_ENV === "production" || process.env.CRM_ENABLE_REPORT_SCHEDULER === "true") {
  cron.schedule("* * * * *", reportTick, { timezone: "Asia/Kolkata", noOverlap: true });
  void reportTick();
} else {
  console.info("[Reports] Scheduler disabled in development; set CRM_ENABLE_REPORT_SCHEDULER=true for an authorized sandbox.");
}

app.listen(port, host, () => console.log(`PSSPL API running at http://${host}:${port}`));
// Recover queued work after restarts and retry transient provider failures.
void kickAuthEmailQueue().catch(() => {});
setInterval(() => { void kickAuthEmailQueue().catch(() => {}); }, 15_000).unref();
