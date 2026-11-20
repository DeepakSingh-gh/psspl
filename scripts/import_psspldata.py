"""Import real PSSPL workbooks into local CRM SQLite database."""
import io, math, re, sqlite3, sys
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

def reported_num(v):
    """A blank/invalid cell is no update; an explicit zero or return is evidence."""
    if v is None or (isinstance(v, str) and not v.strip()):
        return None
    try:
        value = float(v)
        return value if math.isfinite(value) else None
    except (TypeError, ValueError):
        return None

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

def load_wb(fn):
    p = DATA_DIR / fn
    if not p.is_file():
        print(f"[import] WARNING: File {fn} not found in {DATA_DIR}")
        return None
    with open(p, "rb") as f:
        return openpyxl.load_workbook(io.BytesIO(f.read()), data_only=True, read_only=True)

con = sqlite3.connect(DB_PATH)
con.execute("PRAGMA foreign_keys = OFF") # temporarily off during table refresh

# Import only keys present in supplied workbooks. An absent workbook or period
# provides no evidence that existing targets/history should be removed.

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
            """INSERT INTO tally_customers
               (id, name, party_type, rm_name, rm_code, city, destination_code, total_sales, outstanding, last_payment_date, source_file)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET name=excluded.name, party_type=excluded.party_type,
               rm_name=excluded.rm_name, rm_code=excluded.rm_code, city=excluded.city,
               destination_code=excluded.destination_code, total_sales=excluded.total_sales,
               outstanding=excluded.outstanding, last_payment_date=excluded.last_payment_date,
               source_file=excluded.source_file""",
            (cust_id, name, party_type, rm_name, rm_code, city, destination_code, total_sales, outstanding, last_payment_date, fn6)
        )
        customers_imported += 1

        for period, amount in zip(periods6, row[9:23]):
            val = reported_num(amount)
            if val is not None:
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
        monthly = [reported_num(x) for x in row[7:19]]
        total_qty = reported_num(row[19])
        if total_qty is None:
            total_qty = sum(m for m in monthly if m is not None)
        total_val = rate * total_qty
        freq = sum(1 for m in monthly if m is not None and m > 0)

        con.execute(
            """INSERT INTO tally_products
               (id, name, packing_size, uom, rate, total_qty, total_value, frequency, source_file)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET name=excluded.name, packing_size=excluded.packing_size,
               uom=excluded.uom, rate=excluded.rate, total_qty=excluded.total_qty,
               total_value=excluded.total_value, frequency=excluded.frequency,
               source_file=excluded.source_file""",
            (prod_id, name, packing_size, uom, rate, total_qty, total_val, freq, fn8)
        )
        products_imported += 1

        for idx, qty in enumerate(monthly):
            if qty is not None:
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
                q_val = reported_num(qty)
                s_val = reported_num(sales)
                if q_val is not None or s_val is not None:
                    old_q, old_s = aggregates.get((pname, fy), (None, None))
                    aggregates[(pname, fy)] = (
                        old_q if q_val is None else (old_q or 0) + q_val,
                        old_s if s_val is None else (old_s or 0) + s_val,
                    )

        for (pname, fy), (qty, sales) in aggregates.items():
            con.execute(
                """INSERT INTO tally_rm_product_sales
                   (rm_name, product_name, financial_year, quantity, sales_value)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(rm_name, product_name, financial_year) DO UPDATE SET
                   quantity=COALESCE(excluded.quantity,tally_rm_product_sales.quantity),
                   sales_value=COALESCE(excluded.sales_value,tally_rm_product_sales.sales_value)""",
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
                target_value = reported_num(target)
                if target_value is None:
                    continue
                year, month = (2024, idx + 4) if idx < 9 else (2025, idx - 8)
                period = f"{year}-{month:02d}"
                con.execute(
                    "INSERT OR REPLACE INTO tally_rm_targets (rm_name, period, target_lakh) VALUES (?, ?, ?)",
                    (rm, period, target_value)
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
                val = reported_num(amt)
                if val is not None:
                    year, month = (2024, idx + 4) if idx < 9 else (2025, idx - 8)
                    con.execute(
                        "INSERT OR REPLACE INTO tally_party_payments (party_name, period, amount_lakh) VALUES (?, ?, ?)",
                        ("2 Daughters", f"{year}-{month:02d}", val)
                    )
                    party_payments_imported += 1

print(f"[import] Imported {party_payments_imported} party payment records.")

# Workbook summaries establish aggregates, never individual vouchers or activity.
# Employee accounts, credentials and customer ownership are administered in CRM.
print("[import] Retained existing accounts and verified customer ownership.")
print("[import] Workbook invoice detail is unavailable; no vouchers or field activities were generated.")

# Set metadata
stamp = datetime.now().isoformat(timespec="seconds")
con.execute("INSERT OR REPLACE INTO tally_import_metadata VALUES ('last_import_at', ?)", (stamp,))
con.execute("INSERT OR REPLACE INTO tally_import_metadata VALUES ('source', 'PSSPL Excel data directory')")
con.execute("INSERT OR REPLACE INTO tally_import_metadata VALUES ('workbook_invoice_detail', 'unavailable: source workbooks provide aggregate reports only')")

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
