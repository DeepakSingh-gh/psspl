import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,existsSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {cleanupDummyData} from './remove-dummy-data.mjs';

function fixture({ambiguous=false,unknownChild=false}={}) {
  const dir=mkdtempSync(join(tmpdir(),'psspl-cleanup-test-')),file=join(dir,'fixture.sqlite'),db=new DatabaseSync(file);
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE tally_customers(id TEXT PRIMARY KEY,name TEXT,source_file TEXT,owner_user_id TEXT,total_sales REAL,outstanding REAL);
    CREATE TABLE tally_invoices(id TEXT PRIMARY KEY,customer_id TEXT REFERENCES tally_customers(id),source_sync_id TEXT,reference TEXT,voucher_guid TEXT,amount REAL);
    CREATE TABLE tally_invoice_lines(id TEXT PRIMARY KEY,invoice_id TEXT REFERENCES tally_invoices(id),amount REAL);
    CREATE TABLE visits(id TEXT PRIMARY KEY,user_id TEXT,tally_customer_id TEXT,notes TEXT);
    CREATE TABLE expected_orders(id TEXT PRIMARY KEY,visit_id TEXT REFERENCES visits(id),tally_customer_id TEXT,expected_value REAL);
    CREATE TABLE visit_products(visit_id TEXT REFERENCES visits(id),tally_product_id TEXT,PRIMARY KEY(visit_id,tally_product_id));
    CREATE TABLE customer_activities(id TEXT PRIMARY KEY,tally_customer_id TEXT,notes TEXT);
    CREATE TABLE dormant_reasons(id TEXT PRIMARY KEY,customer_id TEXT,reason TEXT);
    INSERT INTO tally_customers VALUES('dummy-1','Real dealer',NULL,'old-actor',999,999),('tally-real','Real dealer','Tally Connector · actual company','verified-owner',100,20);
    INSERT INTO tally_invoices VALUES('actual','tally-real','live-sync','Actual voucher','real-guid',42),('INV-202609-1','tally-real','excel-import','Monthly Sales Invoice','GUID-INV-202609-1',999);
    INSERT INTO tally_invoice_lines VALUES('actual-line','actual',42),('fake-line','INV-202609-1',999);
    INSERT INTO visits VALUES('user-work','actor','dummy-1','Actual user work'),('demo-v1','actor','tally-real','Seeded sample');
    INSERT INTO expected_orders VALUES('real-order','user-work','dummy-1',123),('demo-eo1','demo-v1','tally-real',999);
    INSERT INTO visit_products VALUES('demo-v1','product');
    INSERT INTO customer_activities VALUES('real-call','dummy-1','Actual call');
    INSERT INTO dormant_reasons VALUES('real-reason','dummy-1','Recorded by actual manager');`);
  db.exec("ALTER TABLE tally_invoices ADD COLUMN company_name TEXT DEFAULT 'Actual company'");
  if(ambiguous)db.exec("INSERT INTO tally_customers VALUES('second-real','Real dealer','Tally Connector · another company',NULL,1,1)");
  if(unknownChild)db.exec("CREATE TABLE unreviewed_child(id TEXT PRIMARY KEY,parent_id TEXT REFERENCES visits(id)); INSERT INTO unreviewed_child VALUES('keep','demo-v1')");
  db.close();return {file,backup:join(dir,'before.sqlite')};
}
const open=file=>new DatabaseSync(file,{readOnly:true});

test('dry run identifies fixtures without changing rows or creating backup/archive',async()=>{
  const {file,backup}=fixture();const before=readFileSync(file);
  const result=await cleanupDummyData({databasePath:file,backupPath:backup});
  assert.equal(result.applied,false);assert.equal(result.counts.tally_invoices,1);assert.equal(result.counts.tally_customers,1);
  assert.equal(result.relinkedRows,4,'logical references must be preserved even without declared foreign keys');
  assert.deepEqual(readFileSync(file),before);assert.equal(existsSync(backup),false);
});

test('backs up and archives fixtures, preserves real work/ownership, and is idempotent',async()=>{
  const {file,backup}=fixture();const result=await cleanupDummyData({databasePath:file,backupPath:backup,apply:true});
  assert.equal(result.applied,true);assert.ok(existsSync(backup));
  const db=open(file),old=open(backup);
  assert.equal(old.prepare('SELECT COUNT(*) n FROM tally_customers').get().n,2);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM tally_customers').get().n,1);
  assert.equal(db.prepare("SELECT tally_customer_id FROM visits WHERE id='user-work'").get().tally_customer_id,'tally-real');
  assert.equal(db.prepare("SELECT notes FROM visits WHERE id='user-work'").get().notes,'Actual user work');
  assert.equal(db.prepare("SELECT owner_user_id FROM tally_customers WHERE id='tally-real'").get().owner_user_id,'verified-owner');
  assert.equal(db.prepare("SELECT expected_value FROM expected_orders WHERE id='real-order'").get().expected_value,123);
  assert.equal(db.prepare("SELECT tally_customer_id FROM customer_activities WHERE id='real-call'").get().tally_customer_id,'tally-real');
  assert.equal(db.prepare("SELECT customer_id FROM dormant_reasons WHERE id='real-reason'").get().customer_id,'tally-real');
  assert.equal(db.prepare("SELECT amount FROM tally_invoices WHERE id='actual'").get().amount,42);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM tally_invoice_lines').get().n,1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM visits WHERE id='demo-v1'").get().n,0);
  assert.ok(db.prepare('SELECT COUNT(*) n FROM crm_dummy_cleanup_archive').get().n>=7);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);db.close();old.close();
  const second=await cleanupDummyData({databasePath:file,backupPath:backup,apply:true});
  assert.equal(second.applied,false);assert.equal(second.reason,'No known dummy data found');
});

test('refuses ambiguous exact-name matches without touching the database',async()=>{
  const {file,backup}=fixture({ambiguous:true});const before=readFileSync(file);
  await assert.rejects(cleanupDummyData({databasePath:file,backupPath:backup,apply:true}),/unique.*Tally|ambiguous/i);
  assert.deepEqual(readFileSync(file),before);assert.equal(existsSync(backup),false);
});

test('unreviewed foreign-key dependents stop cleanup before any change',async()=>{
  const {file,backup}=fixture({unknownChild:true});const before=readFileSync(file);
  await assert.rejects(cleanupDummyData({databasePath:file,backupPath:backup,apply:true}),/dependent|foreign.key|unreviewed/i);
  assert.deepEqual(readFileSync(file),before);
});

test('never removes an unknown invoice merely because its source is excel-import',async()=>{
  const {file,backup}=fixture();const db=new DatabaseSync(file);db.exec("INSERT INTO tally_invoices VALUES('user-import','tally-real','excel-import','User supplied original invoice','actual-import-guid',321,'Actual company')");db.close();
  await cleanupDummyData({databasePath:file,backupPath:backup,apply:true});
  const checked=open(file);assert.equal(checked.prepare("SELECT amount FROM tally_invoices WHERE id='user-import'").get().amount,321);checked.close();
});

test('refuses removing a showcase product referenced by genuine work without a declared FK',async()=>{
  const {file,backup}=fixture(),db=new DatabaseSync(file);
  db.exec("CREATE TABLE tally_products(id TEXT PRIMARY KEY,name TEXT); CREATE TABLE leads(id TEXT PRIMARY KEY,interested_product_id TEXT); INSERT INTO tally_products VALUES('webinar-demo-product','Showcase only'); INSERT INTO leads VALUES('actual-lead','webinar-demo-product')");db.close();
  await assert.rejects(cleanupDummyData({databasePath:file,backupPath:backup,apply:true}),/dependent|product/i);
  assert.equal(existsSync(backup),false);
});

test('mid-transaction failure restores all rows and leaves a valid untouched backup',async()=>{
  const {file,backup}=fixture(),db=new DatabaseSync(file);
  db.exec("CREATE TRIGGER reject_fixture_delete BEFORE DELETE ON visits WHEN OLD.id='demo-v1' BEGIN SELECT RAISE(ABORT,'injected deletion failure'); END");db.close();
  await assert.rejects(cleanupDummyData({databasePath:file,backupPath:backup,apply:true}),/injected deletion failure/);
  const checked=open(file),saved=open(backup);
  for(const table of ['tally_customers','tally_invoices','tally_invoice_lines','visits','expected_orders','customer_activities'])assert.deepEqual(checked.prepare(`SELECT * FROM ${table} ORDER BY id`).all(),saved.prepare(`SELECT * FROM ${table} ORDER BY id`).all());
  assert.equal(checked.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='crm_dummy_cleanup_archive'").get().n,0);
  assert.equal(saved.prepare('PRAGMA integrity_check').get().integrity_check,'ok');checked.close();saved.close();
});

test('removing an existing invalid synthetic line is allowed without introducing any new violation',async()=>{
  const {file,backup}=fixture(),db=new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys=OFF; CREATE TABLE tally_products(id TEXT PRIMARY KEY,name TEXT); ALTER TABLE tally_invoice_lines ADD COLUMN product_id TEXT REFERENCES tally_products(id); UPDATE tally_invoice_lines SET product_id='missing-legacy-product' WHERE id='fake-line'");
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,1);db.close();
  const result=await cleanupDummyData({databasePath:file,backupPath:backup,apply:true});
  assert.equal(result.applied,true);assert.equal(result.foreignKeyViolations,0);
});
