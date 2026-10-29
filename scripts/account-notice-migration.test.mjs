import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,readdirSync,copyFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runMigrations} from '../server/migrations.mjs';

test('account notice migration preserves existing populated queue and delivery records and indexes',()=>{
  const scratch=mkdtempSync(join(tmpdir(),'psspl-account-migration-'));
  const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
  try{
    for(const file of readdirSync('database/migrations').filter(name=>/^\d+_.*\.sql$/.test(name)&&name<'014'))copyFileSync(join('database/migrations',file),join(scratch,file));
    runMigrations(db,{directory:scratch});
    db.exec("INSERT INTO users(id,email,password_hash,role) VALUES('employee','test@example.test','synthetic','rm'); INSERT INTO auth_email_queue(id,user_id,purpose,token_hash,encrypted_payload,idempotency_key,expires_at,provider) VALUES('job','employee','reset','synthetic-hash','encrypted-synthetic','synthetic-key','2030-01-01','smtp'); INSERT INTO auth_email_delivery(id,user_id,purpose,email_id,status) VALUES('delivery','employee','reset','synthetic-email','accepted')");
    const beforeQueue=db.prepare('SELECT * FROM auth_email_queue').get();
    const beforeDelivery=db.prepare('SELECT * FROM auth_email_delivery').get();
    runMigrations(db);
    assert.deepEqual({...db.prepare('SELECT * FROM auth_email_queue').get()},{...beforeQueue});
    assert.deepEqual({...db.prepare('SELECT * FROM auth_email_delivery').get()},{...beforeDelivery});
    db.exec("INSERT INTO auth_email_queue(id,user_id,purpose,token_hash,encrypted_payload,idempotency_key,expires_at,provider) VALUES('notice','employee','account','synthetic-reference','encrypted-notice','notice-key','2030-01-01','smtp'); INSERT INTO auth_email_delivery(id,user_id,purpose,status) VALUES('notice-delivery','employee','account','accepted')");
    assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_schema WHERE type='index' AND name IN ('idx_auth_email_queue_ready','idx_auth_email_queue_token','idx_auth_email_delivery_user')").get().n,3);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  }finally{db.close();rmSync(scratch,{recursive:true,force:true});}
});
