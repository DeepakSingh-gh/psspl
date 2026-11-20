import {createHash,createDecipheriv,randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,openSync,writeFileSync,fsyncSync,closeSync,linkSync,unlinkSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {DatabaseSync} from 'node:sqlite';

const magic=Buffer.from('PSSPLDS1');
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');

/** Build-time only: create an absent database from an explicitly approved,
 * authenticated encrypted snapshot. Never import application db/startup code. */
export async function restoreDeploymentDatabase({url,key,cipherSha,plainSha,target,fetcher=fetch,maxBytes=64*1024*1024}){
  const destination=resolve(target);
  if(existsSync(destination))throw Error('Deployment database already exists; refusing to overwrite it');
  const source=new URL(url);
  if(source.protocol!=='https:'||source.username||source.password)throw Error('Snapshot download requires HTTPS without embedded credentials');
  if(!/^[a-f0-9]{64}$/i.test(key||'')||!/^[a-f0-9]{64}$/i.test(cipherSha||'')||!/^[a-f0-9]{64}$/i.test(plainSha||''))throw Error('Valid snapshot encryption key and checksums are required');
  const response=await fetcher(source.href,{headers:{Accept:'application/octet-stream'},signal:AbortSignal.timeout(120000)});
  if(!response.ok||!response.body)throw Error('Approved database snapshot download failed');
  if(Number(response.headers.get('content-length'))>maxBytes){await response.body.cancel();throw Error('Snapshot exceeds download limit');}
  const parts=[];let size=0;
  for await(const chunk of response.body){size+=chunk.length;if(size>maxBytes)throw Error('Snapshot exceeds download limit');parts.push(chunk);}
  const encrypted=Buffer.concat(parts);
  if(hash(encrypted)!==cipherSha.toLowerCase())throw Error('Encrypted snapshot checksum mismatch');
  if(encrypted.length<36||!encrypted.subarray(0,8).equals(magic))throw Error('Unrecognized snapshot format');
  const decipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),encrypted.subarray(8,20));decipher.setAuthTag(encrypted.subarray(20,36));
  const compressed=Buffer.concat([decipher.update(encrypted.subarray(36)),decipher.final()]);
  const plain=gunzipSync(compressed,{maxOutputLength:256*1024*1024});
  if(hash(plain)!==plainSha.toLowerCase())throw Error('Database snapshot checksum mismatch');
  mkdirSync(dirname(destination),{recursive:true});
  const staging=destination+'.restore-'+randomUUID();
  try{
    const fd=openSync(staging,'wx',0o600);try{writeFileSync(fd,plain);fsyncSync(fd);}finally{closeSync(fd);}
    const database=new DatabaseSync(staging,{readOnly:true});
    try{
      if(database.prepare('PRAGMA integrity_check').get()?.integrity_check!=='ok')throw Error('Restored database failed integrity check');
      if(database.prepare('PRAGMA foreign_key_check').all().length)throw Error('Restored database has invalid foreign keys');
      if(!database.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='users'").get())throw Error('Restored snapshot is not a CRM database');
    }finally{database.close();}
    // Same-filesystem hard-link creation is atomic and refuses a concurrent target.
    linkSync(staging,destination);
    return {restored:true,bytes:plain.length,sha256:plainSha.toLowerCase()};
  }finally{if(existsSync(staging))unlinkSync(staging);}
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  if(process.env.CRM_APPROVED_SNAPSHOT_RESTORE!=='true')throw Error('Snapshot restoration requires explicit deployment approval');
  const result=await restoreDeploymentDatabase({url:process.env.CRM_DATABASE_SNAPSHOT_URL,key:process.env.CRM_DATABASE_SNAPSHOT_KEY,cipherSha:process.env.CRM_DATABASE_SNAPSHOT_CIPHER_SHA256,plainSha:process.env.CRM_DATABASE_SNAPSHOT_SHA256,target:process.env.CRM_DATABASE_PATH||'data/crm.sqlite'});
  console.log(JSON.stringify({databaseSnapshotRestored:result.restored,bytes:result.bytes,sha256:result.sha256}));
}
