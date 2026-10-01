import { Router } from "express";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { db, transaction } from "./db.mjs";

const ACCESS_TTL_MS = 60 * 60 * 1000;
const REFRESH_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const token = () => randomBytes(32).toString("base64url");
const iso = () => new Date().toISOString();
const apiBaseUrl = (req) => (process.env.CRM_PUBLIC_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");

function issueTokens(connectorId) {
  const accessToken = token();
  const refreshToken = token();
  const accessTokenExpiresAt = new Date(Date.now() + ACCESS_TTL_MS).toISOString();
  const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TTL_MS).toISOString();
  db.prepare("INSERT INTO tally_connector_tokens (id,connector_id,token_type,token_hash,expires_at) VALUES (?,?,?,?,?)")
    .run(randomUUID(), connectorId, "access", hash(accessToken), accessTokenExpiresAt);
  db.prepare("INSERT INTO tally_connector_tokens (id,connector_id,token_type,token_hash,expires_at) VALUES (?,?,?,?,?)")
    .run(randomUUID(), connectorId, "refresh", hash(refreshToken), refreshTokenExpiresAt);
  return { accessToken, accessTokenExpiresAt, refreshToken };
}

function connectorAuth(req, res, next) {
  const raw = req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!raw) return res.status(401).json({ error: "Connector access token is required" });
  const row = db.prepare(`
    SELECT c.* FROM tally_connector_tokens t
    JOIN tally_connectors c ON c.id=t.connector_id
    WHERE t.token_hash=? AND t.token_type='access' AND t.revoked_at IS NULL
      AND t.expires_at>datetime('now') AND c.revoked_at IS NULL
  `).get(hash(raw));
  if (!row) return res.status(401).json({ error: "Connector access token is invalid or expired" });
  req.connector = row;
  next();
}

const pairSchema = z.object({
  pairingCode: z.string().min(6).max(40), installationId: z.string().min(1).max(200),
  machineName: z.string().min(1).max(255), agentVersion: z.string().min(1).max(100),
});
const heartbeatSchema = z.object({
  agentVersion: z.string().min(1).max(100), machineName: z.string().min(1).max(255), tallyAvailable: z.boolean(),
  selectedCompany: z.string().max(300).nullish(), selectedCompanyGuid: z.string().max(300).nullish(),
  openCompanies: z.array(z.string().max(300)).optional(), openCompanyIdentities: z.array(z.object({ name: z.string(), guid: z.string().nullish() })).optional(),
  lastSyncAt: z.string().nullish(), historySyncInProgress: z.boolean().optional(), nextHistoryFrom: z.string().nullish(),
});
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function decodeXml(value = "") {
  return String(value).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}
function tag(block, name) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return decodeXml(match?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ") || "");
}
function numberOf(value) {
  const match = String(value || "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}
function tallyDate(value) {
  const text = String(value || "").replace(/\D/g, "");
  return text.length >= 8 ? `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}` : null;
}
function stableId(prefix, value) { return `${prefix}-${hash(String(value).trim().toLowerCase()).slice(0, 20)}`; }
function blocks(xml, name) { return [...String(xml || "").matchAll(new RegExp(`<${name}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${name}>`, "gi"))].map((match) => match[0]); }

function splitCompleteVoucherBlocks(carry, content) {
  const input = `${carry || ""}${content || ""}`;
  const vouchers = [];
  const pattern = /<VOUCHER(?:\s[^>]*)?>[\s\S]*?<\/VOUCHER>/gi;
  let match;
  let consumedThrough = 0;
  while ((match = pattern.exec(input)) !== null) {
    vouchers.push(match[0]);
    consumedThrough = pattern.lastIndex;
  }
  const nextStart = input.indexOf("<VOUCHER", consumedThrough);
  return {
    vouchers,
    carry: nextStart >= 0 ? input.slice(nextStart) : "",
  };
}

function ingestVoucherChunk(session, sequence, content) {
  const existing = db.prepare("SELECT 1 FROM tally_chunk_parts WHERE session_id=? AND field_name='vouchersXml' AND sequence=?").get(session.id, sequence);
  if (existing) return { duplicate: true };

  const expected = session.voucher_chunks_received ?? 0;
  if (sequence !== expected) throw new Error(`Voucher chunk ${sequence} arrived out of order; expected ${expected}`);

  const parsed = splitCompleteVoucherBlocks(session.voucher_carry, content);
  let invoiceCount = 0;
  let lineCount = 0;
  let paymentCount = 0;
  let purchaseCount = 0;
  let purchaseLineCount = 0;

  transaction(() => {
    const addCustomer = db.prepare(`INSERT INTO tally_customers (id,name,party_type,total_sales,outstanding,source_file) VALUES (?,?,?,0,0,?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, source_file=excluded.source_file`);
    const addProduct = db.prepare(`INSERT INTO tally_products (id,name,total_qty,total_value,source_file) VALUES (?,?,0,0,?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, source_file=excluded.source_file`);
    const addInvoice = db.prepare(`INSERT INTO tally_invoices (id,company_name,voucher_guid,voucher_number,voucher_type,invoice_date,customer_id,customer_name,amount,reference,source_sync_id,updated_at,ingest_session_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET voucher_number=excluded.voucher_number,voucher_type=excluded.voucher_type,invoice_date=excluded.invoice_date,customer_id=excluded.customer_id,customer_name=excluded.customer_name,amount=excluded.amount,reference=excluded.reference,source_sync_id=excluded.source_sync_id,updated_at=excluded.updated_at,ingest_session_id=excluded.ingest_session_id`);
    const addLine = db.prepare(`INSERT INTO tally_invoice_lines (id,invoice_id,product_id,product_name,quantity,rate,amount,uom) VALUES (?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET quantity=excluded.quantity,rate=excluded.rate,amount=excluded.amount,uom=excluded.uom`);
    const addPayment = db.prepare(`INSERT INTO tally_payments_live (id,company_name,voucher_guid,voucher_number,payment_date,payment_type,customer_id,customer_name,amount,reference,source_sync_id,updated_at,ingest_session_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET payment_date=excluded.payment_date,payment_type=excluded.payment_type,customer_id=excluded.customer_id,customer_name=excluded.customer_name,amount=excluded.amount,reference=excluded.reference,source_sync_id=excluded.source_sync_id,updated_at=excluded.updated_at,ingest_session_id=excluded.ingest_session_id`);
    const addPurchase = db.prepare(`INSERT INTO tally_purchases (id,company_name,voucher_guid,voucher_number,purchase_date,supplier_name,amount,reference,source_sync_id,updated_at,ingest_session_id) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET voucher_number=excluded.voucher_number,purchase_date=excluded.purchase_date,supplier_name=excluded.supplier_name,amount=excluded.amount,reference=excluded.reference,source_sync_id=excluded.source_sync_id,updated_at=excluded.updated_at,ingest_session_id=excluded.ingest_session_id`);
    const addPurchaseLine = db.prepare(`INSERT INTO tally_purchase_lines (id,purchase_id,product_id,product_name,quantity,rate,amount,uom) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET quantity=excluded.quantity,rate=excluded.rate,amount=excluded.amount,uom=excluded.uom`);
    const source = `Tally Connector · ${session.company_name}`;

    for (const voucher of parsed.vouchers) {
      const voucherType = tag(voucher, "VOUCHERTYPENAME") || tag(voucher, "VOUCHERTYPE");
      const date = tallyDate(tag(voucher, "DATE"));
      const customerName = tag(voucher, "PARTYLEDGERNAME") || tag(voucher, "PARTYNAME") || tag(voucher, "BASICBUYERNAME");
      if (!date || !customerName) continue;
      const customerId = stableId("tally-customer", customerName);
      const guid = tag(voucher, "GUID") || tag(voucher, "MASTERID") || tag(voucher, "ALTERID");
      const voucherNumber = tag(voucher, "VOUCHERNUMBER") || tag(voucher, "REFERENCE");
      const reference = tag(voucher, "REFERENCE") || tag(voucher, "BASICORDERREF");
      const absoluteTotal = Math.abs(numberOf(tag(voucher, "AMOUNT")));
      if (!/purchase/i.test(voucherType)) addCustomer.run(customerId, customerName, "Customer", source);

      if (/receipt|payment/i.test(voucherType)) {
        const id = stableId("tally-payment", guid || `${session.company_name}|${voucherType}|${voucherNumber}|${date}|${customerName}|${absoluteTotal}`);
        addPayment.run(id, session.company_name, guid || null, voucherNumber || null, date, voucherType, customerId, customerName, absoluteTotal, reference || null, session.sync_id || null, iso(), session.id);
        paymentCount += 1;
        continue;
      }
      if (/purchase/i.test(voucherType) && !/order/i.test(voucherType)) {
        const purchaseId = stableId("tally-purchase", guid || `${session.company_name}|${voucherType}|${voucherNumber}|${date}|${customerName}`);
        const inventory = blocks(voucher, "ALLINVENTORYENTRIES.LIST").length ? blocks(voucher, "ALLINVENTORYENTRIES.LIST") : blocks(voucher, "INVENTORYENTRIES.LIST");
        const purchaseLines = [];
        for (const line of inventory) {
          const productName = tag(line, "STOCKITEMNAME"); if (!productName) continue;
          const productId = stableId("tally-product", productName); const quantityText = tag(line, "ACTUALQTY") || tag(line, "BILLEDQTY");
          const quantity = Math.abs(numberOf(quantityText)), amount = Math.abs(numberOf(tag(line, "AMOUNT"))), rate = Math.abs(numberOf(tag(line, "RATE"))), uom = quantityText.replace(/[-+\d.,\s]/g, "").trim();
          addProduct.run(productId, productName, source); purchaseLines.push({ id: stableId("tally-purchase-line", `${purchaseId}|${productName}|${purchaseLines.length}`), productId, productName, quantity, rate, amount, uom });
        }
        const amount = purchaseLines.length ? purchaseLines.reduce((sum, line) => sum + line.amount, 0) : absoluteTotal;
        addPurchase.run(purchaseId, session.company_name, guid || null, voucherNumber || null, date, customerName, amount, reference || null, session.sync_id || null, iso(), session.id);
        for (const line of purchaseLines) addPurchaseLine.run(line.id, purchaseId, line.productId, line.productName, line.quantity, line.rate, line.amount, line.uom || null);
        purchaseCount += 1; purchaseLineCount += purchaseLines.length; continue;
      }
      if (!/sales?|credit note/i.test(voucherType) || /order|proforma/i.test(voucherType)) continue;

      const sign = /credit note/i.test(voucherType) ? -1 : 1;
      const invoiceId = stableId("tally-invoice", guid || `${session.company_name}|${voucherType}|${voucherNumber}|${date}|${customerName}`);
      const inventory = blocks(voucher, "ALLINVENTORYENTRIES.LIST").length
        ? blocks(voucher, "ALLINVENTORYENTRIES.LIST")
        : blocks(voucher, "INVENTORYENTRIES.LIST");
      const lines = [];
      for (const line of inventory) {
        const productName = tag(line, "STOCKITEMNAME");
        if (!productName) continue;
        const productId = stableId("tally-product", productName);
        const quantityText = tag(line, "ACTUALQTY") || tag(line, "BILLEDQTY");
        const quantity = sign * Math.abs(numberOf(quantityText));
        const amount = sign * Math.abs(numberOf(tag(line, "AMOUNT")));
        const rate = Math.abs(numberOf(tag(line, "RATE")));
        const uom = quantityText.replace(/[-+\d.,\s]/g, "").trim();
        addProduct.run(productId, productName, source);
        lines.push({ id: stableId("tally-line", `${invoiceId}|${productName}|${lines.length}`), productId, productName, quantity, rate, amount, uom });
      }
      const amount = lines.length ? lines.reduce((sum, line) => sum + line.amount, 0) : sign * absoluteTotal;
      addInvoice.run(invoiceId, session.company_name, guid || null, voucherNumber || null, voucherType, date, customerId, customerName, amount, reference || null, session.sync_id || null, iso(), session.id);
      for (const line of lines) addLine.run(line.id, invoiceId, line.productId, line.productName, line.quantity, line.rate, line.amount, line.uom || null);
      invoiceCount += 1;
      lineCount += lines.length;
    }

    db.prepare("INSERT INTO tally_chunk_parts (session_id,field_name,sequence,content) VALUES (?,'vouchersXml',?,'')").run(session.id, sequence);
    db.prepare(`UPDATE tally_chunk_sessions
      SET voucher_carry=?, voucher_chunks_received=voucher_chunks_received+1,
          voucher_rows_received=voucher_rows_received+?,
          invoice_rows_stored=invoice_rows_stored+?,
          invoice_lines_stored=invoice_lines_stored+?,
          payment_rows_stored=payment_rows_stored+?
          ,purchase_rows_stored=purchase_rows_stored+?,purchase_lines_stored=purchase_lines_stored+?
      WHERE id=?`).run(parsed.carry, parsed.vouchers.length, invoiceCount, lineCount, paymentCount, purchaseCount, purchaseLineCount, session.id);
  });
  return { duplicate: false, vouchers: parsed.vouchers.length, invoices: invoiceCount, invoiceLines: lineCount, payments: paymentCount, purchases: purchaseCount, purchaseLines: purchaseLineCount };
}

function rebuildLiveSalesAggregates(session) {
  transaction(() => {
    db.prepare(`DELETE FROM tally_customer_monthly_sales
      WHERE period>=substr(?,1,7) AND period<=substr(?,1,7)
        AND customer_id IN (SELECT id FROM tally_customers WHERE source_file=?)`)
      .run(session.date_from, session.date_to, `Tally Connector · ${session.company_name}`);
    db.prepare(`INSERT INTO tally_customer_monthly_sales (customer_id,period,amount)
      SELECT customer_id,substr(invoice_date,1,7),SUM(amount)
      FROM tally_invoices
      WHERE company_name=? AND invoice_date>=? AND invoice_date<=? AND customer_id IS NOT NULL
      GROUP BY customer_id,substr(invoice_date,1,7)
      ON CONFLICT(customer_id,period) DO UPDATE SET amount=excluded.amount`)
      .run(session.company_name, session.date_from, session.date_to);
    db.prepare(`DELETE FROM tally_product_monthly_sales
      WHERE period>=substr(?,1,7) AND period<=substr(?,1,7)
        AND product_id IN (SELECT id FROM tally_products WHERE source_file=?)`)
      .run(session.date_from, session.date_to, `Tally Connector · ${session.company_name}`);
    db.prepare(`INSERT INTO tally_product_monthly_sales (product_id,period,quantity,sales_value)
      SELECT l.product_id,substr(i.invoice_date,1,7),SUM(l.quantity),SUM(l.amount)
      FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id
      WHERE i.company_name=? AND i.invoice_date>=? AND i.invoice_date<=? AND l.product_id IS NOT NULL
      GROUP BY l.product_id,substr(i.invoice_date,1,7)
      ON CONFLICT(product_id,period) DO UPDATE SET quantity=excluded.quantity,sales_value=excluded.sales_value`)
      .run(session.company_name, session.date_from, session.date_to);
  });
}

function normalizeTallySnapshot(session, fields) {
  const source = `Tally Connector · ${session.company_name}`;
  const customers = new Map();
  const products = new Map();
  const customerMonthly = new Map();
  const productMonthly = new Map();
  const productMonthlyValue = new Map();
  const invoices = [];
  const payments = [];
  let salesRows = 0;

  for (const voucher of blocks(fields.vouchersXml || fields.dayBookReportXml || fields.salesRegisterXml, "VOUCHER")) {
    const voucherType = tag(voucher, "VOUCHERTYPENAME") || tag(voucher, "VOUCHERTYPE");
    const date = tallyDate(tag(voucher, "DATE"));
    const period = date?.slice(0, 7);
    const customerName = tag(voucher, "PARTYLEDGERNAME") || tag(voucher, "PARTYNAME") || tag(voucher, "BASICBUYERNAME");
    if (!period || !customerName) continue;
    const customerId = stableId("tally-customer", customerName);
    customers.set(customerId, { id: customerId, name: customerName });
    const guid = tag(voucher, "GUID") || tag(voucher, "MASTERID") || tag(voucher, "ALTERID");
    const voucherNumber = tag(voucher, "VOUCHERNUMBER") || tag(voucher, "REFERENCE");
    const reference = tag(voucher, "REFERENCE") || tag(voucher, "BASICORDERREF");
    let voucherTotal = Math.abs(numberOf(tag(voucher, "AMOUNT")));
    if (/receipt|payment/i.test(voucherType)) {
      payments.push({ id: stableId("tally-payment", guid || `${session.company_name}|${voucherType}|${voucherNumber}|${date}|${customerName}|${voucherTotal}`), guid, voucherNumber, date, voucherType, customerId, customerName, amount: voucherTotal, reference });
      continue;
    }
    if (!/sales?|credit note/i.test(voucherType) || /order/i.test(voucherType)) continue;
    const invoiceId = stableId("tally-invoice", guid || `${session.company_name}|${voucherType}|${voucherNumber}|${date}|${customerName}`);
    const invoice = { id: invoiceId, guid, voucherNumber, voucherType, date, customerId, customerName, amount: voucherTotal, reference, lines: [] };
    const lines = blocks(voucher, "ALLINVENTORYENTRIES.LIST").length ? blocks(voucher, "ALLINVENTORYENTRIES.LIST") : blocks(voucher, "INVENTORYENTRIES.LIST");
    for (const line of lines) {
      const productName = tag(line, "STOCKITEMNAME");
      if (!productName) continue;
      const productId = stableId("tally-product", productName);
      const quantity = Math.abs(numberOf(tag(line, "ACTUALQTY") || tag(line, "BILLEDQTY")));
      const value = Math.abs(numberOf(tag(line, "AMOUNT")));
      const rate = Math.abs(numberOf(tag(line, "RATE")));
      const uom = (tag(line, "ACTUALQTY") || tag(line, "BILLEDQTY")).replace(/[-+\d.,\s]/g, "").trim();
      products.set(productId, { id: productId, name: productName });
      productMonthly.set(`${productId}|${period}`, (productMonthly.get(`${productId}|${period}`) || 0) + quantity);
      productMonthlyValue.set(`${productId}|${period}`, (productMonthlyValue.get(`${productId}|${period}`) || 0) + value);
      invoice.lines.push({ id: stableId("tally-line", `${invoiceId}|${productName}|${invoice.lines.length}`), productId, productName, quantity, rate, amount: value, uom });
      if (value) voucherTotal = Math.max(voucherTotal, value);
      salesRows += 1;
    }
    invoice.amount = invoice.lines.length ? invoice.lines.reduce((sum, line) => sum + line.amount, 0) : voucherTotal;
    invoices.push(invoice);
    customerMonthly.set(`${customerId}|${period}`, (customerMonthly.get(`${customerId}|${period}`) || 0) + voucherTotal);
  }

  for (const ledger of blocks(fields.ledgersXml, "LEDGER")) {
    const nameMatch = ledger.match(/<LEDGER[^>]*\bNAME="([^"]+)"/i);
    const name = decodeXml(nameMatch?.[1] || tag(ledger, "NAME"));
    const parent = tag(ledger, "PARENT");
    if (!name || !/sundry debtors?|customer|dealer/i.test(parent)) continue;
    const id = stableId("tally-customer", name);
    const rmName = tag(ledger, "RMNAME") || tag(ledger, "SALESMANNAME") || tag(ledger, "AGENTNAME");
    customers.set(id, { id, name, partyType: parent, outstanding: Math.abs(numberOf(tag(ledger, "CLOSINGBALANCE"))), contactName: tag(ledger, "LEDGERCONTACT") || tag(ledger, "CONTACTPERSON"), phone: tag(ledger, "LEDGERMOBILE") || tag(ledger, "MOBILENUMBER") || tag(ledger, "LEDGERPHONE"), email: tag(ledger, "EMAIL") || tag(ledger, "EMAILID"), state: tag(ledger, "LEDSTATENAME") || tag(ledger, "STATENAME"), pincode: tag(ledger, "PINCODE"), gstin: tag(ledger, "PARTYGSTIN"), rmName });
  }

  for (const stock of blocks(fields.stockXml || fields.stockSummaryReportXml, "STOCKITEM")) {
    const nameMatch = stock.match(/<STOCKITEM[^>]*\bNAME="([^"]+)"/i);
    const name = decodeXml(nameMatch?.[1] || tag(stock, "NAME"));
    if (!name) continue;
    const id = stableId("tally-product", name);
    products.set(id, { id, name, totalQty: Math.abs(numberOf(tag(stock, "CLOSINGBALANCE"))), totalValue: Math.abs(numberOf(tag(stock, "CLOSINGVALUE"))) });
  }

  transaction(() => {
    const addCustomer = db.prepare(`INSERT INTO tally_customers (id,name,party_type,rm_name,total_sales,outstanding,source_file,contact_name,phone,email,state,pincode,gstin) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, party_type=COALESCE(excluded.party_type,tally_customers.party_type), rm_name=COALESCE(NULLIF(excluded.rm_name,''),tally_customers.rm_name), outstanding=excluded.outstanding, source_file=excluded.source_file, contact_name=COALESCE(NULLIF(excluded.contact_name,''),tally_customers.contact_name), phone=COALESCE(NULLIF(excluded.phone,''),tally_customers.phone), email=COALESCE(NULLIF(excluded.email,''),tally_customers.email), state=COALESCE(NULLIF(excluded.state,''),tally_customers.state), pincode=COALESCE(NULLIF(excluded.pincode,''),tally_customers.pincode), gstin=COALESCE(NULLIF(excluded.gstin,''),tally_customers.gstin)`);
    const addCustomerMonth = db.prepare(`INSERT INTO tally_customer_monthly_sales (customer_id,period,amount) VALUES (?,?,?) ON CONFLICT(customer_id,period) DO UPDATE SET amount=excluded.amount`);
    const addProduct = db.prepare(`INSERT INTO tally_products (id,name,total_qty,total_value,source_file) VALUES (?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, total_qty=MAX(excluded.total_qty,tally_products.total_qty), total_value=MAX(excluded.total_value,tally_products.total_value), source_file=excluded.source_file`);
    const addProductMonth = db.prepare(`INSERT INTO tally_product_monthly_sales (product_id,period,quantity,sales_value) VALUES (?,?,?,?) ON CONFLICT(product_id,period) DO UPDATE SET quantity=excluded.quantity,sales_value=excluded.sales_value`);
    const addInvoice = db.prepare(`INSERT INTO tally_invoices (id,company_name,voucher_guid,voucher_number,voucher_type,invoice_date,customer_id,customer_name,amount,reference,source_sync_id,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET voucher_number=excluded.voucher_number,voucher_type=excluded.voucher_type,invoice_date=excluded.invoice_date,customer_id=excluded.customer_id,customer_name=excluded.customer_name,amount=excluded.amount,reference=excluded.reference,source_sync_id=excluded.source_sync_id,updated_at=excluded.updated_at`);
    const addLine = db.prepare(`INSERT INTO tally_invoice_lines (id,invoice_id,product_id,product_name,quantity,rate,amount,uom) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET quantity=excluded.quantity,rate=excluded.rate,amount=excluded.amount,uom=excluded.uom`);
    const addPayment = db.prepare(`INSERT INTO tally_payments_live (id,company_name,voucher_guid,voucher_number,payment_date,payment_type,customer_id,customer_name,amount,reference,source_sync_id,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payment_date=excluded.payment_date,payment_type=excluded.payment_type,customer_id=excluded.customer_id,customer_name=excluded.customer_name,amount=excluded.amount,reference=excluded.reference,source_sync_id=excluded.source_sync_id,updated_at=excluded.updated_at`);
    for (const row of customers.values()) addCustomer.run(row.id, row.name, row.partyType || "Customer", row.rmName || null, 0, row.outstanding || 0, source, row.contactName || null, row.phone || null, row.email || null, row.state || null, row.pincode || null, row.gstin || null);
    for (const [key, amount] of customerMonthly) { const [id, period] = key.split("|"); addCustomerMonth.run(id, period, amount); }
    for (const row of products.values()) addProduct.run(row.id, row.name, row.totalQty || 0, row.totalValue || 0, source);
    for (const [key, quantity] of productMonthly) { const [id, period] = key.split("|"); addProductMonth.run(id, period, quantity, productMonthlyValue.get(key) || 0); }
    for (const row of invoices) { addInvoice.run(row.id, session.company_name, row.guid || null, row.voucherNumber || null, row.voucherType, row.date, row.customerId, row.customerName, row.amount, row.reference || null, session.sync_id || null, iso()); for (const line of row.lines) addLine.run(line.id, row.id, line.productId, line.productName, line.quantity, line.rate, line.amount, line.uom || null); }
    for (const row of payments) addPayment.run(row.id, session.company_name, row.guid || null, row.voucherNumber || null, row.date, row.voucherType, row.customerId, row.customerName, row.amount, row.reference || null, session.sync_id || null, iso());
    db.prepare(`UPDATE tally_customers SET total_sales=(SELECT COALESCE(SUM(amount),0) FROM tally_customer_monthly_sales WHERE customer_id=tally_customers.id) WHERE source_file=?`).run(source);
    db.prepare(`UPDATE tally_products SET total_qty=(SELECT COALESCE(SUM(quantity),0) FROM tally_product_monthly_sales WHERE product_id=tally_products.id) WHERE source_file=?`).run(source);
    db.prepare(`UPDATE tally_products SET total_value=(SELECT COALESCE(SUM(sales_value),0) FROM tally_product_monthly_sales WHERE product_id=tally_products.id) WHERE source_file=?`).run(source);
  });
  return { customers: customers.size, products: products.size, invoices: invoices.length, invoiceLines: salesRows, payments: payments.length, customerMonths: customerMonthly.size, productMonths: productMonthly.size };
}

export const connectorRouter = Router();

connectorRouter.post("/connectors/pair", (req, res, next) => {
  try {
    const parsed = pairSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid pairing request" });
    const input = parsed.data;
    const pairing = db.prepare(`SELECT * FROM tally_connector_pairing_codes WHERE code_hash=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at>datetime('now')`).get(hash(input.pairingCode.trim().toUpperCase()));
    if (!pairing) return res.status(401).json({ error: "Pairing code is invalid or expired" });
    const existing = db.prepare("SELECT id FROM tally_connectors WHERE installation_id=? AND revoked_at IS NULL").get(input.installationId);
    const connectorId = existing?.id || randomUUID();
    let credentials;
    transaction(() => {
      db.prepare("UPDATE tally_connectors SET status='revoked',revoked_at=? WHERE revoked_at IS NULL AND id<>?").run(iso(), connectorId);
      if (existing) db.prepare("UPDATE tally_connectors SET machine_name=?,agent_version=?,status='paired',paired_at=?,revoked_at=NULL WHERE id=?").run(input.machineName, input.agentVersion, iso(), connectorId);
      else db.prepare("INSERT INTO tally_connectors (id,installation_id,machine_name,agent_version,status,paired_at) VALUES (?,?,?,?,?,?)").run(connectorId, input.installationId, input.machineName, input.agentVersion, "paired", iso());
      db.prepare("UPDATE tally_connector_pairing_codes SET used_at=? WHERE id=?").run(iso(), pairing.id);
      db.prepare("UPDATE tally_connector_tokens SET revoked_at=? WHERE connector_id=? AND revoked_at IS NULL").run(iso(), connectorId);
      credentials = issueTokens(connectorId);
    });
    res.json({ ok: true, connectorId, ...credentials, apiBaseUrl: apiBaseUrl(req), syncIntervalSeconds: 3600, heartbeatIntervalSeconds: 60 });
  } catch (error) { next(error); }
});

connectorRouter.post("/connectors/refresh", (req, res, next) => {
  try {
    const raw = z.object({ refreshToken: z.string().min(20).max(256) }).safeParse(req.body);
    if (!raw.success) return res.status(400).json({ error: "Invalid refresh request" });
    const stored = db.prepare(`SELECT t.id token_id,c.* FROM tally_connector_tokens t JOIN tally_connectors c ON c.id=t.connector_id WHERE t.token_hash=? AND t.token_type='refresh' AND t.revoked_at IS NULL AND t.expires_at>datetime('now') AND c.revoked_at IS NULL`).get(hash(raw.data.refreshToken));
    if (!stored) return res.status(401).json({ error: "Refresh token is invalid or expired" });
    let credentials;
    transaction(() => { db.prepare("UPDATE tally_connector_tokens SET revoked_at=? WHERE id=?").run(iso(), stored.token_id); credentials = issueTokens(stored.id); });
    res.json({ ok: true, connectorId: stored.id, ...credentials, syncIntervalSeconds: stored.sync_interval_seconds || 3600, heartbeatIntervalSeconds: stored.heartbeat_interval_seconds || 60 });
  } catch (error) { next(error); }
});

connectorRouter.post("/connectors/heartbeat", connectorAuth, (req, res, next) => {
  try {
    const parsed = heartbeatSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid heartbeat payload" });
    const input = parsed.data; const now = iso();
    db.prepare(`UPDATE tally_connectors SET machine_name=?,agent_version=?,tally_available=?,tally_company=?,company_guid=?,open_companies_json=?,last_heartbeat_at=?,last_sync_at=COALESCE(?,last_sync_at),status='online' WHERE id=?`)
      .run(input.machineName, input.agentVersion, input.tallyAvailable ? 1 : 0, input.selectedCompany || null, input.selectedCompanyGuid || null, JSON.stringify(input.openCompanyIdentities || input.openCompanies || []), now, input.lastSyncAt || null, req.connector.id);
    res.json({ ok: true, connectorId: req.connector.id, syncIntervalSeconds: req.connector.sync_interval_seconds || 3600, lastSeenAt: now, lastSyncAt: input.lastSyncAt || req.connector.last_sync_at || null });
  } catch (error) { next(error); }
});

connectorRouter.post("/connectors/sync-job", connectorAuth, (req, res, next) => {
  try {
    if (req.body?.action === "start") {
      const parsed = z.object({ action: z.literal("start"), syncId: z.string().max(200).nullish(), companyName: z.string().min(1), companyGuid: z.string().nullish(), syncFrom: dateString, syncTo: dateString }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid sync job payload" });
      const id = randomUUID(); const input = parsed.data;
      db.prepare("INSERT INTO tally_sync_runs (id,started_at,status,connector_id,sync_id,company_name,company_guid,date_from,date_to) VALUES (?,?,?,?,?,?,?,?,?)").run(id, iso(), "receiving", req.connector.id, input.syncId || null, input.companyName, input.companyGuid || null, input.syncFrom, input.syncTo);
      return res.json({ ok: true, syncJobId: id });
    }
    const parsed = z.object({ action: z.literal("complete"), jobId: z.string(), status: z.enum(["stored","quarantined","failed"]), recordCount: z.number().int().min(0).nullish(), message: z.string().max(4000).nullish(), lastSyncAt: z.string().nullish() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid sync job payload" });
    const input = parsed.data;
    db.prepare("UPDATE tally_sync_runs SET completed_at=?,status=?,record_count=?,error_message=? WHERE id=? AND connector_id=?").run(iso(), input.status, input.recordCount || 0, input.message || null, input.jobId, req.connector.id);
    if (input.status === "stored") db.prepare("UPDATE tally_connectors SET last_sync_at=?,status='online' WHERE id=?").run(input.lastSyncAt || iso(), req.connector.id);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

connectorRouter.post("/ingest/tally/chunks", connectorAuth, (req, res, next) => {
  try {
    const action = req.body?.action;
    if (action === "start") {
      const parsed = z.object({ action: z.literal("start"), company: z.string().min(1), companyGuid: z.string().nullish(), from: dateString, to: dateString, asOf: dateString.optional(), publicationMode: z.string().optional(), historyCoveredFrom: dateString.nullish(), syncId: z.string().optional(), syncJobId: z.string().nullish() }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ ok: false, error: "Malformed chunk start request" });
      const input = parsed.data; const sessionId = randomUUID();
      db.prepare("INSERT INTO tally_chunk_sessions (id,connector_id,sync_job_id,sync_id,company_name,company_guid,date_from,date_to,as_of,publication_mode,history_covered_from) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        .run(sessionId, req.connector.id, input.syncJobId || null, input.syncId || null, input.company, input.companyGuid || null, input.from, input.to, input.asOf || input.to, input.publicationMode || "replace", input.historyCoveredFrom || null);
      return res.json({ ok: true, sessionId, ...(input.syncJobId ? { syncJobId: input.syncJobId } : {}) });
    }
    if (action === "append") {
      const parsed = z.object({ action: z.literal("append"), sessionId: z.string(), field: z.string().min(1).max(80), sequence: z.number().int().min(0), content: z.string().max(6_000_000) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ ok: false, error: "Malformed chunk append request" });
      const input = parsed.data;
      const owner = db.prepare("SELECT * FROM tally_chunk_sessions WHERE id=? AND connector_id=? AND status='receiving'").get(input.sessionId, req.connector.id);
      if (!owner) return res.status(404).json({ ok: false, error: "Chunk session not found" });
      if (input.field === "vouchersXml") {
        const result = ingestVoucherChunk(owner, input.sequence, input.content);
        return res.json({ ok: true, sequence: input.sequence, processed: result });
      }
      db.prepare("INSERT INTO tally_chunk_parts (session_id,field_name,sequence,content) VALUES (?,?,?,?) ON CONFLICT(session_id,field_name,sequence) DO UPDATE SET content=excluded.content").run(input.sessionId, input.field, input.sequence, input.content);
      return res.json({ ok: true, sequence: input.sequence });
    }
    if (action === "finalize") {
      const parsed = z.object({ action: z.literal("finalize"), sessionId: z.string() }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ ok: false, error: "Malformed finalize request" });
      const session = db.prepare("SELECT * FROM tally_chunk_sessions WHERE id=? AND connector_id=? AND status='receiving'").get(parsed.data.sessionId, req.connector.id);
      if (!session) return res.status(404).json({ ok: false, error: "Chunk session not found" });
      const rows = db.prepare("SELECT field_name,content FROM tally_chunk_parts WHERE session_id=? AND field_name<>'vouchersXml' ORDER BY field_name,sequence").all(session.id);
      const fields = {}; for (const row of rows) fields[row.field_name] = (fields[row.field_name] || "") + row.content;
      if (!(session.voucher_chunks_received > 0) && !fields.dayBookReportXml && !fields.salesRegisterXml) return res.status(422).json({ ok: false, error: "Snapshot does not contain voucher or sales data" });
      if (session.voucher_carry && /<VOUCHER(?:\s|>)/i.test(session.voucher_carry)) return res.status(422).json({ ok: false, error: "The final voucher XML chunk is incomplete" });
      try {
        rebuildLiveSalesAggregates(session);
        const masterCounts = normalizeTallySnapshot(session, fields);
        const counts = {
          ...masterCounts,
          vouchers: session.voucher_rows_received || 0,
          invoices: session.invoice_rows_stored || 0,
          invoiceLines: session.invoice_lines_stored || 0,
          payments: session.payment_rows_stored || 0,
          purchases: session.purchase_rows_stored || 0,
          purchaseLines: session.purchase_lines_stored || 0,
        };
        const completed = iso(); const total = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
        transaction(() => {
          db.prepare("UPDATE tally_chunk_sessions SET status='stored',completed_at=? WHERE id=?").run(completed, session.id);
          db.prepare("UPDATE tally_invoices SET ingest_session_id=NULL WHERE ingest_session_id=?").run(session.id);
          db.prepare("UPDATE tally_payments_live SET ingest_session_id=NULL WHERE ingest_session_id=?").run(session.id);
          db.prepare("UPDATE tally_purchases SET ingest_session_id=NULL WHERE ingest_session_id=?").run(session.id);
          db.prepare("DELETE FROM tally_chunk_parts WHERE session_id=?").run(session.id);
          if (session.sync_job_id) db.prepare("UPDATE tally_sync_runs SET completed_at=?,status='stored',entity_counts_json=?,record_count=? WHERE id=? AND connector_id=?").run(completed, JSON.stringify(counts), total, session.sync_job_id, req.connector.id);
          db.prepare("UPDATE tally_connectors SET last_sync_at=?,status='online' WHERE id=?").run(completed, req.connector.id);
          db.prepare("INSERT INTO tally_import_metadata (key,value) VALUES ('last_import_at',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(completed);
          db.prepare("INSERT INTO tally_import_metadata (key,value) VALUES ('source',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(`Live Tally connector · ${session.company_name}`);
        });
        return res.json({ ok: true, sessionId: session.id, uploadMode: "resumable", counts });
      } catch (error) {
        db.prepare("UPDATE tally_chunk_sessions SET status='failed',completed_at=?,error_message=? WHERE id=?").run(iso(), error.message, session.id);
        if (session.sync_job_id) db.prepare("UPDATE tally_sync_runs SET completed_at=?,status='failed',error_message=? WHERE id=?").run(iso(), error.message, session.sync_job_id);
        throw error;
      }
    }
    res.status(400).json({ ok: false, error: "Unknown chunk action" });
  } catch (error) { next(error); }
});
