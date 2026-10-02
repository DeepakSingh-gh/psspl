import { Router } from "express";
import { authenticate, requireRole } from "./auth.mjs";
import { db } from "./db.mjs";

export const rmRouter = Router();
rmRouter.use(authenticate, requireRole("rm"));

const today = () => new Date().toISOString().slice(0, 10);
const financialYearStart = () => { const now = new Date(); const year = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1; return `${year}-04-01`; };

/** Returns [rmUserId, ...salesperson IDs that report to this RM] */
function getTeamIds(rmUserId) {
  const reports = db.prepare("SELECT user_id FROM salesperson_profiles WHERE manager_user_id=?").all(rmUserId).map((r) => r.user_id);
  return [rmUserId, ...reports];
}

rmRouter.get("/dashboard", (req, res, next) => {
  try {
    const from = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.from ?? "")) ? String(req.query.from) : financialYearStart();
    const to = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to ?? "")) ? String(req.query.to) : today();
    if (from > to) return res.status(400).json({ error: "From date must be before the to date" });
    const manager = db.prepare("SELECT u.id,u.email,p.full_name fullName,p.region,p.territory FROM users u JOIN salesperson_profiles p ON p.user_id=u.id WHERE u.id=?").get(req.user.id);
    const users = db.prepare(`SELECT u.id,u.email,u.active,p.full_name fullName,p.region,p.territory,p.monthly_target monthlyTarget,
        CASE WHEN u.id=? THEN 1 ELSE 0 END isSelf
      FROM users u JOIN salesperson_profiles p ON p.user_id=u.id
      WHERE (p.manager_user_id=? AND u.role='salesperson') OR u.id=?
      ORDER BY isSelf DESC, p.full_name`).all(req.user.id, req.user.id, req.user.id);
    const members = users.map((user) => {
      const sales = db.prepare(`SELECT COALESCE(SUM(i.amount),0) total,COUNT(*) invoices FROM tally_invoices i JOIN tally_customers c ON c.id=i.customer_id WHERE i.ingest_session_id IS NULL AND c.owner_user_id=? AND i.invoice_date BETWEEN ? AND ?`).get(user.id, from, to);
      const customers = db.prepare("SELECT COUNT(*) count,COALESCE(SUM(outstanding),0) outstanding FROM tally_customers WHERE owner_user_id=?").get(user.id);
      const visits = db.prepare("SELECT COUNT(*) total,COALESCE(SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END),0) completed FROM visits WHERE user_id=? AND business_date BETWEEN ? AND ?").get(user.id, from, to);
      const followUpsOpen = db.prepare("SELECT COUNT(*) count FROM follow_ups WHERE user_id=? AND completed=0").get(user.id).count;
      const attendance = db.prepare("SELECT check_in_at checkInAt,check_out_at checkOutAt FROM attendance WHERE user_id=? AND business_date=?").get(user.id, today()) ?? null;
      return { ...user, salesValue: sales.total, invoiceCount: sales.invoices, customerCount: customers.count, outstanding: customers.outstanding, visitsTotal: visits.total, visitsCompleted: visits.completed, followUpsOpen, attendance };
    });
    const teamIds = users.map((user) => user.id);
    const pipeline = teamIds.length ? db.prepare(`SELECT stage,COUNT(*) count,COALESCE(SUM(expected_value),0) expectedValue FROM leads WHERE user_id IN (${teamIds.map(() => "?").join(",")}) GROUP BY stage`).all(...teamIds) : [];
    res.json({ manager, from, to, members, pipeline, summary: { salesValue: members.reduce((sum, m) => sum + m.salesValue, 0), customers: members.reduce((sum, m) => sum + m.customerCount, 0), outstanding: members.reduce((sum, m) => sum + m.outstanding, 0), visitsCompleted: members.reduce((sum, m) => sum + m.visitsCompleted, 0), visitsTotal: members.reduce((sum, m) => sum + m.visitsTotal, 0), followUpsOpen: members.reduce((sum, m) => sum + m.followUpsOpen, 0) } });
  } catch (error) { next(error); }
});

rmRouter.get("/customers", (req, res, next) => {
  try {
    const teamIds = getTeamIds(req.user.id);
    const q = String(req.query.q ?? "").toLowerCase();
    const page = Math.max(0, Number(req.query.page ?? 0));
    const ph = teamIds.map(() => "?").join(",");
    let customers = db.prepare(`SELECT id,name,party_type type,rm_name rmName,city,total_sales totalSales,outstanding,owner_user_id ownerUserId FROM tally_customers WHERE owner_user_id IN (${ph}) ORDER BY name`).all(...teamIds);
    if (q) customers = customers.filter((c) => `${c.name} ${c.city} ${c.rmName ?? ""}`.toLowerCase().includes(q));
    const total = customers.length;
    res.json({ total, items: customers.slice(page * 50, page * 50 + 50) });
  } catch (error) { next(error); }
});

rmRouter.get("/customers/:id", (req, res, next) => {
  try {
    const teamIds = getTeamIds(req.user.id);
    const customer = db.prepare("SELECT * FROM tally_customers WHERE id=?").get(req.params.id);
    if (!customer || !teamIds.includes(customer.owner_user_id)) return res.status(403).json({ error: "This customer is not in your team" });
    const monthlySales = db.prepare("SELECT period,amount FROM tally_customer_monthly_sales WHERE customer_id=? ORDER BY period").all(req.params.id);
    const visits = db.prepare("SELECT id,business_date,purpose,outcome,status,completed_at FROM visits WHERE tally_customer_id=? ORDER BY business_date DESC LIMIT 20").all(req.params.id);
    const activities = db.prepare("SELECT * FROM customer_activities WHERE tally_customer_id=? ORDER BY occurred_at DESC LIMIT 20").all(req.params.id);
    const requests = db.prepare("SELECT * FROM service_requests WHERE tally_customer_id=? ORDER BY created_at DESC").all(req.params.id);
    res.json({ customer, monthlySales, visits, activities, requests });
  } catch (error) { next(error); }
});

rmRouter.get("/product-trends", (req, res, next) => {
  try {
    const profile = db.prepare("SELECT region,territory FROM salesperson_profiles WHERE user_id=?").get(req.user.id);
    const region = profile?.region ?? "";
    const from = financialYearStart();
    const to = today();
    const trends = db.prepare(`
      SELECT p.name, COALESCE(SUM(l.amount),0) salesValue, COALESCE(SUM(l.quantity),0) quantity,
             COUNT(DISTINCT i.id) invoiceCount
      FROM tally_products p
      LEFT JOIN tally_invoice_lines l ON l.product_id=p.id
      LEFT JOIN tally_invoices i ON i.id=l.invoice_id AND i.invoice_date BETWEEN ? AND ?
      LEFT JOIN tally_customers c ON c.id=i.customer_id
      WHERE (c.rm_name LIKE ? OR c.destination_code LIKE ? OR ? = '')
      GROUP BY p.id
      ORDER BY salesValue DESC
      LIMIT 40
    `).all(from, to, `%${region}%`, `%${region}%`, region);
    res.json({ territory: region, trends, from, to });
  } catch (error) { next(error); }
});

rmRouter.get("/alerts", (req, res, next) => {
  try {
    const teamIds = getTeamIds(req.user.id);
    const todayStr = today();
    const ph = teamIds.map(() => "?").join(",");
    const overdueFollowUps = db.prepare(`
      SELECT f.id,f.title,f.due_date dueDate,u.email,p.full_name fullName,c.name customer,
             CAST(julianday('now') - julianday(f.due_date) AS INTEGER) daysOverdue
      FROM follow_ups f
      LEFT JOIN users u ON u.id=f.user_id
      LEFT JOIN salesperson_profiles p ON p.user_id=f.user_id
      LEFT JOIN tally_customers c ON c.id=f.tally_customer_id
      WHERE f.user_id IN (${ph}) AND f.completed=0 AND f.due_date<?
      ORDER BY f.due_date
    `).all(...teamIds, todayStr);
    const missedCheckIns = db.prepare(`
      SELECT u.id,u.email,p.full_name fullName,p.territory,p.region
      FROM users u JOIN salesperson_profiles p ON p.user_id=u.id
      WHERE u.id IN (${ph}) AND u.active=1
        AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.user_id=u.id AND a.business_date=?)
    `).all(...teamIds, todayStr);
    const targetShortfalls = db.prepare(`
      SELECT u.id,u.email,p.full_name fullName,p.region,p.monthly_target monthlyTarget
      FROM users u JOIN salesperson_profiles p ON p.user_id=u.id
      WHERE u.id IN (${ph}) AND u.active=1 AND p.monthly_target>0
    `).all(...teamIds);
    const overdueOrders = db.prepare(`
      SELECT e.id,e.expected_date expectedDate,e.expected_value expectedValue,
             c.name customer,p2.name product,u.email,sp.full_name fullName,
             CAST(julianday('now') - julianday(e.expected_date) AS INTEGER) daysOverdue
      FROM expected_orders e
      LEFT JOIN tally_customers c ON c.id=e.tally_customer_id
      LEFT JOIN tally_products p2 ON p2.id=e.tally_product_id
      LEFT JOIN users u ON u.id=e.user_id
      LEFT JOIN salesperson_profiles sp ON sp.user_id=e.user_id
      WHERE e.user_id IN (${ph}) AND e.status='open' AND e.expected_date<?
      ORDER BY e.expected_date
    `).all(...teamIds, todayStr);
    res.json({ overdueFollowUps, missedCheckIns, targetShortfalls, overdueOrders });
  } catch (error) { next(error); }
});

rmRouter.post("/ask-ai", async (req, res, next) => {
  try {
    const question = String(req.body?.question || "").trim();
    if (!question) return res.status(400).json({ error: "Enter a question" });
    const { buildContext, buildSystemPrompt, askOpenAI } = await import("./ai-context.mjs");
    const contextJson = await buildContext(req.user.id, "rm");
    const answer = await askOpenAI(buildSystemPrompt(contextJson), question);
    res.json({ question, answer, source: "PSSPL CRM & Tally data via AI" });
  } catch (error) { next(error); }
});
