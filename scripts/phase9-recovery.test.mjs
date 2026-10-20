import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readdirSync, copyFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runMigrations } from '../server/migrations.mjs';
import { indiaBusinessDate, reportDateRange, businessDateRange, shiftBusinessDate } from '../shared/business-date.mjs';
import { reportCsv, reportExcelCell, reportExcelTable, FullSalesReportPrint } from '../shared/report-export.mjs';
import { renderToStaticMarkup } from 'react-dom/server';

function legacyFixture(work) {
  const directory=mkdtempSync(join(tmpdir(),'psspl-phase9-migrations-'));
  const db=new DatabaseSync(':memory:');
  try {
    for(const name of readdirSync('database/migrations')) if(/^00[1-4]_.*\.sql$/.test(name)) copyFileSync(join('database/migrations',name),join(directory,name));
    runMigrations(db,{directory});
    const addNew=()=>copyFileSync('database/migrations/005_profile_metadata.sql',join(directory,'005_profile_metadata.sql'));
    work(db,directory,addNew);
  } finally {db.close();rmSync(directory,{recursive:true,force:true});}
}

test('clean migrations include nullable profile metadata and are repeatable without runtime repair',()=>{
  const db=new DatabaseSync(':memory:');
  try {
    const applied=runMigrations(db); assert.ok(applied.some(row=>row.version==='005'));
    const columns=db.prepare('PRAGMA table_info(salesperson_profiles)').all();
    for(const name of ['operating_city','reg_code_1','reg_code_2']) assert.equal(columns.find(row=>row.name===name).type,'TEXT');
    assert.deepEqual(runMigrations(db),[]);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  }finally{db.close();}
});

test('legacy and partially populated metadata survive additive migration unchanged',()=>{
  for(const count of [0,1,3]) legacyFixture((db,directory,addNew)=>{
    const fields=['operating_city','reg_code_1','reg_code_2'];
    for(const column of fields.slice(0,count))db.exec(`ALTER TABLE salesperson_profiles ADD COLUMN ${column} TEXT;`);
    db.prepare("INSERT INTO users(id,email,password_hash,role) VALUES('legacy','legacy@example.test','synthetic','rm')").run();
    db.prepare("INSERT INTO salesperson_profiles(user_id,employee_code,full_name,region,territory,monthly_target) VALUES('legacy','legacy','Existing RM','North','Existing territory',123)").run();
    for(const column of fields.slice(0,count))db.prepare(`UPDATE salesperson_profiles SET ${column}=? WHERE user_id='legacy'`).run(`existing-${column}`);
    addNew();assert.equal(runMigrations(db,{directory}).length,1);
    const row=db.prepare("SELECT * FROM salesperson_profiles WHERE user_id='legacy'").get();
    assert.equal(row.monthly_target,123);assert.equal(row.full_name,'Existing RM');
    for(const [index,column] of fields.entries())assert.equal(row[column],index<count?`existing-${column}`:null);
    assert.deepEqual(runMigrations(db,{directory}),[]);
  });
});

test('incompatible legacy metadata fails transactionally and does not mark migration applied',()=>legacyFixture((db,directory,addNew)=>{
  db.exec('ALTER TABLE salesperson_profiles ADD COLUMN reg_code_1 INTEGER;');addNew();
  assert.throws(()=>runMigrations(db,{directory}),/Incompatible existing column/);
  assert.equal(db.prepare("SELECT version FROM schema_migrations WHERE version='005'").get(),undefined);
  assert.ok(!db.prepare('PRAGMA table_info(salesperson_profiles)').all().some(row=>row.name==='operating_city'));
}));

test('India calendar handles midnight, month/year-end, fiscal rollover and leap day',()=>{
  for(const [instant,date] of [
    ['2026-09-30T18:29:59.999Z','2026-09-30'],['2026-09-30T18:30:00Z','2026-10-01'],
    ['2026-12-31T18:30:00Z','2027-01-01'],['2027-03-31T18:30:00Z','2027-04-01'],['2028-02-28T18:30:00Z','2028-02-29']
  ])assert.equal(indiaBusinessDate(new Date(instant)),date);
  assert.deepEqual(reportDateRange('fy',new Date('2027-03-31T18:29:59Z')),{from:'2026-04-01',to:'2027-03-31'});
  assert.deepEqual(reportDateRange('fy',new Date('2027-03-31T18:30:00Z')),{from:'2027-04-01',to:'2027-04-01'});
  assert.deepEqual(reportDateRange('lastMonth',new Date('2028-03-01T00:00:00Z')),{from:'2028-02-01',to:'2028-02-29'});
});

test('daily, rolling-week, monthly, prior-month and custom ranges are inclusive calendar dates',()=>{
  const now=new Date('2026-12-31T18:30:00Z');
  assert.deepEqual(reportDateRange('today',now),{from:'2027-01-01',to:'2027-01-01'});
  assert.deepEqual(reportDateRange('week',now),{from:'2026-12-26',to:'2027-01-01'});
  assert.deepEqual(reportDateRange('month',now),{from:'2027-01-01',to:'2027-01-01'});
  assert.deepEqual(reportDateRange('lastMonth',now),{from:'2026-12-01',to:'2026-12-31'});
  assert.equal(shiftBusinessDate('2028-03-01',-1),'2028-02-29');
  assert.deepEqual(businessDateRange('2026-12-31','2027-01-02'),{from:'2026-12-31',to:'2027-01-02'});
  assert.throws(()=>businessDateRange('2026-02-30','2026-03-01'),RangeError);
  assert.throws(()=>businessDateRange('2027-01-02','2027-01-01'),RangeError);
});

test('CSV and Excel exports escape formulas and markup while retaining numeric values',()=>{
  assert.equal(reportCsv([['=SUM(A1:A2)','plain text',-42]]), '"\'=SUM(A1:A2)","plain text","-42"');
  assert.equal(reportExcelCell('  @SUM(A1)'), "'  @SUM(A1)");
  assert.match(reportExcelTable(['<Region>'], [['=1+1']]), /&lt;Region&gt;/);
  assert.match(reportExcelTable(['Region'], [['=1+1']]), /&#39;|&#x27;|'=1\+1/);
});

test('print output renders every report row independent of screen pagination',()=>{
  const rows=Array.from({length:137},(_,index)=>[`Customer ${index+1}`,100+index]);
  const markup=renderToStaticMarkup(FullSalesReportPrint({headings:['Customer','Sales'],rows,from:'2026-04-01',to:'2027-03-31',filters:['region=North'],totalSales:30000}));
  assert.equal((markup.match(/<tr>/g)||[]).length,138);
  assert.match(markup,/Customer 137/);assert.match(markup,/region=North/);
});
