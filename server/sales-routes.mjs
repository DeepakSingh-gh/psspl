import { reminderSummary } from "./reminder-summary.mjs";
import { aiLimiter, askAiHandler } from "./ai-answer.mjs";
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import multer from "multer";
import { authenticate } from "./auth.mjs";
import { db, transaction } from "./db.mjs";
import { tally } from "./tally/connector.mjs";
import { indiaBusinessDate, isDateOnly, validateLocation } from "./field-activity.mjs";

mkdirSync("data/voice-notes", { recursive: true });
const voiceUpload = multer({ dest: "data/voice-notes/", limits: { fileSize: 25 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, ["audio/webm", "audio/ogg", "audio/wav", "audio/mpeg", "audio/mp4", "audio/aac"].includes(file.mimetype)) });

export const salesRouter = Router();
salesRouter.use(authenticate);
const today = () => indiaBusinessDate();

/**
 * Names in the RM directory are useful reporting aliases, not authoritative
 * customer ownership. Only account relationships in salesperson_profiles may
 * grant access; a NULL customer owner is never treated as an assignment.
 */
const getCustomerRecordUserIds = (userId) => {
  const user = db.prepare("SELECT role FROM users WHERE id=? AND active=1").get(userId);
  if (!user) return [];
  if (user.role === "admin") return db.prepare("SELECT id FROM users").all().map((row) => row.id);
  if (user.role === "rm") {
    return [userId, ...db.prepare("SELECT user_id FROM salesperson_profiles WHERE manager_user_id=?").all(userId).map((row) => row.user_id)];
  }
  // Salespeople can see their own customer activity. Their RM gets team access
  // through the RM routes, which use the explicit reporting relationship.
  return [userId];
};

export const canAccessCustomer = (userId, customerId) => {
  const user = db.prepare("SELECT role FROM users WHERE id=? AND active=1").get(userId);
  if (!user) return false;
  if (user.role === "admin") return Boolean(db.prepare("SELECT 1 FROM tally_customers WHERE id=?").get(customerId));
  const userIds = getCustomerRecordUserIds(userId);
  if (!userIds.length) return false;
  const placeholders = userIds.map(() => "?").join(",");
  return Boolean(db.prepare(`SELECT 1 FROM tally_customers WHERE id=? AND owner_user_id IN (${placeholders})`).get(customerId, ...userIds));
};

const getLeadAccessUserIds = (userId) => {
  const user = db.prepare("SELECT role FROM users WHERE id=? AND active=1").get(userId);
  if (!user) return [];
  if (user.role === "admin") return db.prepare("SELECT id FROM users WHERE active=1").all().map((row) => row.id);
  if (user.role === "rm") return [userId, ...db.prepare("SELECT user_id FROM salesperson_profiles WHERE manager_user_id=?").all(userId).map((row) => row.user_id)];
  return [userId];
};
const canAccessLead = (userId, leadId) => getLeadAccessUserIds(userId).includes(db.prepare("SELECT user_id FROM leads WHERE id=?").get(leadId)?.user_id);

salesRouter.post("/attendance/check-out", (req, res) => {
  const currentDate = today();
  const attendance = db.prepare("SELECT id,check_out_at FROM attendance WHERE user_id=? AND business_date=?").get(req.user.id, currentDate);
  if (!attendance) return res.status(409).json({ error: "Check in before checking out" });
  if (attendance.check_out_at) return res.status(409).json({ error: "You are already checked out for today" });
  const location = req.body?.latitude === undefined && req.body?.longitude === undefined ? null : validateLocation(req.body);
  if (location && !location.ok) return res.status(400).json({ error: location.error });
  const checkedOutAt = new Date().toISOString();
  transaction(() => {
    if (location) db.prepare("INSERT INTO location_pings (id,user_id,latitude,longitude,accuracy) VALUES (?,?,?,?,?)").run(randomUUID(), req.user.id, location.latitude, location.longitude, location.accuracy);
    db.prepare("UPDATE attendance SET check_out_at=? WHERE id=? AND check_out_at IS NULL").run(checkedOutAt, attendance.id);
  });
  res.json({ ok: true, checkedOutAt, gpsCaptured: Boolean(location), gpsAccuracyMeters: location?.accuracy ?? null });
});
salesRouter.post("/location", (req, res) => {
  const location = validateLocation(req.body);
  if (!location.ok) return res.status(400).json({ error: location.error });
  const active = db.prepare("SELECT id FROM attendance WHERE user_id=? AND business_date=? AND check_out_at IS NULL").get(req.user.id, today());
  if (!active) return res.status(409).json({ error: "Check in before sharing movement" });
  db.prepare("INSERT INTO location_pings (id,user_id,latitude,longitude,accuracy) VALUES (?,?,?,?,?)").run(randomUUID(), req.user.id, location.latitude, location.longitude, location.accuracy);
  res.json({ ok: true, gpsCaptured: true, gpsAccuracyMeters: location.accuracy });
});
salesRouter.get("/movement", (req, res) => {
  const date = String(req.query.date || today());
  const attendance = db.prepare("SELECT check_in_at,check_out_at,latitude,longitude FROM attendance WHERE user_id=? AND business_date=?").get(req.user.id, date);
  const points = db.prepare("SELECT latitude,longitude,accuracy,captured_at FROM location_pings WHERE user_id=? AND date(captured_at)=? ORDER BY captured_at").all(req.user.id, date);
  res.json({ date, attendance: attendance ?? null, points, count: points.length });
});
salesRouter.post("/visits/unplanned", (req, res) => {
  const { customerId, purpose, scheduledAt, priority } = req.body ?? {};
  if (typeof customerId !== "string" || !customerId || !purpose) return res.status(400).json({ error: "Customer and purpose are required" });
  if (typeof purpose !== "string" || purpose.length > 200 || (scheduledAt !== undefined && (typeof scheduledAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(scheduledAt) || !isDateOnly(scheduledAt.slice(0, 10)) || !Number.isFinite(Date.parse(scheduledAt)))) || (priority !== undefined && !["high", "medium", "low"].includes(priority))) return res.status(400).json({ error: "Enter a valid purpose, schedule, and priority" });
  if (!canAccessCustomer(req.user.id, customerId)) return res.status(403).json({ error: "This customer is not assigned to you" });
  const id = randomUUID();
  const plannedAt = scheduledAt || new Date().toISOString();
  const businessDate = scheduledAt ? scheduledAt.slice(0, 10) : today();
  db.prepare("INSERT INTO visits (id,user_id,business_date,tally_customer_id,scheduled_at,purpose,priority,status) VALUES (?,?,?,?,?,?,?,?)").run(id, req.user.id, businessDate, customerId, plannedAt, purpose.trim(), priority || "medium", "planned");
  res.status(201).json({ id });
});

salesRouter.get("/customers", async (req, res) => {
  const q = String(req.query.q ?? "").toLowerCase(); const customers = await tally.customers({ salespersonId: req.user.id });
  const filtered = customers.filter((c) => !q || `${c.name} ${c.city} ${c.type} ${c.rmName}`.toLowerCase().includes(q));
  res.json(filtered);
});
salesRouter.get("/customers/:id", (req, res) => {
  if (!canAccessCustomer(req.user.id, req.params.id)) return res.status(403).json({ error: "This customer is not assigned to you" });
  const customer = db.prepare("SELECT * FROM tally_customers WHERE id=?").get(req.params.id);
  if (!customer) return res.status(404).json({ error: "Customer not found" });
  const accessibleUserIds = getCustomerRecordUserIds(req.user.id);
  const userPlaceholders = accessibleUserIds.map(() => "?").join(",");
  const monthlySales = db.prepare("SELECT period,amount FROM tally_customer_monthly_sales WHERE customer_id=? ORDER BY period").all(req.params.id);
  const visits = db.prepare(`SELECT id,business_date,purpose,outcome,notes,status,completed_at,started_at,scheduled_at,latitude,longitude FROM visits WHERE tally_customer_id=? AND user_id IN (${userPlaceholders}) ORDER BY business_date DESC`).all(req.params.id, ...accessibleUserIds);
  const activities = db.prepare(`SELECT * FROM customer_activities WHERE tally_customer_id=? AND user_id IN (${userPlaceholders}) ORDER BY occurred_at DESC`).all(req.params.id, ...accessibleUserIds);
  const requests = db.prepare(`SELECT * FROM service_requests WHERE tally_customer_id=? AND user_id IN (${userPlaceholders}) ORDER BY created_at DESC`).all(req.params.id, ...accessibleUserIds);
  res.json({ customer, monthlySales, visits, activities, requests });
});
salesRouter.post("/activities", (req, res) => {
  const { customerId, leadId, activityType, subject, notes } = req.body ?? {};
  if (!activityType || !subject) return res.status(400).json({ error: "Activity type and subject are required" });
  if (customerId && !canAccessCustomer(req.user.id, customerId)) return res.status(403).json({ error: "This customer is not assigned to you" });
  if (leadId && !canAccessLead(req.user.id, leadId)) return res.status(404).json({ error: "Lead not found" });
  const id = randomUUID(); db.prepare("INSERT INTO customer_activities (id,user_id,tally_customer_id,lead_id,activity_type,subject,notes) VALUES (?,?,?,?,?,?,?)").run(id, req.user.id, customerId || null, leadId || null, activityType, subject, notes || null);
  res.status(201).json({ id });
});

// A call is a user-entered customer interaction, not telephony-verified evidence.
salesRouter.post("/calls", (req, res) => {
  const { customerId, direction, purpose, outcome, notes, followUpDate, occurredAt } = req.body ?? {};
  if (typeof customerId !== "string" || !customerId || !["incoming", "outgoing"].includes(direction) || typeof purpose !== "string" || !purpose.trim() || purpose.length > 200 || typeof outcome !== "string" || !outcome.trim() || outcome.length > 500 || (notes !== undefined && (typeof notes !== "string" || notes.length > 4000))) {
    return res.status(400).json({ error: "Customer, call direction, purpose, and outcome are required" });
  }
  if (!canAccessCustomer(req.user.id, customerId)) return res.status(403).json({ error: "This customer is not assigned to you" });
  if (occurredAt !== undefined && typeof occurredAt !== "string") return res.status(400).json({ error: "Call date and time are invalid" });
  const timestamp = occurredAt === undefined ? new Date() : new Date(occurredAt);
  if (!Number.isFinite(timestamp.getTime())) return res.status(400).json({ error: "Call date and time are invalid" });
  if (followUpDate !== undefined && !isDateOnly(followUpDate)) return res.status(400).json({ error: "Follow-up date must be a valid YYYY-MM-DD date" });
  const id = randomUUID();
  transaction(() => {
    db.prepare("INSERT INTO customer_activities (id,user_id,tally_customer_id,activity_type,subject,notes,occurred_at) VALUES (?,?,?,?,?,?,?)")
      .run(id, req.user.id, customerId, `call_${direction}`, String(purpose).trim(), [String(outcome).trim(), String(notes ?? "").trim()].filter(Boolean).join(" — ") || null, timestamp.toISOString());
    if (followUpDate) db.prepare("INSERT INTO follow_ups (id,user_id,tally_customer_id,title,due_date,priority,follow_up_type,notes) VALUES (?,?,?,?,?,?,?,?)")
      .run(randomUUID(), req.user.id, customerId, `Call follow-up: ${String(purpose).trim()}`, followUpDate, "today", "call", String(notes ?? "").trim() || null);
  });
  res.status(201).json({ id, occurredAt: timestamp.toISOString(), verifiedByTelephony: false });
});

salesRouter.get("/leads", (req, res) => {
  const ownerIds = getLeadAccessUserIds(req.user.id);
  if (!ownerIds.length) return res.json([]);
  const placeholders = ownerIds.map(() => "?").join(",");
  res.json(db.prepare(`SELECT * FROM leads WHERE user_id IN (${placeholders}) ORDER BY created_at DESC`).all(...ownerIds));
});
salesRouter.get("/leads/assignees", (req, res) => {
  const ids = getLeadAccessUserIds(req.user.id);
  if (!ids.length) return res.json([]);
  const placeholders = ids.map(() => "?").join(",");
  res.json(db.prepare(`SELECT u.id userId,u.role,COALESCE(p.full_name,u.email) name FROM users u LEFT JOIN salesperson_profiles p ON p.user_id=u.id WHERE u.active=1 AND u.id IN (${placeholders}) AND u.role IN ('rm','salesperson') ORDER BY p.full_name,u.email`).all(...ids));
});
salesRouter.get("/leads/report/conversion", (req, res) => {
  const ownerIds = getLeadAccessUserIds(req.user.id);
  if (!ownerIds.length) return res.json({ total: 0, stages: [], won: 0, lost: 0, conversionPercent: null });
  const placeholders = ownerIds.map(() => "?").join(",");
  const stages = db.prepare(`SELECT stage,COUNT(*) count FROM leads WHERE user_id IN (${placeholders}) GROUP BY stage`).all(...ownerIds);
  const counts = Object.fromEntries(stages.map(({ stage, count }) => [stage, count]));
  const total = stages.reduce((sum, row) => sum + row.count, 0);
  const won = counts.won ?? 0, lost = counts.lost ?? 0;
  const decided = won + lost;
  res.json({ total, stages, won, lost, conversionPercent: decided ? Math.round((won / decided) * 1000) / 10 : null });
});
salesRouter.post("/leads", (req, res) => {
  const { name, company, phone, email, city, source, interestedProductId, expectedValue, nextActionDate, notes } = req.body ?? {};
  if (typeof name !== "string" || !name.trim() || name.length > 200) return res.status(400).json({ error: "Lead name is required (maximum 200 characters)" });
  if (expectedValue !== undefined && (!Number.isFinite(Number(expectedValue)) || Number(expectedValue) < 0)) return res.status(400).json({ error: "Expected value must be a non-negative number" });
  if (nextActionDate && !isDateOnly(nextActionDate)) return res.status(400).json({ error: "Next action date must be a valid YYYY-MM-DD date" });
  const id = randomUUID(); db.prepare("INSERT INTO leads (id,user_id,name,company,phone,email,city,source,interested_product_id,expected_value,next_action_date,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(id, req.user.id, name.trim(), company || null, phone || null, email || null, city || null, source || null, interestedProductId || null, Number(expectedValue || 0), nextActionDate || null, notes || null);
  res.status(201).json({ id });
});
salesRouter.patch("/leads/:id/stage", (req, res) => {
  const allowed = ["lead", "technical_discussion", "sample", "quotation", "follow_up", "expected_order", "won", "lost"];
  if (!allowed.includes(req.body?.stage)) return res.status(400).json({ error: "Invalid pipeline stage" });
  if (!canAccessLead(req.user.id, req.params.id)) return res.status(404).json({ error: "Lead not found" });
  const current = db.prepare("SELECT stage FROM leads WHERE id=?").get(req.params.id);
  if (current.stage !== req.body.stage) transaction(() => {
    db.prepare("UPDATE leads SET stage=? WHERE id=?").run(req.body.stage, req.params.id);
    db.prepare("INSERT INTO lead_stage_history(id,lead_id,actor_user_id,previous_stage,new_stage) VALUES(?,?,?,?,?)")
      .run(randomUUID(), req.params.id, req.user.id, current.stage, req.body.stage);
  });
  res.json({ ok: true });
});
salesRouter.patch("/leads/:id/assignment", (req, res) => {
  if (!canAccessLead(req.user.id, req.params.id)) return res.status(404).json({ error: "Lead not found" });
  const actor = db.prepare("SELECT role FROM users WHERE id=? AND active=1").get(req.user.id);
  if (!actor || !["admin", "rm"].includes(actor.role)) return res.status(403).json({ error: "Only admins and team managers can assign leads" });
  const targetId = req.body?.userId;
  const target = db.prepare("SELECT u.id,u.role,u.active,p.manager_user_id FROM users u LEFT JOIN salesperson_profiles p ON p.user_id=u.id WHERE u.id=?").get(targetId);
  if (!target || !target.active || !["rm", "salesperson"].includes(target.role)) return res.status(400).json({ error: "Choose an active RM or salesperson" });
  if (actor.role === "rm" && target.id !== req.user.id && target.manager_user_id !== req.user.id) return res.status(403).json({ error: "Leads can only be assigned within your team" });
  db.prepare("UPDATE leads SET user_id=? WHERE id=?").run(target.id, req.params.id);
  res.json({ ok: true, userId: target.id });
});
salesRouter.patch("/leads/:id", (req, res) => {
  if (!canAccessLead(req.user.id, req.params.id)) return res.status(404).json({ error: "Lead not found" });
  const { name, company, phone, email, city, source, interestedProductId, expectedValue, nextActionDate, notes } = req.body ?? {};
  const result = db.prepare("UPDATE leads SET name=COALESCE(?,name),company=?,phone=?,email=?,city=?,source=?,interested_product_id=?,expected_value=COALESCE(?,expected_value),next_action_date=?,notes=? WHERE id=? AND user_id=?")
    .run(name||null, company||null, phone||null, email||null, city||null, source||null, interestedProductId||null, expectedValue!=null?Number(expectedValue):null, nextActionDate||null, notes||null, req.params.id, db.prepare("SELECT user_id FROM leads WHERE id=?").get(req.params.id).user_id);
  if (!result.changes) return res.status(404).json({ error: "Lead not found" });
  res.json({ ok: true });
});
salesRouter.delete("/leads/:id", (req, res) => {
  if (!canAccessLead(req.user.id, req.params.id)) return res.status(404).json({ error: "Lead not found" });
  transaction(() => {
    db.prepare("UPDATE customer_activities SET lead_id=NULL WHERE lead_id=?").run(req.params.id);
    db.prepare("UPDATE service_requests SET lead_id=NULL WHERE lead_id=?").run(req.params.id);
    db.prepare("DELETE FROM leads WHERE id=?").run(req.params.id);
  });
  res.json({ ok: true });
});
salesRouter.get("/leads/:id", (req, res) => {
  if (!canAccessLead(req.user.id, req.params.id)) return res.status(404).json({ error: "Lead not found" });
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead not found" });
  const activities = db.prepare("SELECT * FROM customer_activities WHERE lead_id=? ORDER BY occurred_at DESC").all(req.params.id);
  const history = db.prepare("SELECT h.previous_stage,h.new_stage,h.changed_at,h.actor_user_id,u.email actor_email FROM lead_stage_history h JOIN users u ON u.id=h.actor_user_id WHERE h.lead_id=? ORDER BY h.changed_at,h.rowid").all(req.params.id);
  res.json({ lead, activities, history });
});

salesRouter.get("/requests", (req, res) => res.json(db.prepare("SELECT r.*,c.name customer_name,l.name lead_name,p.name product_name FROM service_requests r LEFT JOIN tally_customers c ON c.id=r.tally_customer_id LEFT JOIN leads l ON l.id=r.lead_id LEFT JOIN tally_products p ON p.id=r.product_id WHERE r.user_id=? ORDER BY CASE r.status WHEN 'open' THEN 0 ELSE 1 END,r.due_date").all(req.user.id)));
salesRouter.post("/requests", (req, res) => {
  const { customerId, leadId, requestType, productId, details, responsiblePerson, dueDate } = req.body ?? {};
  if (!requestType || !details) return res.status(400).json({ error: "Request type and details are required" });
  if (customerId && (typeof customerId !== "string" || !canAccessCustomer(req.user.id, customerId))) return res.status(403).json({ error: "This customer is not assigned to you" });
  if (leadId && !canAccessLead(req.user.id, leadId)) return res.status(404).json({ error: "Lead not found" });
  const id = randomUUID(); db.prepare("INSERT INTO service_requests (id,user_id,tally_customer_id,lead_id,request_type,product_id,details,responsible_person,due_date) VALUES (?,?,?,?,?,?,?,?,?)").run(id, req.user.id, customerId || null, leadId || null, requestType, productId || null, details, responsiblePerson || null, dueDate || null);
  res.status(201).json({ id });
});
salesRouter.patch("/requests/:id/status", (req, res) => { const result = db.prepare("UPDATE service_requests SET status=? WHERE id=? AND user_id=?").run(req.body?.status === "closed" ? "closed" : "open", req.params.id, req.user.id); if (!result.changes) return res.status(404).json({ error: "Request not found" }); res.json({ ok: true }); });

salesRouter.get("/alerts", (req, res) => {
  const pastScheduledVisits = db.prepare("SELECT v.id,v.business_date,v.scheduled_at,v.status,v.purpose,c.name customer FROM visits v LEFT JOIN tally_customers c ON c.id=v.tally_customer_id WHERE v.user_id=? AND v.status IN ('planned','in_progress') AND v.business_date<? ORDER BY v.business_date,v.scheduled_at").all(req.user.id, today());
  const overdueFollowUps = db.prepare("SELECT f.id,f.title,f.due_date,c.name customer FROM follow_ups f LEFT JOIN tally_customers c ON c.id=f.tally_customer_id WHERE f.user_id=? AND f.completed=0 AND f.due_date<?").all(req.user.id, today());
  const overdueOrders = db.prepare("SELECT e.id,e.expected_date,e.expected_value,c.name customer,p.name product FROM expected_orders e LEFT JOIN tally_customers c ON c.id=e.tally_customer_id LEFT JOIN tally_products p ON p.id=e.tally_product_id WHERE e.user_id=? AND e.status='open' AND e.expected_date<?").all(req.user.id, today());
  const overdueRequests = db.prepare("SELECT id,request_type,due_date,details FROM service_requests WHERE user_id=? AND status='open' AND due_date<?").all(req.user.id, today());
  res.json({ reminders: reminderSummary(db, req.user.id), pastScheduledVisits, overdueFollowUps, overdueOrders, overdueRequests });
});

salesRouter.get("/reports/activity", (req, res) => {
  const from = String(req.query.from || today()), to = String(req.query.to || today());
  if (!isDateOnly(from) || !isDateOnly(to) || from > to) return res.status(400).json({ error: "Choose valid report dates in chronological order" });
  const visits = db.prepare("SELECT v.business_date,v.status,v.purpose,v.outcome,v.notes,c.name customer FROM visits v LEFT JOIN tally_customers c ON c.id=v.tally_customer_id WHERE v.user_id=? AND v.business_date BETWEEN ? AND ? ORDER BY v.business_date").all(req.user.id, from, to);
  const expectedOrders = db.prepare("SELECT e.expected_value,e.expected_date,e.status,c.name customer,p.name product FROM expected_orders e LEFT JOIN tally_customers c ON c.id=e.tally_customer_id LEFT JOIN tally_products p ON p.id=e.tally_product_id WHERE e.user_id=? AND date(e.created_at,'+5 hours','+30 minutes') BETWEEN ? AND ?").all(req.user.id, from, to);
  const activities = db.prepare("SELECT activity_type,subject,notes,occurred_at FROM customer_activities WHERE user_id=? AND date(occurred_at,'+5 hours','+30 minutes') BETWEEN ? AND ?").all(req.user.id, from, to);
  const result = { from, to, visits, expectedOrders, activities, summary: { visits: visits.length, completed: visits.filter((v) => v.status === "completed").length, calls: activities.filter((activity) => ["call", "call_incoming", "call_outgoing"].includes(activity.activity_type)).length, expectedValue: expectedOrders.reduce((sum, e) => sum + e.expected_value, 0) } };
  const id = randomUUID(); db.prepare("INSERT INTO generated_reports (id,user_id,report_type,date_from,date_to,payload_json) VALUES (?,?,?,?,?,?)").run(id, req.user.id, "salesperson_activity", from, to, JSON.stringify(result));
  res.json({ id, ...result });
});
salesRouter.get("/reports/history", (req, res) => res.json(db.prepare("SELECT id,report_type,date_from,date_to,created_at FROM generated_reports WHERE user_id=? ORDER BY created_at DESC LIMIT 25").all(req.user.id)));

salesRouter.post("/visits/:id/voice-note", (req, res, next) => {
  if (!db.prepare("SELECT 1 FROM visits WHERE id=? AND user_id=?").get(req.params.id, req.user.id)) return res.status(404).json({ error: "Visit not found" });
  next();
}, voiceUpload.single("audio"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Audio file required (max 25 MB)" });
  const result = db.prepare("UPDATE visits SET voice_note_path=? WHERE id=? AND user_id=?").run(req.file.path, req.params.id, req.user.id);
  if (!result.changes) { try { unlinkSync(req.file.path); } catch {} return res.status(404).json({ error: "Visit not found" }); }
  res.status(201).json({ ok: true });
});
salesRouter.get("/visits/:id/voice-note", (req, res) => {
  const visit = db.prepare("SELECT user_id,voice_note_path FROM visits WHERE id=?").get(req.params.id);
  if (!visit || !visit.voice_note_path || !getCustomerRecordUserIds(req.user.id).includes(visit.user_id)) return res.status(404).json({ error: "Voice note not found" });
  if (!existsSync(visit.voice_note_path)) return res.status(404).json({ error: "Voice note file is unavailable" });
  res.setHeader("Cache-Control", "no-store");
  res.download(visit.voice_note_path, "visit-recording", (error) => {
    if (error && !res.headersSent) res.status(500).json({ error: "Unable to read voice note" });
  });
});

salesRouter.post("/ask-ai", aiLimiter, askAiHandler);
