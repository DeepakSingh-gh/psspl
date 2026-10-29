import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { rmTopSales } from '../server/rm-top-sales.mjs';
import { localReportPreview } from '../src/lib/rm-client-demo.mjs';
import { finalReportFixture } from './fixtures/rm-report-finalization.mjs';

test('Rais Khan local preview fills only empty products and preserves real rows, customers and totals',()=>{
  const options={enabled:true,role:'admin',audience:'admin',hostname:'localhost',today:'2026-10-27'};
  const report=finalReportFixture();
  report.topSales={totalSales:5300000,customers:[{id:'real',name:'Recorded customer',salesValue:100,sharePercent:1}],products:[],reason:'Aggregate snapshot only'};
  const original=structuredClone(report);
  const result=localReportPreview(report,options);
  assert.equal(result.topSales.products.length,5);
  assert.equal(result.topSales.products[0].salesValue,1590000);
  assert.match(result.topSales.productDemo.label,/illustrative/);
  assert.deepEqual(result.topSales.customers.slice(0,1),report.topSales.customers);
  assert.equal(result.topSales.customers.length,5);
  assert.ok(result.topSales.customers.slice(1).every(row=>row.sample&&row.sharePercent===null));
  assert.equal(result.topSales.totalSales,report.topSales.totalSales);
  assert.deepEqual(result.summary,report.summary);assert.deepEqual(report,original);
  assert.deepEqual(localReportPreview(report,{...options,enabled:false}),report);
  assert.deepEqual(localReportPreview(report,{...options,hostname:'example.com'}),report);
  const real={...report,topSales:{...report.topSales,products:[{id:'real-zero',name:'Recorded zero',salesValue:0,sharePercent:0}]}};
  assert.deepEqual(localReportPreview(real,options).topSales.products,real.topSales.products);
  const full={...report,topSales:{...report.topSales,customers:Array.from({length:5},(_,i)=>({...report.topSales.customers[0],id:String(i)}))}};
  assert.deepEqual(localReportPreview(full,options).topSales.customers,full.topSales.customers);
  const other={...report,rmCode:'OTHER'};
  assert.deepEqual(localReportPreview(other,options).topSales,other.topSales);
  const person={...report,selectedSalespersonId:'rep'};
  assert.deepEqual(localReportPreview(person,options),person);
});

function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE tally_customers(id TEXT PRIMARY KEY,owner_user_id TEXT);
    CREATE TABLE tally_products(id TEXT PRIMARY KEY,name TEXT);
    CREATE TABLE tally_invoices(id TEXT PRIMARY KEY,customer_id TEXT,invoice_date TEXT,voucher_type TEXT,ingest_session_id TEXT,source_sync_id TEXT);
    CREATE TABLE tally_invoice_lines(id TEXT PRIMARY KEY,invoice_id TEXT,product_id TEXT,product_name TEXT,amount REAL);
    INSERT INTO tally_customers VALUES('a','rm-a'),('b','rm-b');
    INSERT INTO tally_products VALUES('p1','Product (1 KG)'),('p2','Product (5 KG)'),('p3','Same name'),('p4','Same name');`);
  let index = 0;
  const add = (date, amount, product = 'p1', customer = 'a', type = 'Sales', ingest = null, source = null, name = 'Recorded name') => {
    const id = String(++index);
    db.prepare('INSERT INTO tally_invoices VALUES(?,?,?,?,?,?)').run(id, customer, date, type, ingest, source);
    db.prepare('INSERT INTO tally_invoice_lines VALUES(?,?,?,?,?)').run(id, id, product, name, amount);
  };
  const options = { ids: ['rm-a'], dealers: [{ id:'c1', name:'Customer 1', salesValue:600 }, { id:'c2', name:'Customer 2', salesValue:400 }], from:'2026-04-01', to:'2026-04-30', totalSales:1000, available:true };
  return { db, add, options };
}

test('ranks five real groups, preserves master IDs and packaging variants, and uses total RM sales for shares', () => {
  const {db,add,options}=fixture();
  try {
    for(const [id,amount] of [['p1',250],['p2',200],['p3',150],['p4',100],['p5',75],['p6',50]])add('2026-04-02',amount,id);
    add('2026-04-03',25,'p1'); // Same master ID, another invoice, counted once.
    const dealers=Array.from({length:7},(_,i)=>({id:`c${i}`,name:`Customer ${i}`,salesValue:(i+1)*25}));
    const before=structuredClone(dealers);
    const result=rmTopSales(db,{...options,dealers});
    assert.deepEqual(result.products.map(p=>p.salesValue),[275,200,150,100,75]);
    assert.deepEqual(result.products.map(p=>p.id),['id:p1','id:p2','id:p3','id:p4','id:p5']);
    assert.equal(result.products[0].sharePercent,27.5);
    assert.equal(result.products[1].name,'Product (5 KG)');
    assert.equal(result.products[2].name,result.products[3].name,'Different master IDs never merge by name.');
    assert.deepEqual(result.customers.map(c=>c.salesValue),[175,150,125,100,75]);
    assert.deepEqual(dealers,before);
    assert.equal(result.productTotal,850);assert.equal(result.productVariance,-150);
  } finally {db.close();}
});

test('scope and dates exclude other RMs/imports/staging; credit notes and returns reduce sales',()=>{
  const {db,add,options}=fixture();
  try {
    add('2026-04-01',500);add('2026-04-07',50,'p1','a','Credit Note');add('2026-04-08',100,'p1','a','Sales Return');
    add('2026-04-30',200,'p2');add('2026-03-31',9999);add('2026-05-01',9999);
    add('2026-04-02',9999,'p1','b');add('2026-04-02',9999,'p1','a','Sales','staged');add('2026-04-02',9999,'p1','a','Sales',null,'excel-import');
    const month=rmTopSales(db,options);assert.deepEqual(month.products.map(p=>p.salesValue),[350,200]);
    const week=rmTopSales(db,{...options,to:'2026-04-07',totalSales:450});
    assert.equal(week.products.length,1);assert.equal(week.products[0].salesValue,450);assert.equal(week.products[0].sharePercent,100);
    const next=rmTopSales(db,{...options,from:'2026-04-08',to:'2026-04-14',totalSales:-100});
    assert.equal(next.products[0].salesValue,-100);assert.equal(next.products[0].sharePercent,null);assert.match(next.shareReason,/zero or negative/);
  } finally {db.close();}
});

test('missing source evidence cannot be replaced by snapshot/demo data; genuine zeros stay zero',()=>{
  const {db,add,options}=fixture();
  try {
    add('2026-04-01',0);
    const zero=rmTopSales(db,{...options,totalSales:0});assert.equal(zero.products[0].salesValue,0);assert.equal(zero.products[0].sharePercent,null);
    assert.deepEqual(rmTopSales(db,{...options,available:false,reason:'Aggregate snapshot only'}),{totalSales:1000,customers:[],products:[],reason:'Aggregate snapshot only'});
    const missing=rmTopSales(db,{...options,from:'2026-05-01',to:'2026-05-31',dealers:[]});assert.deepEqual(missing.products,[]);assert.deepEqual(missing.customers,[]);
  } finally {db.close();}
});
