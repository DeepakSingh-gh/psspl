import {DatabaseSync,backup} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,chmodSync,openSync,closeSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';

const quote=name=>'"'+name.replaceAll('"','""')+'"';
const fixtureCustomers=Array.from({length:9},(_,index)=>`dummy-${index+1}`);
const activityIds={visits:['demo-v1','demo-v2','demo-v3','demo-visit-1','demo-visit-2','demo-visit-3'],expected_orders:['demo-eo1'],follow_ups:['demo-fu1','demo-fu2','demo-follow-1','demo-follow-2','demo-follow-3'],attendance:['demo-att-1'],location_pings:['demo-ping-1','demo-ping-2','demo-ping-3','demo-ping-4','demo-ping-5']};
const customerReferences=new Set(['visits.tally_customer_id','expected_orders.tally_customer_id','follow_ups.tally_customer_id','customer_activities.tally_customer_id','service_requests.tally_customer_id','leads.tally_customer_id','tally_invoices.customer_id','tally_payments_live.customer_id','dormant_reasons.customer_id']);

function inspect(db) {
  const schemas=new Map(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'crm_dummy_cleanup_%'").all().map(({name})=>[name,{columns:db.prepare(`PRAGMA table_info(${quote(name)})`).all(),foreignKeys:db.prepare(`PRAGMA foreign_key_list(${quote(name)})`).all()}]));
  const key=(table,row)=>JSON.stringify(schemas.get(table).columns.filter(c=>c.pk).sort((a,b)=>a.pk-b.pk).map(c=>[c.name,row[c.name]]));
  const removed=new Map(),relinked=new Map(),customerMap=new Map();
  const add=(table,row,reason)=>{
    if(!removed.has(table))removed.set(table,new Map());
    removed.get(table).set(key(table,row),{row,reason});
  };
  for(const table of ['tally_customers','tally_products','tally_invoices','tally_payments_live','visits','expected_orders','follow_ups','attendance','location_pings','customer_activities','service_requests','leads']) {
    if(!schemas.has(table))continue;
    const cols=new Set(schemas.get(table).columns.map(c=>c.name));
    const clauses=["id LIKE 'webinar-demo-%'"],args=[];
    if(table==='tally_customers') {clauses.push(`id IN (${fixtureCustomers.map(()=>'?').join(',')}) AND source_file IS NULL`);args.push(...fixtureCustomers);}
    if(['tally_customers','tally_products'].includes(table)&&cols.has('source_file'))clauses.push("source_file='sample-data-generator'");
    if(table==='tally_invoices')clauses.push("source_sync_id='excel-import' AND reference IN ('Monthly Sales Invoice','RM Product Invoice') AND voucher_guid='GUID-'||id", "source_sync_id LIKE 'demo-sync-%' AND company_name='PSSPL CRM Demo'");
    if(table==='tally_payments_live')clauses.push("company_name='PSSPL CRM Demo' AND reference='Demo-receipt-'||id AND source_sync_id='receipt-sync-'||id");
    if(activityIds[table]){clauses.push(`id IN (${activityIds[table].map(()=>'?').join(',')})`);args.push(...activityIds[table]);}
    if(!cols.has('id'))continue;
    for(const row of db.prepare(`SELECT * FROM ${quote(table)} WHERE ${clauses.map(c=>`(${c})`).join(' OR ')}`).all(...args))add(table,row,'Confirmed seed/showcase identifier or generated invoice-projection provenance');
  }
  // These two child tables contain no independent business event: preserve the
  // full row in the archive and remove it with its proven synthetic parent.
  for(const [child,parent,column] of [['tally_invoice_lines','tally_invoices','invoice_id'],['visit_products','visits','visit_id']]) {
    if(!schemas.has(child))continue;
    for(const {row} of removed.get(parent)?.values()??[]) {
      for(const dependent of db.prepare(`SELECT * FROM ${quote(child)} WHERE ${quote(column)}=?`).all(row.id))add(child,dependent,'Line/item belonging to archived synthetic parent');
    }
  }
  const customers=removed.get('tally_customers');
  // Rebind genuine user work only to an unambiguous, exact-name imported master.
  // Never carry seeded ownership/balances onto the genuine Tally customer.
  for(const {row} of customers?.values()??[]) {
    const candidates=db.prepare("SELECT * FROM tally_customers WHERE id<>? AND lower(trim(name))=lower(trim(?)) AND source_file LIKE 'Tally Connector%'").all(row.id,row.name).filter(candidate=>!customers.has(key('tally_customers',candidate)));
    if(candidates.length===1)customerMap.set(row.id,candidates[0].id);
    else if(fixtureCustomers.includes(row.id))throw new Error(`A unique genuine Tally customer is required for ${row.id}; ${candidates.length} candidates (missing or ambiguous)`);
  }
  const preserveCustomerReference=(table,column,row,oldId)=>{
    if(removed.get(table)?.has(key(table,row)))return;
    const destination=customerMap.get(oldId);
    if(!destination)throw new Error(`Unreviewed dependent ${table} prevents removal of customer:${oldId}`);
    const rowKey=`${table}:${key(table,row)}`;
    const existing=relinked.get(rowKey)??{table,before:row,after:{...row}};
    existing.after[column]=destination;relinked.set(rowKey,existing);
  };
  // Several original CRM tables store logical customer links without declaring
  // SQLite foreign keys. They need the same protection as declared references.
  for(const reference of customerReferences) {
    const [table,column]=reference.split('.');
    if(!schemas.get(table)?.columns.some(c=>c.name===column))continue;
    for(const {row:customer} of customers?.values()??[]) {
      for(const row of db.prepare(`SELECT * FROM ${quote(table)} WHERE ${quote(column)}=?`).all(customer.id))preserveCustomerReference(table,column,row,customer.id);
    }
  }
  for(const [table,column] of [['expected_orders','visit_id'],['follow_ups','visit_id'],['leads','source_visit_id']]) {
    if(!schemas.get(table)?.columns.some(c=>c.name===column))continue;
    for(const {row:visit} of removed.get('visits')?.values()??[]) {
      for(const row of db.prepare(`SELECT * FROM ${quote(table)} WHERE ${quote(column)}=?`).all(visit.id)) {
        if(!removed.get(table)?.has(key(table,row)))throw new Error(`Unreviewed dependent ${table} prevents removal of visit:${visit.id}`);
      }
    }
  }
  // Protect undeclared master references too. Never drop a product/customer
  // referenced by surviving work, even when SQLite has no FK for that column.
  for(const [table,schema] of schemas) {
    for(const {name:column} of schema.columns) {
      const parent=['tally_customer_id','customer_id'].includes(column)?'tally_customers':['tally_product_id','product_id','interested_product_id'].includes(column)?'tally_products':null;
      if(!parent||!removed.has(parent))continue;
      for(const {row:master} of removed.get(parent).values()) {
        for(const row of db.prepare(`SELECT * FROM ${quote(table)} WHERE ${quote(column)}=?`).all(master.id)) {
          if(removed.get(table)?.has(key(table,row)))continue;
          if(parent==='tally_customers'&&customerReferences.has(`${table}.${column}`))preserveCustomerReference(table,column,row,master.id);
          else throw new Error(`Unreviewed dependent ${table}.${column} prevents removal of ${parent}:${master.id}`);
        }
      }
    }
  }
  // Preflight EVERY declared FK. Unexpected descendants cannot be silently
  // cascaded, detached, reassigned by fuzzy name, or deleted.
  for(const [child,schema] of schemas) {
    for(const fk of schema.foreignKeys) {
      if(!removed.has(fk.table))continue;
      if(schema.foreignKeys.filter(other=>other.id===fk.id).length!==1)throw new Error(`Unreviewed composite foreign-key dependent: ${child}`);
      for(const {row:parent} of removed.get(fk.table).values()) {
        const targetColumn=fk.to||schemas.get(fk.table).columns.find(c=>c.pk===1)?.name;
        const dependents=db.prepare(`SELECT * FROM ${quote(child)} WHERE ${quote(fk.from)}=?`).all(parent[targetColumn]);
        for(const row of dependents) {
          if(removed.get(child)?.has(key(child,row)))continue;
          const destination=fk.table==='tally_customers'&&customerReferences.has(`${child}.${fk.from}`)?customerMap.get(parent.id):null;
          if(!destination)throw new Error(`Unreviewed dependent ${child} prevents removal of ${fk.table}:${parent.id}`);
          preserveCustomerReference(child,fk.from,row,parent.id);
        }
      }
    }
  }
  const remaining=new Set(removed.keys()),order=[];
  while(remaining.size) {
    const leaves=[...remaining].filter(parent=>![...remaining].some(child=>child!==parent&&schemas.get(child).foreignKeys.some(fk=>fk.table===parent)));
    if(!leaves.length)throw new Error('Unreviewed cyclic foreign-key dependency');
    for(const table of leaves){order.push(table);remaining.delete(table);}
  }
  const counts=Object.fromEntries([...removed].map(([table,rows])=>[table,rows.size]));
  const tableCounts=Object.fromEntries([...schemas.keys()].map(table=>[table,db.prepare(`SELECT COUNT(*) n FROM ${quote(table)}`).get().n]));
  return {schemas,key,removed,relinked,customerMap,order,counts,tableCounts};
}

function summary(plan) {
  return {counts:plan.counts,customerMappings:Object.fromEntries(plan.customerMap),relinkedRows:plan.relinked.size,totalArchived:[...plan.removed.values()].reduce((sum,rows)=>sum+rows.size,0)+plan.relinked.size};
}

/** No server imports or startup effects. Dry run is the default. */
export async function cleanupDummyData({databasePath,backupPath,apply=false}) {
  const file=resolve(databasePath),read=new DatabaseSync(file,{readOnly:true});
  let initial;
  try {initial=inspect(read);}finally{read.close();}
  if(!initial.removed.size)return {applied:false,reason:'No known dummy data found',...summary(initial)};
  if(!apply)return {applied:false,...summary(initial)};
  if(!backupPath)throw new Error('A separate backup path is required before applying cleanup');
  const destination=resolve(backupPath);
  if(destination===file||existsSync(destination))throw new Error('Backup must be a new file separate from the source database');
  mkdirSync(dirname(destination),{recursive:true});
  const db=new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000; BEGIN IMMEDIATE');
  try {
    const plan=inspect(db),beforeFk=db.prepare('PRAGMA foreign_key_check').all();
    if(!plan.removed.size){db.exec('COMMIT');return {applied:false,reason:'No known dummy data found',...summary(plan)};}
    // Reserve atomically: another cleanup must never replace an existing backup.
    closeSync(openSync(destination,'wx',0o600));
    // Hold the write lock while taking a consistent read-only snapshot, before
    // touching any rows. Other application connections can still read in WAL.
    const source=new DatabaseSync(file,{readOnly:true});
    try {await backup(source,destination);}finally{source.close();}
    try{chmodSync(destination,0o600);}catch{}
    const checked=new DatabaseSync(destination,{readOnly:true});
    try{if(checked.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Backup integrity check failed');}finally{checked.close();}
    const cleanupId=randomUUID(),stamp=new Date().toISOString();
    db.exec(`CREATE TABLE IF NOT EXISTS crm_dummy_cleanup_archive(cleanup_id TEXT NOT NULL,entity_table TEXT NOT NULL,row_key TEXT NOT NULL,action TEXT NOT NULL,row_json TEXT NOT NULL,replacement_json TEXT,reason TEXT NOT NULL,archived_at TEXT NOT NULL,PRIMARY KEY(cleanup_id,entity_table,row_key));
      CREATE TABLE IF NOT EXISTS crm_dummy_cleanup_runs(id TEXT PRIMARY KEY,backup_path TEXT NOT NULL,summary_json TEXT NOT NULL,completed_at TEXT NOT NULL);`);
    const archive=db.prepare('INSERT INTO crm_dummy_cleanup_archive VALUES(?,?,?,?,?,?,?,?)');
    const primary=table=>plan.schemas.get(table).columns.filter(c=>c.pk).sort((a,b)=>a.pk-b.pk).map(c=>c.name);
    for(const {table,before,after} of plan.relinked.values()) {
      const changes=Object.keys(after).filter(column=>after[column]!==before[column]),pk=primary(table);
      archive.run(cleanupId,table,plan.key(table,before),'relinked',JSON.stringify(before),JSON.stringify(after),'Preserve existing work; replace seeded party with unique exact-name genuine Tally master',stamp);
      const updated=db.prepare(`UPDATE ${quote(table)} SET ${changes.map(column=>`${quote(column)}=?`).join(',')} WHERE ${pk.map(column=>`${quote(column)}=?`).join(' AND ')}`).run(...changes.map(c=>after[c]),...pk.map(c=>before[c]));
      if(updated.changes!==1)throw new Error(`Concurrent or ambiguous relink in ${table}`);
    }
    for(const table of plan.order) {
      const pk=primary(table),remove=db.prepare(`DELETE FROM ${quote(table)} WHERE ${pk.map(column=>`${quote(column)}=?`).join(' AND ')}`);
      for(const {row,reason} of plan.removed.get(table).values()) {
        archive.run(cleanupId,table,plan.key(table,row),'removed',JSON.stringify(row),null,reason,stamp);
        if(remove.run(...pk.map(c=>row[c])).changes!==1)throw new Error(`Concurrent or ambiguous removal in ${table}`);
      }
    }
    for(const [table,before] of Object.entries(plan.tableCounts)) {
      const after=db.prepare(`SELECT COUNT(*) n FROM ${quote(table)}`).get().n;
      if(after!==before-(plan.counts[table]??0))throw new Error(`Unexpected record-count change in ${table}`);
    }
    const afterFk=db.prepare('PRAGMA foreign_key_check').all();
    const existingViolations=new Set(beforeFk.map(row=>JSON.stringify(row)));
    if(afterFk.some(row=>!existingViolations.has(JSON.stringify(row))))throw new Error('Cleanup introduced a foreign-key violation');
    const result={applied:true,cleanupId,backupPath:destination,...summary(plan),foreignKeyViolationsBefore:beforeFk.length,foreignKeyViolations:afterFk.length};
    db.prepare('INSERT INTO crm_dummy_cleanup_runs VALUES(?,?,?,?)').run(cleanupId,destination,JSON.stringify(result),stamp);
    db.exec('COMMIT');return result;
  }catch(error){db.exec('ROLLBACK');throw error;}finally{db.close();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const value=name=>{const index=process.argv.indexOf(name);return index<0?undefined:process.argv[index+1];};
  const databasePath=value('--database');
  if(!databasePath)throw new Error('Supply --database explicitly; dry-run is default. --apply also requires --backup.');
  console.log(JSON.stringify(await cleanupDummyData({databasePath,backupPath:value('--backup'),apply:process.argv.includes('--apply')}),null,2));
}
