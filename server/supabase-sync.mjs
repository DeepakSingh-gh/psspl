import pg from "pg";

// Explicit business-data allowlist. Authentication, connector secrets, pairing
// codes, audit trails and transient staged payloads are intentionally excluded.
const REPLICATED_TABLES = new Set([
  "customer_activities", "expected_orders", "follow_ups",
  "leads", "salesperson_profiles", "service_requests",
  "tally_connectors", "tally_customer_monthly_sales", "tally_customers", "tally_invoice_lines",
  "tally_invoices", "tally_party_payments", "tally_payments_live", "tally_product_monthly_sales",
  "tally_products", "tally_purchase_lines", "tally_purchases", "tally_rm_product_sales",
  "tally_rm_targets", "tally_salespeople", "tally_sync_runs", "thrust_products", "visit_products", "visits",
]);

const connectionString = process.env.DIRECT_URL;
if (!connectionString) {
  console.error("DIRECT_URL not found in .env");
  process.exit(1);
}

const { db } = await import("./db.mjs");

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: true }
});

async function syncToSupabase() {
  console.log("Connecting to Supabase Postgres...");
  const client = await pool.connect();
  
  try {
    console.log("Connected! Fetching SQLite tables...");
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()
      .filter(({ name }) => REPLICATED_TABLES.has(name));
    
    for (const { name: tableName } of tables) {
      console.log(`Syncing table: ${tableName}`);
      
      // Get table info from SQLite
      const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
      
      // Create table in Postgres if not exists
      const pks = columns.filter(c => c.pk > 0).sort((a, b) => a.pk - b.pk);
      
      const pgColumns = columns.map(col => {
        let type = "TEXT";
        if (col.type === "INTEGER") type = "BIGINT";
        if (col.type === "REAL") type = "DOUBLE PRECISION";
        let def = `"${col.name}" ${type}`;
        if (col.pk > 0 && pks.length === 1) def += " PRIMARY KEY";
        return def;
      });
      
      if (pks.length > 1) {
        pgColumns.push(`PRIMARY KEY (${pks.map(c => `"${c.name}"`).join(", ")})`);
      }
      
      await client.query(`CREATE TABLE IF NOT EXISTS "${tableName}" (${pgColumns.join(", ")})`);
      
      // Read data from SQLite
      const rows = db.prepare(`SELECT * FROM ${tableName}`).all();
      if (rows.length === 0) continue;
      
      // Upsert data to Postgres (Prevent overlapping data)
      const colNames = columns.map(c => `"${c.name}"`).join(", ");
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
      
      let queryText = `INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders})`;
      
      if (pks.length > 0) {
        const pkNames = pks.map(c => `"${c.name}"`).join(", ");
        const nonPkColumns = columns.filter(c => c.pk === 0);
        
        if (nonPkColumns.length > 0) {
          const updateSet = nonPkColumns.map(c => `"${c.name}" = EXCLUDED."${c.name}"`).join(", ");
          queryText += ` ON CONFLICT (${pkNames}) DO UPDATE SET ${updateSet}`;
        } else {
          queryText += ` ON CONFLICT (${pkNames}) DO NOTHING`;
        }
      }
      
      let inserted = 0;
      for (const row of rows) {
        const values = columns.map(c => row[c.name]);
        try {
          await client.query(queryText, values);
          inserted++;
        } catch (err) {
          console.error(`Row insert failed in ${tableName}:`, err.message);
        }
      }
      console.log(` -> Synced ${inserted} rows without overlap.`);
    }
    console.log("✅ Full Database Sync to Supabase Completed!");
  } catch (error) {
    console.error("Sync failed:", error);
  } finally {
    client.release();
    pool.end();
  }
}

syncToSupabase();
