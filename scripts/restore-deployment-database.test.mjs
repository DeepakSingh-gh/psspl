import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,readFileSync,rmSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCipheriv,createHash,randomBytes} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {restoreDeploymentDatabase} from './restore-deployment-database.mjs';
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'psspl-deploy-restore-'));const source=join(root,'source.sqlite');
 const db=new DatabaseSync(source);db.exec("CREATE TABLE users(id TEXT PRIMARY KEY); INSERT INTO users VALUES('retained');");db.close();
 const plain=readFileSync(source),key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 const body=Buffer.concat([cipher.update(gzipSync(plain)),cipher.final()]);const encrypted=Buffer.concat([Buffer.from('PSSPLDS1'),iv,cipher.getAuthTag(),body]);
 return {root,target:join(root,'target.sqlite'),encrypted,key:key.toString('hex'),cipherSha:sha(encrypted),plainSha:sha(plain),url:'https://github.com/example/crm/releases/download/snapshot/db.enc'};
}
test('approved encrypted snapshot restores exactly once and preserves existing database bytes',async()=>{
 const f=fixture();let calls=0;
 try{
  const options={...f,fetcher:async()=>{calls++;return new Response(f.encrypted);}};
  assert.equal((await restoreDeploymentDatabase(options)).restored,true);
  const db=new DatabaseSync(f.target,{readOnly:true});assert.equal(db.prepare('SELECT id FROM users').get().id,'retained');db.close();
  const saved=readFileSync(f.target);await assert.rejects(restoreDeploymentDatabase(options),/already exists/);assert.equal(calls,1);assert.deepEqual(readFileSync(f.target),saved);
 }finally{rmSync(f.root,{recursive:true,force:true});}
});
test('corruption, wrong key/hash and non-HTTPS URLs never publish a database',async()=>{
 const f=fixture();
 try{
  const options={...f,fetcher:async()=>new Response(f.encrypted)};
  await assert.rejects(restoreDeploymentDatabase({...options,key:'0'.repeat(64)}));assert.equal(existsSync(f.target),false);
  await assert.rejects(restoreDeploymentDatabase({...options,cipherSha:'0'.repeat(64)}),/checksum/);assert.equal(existsSync(f.target),false);
  await assert.rejects(restoreDeploymentDatabase({...options,plainSha:'0'.repeat(64)}),/checksum/);assert.equal(existsSync(f.target),false);
  await assert.rejects(restoreDeploymentDatabase({...options,url:'http://example.test/db.enc'}),/HTTPS/);
 }finally{rmSync(f.root,{recursive:true,force:true});}
});
test('a malformed SQLite payload is rejected even when encrypted correctly',async()=>{
 const f=fixture();try{
  const bad=Buffer.from('not sqlite');const key=Buffer.from(f.key,'hex'),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);const body=Buffer.concat([cipher.update(gzipSync(bad)),cipher.final()]);const encrypted=Buffer.concat([Buffer.from('PSSPLDS1'),iv,cipher.getAuthTag(),body]);
  await assert.rejects(restoreDeploymentDatabase({...f,encrypted,cipherSha:sha(encrypted),plainSha:sha(bad),fetcher:async()=>new Response(encrypted)}));assert.equal(existsSync(f.target),false);
 }finally{rmSync(f.root,{recursive:true,force:true});}
});
