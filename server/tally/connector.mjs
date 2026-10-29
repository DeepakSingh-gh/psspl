import { db } from "../db.mjs";
import { indiaBusinessDate } from "../../shared/business-date.mjs";
import { buildRmDirectory, resolveRmId } from "../rm-directory.mjs";
import { authoritativeInvoiceWhere, netInvoiceAmount, netInvoiceLineAmount, rupeesToCrore } from "./metrics.mjs";

class TallyConnectorClient {
  customerOwnerIds(userId) {
    const user = db.prepare("SELECT role,active FROM users WHERE id=?").get(userId);
    if (!user || !user.active || user.role === "admin") return [];
    if (user.role === "rm") {
      return [userId, ...db.prepare("SELECT user_id FROM salesperson_profiles WHERE manager_user_id=?").all(userId).map((row) => row.user_id)];
    }
    // A salesperson is scoped to their own customers. Team visibility belongs
    // to the RM role and is computed from manager_user_id in RM endpoints.
    return [userId];
  }

  async customers({ salespersonId, directory: suppliedDirectory } = {}) {
    if (!salespersonId) return db.prepare("SELECT id,name,city,party_type type,rm_name rmName,total_sales totalSales,outstanding,last_payment_date lastPaymentDate FROM tally_customers ORDER BY total_sales DESC").all();
    const user = db.prepare("SELECT role,active FROM users WHERE id=?").get(salespersonId);
    if (user?.role === "admin" && user.active) return this.customers({});
    const ownerIds = this.customerOwnerIds(salespersonId);
    if (!ownerIds.length) return [];
    const placeholders = ownerIds.map(() => "?").join(",");
    return db.prepare(`
      SELECT id,name,city,party_type type,rm_name rmName,total_sales totalSales,outstanding,last_payment_date lastPaymentDate
      FROM tally_customers c
      WHERE c.owner_user_id IN (${placeholders})
      ORDER BY total_sales DESC
    `).all(...ownerIds);
  }

  async products() {
    return db.prepare("SELECT id,name,COALESCE(uom,'') 'group',packing_size packingSize,rate,total_qty totalQuantity,total_value totalValue,frequency FROM tally_products ORDER BY total_value DESC").all();
  }

  async salesSummary({ salespersonId, directory = buildRmDirectory(), includeRepeat = true }) {
    const profile = db.prepare("SELECT full_name, employee_code, monthly_target FROM salesperson_profiles WHERE user_id=?").get(salespersonId);
    const isAdmin = Boolean(db.prepare("SELECT 1 FROM users WHERE id=? AND role='admin' AND active=1").get(salespersonId));
    const ownerIds = this.customerOwnerIds(salespersonId);
    const ownerPlaceholders = ownerIds.map(() => "?").join(",");
    const ownerScope = isAdmin ? "1=1" : `c.owner_user_id IN (${ownerPlaceholders})`;

    const todayStr = indiaBusinessDate();
    let monthStart = todayStr.slice(0, 7) + "-01";
    const [year, month] = monthStart.split("-").map(Number);
    let nextMonth = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);

    const queryStart = monthStart;
    const queryEnd = nextMonth;

    let liveSales = ownerIds.length || isAdmin ? db.prepare(`
      SELECT COALESCE(SUM(${netInvoiceAmount("i")}),0) total
      FROM tally_invoices i
      JOIN tally_customers c ON c.id=i.customer_id
      WHERE ${authoritativeInvoiceWhere("i")} AND i.invoice_date>=? AND i.invoice_date<?
        AND ${ownerScope}
    `).get(queryStart, queryEnd, ...(isAdmin ? [] : ownerIds)) : { total: 0 };

    const total = liveSales?.total ?? 0;

    // Target calculation: check tally_rm_targets first
    const fromMonth = queryStart.slice(0, 7);
    const profileName = profile?.full_name;
    const rmTargetRow = profileName ? db.prepare(`
      SELECT COALESCE(SUM(target_lakh * 100000), 0) totalTarget
      FROM tally_rm_targets
      WHERE rm_name = ? AND period = ?
    `).get(profileName, fromMonth) : null;

    const targetRupees = rmTargetRow?.totalTarget > 0 ? rmTargetRow.totalTarget : null;
    const targetCr = targetRupees === null ? null : rupeesToCrore(targetRupees);
    const actualCr = rupeesToCrore(total);
    const achievement = targetRupees > 0 ? Math.round((total / targetRupees) * 100) : null;

    const repeat = includeRepeat && ownerIds.length ? db.prepare(`SELECT COUNT(*) total,SUM(CASE WHEN active_months>1 THEN 1 ELSE 0 END) repeated FROM (
      SELECT customer_id,COUNT(DISTINCT substr(invoice_date,1,7)) active_months FROM tally_invoices i
      JOIN tally_customers c ON c.id=i.customer_id
      WHERE ${authoritativeInvoiceWhere("i")} AND i.invoice_date>=date(?,'-12 months') AND c.owner_user_id IN (${ownerPlaceholders})
      GROUP BY customer_id
    )`).get(todayStr, ...ownerIds) : { total: 0, repeated: 0 };
    return {
      actual: actualCr,
      target: targetCr,
      actualRupees: total,
      targetRupees,
      achievement,
      periodLabel: "This Month",
      repeatSalesPercent: repeat.total ? Math.round((repeat.repeated / repeat.total) * 100) : 0,
      currencyLabel: "Cr",
    };
  }

  async overview({ salespersonId, directory = buildRmDirectory() }) {
    const isAdmin = Boolean(db.prepare("SELECT 1 FROM users WHERE id=? AND role='admin' AND active=1").get(salespersonId));
    const ownerIds = this.customerOwnerIds(salespersonId);
    if (!ownerIds.length && !isAdmin) return { topProducts: [], decliningProducts: [], customerCount: 0, totalOutstanding: 0 };
    const ownerPlaceholders = ownerIds.map(() => "?").join(",");
    const ownerScope = isAdmin ? "1=1" : `c.owner_user_id IN (${ownerPlaceholders})`;

    const topProducts = db.prepare(`
      SELECT l.product_name name,SUM(${netInvoiceLineAmount("i","l")}) salesValue,SUM(l.quantity) quantity
      FROM tally_invoices i
      JOIN tally_invoice_lines l ON l.invoice_id=i.id
      WHERE ${authoritativeInvoiceWhere("i")}
        AND i.customer_id IN (
          SELECT c.id FROM tally_customers c
          WHERE ${ownerScope}
        )
      GROUP BY l.product_name ORDER BY salesValue DESC LIMIT 5
    `).all(...(isAdmin ? [] : ownerIds));
    const customers = db.prepare(`
      SELECT COUNT(*) count,COALESCE(SUM(outstanding),0) outstanding
      FROM tally_customers c
      WHERE ${ownerScope}
    `).get(...(isAdmin ? [] : ownerIds));
    return { topProducts, decliningProducts: [], customerCount: customers.count, totalOutstanding: customers.outstanding };
  }

  async status() {
    const connector = db.prepare("SELECT tally_company company,last_heartbeat_at lastHeartbeatAt,last_sync_at lastSyncAt,tally_available tallyAvailable FROM tally_connectors WHERE revoked_at IS NULL ORDER BY paired_at DESC LIMIT 1").get();
    if (!connector) return { mode: "live_connector", connected: false, lastSyncAt: null, message: "Waiting for an admin to pair the Tally connector" };
    const recent = connector.lastHeartbeatAt && Date.now() - new Date(connector.lastHeartbeatAt).getTime() < 3 * 60 * 1000;
    return {
      mode: "live_connector",
      connected: Boolean(recent && connector.tallyAvailable),
      lastSyncAt: connector.lastSyncAt,
      message: recent
        ? connector.tallyAvailable ? `Live Tally connection${connector.company ? ` · ${connector.company}` : ""}` : "Connector is online, but Tally is not available"
        : "Tally connector is offline or has not sent a recent heartbeat",
    };
  }
}

export const tally = new TallyConnectorClient();
