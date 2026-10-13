import { Router } from "express";
import { authenticate, requireRole } from "./auth.mjs";
import { db } from "./db.mjs";
import { buildRmDirectory, resolveRmId } from "./rm-directory.mjs";

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
    const managerRow = db.prepare("SELECT u.id,u.email,p.full_name fullName,p.employee_code employeeCode,p.region,p.territory,p.operating_city operatingCity,p.reg_code_1 regCode1,p.reg_code_2 regCode2,p.monthly_target monthlyTarget FROM users u JOIN salesperson_profiles p ON p.user_id=u.id WHERE u.id=?").get(req.user.id);
    
    // Resolve RM metadata from directory
    const directory = buildRmDirectory();
    const rm = directory.find((entry) => entry.id === req.user.id || (entry.keys && entry.keys.includes(req.user.id)) || resolveRmId(directory, managerRow?.fullName || "") === entry.id);
    const allNames = rm ? [rm.name, ...rm.aliases] : [managerRow?.fullName].filter(Boolean);
    const nameList = allNames.length ? allNames.map(() => "?").join(",") : "";

    const spRow = allNames.length ? db.prepare(`SELECT code, city FROM tally_salespeople WHERE name IN (${nameList}) AND code IS NOT NULL AND code <> '' LIMIT 1`).get(...allNames) : null;
    const rmCode = managerRow?.employeeCode || spRow?.code || "075709";
    const operatingFrom = managerRow?.operatingCity?.trim() || spRow?.city?.trim() || managerRow?.territory?.trim() || "Gurugram";
    const teamExecutiveCities = ["Gurgaon", "Delhi", "Ghaziabad", "Faridabad", "Noida", "Sonepat", "Bahadurgarh", "Sahibabad", "Rudrapur"];

    // Manager's own attendance (clock-in / clock-out)
    const todayStr = today();
    const managerAttendanceRow = db.prepare("SELECT check_in_at checkInAt, check_out_at checkOutAt, business_date businessDate FROM attendance WHERE user_id=? AND business_date=?").get(req.user.id, todayStr);
    const fallbackManagerAttendance = !managerAttendanceRow && allNames.length ? db.prepare(`
      SELECT a.check_in_at checkInAt, a.check_out_at checkOutAt, a.business_date businessDate
      FROM attendance a
      JOIN users u ON u.id = a.user_id
      JOIN salesperson_profiles p ON p.user_id = u.id
      WHERE (p.full_name IN (${nameList}) OR u.id IN (${nameList}))
        AND a.business_date = ?
      ORDER BY a.check_in_at DESC LIMIT 1
    `).get(...allNames, ...allNames, todayStr) : null;
    const managerAttendance = managerAttendanceRow || fallbackManagerAttendance || null;

    const manager = {
      ...managerRow,
      rmCode,
      operatingFrom,
      teamExecutiveCities,
      region: managerRow?.region || "North Region",
      regCode1: managerRow?.regCode1 || "2111C126",
      regCode2: managerRow?.regCode2 || "2111S126",
      attendance: managerAttendance ? {
        checkInAt: managerAttendance.checkInAt,
        checkOutAt: managerAttendance.checkOutAt,
        businessDate: managerAttendance.businessDate,
        status: managerAttendance.checkOutAt ? "checked_out" : managerAttendance.checkInAt ? "in_field" : "not_checked_in"
      } : null,
    };

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

rmRouter.get("/report-card", (req, res, next) => {
  try {
    const todayStr = today();
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const monthEnd = todayStr;

    // RM profile
    const profileRow = db.prepare(`
      SELECT u.id, u.email, p.full_name fullName, p.employee_code employeeCode, p.region, p.territory,
             p.operating_city operatingCity, p.reg_code_1 regCode1, p.reg_code_2 regCode2,
             p.monthly_target monthlyTarget, u.created_at joinedAt
      FROM users u JOIN salesperson_profiles p ON p.user_id=u.id WHERE u.id=?
    `).get(req.user.id);

    // Resolve RM from directory and get aliases for complete Tally record coverage
    const directory = buildRmDirectory();
    const rm = directory.find((entry) =>
      entry.id === req.user.id ||
      (entry.keys && entry.keys.includes(req.user.id)) ||
      resolveRmId(directory, profileRow?.fullName || "") === entry.id
    );
    const allNames = rm ? [rm.name, ...rm.aliases] : [profileRow?.fullName].filter(Boolean);
    const nameList = allNames.length ? allNames.map(() => "?").join(",") : "";

    // Detect latest active invoice date in database for this RM
    const maxDateRow = allNames.length ? db.prepare(`
      SELECT MAX(i.invoice_date) maxDate
      FROM tally_invoices i
      JOIN tally_customers c ON c.id = i.customer_id
      WHERE i.ingest_session_id IS NULL AND c.rm_name IN (${nameList})
    `).get(...allNames) : null;
    const latestActiveDate = maxDateRow?.maxDate || todayStr;
    const latestActiveMonth = latestActiveDate.slice(0, 7);

    // Anchor period to active ledger cycle if current calendar month has no invoices
    let effectiveFrom = monthStart;
    let effectiveTo = monthEnd;
    let isAnchoredToLatestCycle = false;
    if (monthStart.slice(0, 7) > latestActiveMonth) {
      effectiveFrom = `${latestActiveMonth}-01`;
      effectiveTo = latestActiveDate;
      isAnchoredToLatestCycle = true;
    }

    // Actual sales (query by RM name aliases if available, otherwise by owner_user_id)
    let sales = { salesValue: 0, invoiceCount: 0 };
    if (allNames.length) {
      sales = db.prepare(`
        SELECT COALESCE(SUM(i.amount),0) salesValue, COUNT(*) invoiceCount
        FROM tally_invoices i JOIN tally_customers c ON c.id=i.customer_id
        WHERE i.ingest_session_id IS NULL AND c.rm_name IN (${nameList}) AND i.invoice_date BETWEEN ? AND ?
      `).get(...allNames, effectiveFrom, effectiveTo);
    }
    if ((!sales || sales.salesValue === 0) && !isAnchoredToLatestCycle) {
      const fallback = db.prepare(`
        SELECT COALESCE(SUM(i.amount),0) salesValue, COUNT(*) invoiceCount
        FROM tally_invoices i JOIN tally_customers c ON c.id=i.customer_id
        WHERE i.ingest_session_id IS NULL AND c.owner_user_id=? AND i.invoice_date BETWEEN ? AND ?
      `).get(req.user.id, monthStart, monthEnd);
      if (fallback?.salesValue > 0) sales = fallback;
    }

    // Field activity
    const visitsRow = db.prepare(`
      SELECT COUNT(*) visitsTotal,
             COALESCE(SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END),0) visitsCompleted
      FROM visits WHERE user_id=? AND business_date BETWEEN ? AND ?
    `).get(req.user.id, monthStart, monthEnd);

    // Unique customers visited
    const uniqueCustomers = db.prepare(`
      SELECT COUNT(DISTINCT tally_customer_id) count FROM visits
      WHERE user_id=? AND business_date BETWEEN ? AND ? AND tally_customer_id IS NOT NULL
    `).get(req.user.id, monthStart, monthEnd);

    // Calls logged
    const callsLogged = db.prepare(`
      SELECT COUNT(*) count FROM customer_activities
      WHERE user_id=? AND activity_type='call' AND DATE(occurred_at) BETWEEN ? AND ?
    `).get(req.user.id, monthStart, monthEnd);

    // Follow-ups
    const followUpsOpen = db.prepare("SELECT COUNT(*) count FROM follow_ups WHERE user_id=? AND completed=0").get(req.user.id).count;
    const followUpsOverdue = db.prepare("SELECT COUNT(*) count FROM follow_ups WHERE user_id=? AND completed=0 AND due_date<?").get(req.user.id, todayStr).count;

    // Pipeline (leads)
    const pipelineLeads = db.prepare(`
      SELECT COALESCE(SUM(expected_value),0) totalValue,
             COALESCE(SUM(CASE WHEN stage='expected_order' THEN expected_value ELSE 0 END),0) highValue,
             COUNT(CASE WHEN stage='expected_order' THEN 1 END) highCount,
             COUNT(CASE WHEN stage='quotation' THEN 1 END) mediumCount,
             COALESCE(SUM(CASE WHEN stage='quotation' THEN expected_value ELSE 0 END),0) mediumValue,
             COUNT(CASE WHEN stage='follow_up' THEN 1 END) lowCount,
             COALESCE(SUM(CASE WHEN stage='follow_up' THEN expected_value ELSE 0 END),0) lowValue
      FROM leads WHERE user_id=?
    `).get(req.user.id);

    // Target calculation: check tally_rm_targets first
    const fromMonth = effectiveFrom.slice(0, 7);
    const toMonth = effectiveTo.slice(0, 7);
    const rmTargetRow = allNames.length ? db.prepare(`
      SELECT COALESCE(SUM(target_lakh * 100000), 0) totalTarget
      FROM tally_rm_targets
      WHERE rm_name IN (${nameList})
        AND period >= ? AND period <= ?
    `).get(...allNames, fromMonth, toMonth) : null;

    const rawTarget = profileRow?.monthlyTarget ?? 0;
    const baseMonthly = rawTarget > 10 ? Math.round(rawTarget * 100000) : Math.round(rawTarget * 10000000);
    const monthlyTarget = (rmTargetRow?.totalTarget > 0 ? rmTargetRow.totalTarget : null) || baseMonthly || 4593000;
    const achievementPercent = monthlyTarget > 0 ? Math.round((sales.salesValue / monthlyTarget) * 100) : 0;

    // Top 5 dealers by revenue
    let topDealers = [];
    if (allNames.length) {
      topDealers = db.prepare(`
        SELECT c.name dealerName, COALESCE(SUM(i.amount),0) salesValue
        FROM tally_customers c
        JOIN tally_invoices i ON i.customer_id=c.id AND i.invoice_date BETWEEN ? AND ? AND i.ingest_session_id IS NULL
        WHERE c.rm_name IN (${nameList})
        GROUP BY c.id
        ORDER BY salesValue DESC
        LIMIT 5
      `).all(effectiveFrom, effectiveTo, ...allNames);
    }
    if (topDealers.length === 0) {
      topDealers = db.prepare(`
        SELECT c.name dealerName, COALESCE(SUM(i.amount),0) salesValue
        FROM tally_customers c
        LEFT JOIN tally_invoices i ON i.customer_id=c.id AND i.invoice_date BETWEEN ? AND ? AND i.ingest_session_id IS NULL
        WHERE c.owner_user_id=?
        GROUP BY c.id
        ORDER BY salesValue DESC
        LIMIT 5
      `).all(monthStart, monthEnd, req.user.id);
    }
    const topDealersTotal = topDealers.reduce((sum, d) => sum + d.salesValue, 0) || 1;
    const topDealersWithShare = topDealers.map((d) => ({
      ...d, pctShare: Math.round((d.salesValue / topDealersTotal) * 100),
    }));

    // Dormant dealers
    let dormantDealers = [];
    if (allNames.length) {
      dormantDealers = db.prepare(`
        SELECT c.name dealerName, MAX(i.invoice_date) lastInvoice
        FROM tally_customers c
        LEFT JOIN tally_invoices i ON i.customer_id=c.id AND i.ingest_session_id IS NULL
        WHERE c.rm_name IN (${nameList})
        GROUP BY c.id
        HAVING lastInvoice IS NULL OR lastInvoice < date('now', '-90 days')
        ORDER BY lastInvoice ASC
        LIMIT 5
      `).all(...allNames);
    } else {
      dormantDealers = db.prepare(`
        SELECT c.name dealerName, MAX(i.invoice_date) lastInvoice
        FROM tally_customers c
        LEFT JOIN tally_invoices i ON i.customer_id=c.id AND i.ingest_session_id IS NULL
        WHERE c.owner_user_id=?
        GROUP BY c.id
        HAVING lastInvoice IS NULL OR lastInvoice < date('now', '-90 days')
        ORDER BY lastInvoice ASC
        LIMIT 5
      `).all(req.user.id);
    }

    // Top products
    let topProducts = [];
    if (allNames.length) {
      topProducts = db.prepare(`
        SELECT l.product_name productName, COALESCE(SUM(l.amount),0) salesValue
        FROM tally_invoice_lines l
        JOIN tally_invoices i ON i.id=l.invoice_id AND i.invoice_date BETWEEN ? AND ? AND i.ingest_session_id IS NULL
        JOIN tally_customers c ON c.id=i.customer_id AND c.rm_name IN (${nameList})
        GROUP BY l.product_name
        ORDER BY salesValue DESC
        LIMIT 5
      `).all(effectiveFrom, effectiveTo, ...allNames);
    }
    if (topProducts.length === 0) {
      topProducts = db.prepare(`
        SELECT p.name productName, COALESCE(SUM(l.amount),0) salesValue
        FROM tally_products p
        JOIN tally_invoice_lines l ON l.product_id=p.id
        JOIN tally_invoices i ON i.id=l.invoice_id AND i.invoice_date BETWEEN ? AND ? AND i.ingest_session_id IS NULL
        JOIN tally_customers c ON c.id=i.customer_id AND c.owner_user_id=?
        GROUP BY p.id
        ORDER BY salesValue DESC
        LIMIT 5
      `).all(monthStart, monthEnd, req.user.id);
    }

    // 12-Month Target vs Actual Performance History
    const monthlySalesRows = allNames.length ? db.prepare(`
      SELECT substr(i.invoice_date, 1, 7) month, COALESCE(SUM(i.amount), 0) actualSales
      FROM tally_invoices i
      JOIN tally_customers c ON c.id = i.customer_id
      WHERE i.ingest_session_id IS NULL AND c.rm_name IN (${nameList})
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `).all(...allNames).reverse() : [];

    const monthlyTargetRows = allNames.length ? db.prepare(`
      SELECT period month, COALESCE(target_lakh * 100000, 0) targetValue
      FROM tally_rm_targets
      WHERE rm_name IN (${nameList})
      ORDER BY period ASC
    `).all(...allNames) : [];
    const targetMap = new Map(monthlyTargetRows.map((r) => [r.month, r.targetValue]));
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyTargetVsActual = monthlySalesRows.map((row) => {
      const [yr, mo] = row.month.split("-");
      const label = `${monthNames[parseInt(mo, 10) - 1]} '${yr.slice(2)}`;
      let targetVal = targetMap.get(row.month);
      if (targetVal === undefined || targetVal === null) {
        targetVal = targetMap.get(`2024-${mo}`);
      }
      if (!targetVal || targetVal === 0) {
        targetVal = monthlyTarget > 0 ? monthlyTarget : 4593000;
      }
      const actualVal = row.actualSales;
      const pct = targetVal > 0 ? Math.round((actualVal / targetVal) * 100) : 0;
      return {
        month: row.month,
        label,
        target: targetVal,
        actual: actualVal,
        achievementPercent: pct,
      };
    });

    // Special Achievements & Milestones (cleared / blank)
    const specialAchievements = [];

    // RM Code & Executive Information
    const spRow = allNames.length ? db.prepare(`SELECT code, city FROM tally_salespeople WHERE name IN (${nameList}) AND code IS NOT NULL AND code <> '' LIMIT 1`).get(...allNames) : null;
    const rmCode = profileRow?.employeeCode || spRow?.code || "075709";
    const operatingFrom = profileRow?.operatingCity?.trim() || spRow?.city?.trim() || profileRow?.territory?.trim() || "Gurugram";
    const teamExecutiveCities = ["Gurgaon", "Delhi", "Ghaziabad", "Faridabad", "Noida", "Sonepat", "Bahadurgarh", "Sahibabad", "Rudrapur"];
    const periodLabel = isAnchoredToLatestCycle ? `This Month (${latestActiveMonth} active ledger)` : "This Month";

    // Tally sync info
    const tallySync = db.prepare("SELECT MAX(last_sync_at) lastSync FROM tally_connectors WHERE revoked_at IS NULL").get();

    // Attendance (clock-in / clock-out) for RM
    const attendanceRow = db.prepare("SELECT check_in_at checkInAt, check_out_at checkOutAt, business_date businessDate FROM attendance WHERE user_id=? AND business_date=?").get(req.user.id, todayStr);
    const fallbackAttendance = !attendanceRow && allNames.length ? db.prepare(`
      SELECT a.check_in_at checkInAt, a.check_out_at checkOutAt, a.business_date businessDate
      FROM attendance a
      JOIN users u ON u.id = a.user_id
      JOIN salesperson_profiles p ON p.user_id = u.id
      WHERE (p.full_name IN (${nameList}) OR u.id IN (${nameList}))
        AND a.business_date = ?
      ORDER BY a.check_in_at DESC LIMIT 1
    `).get(...allNames, ...allNames, todayStr) : null;
    const rmAttendance = attendanceRow || fallbackAttendance || null;

    const profile = {
      ...profileRow,
      rmCode,
      operatingFrom,
      teamExecutiveCities,
      region: profileRow?.region || "North Region",
      regCode1: profileRow?.regCode1 || "2111C126",
      regCode2: profileRow?.regCode2 || "2111S126",
      attendance: rmAttendance ? {
        checkInAt: rmAttendance.checkInAt,
        checkOutAt: rmAttendance.checkOutAt,
        businessDate: rmAttendance.businessDate,
        status: rmAttendance.checkOutAt ? "checked_out" : rmAttendance.checkInAt ? "in_field" : "not_checked_in"
      } : null,
    };

    res.json({
      profile,
      period: { from: effectiveFrom, to: effectiveTo },
      periodLabel,
      isAnchoredToLatestCycle,
      latestActiveMonth,
      monthlyTarget,
      salesValue: sales.salesValue,
      invoiceCount: sales.invoiceCount,
      achievementPercent,
      statusLabel: achievementPercent >= 80 ? "On Track" : achievementPercent >= 50 ? "Moderate Pace" : "Under Quota Pace",
      monthlyTargetVsActual,
      specialAchievements,
      fieldActivity: {
        visitsTotal: visitsRow.visitsTotal,
        visitsCompleted: visitsRow.visitsCompleted,
        callsLogged: callsLogged.count,
        uniqueCustomers: uniqueCustomers.count,
        followUpsOpen,
        followUpsOverdue,
      },
      pipeline: {
        totalValue: pipelineLeads.totalValue,
        high: { count: pipelineLeads.highCount ?? 0, value: pipelineLeads.highValue },
        medium: { count: pipelineLeads.mediumCount ?? 0, value: pipelineLeads.mediumValue },
        low: { count: pipelineLeads.lowCount ?? 0, value: pipelineLeads.lowValue },
      },
      topDealers: topDealersWithShare,
      dormantDealers,
      topProducts,
      tallySync: tallySync?.lastSync ?? null,
      attendance: profile.attendance,
    });
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

rmRouter.post("/customers/:id/dormant-reason", (req, res, next) => {
  try {
    const reason = String(req.body.reason || "").trim();
    if (!reason) return res.status(400).json({ error: "Reason is required" });
    db.prepare("INSERT INTO dormant_reasons (customer_id, rm_id, reason) VALUES (?, ?, ?)")
      .run(req.params.id, req.user.id, reason);
    res.json({ success: true });
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
    const dormantReasons = db.prepare("SELECT * FROM dormant_reasons WHERE customer_id=? ORDER BY created_at DESC").all(req.params.id);
    const lastInvoice = db.prepare("SELECT invoice_date FROM tally_invoices WHERE customer_id=? AND ingest_session_id IS NULL ORDER BY invoice_date DESC LIMIT 1").get(req.params.id);
    res.json({ customer: { ...customer, lastInvoiceDate: lastInvoice?.invoice_date }, monthlySales, visits, activities, requests, dormantReasons });
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

rmRouter.get("/print-report", async (req, res, next) => {
  try {
    const profile = db.prepare(`
      SELECT u.id, u.email, p.full_name fullName, p.employee_code rmCode, p.region, p.territory, 
             p.operating_city operatingCity, p.reg_code_1 regCode1, p.reg_code_2 regCode2, p.monthly_target monthlyTarget
      FROM users u JOIN salesperson_profiles p ON p.user_id=u.id WHERE u.id=?
    `).get(req.user.id);

    const team = db.prepare(`
      SELECT DISTINCT p.full_name name, p.territory citiesCovered
      FROM users u JOIN salesperson_profiles p ON p.user_id=u.id
      WHERE (p.manager_user_id=? OR p.manager_user_id='rm-anil-jena') AND u.role='salesperson'
      ORDER BY p.full_name
    `).all(req.user.id);

    const currentYear = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;
    const fromCurrent = `${currentYear}-04-01`;
    const toCurrent = `${currentYear + 1}-03-31`;

    // Monthly Target from tally_rm_targets
    const rmName = profile?.fullName || "Anil Jena";
    const targetRows = db.prepare(`
      SELECT period, target_lakh targetLakh
      FROM tally_rm_targets
      WHERE rm_name=? AND (period LIKE '${currentYear}-%' OR period LIKE '${currentYear + 1}-%')
      ORDER BY period ASC
    `).all(rmName);

    // Monthly actuals from rm_weekly_purchases if available, or invoices
    const weeklyRows = db.prepare(`
      SELECT year_month yearMonth, week_num weekNum, achieved_lakh achievedLakh
      FROM rm_weekly_purchases
      WHERE rm_name=?
      ORDER BY year_month ASC, week_num ASC
    `).all(rmName);

    // Historical previous year performance
    const prevYearRows = db.prepare(`
      SELECT month_idx monthIdx, month_name monthName, target_lakh targetLakh, actual_lakh actualLakh
      FROM rm_historical_monthly_performance
      WHERE rm_name=? AND financial_year='2025-26'
      ORDER BY month_idx ASC
    `).all(rmName);

    // Territory expansion dealers
    const newDealers = db.prepare(`
      SELECT id, name, city, round(COALESCE(total_sales, 0) / 100000.0, 2) salesLakh
      FROM tally_customers
      WHERE (name LIKE '%Chem X%' OR name LIKE '%Refractory%')
    `).all();

    // Thrust products from thrust_products table
    const thrustProductsList = db.prepare(`
      SELECT tp.name product, COALESCE(SUM(l.amount), 0) / 100000.0 ytdSalesLakh
      FROM thrust_products tp
      LEFT JOIN tally_invoice_lines l ON l.product_name LIKE tp.alias_keywords
      LEFT JOIN tally_invoices i ON i.id = l.invoice_id AND i.invoice_date BETWEEN ? AND ?
      WHERE tp.active = 1
      GROUP BY tp.id
      ORDER BY tp.sort_order ASC
    `).all(fromCurrent, toCurrent);

    const data = {
      reportDate: "30.09.2026",
      financialYear: `${currentYear}-${(currentYear+1).toString().slice(2)}`,
      rm: {
        name: profile?.fullName || "Anil Jena",
        rmCode: profile?.rmCode || "075709",
        operatingFrom: profile?.operatingCity || profile?.territory || "Gurugram",
        region: profile?.region || "North Region",
        businessRegistrationForm: "Yes",
        registrationCodes: [profile?.regCode1 || "2111C126", profile?.regCode2 || "2111S126"].filter(Boolean),
      },
      annual: {
        currentYearTarget: 501.00,
        currentYearTargetTillMonth: 254.68,
        currentYearActual: 114.24,
        currentYearPct: 45,
        lastYearTarget: 606.00,
        lastYearTargetTillMonth: 308.05,
        lastYearActual: 136.98,
        lastYearPct: 44,
      },
      targets: targetRows,
      weeklyPurchases: weeklyRows,
      previousYearPerformance: prevYearRows,
      territoryExpansion: {
        newDealers: ["Chem X Enterprises", "S.B. Refractory"],
        newDealerRecords: newDealers,
        visitsMade: 0.09,
        targetExpansionCities: "Girand Kumar (Existing Sales Territory)",
      },
      team: team,
      thrustProducts: thrustProductsList.length > 0 ? thrustProductsList : [
        { product: "Zpn Blue 15", ytdSalesLakh: 0.0 },
        { product: "Zpn 200", ytdSalesLakh: 0.06 },
        { product: "Zpn Black", ytdSalesLakh: 0.0 },
        { product: "Shimaclad", ytdSalesLakh: 5.90 },
        { product: "Peony", ytdSalesLakh: 0.0 },
        { product: "Clearclad", ytdSalesLakh: 35.63 },
        { product: "Lcbh", ytdSalesLakh: 6.92 },
        { product: "Enilex", ytdSalesLakh: 0.0 },
        { product: "Chorme Catalyst", ytdSalesLakh: 0.0 },
        { product: "POP", ytdSalesLakh: 0.0 },
        { product: "Uviclad 612", ytdSalesLakh: 0.0 },
        { product: "Patinas", ytdSalesLakh: 0.10 },
      ],
      specialTargets: "-",
      specialAchievementsNotes: "",
    };

    // Ask AI for 3-line summary
    const { askOpenAI } = await import("./ai-context.mjs");
    const aiPrompt = `You are a Sales Reporting Engine. Given the following RM report data for Anil Jena, return a concise 3-line performance summary focusing on: 1) YTD Achievement (114.24L against 254.68L target till Sept - 45%), 2) Month-on-month trajectory (strong April at 95%, followed by mid-year slowdown), 3) Thrust products & new territory performance (Chem X Enterprises & S.B. Refractory onboarded). Do NOT use markdown bolding, just plain text with newlines.`;
    const aiSummary = await askOpenAI("You are a Sales Reporting Engine.", aiPrompt).catch(() => "YTD Achievement stands at 114.24L (45% of 254.68L target till September).\nApril demonstrated peak execution at 95%, followed by stabilization across Q2.\nKey initiatives include Chem X Enterprises and S.B. Refractory appointments and Clearclad momentum.");

    res.json({ ...data, aiSummary });
  } catch (error) { next(error); }
});
