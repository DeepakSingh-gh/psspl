import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runMigrations } from "./migrations.mjs";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const databasePath = process.env.CRM_DATABASE_PATH || join(projectRoot, "data", "crm.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });

export const db = new DatabaseSync(databasePath);
db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA temp_store = MEMORY;");
runMigrations(db);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('salesperson','rm','admin')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS salesperson_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    employee_code TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    region TEXT NOT NULL,
    territory TEXT NOT NULL,
    manager_user_id TEXT REFERENCES users(id),
    monthly_target REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    business_date TEXT NOT NULL,
    check_in_at TEXT NOT NULL,
    check_out_at TEXT,
    latitude REAL,
    longitude REAL,
    UNIQUE(user_id, business_date)
  );

  CREATE TABLE IF NOT EXISTS visits (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    business_date TEXT NOT NULL,
    tally_customer_id TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    purpose TEXT NOT NULL,
    outcome TEXT,
    notes TEXT,
    latitude REAL,
    longitude REAL,
    status TEXT NOT NULL CHECK(status IN ('planned','in_progress','completed')) DEFAULT 'planned'
  );

  CREATE TABLE IF NOT EXISTS visit_products (
    visit_id TEXT NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    tally_product_id TEXT NOT NULL,
    PRIMARY KEY(visit_id, tally_product_id)
  );

  CREATE TABLE IF NOT EXISTS expected_orders (
    id TEXT PRIMARY KEY,
    visit_id TEXT NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    tally_customer_id TEXT NOT NULL,
    tally_product_id TEXT NOT NULL,
    expected_value REAL NOT NULL DEFAULT 0,
    expected_date TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS follow_ups (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    visit_id TEXT REFERENCES visits(id),
    tally_customer_id TEXT NOT NULL,
    title TEXT NOT NULL,
    due_date TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'today',
    completed INTEGER NOT NULL DEFAULT 0,
    follow_up_type TEXT DEFAULT 'call',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tally_sync_runs (
    id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    status TEXT NOT NULL,
    entity_counts_json TEXT,
    error_message TEXT
  );

  CREATE TABLE IF NOT EXISTS tally_connector_pairing_codes (
    id TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL UNIQUE,
    code_hint TEXT NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    revoked_at TEXT
  );

  CREATE TABLE IF NOT EXISTS tally_connectors (
    id TEXT PRIMARY KEY,
    machine_name TEXT,
    tally_company TEXT,
    tally_version TEXT,
    status TEXT NOT NULL DEFAULT 'paired' CHECK(status IN ('paired','online','offline','revoked')),
    paired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat_at TEXT,
    last_sync_at TEXT,
    revoked_at TEXT
  );

  CREATE TABLE IF NOT EXISTS tally_connector_tokens (
    id TEXT PRIMARY KEY,
    connector_id TEXT NOT NULL REFERENCES tally_connectors(id) ON DELETE CASCADE,
    token_type TEXT NOT NULL CHECK(token_type IN ('access','refresh')),
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TEXT
  );

  CREATE TABLE IF NOT EXISTS tally_chunk_sessions (
    id TEXT PRIMARY KEY,
    connector_id TEXT NOT NULL REFERENCES tally_connectors(id),
    sync_job_id TEXT,
    sync_id TEXT,
    company_name TEXT NOT NULL,
    company_guid TEXT,
    date_from TEXT NOT NULL,
    date_to TEXT NOT NULL,
    as_of TEXT,
    publication_mode TEXT NOT NULL DEFAULT 'replace',
    history_covered_from TEXT,
    status TEXT NOT NULL DEFAULT 'receiving',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    error_message TEXT
  );

  CREATE TABLE IF NOT EXISTS tally_chunk_parts (
    session_id TEXT NOT NULL REFERENCES tally_chunk_sessions(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    content TEXT NOT NULL,
    PRIMARY KEY(session_id, field_name, sequence)
  );

  CREATE TABLE IF NOT EXISTS tally_customers (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, party_type TEXT, rm_name TEXT,
    rm_code TEXT, city TEXT, destination_code TEXT, total_sales REAL DEFAULT 0,
    outstanding REAL DEFAULT 0, last_payment_date TEXT, source_file TEXT
  );
  CREATE TABLE IF NOT EXISTS tally_customer_monthly_sales (
    customer_id TEXT NOT NULL REFERENCES tally_customers(id) ON DELETE CASCADE,
    period TEXT NOT NULL, amount REAL DEFAULT 0, PRIMARY KEY(customer_id, period)
  );
  CREATE TABLE IF NOT EXISTS tally_products (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, packing_size TEXT, uom TEXT,
    rate REAL DEFAULT 0, total_qty REAL DEFAULT 0, total_value REAL DEFAULT 0,
    frequency INTEGER DEFAULT 0, source_file TEXT
  );
  CREATE TABLE IF NOT EXISTS tally_product_monthly_sales (
    product_id TEXT NOT NULL REFERENCES tally_products(id) ON DELETE CASCADE,
    period TEXT NOT NULL, quantity REAL DEFAULT 0, PRIMARY KEY(product_id, period)
  );
  CREATE TABLE IF NOT EXISTS tally_rm_targets (
    rm_name TEXT NOT NULL, period TEXT NOT NULL, target_lakh REAL DEFAULT 0,
    PRIMARY KEY(rm_name, period)
  );
  CREATE TABLE IF NOT EXISTS tally_rm_product_sales (
    rm_name TEXT NOT NULL, product_name TEXT NOT NULL, financial_year TEXT NOT NULL,
    quantity REAL DEFAULT 0, sales_value REAL DEFAULT 0,
    PRIMARY KEY(rm_name, product_name, financial_year)
  );
  CREATE TABLE IF NOT EXISTS tally_salespeople (
    code TEXT PRIMARY KEY, name TEXT NOT NULL, rm_name TEXT, city TEXT, joined_on TEXT
  );
  CREATE TABLE IF NOT EXISTS tally_party_payments (
    party_name TEXT NOT NULL, period TEXT NOT NULL, amount_lakh REAL DEFAULT 0,
    PRIMARY KEY(party_name, period)
  );
  CREATE TABLE IF NOT EXISTS tally_invoices (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    voucher_guid TEXT,
    voucher_number TEXT,
    voucher_type TEXT NOT NULL,
    invoice_date TEXT NOT NULL,
    customer_id TEXT REFERENCES tally_customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    reference TEXT,
    source_sync_id TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS tally_invoice_lines (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES tally_invoices(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES tally_products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    rate REAL NOT NULL DEFAULT 0,
    amount REAL NOT NULL DEFAULT 0,
    uom TEXT
  );
  CREATE TABLE IF NOT EXISTS tally_payments_live (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    voucher_guid TEXT,
    voucher_number TEXT,
    payment_date TEXT NOT NULL,
    payment_type TEXT NOT NULL,
    customer_id TEXT REFERENCES tally_customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    reference TEXT,
    source_sync_id TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS tally_purchases (
    id TEXT PRIMARY KEY, company_name TEXT NOT NULL, voucher_guid TEXT,
    voucher_number TEXT, purchase_date TEXT NOT NULL, supplier_name TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0, reference TEXT, source_sync_id TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, ingest_session_id TEXT
  );
  CREATE TABLE IF NOT EXISTS tally_purchase_lines (
    id TEXT PRIMARY KEY, purchase_id TEXT NOT NULL REFERENCES tally_purchases(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES tally_products(id) ON DELETE SET NULL, product_name TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0, rate REAL NOT NULL DEFAULT 0,
    amount REAL NOT NULL DEFAULT 0, uom TEXT
  );
  CREATE TABLE IF NOT EXISTS tally_import_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL,
    company TEXT, phone TEXT, email TEXT, city TEXT, source TEXT, interested_product_id TEXT,
    stage TEXT NOT NULL DEFAULT 'lead', expected_value REAL DEFAULT 0,
    next_action_date TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS customer_activities (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), tally_customer_id TEXT,
    lead_id TEXT REFERENCES leads(id), activity_type TEXT NOT NULL, subject TEXT NOT NULL,
    notes TEXT, occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS service_requests (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), tally_customer_id TEXT,
    lead_id TEXT REFERENCES leads(id), request_type TEXT NOT NULL,
    product_id TEXT, details TEXT NOT NULL, responsible_person TEXT,
    due_date TEXT, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS location_pings (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), latitude REAL NOT NULL,
    longitude REAL NOT NULL, accuracy REAL, captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS generated_reports (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), report_type TEXT NOT NULL,
    date_from TEXT NOT NULL, date_to TEXT NOT NULL, payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
    message TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    user_email TEXT,
    action TEXT NOT NULL,
    path TEXT NOT NULL,
    entity_id TEXT,
    status_code INTEGER NOT NULL,
    details_json TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS thrust_products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    alias_keywords TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_tally_pairing_codes_active
    ON tally_connector_pairing_codes(expires_at, used_at, revoked_at);
  CREATE INDEX IF NOT EXISTS idx_tally_connectors_status
    ON tally_connectors(status, paired_at);
  CREATE INDEX IF NOT EXISTS idx_tally_connector_tokens_lookup
    ON tally_connector_tokens(token_hash, token_type, expires_at);
  CREATE INDEX IF NOT EXISTS idx_tally_chunk_sessions_connector
    ON tally_chunk_sessions(connector_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_tally_invoices_date_customer
    ON tally_invoices(invoice_date, customer_id);
  CREATE INDEX IF NOT EXISTS idx_tally_invoice_lines_product
    ON tally_invoice_lines(product_id, invoice_id);
  CREATE INDEX IF NOT EXISTS idx_tally_payments_date_customer
    ON tally_payments_live(payment_date, customer_id);
  CREATE INDEX IF NOT EXISTS idx_tally_purchases_date_supplier
    ON tally_purchases(purchase_date, supplier_name);
  CREATE INDEX IF NOT EXISTS idx_tally_purchase_lines_product
    ON tally_purchase_lines(product_id, purchase_id);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_created
    ON audit_logs(created_at DESC, user_id);

  CREATE INDEX IF NOT EXISTS idx_tally_invoice_lines_invoice_id ON tally_invoice_lines(invoice_id);
  CREATE INDEX IF NOT EXISTS idx_tally_purchase_lines_purchase_id ON tally_purchase_lines(purchase_id);
  CREATE INDEX IF NOT EXISTS idx_tally_invoices_customer_id ON tally_invoices(customer_id);
  CREATE INDEX IF NOT EXISTS idx_tally_payments_customer_id ON tally_payments_live(customer_id);
  CREATE INDEX IF NOT EXISTS idx_visits_user_id ON visits(user_id);
  CREATE INDEX IF NOT EXISTS idx_follow_ups_user_id ON follow_ups(user_id);
  CREATE INDEX IF NOT EXISTS idx_tally_customers_rm_name ON tally_customers(rm_name);
  CREATE INDEX IF NOT EXISTS idx_tally_invoices_session_date ON tally_invoices(ingest_session_id, invoice_date);
  CREATE INDEX IF NOT EXISTS idx_tally_invoice_lines_inv_prod ON tally_invoice_lines(invoice_id, product_name);
  CREATE INDEX IF NOT EXISTS idx_tally_rm_product_sales_rm ON tally_rm_product_sales(rm_name);
`);

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((item) => item.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

ensureColumn("tally_connectors", "installation_id", "TEXT");
ensureColumn("tally_connectors", "agent_version", "TEXT");
ensureColumn("tally_connectors", "tally_available", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("tally_connectors", "company_guid", "TEXT");
ensureColumn("tally_connectors", "open_companies_json", "TEXT");
ensureColumn("tally_connectors", "sync_interval_seconds", "INTEGER NOT NULL DEFAULT 3600");
ensureColumn("tally_connectors", "heartbeat_interval_seconds", "INTEGER NOT NULL DEFAULT 60");
ensureColumn("tally_sync_runs", "connector_id", "TEXT");
ensureColumn("tally_sync_runs", "sync_id", "TEXT");
ensureColumn("tally_sync_runs", "company_name", "TEXT");
ensureColumn("tally_sync_runs", "company_guid", "TEXT");
ensureColumn("tally_sync_runs", "date_from", "TEXT");
ensureColumn("tally_sync_runs", "date_to", "TEXT");
ensureColumn("tally_sync_runs", "record_count", "INTEGER");
ensureColumn("tally_chunk_sessions", "purchase_rows_stored", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("tally_chunk_sessions", "purchase_lines_stored", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("tally_customers", "contact_name", "TEXT");
ensureColumn("tally_customers", "phone", "TEXT");
ensureColumn("tally_customers", "email", "TEXT");
ensureColumn("tally_customers", "state", "TEXT");
ensureColumn("tally_customers", "pincode", "TEXT");
ensureColumn("tally_customers", "gstin", "TEXT");
ensureColumn("tally_product_monthly_sales", "sales_value", "REAL NOT NULL DEFAULT 0");
ensureColumn("tally_chunk_sessions", "voucher_carry", "TEXT NOT NULL DEFAULT ''");
ensureColumn("tally_chunk_sessions", "voucher_chunks_received", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("tally_chunk_sessions", "voucher_rows_received", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("tally_chunk_sessions", "invoice_rows_stored", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("tally_chunk_sessions", "invoice_lines_stored", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("tally_chunk_sessions", "payment_rows_stored", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("tally_invoices", "ingest_session_id", "TEXT");
ensureColumn("tally_payments_live", "ingest_session_id", "TEXT");
ensureColumn("tally_customers", "owner_user_id", "TEXT REFERENCES users(id)");

db.exec(`CREATE INDEX IF NOT EXISTS idx_tally_customers_owner_user_id ON tally_customers(owner_user_id);`);

// Gap-fix migrations
ensureColumn("visits", "visit_tags", "TEXT");
ensureColumn("visits", "voice_note_path", "TEXT");
ensureColumn("visits", "priority", "TEXT DEFAULT 'medium'");
ensureColumn("follow_ups", "assigned_to_user_id", "TEXT REFERENCES users(id)");
ensureColumn("follow_ups", "follow_up_type", "TEXT DEFAULT 'call'");
ensureColumn("follow_ups", "notes", "TEXT");

// Seed default thrust products from company schedule if empty
try {
  const tpCount = db.prepare("SELECT COUNT(*) count FROM thrust_products").get()?.count || 0;
  if (tpCount === 0) {
    const defaultThrust = [
      { id: "tp-1", name: "Zpn Blue 15", alias: "%ZPN%BLUE%", sort: 1 },
      { id: "tp-2", name: "Zpn 200", alias: "%ZPN%200%", sort: 2 },
      { id: "tp-3", name: "Zpn Black", alias: "%ZPN%BLACK%", sort: 3 },
      { id: "tp-4", name: "Shimaclad Peony", alias: "%SHIMACLAD%PEONY%", sort: 4 },
      { id: "tp-5", name: "Clearclad Lcbh", alias: "%CLEARCLAD%LC%", sort: 5 },
      { id: "tp-6", name: "Enilex Chrome Catalyst", alias: "%ENILEX%|%CHROMECAT%|%CHROME%CAT%", sort: 6 },
      { id: "tp-7", name: "POP", alias: "%POP%", sort: 7 },
      { id: "tp-8", name: "Uviclad 612", alias: "%UVICLAD%", sort: 8 },
      { id: "tp-9", name: "Patinas", alias: "%PATINA%", sort: 9 },
    ];
    const insStmt = db.prepare("INSERT OR IGNORE INTO thrust_products (id, name, alias_keywords, sort_order) VALUES (?, ?, ?, ?)");
    for (const item of defaultThrust) {
      insStmt.run(item.id, item.name, item.alias, item.sort);
    }
  }
} catch (e) {
  console.warn("Could not seed thrust products:", e.message);
}

db.exec("PRAGMA optimize;");

export function transaction(work) {
  db.exec("BEGIN IMMEDIATE");
  try { const result = work(); db.exec("COMMIT"); return result; }
  catch (error) { db.exec("ROLLBACK"); throw error; }
}
