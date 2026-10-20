import { authoritativeInvoiceWhere, netInvoiceAmount, netInvoiceLineAmount } from "./tally/metrics.mjs";
import { indiaBusinessDate, isDateOnly } from "./field-activity.mjs";
import { buildRmManagementInsights, rmReportThresholds, calculatePeriodPerformance, classifyPlannedVisits } from "./rm-report-intelligence.mjs";

export function reportingPeriod(input = {}, now = new Date()) {
  const today = indiaBusinessDate(now);
  const year = Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) < 4 ? 1 : 0);
  const from = input.from ?? `${year}-04-01`, to = input.to ?? today;
  if (!isDateOnly(from) || !isDateOnly(to) || from > to || to > today) throw Object.assign(new Error("Choose a valid reporting period ending today or earlier"), { status: 400 });
  return { from, to, asOf: today, timezone: "Asia/Kolkata" };
}

export function authorizedScope(db, userId) {
  const user = db.prepare("SELECT id,role FROM users WHERE id=? AND active=1").get(userId);
  if (!user) throw Object.assign(new Error("Account unavailable"), { status: 403 });
  const ids = user.role === "admin" ? db.prepare("SELECT id FROM users").all().map(r => r.id)
    : user.role === "rm" ? [userId, ...db.prepare("SELECT p.user_id FROM salesperson_profiles p JOIN users u ON u.id=p.user_id WHERE p.manager_user_id=? AND u.active=1 AND u.role='salesperson'").all(userId).map(r => r.user_id)] : [userId];
  return { ...user, ids };
}

/** Uses the signed, committed invoice rules from Phases 2–6. */
export function reportSnapshot(db, userId, input = {}, now = new Date()) {
  const scope = authorizedScope(db, userId), period = reportingPeriod(input, now);
  const { from, to, asOf } = period;
  const ph = scope.ids.map(() => "?").join(",");
  const owner = scope.role === "admin" ? "1=1" : `c.owner_user_id IN (${ph})`;
  const ownerArgs = scope.role === "admin" ? [] : scope.ids;
  const sales = db.prepare(`SELECT COUNT(*) invoiceCount,COALESCE(SUM(${netInvoiceAmount("i")}),0) salesValue FROM tally_invoices i LEFT JOIN tally_customers c ON c.id=i.customer_id WHERE ${authoritativeInvoiceWhere("i")} AND i.invoice_date BETWEEN ? AND ? AND ${owner}`).get(from, to, ...ownerArgs);
  const topProducts = db.prepare(`SELECT p.name,COALESCE(SUM(${netInvoiceLineAmount("i", "l")}),0) salesValue FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id LEFT JOIN tally_customers c ON c.id=i.customer_id JOIN tally_products p ON p.id=l.product_id WHERE ${authoritativeInvoiceWhere("i")} AND i.invoice_date BETWEEN ? AND ? AND ${owner} GROUP BY p.id ORDER BY salesValue DESC LIMIT 5`).all(from, to, ...ownerArgs);
  const follow = db.prepare(`SELECT COUNT(*) pending,COALESCE(SUM(CASE WHEN due_date<? THEN 1 ELSE 0 END),0) overdue,COALESCE(SUM(CASE WHEN due_date=? THEN 1 ELSE 0 END),0) dueToday FROM follow_ups WHERE completed=0 AND user_id IN (${ph})`).get(asOf, asOf, ...scope.ids);
  const visits = db.prepare(`SELECT business_date businessDate,scheduled_at scheduledAt,status FROM visits WHERE user_id IN (${ph}) AND business_date<=?`).all(...scope.ids, asOf);
  const classified = classifyPlannedVisits(visits, { asOf, now: now.toISOString() });
  const pipeline = db.prepare(`SELECT stage,COUNT(*) count,SUM(expected_value) value FROM leads WHERE user_id IN (${ph}) GROUP BY stage`).all(...scope.ids);
  const latest = db.prepare("SELECT completed_at completedAt,status FROM tally_sync_runs ORDER BY started_at DESC LIMIT 1").get();
  const ageHours = latest?.completedAt ? Math.max(0, (now.getTime() - Date.parse(latest.completedAt.includes("T") ? latest.completedAt : `${latest.completedAt.replace(" ", "T")}Z`)) / 3600000) : null;
  const data = { status: !latest ? "unverified" : !["completed", "stored"].includes(latest.status) ? "needs-review" : "age-requires-review", lastCompletedAt: latest?.completedAt ?? null, ageHours: Number.isFinite(ageHours) ? Math.round(ageHours * 10) / 10 : null };
  const managers = scope.role === "salesperson" ? [] : db.prepare(`SELECT u.id,p.full_name name FROM users u JOIN salesperson_profiles p ON p.user_id=u.id WHERE u.active=1 AND u.role='rm' ${scope.role === "rm" ? "AND u.id=?" : ""}`).all(...(scope.role === "rm" ? [userId] : []));
  const rmPerformance = managers.map(manager => {
    const team = authorizedScope(db, manager.id).ids, tph = team.map(() => "?").join(",");
    const actual = db.prepare(`SELECT COUNT(*) count,SUM(${netInvoiceAmount("i")}) value FROM tally_invoices i JOIN tally_customers c ON c.id=i.customer_id WHERE ${authoritativeInvoiceWhere("i")} AND i.invoice_date BETWEEN ? AND ? AND c.owner_user_id IN (${tph})`).get(from, to, ...team);
    // Exact unique identity only; unresolved aliases remain unavailable rather than guessed.
    const unique = db.prepare("SELECT COUNT(*) count FROM salesperson_profiles p JOIN users u ON u.id=p.user_id WHERE p.full_name=? AND u.active=1").get(manager.name).count === 1;
    const months = (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7)) + 1;
    const target = db.prepare("SELECT COUNT(*) count,SUM(target_lakh * 100000) value FROM tally_rm_targets WHERE rm_name=? AND period BETWEEN ? AND ?").get(manager.name, from.slice(0, 7), to.slice(0, 7));
    const performance = calculatePeriodPerformance(actual.count ? actual.value : null, unique && from.endsWith("-01") && target.count === months ? target.value : null, from, to, "selected period; full monthly targets");
    const overdue = db.prepare(`SELECT COUNT(*) count FROM follow_ups WHERE completed=0 AND due_date<? AND user_id IN (${tph})`).get(asOf, ...team).count;
    const attention = buildRmManagementInsights({ name: manager.name, period: { from, to }, monthlyPerformance: performance, overdueFollowUps: overdue, ownershipMapping: "verified", thresholds: rmReportThresholds() });
    return { name: manager.name, performance, attention, targetMapping: unique && target.count === months ? "exact-unique-name" : "unavailable; verify aliases and period coverage" };
  });
  return { scope: scope.role, period, source: "Authoritative committed Tally invoices (net INR); CRM follow-ups, visits and pipeline are current snapshots", data,
    sales: { ...sales, salesValue: sales.invoiceCount ? sales.salesValue : null }, topProducts, pipeline, rmPerformance,
    followUps: follow, visits: { upcomingToday: classified.filter(r => r.pendingToday && !r.pastScheduledTime).length, pastScheduled: classified.filter(r => r.pastScheduledTime).length, completedInPeriod: visits.filter(r => r.status === "completed" && r.businessDate >= from && r.businessDate <= to).length },
    performance: calculatePeriodPerformance(sales.invoiceCount ? sales.salesValue : null, null, from, to, "selected period"),
    limitations: ["Targets require verified RM mapping and matching period; achievement is unavailable in this aggregate.", "Top five products are a subset, not an approved thrust-product list.", "Pipeline and follow-ups are current state, not historical snapshots.", "Past scheduled visits require owner confirmation, not a no-show conclusion.", "No approved Tally freshness SLA; review sync age and period coverage."] };
}
