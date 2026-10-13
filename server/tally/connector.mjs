import { db } from "../db.mjs";
import { buildRmDirectory, resolveRmId } from "../rm-directory.mjs";

class TallyConnectorClient {
  async customers({ salespersonId } = {}) {
    if (!salespersonId) return db.prepare("SELECT id,name,city,party_type type,rm_name rmName,total_sales totalSales,outstanding,last_payment_date lastPaymentDate FROM tally_customers ORDER BY total_sales DESC").all();
    const profile = db.prepare("SELECT full_name FROM salesperson_profiles WHERE user_id=?").get(salespersonId);
    const directory = buildRmDirectory();
    const rm = directory.find((entry) => entry.id === salespersonId || (entry.keys && entry.keys.includes(salespersonId)) || resolveRmId(directory, profile?.full_name || "") === entry.id);
    const allNames = rm ? [rm.name, ...rm.aliases] : [profile?.full_name].filter(Boolean);
    const nameList = allNames.length ? allNames.map(() => "?").join(",") : "";

    return db.prepare(`
      SELECT id,name,city,party_type type,rm_name rmName,total_sales totalSales,outstanding,last_payment_date lastPaymentDate
      FROM tally_customers c
      WHERE c.owner_user_id=?
         OR c.owner_user_id IN (SELECT user_id FROM salesperson_profiles WHERE manager_user_id=?)
         OR (c.rm_name IN (${nameList}))
         OR (c.owner_user_id IS NULL AND lower(replace(COALESCE(c.rm_name,''),' ',''))=lower(replace(?,' ','')))
      ORDER BY total_sales DESC
    `).all(salespersonId, salespersonId, ...allNames, profile?.full_name ?? "");
  }

  async products() {
    return db.prepare("SELECT id,name,COALESCE(uom,'') 'group',packing_size packingSize,rate,total_qty totalQuantity,total_value totalValue,frequency FROM tally_products ORDER BY total_value DESC").all();
  }

  async salesSummary({ salespersonId }) {
    const profile = db.prepare("SELECT full_name, employee_code, monthly_target FROM salesperson_profiles WHERE user_id=?").get(salespersonId);
    const directory = buildRmDirectory();
    const rm = directory.find((entry) => entry.id === salespersonId || (entry.keys && entry.keys.includes(salespersonId)) || resolveRmId(directory, profile?.full_name || "") === entry.id);
    const allNames = rm ? [rm.name, ...rm.aliases] : [profile?.full_name].filter(Boolean);
    const nameList = allNames.length ? allNames.map(() => "?").join(",") : "";

    const todayStr = new Date().toISOString().slice(0, 10);
    let monthStart = todayStr.slice(0, 7) + "-01";
    const [year, month] = monthStart.split("-").map(Number);
    let nextMonth = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);

    // Detect latest active invoice date in database for this salesperson/RM
    const maxDateRow = allNames.length ? db.prepare(`
      SELECT MAX(i.invoice_date) maxDate
      FROM tally_invoices i
      JOIN tally_customers c ON c.id = i.customer_id
      WHERE i.ingest_session_id IS NULL AND c.rm_name IN (${nameList})
    `).get(...allNames) : null;
    const latestActiveDate = maxDateRow?.maxDate || todayStr;
    const latestActiveMonth = latestActiveDate.slice(0, 7);

    let periodLabel = "This Month";
    let queryStart = monthStart;
    let queryEnd = nextMonth;

    let liveSales = allNames.length ? db.prepare(`
      SELECT COALESCE(SUM(i.amount),0) total
      FROM tally_invoices i
      JOIN tally_customers c ON c.id=i.customer_id
      WHERE i.ingest_session_id IS NULL AND i.invoice_date>=? AND i.invoice_date<?
        AND (c.owner_user_id=? OR c.rm_name IN (${nameList}))
    `).get(queryStart, queryEnd, salespersonId, ...allNames) : { total: 0 };

    if ((!liveSales || liveSales.total === 0) && monthStart.slice(0, 7) > latestActiveMonth) {
      queryStart = `${latestActiveMonth}-01`;
      const [ay, am] = latestActiveMonth.split("-").map(Number);
      queryEnd = new Date(Date.UTC(ay, am, 1)).toISOString().slice(0, 10);
      periodLabel = `This Month (${latestActiveMonth} active ledger)`;
      if (allNames.length) {
        liveSales = db.prepare(`
          SELECT COALESCE(SUM(i.amount),0) total
          FROM tally_invoices i
          JOIN tally_customers c ON c.id=i.customer_id
          WHERE i.ingest_session_id IS NULL AND i.invoice_date>=? AND i.invoice_date<?
            AND (c.owner_user_id=? OR c.rm_name IN (${nameList}))
        `).get(queryStart, queryEnd, salespersonId, ...allNames);
      }
    }

    const total = liveSales?.total ?? 0;

    // Target calculation: check tally_rm_targets first
    const fromMonth = queryStart.slice(0, 7);
    const rmTargetRow = allNames.length ? db.prepare(`
      SELECT COALESCE(SUM(target_lakh * 100000), 0) totalTarget
      FROM tally_rm_targets
      WHERE rm_name IN (${nameList}) AND period = ?
    `).get(...allNames, fromMonth) : null;

    const rawTarget = profile?.monthly_target ?? 0;
    const baseMonthly = rawTarget > 10 ? Math.round(rawTarget * 100000) : Math.round(rawTarget * 10000000);
    const targetRupees = (rmTargetRow?.totalTarget > 0 ? rmTargetRow.totalTarget : null) || baseMonthly || 4593000;
    const targetCr = Number((targetRupees / 10000000).toFixed(2));
    const actualCr = Number((total / 10000000).toFixed(2));
    const achievement = targetRupees > 0 ? Math.round((total / targetRupees) * 100) : 0;

    const repeat = db.prepare("SELECT COUNT(*) total, SUM(CASE WHEN active_months>1 THEN 1 ELSE 0 END) repeated FROM (SELECT customer_id,COUNT(CASE WHEN amount>0 THEN 1 END) active_months FROM tally_customer_monthly_sales GROUP BY customer_id)").get();
    return {
      actual: actualCr,
      target: targetCr,
      actualRupees: total,
      targetRupees,
      achievement,
      periodLabel,
      repeatSalesPercent: repeat.total ? Math.round((repeat.repeated / repeat.total) * 100) : 0,
      currencyLabel: "Cr",
    };
  }

  async overview({ salespersonId }) {
    const profile = db.prepare("SELECT full_name FROM salesperson_profiles WHERE user_id=?").get(salespersonId);
    const directory = buildRmDirectory();
    const rm = directory.find((entry) => entry.id === salespersonId || (entry.keys && entry.keys.includes(salespersonId)) || resolveRmId(directory, profile?.full_name || "") === entry.id);
    const allNames = rm ? [rm.name, ...rm.aliases] : [profile?.full_name].filter(Boolean);
    const nameList = allNames.length ? allNames.map(() => "?").join(",") : "";

    const topProducts = db.prepare(`
      SELECT l.product_name name,SUM(l.amount) salesValue,SUM(l.quantity) quantity
      FROM tally_invoice_lines l
      JOIN tally_invoices i ON i.id=l.invoice_id
      JOIN tally_customers c ON c.id=i.customer_id
      WHERE i.ingest_session_id IS NULL
        AND (c.owner_user_id=? OR c.owner_user_id IN (SELECT user_id FROM salesperson_profiles WHERE manager_user_id=?) OR c.rm_name IN (${nameList}))
      GROUP BY l.product_name ORDER BY salesValue DESC LIMIT 5
    `).all(salespersonId, salespersonId, ...allNames);
    const customers = db.prepare(`
      SELECT COUNT(*) count,COALESCE(SUM(outstanding),0) outstanding
      FROM tally_customers c
      WHERE c.owner_user_id=? OR c.owner_user_id IN (SELECT user_id FROM salesperson_profiles WHERE manager_user_id=?) OR c.rm_name IN (${nameList})
    `).get(salespersonId, salespersonId, ...allNames);
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
