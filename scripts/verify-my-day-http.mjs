import assert from 'node:assert/strict';
import http from 'node:http';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { db } from '../server/db.mjs';
import { createSession } from '../server/auth.mjs';

function get(token, encoding) {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const req = http.get('http://127.0.0.1:4000/api/salespeople/me/my-day', {
      headers: {'Accept-Encoding':encoding,...(token?{Authorization:'Bearer '+token}:{})},
    }, res => {
      const chunks=[];
      res.on('data',chunk=>chunks.push(chunk));
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks),ms:Math.round(performance.now()-started)}));
      res.on('error',reject);
    });
    req.setTimeout(30000,()=>req.destroy(new Error('API check timed out')));
    req.on('error',reject);
  });
}
assert.equal((await get(null,'gzip')).status,401);
for (const role of ['rm','salesperson']) {
  const user=db.prepare("SELECT u.id FROM users u JOIN salesperson_profiles p ON p.user_id=u.id WHERE u.active=1 AND u.role=? ORDER BY CASE WHEN p.full_name LIKE 'Anil%' THEN 0 ELSE 1 END LIMIT 1").get(role);
  const {token}=createSession(user.id);
  try {
    const plain=await get(token,'identity');
    const compressed=await get(token,'gzip');
    assert.equal(plain.status,200);
    assert.equal(compressed.status,200);
    assert.equal(plain.headers['content-encoding'],undefined);
    assert.equal(compressed.headers['content-encoding'],'gzip');
    assert.match(compressed.headers.vary,/Accept-Encoding/i);
    const original = JSON.parse(plain.body.toString());
    assert.deepEqual(JSON.parse(gunzipSync(compressed.body).toString()),original);
    assert.equal(original.salesperson.id,user.id);
    assert.ok(compressed.body.length < plain.body.length);
    console.log(JSON.stringify({role,plainBytes:plain.body.length,gzipBytes:compressed.body.length,reductionPercent:Math.round(100*(1-compressed.body.length/plain.body.length)),plainMs:plain.ms,gzipMs:compressed.ms}));
  } finally {
    db.prepare('DELETE FROM sessions WHERE token_hash=?').run(createHash('sha256').update(token).digest('hex'));
  }
}
