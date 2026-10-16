import cors from "cors";
import compression from "compression";
import express from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { adminRouter } from "./admin.mjs";
import { authenticate, createSession, seedAdmin, verifyPassword } from "./auth.mjs";
import { db, transaction } from "./db.mjs";
import { tally } from "./tally/connector.mjs";
import { salesRouter } from "./sales-routes.mjs";
import { connectorRouter } from "./connector-api.mjs";
import { rmRouter } from "./rm-routes.mjs";
import { sttRouter } from "./stt.mjs";
import { buildRmDirectory, resolveRmId } from "./rm-directory.mjs";

seedAdmin();
const app = express();
app.use(cors({ origin: true, credentials: true }));
// Compress large JSON responses without changing their data or caching user activity.
app.use(compression({ level: 1, threshold: 1024 }));
app.use(express.json({ limit: "8mb" }));
app.use("/api", connectorRouter);
app.use("/api", sttRouter);
app.use("/api/sales", salesRouter);
app.use("/api/rm", rmRouter);
const today = () => new Date().toISOString().slice(0, 10);

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const visitSchema = z.object({ productId: z.string().min(1), outcome: z.string().min(1), expectedOrderValue: z.number().min(0), expectedOrderDate: z.string().optional(), nextFollowUp: z.string().min(1), nextFollowUpType: z.enum(["call", "visit"]).optional(), nextFollowUpNotes: z.string().optional(), notes: z.string().optional() });

async function buildSalesDay(userId) {
  // Reuse this request's directory across all queries, with no stale cross-request cache.
  const directory = buildRmDirectory();
  const scope = { salespersonId: userId, directory };
  const [customers, products, sales, connector, insights] = await Promise.all([tally.customers(scope), tally.products(), tally.salesSummary(scope), tally.status(), tally.overview(scope)]);
  const customerMap = new Map(customers.map((item) => [item.id, item]));
  const productMap = new Map(products.map((item) => [item.id, item]));
  const profile = db.prepare("SELECT u.id,u.email,p.full_name,p.employee_code,p.operating_city,p.region,p.territory,p.monthly_target FROM users u JOIN salesperson_profiles p ON p.user_id=u.id WHERE u.id=?").get(userId);
  const rm = directory.find((entry) => entry.id === userId || (entry.keys && entry.keys.includes(userId)) || resolveRmId(directory, profile?.full_name || "") === entry.id);
  const allNames = rm ? [rm.name, ...rm.aliases] : [profile?.full_name].filter(Boolean);
  const nameList = allNames.length ? allNames.map(() => "?").join(",") : "";
  const spRow = allNames.length ? db.prepare(`SELECT code, city FROM tally_salespeople WHERE name IN (${nameList}) AND code IS NOT NULL AND code <> '' LIMIT 1`).get(...allNames) : null;
  const rmProfile = rm ? db.prepare("SELECT p.employee_code, p.operating_city FROM salesperson_profiles p JOIN users u ON u.id=p.user_id WHERE u.role='rm' AND (u.id=? OR p.full_name=?)").get(rm.id, rm.name) : null;
  const rmCode = rmProfile?.employee_code || (profile?.employee_code && !profile.employee_code.startsWith("PSSPL-S-") ? profile.employee_code : spRow?.code) || "075709";
  const operatingFrom = rmProfile?.operating_city?.trim() || profile?.operating_city?.trim() || spRow?.city?.trim() || "Gurugram";
  const teamExecutiveCities = ["Gurgaon", "Delhi", "Ghaziabad", "Faridabad", "Noida", "Sonepat", "Bahadurgarh", "Sahibabad", "Rudrapur"];
  const linkedUserIds = [userId, rm?.id, rmProfile ? (db.prepare("SELECT user_id FROM salesperson_profiles WHERE employee_code=?").get(rmProfile.employee_code)?.user_id) : null].filter(Boolean);
  const userPh = linkedUserIds.map(() => "?").join(",");
  const attendance = db.prepare(`SELECT check_in_at,check_out_at FROM attendance WHERE user_id IN (${userPh}) AND business_date=? ORDER BY check_in_at DESC LIMIT 1`).get(...linkedUserIds, today());
  const visitRows = db.prepare("SELECT v.*,vp.tally_product_id, f.due_date as next_follow_up_date FROM visits v LEFT JOIN visit_products vp ON vp.visit_id=v.id LEFT JOIN follow_ups f ON f.visit_id=v.id WHERE v.user_id=? AND v.business_date=? ORDER BY v.scheduled_at").all(userId, today());
  const followRows = db.prepare("SELECT * FROM follow_ups WHERE user_id=? ORDER BY completed,due_date").all(userId);
  const expected = db.prepare("SELECT COALESCE(SUM(expected_value),0) total,COUNT(*) count FROM expected_orders WHERE user_id=? AND status='open'").get(userId);
  return {
    salesperson: { id: profile.id, email: profile.email, name: profile.full_name, rmCode, operatingFrom, teamExecutiveCities, region: profile.region || "North Region", territory: profile.territory, checkedInAt: attendance ? new Date(attendance.check_in_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : null, checkedOutAt: attendance?.check_out_at ? new Date(attendance.check_out_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : null, trackingActive: Boolean(attendance?.check_in_at && !attendance?.check_out_at) },
    visits: visitRows.map((row) => ({ id: row.id, customerId: row.tally_customer_id, customer: customerMap.get(row.tally_customer_id)?.name ?? row.tally_customer_id, location: customerMap.get(row.tally_customer_id)?.city ?? "", scheduledAt: row.scheduled_at, dateLabel: new Date(row.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), time: new Date(row.scheduled_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }), productId: row.tally_product_id, product: productMap.get(row.tally_product_id)?.name ?? "Product", purpose: row.purpose, priority: row.priority || "medium", status: row.status, nextFollowUpDate: row.next_follow_up_date })),
    followUps: followRows.map((row) => ({ id: row.id, title: row.title, customer: customerMap.get(row.tally_customer_id)?.name ?? row.tally_customer_id, dueLabel: row.priority === "overdue" ? "Overdue" : "Due", dueDate: row.due_date, priority: row.priority, completed: Boolean(row.completed), followUpType: row.follow_up_type || "call", notes: row.notes || "" })),
    performance: {
      actual: sales.actual,
      target: sales.target || profile.monthly_target,
      actualRupees: sales.actualRupees,
      targetRupees: sales.targetRupees,
      achievement: sales.achievement,
      periodLabel: sales.periodLabel,
      currencyLabel: sales.currencyLabel
    },
    summary: { expectedOrderValue: expected.total, expectedOrderCount: expected.count, followUpsCreated: followRows.length, productsDiscussed: new Set(visitRows.map((row) => row.tally_product_id).filter(Boolean)).size },
    tally: connector,
    referenceData: { customers, products }, insights
  };
}

app.use("/api/admin", adminRouter);
app.get("/api/health", async (_req, res) => res.json({ status: "ok", database: "sqlite", tally: await tally.status() }));
app.post("/api/auth/login", async (req, res) => { const parsed = loginSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: "Enter a valid email and password" }); const user = db.prepare("SELECT * FROM users WHERE email=? AND active=1").get(parsed.data.email.toLowerCase()); if (!user || !(await verifyPassword(parsed.data.password, user.password_hash))) return res.status(401).json({ error: "Incorrect email or password" }); const session = createSession(user.id); return res.json({ ...session, user: { id: user.id, email: user.email, role: user.role } }); });
app.get("/api/auth/me", authenticate, (req, res) => res.json({ user: req.user }));
app.post("/api/auth/logout", authenticate, (req, res) => { db.prepare("DELETE FROM sessions WHERE token_hash=?").run(req.sessionTokenHash); res.json({ ok: true }); });
app.get("/api/tally/status", authenticate, async (_req, res) => res.json(await tally.status()));
app.get("/api/tally/customers", authenticate, async (req, res) => res.json(await tally.customers(req.user.role === "admin" ? {} : { salespersonId: req.user.id })));
app.get("/api/tally/products", authenticate, async (_req, res) => res.json(await tally.products()));
app.get("/api/reports/overview", authenticate, async (req, res) => res.json(await tally.overview({ salespersonId: req.user.id })));
app.get("/api/salespeople/me/my-day", authenticate, async (req, res, next) => { try { res.json(await buildSalesDay(req.user.id)); } catch (error) { next(error); } });
app.post("/api/salespeople/me/check-in", authenticate, async (req, res, next) => { try { const existing = db.prepare("SELECT id FROM attendance WHERE user_id=? AND business_date=?").get(req.user.id, today()); if (!existing) db.prepare("INSERT INTO attendance (id,user_id,business_date,check_in_at,latitude,longitude) VALUES (?,?,?,?,?,?)").run(randomUUID(), req.user.id, today(), new Date().toISOString(), req.body?.latitude ?? null, req.body?.longitude ?? null); res.json(await buildSalesDay(req.user.id)); } catch (error) { next(error); } });
app.post("/api/visits/:id/start", authenticate, async (req, res, next) => { try { db.prepare("UPDATE visits SET status='in_progress',started_at=? WHERE id=? AND user_id=?").run(new Date().toISOString(), req.params.id, req.user.id); res.json(await buildSalesDay(req.user.id)); } catch (error) { next(error); } });
app.post("/api/visits/:id/complete", authenticate, async (req, res, next) => { try { const parsed = visitSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: "Complete the required visit fields" }); const visit = db.prepare("SELECT * FROM visits WHERE id=? AND user_id=?").get(req.params.id, req.user.id); if (!visit) return res.status(404).json({ error: "Visit not found" }); transaction(() => { db.prepare("UPDATE visits SET status='completed',completed_at=?,outcome=?,notes=? WHERE id=?").run(new Date().toISOString(), parsed.data.outcome, parsed.data.notes ?? null, visit.id); db.prepare("DELETE FROM visit_products WHERE visit_id=?").run(visit.id); db.prepare("INSERT INTO visit_products (visit_id,tally_product_id) VALUES (?,?)").run(visit.id, parsed.data.productId); if (parsed.data.expectedOrderValue > 0) db.prepare("INSERT INTO expected_orders (id,visit_id,user_id,tally_customer_id,tally_product_id,expected_value,expected_date) VALUES (?,?,?,?,?,?,?)").run(randomUUID(), visit.id, req.user.id, visit.tally_customer_id, parsed.data.productId, parsed.data.expectedOrderValue, parsed.data.expectedOrderDate || null); db.prepare("INSERT INTO follow_ups (id,user_id,visit_id,tally_customer_id,title,due_date,priority,follow_up_type,notes) VALUES (?,?,?,?,?,?,?,?,?)").run(randomUUID(), req.user.id, visit.id, visit.tally_customer_id, `Follow up: ${parsed.data.outcome}`, parsed.data.nextFollowUp, "today", parsed.data.nextFollowUpType || "call", parsed.data.nextFollowUpNotes || parsed.data.notes || null); }); res.json(await buildSalesDay(req.user.id)); } catch (error) { next(error); } });
app.delete("/api/visits/:id", authenticate, async (req, res, next) => { try { db.prepare("DELETE FROM visits WHERE id=? AND user_id=? ").run(req.params.id, req.user.id); res.json(await buildSalesDay(req.user.id)); } catch (error) { next(error); } });
app.patch("/api/visits/:id", authenticate, async (req, res, next) => { try { const { purpose, priority, scheduledAt } = req.body ?? {}; db.prepare("UPDATE visits SET purpose=COALESCE(?,purpose), priority=COALESCE(?,priority), scheduled_at=COALESCE(?,scheduled_at) WHERE id=? AND user_id=? ").run(purpose, priority, scheduledAt, req.params.id, req.user.id); res.json(await buildSalesDay(req.user.id)); } catch (error) { next(error); } });
app.delete("/api/follow-ups/:id", authenticate, async (req, res, next) => { try { db.prepare("DELETE FROM follow_ups WHERE id=? AND user_id=?").run(req.params.id, req.user.id); res.json(await buildSalesDay(req.user.id)); } catch (error) { next(error); } });
  app.patch("/api/follow-ups/:id/toggle", authenticate, async (req, res, next) => { try { db.prepare("UPDATE follow_ups SET completed=CASE completed WHEN 1 THEN 0 ELSE 1 END WHERE id=?").run(req.params.id); res.json(await buildSalesDay(req.user.id)); } catch (error) { next(error); } });
app.patch("/api/follow-ups/:id", authenticate, async (req, res, next) => { try { const { notes, followUpType, completed, priority, dueDate } = req.body ?? {}; if (notes !== undefined) db.prepare("UPDATE follow_ups SET notes=? WHERE id=?").run(notes, req.params.id); if (followUpType !== undefined) db.prepare("UPDATE follow_ups SET follow_up_type=? WHERE id=?").run(followUpType, req.params.id); if (completed !== undefined) db.prepare("UPDATE follow_ups SET completed=? WHERE id=?").run(completed ? 1 : 0, req.params.id); if (priority !== undefined) db.prepare("UPDATE follow_ups SET priority=? WHERE id=?").run(priority, req.params.id); if (dueDate !== undefined) db.prepare("UPDATE follow_ups SET due_date=? WHERE id=?").run(dueDate, req.params.id); res.json(await buildSalesDay(req.user.id)); } catch (error) { next(error); } });
app.post("/api/follow-ups", authenticate, async (req, res, next) => { try { const { customerId, title, dueDate, priority, followUpType, notes } = req.body ?? {}; if (!customerId || !title || !dueDate) return res.status(400).json({ error: "Customer, title, and due date are required" }); db.prepare("INSERT INTO follow_ups (id,user_id,tally_customer_id,title,due_date,priority,follow_up_type,notes) VALUES (?,?,?,?,?,?,?,?)").run(randomUUID(), req.user.id, customerId, title, dueDate, priority || "today", followUpType || "call", notes || null); res.json(await buildSalesDay(req.user.id)); } catch (error) { next(error); } });
import cron from "node-cron";
import { sendEodSummary } from "./whatsapp.mjs";

app.use((error, _req, res, _next) => {
  if (error.status === 503) return res.status(503).json({ error: error.message });
  console.error(error);
  res.status(500).json({ error: "Something went wrong" });
});
const port = Number(process.env.PORT) || Number(process.env.CRM_API_PORT) || 4000;
const host = process.env.HOST || "0.0.0.0";

cron.schedule("0 17 * * *", () => {
  console.log("[Cron] Running EOD summary generation...");
  sendEodSummary(db).then((r) => console.log("[Cron] EOD WhatsApp result:", r)).catch((e) => console.error("[Cron] EOD Error:", e));
});

app.listen(port, host, () => console.log(`PSSPL API running at http://${host}:${port}`));
