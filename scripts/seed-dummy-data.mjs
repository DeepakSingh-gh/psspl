import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const db = new DatabaseSync("data/crm.sqlite");

const dummyCustomers = [
  { id: "dummy-1", name: "JMD Traders", city: "Delhi", outstanding: 200000, total_sales: 14080000 },
  { id: "dummy-2", name: "Rico Chemicals", city: "Mumbai", outstanding: 0, total_sales: 12790000 },
  { id: "dummy-3", name: "2 Daughters", city: "Pune", outstanding: 480000, total_sales: 7830000 },
  { id: "dummy-4", name: "Aashirwad Chemicals", city: "Delhi", outstanding: 410000, total_sales: 3690000 },
  { id: "dummy-5", name: "Naveen Aqua Chemicals", city: "Bangalore", outstanding: 110000, total_sales: 1760000 },
  { id: "dummy-6", name: "F.S. Auto Industries", city: "Chennai", outstanding: 60000, total_sales: 1200000 },
  { id: "dummy-7", name: "Pm Trading Co.", city: "Delhi", outstanding: 130000, total_sales: 640000 },
  { id: "dummy-8", name: "Sarvotion Enterprises", city: "Noida", outstanding: 0, total_sales: 510000 },
  { id: "dummy-9", name: "Maa Enterprises", city: "Gurugram", outstanding: 0, total_sales: 80000 }
];

const insertCustomer = db.prepare(`
  INSERT INTO tally_customers (id, name, city, total_sales, outstanding, owner_user_id)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET 
    name=excluded.name, city=excluded.city, total_sales=excluded.total_sales, outstanding=excluded.outstanding, owner_user_id=excluded.owner_user_id
`);

for (const c of dummyCustomers) {
  insertCustomer.run(c.id, c.name, c.city, c.total_sales, c.outstanding, "sp-101");
}

console.log("Dummy customers inserted successfully!");
