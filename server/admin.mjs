import { reminderSummary } from "./reminder-summary.mjs";
import { createReportAutomationRouter } from "./report-automation.mjs";
import { aiLimiter, askAiHandler } from "./ai-answer.mjs";
import { Router } from "express";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { authenticate, passwordHash, requireRole } from "./auth.mjs";
import { db, transaction } from "./db.mjs";
import { tally } from "./tally/connector.mjs";
import { attendanceRevision } from "./attendance-revision.mjs";
import { indiaBusinessDate } from "./field-activity.mjs";
import { isBusinessDate } from "../shared/business-date.mjs";
import { buildRmDirectory, isNonPersonRm, normalizeName, resolveRmId } from "./rm-directory.mjs";
import { authoritativeInvoiceWhere, netInvoiceAmount, netInvoiceLineAmount } from "./tally/metrics.mjs";
import { issueAccountToken } from "./auth-tokens.mjs";
import { buildRmManagementInsights, calculateDealerConcentration, calculatePeriodPerformance, classifyDealerIntelligence, classifyPlannedVisits, dedupeManagementActions, rmReportThresholds, tallySyncNeedsReview } from "./rm-report-intelligence.mjs";

const LAKH = 100000;
const today = () => indiaBusinessDate();
const pairingCodeHash = (code) => createHash("sha256").update(code).digest("hex");

function connectorState() {
  const connector = db.prepare(`
    SELECT id, machine_name machineName, tally_company tallyCompany,
           tally_version tallyVersion, status, paired_at pairedAt,
           last_heartbeat_at lastHeartbeatAt, last_sync_at lastSyncAt,
           tally_available tallyAvailable, agent_version agentVersion,
           installation_id installationId, company_guid companyGuid
    FROM tally_connectors
    WHERE revoked_at IS NULL
    ORDER BY paired_at DESC LIMIT 1
  `).get() ?? null;
  if (connector) {
    const lastSeen = connector.lastHeartbeatAt ? new Date(connector.lastHeartbeatAt).getTime() : 0;
    connector.status = lastSeen && Date.now() - lastSeen < 3 * 60 * 1000 ? "online" : connector.lastHeartbeatAt ? "offline" : "paired";
    connector.tallyAvailable = Boolean(connector.tallyAvailable);
  }
  const pairing = db.prepare(`
    SELECT id, code_hint codeHint, created_at createdAt, expires_at expiresAt
    FROM tally_connector_pairing_codes
    WHERE used_at IS NULL AND revoked_at IS NULL AND expires_at > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `).get() ?? null;
  return { connector, pairing };
}

/* --------------------------------- periods -------------------------------- */

/** "2024-07" -> "2024-25" (Indian financial year, April to March). */
function financialYearOf(period) {
  const [year, month] = String(period).split("-").map(Number);
  if (!year || !month) return null;
  const startYear = month >= 4 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

function periodsInFinancialYear(financialYear) {
  const startYear = Number(String(financialYear).split("-")[0]);
  const periods = [];
  for (let offset = 0; offset < 12; offset += 1) {
    const month = 4 + offset;
    const year = month > 12 ? startYear + 1 : startYear;
    periods.push(`${year}-${String(month > 12 ? month - 12 : month).padStart(2, "0")}`);
  }
  return periods;
}

/** Financial years that actually carry data, newest first. */
function availableFinancialYears() {
  const years = new Set(db.prepare("SELECT DISTINCT financial_year fy FROM tally_rm_product_sales").all().map((row) => row.fy));
  for (const row of db.prepare("SELECT DISTINCT substr(invoice_date,1,7) period FROM tally_invoices WHERE ingest_session_id IS NULL").all()) {
    const fy = financialYearOf(row.period);
    if (fy) years.add(fy);
  }
  for (const row of db.prepare("SELECT DISTINCT period FROM tally_rm_targets").all()) {
    const fy = financialYearOf(row.period);
    if (fy) years.add(fy);
  }
  return [...years].filter(Boolean).sort().reverse();
}

function currentFinancialYear() {
  return financialYearOf(today().slice(0, 7));
}

function resolveFinancialYear(requested) {
  const years = availableFinancialYears();
  if (requested && years.includes(requested)) return requested;
  return years[0] ?? currentFinancialYear();
}

function targetMonthsFor(financialYear) {
  const current = currentFinancialYear();
  if (financialYear < current) return 12;
  if (financialYear > current) return 0;
  const month = new Date().getMonth() + 1;
  return month >= 4 ? month - 3 : month + 9;
}

/* ------------------------------ team reporting ----------------------------- */

export function calculateAllThrustProductsBatch() {
  const thrustList = db.prepare("SELECT id, name, alias_keywords, sort_order FROM thrust_products WHERE active = 1 ORDER BY sort_order ASC").all();

  function makeSqlLikeRegex(pattern) {
    const p = pattern.trim();
    const rx = "^" + p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\%/g, ".*").replace(/_/g, ".") + "$";
    return new RegExp(rx, "i");
  }

  const thrustMatchers = thrustList.map((tp) => ({
    tp,
    regexes: tp.alias_keywords.split("|").map((p) => makeSqlLikeRegex(p)),
  }));

  const invoiceLines = db.prepare(`
    SELECT c.rm_name, l.product_name, SUM(${netInvoiceLineAmount("i","l")}) as amount, SUM(l.quantity) as qty
    FROM tally_invoice_lines l
    JOIN tally_invoices i ON i.id = l.invoice_id
    JOIN tally_customers c ON c.id = i.customer_id
    WHERE ${authoritativeInvoiceWhere("i")} AND c.rm_name IS NOT NULL
    GROUP BY c.rm_name, l.product_name
  `).all();

  const productToThrust = new Map();
  function classify(p) {
    if (!p) return [];
    if (productToThrust.has(p)) return productToThrust.get(p);
    const matched = [];
    for (const { tp, regexes } of thrustMatchers) {
      if (regexes.some((r) => r.test(p))) matched.push(tp.id);
    }
    productToThrust.set(p, matched);
    return matched;
  }

  const invThrustByRm = new Map();
  for (const r of invoiceLines) {
    const tIds = classify(r.product_name);
    if (!tIds.length) continue;
    if (!invThrustByRm.has(r.rm_name)) invThrustByRm.set(r.rm_name, new Map());
    const rmMap = invThrustByRm.get(r.rm_name);
    for (const tid of tIds) {
      if (!rmMap.has(tid)) rmMap.set(tid, { sales: 0, qty: 0 });
      const cur = rmMap.get(tid);
      cur.sales += r.amount || 0;
      cur.qty += r.qty || 0;
    }
  }

  return {
    getForNames: (allNames) => {
      let totalSalesRupees = 0;
      const products = thrustList.map((tp) => {
        let salesVal = 0;
        let qtyVal = 0;

        for (const name of allNames) {
          const invM = invThrustByRm.get(name);
          if (invM && invM.has(tp.id)) {
            salesVal += invM.get(tp.id).sales;
            qtyVal += invM.get(tp.id).qty;
          }
        }

        const ytdSalesLakh = Number((salesVal / 100000).toFixed(2));
        totalSalesRupees += salesVal;

        return {
          id: tp.id,
          name: tp.name,
          ytdSalesLakh,
          salesRupees: salesVal,
          quantitySold: qtyVal,
          isSold: salesVal > 0,
        };
      });

      const totalYtdLakh = Number((totalSalesRupees / 100000).toFixed(2));
      const activeCount = products.filter((p) => p.isSold).length;

      return {
        products,
        totalYtdLakh,
        totalSalesRupees,
        activeCount,
        totalCount: products.length,
      };
    },
  };
}

export function calculateThrustProductsForNames(allNames, from, to) {
  const thrustList = db.prepare("SELECT id, name, alias_keywords FROM thrust_products WHERE active = 1 ORDER BY sort_order ASC").all();
  const namePlaceholders = allNames.map(() => "?").join(",");

  let totalSalesRupees = 0;
  const products = thrustList.map((tp) => {
    const patterns = tp.alias_keywords.split("|").map((p) => p.trim());
    const likeClauses = patterns.map(() => "l.product_name LIKE ?").join(" OR ");
    
    let lineRow = null;
    if (from && to) {
      lineRow = db.prepare(`
        SELECT COALESCE(SUM(${netInvoiceLineAmount("i","l")}), 0) amount, COALESCE(SUM(l.quantity), 0) qty
        FROM tally_invoice_lines l
        JOIN tally_invoices i ON i.id = l.invoice_id
        JOIN tally_customers c ON c.id = i.customer_id
        WHERE ${authoritativeInvoiceWhere("i")}
          AND c.rm_name IN (${namePlaceholders})
          AND (${likeClauses})
          AND (i.invoice_date BETWEEN ? AND ?)
      `).get(...allNames, ...patterns, from, to);
    } else {
      lineRow = db.prepare(`
        SELECT COALESCE(SUM(${netInvoiceLineAmount("i","l")}), 0) amount, COALESCE(SUM(l.quantity), 0) qty
        FROM tally_invoice_lines l
        JOIN tally_invoices i ON i.id = l.invoice_id
        JOIN tally_customers c ON c.id = i.customer_id
        WHERE ${authoritativeInvoiceWhere("i")}
          AND c.rm_name IN (${namePlaceholders})
          AND (${likeClauses})
      `).get(...allNames, ...patterns);
    }

    let salesVal = lineRow?.amount || 0;
    let qtyVal = lineRow?.qty || 0;

    const ytdSalesLakh = Number((salesVal / 100000).toFixed(2));
    totalSalesRupees += salesVal;

    return {
      id: tp.id,
      name: tp.name,
      ytdSalesLakh,
      salesRupees: salesVal,
      quantitySold: qtyVal,
      isSold: salesVal > 0,
    };
  });

  const totalYtdLakh = Number((totalSalesRupees / 100000).toFixed(2));
  const activeCount = products.filter((p) => p.isSold).length;

  return {
    products,
    totalYtdLakh,
    totalSalesRupees,
    activeCount,
    totalCount: products.length,
  };
}

function buildTeam(financialYear) {
  const targetMonths = targetMonthsFor(financialYear);
  const directory = buildRmDirectory();
  const index = new Map(directory.map((rm) => [rm.id, {
    id: rm.id,
    name: rm.name,
    aliases: rm.aliases,
    sources: rm.sources,
    targetValue: 0,
    monthlyTargetValue: 0,
    salesValue: 0,
    previousSalesValue: 0,
    customerCount: 0,
    outstanding: 0,
    salespeopleCount: 0,
    topProduct: null,
    visitsTotal: 0,
    visitsCompleted: 0,
    followUpsOpen: 0,
    checkedInToday: false,
  }]));

  const periods = new Set(periodsInFinancialYear(financialYear));
  for (const row of db.prepare("SELECT rm_name, period, target_lakh FROM tally_rm_targets").all()) {
    if (!periods.has(row.period)) continue;
    const entry = index.get(resolveRmId(directory, row.rm_name));
    if (entry) entry.targetValue += (row.target_lakh ?? 0) * LAKH;
  }

  const previousYear = `${Number(financialYear.split("-")[0]) - 1}-${String(Number(financialYear.split("-")[0]) % 100).padStart(2, "0")}`;
  const ownerToRm = new Map();
  const crmOwners = db.prepare(`SELECT u.id,u.role,p.full_name,p.manager_user_id,manager.full_name manager_name
    FROM users u JOIN salesperson_profiles p ON p.user_id=u.id
    LEFT JOIN salesperson_profiles manager ON manager.user_id=p.manager_user_id WHERE u.active=1`).all();
  for (const owner of crmOwners) {
    const rmName = owner.role === "rm" ? owner.full_name : owner.manager_name;
    const rmId = rmName ? resolveRmId(directory, rmName) : null;
    if (rmId) ownerToRm.set(owner.id, rmId);
  }

  const liveSales = db.prepare(`
    SELECT i.invoice_date, ${netInvoiceAmount("i")} amount, c.owner_user_id ownerUserId
    FROM tally_invoices i
    LEFT JOIN tally_customers c ON c.id=i.customer_id
    WHERE ${authoritativeInvoiceWhere("i")}
  `).all();
  let unassignedSalesValue = 0;
  let liveInvoiceCount = 0;
  for (const row of liveSales) {
    const rowYear = financialYearOf(String(row.invoice_date).slice(0, 7));
    if (rowYear !== financialYear && rowYear !== previousYear) continue;
    const entry = index.get(ownerToRm.get(row.ownerUserId));
    if (rowYear === financialYear) liveInvoiceCount += 1;
    if (!entry) {
      if (rowYear === financialYear) unassignedSalesValue += row.amount ?? 0;
      continue;
    }
    if (rowYear === financialYear) entry.salesValue += row.amount ?? 0;
    else entry.previousSalesValue += row.amount ?? 0;
  }

  const startYear = Number(financialYear.split("-")[0]);
  const liveTopProducts = db.prepare(`
    SELECT CASE WHEN owner_user.role='rm' THEN owner.full_name ELSE manager.full_name END rm_name, l.product_name, SUM(${netInvoiceLineAmount("i","l")}) sales_value, SUM(l.quantity) quantity
    FROM tally_invoice_lines l
    JOIN tally_invoices i ON i.id=l.invoice_id
    JOIN tally_customers c ON c.id=i.customer_id
    LEFT JOIN users owner_user ON owner_user.id=c.owner_user_id AND owner_user.active=1
    LEFT JOIN salesperson_profiles owner ON owner.user_id=c.owner_user_id
    LEFT JOIN salesperson_profiles manager ON manager.user_id=owner.manager_user_id
    WHERE ${authoritativeInvoiceWhere("i")} AND i.invoice_date>=? AND i.invoice_date<?
    GROUP BY c.rm_name, l.product_name
    ORDER BY sales_value DESC
  `).all(`${startYear}-04-01`, `${startYear + 1}-04-01`);
  for (const row of liveTopProducts) {
    const id = resolveRmId(directory, row.rm_name);
    const entry = index.get(id);
    if (!entry || entry.topProduct) continue;
    entry.topProduct = { name: row.product_name, salesValue: row.sales_value ?? 0, quantity: row.quantity ?? 0 };
  }

  let unassignedCustomers = 0;
  for (const row of db.prepare("SELECT owner_user_id, outstanding FROM tally_customers").all()) {
    const entry = index.get(ownerToRm.get(row.owner_user_id));
    if (!entry) { unassignedCustomers += 1; continue; }
    entry.customerCount += 1;
    entry.outstanding += row.outstanding ?? 0;
  }

  for (const row of db.prepare("SELECT rm_name FROM tally_salespeople").all()) {
    const entry = index.get(resolveRmId(directory, row.rm_name));
    if (entry) entry.salespeopleCount += 1;
  }

  const crmUsers = db.prepare("SELECT u.id, u.email, u.role, u.active, p.full_name, p.monthly_target FROM users u LEFT JOIN salesperson_profiles p ON p.user_id=u.id").all();
  const activityByUser = new Map(db.prepare(`
    SELECT u.id,
      (SELECT COUNT(*) FROM visits v WHERE v.user_id=u.id) visits_total,
      (SELECT COUNT(*) FROM visits v WHERE v.user_id=u.id AND v.status='completed') visits_completed,
      (SELECT COUNT(*) FROM follow_ups f WHERE f.user_id=u.id AND f.completed=0) follow_ups_open,
      EXISTS(SELECT 1 FROM attendance a WHERE a.user_id=u.id AND a.business_date=?) checked_in_today,
      (SELECT a.check_in_at FROM attendance a WHERE a.user_id=u.id AND a.business_date=? ORDER BY a.check_in_at DESC LIMIT 1) check_in_at,
      (SELECT a.check_out_at FROM attendance a WHERE a.user_id=u.id AND a.business_date=? ORDER BY a.check_in_at DESC LIMIT 1) check_out_at
    FROM users u
  `).all(today(), today(), today()).map((row) => [row.id, row]));

  const thrustBatch = calculateAllThrustProductsBatch();

  const members = [...index.values()].map((entry) => {
    const rmUser = crmUsers.find((user) => user.role === "rm" && user.full_name && resolveRmId(directory, user.full_name) === entry.id);
    const linked = rmUser || crmUsers.find((user) => user.full_name && resolveRmId(directory, user.full_name) === entry.id);
    const monthlyTargetValue = entry.targetValue > 0
      ? Math.round(entry.targetValue / Math.max(1, targetMonths))
      : 0;
    const activity = linked ? activityByUser.get(linked.id) : null;

    // Compute thrust product sales for this RM
    const thrustData = thrustBatch.getForNames([entry.name, ...entry.aliases]);
    const thrustSalesValue = thrustData.totalSalesRupees;
    const thrustSalesLakh = thrustData.totalYtdLakh;
    const thrustActiveCount = thrustData.activeCount;
    const thrustTopProduct = thrustData.products.find((p) => p.isSold)?.name || null;

    return {
      ...entry,
      monthlyTargetValue,
      visitsTotal: activity?.visits_total ?? 0,
      visitsCompleted: activity?.visits_completed ?? 0,
      followUpsOpen: activity?.follow_ups_open ?? 0,
      checkedInToday: Boolean(activity?.checked_in_today),
      checkInAt: activity?.check_in_at ?? null,
      checkOutAt: activity?.check_out_at ?? null,
      achievementPercent: entry.targetValue > 0 ? Math.round((entry.salesValue / entry.targetValue) * 100) : null,
      growthPercent: entry.previousSalesValue > 0 ? Math.round(((entry.salesValue - entry.previousSalesValue) / entry.previousSalesValue) * 100) : null,
      crmUser: linked ? { id: linked.id, email: linked.email, role: linked.role, active: Boolean(linked.active) } : null,
      thrustSalesValue,
      thrustSalesLakh,
      thrustActiveCount,
      thrustTopProduct,
    };
  }).sort((a, b) => b.salesValue - a.salesValue);

  const thrustLeaderboard = [...members]
    .filter((m) => m.thrustSalesValue > 0 || m.thrustActiveCount > 0)
    .sort((a, b) => b.thrustSalesValue - a.thrustSalesValue)
    .map((m) => ({
      id: m.id,
      name: m.name,
      region: m.region,
      thrustSalesLakh: m.thrustSalesLakh,
      thrustSalesValue: m.thrustSalesValue,
      thrustActiveCount: m.thrustActiveCount,
      thrustTopProduct: m.thrustTopProduct,
    }));

  return { financialYear, targetMonths, members, thrustLeaderboard, unassignedCustomers, unassignedSalesValue, liveInvoiceCount, hasTargets: members.some((member) => member.targetValue > 0) };
}

/* ---------------------------------- routes --------------------------------- */

export const adminRouter = Router();
adminRouter.use(authenticate, requireRole("admin"));
adminRouter.get("/attendance/revision", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ revision: attendanceRevision(db, today()) });
});
adminRouter.use((req, res, next) => {
  if (!["POST", "PATCH", "DELETE"].includes(req.method)) return next();
  const startedAt = new Date().toISOString();
  const auditPath = req.path;
  res.on("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 400) return;
    let safeBody = { ...req.body };
    if (auditPath === "/ask-ai") safeBody = { questionLength: typeof req.body?.question === "string" ? req.body.question.length : 0, from: req.body?.from, to: req.body?.to };
    if (auditPath.startsWith("/report-automation")) safeBody = Object.fromEntries(["recipientUserId", "cadence", "sendTime", "templateName", "language", "optedIn", "templateApproved", "enabled"].filter(key => key in (req.body ?? {})).map(key => [key, req.body[key]]));
    for (const key of ["password", "token", "pairingCode"]) if (key in safeBody) safeBody[key] = "[redacted]";
    try {
      db.prepare("INSERT INTO audit_logs (id,user_id,user_email,action,path,entity_id,status_code,details_json,ip_address,user_agent,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(randomUUID(), req.user.id, req.user.email, `${req.method} ${req.path}`, req.originalUrl, req.params?.id ?? null, res.statusCode, JSON.stringify(safeBody), req.ip ?? null, String(req.headers["user-agent"] ?? "").slice(0, 500), startedAt);
    } catch (error) { console.error("[audit] Unable to store admin action", error); }
  });
  next();
});

adminRouter.get("/audit", (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const items = db.prepare("SELECT id,user_email userEmail,action,path,entity_id entityId,status_code statusCode,details_json detailsJson,ip_address ipAddress,user_agent userAgent,created_at createdAt FROM audit_logs ORDER BY created_at DESC LIMIT ?").all(limit).map((row) => { let details = {}; try { details = JSON.parse(row.detailsJson || "{}"); } catch {} return { ...row, details, detailsJson: undefined }; });
    res.json({ items });
  } catch (error) { next(error); }
});

adminRouter.use("/report-automation", createReportAutomationRouter(db));

adminRouter.get("/overview", async (req, res, next) => {
  try {
    const financialYear = resolveFinancialYear(req.query.fy);
    const team = financialYear ? buildTeam(financialYear) : { members: [], hasTargets: false, unassignedCustomers: 0 };
    const startYear = Number(financialYear.split("-")[0]);
    const periodStart = `${startYear}-04-01`;
    const periodEnd = financialYear === currentFinancialYear() ? today() : `${startYear + 1}-03-31`;
    const customers = db.prepare("SELECT COUNT(*) count, COALESCE(SUM(total_sales),0) sales, COALESCE(SUM(outstanding),0) outstanding FROM tally_customers").get();
    const products = db.prepare("SELECT COUNT(*) count, COALESCE(SUM(total_value),0) value FROM tally_products").get();
    const users = db.prepare("SELECT COUNT(*) total, COALESCE(SUM(active),0) active, COALESCE(SUM(CASE WHEN role='admin' THEN 1 ELSE 0 END),0) admins, COALESCE(SUM(CASE WHEN role='rm' THEN 1 ELSE 0 END),0) rms, COALESCE(SUM(CASE WHEN role='salesperson' THEN 1 ELSE 0 END),0) salespeople FROM users").get();
    const visits = db.prepare("SELECT COUNT(*) total, COALESCE(SUM(CASE WHEN business_date=? THEN 1 ELSE 0 END),0) todayCount, COALESCE(SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END),0) completed FROM visits").get(today());
    const followUps = db.prepare("SELECT COUNT(*) total, COALESCE(SUM(CASE WHEN completed=0 THEN 1 ELSE 0 END),0) open FROM follow_ups").get();
    const attendance = db.prepare("SELECT COUNT(*) count FROM attendance WHERE business_date=?").get(today());
    // Only 'Receipt' vouchers are money coming in; Bank Payment / Payment are outgoing.
    const receipts = db.prepare("SELECT COUNT(*) count, COALESCE(SUM(amount),0) value FROM tally_payments_live WHERE ingest_session_id IS NULL AND payment_type='Receipt' AND payment_date BETWEEN ? AND ?").get(periodStart, periodEnd);
    const monthlySales = db.prepare(`SELECT substr(i.invoice_date,1,7) period,COALESCE(SUM(${netInvoiceAmount("i")}),0) salesValue,COUNT(*) invoiceCount FROM tally_invoices i WHERE ${authoritativeInvoiceWhere("i")} AND i.invoice_date BETWEEN ? AND ? GROUP BY substr(i.invoice_date,1,7) ORDER BY period`).all(periodStart, periodEnd);
    const productSales = db.prepare(`SELECT l.product_name name,COALESCE(SUM(${netInvoiceLineAmount("i","l")}),0) salesValue,COALESCE(SUM(l.quantity),0) quantity FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id WHERE ${authoritativeInvoiceWhere("i")} AND i.invoice_date BETWEEN ? AND ? GROUP BY l.product_name ORDER BY salesValue DESC LIMIT 6`).all(periodStart, periodEnd);
    const territorySales = db.prepare(`SELECT COALESCE(NULLIF(p.region,''),NULLIF(c.rm_name,''),'Unassigned') name,COALESCE(SUM(${netInvoiceAmount("i")}),0) salesValue,COUNT(DISTINCT i.customer_id) customerCount FROM tally_invoices i LEFT JOIN tally_customers c ON c.id=i.customer_id LEFT JOIN salesperson_profiles p ON p.user_id=c.owner_user_id WHERE ${authoritativeInvoiceWhere("i")} AND i.invoice_date BETWEEN ? AND ? GROUP BY COALESCE(NULLIF(p.region,''),NULLIF(c.rm_name,''),'Unassigned') ORDER BY salesValue DESC LIMIT 6`).all(periodStart, periodEnd);
    const salespersonLocations = db.prepare(`SELECT u.id userId,u.email,COALESCE(p.full_name,u.email) fullName,p.region,p.territory,a.check_in_at checkInAt,a.check_out_at checkOutAt,COALESCE((SELECT lp.latitude FROM location_pings lp WHERE lp.user_id=u.id AND date(lp.captured_at)=? ORDER BY lp.captured_at DESC LIMIT 1),a.latitude) latitude,COALESCE((SELECT lp.longitude FROM location_pings lp WHERE lp.user_id=u.id AND date(lp.captured_at)=? ORDER BY lp.captured_at DESC LIMIT 1),a.longitude) longitude,COALESCE((SELECT lp.captured_at FROM location_pings lp WHERE lp.user_id=u.id AND date(lp.captured_at)=? ORDER BY lp.captured_at DESC LIMIT 1),a.check_in_at) lastLocationAt FROM users u LEFT JOIN salesperson_profiles p ON p.user_id=u.id LEFT JOIN attendance a ON a.user_id=u.id AND a.business_date=? WHERE u.active=1 AND u.role IN ('salesperson', 'rm') ORDER BY p.full_name,u.email`).all(today(), today(), today(), today());

    res.json({
      financialYear,
      financialYears: availableFinancialYears(),
      sales: {
        actual: team.members.reduce((sum, member) => sum + member.salesValue, 0) + (team.unassignedSalesValue ?? 0),
        target: team.members.reduce((sum, member) => sum + member.targetValue, 0),
        hasTargets: team.hasTargets,
        rmCount: team.members.length,
      },
      customers: { count: customers.count, lifetimeSales: customers.sales, outstanding: customers.outstanding, unassigned: team.unassignedCustomers },
      collections: { receiptCount: receipts.count, receiptValue: receipts.value },
      products: { count: products.count, lifetimeValue: products.value },
      users,
      fieldActivity: { visitsTotal: visits.total, visitsToday: visits.todayCount, visitsCompleted: visits.completed, followUpsTotal: followUps.total, followUpsOpen: followUps.open, checkedInToday: attendance.count },
      charts: {
        periodStart,
        periodEnd,
        monthlySales,
        productSales,
        territorySales,
        teamPerformance: team.members.slice(0, 6).map((member) => ({ name: member.name, salesValue: member.salesValue, targetValue: member.targetValue, achievementPercent: member.achievementPercent })),
        salespersonLocations,
      },
      tally: await tally.status(),
    });
  } catch (error) { next(error); }
});

adminRouter.get("/team", (req, res, next) => {
  try {
    const financialYear = resolveFinancialYear(req.query.fy);
    const financialYears = availableFinancialYears();
    res.json({ ...buildTeam(financialYear), financialYears: financialYears.length ? financialYears : [financialYear] });
  } catch (error) { next(error); }
});

/* ----------------------- RM sales activity detail ------------------------- */

adminRouter.get("/team/:id", (req, res, next) => {
  try {
    const rmId = decodeURIComponent(req.params.id);
    const todayStr = today();

    // Default period: first day of current month → today
    const defaultFrom = `${todayStr.slice(0, 7)}-01`;
    const from = req.query.from || defaultFrom;
    const to = req.query.to || todayStr;
    const requestedFy = req.query.fy;

    // Resolve RM from directory
    const directory = buildRmDirectory();
    const rm = directory.find((entry) => entry.id === rmId || (entry.keys && entry.keys.includes(rmId)));
    if (!rm) return res.status(404).json({ error: "RM not found" });

    // All name aliases for Tally customer matching
    const allNames = [rm.name, ...rm.aliases];
    const nameList = allNames.map(() => "?").join(",");

    // Find all linked CRM users (salesperson/rm accounts and subordinates)
    const canonicalRmId = rm.id;
    const crmUsers = db.prepare(`
      SELECT u.id, u.email, u.role, p.employee_code, p.full_name, p.region, p.territory, p.operating_city, p.monthly_target, p.manager_user_id
      FROM users u JOIN salesperson_profiles p ON p.user_id = u.id
      WHERE u.active = 1
      ORDER BY p.full_name
    `).all();
    const matchedUsers = crmUsers.filter((user) => user.full_name && (resolveRmId(directory, user.full_name) === canonicalRmId || resolveRmId(directory, user.full_name) === rmId));
    const matchingRmUsers = matchedUsers.filter((user) => user.role === "rm");
    const crmUser = matchingRmUsers.length === 1 ? matchingRmUsers[0] : null;
    const linkedUserIds = crmUser
      ? [crmUser.id, ...crmUsers.filter((user) => user.role === "salesperson" && user.manager_user_id === crmUser.id).map((user) => user.id)]
      : [];
    const userPlaceholders = linkedUserIds.length ? linkedUserIds.map(() => "?").join(",") : "''";
    const ownershipMapping = matchingRmUsers.length === 1 ? "verified" : matchingRmUsers.length === 0 ? "unmapped" : "ambiguous";

    // Detect latest active invoice date in database for this RM
    const maxDateRow = db.prepare(`
      SELECT MAX(i.invoice_date) maxDate
      FROM tally_invoices i
      JOIN tally_customers c ON c.id = i.customer_id
      WHERE i.ingest_session_id IS NULL AND (i.source_sync_id IS NULL OR i.source_sync_id <> 'excel-import') AND c.rm_name IN (${nameList})
    `).get(...allNames);
    const latestActiveDate = maxDateRow?.maxDate || todayStr;
    const latestActiveMonth = latestActiveDate.slice(0, 7);

    let effectiveFrom = from;
    let effectiveTo = to;
    let isAnchoredToLatestCycle = false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveTo) || effectiveFrom > effectiveTo) return res.status(400).json({ error: "Choose a valid report date range" });
    const diffDays = Math.max(1, Math.floor((Date.parse(`${effectiveTo}T00:00:00Z`) - Date.parse(`${effectiveFrom}T00:00:00Z`)) / 86400000) + 1);

    // KPI: visits (match by RM customers or any linked RM/salesperson user)
    const visitsKpi = db.prepare(`
      SELECT
        COUNT(*) visitsTotal,
        SUM(CASE WHEN v.status='completed' THEN 1 ELSE 0 END) visitsCompleted,
        COUNT(DISTINCT CASE WHEN v.status='completed' THEN v.tally_customer_id END) customersCovered
      FROM visits v
      WHERE v.user_id IN (${userPlaceholders})
        AND v.business_date BETWEEN ? AND ?
    `).get(...linkedUserIds, from, to);
    const callsLogged = db.prepare(`SELECT COUNT(*) count FROM customer_activities WHERE user_id IN (${userPlaceholders}) AND activity_type IN ('call','call_incoming','call_outgoing') AND date(occurred_at,'+5 hours','+30 minutes') BETWEEN ? AND ?`).get(...linkedUserIds, from, to).count;

    // KPI: expected orders (open)
    const pipelineKpi = db.prepare(`
      SELECT
        COALESCE(SUM(expected_value),0) expectedValue,
        SUM(CASE WHEN expected_date IS NOT NULL AND expected_date < ? THEN 1 ELSE 0 END) overdue
      FROM expected_orders
      WHERE user_id IN (${userPlaceholders})
        AND status = 'open'
    `).get(todayStr, ...linkedUserIds);

    // KPI: follow-ups
    const followUpKpi = db.prepare(`
      SELECT
        SUM(CASE WHEN completed=0 THEN 1 ELSE 0 END) open,
        SUM(CASE WHEN completed=0 AND due_date IS NOT NULL AND due_date < ? THEN 1 ELSE 0 END) overdue
      FROM follow_ups
      WHERE user_id IN (${userPlaceholders})
    `).get(todayStr, ...linkedUserIds);

    // KPI: actual Tally sales
    let actualSalesVal = linkedUserIds.length ? db.prepare(`
      SELECT COALESCE(SUM(${netInvoiceAmount("i")}),0) salesValue
      FROM tally_invoices i
      JOIN tally_customers c ON c.id = i.customer_id
      WHERE ${authoritativeInvoiceWhere("i")}
        AND i.invoice_date BETWEEN ? AND ?
        AND c.owner_user_id IN (${userPlaceholders})
    `).get(effectiveFrom, effectiveTo, ...linkedUserIds).salesValue : null;

    // Keep the requested dates and live invoice source stable. Workbook RM
    // aggregates remain stored but are not substituted for missing Tally rows.

    // Target calculation: check tally_rm_targets first for the period
    const fromMonth = effectiveFrom.slice(0, 7);
    const toMonth = effectiveTo.slice(0, 7);
    const reportMonthStart = `${effectiveTo.slice(0, 7)}-01`;
    const reportYear = Number(effectiveTo.slice(0, 4)) - (Number(effectiveTo.slice(5, 7)) < 4 ? 1 : 0);
    const reportFyStart = `${reportYear}-04-01`;
    const monthlySalesValue = linkedUserIds.length ? db.prepare(`SELECT COALESCE(SUM(${netInvoiceAmount("i")}),0) value FROM tally_invoices i JOIN tally_customers c ON c.id=i.customer_id WHERE ${authoritativeInvoiceWhere("i")} AND c.owner_user_id IN (${userPlaceholders}) AND i.invoice_date BETWEEN ? AND ?`).get(...linkedUserIds, reportMonthStart, effectiveTo).value : null;
    const ytdSalesValue = linkedUserIds.length ? db.prepare(`SELECT COALESCE(SUM(${netInvoiceAmount("i")}),0) value FROM tally_invoices i JOIN tally_customers c ON c.id=i.customer_id WHERE ${authoritativeInvoiceWhere("i")} AND c.owner_user_id IN (${userPlaceholders}) AND i.invoice_date BETWEEN ? AND ?`).get(...linkedUserIds, reportFyStart, effectiveTo).value : null;
    const periodTargetRow = db.prepare(`SELECT COALESCE(SUM(target_lakh * 100000),0) value FROM tally_rm_targets WHERE rm_name IN (${nameList}) AND period=?`).get(...allNames, effectiveTo.slice(0, 7));
    const ytdTargetRow = db.prepare(`SELECT COALESCE(SUM(target_lakh * 100000),0) value FROM tally_rm_targets WHERE rm_name IN (${nameList}) AND period>=? AND period<=?`).get(...allNames, reportFyStart.slice(0, 7), effectiveTo.slice(0, 7));
    const monthlyPerformance = calculatePeriodPerformance(monthlySalesValue, periodTargetRow?.value, reportMonthStart, effectiveTo, "month-to-date");
    const ytdPerformance = calculatePeriodPerformance(ytdSalesValue, ytdTargetRow?.value, reportFyStart, effectiveTo, "FYTD");
    const isMonthToDate = effectiveFrom === reportMonthStart && effectiveTo === todayStr;
    const isFyToDate = effectiveFrom === reportFyStart && effectiveTo === todayStr;
    const targetValue = isMonthToDate ? monthlyPerformance.target : isFyToDate ? ytdPerformance.target : null;
    const achievementPercent = isMonthToDate ? monthlyPerformance.achievementPercent : isFyToDate ? ytdPerformance.achievementPercent : null;
    const monthlyTarget = monthlyPerformance.target;

    // Daily activity breakdown
    const dailyActivity = db.prepare(`
      SELECT v.business_date date,COUNT(*) visitsCount,
        COUNT(DISTINCT CASE WHEN v.status='completed' THEN v.tally_customer_id END) customersCount
      FROM visits v WHERE v.user_id IN (${userPlaceholders}) AND v.business_date BETWEEN ? AND ?
      GROUP BY v.business_date ORDER BY v.business_date DESC LIMIT 31
    `).all(...linkedUserIds, effectiveFrom, effectiveTo).map((row) => {
      const daySales = db.prepare(`
        SELECT COALESCE(SUM(${netInvoiceAmount("i")}),0) val FROM tally_invoices i
        JOIN tally_customers c ON c.id=i.customer_id
        WHERE ${authoritativeInvoiceWhere("i")} AND i.invoice_date=? AND c.owner_user_id IN (${userPlaceholders})
      `).get(row.date, ...linkedUserIds);
      const followUpsCount = db.prepare(`SELECT COUNT(*) count FROM follow_ups WHERE user_id IN (${userPlaceholders}) AND date(created_at)=?`).get(...linkedUserIds, row.date).count;
      const expectedValue = db.prepare(`SELECT COALESCE(SUM(expected_value),0) value FROM expected_orders WHERE user_id IN (${userPlaceholders}) AND date(created_at)=?`).get(...linkedUserIds, row.date).value;
      return { ...row, actualValue: daySales.val, followUpsCount, expectedValue };
    });

    // Customer visit log
    const customerVisits = db.prepare(`
      SELECT v.id, v.business_date date, COALESCE(c.name, 'Unknown') customerName,
             v.status, v.purpose, v.outcome, v.notes,
             e.expected_value expectedOrderValue,
             (SELECT f.due_date FROM follow_ups f WHERE f.user_id=v.user_id AND f.tally_customer_id=v.tally_customer_id AND f.completed=0 ORDER BY f.due_date LIMIT 1) nextFollowUpDate
      FROM visits v
      LEFT JOIN tally_customers c ON c.id = v.tally_customer_id
      LEFT JOIN expected_orders e ON e.user_id=v.user_id AND e.tally_customer_id=v.tally_customer_id AND date(e.created_at)=v.business_date AND e.status='open'
      WHERE v.user_id IN (${userPlaceholders})
        AND v.business_date BETWEEN ? AND ?
      ORDER BY v.business_date DESC, v.id DESC LIMIT 50
    `).all(...linkedUserIds, from, to);

    // Pipeline (expected orders)
    const pipeline = db.prepare(`
      SELECT e.id, COALESCE(c.name,'Unknown') customerName,
             tp.name productName,
             e.expected_value expectedValue, e.expected_date expectedDate,
             e.status stage,
             CASE WHEN e.expected_date IS NOT NULL AND e.expected_date < ? THEN 1 ELSE 0 END isOverdue,
             date(e.created_at) lastActivityDate
      FROM expected_orders e
      LEFT JOIN tally_customers c ON c.id = e.tally_customer_id
      LEFT JOIN tally_products tp ON tp.id = e.tally_product_id
      WHERE e.user_id IN (${userPlaceholders})
        AND e.status = 'open'
      ORDER BY isOverdue DESC, e.expected_date ASC LIMIT 50
    `).all(todayStr, ...linkedUserIds).map((row) => ({ ...row, isOverdue: Boolean(row.isOverdue) }));

    // The table is a recent detail window. All KPIs below use complete SQL aggregates.
    let actualSales = db.prepare(`
      SELECT i.id, i.invoice_date invoiceDate, i.voucher_number invoiceNumber,
             COALESCE(c.name, i.customer_name) customerName, ${netInvoiceAmount("i")} amount
      FROM tally_invoices i
      LEFT JOIN tally_customers c ON c.id = i.customer_id
      WHERE ${authoritativeInvoiceWhere("i")} AND i.invoice_date BETWEEN ? AND ?
        AND c.owner_user_id IN (${userPlaceholders})
      ORDER BY i.invoice_date DESC LIMIT 50
    `).all(effectiveFrom, effectiveTo, ...linkedUserIds);

    const rangeDays = Math.max(1, Math.floor((Date.parse(`${effectiveTo}T00:00:00Z`) - Date.parse(`${effectiveFrom}T00:00:00Z`)) / 86400000) + 1);
    const previousTo = new Date(Date.parse(`${effectiveFrom}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
    const previousFrom = new Date(Date.parse(`${previousTo}T00:00:00Z`) - (rangeDays - 1) * 86400000).toISOString().slice(0, 10);
    const thresholds = rmReportThresholds();
    const rmDealerRows = db.prepare(`SELECT c.id,c.name,c.city,
        COALESCE(SUM(CASE WHEN i.invoice_date BETWEEN ? AND ? THEN ${netInvoiceAmount("i")} ELSE 0 END),0) salesValue,
        COUNT(DISTINCT CASE WHEN i.invoice_date BETWEEN ? AND ? THEN i.id END) invoiceCount,
        COALESCE(SUM(CASE WHEN i.invoice_date BETWEEN ? AND ? THEN ${netInvoiceAmount("i")} ELSE 0 END),0) previousSalesValue,
        COUNT(DISTINCT CASE WHEN i.invoice_date BETWEEN ? AND ? THEN i.id END) previousInvoiceCount,
        COUNT(DISTINCT i.id) historyInvoiceCount,MIN(i.invoice_date) firstInvoiceDate,MAX(i.invoice_date) lastInvoiceDate
      FROM tally_customers c LEFT JOIN tally_invoices i ON i.customer_id=c.id AND ${authoritativeInvoiceWhere("i")}
      WHERE c.owner_user_id IN (${userPlaceholders})
      GROUP BY c.id,c.name,c.city`).all(effectiveFrom, effectiveTo, effectiveFrom, effectiveTo, previousFrom, previousTo, previousFrom, previousTo, ...linkedUserIds);
    const dealerIntelligence = classifyDealerIntelligence(rmDealerRows, { periodFrom: effectiveFrom, periodTo: effectiveTo, dormantDays: thresholds.dormantDays });
    const concentration = calculateDealerConcentration(dealerIntelligence, actualSalesVal);
    const topDealers = concentration.topDealers;
    const topFiveDealerRevenue = concentration.topFiveRevenue;
    const topFiveDealerConcentrationPercent = concentration.topFivePercent;
    const activeDealerCount = ownershipMapping === "verified" ? dealerIntelligence.filter((row) => row.invoiceCount > 0).length : null;
    const dormantDealers = dealerIntelligence.filter((row) => row.dormant).sort((a, b) => String(a.lastInvoiceDate).localeCompare(String(b.lastInvoiceDate)));
    const dealersWithNoPeriodSales = dealerIntelligence.filter((row) => row.noSalesInPeriod);
    const insufficientHistoryDealers = dealerIntelligence.filter((row) => row.insufficientHistory);
    const decliningDealers = dealerIntelligence.filter((row) => row.declinePercent != null).sort((a, b) => b.declinePercent - a.declinePercent);

    // Top products
    const prevFrom = (() => { const d = new Date(from); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); })();
    const prevTo = (() => { const d = new Date(to); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); })();
    let productRows = db.prepare(`
        SELECT l.product_name name, COALESCE(SUM(${netInvoiceLineAmount("i","l")}),0) salesValue,
             COUNT(DISTINCT l.invoice_id) invoiceCount
      FROM tally_invoice_lines l
      JOIN tally_invoices i ON i.id = l.invoice_id
      JOIN tally_customers c ON c.id = i.customer_id
      WHERE ${authoritativeInvoiceWhere("i")} AND i.invoice_date BETWEEN ? AND ?
        AND c.owner_user_id IN (${userPlaceholders})
      GROUP BY l.product_name ORDER BY salesValue DESC LIMIT 20
    `).all(from, to, ...linkedUserIds);

    const prevProductRows = db.prepare(`
      SELECT l.product_name name, COALESCE(SUM(${netInvoiceLineAmount("i","l")}),0) salesValue
      FROM tally_invoice_lines l
      JOIN tally_invoices i ON i.id = l.invoice_id
      JOIN tally_customers c ON c.id = i.customer_id
      WHERE ${authoritativeInvoiceWhere("i")} AND i.invoice_date BETWEEN ? AND ?
        AND c.owner_user_id IN (${userPlaceholders})
      GROUP BY l.product_name
    `).all(prevFrom, prevTo, ...linkedUserIds);
    const prevProductMap = new Map(prevProductRows.map((r) => [r.name, r.salesValue]));
    const currentProductMap = new Map(productRows.map((row) => [row.name, row]));
    const topProducts = [...new Set([...productRows.map((row) => row.name), ...prevProductRows.map((row) => row.name)])].map((productName) => {
      const current = currentProductMap.get(productName) ?? { name: productName, salesValue: 0, invoiceCount: 0 };
      const previousSalesValue = prevProductMap.get(productName) ?? 0;
      return { ...current, previousSalesValue, growthPercent: previousSalesValue > 0 ? Math.round(((current.salesValue - previousSalesValue) / previousSalesValue) * 100) : null };
    }).sort((a, b) => b.salesValue - a.salesValue).slice(0, 20);

    const userId = crmUser?.id ?? linkedUserIds[0] ?? null;

    // Follow-ups
    const followUps = db.prepare(`
      SELECT f.id, f.title, f.due_date dueDate, f.priority,
             COALESCE(c.name,'') customerName,
             CASE WHEN f.due_date IS NOT NULL AND f.due_date < ? AND f.completed=0 THEN 1 ELSE 0 END isOverdue
      FROM follow_ups f
      LEFT JOIN tally_customers c ON c.id = f.tally_customer_id
      WHERE f.user_id IN (${userPlaceholders})
        AND f.completed = 0
      ORDER BY isOverdue DESC, f.due_date ASC LIMIT 50
    `).all(todayStr, ...linkedUserIds).map((row) => ({ ...row, isOverdue: Boolean(row.isOverdue) }));
    const visitCompletionPercent = visitsKpi.visitsTotal > 0 ? Math.round((visitsKpi.visitsCompleted / visitsKpi.visitsTotal) * 100) : null;
    const managementInsights = buildRmManagementInsights({
      name: rm.name, period: { from: effectiveFrom, to: effectiveTo }, monthlyPerformance, ytdPerformance,
      topFiveDealerConcentrationPercent, activeDealerCount, dormantCount: dormantDealers.length,
      decliningCount: decliningDealers.length, decliningProductCount: topProducts.filter((product) => product.growthPercent != null && product.growthPercent < 0).length,
      overdueFollowUps: followUpKpi.overdue ?? 0,
      visitCompletionPercent, ownershipMapping, thresholds,
    });

    // Today activity feed
    const todayActivity = db.prepare(`
      SELECT v.started_at time,
             COALESCE(c.name, 'Unknown') customerName,
             v.purpose,
             e.expected_value expectedValue
      FROM visits v
      LEFT JOIN tally_customers c ON c.id = v.tally_customer_id
      LEFT JOIN expected_orders e ON e.user_id=v.user_id AND e.tally_customer_id=v.tally_customer_id AND date(e.created_at)=? AND e.status='open'
      WHERE v.user_id IN (${userPlaceholders})
        AND v.business_date = ?
      ORDER BY v.started_at DESC LIMIT 10
    `).all(todayStr, ...linkedUserIds, todayStr);

    // RM Code
    const spRow = db.prepare(`SELECT code, city FROM tally_salespeople WHERE name IN (${nameList}) AND code IS NOT NULL AND code <> '' LIMIT 1`).get(...allNames);
    const rmCode = crmUser?.employee_code || spRow?.code || `RM-${rmId.toUpperCase()}`;

    // Operating city from RM master profile (e.g. Gurugram from PDF)
    const baseOperatingCity = crmUser?.operating_city?.trim() || spRow?.city?.trim() || crmUser?.territory?.trim() || "Gurugram";
    
    // Dealer territory coverage cities
    const cityRows = db.prepare(`
      SELECT city, COUNT(*) cnt
      FROM tally_customers
      WHERE rm_name IN (${nameList}) AND city IS NOT NULL AND TRIM(city) <> ''
      GROUP BY city
      ORDER BY cnt DESC
      LIMIT 8
    `).all(...allNames);
    const dealerCities = cityRows.map((r) => r.city.trim());

    const operatingCity = baseOperatingCity;
    const operatingCities = [baseOperatingCity];

    // Attendance (clock-in / clock-out) for RM
    const attendanceRow = userId ? db.prepare(`
      SELECT a.check_in_at checkInAt, a.check_out_at checkOutAt, a.business_date businessDate
      FROM attendance a
      WHERE a.user_id = ? AND a.business_date = ?
    `).get(userId, todayStr) : null;
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

    // Monthly target vs actual includes zero-sales months in the trailing year.
    const chartStartDate = new Date(Date.UTC(Number(effectiveTo.slice(0, 4)), Number(effectiveTo.slice(5, 7)) - 12, 1)).toISOString().slice(0, 10);
    const monthlySalesRows = linkedUserIds.length ? db.prepare(`
      SELECT substr(i.invoice_date, 1, 7) month, COALESCE(SUM(${netInvoiceAmount("i")}), 0) actualSales
      FROM tally_invoices i
      JOIN tally_customers c ON c.id = i.customer_id
      WHERE ${authoritativeInvoiceWhere("i")} AND i.invoice_date BETWEEN ? AND ? AND c.owner_user_id IN (${userPlaceholders})
      GROUP BY month
      ORDER BY month
    `).all(chartStartDate, effectiveTo, ...linkedUserIds) : [];

    const monthlyTargetRows = db.prepare(`
      SELECT period month, COALESCE(target_lakh * 100000, 0) targetValue
      FROM tally_rm_targets
      WHERE rm_name IN (${nameList}) AND period BETWEEN ? AND ?
      ORDER BY period ASC
    `).all(...allNames, chartStartDate.slice(0, 7), effectiveTo.slice(0, 7));
    const monthlySalesMap = new Map(monthlySalesRows.map((row) => [row.month, row.actualSales]));
    const targetMap = new Map(monthlyTargetRows.map((r) => [r.month, r.targetValue]));

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const chartMonths = [];
    const chartCursor = new Date(Date.UTC(Number(chartStartDate.slice(0, 4)), Number(chartStartDate.slice(5, 7)) - 1, 1));
    const chartEnd = new Date(Date.UTC(Number(effectiveTo.slice(0, 4)), Number(effectiveTo.slice(5, 7)) - 1, 1));
    while (chartCursor <= chartEnd) {
      chartMonths.push(`${chartCursor.getUTCFullYear()}-${String(chartCursor.getUTCMonth() + 1).padStart(2, "0")}`);
      chartCursor.setUTCMonth(chartCursor.getUTCMonth() + 1);
    }
    const monthlyTargetVsActual = chartMonths.map((month) => {
      const [yr, mo] = month.split("-");
      const label = `${monthNames[parseInt(mo, 10) - 1]} '${yr.slice(2)}`;
      const rawTarget = targetMap.get(month);
      const targetVal = rawTarget === undefined || rawTarget === null || rawTarget === 0 ? null : rawTarget;
      const actualVal = monthlySalesMap.get(month) ?? 0;
      const pct = targetVal > 0 ? Math.round((actualVal / targetVal) * 100) : null;
      return {
        month,
        label,
        target: targetVal,
        actual: actualVal,
        achievementPercent: pct,
      };
    });

    // Special Achievements calculation (cleared / blank)
    const specialAchievements = [];

    // Thrust products analysis
    const thrustProducts = calculateThrustProductsForNames(allNames, from, to);

    res.json({
      id: rmId,
      name: rm.name,
      region: crmUser?.region ?? null,
      territory: crmUser?.territory ?? null,
      rmCode,
      operatingFrom: operatingCity,
      operatingCities,
      dealerCities,
      specialAchievements,
      monthlyTargetVsActual,
      thrustProducts,
      from,
      to,
      effectiveFrom,
      effectiveTo,
      latestActiveMonth,
      isAnchoredToLatestCycle,
      ownershipMapping,
      dataAvailability: ownershipMapping === "verified" ? { sales: "available", activity: "available" } : { sales: "unavailable", activity: "unavailable", reason: "No unique active RM profile maps this Tally RM to a CRM user and team." },
      reportingThresholds: { ...thresholds, dormantThresholdStatus: thresholds.provisional ? "provisional" : "configured" },
      monthlyPerformance,
      ytdPerformance,
      dealerIntelligence: {
        all: dealerIntelligence,
        noSalesInSelectedPeriod: dealersWithNoPeriodSales,
        declining: decliningDealers,
        insufficientHistory: insufficientHistoryDealers,
      },
      managementInsights,
      kpi: {
        visitsPlanned: visitsKpi.visitsTotal ?? 0,
        visitsCompleted: visitsKpi.visitsCompleted ?? 0,
        visitCompletionPercent,
        callsLogged,
        customersCovered: visitsKpi.customersCovered ?? 0,
        expectedOrdersValue: pipelineKpi.expectedValue ?? 0,
        actualSalesValue: actualSalesVal,
        salesInvoiceCount: ownershipMapping === "verified" ? rmDealerRows.reduce((sum, row) => sum + row.invoiceCount, 0) : null,
        targetValue,
        monthlyTarget,
        periodDays: diffDays,
        achievementPercent,
        followUpsOpen: followUpKpi.open ?? 0,
        followUpsOverdue: followUpKpi.overdue ?? 0,
      },
      dailyActivity,
      customerVisits,
      pipeline,
      actualSales,
      salesInvoiceCount: ownershipMapping === "verified" ? rmDealerRows.reduce((sum, row) => sum + row.invoiceCount, 0) : null,
      activeDealerCount,
      topDealers,
      topFiveDealerRevenue,
      topFiveDealerConcentrationPercent,
      dormantDealers,
      newCustomersCount: null,
      newCustomersUnavailableReason: "Customer creation dates are not stored; first invoice date is not proof of when the customer was added.",
      topProducts,
      followUps,
      todayActivity,
      attendance: rmAttendance ? {
        checkInAt: rmAttendance.checkInAt,
        checkOutAt: rmAttendance.checkOutAt,
        businessDate: rmAttendance.businessDate,
        status: rmAttendance.checkOutAt ? "checked_out" : rmAttendance.checkInAt ? "in_field" : "not_checked_in"
      } : null,
    });
  } catch (error) { next(error); }
});

adminRouter.get("/product-trends", (req, res, next) => {
  try {
    const financialYear = resolveFinancialYear(req.query.fy);
    const startYear = Number(financialYear.split("-")[0]);
    const currentFy = currentFinancialYear();
    const periodStart = `${startYear}-04-01`;
    const periodEnd = financialYear === currentFy ? today() : `${startYear + 1}-03-31`;
    const previousStart = `${startYear - 1}-04-01`;
    const previousEnd = `${Number(periodEnd.slice(0, 4)) - 1}${periodEnd.slice(4)}`;
    const productRows = db.prepare(`SELECT l.product_name name,SUM(l.quantity) quantity,SUM(${netInvoiceLineAmount("i","l")}) salesValue,COUNT(DISTINCT l.invoice_id) invoiceCount FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id WHERE ${authoritativeInvoiceWhere("i")} AND i.invoice_date BETWEEN ? AND ? GROUP BY l.product_name`).all(periodStart, periodEnd);
    const previousRows = db.prepare(`SELECT l.product_name name,SUM(l.quantity) quantity,SUM(${netInvoiceLineAmount("i","l")}) salesValue,COUNT(DISTINCT l.invoice_id) invoiceCount FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id WHERE ${authoritativeInvoiceWhere("i")} AND i.invoice_date BETWEEN ? AND ? GROUP BY l.product_name`).all(previousStart, previousEnd);
    // ---- territory totals (not just the leading product) -----------------
    const regionTotalsFor = (from, to) => db.prepare(`SELECT COALESCE(p.region,'Unassigned') region,
        COALESCE(SUM(${netInvoiceLineAmount("i","l")}),0) salesValue, COALESCE(SUM(l.quantity),0) quantity,
        COUNT(DISTINCT i.customer_id) customerCount, COUNT(DISTINCT l.product_name) productCount,
        COUNT(DISTINCT l.invoice_id) invoiceCount
      FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id LEFT JOIN tally_customers c ON c.id=i.customer_id LEFT JOIN salesperson_profiles p ON p.user_id=c.owner_user_id WHERE i.ingest_session_id IS NULL AND (i.source_sync_id IS NULL OR i.source_sync_id <> 'excel-import') AND i.invoice_date BETWEEN ? AND ? GROUP BY region`).all(from, to);

    const currentRegionTotals = regionTotalsFor(periodStart, periodEnd);
    const priorRegionTotals = new Map(regionTotalsFor(previousStart, previousEnd).map((row) => [row.region, row]));

    const regionProducts = db.prepare(`SELECT region, name, salesValue, quantity FROM (
        SELECT COALESCE(p.region,'Unassigned') region, l.product_name name, SUM(${netInvoiceLineAmount("i","l")}) salesValue, SUM(l.quantity) quantity,
               ROW_NUMBER() OVER (PARTITION BY COALESCE(p.region,'Unassigned') ORDER BY SUM(${netInvoiceLineAmount("i","l")}) DESC) rn
        FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id LEFT JOIN tally_customers c ON c.id=i.customer_id LEFT JOIN salesperson_profiles p ON p.user_id=c.owner_user_id WHERE i.ingest_session_id IS NULL AND (i.source_sync_id IS NULL OR i.source_sync_id <> 'excel-import') AND i.invoice_date BETWEEN ? AND ? GROUP BY region, l.product_name
      ) WHERE rn <= 5`).all(periodStart, periodEnd);

    const regionCustomers = db.prepare(`SELECT region, name, salesValue FROM (
        SELECT COALESCE(p.region,'Unassigned') region, COALESCE(c.name,i.customer_name) name, SUM(${netInvoiceLineAmount("i","l")}) salesValue,
               ROW_NUMBER() OVER (PARTITION BY COALESCE(p.region,'Unassigned') ORDER BY SUM(${netInvoiceLineAmount("i","l")}) DESC) rn
        FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id LEFT JOIN tally_customers c ON c.id=i.customer_id LEFT JOIN salesperson_profiles p ON p.user_id=c.owner_user_id WHERE i.ingest_session_id IS NULL AND (i.source_sync_id IS NULL OR i.source_sync_id <> 'excel-import') AND i.invoice_date BETWEEN ? AND ? GROUP BY region, COALESCE(c.name,i.customer_name)
      ) WHERE rn <= 5`).all(periodStart, periodEnd);

    const productRegions = db.prepare(`SELECT name, region, salesValue FROM (
        SELECT l.product_name name, COALESCE(p.region,'Unassigned') region, SUM(${netInvoiceLineAmount("i","l")}) salesValue,
               ROW_NUMBER() OVER (PARTITION BY l.product_name ORDER BY SUM(${netInvoiceLineAmount("i","l")}) DESC) rn
        FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id LEFT JOIN tally_customers c ON c.id=i.customer_id LEFT JOIN salesperson_profiles p ON p.user_id=c.owner_user_id WHERE i.ingest_session_id IS NULL AND (i.source_sync_id IS NULL OR i.source_sync_id <> 'excel-import') AND i.invoice_date BETWEEN ? AND ? GROUP BY l.product_name, region
      ) WHERE rn <= 4`).all(periodStart, periodEnd);

    const groupBy = (rows, key) => rows.reduce((map, row) => {
      const list = map.get(row[key]) ?? [];
      list.push(row);
      map.set(row[key], list);
      return map;
    }, new Map());
    const productsByRegion = groupBy(regionProducts, "region");
    const customersByRegion = groupBy(regionCustomers, "region");
    const regionsByProduct = groupBy(productRegions, "name");

    const territoryTotal = currentRegionTotals.reduce((sum, row) => sum + row.salesValue, 0);
    const territories = currentRegionTotals.map((row) => {
      const prior = priorRegionTotals.get(row.region);
      const previousSalesValue = prior?.salesValue ?? 0;
      return {
        ...row,
        previousSalesValue,
        changePercent: previousSalesValue > 0 ? Math.round(((row.salesValue - previousSalesValue) / previousSalesValue) * 100) : null,
        sharePercent: territoryTotal > 0 ? Math.round((row.salesValue / territoryTotal) * 1000) / 10 : null,
        topProducts: productsByRegion.get(row.region) ?? [],
        topCustomers: customersByRegion.get(row.region) ?? [],
      };
    }).sort((a, b) => b.salesValue - a.salesValue);

    const customerBreadth = db.prepare(`SELECT l.product_name name, COUNT(DISTINCT i.customer_id) customerCount
      FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id WHERE i.ingest_session_id IS NULL AND (i.source_sync_id IS NULL OR i.source_sync_id <> 'excel-import') AND i.invoice_date BETWEEN ? AND ? GROUP BY l.product_name`).all(periodStart, periodEnd);
    const breadthByName = new Map(customerBreadth.map((row) => [row.name, row.customerCount]));
    const previousByName = new Map(previousRows.map((row) => [row.name, row]));
    const names = new Set([...productRows.map((row) => row.name), ...previousRows.map((row) => row.name)]);
    const products = [...names].map((name) => {
      const current = productRows.find((row) => row.name === name) ?? { salesValue: 0, quantity: 0, invoiceCount: 0 };
      const previous = previousByName.get(name) ?? { salesValue: 0, quantity: 0, invoiceCount: 0 };
      const growthPercent = previous.salesValue > 0 ? Math.round(((current.salesValue - previous.salesValue) / previous.salesValue) * 100) : null;
      return { name, salesValue: current.salesValue, previousSalesValue: previous.salesValue, quantity: current.quantity, previousQuantity: previous.quantity, invoiceCount: current.invoiceCount, growthPercent,
        changeValue: current.salesValue - previous.salesValue,
        customerCount: breadthByName.get(name) ?? 0,
        regions: regionsByProduct.get(name) ?? [],
        averageRate: current.quantity > 0 ? current.salesValue / current.quantity : null,
        previousAverageRate: previous.quantity > 0 ? previous.salesValue / previous.quantity : null };
    });
    const top = [...products].filter((row) => row.salesValue > 0).sort((a, b) => b.salesValue - a.salesValue).slice(0, 15);
    const slow = [...products].filter((row) => row.salesValue > 0).sort((a, b) => a.salesValue - b.salesValue).slice(0, 15);
    const decliningAll = [...products].filter((row) => row.previousSalesValue > 0 && row.salesValue < row.previousSalesValue).sort((a, b) => (a.growthPercent ?? 0) - (b.growthPercent ?? 0));
    const declining = decliningAll.slice(0, 15);
    // ---- extra trend dimensions ------------------------------------------
    const monthRows = (from, to) => db.prepare(`SELECT substr(i.invoice_date,1,7) period,
        COALESCE(SUM(${netInvoiceLineAmount("i","l")}),0) salesValue, COALESCE(SUM(l.quantity),0) quantity,
        COUNT(DISTINCT l.invoice_id) invoiceCount, COUNT(DISTINCT l.product_name) productCount
      FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id WHERE i.ingest_session_id IS NULL AND (i.source_sync_id IS NULL OR i.source_sync_id <> 'excel-import') AND i.invoice_date BETWEEN ? AND ? GROUP BY period ORDER BY period`).all(from, to);

    const currentMonths = monthRows(periodStart, periodEnd);
    const priorMonths = monthRows(previousStart, previousEnd);
    const priorByMonthIndex = new Map(priorMonths.map((row) => [row.period.slice(5), row]));
    const monthlyTrend = currentMonths.map((row) => {
      const prior = priorByMonthIndex.get(row.period.slice(5));
      const previousSalesValue = prior?.salesValue ?? 0;
      return {
        ...row,
        previousSalesValue,
        changePercent: previousSalesValue > 0 ? Math.round(((row.salesValue - previousSalesValue) / previousSalesValue) * 100) : null,
      };
    });


    const regionRows = db.prepare(`SELECT COALESCE(p.region,'Unassigned') region,l.product_name productName,SUM(${netInvoiceLineAmount("i","l")}) salesValue,SUM(l.quantity) quantity FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id LEFT JOIN tally_customers c ON c.id=i.customer_id LEFT JOIN salesperson_profiles p ON p.user_id=c.owner_user_id WHERE ${authoritativeInvoiceWhere("i")} AND i.invoice_date BETWEEN ? AND ? GROUP BY region,l.product_name ORDER BY region,salesValue DESC`).all(periodStart, periodEnd);
    const regions = [];
    for (const row of regionRows) if (!regions.some((item) => item.region === row.region)) regions.push(row);
    const gainers = [...products].filter((row) => row.changeValue > 0).sort((a, b) => b.changeValue - a.changeValue).slice(0, 8);
    const losers = [...products].filter((row) => row.changeValue < 0).sort((a, b) => a.changeValue - b.changeValue).slice(0, 8);
    const newProducts = [...products].filter((row) => row.salesValue > 0 && row.previousSalesValue === 0).sort((a, b) => b.salesValue - a.salesValue);
    const stoppedProducts = [...products].filter((row) => row.salesValue === 0 && row.previousSalesValue > 0).sort((a, b) => b.previousSalesValue - a.previousSalesValue);

    const ranked = [...products].filter((row) => row.salesValue > 0).sort((a, b) => b.salesValue - a.salesValue);
    const rankedTotal = ranked.reduce((sum, row) => sum + row.salesValue, 0);
    const shareOfTop = (count) => rankedTotal > 0
      ? Math.round((ranked.slice(0, count).reduce((sum, row) => sum + row.salesValue, 0) / rankedTotal) * 1000) / 10
      : null;
    const concentration = { top5: shareOfTop(5), top10: shareOfTop(10), top20: shareOfTop(20), sellingProducts: ranked.length };

    const totalSales = productRows.reduce((sum, row) => sum + row.salesValue, 0);
    const previousTotalSales = previousRows.reduce((sum, row) => sum + row.salesValue, 0);
    res.json({ monthlyTrend, gainers, losers, concentration, territories,
      newProducts: { count: newProducts.length, value: newProducts.reduce((sum, row) => sum + row.salesValue, 0), items: newProducts.slice(0, 6) },
      stoppedProducts: { count: stoppedProducts.length, value: stoppedProducts.reduce((sum, row) => sum + row.previousSalesValue, 0), items: stoppedProducts.slice(0, 6) },
      financialYear, financialYears: availableFinancialYears(), periodStart, periodEnd, previousStart, previousEnd, summary: { totalSales, previousTotalSales, growthPercent: previousTotalSales > 0 ? Math.round(((totalSales - previousTotalSales) / previousTotalSales) * 100) : null, activeProducts: productRows.length, decliningProducts: decliningAll.length }, top, slow, declining, regions });
  } catch (error) { next(error); }
});

adminRouter.get("/management-attention", async (req, res, next) => {
  try {
    const financialYear = resolveFinancialYear(req.query.fy);
    const startYear = Number(financialYear.split("-")[0]);
    const asOf = financialYear === currentFinancialYear() ? today() : `${startYear + 1}-03-31`;
    const monthFrom = `${asOf.slice(0, 7)}-01`;
    const fyFrom = `${startYear}-04-01`;
    const previousComparable = (value) => {
      const date = new Date(`${value}T00:00:00Z`);
      date.setUTCFullYear(date.getUTCFullYear() - 1);
      return date.toISOString().slice(0, 10);
    };
    const previousFrom = previousComparable(fyFrom);
    const previousTo = previousComparable(asOf);
    const thresholds = rmReportThresholds();
    const directory = buildRmDirectory();
    const crmUsers = db.prepare(`SELECT u.id,u.role,p.full_name fullName,p.manager_user_id managerUserId,p.region,p.territory
      FROM users u JOIN salesperson_profiles p ON p.user_id=u.id WHERE u.active=1`).all();
    const team = [];
    const dealerActions = [];
    for (const rm of directory) {
      const matchingRms = crmUsers.filter((user) => user.role === "rm" && user.fullName && resolveRmId(directory, user.fullName) === rm.id);
      const ownershipMapping = matchingRms.length === 1 ? "verified" : matchingRms.length ? "ambiguous" : "unmapped";
      const rmUser = matchingRms.length === 1 ? matchingRms[0] : null;
      const ownerIds = rmUser ? [rmUser.id, ...crmUsers.filter((user) => user.role === "salesperson" && user.managerUserId === rmUser.id).map((user) => user.id)] : [];
      const nameParams = [rm.name, ...rm.aliases];
      const nameSlots = nameParams.map(() => "?").join(",");
      let monthlyPerformance = calculatePeriodPerformance(null, null, monthFrom, asOf, "month-to-date");
      let ytdPerformance = calculatePeriodPerformance(null, null, fyFrom, asOf, "FYTD");
      let dealerIntelligence = [];
      let concentrationPercent = null;
      let concentrationTopDealers = [];
      if (ownershipMapping === "verified" && ownerIds.length) {
        const ownerSlots = ownerIds.map(() => "?").join(",");
        const sales = db.prepare(`SELECT
          COALESCE(SUM(CASE WHEN i.invoice_date BETWEEN ? AND ? THEN ${netInvoiceAmount("i")} ELSE 0 END),0) mtdActual,
          COALESCE(SUM(CASE WHEN i.invoice_date BETWEEN ? AND ? THEN ${netInvoiceAmount("i")} ELSE 0 END),0) ytdActual
          FROM tally_invoices i JOIN tally_customers c ON c.id=i.customer_id
          WHERE ${authoritativeInvoiceWhere("i")} AND c.owner_user_id IN (${ownerSlots})`).get(monthFrom, asOf, fyFrom, asOf, ...ownerIds);
        const target = db.prepare(`SELECT
          COALESCE(SUM(CASE WHEN period=? THEN target_lakh*? ELSE 0 END),0) mtdTarget,
          COALESCE(SUM(CASE WHEN period>=? AND period<=? THEN target_lakh*? ELSE 0 END),0) ytdTarget
          FROM tally_rm_targets WHERE rm_name IN (${nameSlots})`).get(asOf.slice(0, 7), LAKH, fyFrom.slice(0, 7), asOf.slice(0, 7), LAKH, ...nameParams);
        monthlyPerformance = calculatePeriodPerformance(sales.mtdActual, target.mtdTarget, monthFrom, asOf, "month-to-date");
        ytdPerformance = calculatePeriodPerformance(sales.ytdActual, target.ytdTarget, fyFrom, asOf, "FYTD");
        const dealerRows = db.prepare(`SELECT c.id,c.name,c.city,
          COALESCE(SUM(CASE WHEN i.invoice_date BETWEEN ? AND ? THEN ${netInvoiceAmount("i")} ELSE 0 END),0) salesValue,
          COUNT(DISTINCT CASE WHEN i.invoice_date BETWEEN ? AND ? THEN i.id END) invoiceCount,
          COALESCE(SUM(CASE WHEN i.invoice_date BETWEEN ? AND ? THEN ${netInvoiceAmount("i")} ELSE 0 END),0) previousSalesValue,
          COUNT(DISTINCT CASE WHEN i.invoice_date BETWEEN ? AND ? THEN i.id END) previousInvoiceCount,
          COUNT(DISTINCT i.id) historyInvoiceCount,MIN(i.invoice_date) firstInvoiceDate,MAX(i.invoice_date) lastInvoiceDate
          FROM tally_customers c LEFT JOIN tally_invoices i ON i.customer_id=c.id AND ${authoritativeInvoiceWhere("i")}
          WHERE c.owner_user_id IN (${ownerSlots}) GROUP BY c.id,c.name,c.city`)
          .all(fyFrom, asOf, fyFrom, asOf, previousFrom, previousTo, previousFrom, previousTo, ...ownerIds);
        dealerIntelligence = classifyDealerIntelligence(dealerRows, { periodFrom: fyFrom, periodTo: asOf, dormantDays: thresholds.dormantDays });
        const concentration = calculateDealerConcentration(dealerIntelligence, sales.ytdActual);
        concentrationPercent = concentration.topFivePercent;
        concentrationTopDealers = concentration.topDealers.map(({ id, name, salesValue }) => ({ id, name, salesValue }));
        const reportHref = `/admin/team/${encodeURIComponent(rm.id)}?from=${encodeURIComponent(fyFrom)}&to=${encodeURIComponent(asOf)}&fy=${encodeURIComponent(financialYear)}`;
        const addDealerAction = (kind, dealer, severity, metric, title, action) => dealerActions.push({
          id: `${kind}:${rm.id}:${dealer.id}`, kind, severity, rmId: rm.id, rmName: rm.name,
          dealerId: dealer.id, dealerName: dealer.name, metric, title, period: { from: fyFrom, to: asOf },
          action, href: `/admin/customers?search=${encodeURIComponent(dealer.name)}`, reportHref,
          thresholdsProvisional: thresholds.provisional,
        });
        for (const dealer of dealerIntelligence.filter((row) => row.dormant)) addDealerAction("dormant-dealer", dealer, "medium", `Last invoice ${dealer.lastInvoiceDate}; ${thresholds.dormantDays}+ days inactive`, "Invoice-inactive dealer", "Confirm account status with the RM and schedule a customer review.");
        for (const dealer of dealerIntelligence.filter((row) => row.declinePercent != null && !row.dormant)) addDealerAction("declining-dealer", dealer, "medium", `${dealer.declinePercent}% lower than comparable prior period (₹${Math.round(dealer.previousSalesValue).toLocaleString("en-IN")} to ₹${Math.round(dealer.salesValue).toLocaleString("en-IN")})`, "Dealer sales declined", "Review the invoice history and confirm the account-level reason with the RM.");
      }
      const metric = monthlyPerformance.achievementPercent ?? ytdPerformance.achievementPercent;
      const performancePeriod = monthlyPerformance.achievementPercent != null ? monthlyPerformance : ytdPerformance;
      const reportHref = `/admin/team/${encodeURIComponent(rm.id)}?from=${encodeURIComponent(fyFrom)}&to=${encodeURIComponent(asOf)}&fy=${encodeURIComponent(financialYear)}`;
      const targetAlert = ownershipMapping === "verified" && metric != null && metric < thresholds.targetAlertPercent ? {
        id: `target:${rm.id}`, kind: "target-risk", severity: "high", rmId: rm.id, rmName: rm.name,
        metric: `${metric}% of ${performancePeriod.label} target`, period: { from: performancePeriod.from, to: performancePeriod.to },
        actual: performancePeriod.actual, target: performancePeriod.target,
        title: "RM target below review threshold", action: "Review account pipeline and agree recovery priorities with the RM.",
        href: reportHref, thresholdsProvisional: thresholds.provisional,
      } : null;
      const concentrationAlert = ownershipMapping === "verified" && concentrationPercent != null && concentrationPercent >= thresholds.concentrationAlertPercent ? {
        id: `concentration:${rm.id}`, kind: "dealer-concentration", severity: "medium", rmId: rm.id, rmName: rm.name,
        metric: `${concentrationPercent}% of attributed FYTD sales from top five dealers`, period: { from: fyFrom, to: asOf },
        title: "Dealer revenue concentration", action: "Review continuity plans for the leading accounts and confirm diversification priorities.",
        href: reportHref, thresholdsProvisional: thresholds.provisional,
      } : null;
      team.push({ id: rm.id, name: rm.name, ownershipMapping, monthlyPerformance, ytdPerformance, concentrationPercent, concentrationTopDealers, actions: [targetAlert, concentrationAlert].filter(Boolean) });
    }

    const visitAsOf = today();
    const rawVisits = db.prepare(`SELECT v.id,v.business_date businessDate,v.scheduled_at scheduledAt,v.status,v.tally_customer_id customerId,
      c.name customerName,u.id userId,p.full_name fullName,u.role,p.manager_user_id managerUserId,m.full_name managerName
      FROM visits v JOIN users u ON u.id=v.user_id LEFT JOIN salesperson_profiles p ON p.user_id=u.id
      LEFT JOIN salesperson_profiles m ON m.user_id=p.manager_user_id LEFT JOIN tally_customers c ON c.id=v.tally_customer_id
      WHERE (v.business_date<? AND v.status<>'completed') OR v.business_date=? ORDER BY v.business_date,v.scheduled_at`).all(visitAsOf, visitAsOf);
    const visits = classifyPlannedVisits(rawVisits, { asOf: visitAsOf, now: new Date().toISOString() });
    const rmVisits = new Map();
    for (const visit of visits) {
      const ownerRm = visit.role === "rm" ? visit.fullName : visit.managerName;
      const rmId = ownerRm ? resolveRmId(directory, ownerRm) : null;
      const key = rmId ?? "unmapped";
      const row = rmVisits.get(key) ?? { rmId, rmName: ownerRm ?? "Unmapped", plannedToday: 0, completedToday: 0, pendingToday: 0, pastScheduled: 0 };
      if (visit.businessDate === visitAsOf && visit.completed) row.completedToday += 1;
      else if (visit.businessDate === visitAsOf) row.plannedToday += 1;
      if (visit.pendingToday) row.pendingToday += 1;
      if (visit.pastScheduledTime) row.pastScheduled += 1;
      rmVisits.set(key, row);
      if (visit.pastScheduledTime) {
        visit.rmId = rmId;
        visit.rmName = ownerRm ?? "Unmapped";
        visit.attentionReason = "Scheduled time passed and completion is not recorded. Confirm the visit outcome with the assigned owner.";
      }
    }
    const visitRows = visits.filter((visit) => visit.pastScheduledTime || visit.pendingToday).map((visit) => ({
      id: visit.id, rmId: visit.rmId ?? (visit.role === "rm" ? resolveRmId(directory, visit.fullName) : resolveRmId(directory, visit.managerName)),
      rmName: visit.rmName ?? (visit.role === "rm" ? visit.fullName : visit.managerName) ?? "Unmapped",
      userId: visit.userId, ownerName: visit.fullName, customerId: visit.customerId, customerName: visit.customerName,
      businessDate: visit.businessDate, scheduledAt: visit.scheduledAt, status: visit.status,
      pastScheduledTime: visit.pastScheduledTime, pendingToday: visit.pendingToday,
      action: visit.pastScheduledTime ? "Confirm visit outcome with the assigned owner and log the actual status." : "Confirm the customer visit plan and record the outcome after the visit.",
      href: "/admin/activity",
    }));
    const scheduledToday = db.prepare("SELECT COUNT(*) count FROM visits WHERE business_date=?").get(visitAsOf).count;
    const completedToday = db.prepare("SELECT COUNT(*) count FROM visits WHERE business_date=? AND status='completed'").get(visitAsOf).count;
    const latestSyncRun = db.prepare("SELECT id,started_at startedAt,completed_at completedAt,status,error_message errorMessage FROM tally_sync_runs ORDER BY started_at DESC LIMIT 1").get() ?? null;
    res.json({ financialYear, period: { monthFrom, fyFrom, to: asOf }, asOf: visitAsOf, thresholds: { ...thresholds }, team,
      dealerActions: dedupeManagementActions(dealerActions),
      sync: { latestRun: latestSyncRun, needsReview: tallySyncNeedsReview(latestSyncRun) },
      visits: { scheduledToday, completedToday, pastScheduled: visitRows.filter((row) => row.pastScheduledTime), pendingToday: visitRows.filter((row) => row.pendingToday), byRm: [...rmVisits.values()] } });
  } catch (error) { next(error); }
});

adminRouter.get("/alerts", (req, res, next) => {
  try {
    const currentDate = today();
    const monthStart = `${currentDate.slice(0, 7)}-01`;
    const missedCheckIns = db.prepare(`SELECT u.id userId,u.email,p.full_name fullName,p.region,p.territory,m.full_name managerName FROM users u JOIN salesperson_profiles p ON p.user_id=u.id LEFT JOIN salesperson_profiles m ON m.user_id=p.manager_user_id WHERE u.active=1 AND u.role='salesperson' AND NOT EXISTS(SELECT 1 FROM attendance a WHERE a.user_id=u.id AND a.business_date=?) ORDER BY p.full_name`).all(currentDate);
    const overdueFollowUps = db.prepare(`SELECT f.id,f.title,f.due_date dueDate,f.priority,c.name customer,u.email,p.full_name fullName,CAST(julianday(?) - julianday(f.due_date) AS INTEGER) daysOverdue FROM follow_ups f JOIN users u ON u.id=f.user_id LEFT JOIN salesperson_profiles p ON p.user_id=f.user_id LEFT JOIN tally_customers c ON c.id=f.tally_customer_id WHERE f.completed=0 AND f.due_date<? ORDER BY f.due_date LIMIT 100`).all(currentDate, currentDate);
    const overdueOrders = db.prepare(`SELECT e.id,e.expected_date expectedDate,e.expected_value expectedValue,c.name customer,tp.name product,u.email,p.full_name fullName,CAST(julianday(?) - julianday(e.expected_date) AS INTEGER) daysOverdue FROM expected_orders e JOIN users u ON u.id=e.user_id LEFT JOIN salesperson_profiles p ON p.user_id=e.user_id LEFT JOIN tally_customers c ON c.id=e.tally_customer_id LEFT JOIN tally_products tp ON tp.id=e.tally_product_id WHERE e.status='open' AND e.expected_date IS NOT NULL AND e.expected_date<? ORDER BY e.expected_date LIMIT 100`).all(currentDate, currentDate);
    const inactiveCustomers = db.prepare(`SELECT c.id,c.name,c.city,c.outstanding,p.full_name ownerName,p.region,MAX(i.invoice_date) lastInvoiceDate,CAST(julianday(?) - julianday(MAX(i.invoice_date)) AS INTEGER) inactiveDays FROM tally_customers c JOIN salesperson_profiles p ON p.user_id=c.owner_user_id LEFT JOIN tally_invoices i ON i.customer_id=c.id AND i.ingest_session_id IS NULL AND (i.source_sync_id IS NULL OR i.source_sync_id <> 'excel-import') GROUP BY c.id,c.name,c.city,c.outstanding,p.full_name,p.region HAVING MAX(i.invoice_date) IS NULL OR MAX(i.invoice_date)<date(?,'-90 day') ORDER BY c.outstanding DESC LIMIT 100`).all(currentDate, currentDate);
    // salesperson_profiles.monthly_target has inconsistent historical units; do not infer target shortfalls.
    const targetShortfalls = [];
    res.json({ reminders: reminderSummary(db, req.user.id), asOf: currentDate, targetShortfallsAvailable: false, targetShortfallsReason: "Salesperson target units are not consistently defined; only explicit Tally RM targets are reliable.", summary: { total: missedCheckIns.length + overdueFollowUps.length + overdueOrders.length + inactiveCustomers.length, missedCheckIns: missedCheckIns.length, overdueFollowUps: overdueFollowUps.length, overdueOrders: overdueOrders.length, inactiveCustomers: inactiveCustomers.length, targetShortfalls: 0 }, missedCheckIns, overdueFollowUps, overdueOrders, inactiveCustomers, targetShortfalls });
  } catch (error) { next(error); }
});

adminRouter.get("/management-reports", (req, res, next) => {
  try {
    const financialYear = resolveFinancialYear(req.query.fy); const startYear = Number(financialYear.split("-")[0]);
    const from = `${startYear}-04-01`, to = financialYear === currentFinancialYear() ? today() : `${startYear + 1}-03-31`;
    const previousFrom = `${startYear - 1}-04-01`, previousTo = `${Number(to.slice(0, 4)) - 1}${to.slice(4)}`;
    const dealers = db.prepare(`SELECT c.id,c.name,c.party_type partyType,c.city,c.rm_name rmName,c.outstanding,c.last_payment_date lastPaymentDate,COALESCE(SUM(CASE WHEN i.invoice_date BETWEEN ? AND ? THEN ${netInvoiceAmount("i")} ELSE 0 END),0) salesValue,COALESCE(SUM(CASE WHEN i.invoice_date BETWEEN ? AND ? THEN ${netInvoiceAmount("i")} ELSE 0 END),0) previousSalesValue,COUNT(DISTINCT CASE WHEN i.invoice_date BETWEEN ? AND ? THEN i.id END) invoiceCount,COUNT(DISTINCT CASE WHEN i.invoice_date BETWEEN ? AND ? THEN substr(i.invoice_date,1,7) END) activeMonths,MAX(CASE WHEN i.invoice_date BETWEEN ? AND ? THEN i.invoice_date END) lastInvoiceDate FROM tally_customers c LEFT JOIN tally_invoices i ON i.customer_id=c.id AND ${authoritativeInvoiceWhere("i")} GROUP BY c.id,c.name,c.party_type,c.city,c.rm_name,c.outstanding,c.last_payment_date HAVING salesValue<>0 OR previousSalesValue<>0 ORDER BY salesValue DESC LIMIT 250`).all(from, to, previousFrom, previousTo, from, to, from, to, from, to).map((row) => ({ ...row, growthPercent: row.previousSalesValue ? Math.round(((row.salesValue - row.previousSalesValue) / Math.abs(row.previousSalesValue)) * 100) : null, classification: row.activeMonths >= 9 ? "Consistent" : row.activeMonths >= 4 ? "Developing" : "Needs attention" }));
    const crmUsers = db.prepare(`SELECT u.id,u.email,u.role,p.full_name fullName,p.region,p.territory,p.monthly_target monthlyTarget FROM users u JOIN salesperson_profiles p ON p.user_id=u.id WHERE u.active=1 AND u.role IN ('salesperson','rm') ORDER BY p.full_name`).all();
    const team = crmUsers.map((user) => {
      const current = db.prepare(`SELECT COALESCE(SUM(${netInvoiceAmount("i")}),0) salesValue,COUNT(DISTINCT i.customer_id) customers FROM tally_invoices i JOIN tally_customers c ON c.id=i.customer_id WHERE ${authoritativeInvoiceWhere("i")} AND c.owner_user_id=? AND i.invoice_date BETWEEN ? AND ?`).get(user.id, from, to);
      const previous = db.prepare(`SELECT COALESCE(SUM(${netInvoiceAmount("i")}),0) salesValue FROM tally_invoices i JOIN tally_customers c ON c.id=i.customer_id WHERE ${authoritativeInvoiceWhere("i")} AND c.owner_user_id=? AND i.invoice_date BETWEEN ? AND ?`).get(user.id, previousFrom, previousTo);
      const expected = db.prepare("SELECT COALESCE(SUM(expected_value),0) value FROM expected_orders WHERE user_id=? AND status='open'").get(user.id).value;
      const monthLimit = financialYear === currentFinancialYear() ? to.slice(0, 7) : `${startYear + 1}-03`;
      const currentTargetRow = user.role === "rm" ? db.prepare("SELECT COALESCE(SUM(target_lakh),0) targetLakh FROM tally_rm_targets WHERE rm_name=? AND period BETWEEN ? AND ?").get(user.fullName, `${startYear}-04`, monthLimit) : null;
      const annualTargetRow = user.role === "rm" ? db.prepare("SELECT COALESCE(SUM(target_lakh),0) targetLakh FROM tally_rm_targets WHERE rm_name=? AND period BETWEEN ? AND ?").get(user.fullName, `${startYear}-04`, `${startYear + 1}-03`) : null;
      const months = Math.max(targetMonthsFor(financialYear), 1);
      const targetValue = currentTargetRow?.targetLakh > 0 ? currentTargetRow.targetLakh * LAKH : null;
      const annualTarget = annualTargetRow?.targetLakh > 0 ? annualTargetRow.targetLakh * LAKH : null;
      const runRateProjection = (current.salesValue / months) * 12; const projectedSales = runRateProjection + expected;
      return { ...user, ...current, previousSalesValue: previous.salesValue, salesDifference: current.salesValue - previous.salesValue, growthPercent: previous.salesValue ? Math.round(((current.salesValue - previous.salesValue) / Math.abs(previous.salesValue)) * 100) : null, targetValue, achievementPercent: targetValue ? Math.round((current.salesValue / targetValue) * 100) : null, expectedOrders: expected, runRateProjection, projectedSales, annualTarget, projectedGap: annualTarget === null ? null : annualTarget - projectedSales };
    });
    const purchases = db.prepare(`SELECT supplier_name supplierName,COUNT(*) voucherCount,SUM(amount) purchaseValue,MAX(purchase_date) lastPurchaseDate FROM tally_purchases WHERE ingest_session_id IS NULL AND purchase_date BETWEEN ? AND ? GROUP BY supplier_name ORDER BY purchaseValue DESC LIMIT 250`).all(from, to);
    const purchaseProducts = db.prepare(`SELECT l.product_name productName,SUM(l.quantity) quantity,SUM(l.amount) purchaseValue,COUNT(DISTINCT l.purchase_id) voucherCount FROM tally_purchase_lines l JOIN tally_purchases p ON p.id=l.purchase_id WHERE p.ingest_session_id IS NULL AND p.purchase_date BETWEEN ? AND ? GROUP BY l.product_name ORDER BY purchaseValue DESC LIMIT 250`).all(from, to);
    res.json({ financialYear, financialYears: availableFinancialYears(), from, to, previousFrom, previousTo, dealers, team, purchases, purchaseProducts, coverage: { dealerPerformance: true, payments: true, rmDifference: true, rmPerformance: true, projection: true, productAnalysis: true, purchaseAnalysis: purchases.length > 0, incentiveCalculation: false } });
  } catch (error) { next(error); }
});

adminRouter.get("/reports/sales", (req, res, next) => {
  try {
    if (req.query.fy !== undefined && (typeof req.query.fy !== "string" || !/^\d{4}-\d{2}$/.test(req.query.fy) || financialYearOf(`${req.query.fy.slice(0, 4)}-04`) !== req.query.fy)) return res.status(400).json({ error: "Financial year must use YYYY-YY format" });
    const selectedFy = req.query.fy ?? null;
    const fyStart = selectedFy ? `${selectedFy.slice(0, 4)}-04-01` : null;
    const fyEnd = selectedFy ? `${Number(selectedFy.slice(0, 4)) + 1}-03-31` : null;
    for (const key of ["from", "to"]) if (req.query[key] !== undefined && !isBusinessDate(req.query[key])) return res.status(400).json({ error: "Choose valid YYYY-MM-DD report dates" });
    const end = req.query.to ?? fyEnd ?? today();
    const start = req.query.from ?? fyStart ?? `${end.slice(0, 7)}-01`;
    if (start > end) return res.status(400).json({ error: "From date must be before the to date" });
    const filterParts = [], filterArgs = [];
    if (selectedFy) { filterParts.push("i.invoice_date>=? AND i.invoice_date<=?"); filterArgs.push(fyStart, fyEnd); }
    for (const key of ["customerId", "productId", "salespersonId", "territory", "region", "dealer"]) {
      if (req.query[key] !== undefined && (typeof req.query[key] !== "string" || req.query[key].length > 160)) return res.status(400).json({ error: `Invalid ${key} filter` });
    }
    if (req.query.customerId) { filterParts.push("i.customer_id=?"); filterArgs.push(req.query.customerId); }
    if (req.query.productId) { filterParts.push("EXISTS(SELECT 1 FROM tally_invoice_lines filter_line WHERE filter_line.invoice_id=i.id AND (filter_line.product_id=? OR filter_line.product_name=?))"); filterArgs.push(req.query.productId, req.query.productId); }
    if (req.query.salespersonId) {
      const selectedOwner = db.prepare("SELECT u.role,p.manager_user_id FROM users u LEFT JOIN salesperson_profiles p ON p.user_id=u.id WHERE u.id=? AND u.active=1").get(req.query.salespersonId);
      const ownerIds = selectedOwner?.role === "rm" ? [req.query.salespersonId, ...db.prepare("SELECT user_id FROM salesperson_profiles WHERE manager_user_id=?").all(req.query.salespersonId).map((row) => row.user_id)] : [req.query.salespersonId];
      filterParts.push(`EXISTS(SELECT 1 FROM tally_customers filter_customer WHERE filter_customer.id=i.customer_id AND filter_customer.owner_user_id IN (${ownerIds.map(() => "?").join(",")}))`);
      filterArgs.push(...ownerIds);
    }
    if (req.query.territory) { filterParts.push("EXISTS(SELECT 1 FROM tally_customers filter_customer JOIN salesperson_profiles filter_profile ON filter_profile.user_id=filter_customer.owner_user_id WHERE filter_customer.id=i.customer_id AND filter_profile.territory=?)"); filterArgs.push(req.query.territory); }
    if (req.query.region) { filterParts.push("EXISTS(SELECT 1 FROM tally_customers filter_customer JOIN salesperson_profiles filter_profile ON filter_profile.user_id=filter_customer.owner_user_id WHERE filter_customer.id=i.customer_id AND filter_profile.region=?)"); filterArgs.push(req.query.region); }
    if (req.query.dealer) { filterParts.push("EXISTS(SELECT 1 FROM tally_customers filter_customer WHERE filter_customer.id=i.customer_id AND lower(filter_customer.party_type)=lower(?))"); filterArgs.push(req.query.dealer); }
    const invoiceWhere = `${authoritativeInvoiceWhere("i")} AND i.invoice_date>=? AND i.invoice_date<=?${filterParts.map((part) => ` AND ${part}`).join("")}`;
    const reportArgs = [start, end, ...filterArgs];
    const summary = db.prepare(`SELECT COUNT(*) invoiceCount, COUNT(DISTINCT i.customer_id) customerCount, COALESCE(SUM(${netInvoiceAmount("i")}),0) totalSales, COALESCE(AVG(${netInvoiceAmount("i")}),0) averageInvoice FROM tally_invoices i WHERE ${invoiceWhere}`).get(...reportArgs);
    const repeated = db.prepare(`SELECT COUNT(*) count FROM (SELECT i.customer_id FROM tally_invoices i WHERE ${invoiceWhere} AND i.customer_id IS NOT NULL GROUP BY i.customer_id HAVING COUNT(*)>1)`).get(...reportArgs).count;
    const unallocated = db.prepare(`SELECT COUNT(*) invoiceCount,COALESCE(SUM(${netInvoiceAmount("i")}),0) salesValue FROM tally_invoices i WHERE ${invoiceWhere} AND lower(i.voucher_type)='sales' AND ABS(i.amount)>0.01 AND NOT EXISTS(SELECT 1 FROM tally_invoice_lines l WHERE l.invoice_id=i.id)`).get(...reportArgs);
    const byCustomer = db.prepare(`SELECT COALESCE(c.name,i.customer_name) name, COUNT(*) invoiceCount, SUM(${netInvoiceAmount("i")}) salesValue, COALESCE(c.outstanding,0) outstanding FROM tally_invoices i LEFT JOIN tally_customers c ON c.id=i.customer_id WHERE ${invoiceWhere} GROUP BY i.customer_id, COALESCE(c.name,i.customer_name), c.outstanding ORDER BY salesValue DESC`).all(...reportArgs);
    const byProduct = db.prepare(`SELECT l.product_name name, SUM(l.quantity) quantity, SUM(${netInvoiceLineAmount("i","l")}) salesValue, COUNT(DISTINCT l.invoice_id) invoiceCount FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id WHERE ${invoiceWhere} GROUP BY l.product_name ORDER BY salesValue DESC`).all(...reportArgs);
    const bySalesperson = db.prepare(`SELECT COALESCE(p.full_name,'Unassigned') name, COALESCE(p.region,'Unassigned') region, COUNT(*) invoiceCount, SUM(${netInvoiceAmount("i")}) salesValue, COUNT(DISTINCT i.customer_id) customerCount FROM tally_invoices i LEFT JOIN tally_customers c ON c.id=i.customer_id LEFT JOIN salesperson_profiles p ON p.user_id=c.owner_user_id WHERE ${invoiceWhere} GROUP BY COALESCE(p.full_name,'Unassigned'), COALESCE(p.region,'Unassigned') ORDER BY salesValue DESC`).all(...reportArgs);
    const byRegion = db.prepare(`SELECT COALESCE(p.region,'Unassigned') name, COUNT(*) invoiceCount, SUM(${netInvoiceAmount("i")}) salesValue, COUNT(DISTINCT i.customer_id) customerCount FROM tally_invoices i LEFT JOIN tally_customers c ON c.id=i.customer_id LEFT JOIN salesperson_profiles p ON p.user_id=c.owner_user_id WHERE ${invoiceWhere} GROUP BY COALESCE(p.region,'Unassigned') ORDER BY salesValue DESC`).all(...reportArgs);

    // Per-owner and per-region detail so the report can be expanded row by row.
    const ownerMonthly = db.prepare(`SELECT COALESCE(p.full_name,'Unassigned') owner, substr(i.invoice_date,1,7) period,
        SUM(${netInvoiceAmount("i")}) salesValue, COUNT(*) invoiceCount
      FROM tally_invoices i LEFT JOIN tally_customers c ON c.id=i.customer_id LEFT JOIN salesperson_profiles p ON p.user_id=c.owner_user_id WHERE ${invoiceWhere} GROUP BY owner, period ORDER BY period`).all(...reportArgs);

    const ownerProducts = db.prepare(`SELECT owner, name, salesValue, quantity FROM (
        SELECT COALESCE(p.full_name,'Unassigned') owner, l.product_name name, SUM(${netInvoiceLineAmount("i","l")}) salesValue, SUM(l.quantity) quantity,
               ROW_NUMBER() OVER (PARTITION BY COALESCE(p.full_name,'Unassigned') ORDER BY SUM(${netInvoiceLineAmount("i","l")}) DESC) rn
        FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id
        LEFT JOIN tally_customers c ON c.id=i.customer_id
        LEFT JOIN salesperson_profiles p ON p.user_id=c.owner_user_id
        WHERE ${invoiceWhere} GROUP BY owner, l.product_name
      ) WHERE rn <= 5`).all(...reportArgs);

    const ownerCustomers = db.prepare(`SELECT owner, name, salesValue, invoiceCount FROM (
        SELECT COALESCE(p.full_name,'Unassigned') owner, COALESCE(c.name,i.customer_name) name, SUM(${netInvoiceAmount("i")}) salesValue, COUNT(*) invoiceCount,
               ROW_NUMBER() OVER (PARTITION BY COALESCE(p.full_name,'Unassigned') ORDER BY SUM(${netInvoiceAmount("i")}) DESC) rn
        FROM tally_invoices i LEFT JOIN tally_customers c ON c.id=i.customer_id LEFT JOIN salesperson_profiles p ON p.user_id=c.owner_user_id WHERE ${invoiceWhere} GROUP BY owner, COALESCE(c.name,i.customer_name)
      ) WHERE rn <= 5`).all(...reportArgs);

    const ownerReceipts = db.prepare(`SELECT COALESCE(pr.full_name,NULLIF(c.rm_name,''),'Unassigned') owner,
        COUNT(*) receiptCount, COALESCE(SUM(pay.amount),0) receiptValue
      FROM tally_payments_live pay
      LEFT JOIN tally_customers c ON c.id=pay.customer_id
      LEFT JOIN salesperson_profiles pr ON pr.user_id=c.owner_user_id
      WHERE pay.ingest_session_id IS NULL AND pay.payment_type='Receipt' AND pay.payment_date>=? AND pay.payment_date<=?
      GROUP BY owner`).all(start, end);

    const ownerBook = db.prepare(`SELECT COALESCE(pr.full_name,NULLIF(c.rm_name,''),'Unassigned') owner, COUNT(*) assignedCustomers
      FROM tally_customers c LEFT JOIN salesperson_profiles pr ON pr.user_id=c.owner_user_id GROUP BY owner`).all();

    const bucket = (rows, key) => rows.reduce((map, row) => {
      const list = map.get(row[key]) ?? [];
      list.push(row);
      map.set(row[key], list);
      return map;
    }, new Map());
    const monthlyByOwner = bucket(ownerMonthly, "owner");
    const productsByOwner = bucket(ownerProducts, "owner");
    const customersByOwner = bucket(ownerCustomers, "owner");
    const receiptsByOwner = new Map(ownerReceipts.map((row) => [row.owner, row]));
    const bookByOwner = new Map(ownerBook.map((row) => [row.owner, row.assignedCustomers]));
    const salesTotal = bySalesperson.reduce((sum, row) => sum + (row.salesValue ?? 0), 0);

    const bySalespersonDetailed = bySalesperson.map((row) => {
      const receipt = receiptsByOwner.get(row.name);
      return {
        ...row,
        averageInvoice: row.invoiceCount ? row.salesValue / row.invoiceCount : 0,
        sharePercent: salesTotal > 0 ? Math.round((row.salesValue / salesTotal) * 1000) / 10 : null,
        assignedCustomers: bookByOwner.get(row.name) ?? 0,
        receiptCount: receipt?.receiptCount ?? 0,
        receiptValue: receipt?.receiptValue ?? 0,
        monthly: monthlyByOwner.get(row.name) ?? [],
        topProducts: productsByOwner.get(row.name) ?? [],
        topCustomers: customersByOwner.get(row.name) ?? [],
      };
    });
    // Month-wise detail: headline figures, returns, volume and receipts per month.
    const monthlyBase = db.prepare(`SELECT substr(i.invoice_date,1,7) period,
        SUM(${netInvoiceAmount("i")}) salesValue,
        SUM(CASE WHEN lower(i.voucher_type) LIKE '%credit note%' OR lower(i.voucher_type) LIKE '%sales return%' THEN ABS(i.amount) ELSE 0 END) returnValue,
        SUM(CASE WHEN lower(i.voucher_type) LIKE '%credit note%' OR lower(i.voucher_type) LIKE '%sales return%' THEN 1 ELSE 0 END) returnCount,
        COUNT(*) invoiceCount,
        COUNT(DISTINCT i.customer_id) customerCount
      FROM tally_invoices i WHERE ${invoiceWhere}
      GROUP BY substr(i.invoice_date,1,7) ORDER BY period`).all(...reportArgs);

    const monthlyVolume = db.prepare(`SELECT substr(i.invoice_date,1,7) period,
        COALESCE(SUM(l.quantity),0) quantity, COUNT(DISTINCT l.product_name) productCount
      FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id
      WHERE ${invoiceWhere} GROUP BY substr(i.invoice_date,1,7)`).all(...reportArgs);

    const monthlyReceipts = db.prepare(`SELECT substr(payment_date,1,7) period, COUNT(*) receiptCount, COALESCE(SUM(amount),0) receiptValue
      FROM tally_payments_live WHERE ingest_session_id IS NULL AND payment_type='Receipt' AND payment_date>=? AND payment_date<=?
      GROUP BY substr(payment_date,1,7)`).all(start, end);

    const monthlyTopProducts = db.prepare(`SELECT period, name, salesValue, quantity FROM (
        SELECT substr(i.invoice_date,1,7) period, l.product_name name, SUM(${netInvoiceLineAmount("i","l")}) salesValue, SUM(l.quantity) quantity,
               ROW_NUMBER() OVER (PARTITION BY substr(i.invoice_date,1,7) ORDER BY SUM(${netInvoiceLineAmount("i","l")}) DESC) rn
        FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id
        WHERE ${invoiceWhere} GROUP BY substr(i.invoice_date,1,7), l.product_name
      ) WHERE rn <= 5`).all(...reportArgs);

    const monthlyTopCustomers = db.prepare(`SELECT period, name, salesValue, invoiceCount FROM (
        SELECT substr(i.invoice_date,1,7) period, COALESCE(c.name,i.customer_name) name, SUM(${netInvoiceAmount("i")}) salesValue, COUNT(*) invoiceCount,
               ROW_NUMBER() OVER (PARTITION BY substr(i.invoice_date,1,7) ORDER BY SUM(${netInvoiceAmount("i")}) DESC) rn
        FROM tally_invoices i LEFT JOIN tally_customers c ON c.id=i.customer_id
        WHERE ${invoiceWhere} GROUP BY substr(i.invoice_date,1,7), COALESCE(c.name,i.customer_name)
      ) WHERE rn <= 5`).all(...reportArgs);

    const volumeByPeriod = new Map(monthlyVolume.map((row) => [row.period, row]));
    const receiptsByPeriod = new Map(monthlyReceipts.map((row) => [row.period, row]));
    const groupByPeriod = (rows) => rows.reduce((map, row) => {
      const list = map.get(row.period) ?? [];
      list.push(row);
      map.set(row.period, list);
      return map;
    }, new Map());
    const productsByPeriod = groupByPeriod(monthlyTopProducts);
    const customersByPeriod = groupByPeriod(monthlyTopCustomers);
    const periodTotal = monthlyBase.reduce((sum, row) => sum + (row.salesValue ?? 0), 0);

    const monthly = monthlyBase.map((row, index) => {
      const previous = index > 0 ? monthlyBase[index - 1].salesValue : null;
      const volume = volumeByPeriod.get(row.period);
      const receipt = receiptsByPeriod.get(row.period);
      return {
        ...row,
        grossSalesValue: (row.salesValue ?? 0) + (row.returnValue ?? 0),
        averageInvoice: row.invoiceCount ? row.salesValue / row.invoiceCount : 0,
        quantity: volume?.quantity ?? 0,
        productCount: volume?.productCount ?? 0,
        receiptCount: receipt?.receiptCount ?? 0,
        receiptValue: receipt?.receiptValue ?? 0,
        sharePercent: periodTotal > 0 ? Math.round((row.salesValue / periodTotal) * 1000) / 10 : null,
        changePercent: previous && previous > 0 ? Math.round(((row.salesValue - previous) / previous) * 100) : null,
        topProducts: productsByPeriod.get(row.period) ?? [],
        topCustomers: customersByPeriod.get(row.period) ?? [],
      };
    });
    res.json({ from: start, to: end, filters: Object.fromEntries(["fy", "customerId", "productId", "salespersonId", "territory", "region", "dealer"].filter(key => req.query[key]).map(key => [key, req.query[key]])), summary: { ...summary, repeatCustomers: repeated, repeatCustomerPercent: summary.customerCount ? Math.round((repeated / summary.customerCount) * 100) : 0, unallocatedProductSales: unallocated.salesValue, unallocatedProductInvoices: unallocated.invoiceCount }, monthly, byProduct, bySalesperson: bySalespersonDetailed, byRegion, byCustomer });
  } catch (error) { next(error); }
});

adminRouter.get("/reports/history", (req, res, next) => {
  try {
    const items = db.prepare("SELECT id,report_type reportType,date_from dateFrom,date_to dateTo,created_at createdAt,payload_json payloadJson FROM generated_reports WHERE user_id=? AND report_type LIKE 'admin_sales_%' ORDER BY created_at DESC LIMIT 30").all(req.user.id).map((row) => { const payload = JSON.parse(row.payloadJson); return { ...row, summary: payload.summary, filters: payload.filters ?? {}, payloadJson: undefined }; });
    res.json({ items });
  } catch (error) { next(error); }
});

adminRouter.post("/reports/history", (req, res, next) => {
  try {
    const from = String(req.body?.from ?? ""), to = String(req.body?.to ?? ""), view = String(req.body?.view ?? "");
    if (!isBusinessDate(from) || !isBusinessDate(to) || from > to) return res.status(400).json({ error: "Choose a valid report date range" });
    if (!["monthly", "product", "salesperson", "region", "customer"].includes(view)) return res.status(400).json({ error: "Choose a valid report type" });
    const filterParts = [], filterArgs = [];
    const filters = req.body?.filters ?? {};
    if (!filters || typeof filters !== "object" || Array.isArray(filters)) return res.status(400).json({ error: "Report filters are invalid" });
    if (filters.fy) {
      if (typeof filters.fy !== "string" || financialYearOf(`${filters.fy.slice(0, 4)}-04`) !== filters.fy) return res.status(400).json({ error: "Financial year is invalid" });
      filterParts.push("i.invoice_date BETWEEN ? AND ?"); filterArgs.push(`${filters.fy.slice(0, 4)}-04-01`, `${Number(filters.fy.slice(0, 4)) + 1}-03-31`);
    }
    for (const key of ["customerId", "productId", "salespersonId", "territory", "region", "dealer"]) {
      const value = filters[key];
      if (value !== undefined && (typeof value !== "string" || value.length > 160)) return res.status(400).json({ error: `Invalid ${key} filter` });
      if (!value) continue;
      if (key === "customerId") { filterParts.push("i.customer_id=?"); filterArgs.push(value); }
      if (key === "productId") { filterParts.push("EXISTS(SELECT 1 FROM tally_invoice_lines fl WHERE fl.invoice_id=i.id AND (fl.product_id=? OR fl.product_name=?))"); filterArgs.push(value, value); }
      if (key === "salespersonId") {
        const selectedOwner = db.prepare("SELECT u.role FROM users u WHERE u.id=? AND u.active=1").get(value);
        const ownerIds = selectedOwner?.role === "rm" ? [value, ...db.prepare("SELECT user_id FROM salesperson_profiles WHERE manager_user_id=?").all(value).map((row) => row.user_id)] : [value];
        filterParts.push(`EXISTS(SELECT 1 FROM tally_customers fc WHERE fc.id=i.customer_id AND fc.owner_user_id IN (${ownerIds.map(() => "?").join(",")}))`); filterArgs.push(...ownerIds);
      }
      if (key === "territory") { filterParts.push("EXISTS(SELECT 1 FROM tally_customers fc JOIN salesperson_profiles fp ON fp.user_id=fc.owner_user_id WHERE fc.id=i.customer_id AND fp.territory=?)"); filterArgs.push(value); }
      if (key === "region") { filterParts.push("EXISTS(SELECT 1 FROM tally_customers fc JOIN salesperson_profiles fp ON fp.user_id=fc.owner_user_id WHERE fc.id=i.customer_id AND fp.region=?)"); filterArgs.push(value); }
      if (key === "dealer") { filterParts.push("EXISTS(SELECT 1 FROM tally_customers fc WHERE fc.id=i.customer_id AND lower(fc.party_type)=lower(?))"); filterArgs.push(value); }
    }
    const summary = db.prepare(`SELECT COALESCE(SUM(${netInvoiceAmount("i")}),0) totalSales,COUNT(*) invoiceCount,COUNT(DISTINCT i.customer_id) customerCount FROM tally_invoices i WHERE ${authoritativeInvoiceWhere("i")} AND i.invoice_date BETWEEN ? AND ?${filterParts.map((part) => ` AND ${part}`).join("")}`).get(from, to, ...filterArgs);
    const id = randomUUID();
    db.prepare("INSERT INTO generated_reports (id,user_id,report_type,date_from,date_to,payload_json) VALUES (?,?,?,?,?,?)").run(id, req.user.id, `admin_sales_${view}`, from, to, JSON.stringify({ summary, filters }));
    res.status(201).json({ id, reportType: `admin_sales_${view}`, dateFrom: from, dateTo: to, createdAt: new Date().toISOString(), summary, filters });
  } catch (error) { next(error); }
});

adminRouter.post("/reports/send-whatsapp", (_req, res) => {
  res.status(409).json({ error: "Free-text report sending is disabled. Use an approved recipient-specific report schedule." });
});

adminRouter.post("/ask-ai", aiLimiter, askAiHandler);

adminRouter.get("/customers", (req, res, next) => {
  try {
    const search = String(req.query.search ?? "").trim();
    const owner = String(req.query.rm ?? "").trim();
    const type = String(req.query.type ?? "").trim();
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const filters = [];
    const params = [];
    if (search) { filters.push("(lower(name) LIKE ? OR lower(city) LIKE ? OR lower(id) LIKE ?)"); params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`); }
    if (type) { filters.push("lower(party_type)=?"); params.push(type.toLowerCase()); }
    if (owner === "unassigned") filters.push("owner_user_id IS NULL");
    else if (owner) { filters.push("owner_user_id=?"); params.push(owner); }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const rows = db.prepare(`SELECT id,name,party_type type,rm_name rmName,owner_user_id ownerUserId,city,total_sales totalSales,outstanding,last_payment_date lastPaymentDate FROM tally_customers ${where} ORDER BY total_sales DESC`).all(...params)
      .map((row) => ({ ...row, rmId: row.ownerUserId, rmAssigned: Boolean(row.ownerUserId) }));
    const owners = db.prepare(`
      SELECT u.id userId,p.full_name name,u.role,p.territory
      FROM users u JOIN salesperson_profiles p ON p.user_id=u.id
      WHERE u.active=1 AND u.role IN ('salesperson','rm')
      ORDER BY p.full_name
    `).all();

    res.json({
      total: rows.length,
      items: rows.slice(offset, offset + limit),
      filters: {
        types: db.prepare("SELECT DISTINCT party_type type FROM tally_customers WHERE party_type IS NOT NULL AND party_type<>'' ORDER BY 1").all().map((row) => row.type),
        owners,
      },
    });
  } catch (error) { next(error); }
});

const customerOwnerSchema = z.object({ ownerUserId: z.string().min(1).nullable() });
const bulkCustomerOwnerSchema = customerOwnerSchema.extend({ customerIds: z.array(z.string().min(1)).min(1).max(200) });

function resolveCustomerOwner(ownerUserId) {
  if (!ownerUserId) return null;
  const owner = db.prepare(`
    SELECT u.id,p.full_name name FROM users u
    JOIN salesperson_profiles p ON p.user_id=u.id
    WHERE u.id=? AND u.active=1 AND u.role IN ('salesperson','rm')
  `).get(ownerUserId);
  if (!owner) throw Object.assign(new Error("Choose an active salesperson or RM"), { status: 400 });
  return owner;
}

adminRouter.patch("/customers/:id/owner", (req, res, next) => {
  try {
    const parsed = customerOwnerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Choose a valid customer owner" });
    const customer = db.prepare("SELECT id FROM tally_customers WHERE id=?").get(req.params.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    const owner = resolveCustomerOwner(parsed.data.ownerUserId);
    db.prepare("UPDATE tally_customers SET owner_user_id=?,rm_name=? WHERE id=?").run(owner?.id ?? null, owner?.name ?? null, req.params.id);
    res.json({ ok: true, customerId: req.params.id, owner });
  } catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); next(error); }
});

adminRouter.patch("/customers/owners/bulk", (req, res, next) => {
  try {
    const parsed = bulkCustomerOwnerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Select between 1 and 200 customers" });
    const owner = resolveCustomerOwner(parsed.data.ownerUserId);
    const update = db.prepare("UPDATE tally_customers SET owner_user_id=?,rm_name=? WHERE id=?");
    let updated = 0;
    transaction(() => {
      for (const customerId of [...new Set(parsed.data.customerIds)]) {
        updated += Number(update.run(owner?.id ?? null, owner?.name ?? null, customerId).changes || 0);
      }
    });
    res.json({ ok: true, updated, owner });
  } catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); next(error); }
});

adminRouter.get("/customers/:id", (req, res, next) => {
  try {
    const customer = db.prepare("SELECT id,name,party_type type,rm_name rmName,owner_user_id ownerUserId,rm_code rmCode,city,state,pincode,contact_name contactName,phone,email,gstin,destination_code destinationCode,total_sales totalSales,outstanding,last_payment_date lastPaymentDate,source_file sourceFile FROM tally_customers WHERE id=?").get(req.params.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    const monthly = db.prepare(`SELECT substr(i.invoice_date,1,7) period,SUM(${netInvoiceAmount("i")}) amount FROM tally_invoices i WHERE ${authoritativeInvoiceWhere("i")} AND i.customer_id=? GROUP BY substr(i.invoice_date,1,7) ORDER BY period`).all(req.params.id);
    const payments = db.prepare("SELECT id,payment_date paymentDate,payment_type paymentType,voucher_number voucherNumber,amount,reference FROM tally_payments_live WHERE customer_id=? AND ingest_session_id IS NULL ORDER BY payment_date DESC LIMIT 100").all(req.params.id);
    const invoices = db.prepare(`SELECT id,invoice_date invoiceDate,voucher_number voucherNumber,voucher_type voucherType,${netInvoiceAmount("i")} amount,reference FROM tally_invoices i WHERE customer_id=? AND ${authoritativeInvoiceWhere("i")} ORDER BY invoice_date DESC LIMIT 100`).all(req.params.id);
    const visits = db.prepare("SELECT v.id, v.business_date businessDate, v.purpose, v.status, v.outcome, p.full_name salesperson FROM visits v LEFT JOIN salesperson_profiles p ON p.user_id=v.user_id WHERE v.tally_customer_id=? ORDER BY v.business_date DESC LIMIT 20").all(req.params.id);
    res.json({ customer, monthly, payments, invoices, visits });
  } catch (error) { next(error); }
});

adminRouter.get("/products", (req, res, next) => {
  try {
    const search = String(req.query.search ?? "").trim().toLowerCase();
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const where = search ? "WHERE lower(name) LIKE ?" : "";
    const params = search ? [`%${search}%`] : [];
    const total = db.prepare(`SELECT COUNT(*) count FROM tally_products ${where}`).get(...params).count;
    const items = db.prepare(`SELECT id,name,packing_size packingSize,uom,rate,total_qty totalQuantity,total_value totalValue,frequency FROM tally_products ${where} ORDER BY total_value DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    res.json({ total, items });
  } catch (error) { next(error); }
});

adminRouter.get("/products/:id", (req, res, next) => {
  try {
    const product = db.prepare("SELECT id,name,packing_size packingSize,uom,rate,total_qty totalQuantity,total_value totalValue,frequency,source_file sourceFile FROM tally_products WHERE id=?").get(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    const monthly = db.prepare("SELECT period,quantity,sales_value salesValue FROM tally_product_monthly_sales WHERE product_id=? ORDER BY period").all(req.params.id);
    const invoices = db.prepare("SELECT i.id,i.invoice_date invoiceDate,i.voucher_number voucherNumber,i.customer_name customerName,l.quantity,l.rate,l.amount FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id WHERE l.product_id=? AND i.ingest_session_id IS NULL AND (i.source_sync_id IS NULL OR i.source_sync_id <> 'excel-import') ORDER BY i.invoice_date DESC LIMIT 100").all(req.params.id);
    const byRm = db.prepare("SELECT rm_name rmName, financial_year financialYear, quantity, sales_value salesValue FROM tally_rm_product_sales WHERE lower(product_name)=lower(?) ORDER BY sales_value DESC").all(product.name);
    res.json({ product, monthly, invoices, byRm });
  } catch (error) { next(error); }
});

adminRouter.get("/activity", (req, res, next) => {
  try {
    const customers = new Map(db.prepare("SELECT id,name FROM tally_customers").all().map((row) => [row.id, row.name]));
    const visits = db.prepare("SELECT v.id, v.business_date businessDate, v.scheduled_at scheduledAt, v.started_at startedAt, v.completed_at completedAt, v.tally_customer_id customerId, v.purpose, v.outcome, v.status, u.email, p.full_name fullName FROM visits v JOIN users u ON u.id=v.user_id LEFT JOIN salesperson_profiles p ON p.user_id=v.user_id ORDER BY v.business_date DESC, v.scheduled_at DESC LIMIT 100").all();
    const followUps = db.prepare("SELECT f.id, f.title, f.due_date dueDate, f.priority, f.completed, f.tally_customer_id customerId, u.email, p.full_name fullName FROM follow_ups f JOIN users u ON u.id=f.user_id LEFT JOIN salesperson_profiles p ON p.user_id=f.user_id ORDER BY f.completed, f.due_date LIMIT 100").all();
    const attendance = db.prepare("SELECT a.id, a.user_id userId, a.business_date businessDate, a.check_in_at checkInAt, a.check_out_at checkOutAt, a.latitude, a.longitude, u.email, p.full_name fullName, (SELECT COUNT(*) FROM location_pings lp WHERE lp.user_id=a.user_id AND date(lp.captured_at)=a.business_date) movementPoints, (SELECT lp.captured_at FROM location_pings lp WHERE lp.user_id=a.user_id AND date(lp.captured_at)=a.business_date ORDER BY lp.captured_at DESC LIMIT 1) lastLocationAt FROM attendance a JOIN users u ON u.id=a.user_id LEFT JOIN salesperson_profiles p ON p.user_id=a.user_id ORDER BY a.business_date DESC LIMIT 60").all();
    const withCustomer = (row) => ({ ...row, customer: customers.get(row.customerId) ?? row.customerId, completed: "completed" in row ? Boolean(row.completed) : undefined });
    res.json({
      visits: visits.map(withCustomer),
      followUps: followUps.map(withCustomer),
      attendance,
      today: today(),
    });
  } catch (error) { next(error); }
});

adminRouter.get("/activity/movement", (req, res, next) => {
  try {
    const userId = String(req.query.userId ?? "");
    const date = String(req.query.date ?? "");
    if (!userId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Salesperson and date are required" });
    const attendance = db.prepare(`SELECT a.check_in_at checkInAt,a.check_out_at checkOutAt,a.latitude,a.longitude,u.email,p.full_name fullName FROM attendance a JOIN users u ON u.id=a.user_id LEFT JOIN salesperson_profiles p ON p.user_id=a.user_id WHERE a.user_id=? AND a.business_date=?`).get(userId, date);
    if (!attendance) return res.status(404).json({ error: "Attendance record not found" });
    const points = db.prepare("SELECT latitude,longitude,accuracy,captured_at capturedAt FROM location_pings WHERE user_id=? AND date(captured_at)=? ORDER BY captured_at").all(userId, date);
    const allPoints = attendance.latitude !== null && attendance.longitude !== null
      ? [{ latitude: attendance.latitude, longitude: attendance.longitude, accuracy: null, capturedAt: attendance.checkInAt, kind: "check_in" }, ...points.map((point) => ({ ...point, kind: "movement" }))]
      : points.map((point) => ({ ...point, kind: "movement" }));
    const radians = (value) => value * Math.PI / 180;
    let distanceKm = 0;
    for (let index = 1; index < allPoints.length; index += 1) {
      const previous = allPoints[index - 1], current = allPoints[index];
      const dLat = radians(current.latitude - previous.latitude), dLng = radians(current.longitude - previous.longitude);
      const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(previous.latitude)) * Math.cos(radians(current.latitude)) * Math.sin(dLng / 2) ** 2;
      distanceKm += 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
    }
    res.json({ userId, date, attendance, points: allPoints, distanceKm: Number(distanceKm.toFixed(2)) });
  } catch (error) { next(error); }
});

adminRouter.get("/tally", async (req, res, next) => {
  try {
    const tables = [
      ["Customers", "tally_customers"],
      ["Customer monthly sales", "tally_customer_monthly_sales"],
      ["Products", "tally_products"],
      ["Product monthly sales", "tally_product_monthly_sales"],
      ["RM targets", "tally_rm_targets"],
      ["RM product sales", "tally_rm_product_sales"],
      ["Salespeople", "tally_salespeople"],
      ["Party payments", "tally_party_payments"],
      ["Live invoices", "tally_invoices"],
      ["Live invoice lines", "tally_invoice_lines"],
      ["Live receipts and payments", "tally_payments_live"],
      ["Purchase vouchers", "tally_purchases"],
      ["Purchase item lines", "tally_purchase_lines"],
    ].map(([label, table]) => ({ label, table, rows: db.prepare(`SELECT COUNT(*) count FROM ${table}`).get().count }));

    const sources = db.prepare("SELECT DISTINCT source_file file FROM tally_customers WHERE source_file IS NOT NULL AND source_file<>'' UNION SELECT DISTINCT source_file FROM tally_products WHERE source_file IS NOT NULL AND source_file<>'' ORDER BY 1").all().map((row) => row.file);
    const metadata = db.prepare("SELECT key,value FROM tally_import_metadata").all();
    const coverage = {
      customerSales: db.prepare("SELECT MIN(period) start, MAX(period) end FROM tally_customer_monthly_sales").get(),
      productSales: db.prepare("SELECT MIN(period) start, MAX(period) end FROM tally_product_monthly_sales").get(),
      targets: db.prepare("SELECT MIN(period) start, MAX(period) end FROM tally_rm_targets").get(),
    };
    const unassigned = db.prepare("SELECT DISTINCT rm_name name, COUNT(*) customers FROM tally_customers GROUP BY rm_name").all()
      .filter((row) => isNonPersonRm(row.name) || !normalizeName(row.name));
    const duplicateVouchers = db.prepare(`SELECT voucher_guid voucherGuid,COUNT(*) count FROM tally_invoices WHERE ingest_session_id IS NULL AND voucher_guid IS NOT NULL AND voucher_guid<>'' GROUP BY voucher_guid HAVING COUNT(*)>1 ORDER BY count DESC LIMIT 20`).all();
    const reusedVoucherNumbers = db.prepare(`SELECT company_name companyName,voucher_type voucherType,voucher_number voucherNumber,invoice_date invoiceDate,COUNT(*) count,COUNT(DISTINCT voucher_guid) distinctGuids FROM tally_invoices WHERE ingest_session_id IS NULL AND voucher_number IS NOT NULL AND voucher_number<>'' GROUP BY company_name,voucher_type,voucher_number,invoice_date HAVING COUNT(*)>1 ORDER BY count DESC LIMIT 20`).all();
    const missingCustomers = db.prepare(`SELECT COUNT(*) count FROM tally_invoices i LEFT JOIN tally_customers c ON c.id=i.customer_id WHERE i.ingest_session_id IS NULL AND (i.source_sync_id IS NULL OR i.source_sync_id <> 'excel-import') AND (i.customer_id IS NULL OR c.id IS NULL)`).get().count;
    const missingProducts = db.prepare(`SELECT COUNT(*) count FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id LEFT JOIN tally_products p ON p.id=l.product_id WHERE i.ingest_session_id IS NULL AND (i.source_sync_id IS NULL OR i.source_sync_id <> 'excel-import') AND (l.product_id IS NULL OR p.id IS NULL)`).get().count;
    const missingLineInvoices = db.prepare(`SELECT i.id,i.voucher_number voucherNumber,i.invoice_date invoiceDate,i.customer_name customerName,i.amount,i.voucher_guid voucherGuid FROM tally_invoices i WHERE i.ingest_session_id IS NULL AND (i.source_sync_id IS NULL OR i.source_sync_id <> 'excel-import') AND lower(i.voucher_type)='sales' AND ABS(i.amount)>0.01 AND NOT EXISTS(SELECT 1 FROM tally_invoice_lines l WHERE l.invoice_id=i.id) ORDER BY ABS(i.amount) DESC LIMIT 50`).all();
    const invoicesWithoutLines = missingLineInvoices.length;
    const ledgerOnlyVouchers = db.prepare(`SELECT COUNT(*) count FROM tally_invoices i WHERE i.ingest_session_id IS NULL AND (i.source_sync_id IS NULL OR i.source_sync_id <> 'excel-import') AND NOT EXISTS(SELECT 1 FROM tally_invoice_lines l WHERE l.invoice_id=i.id) AND NOT (lower(i.voucher_type)='sales' AND ABS(i.amount)>0.01)`).get().count;
    const lineVariances = db.prepare(`SELECT i.id,i.voucher_number voucherNumber,i.invoice_date invoiceDate,i.customer_name customerName,i.amount invoiceValue,COALESCE(SUM(l.amount),0) lineValue,ABS(i.amount-COALESCE(SUM(l.amount),0)) variance FROM tally_invoices i LEFT JOIN tally_invoice_lines l ON l.invoice_id=i.id WHERE i.ingest_session_id IS NULL AND (i.source_sync_id IS NULL OR i.source_sync_id <> 'excel-import') GROUP BY i.id,i.voucher_number,i.invoice_date,i.customer_name,i.amount HAVING COUNT(l.id)>0 AND ABS(i.amount-COALESCE(SUM(l.amount),0))>MAX(10,ABS(i.amount)*0.02) ORDER BY variance DESC LIMIT 20`).all();
    const staleSyncRuns = db.prepare(`SELECT COUNT(*) count FROM tally_sync_runs WHERE status NOT IN ('completed','stored') AND completed_at IS NULL AND datetime(started_at)<datetime('now','-30 minutes')`).get().count;
    const totals = db.prepare(`SELECT COUNT(*) invoiceCount,COALESCE(SUM(amount),0) invoiceValue,MIN(invoice_date) firstInvoiceDate,MAX(invoice_date) lastInvoiceDate FROM tally_invoices WHERE ingest_session_id IS NULL`).get();
    const lineTotals = db.prepare(`SELECT COUNT(*) lineCount,COALESCE(SUM(l.amount),0) lineValue FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id WHERE i.ingest_session_id IS NULL AND (i.source_sync_id IS NULL OR i.source_sync_id <> 'excel-import')`).get();
    const paymentsByType = db.prepare("SELECT payment_type type, COUNT(*) count, COALESCE(SUM(amount),0) value, MIN(payment_date) firstDate, MAX(payment_date) lastDate FROM tally_payments_live WHERE ingest_session_id IS NULL GROUP BY payment_type ORDER BY value DESC").all();
    const paymentTotals = db.prepare(`SELECT COUNT(*) paymentCount,COALESCE(SUM(amount),0) paymentValue,MIN(payment_date) firstPaymentDate,MAX(payment_date) lastPaymentDate FROM tally_payments_live WHERE ingest_session_id IS NULL`).get();
    const unassignedCustomers = db.prepare("SELECT COUNT(*) count FROM tally_customers WHERE owner_user_id IS NULL").get().count;
    const criticalIssues = duplicateVouchers.length + missingCustomers + missingProducts + invoicesWithoutLines + staleSyncRuns;
    const reconciliation = { paymentsByType, status: criticalIssues === 0 ? "healthy" : "attention", checkedAt: new Date().toISOString(), criticalIssues, duplicateVouchers, reusedVoucherNumbers, missingCustomers, missingProducts, invoicesWithoutLines, missingLineInvoices, ledgerOnlyVouchers, lineVariances, staleSyncRuns, unassignedCustomers, totals: { ...totals, ...lineTotals, ...paymentTotals } };

    res.json({
      status: await tally.status(),
      ...connectorState(),
      tables,
      sources,
      metadata,
      coverage,
      directory: buildRmDirectory(),
      placeholderOwners: unassigned,
      reconciliation,
      syncRuns: db.prepare("SELECT id, started_at startedAt, completed_at completedAt, status, entity_counts_json entityCountsJson, error_message errorMessage FROM tally_sync_runs ORDER BY started_at DESC LIMIT 10").all(),
    });
  } catch (error) { next(error); }
});

adminRouter.post("/tally/pairing-code", (req, res, next) => {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    const code = `PSS-${randomBytes(3).toString("hex").toUpperCase()}`;
    transaction(() => {
      db.prepare("UPDATE tally_connector_pairing_codes SET revoked_at=? WHERE used_at IS NULL AND revoked_at IS NULL").run(now.toISOString());
      db.prepare("INSERT INTO tally_connector_pairing_codes (id,code_hash,code_hint,created_by,created_at,expires_at) VALUES (?,?,?,?,?,?)")
        .run(randomUUID(), pairingCodeHash(code), code.slice(-4), req.user.id, now.toISOString(), expiresAt);
    });
    res.status(201).json({ code, expiresAt });
  } catch (error) { next(error); }
});

adminRouter.delete("/tally/pairing-code", (req, res, next) => {
  try {
    db.prepare("UPDATE tally_connector_pairing_codes SET revoked_at=? WHERE used_at IS NULL AND revoked_at IS NULL").run(new Date().toISOString());
    res.json({ ok: true });
  } catch (error) { next(error); }
});

adminRouter.post("/tally/connector/revoke", (req, res, next) => {
  try {
    const now = new Date().toISOString();
    transaction(() => {
      db.prepare("UPDATE tally_connectors SET status='revoked', revoked_at=? WHERE revoked_at IS NULL").run(now);
      db.prepare("UPDATE tally_connector_pairing_codes SET revoked_at=? WHERE used_at IS NULL AND revoked_at IS NULL").run(now);
    });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

/* ------------------------------ user management ---------------------------- */

const roles = ["salesperson", "rm", "admin"];
const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the full name"),
  mobileNumber: z.string().trim().max(25, "Mobile number is too long").refine((value) => {
    if (!value) return true;
    const digits = value.replace(/\D/g, "");
    return /^[+]?[0-9][0-9\s().-]*$/.test(value) && digits.length >= 7 && digits.length <= 15;
  }, "Enter a valid mobile number").optional(),
  employeeCode: z.string().trim().max(40).optional(),
  region: z.string().trim().max(80).optional(),
  territory: z.string().trim().max(120).optional(),
  monthlyTarget: z.number().min(0).optional(),
  managerUserId: z.string().trim().optional().nullable(),
});
const createUserSchema = profileSchema.extend({
  email: z.string().trim().email("Enter a valid work email"),
  role: z.enum(roles),
  initialPassword: z.string().min(12, "Temporary password must be at least 12 characters").max(200, "Temporary password is too long").optional(),
});
const updateUserSchema = profileSchema.partial().extend({
  role: z.enum(roles).optional(),
  active: z.boolean().optional(),
});

function validateSalespersonManager(role, managerUserId) {
  if (!managerUserId) return null;
  if (role !== "salesperson") return "Only salespeople can be assigned to an RM";
  const manager = db.prepare("SELECT id FROM users WHERE id=? AND role='rm' AND active=1").get(managerUserId);
  if (!manager) return "Select an active regional manager";
  return null;
}

function listUsers() {
  return db.prepare(`
    SELECT u.id, u.email, u.role, u.active, u.created_at createdAt,
           p.employee_code employeeCode, p.full_name fullName, p.mobile_number mobileNumber, p.region, p.territory,
           p.monthly_target monthlyTarget, p.manager_user_id managerUserId, manager.full_name managerName,
           COALESCE((SELECT COALESCE(d.status,q.status) FROM auth_email_queue q
             LEFT JOIN auth_email_delivery d ON d.id=q.id
             WHERE q.user_id=u.id AND q.purpose='activate' ORDER BY q.created_at DESC,q.id DESC LIMIT 1),
             (SELECT d.status FROM auth_email_delivery d WHERE d.user_id=u.id AND d.purpose='activate' ORDER BY d.created_at DESC LIMIT 1)) invitationEmailStatus,
           EXISTS(SELECT 1 FROM auth_tokens t WHERE t.user_id=u.id AND t.purpose='activate' AND t.expires_at>?) invitationPending,
           (SELECT COUNT(*) FROM sessions s WHERE s.user_id=u.id AND s.expires_at>datetime('now')) activeSessions,
           (SELECT COUNT(*) FROM visits v WHERE v.user_id=u.id) visitCount
    FROM users u LEFT JOIN salesperson_profiles p ON p.user_id=u.id
    LEFT JOIN salesperson_profiles manager ON manager.user_id=p.manager_user_id
    ORDER BY u.role, p.full_name, u.email
  `).all(new Date().toISOString()).map((row) => ({ ...row, active: Boolean(row.active), invitationPending: Boolean(row.invitationPending) }));
}

const activeAdminCount = () => db.prepare("SELECT COUNT(*) count FROM users WHERE role='admin' AND active=1").get().count;

adminRouter.get("/users", (req, res, next) => {
  try {
    res.json({ items: listUsers(), roles, managers: db.prepare("SELECT u.id, p.full_name fullName, u.email FROM users u JOIN salesperson_profiles p ON p.user_id=u.id WHERE u.role='rm' AND u.active=1 ORDER BY p.full_name").all() });
  } catch (error) { next(error); }
});

adminRouter.post("/users", async (req, res, next) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the form" });
    const input = parsed.data;
    if (input.role === "salesperson" && !input.managerUserId) return res.status(400).json({ error: "Assign the salesperson to an active RM before creating the account" });
    const managerError = validateSalespersonManager(input.role, input.managerUserId);
    if (managerError) return res.status(400).json({ error: managerError });
    const email = input.email.toLowerCase();
    if (db.prepare("SELECT id FROM users WHERE email=?").get(email)) return res.status(409).json({ error: "A user with that email already exists" });

    const id = randomUUID();
    const employeeCode = input.employeeCode?.trim() || `PSSPL-${input.role.slice(0, 1).toUpperCase()}-${id.slice(0, 6).toUpperCase()}`;
    if (db.prepare("SELECT user_id FROM salesperson_profiles WHERE employee_code=?").get(employeeCode)) return res.status(409).json({ error: "That employee code is already in use" });

    transaction(() => {
      // Store only the hash. The account remains inactive until the work-email activation link is used.
      db.prepare("INSERT INTO users (id,email,password_hash,role,active) VALUES (?,?,?,?,0)").run(id, email, passwordHash(input.initialPassword ?? randomBytes(48).toString("base64url")), input.role);
      db.prepare("INSERT INTO salesperson_profiles (user_id,employee_code,full_name,mobile_number,region,territory,manager_user_id,monthly_target) VALUES (?,?,?,?,?,?,?,?)")
        .run(id, employeeCode, input.fullName, input.mobileNumber || null, input.region || "Not set", input.territory || "Not set", input.managerUserId || null, input.monthlyTarget ?? 0);
    });
    let invitation;
    try { invitation = await issueAccountToken({ id, email }, "activate"); }
    catch { invitation = { sent: false, reason: "email_delivery_failed" }; }
    res.status(201).json({ user: listUsers().find((user) => user.id === id), invitation });
  } catch (error) { next(error); }
});

adminRouter.post("/users/:id/invitation", async (req, res, next) => {
  try {
    const target = db.prepare("SELECT id,email,active FROM users WHERE id=?").get(req.params.id);
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.active) return res.status(409).json({ error: "This account is already active" });
    const invitation = await issueAccountToken(target, "activate");
    res.json({ invitation });
  } catch (error) { next(error); }
});

adminRouter.patch("/users/:id", (req, res, next) => {
  try {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the form" });
    const input = parsed.data;
    const target = db.prepare("SELECT id, role, active FROM users WHERE id=?").get(req.params.id);
    if (!target) return res.status(404).json({ error: "User not found" });
    const managerError = validateSalespersonManager(input.role ?? target.role, input.managerUserId);
    if (managerError) return res.status(400).json({ error: managerError });

    const isSelf = target.id === req.user.id;
    if (isSelf && input.active === false) return res.status(400).json({ error: "You cannot deactivate your own account" });
    if (isSelf && input.role && input.role !== target.role) return res.status(400).json({ error: "You cannot change your own role" });

    const losesAdmin = target.role === "admin" && Boolean(target.active) && ((input.role && input.role !== "admin") || input.active === false);
    if (losesAdmin && activeAdminCount() <= 1) return res.status(400).json({ error: "At least one active admin must remain" });

    transaction(() => {
      if (input.role) db.prepare("UPDATE users SET role=? WHERE id=?").run(input.role, target.id);
      if (input.active !== undefined) {
        db.prepare("UPDATE users SET active=? WHERE id=?").run(input.active ? 1 : 0, target.id);
        if (!input.active) db.prepare("DELETE FROM sessions WHERE user_id=?").run(target.id);
        // A manual status change must not leave old activation or reset links usable.
        db.prepare("DELETE FROM auth_tokens WHERE user_id=?").run(target.id);
      }
      const profile = db.prepare("SELECT user_id FROM salesperson_profiles WHERE user_id=?").get(target.id);
      const fields = [
        ["full_name", input.fullName],
        ["mobile_number", input.mobileNumber === "" ? null : input.mobileNumber],
        ["region", input.region],
        ["territory", input.territory],
        ["monthly_target", input.monthlyTarget],
        ["employee_code", input.employeeCode],
        ["manager_user_id", input.managerUserId === "" ? null : input.managerUserId],
      ].filter(([, value]) => value !== undefined);
      if (!fields.length) return;
      if (profile) {
        db.prepare(`UPDATE salesperson_profiles SET ${fields.map(([column]) => `${column}=?`).join(",")} WHERE user_id=?`).run(...fields.map(([, value]) => value ?? null), target.id);
      } else if (input.fullName) {
        db.prepare("INSERT INTO salesperson_profiles (user_id,employee_code,full_name,mobile_number,region,territory,monthly_target) VALUES (?,?,?,?,?,?,?)")
          .run(target.id, input.employeeCode?.trim() || `PSSPL-U-${target.id.slice(0, 6).toUpperCase()}`, input.fullName, input.mobileNumber || null, input.region || "Not set", input.territory || "Not set", input.monthlyTarget ?? 0);
      }
    });
    res.json({ user: listUsers().find((user) => user.id === target.id) });
  } catch (error) { next(error); }
});

adminRouter.post("/users/:id/password", (req, res, next) => {
  try {
    const parsed = z.object({ password: z.string().min(12, "Password must be at least 12 characters").max(200) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check the form" });
    const target = db.prepare("SELECT id FROM users WHERE id=?").get(req.params.id);
    if (!target) return res.status(404).json({ error: "User not found" });
    transaction(() => {
      db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(passwordHash(parsed.data.password), target.id);
      db.prepare("DELETE FROM auth_tokens WHERE user_id=?").run(target.id);
      // Signing out other devices is the point of a reset; keep the admin's own session.
      if (target.id !== req.user.id) db.prepare("DELETE FROM sessions WHERE user_id=?").run(target.id);
    });
    res.json({ ok: true });
  } catch (error) { next(error); }
});
