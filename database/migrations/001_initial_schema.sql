-- PSSPL CRM SQLite baseline. Generated from the reviewed application schema.
-- Do not place customer or Tally data in migration files.
PRAGMA foreign_keys = ON;

-- table: attendance
CREATE TABLE attendance (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    business_date TEXT NOT NULL,
    check_in_at TEXT NOT NULL,
    check_out_at TEXT,
    latitude REAL,
    longitude REAL,
    UNIQUE(user_id, business_date)
  );

-- table: audit_logs
CREATE TABLE audit_logs (
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

-- table: customer_activities
CREATE TABLE customer_activities (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), tally_customer_id TEXT,
    lead_id TEXT REFERENCES leads(id), activity_type TEXT NOT NULL, subject TEXT NOT NULL,
    notes TEXT, occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

-- table: expected_orders
CREATE TABLE expected_orders (
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

-- table: follow_ups
CREATE TABLE follow_ups (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    visit_id TEXT REFERENCES visits(id),
    tally_customer_id TEXT NOT NULL,
    title TEXT NOT NULL,
    due_date TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'today',
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

-- table: generated_reports
CREATE TABLE generated_reports (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), report_type TEXT NOT NULL,
    date_from TEXT NOT NULL, date_to TEXT NOT NULL, payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

-- table: leads
CREATE TABLE leads (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL,
    company TEXT, phone TEXT, email TEXT, city TEXT, source TEXT, interested_product_id TEXT,
    stage TEXT NOT NULL DEFAULT 'lead', expected_value REAL DEFAULT 0,
    next_action_date TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

-- table: location_pings
CREATE TABLE location_pings (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), latitude REAL NOT NULL,
    longitude REAL NOT NULL, accuracy REAL, captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

-- table: notifications
CREATE TABLE notifications (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
    message TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

-- table: salesperson_profiles
CREATE TABLE salesperson_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    employee_code TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    region TEXT NOT NULL,
    territory TEXT NOT NULL,
    manager_user_id TEXT REFERENCES users(id),
    monthly_target REAL NOT NULL DEFAULT 0
  );

-- table: service_requests
CREATE TABLE service_requests (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), tally_customer_id TEXT,
    lead_id TEXT REFERENCES leads(id), request_type TEXT NOT NULL,
    product_id TEXT, details TEXT NOT NULL, responsible_person TEXT,
    due_date TEXT, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

-- table: sessions
CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

-- table: tally_chunk_parts
CREATE TABLE tally_chunk_parts (
    session_id TEXT NOT NULL REFERENCES tally_chunk_sessions(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    content TEXT NOT NULL,
    PRIMARY KEY(session_id, field_name, sequence)
  );

-- table: tally_chunk_sessions
CREATE TABLE tally_chunk_sessions (
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
  , voucher_carry TEXT NOT NULL DEFAULT '', voucher_chunks_received INTEGER NOT NULL DEFAULT 0, voucher_rows_received INTEGER NOT NULL DEFAULT 0, invoice_rows_stored INTEGER NOT NULL DEFAULT 0, invoice_lines_stored INTEGER NOT NULL DEFAULT 0, payment_rows_stored INTEGER NOT NULL DEFAULT 0, purchase_rows_stored INTEGER NOT NULL DEFAULT 0, purchase_lines_stored INTEGER NOT NULL DEFAULT 0);

-- table: tally_connector_pairing_codes
CREATE TABLE tally_connector_pairing_codes (
    id TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL UNIQUE,
    code_hint TEXT NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    revoked_at TEXT
  );

-- table: tally_connector_tokens
CREATE TABLE tally_connector_tokens (
    id TEXT PRIMARY KEY,
    connector_id TEXT NOT NULL REFERENCES tally_connectors(id) ON DELETE CASCADE,
    token_type TEXT NOT NULL CHECK(token_type IN ('access','refresh')),
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TEXT
  );

-- table: tally_connectors
CREATE TABLE tally_connectors (
    id TEXT PRIMARY KEY,
    machine_name TEXT,
    tally_company TEXT,
    tally_version TEXT,
    status TEXT NOT NULL DEFAULT 'paired' CHECK(status IN ('paired','online','offline','revoked')),
    paired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat_at TEXT,
    last_sync_at TEXT,
    revoked_at TEXT
  , installation_id TEXT, agent_version TEXT, tally_available INTEGER NOT NULL DEFAULT 0, company_guid TEXT, open_companies_json TEXT, sync_interval_seconds INTEGER NOT NULL DEFAULT 3600, heartbeat_interval_seconds INTEGER NOT NULL DEFAULT 60);

-- table: tally_customer_monthly_sales
CREATE TABLE tally_customer_monthly_sales (
    customer_id TEXT NOT NULL REFERENCES tally_customers(id) ON DELETE CASCADE,
    period TEXT NOT NULL, amount REAL DEFAULT 0, PRIMARY KEY(customer_id, period)
  );

-- table: tally_customers
CREATE TABLE tally_customers (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, party_type TEXT, rm_name TEXT,
    rm_code TEXT, city TEXT, destination_code TEXT, total_sales REAL DEFAULT 0,
    outstanding REAL DEFAULT 0, last_payment_date TEXT, source_file TEXT
  , contact_name TEXT, phone TEXT, email TEXT, state TEXT, pincode TEXT, gstin TEXT, owner_user_id TEXT REFERENCES users(id));

-- table: tally_import_metadata
CREATE TABLE tally_import_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);

-- table: tally_invoice_lines
CREATE TABLE tally_invoice_lines (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES tally_invoices(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES tally_products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    rate REAL NOT NULL DEFAULT 0,
    amount REAL NOT NULL DEFAULT 0,
    uom TEXT
  );

-- table: tally_invoices
CREATE TABLE tally_invoices (
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
  , ingest_session_id TEXT);

-- table: tally_party_payments
CREATE TABLE tally_party_payments (
    party_name TEXT NOT NULL, period TEXT NOT NULL, amount_lakh REAL DEFAULT 0,
    PRIMARY KEY(party_name, period)
  );

-- table: tally_payments_live
CREATE TABLE tally_payments_live (
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
  , ingest_session_id TEXT);

-- table: tally_product_monthly_sales
CREATE TABLE tally_product_monthly_sales (
    product_id TEXT NOT NULL REFERENCES tally_products(id) ON DELETE CASCADE,
    period TEXT NOT NULL, quantity REAL DEFAULT 0, sales_value REAL NOT NULL DEFAULT 0, PRIMARY KEY(product_id, period)
  );

-- table: tally_products
CREATE TABLE tally_products (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, packing_size TEXT, uom TEXT,
    rate REAL DEFAULT 0, total_qty REAL DEFAULT 0, total_value REAL DEFAULT 0,
    frequency INTEGER DEFAULT 0, source_file TEXT
  );

-- table: tally_purchase_lines
CREATE TABLE tally_purchase_lines (
    id TEXT PRIMARY KEY, purchase_id TEXT NOT NULL REFERENCES tally_purchases(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES tally_products(id) ON DELETE SET NULL, product_name TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0, rate REAL NOT NULL DEFAULT 0,
    amount REAL NOT NULL DEFAULT 0, uom TEXT
  );

-- table: tally_purchases
CREATE TABLE tally_purchases (
    id TEXT PRIMARY KEY, company_name TEXT NOT NULL, voucher_guid TEXT,
    voucher_number TEXT, purchase_date TEXT NOT NULL, supplier_name TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0, reference TEXT, source_sync_id TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, ingest_session_id TEXT
  );

-- table: tally_rm_product_sales
CREATE TABLE tally_rm_product_sales (
    rm_name TEXT NOT NULL, product_name TEXT NOT NULL, financial_year TEXT NOT NULL,
    quantity REAL DEFAULT 0, sales_value REAL DEFAULT 0,
    PRIMARY KEY(rm_name, product_name, financial_year)
  );

-- table: tally_rm_targets
CREATE TABLE tally_rm_targets (
    rm_name TEXT NOT NULL, period TEXT NOT NULL, target_lakh REAL DEFAULT 0,
    PRIMARY KEY(rm_name, period)
  );

-- table: tally_salespeople
CREATE TABLE tally_salespeople (
    code TEXT PRIMARY KEY, name TEXT NOT NULL, rm_name TEXT, city TEXT, joined_on TEXT
  );

-- table: tally_sync_runs
CREATE TABLE tally_sync_runs (
    id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    status TEXT NOT NULL,
    entity_counts_json TEXT,
    error_message TEXT
  , connector_id TEXT, sync_id TEXT, company_name TEXT, company_guid TEXT, date_from TEXT, date_to TEXT, record_count INTEGER);

-- table: users
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('salesperson','rm','admin')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

-- table: visit_products
CREATE TABLE visit_products (
    visit_id TEXT NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    tally_product_id TEXT NOT NULL,
    PRIMARY KEY(visit_id, tally_product_id)
  );

-- table: visits
CREATE TABLE visits (
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

-- index: idx_audit_logs_created
CREATE INDEX idx_audit_logs_created
    ON audit_logs(created_at DESC, user_id);

-- index: idx_tally_chunk_sessions_connector
CREATE INDEX idx_tally_chunk_sessions_connector
    ON tally_chunk_sessions(connector_id, created_at);

-- index: idx_tally_connector_tokens_lookup
CREATE INDEX idx_tally_connector_tokens_lookup
    ON tally_connector_tokens(token_hash, token_type, expires_at);

-- index: idx_tally_connectors_status
CREATE INDEX idx_tally_connectors_status
    ON tally_connectors(status, paired_at);

-- index: idx_tally_customers_owner_user_id
CREATE INDEX idx_tally_customers_owner_user_id ON tally_customers(owner_user_id);

-- index: idx_tally_invoice_lines_product
CREATE INDEX idx_tally_invoice_lines_product
    ON tally_invoice_lines(product_id, invoice_id);

-- index: idx_tally_invoices_date_customer
CREATE INDEX idx_tally_invoices_date_customer
    ON tally_invoices(invoice_date, customer_id);

-- index: idx_tally_pairing_codes_active
CREATE INDEX idx_tally_pairing_codes_active
    ON tally_connector_pairing_codes(expires_at, used_at, revoked_at);

-- index: idx_tally_payments_date_customer
CREATE INDEX idx_tally_payments_date_customer
    ON tally_payments_live(payment_date, customer_id);

-- index: idx_tally_purchase_lines_product
CREATE INDEX idx_tally_purchase_lines_product
    ON tally_purchase_lines(product_id, purchase_id);

-- index: idx_tally_purchases_date_supplier
CREATE INDEX idx_tally_purchases_date_supplier
    ON tally_purchases(purchase_date, supplier_name);

PRAGMA optimize;
