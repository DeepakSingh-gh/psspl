"""Import real PSSPL workbooks into local CRM SQLite database."""
import hashlib, io, os, re, sqlite3, sys
from datetime import date, datetime
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "crm.sqlite"

# Determine data directory
CLI_DIR = sys.argv[1] if len(sys.argv) > 1 else None
if not CLI_DIR or not Path(CLI_DIR).is_dir():
    print("Usage: py import_psspldata.py <path_to_data_directory>")
    sys.exit(1)
DATA_DIR = Path(CLI_DIR)

print(f"[import] Using data directory: {DATA_DIR}")
print(f"[import] Target database: {DB_PATH}")

def text(v):
    return str(v).strip() if v is not None else ""

def num(v):
    try:
        f = float(v or 0)
        return 0.0 if f != f else f
    except (TypeError, ValueError):
        return 0.0

def iso(v):
    if isinstance(v, (date, datetime)):
        return v.strftime("%Y-%m-%d")
    s = text(v)
    if not s:
        return None
    # match YYYY-MM-DD
    m = re.search(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", s)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    return s[:10]

def slug(v):
    return re.sub(r"[^A-Z0-9]+", "-", text(v).upper()).strip("-")

def password_hash(pwd, salt=None):
    if not salt:
        salt = os.urandom(16).hex()
    dig = hashlib.scrypt(pwd.encode("utf-8"), salt=salt.encode("utf-8"), n=16384, r=8, p=1, dklen=64).hex()
    return f"{salt}:{dig}"

def load_wb(fn):
    p = DATA_DIR / fn
    if not p.is_file():
        print(f"[import] WARNING: File {fn} not found in {DATA_DIR}")
        return None
    with open(p, "rb") as f:
        return openpyxl.load_workbook(io.BytesIO(f.read()), data_only=True, read_only=True)

con = sqlite3.connect(DB_PATH)
con.execute("PRAGMA foreign_keys = OFF") # temporarily off during table refresh

# 1. Clear snapshot tables
tables_to_clear = [
    "tally_customer_monthly_sales",
    "tally_product_monthly_sales",
    "tally_rm_product_sales",
    "tally_rm_targets",
    "tally_party_payments",
    "tally_salespeople",
    "tally_customers",
    "tally_products",
    "tally_invoices",
    "tally_invoice_lines"
]
for t in tables_to_clear:
    con.execute(f"DELETE FROM {t}")
print("[import] Cleared previous snapshot tables.")

# 2. Import Customers from File 6
fn6 = "6) Dealer Summary Apr, 2023 to May, 2024.xlsx"
wb6 = load_wb(fn6)
periods6 = [
    "2023-04", "2023-05", "2023-06", "2023-07", "2023-08", "2023-09",
    "2023-10", "2023-11", "2023-12", "2024-01", "2024-02", "2024-03",
    "2024-04", "2024-05"
]

customers_imported = 0
customer_sales_imported = 0

if wb6 and "Master Data" in wb6.sheetnames:
    ws6 = wb6["Master Data"]
    for row in ws6.iter_rows(min_row=5, values_only=True):
        name = text(row[1])
        if not name or name.lower().startswith("total") or name.lower().startswith("grand"):
            continue
        cust_id = text(row[2]).split("/")[0].strip() or f"PARTY-{slug(name)}"
        party_type = text(row[3]) or "Dealer"
        rm_name = text(row[4])
        rm_code = text(row[5])
        city = text(row[6])
        destination_code = text(row[7])
        total_sales = num(row[8])
        outstanding = num(row[23])
        last_payment_date = iso(row[24])

        con.execute(
            """INSERT OR REPLACE INTO tally_customers 
               (id, name, party_type, rm_name, rm_code, city, destination_code, total_sales, outstanding, last_payment_date, source_file)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (cust_id, name, party_type, rm_name, rm_code, city, destination_code, total_sales, outstanding, last_payment_date, fn6)
        )
        customers_imported += 1

        for period, amount in zip(periods6, row[9:23]):
            val = num(amount)
            if val != 0:
                con.execute(
                    "INSERT OR REPLACE INTO tally_customer_monthly_sales (customer_id, period, amount) VALUES (?, ?, ?)",
                    (cust_id, period, val)
                )
                customer_sales_imported += 1

print(f"[import] Imported {customers_imported} customers and {customer_sales_imported} monthly customer sales records.")

# 3. Import Products from File 8
fn8 = "8) PSS Product Analysis I 2022-23 (005).xlsx"
wb8 = load_wb(fn8)
products_imported = 0
product_sales_imported = 0

if wb8 and "Original Summary " in wb8.sheetnames:
    ws8 = wb8["Original Summary "]
    for row in ws8.iter_rows(min_row=5, values_only=True):
        name = text(row[2])
        if not name or name.lower().startswith("total") or name.lower().startswith("grand"):
            continue
        prod_id = text(row[1]) or f"PROD-{slug(name)[:30]}"
        packing_size = text(row[3])
        uom = text(row[4]) or "Nos"
        rate = num(row[5]) or num(row[6])
        monthly = [num(x) for x in row[7:19]]
        total_qty = num(row[19]) or sum(monthly)
        total_val = rate * total_qty
        freq = sum(1 for m in monthly if m > 0)

        con.execute(
            """INSERT OR REPLACE INTO tally_products 
               (id, name, packing_size, uom, rate, total_qty, total_value, frequency, source_file)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (prod_id, name, packing_size, uom, rate, total_qty, total_val, freq, fn8)
        )
        products_imported += 1

        for idx, qty in enumerate(monthly):
            if qty > 0:
                year, month = (2022, idx + 4) if idx < 9 else (2023, idx - 8)
                period = f"{year}-{month:02d}"
                con.execute(
                    """INSERT OR REPLACE INTO tally_product_monthly_sales 
                       (product_id, period, quantity, sales_value) VALUES (?, ?, ?, ?)""",
                    (prod_id, period, qty, qty * rate)
                )
                product_sales_imported += 1

print(f"[import] Imported {products_imported} products and {product_sales_imported} product monthly sales records.")

# 4. Import Comparison of Product with Qty (File 10)
fn10 = "10) COMPARISON OF  PRODUCT WITH QTY.xlsx"
wb10 = load_wb(fn10)
rm_product_sales_imported = 0

if wb10:
    for ws_title in wb10.sheetnames:
        ws = wb10[ws_title]
        start_row = 4 if ws_title == "Anil Jena" else 3
        aggregates = {}
        for row in ws.iter_rows(min_row=start_row, values_only=True):
            pname = text(row[1])
            if not pname or pname.lower().startswith("total") or pname.lower().startswith("grand"):
                continue
            # Col 2: 2024-25 Qty, Col 3: 2025-26 Qty, Col 4: 2024-25 Sales, Col 5: 2025-26 Sales
            for fy, qty, sales in (("2024-25", row[2], row[4]), ("2025-26", row[3], row[5])):
                q_val = num(qty)
                s_val = num(sales)
                if q_val > 0 or s_val > 0:
                    old_q, old_s = aggregates.get((pname, fy), (0.0, 0.0))
                    aggregates[(pname, fy)] = (old_q + q_val, old_s + s_val)

        for (pname, fy), (qty, sales) in aggregates.items():
            con.execute(
                """INSERT OR REPLACE INTO tally_rm_product_sales 
                   (rm_name, product_name, financial_year, quantity, sales_value)
                   VALUES (?, ?, ?, ?, ?)""",
                (ws_title.strip(), pname, fy, qty, sales)
            )
            rm_product_sales_imported += 1

print(f"[import] Imported {rm_product_sales_imported} RM product sales comparisons across {len(wb10.sheetnames) if wb10 else 0} RMs.")

# 5. Import Targets & Sales Executives (File 9)
fn9 = "9) PSS Sales Incentive Calculations-24-25.xlsx"
wb9 = load_wb(fn9)
rm_targets_imported = 0
salespeople_imported = 0

if wb9:
    if "Targets" in wb9.sheetnames:
        for row in wb9["Targets"].iter_rows(min_row=4, values_only=True):
            rm = text(row[3])
            if not rm:
                continue
            for idx, target in enumerate(row[5:17]):
                year, month = (2024, idx + 4) if idx < 9 else (2025, idx - 8)
                period = f"{year}-{month:02d}"
                con.execute(
                    "INSERT OR REPLACE INTO tally_rm_targets (rm_name, period, target_lakh) VALUES (?, ?, ?)",
                    (rm, period, num(target))
                )
                rm_targets_imported += 1

    if "Sales Exec Sales" in wb9.sheetnames:
        current_rm = None
        for row in wb9["Sales Exec Sales"].iter_rows(min_row=5, values_only=True):
            name = " ".join(text(row[3]).split())
            code = text(row[2])
            sno = text(row[1])
            if not name:
                continue
            if sno == "0":
                current_rm = name
            else:
                con.execute(
                    "INSERT OR REPLACE INTO tally_salespeople (code, name, rm_name, city, joined_on) VALUES (?, ?, ?, ?, ?)",
                    (code or f"SP-{slug(name)}", name, current_rm, "", iso(row[5]))
                )
                salespeople_imported += 1

print(f"[import] Imported {rm_targets_imported} RM targets and {salespeople_imported} salespeople.")

# 6. Import Party-wise payments (File 2)
fn2 = "2) All Party wise Payments.xlsx"
wb2 = load_wb(fn2)
party_payments_imported = 0
if wb2 and "Party wise Payments" in wb2.sheetnames:
    ws2 = wb2["Party wise Payments"]
    for row in ws2.iter_rows(min_row=15, max_row=16, values_only=True):
        if text(row[0]).startswith("2024"):
            for idx, amt in enumerate(row[2:14]):
                val = num(amt)
                if val > 0:
                    year, month = (2024, idx + 4) if idx < 9 else (2025, idx - 8)
                    con.execute(
                        "INSERT OR REPLACE INTO tally_party_payments (party_name, period, amount_lakh) VALUES (?, ?, ?)",
                        ("2 Daughters", f"{year}-{month:02d}", val)
                    )
                    party_payments_imported += 1

print(f"[import] Imported {party_payments_imported} party payment records.")

# 7. Seed & Sync Users & Regional Managers
print("[import] Setting up users & salespeople mapping...")

# Ensure Admin
con.execute(
    """INSERT OR REPLACE INTO users (id, email, password_hash, role, active)
       VALUES ('admin-001', 'admin@psspl.com', ?, 'admin', 1)""",
    (password_hash("psspl-admin-2026"),)
)
con.execute(
    """INSERT OR REPLACE INTO salesperson_profiles 
       (user_id, employee_code, full_name, region, territory, monthly_target)
       VALUES ('admin-001', 'PSSPL-A-001', 'PSSPL Administrator', 'Head Office', 'National', 0)"""
)

# Fetch distinct RMs from tally_rm_targets or tally_customers
rms = [r[0] for r in con.execute("SELECT DISTINCT rm_name FROM tally_rm_targets WHERE rm_name IS NOT NULL AND rm_name <> ''").fetchall()]
rm_user_map = {}

for rm in rms:
    rm_clean = rm.strip()
    s = slug(rm_clean).lower().replace("-", ".")
    email = f"{s}@psspl.com"
    user_id = f"rm-{slug(rm_clean).lower()}"
    pwd_hash = password_hash("psspl-rm-2026")

    con.execute(
        """INSERT OR REPLACE INTO users (id, email, password_hash, role, active)
           VALUES (?, ?, ?, 'rm', 1)""",
        (user_id, email, pwd_hash)
    )
    # Estimate monthly target
    target_row = con.execute("SELECT AVG(target_lakh) FROM tally_rm_targets WHERE rm_name=?", (rm,)).fetchone()
    monthly_target = round(target_row[0] or 25.0, 2)

    con.execute(
        """INSERT OR REPLACE INTO salesperson_profiles 
           (user_id, employee_code, full_name, region, territory, monthly_target)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (user_id, f"PSSPL-RM-{slug(rm_clean)[:6]}", rm_clean, f"{rm_clean} Region", rm_clean, monthly_target)
    )
    rm_user_map[rm_clean.lower()] = user_id

# Also add alias accounts for easy testing:
# anil@psspl.com -> Anil Jena
if "anil jena" in rm_user_map:
    con.execute(
        """INSERT OR REPLACE INTO users (id, email, password_hash, role, active)
           VALUES ('rm-anil-alias', 'anil@psspl.com', ?, 'rm', 1)""",
        (password_hash("psspl-rm-2026"),)
    )
    con.execute(
        """INSERT OR REPLACE INTO salesperson_profiles 
           (user_id, employee_code, full_name, region, territory, monthly_target)
           VALUES ('rm-anil-alias', 'PSSPL-RM-ANIL', 'Anil Jena', 'North Region', 'Delhi NCR / North', 50.0)"""
    )

# Field Rep: Anil Jena (salesperson)
con.execute(
    """INSERT OR REPLACE INTO users (id, email, password_hash, role, active)
       VALUES ('sp-101', 'anil.jaina@psspl.com', ?, 'salesperson', 1)""",
    (password_hash("demo123"),)
)
con.execute(
    """INSERT OR REPLACE INTO salesperson_profiles 
       (user_id, employee_code, full_name, region, territory, manager_user_id, monthly_target)
       VALUES ('sp-101', 'PSSPL-S-001', 'Anil Jena (Field)', 'North Region', 'Gurugram / Delhi NCR', 'rm-anil.jena', 25.0)"""
)

# Link tally_customers owner_user_id
for cust_id, rm_name in con.execute("SELECT id, rm_name FROM tally_customers").fetchall():
    owner_id = None
    if rm_name and rm_name.strip().lower() in rm_user_map:
        owner_id = rm_user_map[rm_name.strip().lower()]
    elif rm_name and "anil" in rm_name.lower():
        owner_id = "sp-101"
    else:
        owner_id = "admin-001"
    con.execute("UPDATE tally_customers SET owner_user_id=? WHERE id=?", (owner_id, cust_id))

print("[import] Customers linked with corresponding RM and salesperson accounts.")

# 8. Generate Realistic Invoices from Real Customer Monthly Sales & Real Products
print("[import] Generating realistic invoices for Admin & RM dashboards...")
product_list = con.execute("SELECT id, name, rate, uom FROM tally_products WHERE rate > 0 LIMIT 50").fetchall()
if not product_list:
    product_list = [("PROD-001", "ACID CU SLT (25 KG)", 7025.0, "Kgs.")]

inv_counter = 1000
invoices_created = 0
invoice_lines_created = 0

# Sample active monthly sales to turn into invoices
active_sales = con.execute("""
    SELECT s.customer_id, c.name, s.period, s.amount
    FROM tally_customer_monthly_sales s
    JOIN tally_customers c ON c.id=s.customer_id
    WHERE s.amount > 0
    ORDER BY s.period DESC, s.amount DESC
""").fetchall()

for cust_id, cust_name, period, total_amount in active_sales:
    # Generate 1 to 2 invoices for this month to match the monthly sales
    inv_date = f"{period}-15"
    inv_id = f"INV-{period.replace('-', '')}-{inv_counter}"
    voucher_no = f"PSS/{period.replace('-', '')}/{inv_counter}"
    inv_counter += 1

    con.execute(
        """INSERT OR REPLACE INTO tally_invoices 
           (id, company_name, voucher_guid, voucher_number, voucher_type, invoice_date, customer_id, customer_name, amount, reference, source_sync_id, ingest_session_id)
           VALUES (?, 'Progressive Surface Systems Pvt. Ltd.', ?, ?, 'Sales', ?, ?, ?, ?, 'Monthly Sales Invoice', 'excel-import', NULL)""",
        (inv_id, f"GUID-{inv_id}", voucher_no, inv_date, cust_id, cust_name, total_amount)
    )
    invoices_created += 1

    # Split into 1 to 3 product lines
    prod1 = product_list[(inv_counter + 1) % len(product_list)]
    prod2 = product_list[(inv_counter + 2) % len(product_list)]
    
    half_amt = round(total_amount / 2, 2)
    qty1 = max(1, round(half_amt / max(1, prod1[2]), 2))
    amt1 = round(qty1 * prod1[2], 2)
    rem_amt = round(total_amount - amt1, 2)
    qty2 = max(1, round(rem_amt / max(1, prod2[2]), 2)) if rem_amt > 0 else 1
    amt2 = rem_amt if rem_amt > 0 else round(qty2 * prod2[2], 2)

    line1_id = f"LINE-{inv_id}-1"
    con.execute(
        """INSERT OR REPLACE INTO tally_invoice_lines 
           (id, invoice_id, product_id, product_name, quantity, rate, amount, uom)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (line1_id, inv_id, prod1[0], prod1[1], qty1, prod1[2], amt1, prod1[3])
    )
    invoice_lines_created += 1

    if rem_amt > 0:
        line2_id = f"LINE-{inv_id}-2"
        con.execute(
            """INSERT OR REPLACE INTO tally_invoice_lines 
               (id, invoice_id, product_id, product_name, quantity, rate, amount, uom)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (line2_id, inv_id, prod2[0], prod2[1], qty2, prod2[2], amt2, prod2[3])
        )
        invoice_lines_created += 1

# Generate invoices for FY 2024-25 and FY 2025-26 from tally_rm_product_sales to drive all annual graphs
rm_cust_map = {}
for cid, cname, rm in con.execute("SELECT id, name, rm_name FROM tally_customers").fetchall():
    key = (rm or "").strip().lower()
    rm_cust_map.setdefault(key, []).append((cid, cname))

all_custs = con.execute("SELECT id, name FROM tally_customers").fetchall()

rm_sales = con.execute("""
    SELECT rm_name, product_name, financial_year, quantity, sales_value 
    FROM tally_rm_product_sales 
    WHERE sales_value > 0
""").fetchall()

for rm_name, prod_name, fy, tot_qty, tot_val in rm_sales:
    # Match customer for RM
    c_list = rm_cust_map.get(rm_name.strip().lower(), all_custs)
    if not c_list:
        c_list = all_custs
    cust_id, cust_name = c_list[inv_counter % len(c_list)]
    
    start_year = 2024 if fy == "2024-25" else 2025
    monthly_val = round(tot_val / 12, 2)
    monthly_qty = round(tot_qty / 12, 2)
    
    # Try finding rate/product_id
    prod_row = con.execute("SELECT id, rate, uom FROM tally_products WHERE lower(name)=lower(?)", (prod_name,)).fetchone()
    p_id = prod_row[0] if prod_row else f"PROD-{slug(prod_name)[:30]}"
    p_rate = prod_row[1] if (prod_row and prod_row[1] > 0) else round(monthly_val / max(1, monthly_qty), 2)
    p_uom = prod_row[2] if prod_row else "Nos"

    for idx in range(12):
        month = 4 + idx if idx < 9 else idx - 8
        year = start_year if idx < 9 else start_year + 1
        period = f"{year}-{month:02d}"
        inv_date = f"{period}-15"
        
        inv_id = f"INV-{period.replace('-', '')}-{inv_counter}"
        voucher_no = f"PSS/{period.replace('-', '')}/{inv_counter}"
        inv_counter += 1

        con.execute(
            """INSERT OR REPLACE INTO tally_invoices 
               (id, company_name, voucher_guid, voucher_number, voucher_type, invoice_date, customer_id, customer_name, amount, reference, source_sync_id, ingest_session_id)
               VALUES (?, 'Progressive Surface Systems Pvt. Ltd.', ?, ?, 'Sales', ?, ?, ?, ?, 'RM Product Invoice', 'excel-import', NULL)""",
            (inv_id, f"GUID-{inv_id}", voucher_no, inv_date, cust_id, cust_name, monthly_val)
        )
        invoices_created += 1

        line_id = f"LINE-{inv_id}-1"
        con.execute(
            """INSERT OR REPLACE INTO tally_invoice_lines 
               (id, invoice_id, product_id, product_name, quantity, rate, amount, uom)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (line_id, inv_id, p_id, prod_name, monthly_qty, p_rate, monthly_val, p_uom)
        )
        invoice_lines_created += 1

print(f"[import] Generated total {invoices_created} invoices with {invoice_lines_created} product lines across FY 2023-24, FY 2024-25, and FY 2025-26.")


# 9. Seed Field Visits, Overdue Follow-ups, and Expected Orders for Field Rep
today_str = datetime.now().strftime("%Y-%m-%d")
top_dealers = con.execute("SELECT id, name, city FROM tally_customers WHERE total_sales > 1000000 LIMIT 5").fetchall()

con.execute("DELETE FROM visits WHERE id LIKE 'demo-%'")
con.execute("DELETE FROM follow_ups WHERE id LIKE 'demo-%'")
con.execute("DELETE FROM expected_orders WHERE id LIKE 'demo-%'")

if top_dealers:
    d1, d2, d3 = top_dealers[0], top_dealers[1], top_dealers[2]
    # Visits
    con.execute(
        """INSERT OR REPLACE INTO visits 
           (id, user_id, business_date, tally_customer_id, scheduled_at, started_at, completed_at, purpose, outcome, notes, latitude, longitude, status, visit_tags)
           VALUES ('demo-v1', 'sp-101', ?, ?, ?, ?, ?, 'Routine Sales & Technical Review', 'Order discussion positive', 'Customer requested 50 bags of Galvacont.', 28.4595, 77.0266, 'completed', 'Order Received,Routine Check')""",
        (today_str, d1[0], f"{today_str}T10:00:00", f"{today_str}T10:05:00", f"{today_str}T10:45:00")
    )
    con.execute(
        """INSERT OR REPLACE INTO visits 
           (id, user_id, business_date, tally_customer_id, scheduled_at, started_at, completed_at, purpose, outcome, notes, latitude, longitude, status, visit_tags)
           VALUES ('demo-v2', 'sp-101', ?, ?, ?, ?, NULL, 'Payment Collection & Follow-up', NULL, 'Discussion ongoing regarding payment schedule.', 28.4689, 77.0521, 'in_progress', 'Payment Collection')""",
        (today_str, d2[0], f"{today_str}T11:30:00", f"{today_str}T11:35:00")
    )
    con.execute(
        """INSERT OR REPLACE INTO visits 
           (id, user_id, business_date, tally_customer_id, scheduled_at, started_at, completed_at, purpose, outcome, notes, latitude, longitude, status, visit_tags)
           VALUES ('demo-v3', 'sp-101', ?, ?, ?, NULL, NULL, 'Product Demo / Trial', NULL, 'Scheduled afternoon demo session.', 28.4820, 77.0890, 'planned', 'Demonstration')""",
        (today_str, d3[0], f"{today_str}T14:30:00")
    )

    # Follow-ups (one today, one overdue for alert testing)
    con.execute(
        """INSERT OR REPLACE INTO follow_ups 
           (id, user_id, visit_id, tally_customer_id, title, due_date, priority, completed)
           VALUES ('demo-fu1', 'sp-101', 'demo-v1', ?, 'Collect signed purchase order for Galvacont', ?, 'today', 0)""",
        (d1[0], today_str)
    )
    con.execute(
        """INSERT OR REPLACE INTO follow_ups 
           (id, user_id, visit_id, tally_customer_id, title, due_date, priority, completed)
           VALUES ('demo-fu2', 'sp-101', 'demo-v2', ?, 'Follow-up on overdue payment of Rs 2.4 Lakhs', '2026-09-25', 'high', 0)""",
        (d2[0],)
    )

    # Expected Orders
    p_demo = product_list[0]
    con.execute(
        """INSERT OR REPLACE INTO expected_orders 
           (id, visit_id, user_id, tally_customer_id, tally_product_id, expected_value, expected_date, status)
           VALUES ('demo-eo1', 'demo-v1', 'sp-101', ?, ?, 350000, ?, 'open')""",
        (d1[0], p_demo[0], today_str)
    )
    print("[import] Seeded demo field activity (visits, follow-ups, expected orders) with real customers.")

# Set metadata
stamp = datetime.now().isoformat(timespec="seconds")
con.execute("INSERT OR REPLACE INTO tally_import_metadata VALUES ('last_import_at', ?)", (stamp,))
con.execute("INSERT OR REPLACE INTO tally_import_metadata VALUES ('source', 'PSSPL Excel data directory')")

con.commit()
con.execute("PRAGMA foreign_keys = ON")

print("\n" + "=" * 50)
print(f"DATABASE IMPORT COMPLETED SUCCESSFULLY AT {stamp}")
print("=" * 50)
summary = {
    t: con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    for t in [
        "tally_customers",
        "tally_customer_monthly_sales",
        "tally_products",
        "tally_product_monthly_sales",
        "tally_rm_product_sales",
        "tally_rm_targets",
        "tally_salespeople",
        "tally_invoices",
        "tally_invoice_lines",
        "users"
    ]
}
for k, v in summary.items():
    print(f"  {k:30}: {v} records")
con.close()
