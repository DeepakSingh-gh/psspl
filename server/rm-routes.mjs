import { Router } from "express";
import { authenticate, requireRole } from "./auth.mjs";
import { db } from "./db.mjs";

export const rmRouter = Router();
rmRouter.use(authenticate, requireRole("rm"));

const today = () => new Date().toISOString().slice(0, 10);
const financialYearStart = () => { const now = new Date(); const year = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1; return `${year}-04-01`; };

rmRouter.get("/dashboard", (req, res, next) => {
  try {
    const from = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.from ?? "")) ? String(req.query.from) : financialYearStart();
    const to = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to ?? "")) ? String(req.query.to) : today();
    if (from > to) return res.status(400).json({ error: "From date must be before the to date" });
    const manager = db.prepare("SELECT u.id,u.email,p.full_name fullName,p.region,p.territory FROM users u JOIN salesperson_profiles p ON p.user_id=u.id WHERE u.id=?").get(req.user.id);
    // An RM sees their own customer book plus every salesperson reporting to them.
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
    res.json({ manager, from, to, members, pipeline, summary: { salesValue: members.reduce((sum, member) => sum + member.salesValue, 0), customers: members.reduce((sum, member) => sum + member.customerCount, 0), outstanding: members.reduce((sum, member) => sum + member.outstanding, 0), visitsCompleted: members.reduce((sum, member) => sum + member.visitsCompleted, 0), visitsTotal: members.reduce((sum, member) => sum + member.visitsTotal, 0), followUpsOpen: members.reduce((sum, member) => sum + member.followUpsOpen, 0) } });
  } catch (error) { next(error); }
});
