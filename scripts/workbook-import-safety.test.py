"""Importer regression: all database connections are redirected into a temp fixture."""
import contextlib
import io
from pathlib import Path
import runpy
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

import openpyxl


class WorkbookImportSafety(unittest.TestCase):
    def test_real_aggregates_import_without_replacing_evidence_or_accounts(self):
        with tempfile.TemporaryDirectory(prefix="psspl-import-fixture-") as directory, contextlib.ExitStack() as resources:
            root = Path(directory)
            database = root / "fixture.sqlite"
            connect = sqlite3.connect
            con = resources.enter_context(contextlib.closing(connect(database)))
            con.executescript("""
                CREATE TABLE tally_customers(id TEXT PRIMARY KEY,name,party_type,rm_name,rm_code,city,destination_code,total_sales,outstanding,last_payment_date,source_file,owner_user_id,phone);
                CREATE TABLE tally_products(id TEXT PRIMARY KEY,name,packing_size,uom,rate,total_qty,total_value,frequency,source_file);
                CREATE TABLE tally_customer_monthly_sales(customer_id,period,amount,PRIMARY KEY(customer_id,period));
                CREATE TABLE tally_product_monthly_sales(product_id,period,quantity,sales_value,PRIMARY KEY(product_id,period));
                CREATE TABLE tally_rm_product_sales(rm_name,product_name,financial_year,quantity,sales_value,PRIMARY KEY(rm_name,product_name,financial_year));
                CREATE TABLE tally_rm_targets(rm_name,period,target_lakh,PRIMARY KEY(rm_name,period));
                CREATE TABLE tally_party_payments(party_name,period,amount_lakh,PRIMARY KEY(party_name,period));
                CREATE TABLE tally_salespeople(code,name,rm_name,city,joined_on);
                CREATE TABLE tally_import_metadata(key TEXT PRIMARY KEY,value);
                CREATE TABLE tally_invoices(id TEXT PRIMARY KEY,amount);
                CREATE TABLE tally_invoice_lines(id TEXT PRIMARY KEY,invoice_id,amount);
                CREATE TABLE users(id TEXT PRIMARY KEY,password_hash);
                CREATE TABLE salesperson_profiles(user_id TEXT PRIMARY KEY,full_name);
                CREATE TABLE visits(id TEXT PRIMARY KEY);
                CREATE TABLE follow_ups(id TEXT PRIMARY KEY);
                CREATE TABLE expected_orders(id TEXT PRIMARY KEY);
                INSERT INTO tally_customers(id,name,owner_user_id,phone) VALUES('C1','Original','employee-id','contact-retained');
                INSERT INTO tally_customers(id,name) VALUES('connector-only','Retained connector customer');
                INSERT INTO tally_products(id,name) VALUES('connector-product','Retained connector product');
                INSERT INTO tally_invoices VALUES('actual-invoice',123);
                INSERT INTO tally_invoice_lines VALUES('actual-line','actual-invoice',123);
                INSERT INTO users VALUES('employee-id','unchanged-test-hash');
                INSERT INTO salesperson_profiles VALUES('employee-id','Existing employee');
                INSERT INTO visits VALUES('actual-visit');
                INSERT INTO tally_customer_monthly_sales VALUES('connector-only','2026-10',789);
                INSERT INTO tally_customer_monthly_sales VALUES('C1','2023-05',42);
                INSERT INTO tally_product_monthly_sales VALUES('connector-product','2026-10',2,456);
                INSERT INTO tally_product_monthly_sales VALUES('P1','2022-05',9,90);
                INSERT INTO tally_rm_product_sales VALUES('Verified RM','Actual product','2026-27',2,456);
                INSERT INTO tally_rm_targets VALUES('Verified RM','2026-10',12.34);
                INSERT INTO tally_party_payments VALUES('Verified party','2026-10',1.23);
                INSERT INTO tally_salespeople VALUES('ACTUAL-1','Existing person','Verified RM','Source city','2024-01-01');
            """)
            con.commit()
            preserved = ['users', 'salesperson_profiles', 'tally_invoices', 'tally_invoice_lines', 'visits', 'follow_ups', 'expected_orders']
            before = {table: con.execute(f'SELECT * FROM {table}').fetchall() for table in preserved}
            aggregates = ['tally_customer_monthly_sales', 'tally_product_monthly_sales', 'tally_rm_product_sales', 'tally_rm_targets', 'tally_party_payments', 'tally_salespeople']
            genuine = {table: con.execute(f'SELECT * FROM {table}').fetchall() for table in aggregates}
            importer = Path(__file__).with_name('import_psspldata.py')
            with patch('sqlite3.connect', side_effect=lambda *args, **kwargs: connect(database)), patch('sys.argv', [str(importer), str(root)]), contextlib.redirect_stdout(io.StringIO()):
                runpy.run_path(str(importer), run_name='__main__')
            for table in aggregates:
                self.assertEqual(con.execute(f'SELECT * FROM {table}').fetchall(), genuine[table], 'empty folder must preserve ' + table)
            book = openpyxl.Workbook()
            sheet = book.active
            sheet.title = "Master Data"
            values = {2: 'Workbook customer', 3: 'C1', 4: 'Dealer', 5: 'Source RM', 9: 321, 10: 123, 24: 12, 25: '2024-05-01'}
            for column, value in values.items():
                sheet.cell(5, column, value)
            book.save(root / "6) Dealer Summary Apr, 2023 to May, 2024.xlsx")
            # Even if importer target defaults change, no connection can escape this fixture.
            with patch('sqlite3.connect', side_effect=lambda *args, **kwargs: connect(database)), patch('sys.argv', [str(importer), str(root)]), contextlib.redirect_stdout(io.StringIO()):
                runpy.run_path(str(importer), run_name='__main__')
            self.assertEqual(con.execute("SELECT amount FROM tally_customer_monthly_sales WHERE customer_id='C1' AND period='2023-04'").fetchone(), (123,))
            self.assertEqual(con.execute("SELECT name,owner_user_id,phone FROM tally_customers WHERE id='C1'").fetchone(), ('Workbook customer', 'employee-id', 'contact-retained'))
            self.assertEqual(con.execute("SELECT COUNT(*) FROM tally_customers WHERE id='connector-only'").fetchone(), (1,))
            self.assertEqual(con.execute("SELECT COUNT(*) FROM tally_products WHERE id='connector-product'").fetchone(), (1,))
            for table in preserved:
                self.assertEqual(con.execute(f'SELECT * FROM {table}').fetchall(), before[table], table)
            for table in aggregates:
                rows = con.execute(f'SELECT * FROM {table}').fetchall()
                for row in genuine[table]:
                    self.assertIn(row, rows, 'partial folder must preserve unrelated ' + table)
            # Supplied zero replaces the old value; blank cells provide no new evidence.
            sheet.cell(5, 10, 0)
            sheet.cell(5, 12, -5)
            book.save(root / "6) Dealer Summary Apr, 2023 to May, 2024.xlsx")
            product_book = openpyxl.Workbook()
            product_sheet = product_book.active
            product_sheet.title = "Original Summary "
            for column, value in {2: 'P1', 3: 'Recorded product', 6: 10, 8: 3, 10: -2, 20: 1}.items():
                product_sheet.cell(5, column, value)
            product_path = root / "8) PSS Product Analysis I 2022-23 (005).xlsx"
            product_book.save(product_path)
            def import_fixture():
                with patch('sqlite3.connect', side_effect=lambda *args, **kwargs: connect(database)), patch('sys.argv', [str(importer), str(root)]), contextlib.redirect_stdout(io.StringIO()):
                    runpy.run_path(str(importer), run_name='__main__')
            import_fixture()
            self.assertEqual(con.execute("SELECT amount FROM tally_customer_monthly_sales WHERE customer_id='C1' AND period='2023-04'").fetchone(), (0,))
            self.assertEqual(con.execute("SELECT amount FROM tally_customer_monthly_sales WHERE customer_id='C1' AND period='2023-05'").fetchone(), (42,))
            self.assertEqual(con.execute("SELECT amount FROM tally_customer_monthly_sales WHERE customer_id='C1' AND period='2023-06'").fetchone(), (-5,))
            self.assertEqual(con.execute("SELECT quantity,sales_value FROM tally_product_monthly_sales WHERE product_id='P1' AND period='2022-04'").fetchone(), (3, 30))
            product_sheet.cell(5, 8, 0)
            product_book.save(product_path)
            import_fixture()
            self.assertEqual(con.execute("SELECT quantity,sales_value FROM tally_product_monthly_sales WHERE product_id='P1' AND period='2022-04'").fetchone(), (0, 0))
            self.assertEqual(con.execute("SELECT quantity,sales_value FROM tally_product_monthly_sales WHERE product_id='P1' AND period='2022-05'").fetchone(), (9, 90))
            self.assertEqual(con.execute("SELECT quantity,sales_value FROM tally_product_monthly_sales WHERE product_id='P1' AND period='2022-06'").fetchone(), (-2, -20))
            con.executescript("""
                INSERT INTO tally_rm_targets VALUES('Input RM','2024-04',12),('Input RM','2024-05',13);
                INSERT INTO tally_rm_product_sales VALUES('Input RM','Input product','2024-25',9,90),('Input RM','Input product','2025-26',8,80);
                INSERT INTO tally_party_payments VALUES('2 Daughters','2024-04',12),('2 Daughters','2024-05',13);
            """)
            target_book = openpyxl.Workbook()
            target_sheet = target_book.active
            target_sheet.title = 'Targets'
            target_sheet.cell(4,4,'Input RM'); target_sheet.cell(4,6,0); target_sheet.cell(4,17,1)
            target_book.save(root / '9) PSS Sales Incentive Calculations-24-25.xlsx')
            comparison = openpyxl.Workbook()
            comparison_sheet = comparison.active
            comparison_sheet.title = 'Input RM'
            for column, value in {2:'Input product',3:0,5:0,6:-20}.items():
                comparison_sheet.cell(3,column,value)
            comparison.save(root / '10) COMPARISON OF  PRODUCT WITH QTY.xlsx')
            payment_book = openpyxl.Workbook()
            payment_sheet = payment_book.active
            payment_sheet.title = 'Party wise Payments'
            payment_sheet.cell(15,1,'2024'); payment_sheet.cell(15,3,0); payment_sheet.cell(15,5,-2)
            payment_book.save(root / '2) All Party wise Payments.xlsx')
            import_fixture()
            self.assertEqual(con.execute("SELECT target_lakh FROM tally_rm_targets WHERE rm_name='Input RM' AND period IN ('2024-04','2024-05') ORDER BY period").fetchall(), [(0,), (13,)])
            self.assertEqual(con.execute("SELECT quantity,sales_value FROM tally_rm_product_sales WHERE rm_name='Input RM' ORDER BY financial_year").fetchall(), [(0,0), (8,-20)])
            self.assertEqual(con.execute("SELECT amount_lakh FROM tally_party_payments WHERE party_name='2 Daughters' ORDER BY period").fetchall(), [(0,), (13,), (-2,)])
            self.assertIn('unavailable', con.execute("SELECT value FROM tally_import_metadata WHERE key='workbook_invoice_detail'").fetchone()[0])
            con.close()


if __name__ == '__main__':
    unittest.main()
