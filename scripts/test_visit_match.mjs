import { db } from "../server/db.mjs";
import { buildRmDirectory, resolveRmId } from "../server/rm-directory.mjs";

const directory = buildRmDirectory();
const rm = directory.find(e => e.id === 'aniljena' || (e.keys && e.keys.includes('aniljena')));
const allNames = [rm.name, ...rm.aliases];
const nameList = allNames.map(() => '?').join(',');

const canonicalRmId = rm.id;
const crmUsers = db.prepare('SELECT u.id, u.email, u.role, p.employee_code, p.full_name FROM users u JOIN salesperson_profiles p ON p.user_id = u.id').all();
const crmUser = crmUsers.find(u => u.full_name && (resolveRmId(directory, u.full_name) === canonicalRmId || resolveRmId(directory, u.full_name) === 'aniljena'));
const userId = crmUser?.id;

console.log('rm.id:', rm.id, 'allNames:', allNames);
console.log('Resolved userId:', userId, 'email:', crmUser?.email);
const allVisits = db.prepare('SELECT id, user_id, tally_customer_id, business_date FROM visits').all();
console.log('All visits in DB:', allVisits);

for (const v of allVisits) {
  const q = `
    SELECT 1 FROM visits v
    WHERE v.id=? AND (v.tally_customer_id IN (SELECT id FROM tally_customers WHERE rm_name IN (${nameList})) OR v.user_id = ?)
  `;
  const match = db.prepare(q).get(v.id, ...allNames, userId);
  console.log('Visit', v.id, 'matches RM query?', Boolean(match));
}
