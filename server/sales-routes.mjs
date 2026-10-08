import { Router } from "express";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import multer from "multer";
import { authenticate } from "./auth.mjs";
import { db } from "./db.mjs";
import { tally } from "./tally/connector.mjs";

mkdirSync("data/voice-notes", { recursive: true });
const voiceUpload = multer({ dest: "data/voice-notes/", limits: { fileSize: 25 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("audio/") || file.originalname.endsWith(".webm") || file.originalname.endsWith(".ogg")) });

export const salesRouter = Router();
salesRouter.use(authenticate);
const today = () => new Date().toISOString().slice(0, 10);
const canAccessCustomer = (userId, customerId) => Boolean(db.prepare(`
  SELECT 1 FROM tally_customers c LEFT JOIN salesperson_profiles self ON self.user_id=?
  WHERE c.id=? AND (c.owner_user_id=? OR c.owner_user_id IN (SELECT user_id FROM salesperson_profiles WHERE manager_user_id=?) OR (c.owner_user_id IS NULL AND lower(replace(COALESCE(c.rm_name,''),' ',''))=lower(replace(COALESCE(self.full_name,''),' ',''))))
`).get(userId, customerId, userId, userId));

salesRouter.post("/attendance/check-out", (req, res) => {
  const { latitude, longitude, accuracy } = req.body ?? {};
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) db.prepare("INSERT INTO location_pings (id,user_id,latitude,longitude,accuracy) VALUES (?,?,?,?,?)").run(randomUUID(), req.user.id, latitude, longitude, accuracy ?? null);
  db.prepare("UPDATE attendance SET check_out_at=? WHERE user_id=? AND business_date=?").run(new Date().toISOString(), req.user.id, today());
  res.json({ ok: true, checkedOutAt: new Date().toISOString() });
});
salesRouter.post("/location", (req, res) => {
  const { latitude, longitude, accuracy } = req.body ?? {};
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return res.status(400).json({ error: "Valid coordinates are required" });
  const active = db.prepare("SELECT id FROM attendance WHERE user_id=? AND business_date=? AND check_out_at IS NULL").get(req.user.id, today());
  if (!active) return res.status(409).json({ error: "Check in before sharing movement" });
  db.prepare("INSERT INTO location_pings (id,user_id,latitude,longitude,accuracy) VALUES (?,?,?,?,?)").run(randomUUID(), req.user.id, latitude, longitude, accuracy ?? null);
  res.json({ ok: true });
});
salesRouter.get("/movement", (req, res) => {
  const date = String(req.query.date || today());
  const attendance = db.prepare("SELECT check_in_at,check_out_at,latitude,longitude FROM attendance WHERE user_id=? AND business_date=?").get(req.user.id, date);
  const points = db.prepare("SELECT latitude,longitude,accuracy,captured_at FROM location_pings WHERE user_id=? AND date(captured_at)=? ORDER BY captured_at").all(req.user.id, date);
  res.json({ date, attendance: attendance ?? null, points, count: points.length });
});
salesRouter.post("/visits/unplanned", (req, res) => {
  const { customerId, purpose, scheduledAt, priority } = req.body ?? {};
  if (!customerId || !purpose) return res.status(400).json({ error: "Customer and purpose are required" });
  if (!canAccessCustomer(req.user.id, customerId)) return res.status(403).json({ error: "This customer is not assigned to you" });
  const id = randomUUID();
  db.prepare("INSERT INTO visits (id,user_id,business_date,tally_customer_id,scheduled_at,purpose,priority,status) VALUES (?,?,?,?,?,?,?,?)").run(id, req.user.id, today(), customerId, scheduledAt || new Date().toISOString(), purpose, priority || "medium", "planned");
  res.status(201).json({ id });
});

salesRouter.get("/customers", async (req, res) => {
  const q = String(req.query.q ?? "").toLowerCase(); const customers = await tally.customers({ salespersonId: req.user.id });
  const filtered = customers.filter((c) => !q || `${c.name} ${c.city} ${c.type} ${c.rmName}`.toLowerCase().includes(q));
  res.json(filtered.slice(0, 100));
});
salesRouter.get("/customers/:id", (req, res) => {
  if (!canAccessCustomer(req.user.id, req.params.id)) return res.status(403).json({ error: "This customer is not assigned to you" });
  const customer = db.prepare("SELECT * FROM tally_customers WHERE id=?").get(req.params.id);
  if (!customer) return res.status(404).json({ error: "Customer not found" });
  const monthlySales = db.prepare("SELECT period,amount FROM tally_customer_monthly_sales WHERE customer_id=? ORDER BY period").all(req.params.id);
  const visits = db.prepare("SELECT id,business_date,purpose,outcome,notes,status,completed_at FROM visits WHERE tally_customer_id=? ORDER BY business_date DESC").all(req.params.id);
  const activities = db.prepare("SELECT * FROM customer_activities WHERE tally_customer_id=? ORDER BY occurred_at DESC").all(req.params.id);
  const requests = db.prepare("SELECT * FROM service_requests WHERE tally_customer_id=? ORDER BY created_at DESC").all(req.params.id);
  res.json({ customer, monthlySales, visits, activities, requests });
});
salesRouter.post("/activities", (req, res) => {
  const { customerId, leadId, activityType, subject, notes } = req.body ?? {};
  if (!activityType || !subject) return res.status(400).json({ error: "Activity type and subject are required" });
  if (customerId && !canAccessCustomer(req.user.id, customerId)) return res.status(403).json({ error: "This customer is not assigned to you" });
  const id = randomUUID(); db.prepare("INSERT INTO customer_activities (id,user_id,tally_customer_id,lead_id,activity_type,subject,notes) VALUES (?,?,?,?,?,?,?)").run(id, req.user.id, customerId || null, leadId || null, activityType, subject, notes || null);
  res.status(201).json({ id });
});

salesRouter.get("/leads", (req, res) => res.json(db.prepare("SELECT * FROM leads WHERE user_id=? ORDER BY created_at DESC").all(req.user.id)));
salesRouter.post("/leads", (req, res) => {
  const { name, company, phone, email, city, source, interestedProductId, expectedValue, nextActionDate, notes } = req.body ?? {};
  if (!name) return res.status(400).json({ error: "Lead name is required" });
  const id = randomUUID(); db.prepare("INSERT INTO leads (id,user_id,name,company,phone,email,city,source,interested_product_id,expected_value,next_action_date,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(id, req.user.id, name, company || null, phone || null, email || null, city || null, source || null, interestedProductId || null, Number(expectedValue || 0), nextActionDate || null, notes || null);
  res.status(201).json({ id });
});
salesRouter.patch("/leads/:id/stage", (req, res) => {
  const allowed = ["lead", "technical_discussion", "sample", "quotation", "follow_up", "expected_order", "won", "lost"];
  if (!allowed.includes(req.body?.stage)) return res.status(400).json({ error: "Invalid pipeline stage" });
  db.prepare("UPDATE leads SET stage=? WHERE id=? AND user_id=?").run(req.body.stage, req.params.id, req.user.id); res.json({ ok: true });
});
salesRouter.patch("/leads/:id", (req, res) => {
  const { name, company, phone, email, city, source, interestedProductId, expectedValue, nextActionDate, notes } = req.body ?? {};
  db.prepare("UPDATE leads SET name=COALESCE(?,name),company=?,phone=?,email=?,city=?,source=?,interested_product_id=?,expected_value=COALESCE(?,expected_value),next_action_date=?,notes=? WHERE id=? AND user_id=?")
    .run(name||null, company||null, phone||null, email||null, city||null, source||null, interestedProductId||null, expectedValue!=null?Number(expectedValue):null, nextActionDate||null, notes||null, req.params.id, req.user.id);
  res.json({ ok: true });
});
salesRouter.get("/leads/:id", (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
  if (!lead) return res.status(404).json({ error: "Lead not found" });
  const activities = db.prepare("SELECT * FROM customer_activities WHERE lead_id=? ORDER BY occurred_at DESC").all(req.params.id);
  res.json({ lead, activities });
});

salesRouter.get("/requests", (req, res) => res.json(db.prepare("SELECT r.*,c.name customer_name,l.name lead_name,p.name product_name FROM service_requests r LEFT JOIN tally_customers c ON c.id=r.tally_customer_id LEFT JOIN leads l ON l.id=r.lead_id LEFT JOIN tally_products p ON p.id=r.product_id WHERE r.user_id=? ORDER BY CASE r.status WHEN 'open' THEN 0 ELSE 1 END,r.due_date").all(req.user.id)));
salesRouter.post("/requests", (req, res) => {
  const { customerId, leadId, requestType, productId, details, responsiblePerson, dueDate } = req.body ?? {};
  if (!requestType || !details) return res.status(400).json({ error: "Request type and details are required" });
  if (customerId && !canAccessCustomer(req.user.id, customerId)) return res.status(403).json({ error: "This customer is not assigned to you" });
  const id = randomUUID(); db.prepare("INSERT INTO service_requests (id,user_id,tally_customer_id,lead_id,request_type,product_id,details,responsible_person,due_date) VALUES (?,?,?,?,?,?,?,?,?)").run(id, req.user.id, customerId || null, leadId || null, requestType, productId || null, details, responsiblePerson || null, dueDate || null);
  res.status(201).json({ id });
});
salesRouter.patch("/requests/:id/status", (req, res) => { db.prepare("UPDATE service_requests SET status=? WHERE id=? AND user_id=?").run(req.body?.status === "closed" ? "closed" : "open", req.params.id, req.user.id); res.json({ ok: true }); });

salesRouter.get("/alerts", (req, res) => {
  const overdueFollowUps = db.prepare("SELECT f.id,f.title,f.due_date,c.name customer FROM follow_ups f LEFT JOIN tally_customers c ON c.id=f.tally_customer_id WHERE f.user_id=? AND f.completed=0 AND f.due_date<?").all(req.user.id, today());
  const overdueOrders = db.prepare("SELECT e.id,e.expected_date,e.expected_value,c.name customer,p.name product FROM expected_orders e LEFT JOIN tally_customers c ON c.id=e.tally_customer_id LEFT JOIN tally_products p ON p.id=e.tally_product_id WHERE e.user_id=? AND e.status='open' AND e.expected_date<?").all(req.user.id, today());
  const overdueRequests = db.prepare("SELECT id,request_type,due_date,details FROM service_requests WHERE user_id=? AND status='open' AND due_date<?").all(req.user.id, today());
  res.json({ overdueFollowUps, overdueOrders, overdueRequests });
});

salesRouter.get("/reports/activity", (req, res) => {
  const from = String(req.query.from || today()), to = String(req.query.to || today());
  const visits = db.prepare("SELECT v.business_date,v.status,v.purpose,v.outcome,v.notes,c.name customer FROM visits v LEFT JOIN tally_customers c ON c.id=v.tally_customer_id WHERE v.user_id=? AND v.business_date BETWEEN ? AND ? ORDER BY v.business_date").all(req.user.id, from, to);
  const expectedOrders = db.prepare("SELECT e.expected_value,e.expected_date,e.status,c.name customer,p.name product FROM expected_orders e LEFT JOIN tally_customers c ON c.id=e.tally_customer_id LEFT JOIN tally_products p ON p.id=e.tally_product_id WHERE e.user_id=? AND date(e.created_at) BETWEEN ? AND ?").all(req.user.id, from, to);
  const activities = db.prepare("SELECT activity_type,subject,notes,occurred_at FROM customer_activities WHERE user_id=? AND date(occurred_at) BETWEEN ? AND ?").all(req.user.id, from, to);
  const result = { from, to, visits, expectedOrders, activities, summary: { visits: visits.length, completed: visits.filter((v) => v.status === "completed").length, expectedValue: expectedOrders.reduce((sum, e) => sum + e.expected_value, 0) } };
  const id = randomUUID(); db.prepare("INSERT INTO generated_reports (id,user_id,report_type,date_from,date_to,payload_json) VALUES (?,?,?,?,?,?)").run(id, req.user.id, "salesperson_activity", from, to, JSON.stringify(result));
  res.json({ id, ...result });
});
salesRouter.get("/reports/history", (req, res) => res.json(db.prepare("SELECT id,report_type,date_from,date_to,created_at FROM generated_reports WHERE user_id=? ORDER BY created_at DESC LIMIT 25").all(req.user.id)));

salesRouter.post("/visits/:id/voice-note", voiceUpload.single("audio"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Audio file required (max 25 MB)" });
  db.prepare("UPDATE visits SET voice_note_path=? WHERE id=? AND user_id=?").run(req.file.path, req.params.id, req.user.id);
  res.json({ ok: true, path: req.file.path });
});

salesRouter.post("/ask-ai", async (req, res) => {
  const question = String(req.body?.question || "").trim();
  if (!question) return res.status(400).json({ error: "Enter a question" });
  try {
    const { buildContext, buildSystemPrompt, askOpenAI } = await import("./ai-context.mjs");
    const contextJson = await buildContext(req.user.id, "salesperson");
    const answer = await askOpenAI(buildSystemPrompt(contextJson), question);
    res.json({ question, answer, source: "PSSPL CRM & Tally data via AI" });
  } catch (err) {
    res.status(500).json({ error: "Ask AI encountered an error" });
  }
});
