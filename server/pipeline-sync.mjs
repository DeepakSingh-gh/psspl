import { Router } from 'express';
import { createHash } from 'node:crypto';
import { db } from './db.mjs';
import { authenticate, requireRole } from './auth.mjs';

// This installation is one CRM database. Reuse REST's explicit ownership/team
// boundary; leads.company is a customer name, never an authorization tenant key.
export function pipelineOwnerIds(database, user) {
  if (user.role === 'admin') return database.prepare('SELECT id FROM users ORDER BY id').all().map(row => row.id);
  if (user.role === 'rm') return [user.id, ...database.prepare('SELECT user_id FROM salesperson_profiles WHERE manager_user_id=? AND user_id<>? ORDER BY user_id').all(user.id,user.id).map(row => row.user_id)];
  return [user.id];
}

const ownerRevisions = database => new Map(database.prepare('SELECT user_id,revision FROM pipeline_owner_revisions').all().map(row => [row.user_id,row.revision]));
export function pipelineRevision(database, user, revisions = ownerRevisions(database)) {
  const ids = pipelineOwnerIds(database,user);
  return createHash('sha256').update(JSON.stringify([user.role,ids.map(id => [id,revisions.get(id) ?? 0])])).digest('hex');
}

export function pipelineSummary(database, user, { teamDashboard = false } = {}) {
  const ids = teamDashboard && user.role === 'rm'
    ? [user.id,...database.prepare("SELECT p.user_id FROM salesperson_profiles p JOIN users u ON u.id=p.user_id WHERE p.manager_user_id=? AND u.role='salesperson' AND u.active=1 AND p.user_id<>?").all(user.id,user.id).map(row=>row.user_id)]
    : pipelineOwnerIds(database,user);
  if (!ids.length) return { total:0, stages:[], recent:[] };
  const where = user.role === 'admin' ? '' : `WHERE l.user_id IN (${ids.map(()=>'?').join(',')})`;
  const params = user.role === 'admin' ? [] : ids;
  const stages = database.prepare(`SELECT l.stage,COUNT(*) count,COALESCE(SUM(l.expected_value),0) expectedValue FROM leads l ${where} GROUP BY l.stage`).all(...params);
  const recent = database.prepare(`SELECT l.id,l.name,l.company,l.stage,l.expected_value expectedValue,l.created_at createdAt,
    COALESCE(p.full_name,u.email) ownerName FROM leads l JOIN users u ON u.id=l.user_id
    LEFT JOIN salesperson_profiles p ON p.user_id=u.id ${where} ORDER BY l.created_at DESC,l.rowid DESC LIMIT 10`).all(...params);
  return { total:stages.reduce((sum,row)=>sum+row.count,0), stages, recent };
}

function streamUser(req) {
  const session = db.prepare(`SELECT u.id,u.role,s.expires_at,s.created_at FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND u.active=1 AND u.deleted_at IS NULL`).get(req.sessionTokenHash);
  if (!session || Date.parse(session.expires_at)<=Date.now()) return null;
  const created = Date.parse(session.created_at.includes('T') ? session.created_at : session.created_at.replace(' ','T')+'Z');
  if (Date.now()-created > (Number(process.env.CRM_SESSION_MAX_DAYS)||30)*86400000) return null;
  return session;
}

// One scheduler per API worker, no timers survive the final subscriber.
const clients = new Set();
let timer;
function tick() {
  let state;
  try { state = ownerRevisions(db); } catch { return; } // transient SQLite contention must not terminate the API
  const revisions = new Map();
  for (const client of clients) {
    try {
      const user = streamUser(client.req);
      if (!user || !['admin','rm','salesperson'].includes(user.role)) { client.res.end(); continue; }
      if (Date.now()-client.started>300000) { client.res.end(); continue; } // renew normal HTTP auth
      const key = `${user.id}:${user.role}`;
      if (!revisions.has(key)) revisions.set(key,pipelineRevision(db,user,state));
      const revision = revisions.get(key);
      if (revision!==client.revision) {
        client.revision=revision;
        if (!client.res.write(`event: pipeline\ndata: ${JSON.stringify({revision})}\n\n`)) client.res.end();
      } else if (Date.now()-client.heartbeat>15000) {
        client.heartbeat=Date.now();
        if (!client.res.write(': heartbeat\n\n')) client.res.end();
      }
    } catch { client.res.end(); }
  }
}

export const pipelineRouter = Router();
pipelineRouter.use(authenticate,requireRole('admin','rm','salesperson'));
pipelineRouter.get('/summary',(req,res)=>res.json(pipelineSummary(db,req.user,{teamDashboard:req.query.view==='team'})));
pipelineRouter.get('/events',(req,res)=>{
  res.set({ 'Content-Type':'text/event-stream', 'Cache-Control':'no-cache, no-store, no-transform', 'X-Accel-Buffering':'no' });
  res.flushHeaders();
  const client = {req,res,revision:undefined,started:Date.now(),heartbeat:Date.now()};
  clients.add(client);
  res.on('close',()=>{clients.delete(client);if(!clients.size){clearInterval(timer);timer=undefined;}});
  tick();
  if (clients.size && !timer) timer=setInterval(tick,500).unref();
});
