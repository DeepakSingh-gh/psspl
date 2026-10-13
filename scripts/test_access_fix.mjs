import { db } from "../server/db.mjs";
import { buildRmDirectory, resolveRmId } from "../server/rm-directory.mjs";

const userId = 'sp-101';
const customerId = 'tally-customer-1be014da493659f01cb6';

const profile = db.prepare('SELECT full_name FROM salesperson_profiles WHERE user_id=?').get(userId);
const directory = buildRmDirectory();
const rm = directory.find((entry) => entry.id === userId || (entry.keys && entry.keys.includes(userId)) || resolveRmId(directory, profile?.full_name || '') === entry.id);
const allNames = rm ? [rm.name, ...rm.aliases] : [profile?.full_name].filter(Boolean);
const nameList = allNames.length ? allNames.map(() => '?').join(',') : '';

const query = `
  SELECT 1 FROM tally_customers c
  WHERE c.id=? AND (
    c.owner_user_id=?
    OR c.owner_user_id IN (SELECT user_id FROM salesperson_profiles WHERE manager_user_id=? OR user_id=?)
    OR (c.owner_user_id IN (SELECT u.id FROM users u JOIN salesperson_profiles p ON p.user_id=u.id WHERE p.manager_user_id=(SELECT manager_user_id FROM salesperson_profiles WHERE user_id=?)))
    ${nameList ? `OR (c.rm_name IN (${nameList}))` : ''}
    OR (c.owner_user_id IS NULL AND lower(replace(COALESCE(c.rm_name,''),' ',''))=lower(replace(?,' ','')))
  )
`;

const can = Boolean(db.prepare(query).get(customerId, userId, userId, userId, userId, ...(allNames.length ? allNames : []), profile?.full_name ?? ''));

console.log('Can access Protec Finish Innovators for sp-101:', can);

// Also test for RM user: rm-anil-jena
const rmCan = Boolean(db.prepare(query).get(customerId, 'rm-anil-jena', 'rm-anil-jena', 'rm-anil-jena', 'rm-anil-jena', ...(allNames.length ? allNames : []), 'Anil Jena'));
console.log('Can access Protec Finish Innovators for rm-anil-jena:', rmCan);
