import { db } from "../db.mjs";

class TallyConnectorClient {
  async customers({ salespersonId } = {}) {
    if (!salespersonId) return db.prepare("SELECT id,name,city,party_type type,rm_name rmName,total_sales totalSales,outstanding,last_payment_date lastPaymentDate FROM tally_customers ORDER BY total_sales DESC").all();
    const profile = db.prepare("SELECT full_name FROM salesperson_profiles WHERE user_id=?").get(salespersonId);
    return db.prepare(`
      SELECT id,name,city,party_type type,rm_name rmName,total_sales totalSales,outstanding,last_payment_date lastPaymentDate
      FROM tally_customers c
      WHERE c.owner_user_id=?
         OR c.owner_user_id IN (SELECT user_id FROM salesperson_profiles WHERE manager_user_id=?)
         OR (c.owner_user_id IS NULL AND lower(replace(COALESCE(c.rm_name,''),' ',''))=lower(replace(?,' ','')))
      ORDER BY total_sales DESC
    `).all(salespersonId, salespersonId, profile?.full_name ?? "");
  }

  async products() {
    return db.prepare("SELECT id,name,COALESCE(uom,'') 'group',packing_size packingSize,rate,total_qty totalQuantity,total_value totalValue,frequency FROM tally_products ORDER BY total_value DESC").all();
  }

  async salesSummary({ salespersonId }) {
    const profile = db.prepare("SELECT full_name FROM salesperson_profiles WHERE user_id=?").get(salespersonId);
    const rmName = profile?.full_name ?? "";
    const monthStart = new Date().toISOString().slice(0, 7) + "-01";
    const [year, month] = monthStart.split("-").map(Number);
    const nextMonth = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
    const liveSales = db.prepare(`
      SELECT COALESCE(SUM(i.amount),0) total
      FROM tally_invoices i
      JOIN tally_customers c ON c.id=i.customer_id
      WHERE i.ingest_session_id IS NULL AND i.invoice_date>=? AND i.invoice_date<?
        AND (c.owner_user_id=? OR (c.owner_user_id IS NULL AND lower(replace(COALESCE(c.rm_name,''),' ',''))=lower(replace(?,' ',''))))
    `).get(monthStart, nextMonth, salespersonId, rmName);
    const total = liveSales.total ?? 0;
    const repeat = db.prepare("SELECT COUNT(*) total, SUM(CASE WHEN active_months>1 THEN 1 ELSE 0 END) repeated FROM (SELECT customer_id,COUNT(CASE WHEN amount>0 THEN 1 END) active_months FROM tally_customer_monthly_sales GROUP BY customer_id)").get();
    return { actual: Number((total / 10000000).toFixed(2)), repeatSalesPercent: repeat.total ? Math.round((repeat.repeated / repeat.total) * 100) : 0, currencyLabel: "Cr" };
  }

  async overview({ salespersonId }) {
    const profile = db.prepare("SELECT full_name FROM salesperson_profiles WHERE user_id=?").get(salespersonId);
    const rmName = profile?.full_name ?? "";
    const topProducts = db.prepare(`SELECT l.product_name name,SUM(l.amount) salesValue,SUM(l.quantity) quantity FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id JOIN tally_customers c ON c.id=i.customer_id WHERE i.ingest_session_id IS NULL AND (c.owner_user_id=? OR c.owner_user_id IN (SELECT user_id FROM salesperson_profiles WHERE manager_user_id=?) OR (c.owner_user_id IS NULL AND lower(replace(COALESCE(c.rm_name,''),' ',''))=lower(replace(?,' ','')))) GROUP BY l.product_name ORDER BY salesValue DESC LIMIT 5`).all(salespersonId, salespersonId, rmName);
    const customers = db.prepare(`SELECT COUNT(*) count,COALESCE(SUM(outstanding),0) outstanding FROM tally_customers c WHERE c.owner_user_id=? OR c.owner_user_id IN (SELECT user_id FROM salesperson_profiles WHERE manager_user_id=?) OR (c.owner_user_id IS NULL AND lower(replace(COALESCE(c.rm_name,''),' ',''))=lower(replace(?,' ','')))`).get(salespersonId, salespersonId, rmName);
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
