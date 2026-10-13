import { db } from "../server/db.mjs";
import { buildRmDirectory, resolveRmId } from "../server/rm-directory.mjs";

const cust = db.prepare("SELECT id, name, rm_name, owner_user_id FROM tally_customers WHERE id='tally-customer-1be014da493659f01cb6'").get();
console.log("Customer:", cust);

const userId = "sp-101";
const self = db.prepare("SELECT * FROM salesperson_profiles WHERE user_id=?").get(userId);
console.log("Self:", self);

const can = db.prepare(`
  SELECT 1 FROM tally_customers c LEFT JOIN salesperson_profiles self ON self.user_id=?
  WHERE c.id=? AND (c.owner_user_id=? OR c.owner_user_id IN (SELECT user_id FROM salesperson_profiles WHERE manager_user_id=?) OR (c.owner_user_id IS NULL AND lower(replace(COALESCE(c.rm_name,''),' ',''))=lower(replace(COALESCE(self.full_name,''),' ',''))))
`).get(userId, cust.id, userId, userId);
console.log("Can access with current query:", Boolean(can));
console.log("Why did it fail?");
console.log("c.owner_user_id:", cust.owner_user_id);
console.log("userId:", userId);
console.log("c.owner_user_id === userId:", cust.owner_user_id === userId);
console.log("c.owner_user_id in salesperson_profiles with manager_user_id = userId:", db.prepare("SELECT user_id FROM salesperson_profiles WHERE manager_user_id=?").all(userId));
console.log("c.owner_user_id IS NULL:", cust.owner_user_id === null);
