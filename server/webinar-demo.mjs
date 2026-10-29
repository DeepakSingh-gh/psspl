import { createHash } from "node:crypto";
import { indiaBusinessDate } from "../shared/business-date.mjs";

const PREFIX = "webinar-demo";
const dayOffset = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const shortId = (value) => createHash("sha256").update(value).digest("hex").slice(0, 12);

/** Small, labelled CRM fixtures for an explicitly enabled webinar environment. */
export function seedWebinarDemo(db, businessDate = indiaBusinessDate()) {
  const users = db.prepare(`SELECT u.id, u.role, p.full_name, p.region, p.operating_city
    FROM users u LEFT JOIN salesperson_profiles p ON p.user_id=u.id
    WHERE u.active=1 AND u.role IN ('salesperson','rm') ORDER BY u.id`).all();
  const yesterday = dayOffset(businessDate, -1);
  const nextWeek = dayOffset(businessDate, 7);
  const monthDay = Math.min(Number(businessDate.slice(8)), 15);
  const invoiceDate = `${businessDate.slice(0, 8)}${String(monthDay).padStart(2, "0")}`;
  const products = [
    { id: `${PREFIX}-primer`, name: "[Demo] Surface Primer", rate: 1200 },
    { id: `${PREFIX}-coating`, name: "[Demo] Protective Coating", rate: 1700 },
  ];

  db.exec("BEGIN IMMEDIATE");
  try {
    const addProduct = db.prepare(`INSERT OR IGNORE INTO tally_products
      (id,name,packing_size,uom,rate,total_qty,total_value,frequency,source_file)
      VALUES (?,?, '5 L', 'L', ?, 0, 0, 0, ?)`);
    for (const product of products) addProduct.run(product.id, product.name, product.rate, PREFIX);

    const addCustomer = db.prepare(`INSERT OR IGNORE INTO tally_customers
      (id,name,party_type,rm_name,city,total_sales,outstanding,source_file,contact_name,owner_user_id)
      VALUES (?,?,'Dealer',?,?,?,?,'webinar-demo','Demo contact',?)`);
    const addInvoice = db.prepare(`INSERT OR IGNORE INTO tally_invoices
      (id,company_name,voucher_number,voucher_type,invoice_date,customer_id,customer_name,amount,reference,source_sync_id)
      VALUES (?,'WEBINAR DEMO',?,'Sales',?,?,?,?,?,'webinar-demo')`);
    const addInvoiceLine = db.prepare(`INSERT OR IGNORE INTO tally_invoice_lines
      (id,invoice_id,product_id,product_name,quantity,rate,amount,uom) VALUES (?,?,?,?,?,?,?,'L')`);
    const addVisit = db.prepare(`INSERT OR IGNORE INTO visits
      (id,user_id,business_date,tally_customer_id,scheduled_at,started_at,completed_at,purpose,outcome,notes,status,priority)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    const addVisitProduct = db.prepare("INSERT OR IGNORE INTO visit_products(visit_id,tally_product_id) VALUES (?,?)");
    const addFollowUp = db.prepare(`INSERT OR IGNORE INTO follow_ups
      (id,user_id,visit_id,tally_customer_id,title,due_date,priority,completed,follow_up_type,notes)
      VALUES (?,?,?,?,?,?,?,0,'call',?)`);
    const addOrder = db.prepare(`INSERT OR IGNORE INTO expected_orders
      (id,visit_id,user_id,tally_customer_id,tally_product_id,expected_value,expected_date,status)
      VALUES (?,?,?,?,?,?,?,'open')`);
    const addLead = db.prepare(`INSERT OR IGNORE INTO leads
      (id,user_id,name,company,city,source,interested_product_id,stage,expected_value,next_action_date,notes)
      VALUES (?,?,?,'[Demo] Beacon Industries',?,'Webinar demo',?,'quotation',?,?,?)`);
    const addActivity = db.prepare(`INSERT OR IGNORE INTO customer_activities
      (id,user_id,tally_customer_id,activity_type,subject,notes,occurred_at)
      VALUES (?,?,?,'call_outgoing','[Demo] Discussed product sample','Webinar sample interaction',?)`);
    const addRequest = db.prepare(`INSERT OR IGNORE INTO service_requests
      (id,user_id,tally_customer_id,request_type,product_id,details,responsible_person,due_date,status)
      VALUES (?,?,?,'sample',?,'[Demo] Send coating sample','Demo team',?,'open')`);

    for (const user of users) {
      const tag = shortId(user.id);
      const city = user.operating_city || user.region || "Delhi";
      const owner = user.full_name || "CRM team";
      const customerA = `${PREFIX}-customer-${tag}-a`;
      const customerB = `${PREFIX}-customer-${tag}-b`;
      const customerNames = [`[Demo] Aster Coatings (${tag.slice(0, 4)})`, `[Demo] Northstar Finishes (${tag.slice(0, 4)})`];
      addCustomer.run(customerA, customerNames[0], owner, city, 12000, 2500, user.id);
      addCustomer.run(customerB, customerNames[1], owner, city, 8500, 0, user.id);

      for (const [index, customerId, product, amount] of [
        [0, customerA, products[0], 12000], [1, customerB, products[1], 8500],
      ]) {
        const invoiceId = `${PREFIX}-invoice-${tag}-${index}`;
        addInvoice.run(invoiceId, `DEMO-${tag}-${index}`, invoiceDate, customerId, customerNames[index], amount, "Webinar sample invoice");
        addInvoiceLine.run(`${invoiceId}-line`, invoiceId, product.id, product.name, amount / product.rate, product.rate, amount);
      }

      const plannedVisit = `${PREFIX}-visit-${tag}-${businessDate}`;
      const completedVisit = `${PREFIX}-visit-${tag}-${yesterday}`;
      addVisit.run(plannedVisit, user.id, businessDate, customerA, `${businessDate}T14:30:00`, null, null,
        "[Demo] Product discussion", null, "Webinar sample visit", "planned", "medium");
      addVisit.run(completedVisit, user.id, yesterday, customerB, `${yesterday}T11:00:00`, `${yesterday}T11:00:00`, `${yesterday}T11:45:00`,
        "[Demo] Sample review", "Customer requested a coating sample", "Webinar sample visit", "completed", "medium");
      addVisitProduct.run(completedVisit, products[1].id);
      addFollowUp.run(`${PREFIX}-follow-${tag}-today`, user.id, plannedVisit, customerA,
        "[Demo] Share product quotation", businessDate, "today", "Webinar sample follow-up");
      addFollowUp.run(`${PREFIX}-follow-${tag}-overdue`, user.id, completedVisit, customerB,
        "[Demo] Confirm sample feedback", yesterday, "overdue", "Webinar sample follow-up");
      addOrder.run(`${PREFIX}-order-${tag}`, completedVisit, user.id, customerB, products[1].id, 15000, nextWeek);
      addLead.run(`${PREFIX}-lead-${tag}`, user.id, "[Demo] Coating enquiry", city, products[1].id, 20000, nextWeek, "Webinar sample lead");
      addActivity.run(`${PREFIX}-activity-${tag}`, user.id, customerB, `${yesterday}T10:30:00`);
      addRequest.run(`${PREFIX}-request-${tag}`, user.id, customerB, products[1].id, nextWeek);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  console.info(`[demo] Webinar sample data ready for ${users.length} field accounts`);
}
