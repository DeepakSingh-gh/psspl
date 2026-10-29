import { Router } from "express";
import { z } from "zod";

// Fixed queries only; identifiers and ordering never come from request text.
const sections = {
  visits: { table: "visits", owner: "user_id", query: `SELECT v.id,v.business_date date,COALESCE(c.name,v.tally_customer_id) customer,v.purpose,v.status,v.outcome,v.notes FROM visits v LEFT JOIN tally_customers c ON c.id=v.tally_customer_id WHERE v.user_id=? ORDER BY v.business_date DESC,v.scheduled_at DESC,v.id` },
  leads: { table: "leads", owner: "user_id", query: `SELECT id,name,company,city,stage,expected_value expectedValue,next_action_date nextActionDate,notes,created_at createdAt FROM leads WHERE user_id=? ORDER BY created_at DESC,id` },
  followUps: { table: "follow_ups", owner: "user_id", query: `SELECT f.id,f.due_date dueDate,COALESCE(c.name,f.tally_customer_id) customer,f.title,f.priority,CASE WHEN f.completed=1 THEN 'Completed' ELSE 'Open' END status,f.notes FROM follow_ups f LEFT JOIN tally_customers c ON c.id=f.tally_customer_id WHERE f.user_id=? ORDER BY f.due_date DESC,f.id` },
  attendance: { table: "attendance", owner: "user_id", query: `SELECT id,business_date date,check_in_at checkInAt,check_out_at checkOutAt,latitude,longitude FROM attendance WHERE user_id=? ORDER BY business_date DESC,id` },
  activities: { table: "customer_activities", owner: "user_id", query: `SELECT a.id,a.occurred_at occurredAt,COALESCE(c.name,l.name,a.tally_customer_id,a.lead_id) customer,a.activity_type type,a.subject,a.notes FROM customer_activities a LEFT JOIN tally_customers c ON c.id=a.tally_customer_id LEFT JOIN leads l ON l.id=a.lead_id WHERE a.user_id=? ORDER BY a.occurred_at DESC,a.id` },
  requests: { table: "service_requests", owner: "user_id", query: `SELECT r.id,r.created_at createdAt,COALESCE(c.name,l.name,r.tally_customer_id,r.lead_id) customer,r.request_type type,r.details,r.status,r.due_date dueDate,r.responsible_person responsiblePerson FROM service_requests r LEFT JOIN tally_customers c ON c.id=r.tally_customer_id LEFT JOIN leads l ON l.id=r.lead_id WHERE r.user_id=? ORDER BY r.created_at DESC,r.id` },
  customers: { table: "tally_customers", owner: "owner_user_id", query: `SELECT id,name,city,outstanding FROM tally_customers WHERE owner_user_id=? ORDER BY name,id` },
  orders: { table: "expected_orders", owner: "user_id", query: `SELECT o.id,COALESCE(c.name,o.tally_customer_id) customer,COALESCE(p.name,o.tally_product_id) product,o.expected_value expectedValue,o.expected_date expectedDate,o.status FROM expected_orders o LEFT JOIN tally_customers c ON c.id=o.tally_customer_id LEFT JOIN tally_products p ON p.id=o.tally_product_id WHERE o.user_id=? ORDER BY o.created_at DESC,o.id` },
  reports: { table: "generated_reports", owner: "user_id", query: `SELECT id,report_type type,date_from dateFrom,date_to dateTo,created_at createdAt FROM generated_reports WHERE user_id=? ORDER BY created_at DESC,id` },
};
const sectionNames = Object.keys(sections);
const employeeQuery = `SELECT u.id,u.role,u.deleted_at deletedAt,p.full_name fullName,p.employee_code employeeCode,p.region,p.territory,p.manager_user_id managerUserId,m.full_name managerName
  FROM users u LEFT JOIN salesperson_profiles p ON p.user_id=u.id LEFT JOIN salesperson_profiles m ON m.user_id=p.manager_user_id`;

// Mounted behind adminRouter's existing authentication and admin-role middleware.
export function createArchivedUsersRouter(database) {
  const router = Router();
  const counts = (id) => Object.fromEntries(sectionNames.map(section => {
    const config = sections[section];
    return [section, database.prepare(`SELECT COUNT(*) count FROM ${config.table} WHERE ${config.owner}=?`).get(id).count];
  }));
  router.get("/", (_req, res, next) => {
    try {
      const items = database.prepare(`${employeeQuery} WHERE u.deleted_at IS NOT NULL ORDER BY u.deleted_at DESC,u.id`).all()
        .map(employee => ({ ...employee, counts: counts(employee.id) }));
      res.json({ items });
    } catch (error) { next(error); }
  });
  router.get("/:id/history", (req, res, next) => {
    try {
      const parsed = z.object({ section: z.enum(sectionNames).default("visits"), page: z.coerce.number().int().min(1).max(1_000_000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) }).safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: "Choose a valid history section and page" });
      const employee = database.prepare(`${employeeQuery} WHERE u.id=? AND u.deleted_at IS NOT NULL`).get(req.params.id);
      if (!employee) return res.status(404).json({ error: "Archived employee not found" });
      const { section, pageSize } = parsed.data;
      const totals = counts(employee.id);
      const total = totals[section];
      const pages = Math.max(1, Math.ceil(total / pageSize));
      const page = Math.min(parsed.data.page, pages);
      const items = database.prepare(`${sections[section].query} LIMIT ? OFFSET ?`).all(employee.id, pageSize, (page - 1) * pageSize);
      res.json({ employee: { ...employee, counts: totals }, section, items, total, page, pageSize, pages });
    } catch (error) { next(error); }
  });
  return router;
}
