import { db } from "../server/db.mjs";
import { passwordHash } from "../server/auth.mjs";

const today = new Date();
const isoDate = (offsetDays = 0) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const upsertUser = ({ id, email, password, role, fullName, region, territory, employeeCode, monthlyTarget = 0, managerUserId = null }) => {
  db.prepare(
    `INSERT OR REPLACE INTO users (id, email, password_hash, role, active, created_at)
     VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`
  ).run(id, email, passwordHash(password), role);

  db.prepare(
    `INSERT OR REPLACE INTO salesperson_profiles (user_id, employee_code, full_name, region, territory, manager_user_id, monthly_target)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, employeeCode, fullName, region, territory, managerUserId, monthlyTarget);
};

const ensureCustomer = ({ id, name, city, rmName, partyType = "Dealer", totalSales, outstanding, ownerUserId }) => {
  db.prepare(
    `INSERT OR REPLACE INTO tally_customers (
      id, name, party_type, rm_name, rm_code, city, destination_code,
      total_sales, outstanding, last_payment_date, source_file, owner_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    name,
    partyType,
    rmName,
    `RM-${rmName.slice(0, 3).toUpperCase()}`,
    city,
    `DST-${city.slice(0, 3).toUpperCase()}`,
    totalSales,
    outstanding,
    isoDate(-12),
    "sample-data-generator",
    ownerUserId
  );
};

const ensureProduct = ({ id, name, rate, totalQty, totalValue, uom = "Bag" }) => {
  db.prepare(
    `INSERT OR REPLACE INTO tally_products (id, name, packing_size, uom, rate, total_qty, total_value, frequency, source_file)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, name, "1x", uom, rate, totalQty, totalValue, 6, "sample-data-generator");
};

const ensureInvoice = ({ id, customerId, customerName, amount, date, productId, productName, quantity, rate }) => {
  const invoiceDate = isoDate(date);

  db.prepare(
    `INSERT OR REPLACE INTO tally_invoices (
      id, company_name, voucher_guid, voucher_number, voucher_type,
      invoice_date, customer_id, customer_name, amount, reference,
      source_sync_id, updated_at, ingest_session_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, NULL)`
  ).run(
    id,
    "PSSPL CRM Demo",
    `INV-${id}`,
    `INV-${id}`,
    "Sales",
    invoiceDate,
    customerId,
    customerName,
    amount,
    `Demo-invoice-${id}`,
    `demo-sync-${id}`
  );

  db.prepare(
    `INSERT OR REPLACE INTO tally_invoice_lines (
      id, invoice_id, product_id, product_name, quantity, rate, amount, uom
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(`${id}-line`, id, productId, productName, quantity, rate, amount, "Bag");
};

const ensureVisit = ({ id, userId, customerId, purpose, status = "completed", offsetDays = 0 }) => {
  db.prepare(
    `INSERT OR REPLACE INTO visits (
      id, user_id, business_date, tally_customer_id,
      scheduled_at, started_at, completed_at, purpose,
      outcome, notes, latitude, longitude, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    userId,
    isoDate(offsetDays),
    customerId,
    `${isoDate(offsetDays)}T10:00:00.000Z`,
    `${isoDate(offsetDays)}T10:15:00.000Z`,
    `${isoDate(offsetDays)}T11:00:00.000Z`,
    purpose,
    "Positive discussion and demo completed",
    "Sample visit note generated for testing.",
    28.6139 + (Math.random() * 0.03),
    77.2090 + (Math.random() * 0.03),
    status
  );
};

const ensureFollowUp = ({ id, userId, customerId, title, dueDateOffset, priority = "today" }) => {
  db.prepare(
    `INSERT OR REPLACE INTO follow_ups (
      id, user_id, tally_customer_id, title, due_date, priority, completed, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).run(id, userId, customerId, title, isoDate(dueDateOffset), priority, 0);
};

const ensureTarget = ({ rmName, period, targetLakh }) => {
  db.prepare(
    `INSERT OR REPLACE INTO tally_rm_targets (rm_name, period, target_lakh)
     VALUES (?, ?, ?)`
  ).run(rmName, period, targetLakh);
};

const ensureReceipt = ({ id, customerId, customerName, amount, paymentDateOffset = -5 }) => {
  db.prepare(
    `INSERT OR REPLACE INTO tally_payments_live (
      id, company_name, voucher_guid, voucher_number, payment_date,
      payment_type, customer_id, customer_name, amount, reference,
      source_sync_id, updated_at, ingest_session_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, NULL)`
  ).run(
    id,
    "PSSPL CRM Demo",
    `RCPT-${id}`,
    `RCPT-${id}`,
    isoDate(paymentDateOffset),
    "Receipt",
    customerId,
    customerName,
    amount,
    `Demo-receipt-${id}`,
    `receipt-sync-${id}`
  );
};

const ensureAttendance = ({ userId, checkInOffset = 0, checkOutOffset = 3 }) => {
  const checkIn = new Date(today);
  checkIn.setDate(checkIn.getDate() + checkInOffset);
  checkIn.setHours(9, 30, 0, 0);

  const checkOut = new Date(checkIn);
  checkOut.setHours(18, 0, 0, 0);

  db.prepare(
    `INSERT OR REPLACE INTO attendance (
      id, user_id, business_date, check_in_at, check_out_at, latitude, longitude
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(`${userId}-${isoDate(checkInOffset)}`, userId, isoDate(checkInOffset), checkIn.toISOString(), checkOut.toISOString(), 28.6139, 77.2090);
};

upsertUser({ id: "rm-001", email: "rm@psspl.com", password: "demo123", role: "rm", fullName: "Rohit Mehra", region: "North Region", territory: "Gurugram / Delhi NCR", employeeCode: "PSSPL-RM-001", monthlyTarget: 1800000 });
upsertUser({ id: "sp-101", email: "anil.jaina@psspl.com", password: "demo123", role: "salesperson", fullName: "Anil Jena", region: "North Region", territory: "Gurugram / Delhi NCR", employeeCode: "PSSPL-S-001", managerUserId: "rm-001", monthlyTarget: 240000 });
upsertUser({ id: "sp-102", email: "neha.singh@psspl.com", password: "demo123", role: "salesperson", fullName: "Neha Singh", region: "North Region", territory: "Delhi East", employeeCode: "PSSPL-S-002", managerUserId: "rm-001", monthlyTarget: 210000 });

const productSeed = [
  { id: "prod-001", name: "Super Grow 20kg", rate: 980, totalQty: 1200, totalValue: 1176000 },
  { id: "prod-002", name: "Crop Shield 10L", rate: 760, totalQty: 900, totalValue: 684000 },
  { id: "prod-003", name: "Soil Boost Plus", rate: 640, totalQty: 1500, totalValue: 960000 },
  { id: "prod-004", name: "DripMax Kit", rate: 2200, totalQty: 420, totalValue: 924000 },
  { id: "prod-005", name: "Nutrient Pro Granules", rate: 540, totalQty: 1800, totalValue: 972000 }
];

for (const product of productSeed) ensureProduct(product);

const customerSeed = [
  ["cust-001", "Aarav Agro Inputs", "Gurugram", "Anil Jena"],
  ["cust-002", "Bharat Crop Hub", "Faridabad", "Anil Jena"],
  ["cust-003", "Delhi Harvest Mart", "Delhi", "Anil Jena"],
  ["cust-004", "Green Valley Supply", "Noida", "Anil Jena"],
  ["cust-005", "Jalebi Farms Pvt Ltd", "Ghaziabad", "Anil Jena"],
  ["cust-006", "Krishna Agro Centre", "Sonipat", "Neha Singh"],
  ["cust-007", "Meadow Fertilizers", "Panipat", "Neha Singh"],
  ["cust-008", "North Star Seeds", "Rohtak", "Neha Singh"],
  ["cust-009", "Punjab Green Traders", "Ambala", "Neha Singh"],
  ["cust-010", "Saffron Valley Seeds", "Yamunanagar", "Neha Singh"],
  ["cust-011", "Rural Growth Co", "Jaipur", "Anil Jena"],
  ["cust-012", "Saraswati Inputs", "Kota", "Anil Jena"],
  ["cust-013", "Shakti Agri Mart", "Bikaner", "Anil Jena"],
  ["cust-014", "Vedic Farm Supply", "Ajmer", "Neha Singh"],
  ["cust-015", "Sunrise Agritech", "Alwar", "Neha Singh"],
  ["cust-016", "Evergreen Crop Works", "Mathura", "Neha Singh"],
  ["cust-017", "Himalaya Agro", "Meerut", "Anil Jena"],
  ["cust-018", "Crown Fertilizers", "Bulandshahr", "Anil Jena"],
  ["cust-019", "Lotus Farm Solutions", "Moradabad", "Neha Singh"],
  ["cust-020", "Prime Seeds India", "Haridwar", "Neha Singh"]
];

for (const [id, name, city, ownerName] of customerSeed) {
  const totalSales = 120000 + (Number(id.slice(-3)) * 1685);
  const outstanding = 15000 + (Number(id.slice(-3)) * 740);
  const ownerUserId = ownerName === "Anil Jena" ? "sp-101" : "sp-102";
  ensureCustomer({
    id,
    name,
    city,
    rmName: "North Region",
    partyType: "Dealer",
    totalSales,
    outstanding,
    ownerUserId
  });
}

const invoiceSeed = [
  { id: "inv-001", customerId: "cust-001", customerName: "Aarav Agro Inputs", amount: 64000, date: -18, productId: "prod-001", productName: "Super Grow 20kg", quantity: 65, rate: 980 },
  { id: "inv-002", customerId: "cust-002", customerName: "Bharat Crop Hub", amount: 51200, date: -16, productId: "prod-002", productName: "Crop Shield 10L", quantity: 67, rate: 760 },
  { id: "inv-003", customerId: "cust-003", customerName: "Delhi Harvest Mart", amount: 74200, date: -14, productId: "prod-003", productName: "Soil Boost Plus", quantity: 116, rate: 640 },
  { id: "inv-004", customerId: "cust-004", customerName: "Green Valley Supply", amount: 89400, date: -11, productId: "prod-004", productName: "DripMax Kit", quantity: 40, rate: 2200 },
  { id: "inv-005", customerId: "cust-005", customerName: "Jalebi Farms Pvt Ltd", amount: 45800, date: -8, productId: "prod-005", productName: "Nutrient Pro Granules", quantity: 85, rate: 540 },
  { id: "inv-006", customerId: "cust-006", customerName: "Krishna Agro Centre", amount: 69300, date: -21, productId: "prod-001", productName: "Super Grow 20kg", quantity: 71, rate: 980 },
  { id: "inv-007", customerId: "cust-007", customerName: "Meadow Fertilizers", amount: 48220, date: -17, productId: "prod-002", productName: "Crop Shield 10L", quantity: 63, rate: 760 },
  { id: "inv-008", customerId: "cust-008", customerName: "North Star Seeds", amount: 73500, date: -13, productId: "prod-003", productName: "Soil Boost Plus", quantity: 115, rate: 640 },
  { id: "inv-009", customerId: "cust-009", customerName: "Punjab Green Traders", amount: 74200, date: -9, productId: "prod-004", productName: "DripMax Kit", quantity: 33, rate: 2200 },
  { id: "inv-010", customerId: "cust-010", customerName: "Saffron Valley Seeds", amount: 62100, date: -5, productId: "prod-005", productName: "Nutrient Pro Granules", quantity: 115, rate: 540 },
  { id: "inv-011", customerId: "cust-011", customerName: "Rural Growth Co", amount: 81100, date: -19, productId: "prod-001", productName: "Super Grow 20kg", quantity: 83, rate: 980 },
  { id: "inv-012", customerId: "cust-012", customerName: "Saraswati Inputs", amount: 56500, date: -15, productId: "prod-002", productName: "Crop Shield 10L", quantity: 74, rate: 760 },
  { id: "inv-013", customerId: "cust-013", customerName: "Shakti Agri Mart", amount: 74400, date: -12, productId: "prod-003", productName: "Soil Boost Plus", quantity: 116, rate: 640 },
  { id: "inv-014", customerId: "cust-014", customerName: "Vedic Farm Supply", amount: 90200, date: -10, productId: "prod-004", productName: "DripMax Kit", quantity: 41, rate: 2200 },
  { id: "inv-015", customerId: "cust-015", customerName: "Sunrise Agritech", amount: 49000, date: -7, productId: "prod-005", productName: "Nutrient Pro Granules", quantity: 91, rate: 540 },
  { id: "inv-016", customerId: "cust-016", customerName: "Evergreen Crop Works", amount: 75300, date: -6, productId: "prod-001", productName: "Super Grow 20kg", quantity: 77, rate: 980 },
  { id: "inv-017", customerId: "cust-017", customerName: "Himalaya Agro", amount: 49440, date: -4, productId: "prod-002", productName: "Crop Shield 10L", quantity: 65, rate: 760 },
  { id: "inv-018", customerId: "cust-018", customerName: "Crown Fertilizers", amount: 77600, date: -3, productId: "prod-003", productName: "Soil Boost Plus", quantity: 121, rate: 640 },
  { id: "inv-019", customerId: "cust-019", customerName: "Lotus Farm Solutions", amount: 82800, date: -2, productId: "prod-004", productName: "DripMax Kit", quantity: 38, rate: 2200 },
  { id: "inv-020", customerId: "cust-020", customerName: "Prime Seeds India", amount: 62000, date: -1, productId: "prod-005", productName: "Nutrient Pro Granules", quantity: 115, rate: 540 }
];

for (const invoice of invoiceSeed) ensureInvoice(invoice);

const currentFyStartYear = new Date().getMonth() + 1 >= 4 ? new Date().getFullYear() : new Date().getFullYear() - 1;
const currentFy = `${currentFyStartYear}-${String((currentFyStartYear + 1) % 100).padStart(2, "0")}`;
for (const period of [
  `${currentFyStartYear}-04`,
  `${currentFyStartYear}-05`,
  `${currentFyStartYear}-06`,
  `${currentFyStartYear}-07`,
  `${currentFyStartYear}-08`,
  `${currentFyStartYear}-09`,
  `${currentFyStartYear}-10`,
  `${currentFyStartYear}-11`,
  `${currentFyStartYear}-12`,
  `${currentFyStartYear + 1}-01`,
  `${currentFyStartYear + 1}-02`,
  `${currentFyStartYear + 1}-03`
]) {
  ensureTarget({ rmName: "North Region", period, targetLakh: 30 + (Number(period.slice(-2)) % 5) * 2 });
}

for (const [index, customer] of customerSeed.entries()) {
  if (index >= 8) break;
  ensureReceipt({
    id: `rcpt-${String(index + 1).padStart(3, "0")}`,
    customerId: customer[0],
    customerName: customer[1],
    amount: 20000 + index * 3500,
    paymentDateOffset: -index
  });
}

const visitSeed = [
  { id: "vis-001", userId: "sp-101", customerId: "cust-001", purpose: "Crop nutrition planning", status: "completed", offset: -1 },
  { id: "vis-002", userId: "sp-101", customerId: "cust-003", purpose: "Soil health review", status: "completed", offset: -3 },
  { id: "vis-003", userId: "sp-101", customerId: "cust-005", purpose: "New product discussion", status: "completed", offset: -5 },
  { id: "vis-004", userId: "sp-101", customerId: "cust-011", purpose: "Dealer expansion meeting", status: "in_progress", offset: 0 },
  { id: "vis-005", userId: "sp-102", customerId: "cust-006", purpose: "Seasonal demand check", status: "completed", offset: -2 },
  { id: "vis-006", userId: "sp-102", customerId: "cust-008", purpose: "Stock replenishment review", status: "completed", offset: -4 },
  { id: "vis-007", userId: "sp-102", customerId: "cust-010", purpose: "Follow-up on prior order", status: "planned", offset: 2 },
  { id: "vis-008", userId: "sp-102", customerId: "cust-015", purpose: "Field demonstration", status: "completed", offset: 0 }
];

for (const visit of visitSeed) ensureVisit(visit);

ensureFollowUp({ id: "fu-001", userId: "sp-101", customerId: "cust-001", title: "Share pricing on Super Grow", dueDateOffset: 2, priority: "high" });
ensureFollowUp({ id: "fu-002", userId: "sp-101", customerId: "cust-011", title: "Confirm new dealer onboarding", dueDateOffset: 1, priority: "today" });
ensureFollowUp({ id: "fu-003", userId: "sp-102", customerId: "cust-006", title: "Review purchase order", dueDateOffset: 3, priority: "medium" });
ensureFollowUp({ id: "fu-004", userId: "sp-102", customerId: "cust-015", title: "Send product brochure copy", dueDateOffset: 4, priority: "low" });

ensureAttendance({ userId: "sp-101", checkInOffset: 0 });
ensureAttendance({ userId: "sp-102", checkInOffset: 0 });

console.log("Inserted 20 demo invoice/customer records and supporting CRM data successfully.");
console.log("Users:", db.prepare("SELECT COUNT(*) AS count FROM users").get().count);
console.log("Customers:", db.prepare("SELECT COUNT(*) AS count FROM tally_customers").get().count);
console.log("Products:", db.prepare("SELECT COUNT(*) AS count FROM tally_products").get().count);
console.log("Invoices:", db.prepare("SELECT COUNT(*) AS count FROM tally_invoices").get().count);
console.log("Visits:", db.prepare("SELECT COUNT(*) AS count FROM visits").get().count);
