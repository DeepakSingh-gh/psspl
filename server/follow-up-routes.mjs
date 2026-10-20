import { Router } from "express";
import { randomUUID } from "node:crypto";
import { authenticate } from "./auth.mjs";
import { db, transaction } from "./db.mjs";
import { canAccessCustomer } from "./sales-routes.mjs";
import { isDateOnly } from "./field-activity.mjs";

export function createFollowUpRouter({ buildSalesDay }) {
  const router = Router();
  router.use(authenticate);

  router.delete("/:id", async (req, res, next) => {
    try {
      const result = db.prepare("DELETE FROM follow_ups WHERE id=? AND user_id=?").run(req.params.id, req.user.id);
      if (!result.changes) return res.status(404).json({ error: "Follow-up not found" });
      res.json(await buildSalesDay(req.user.id));
    } catch (error) { next(error); }
  });

  router.patch("/:id/toggle", async (req, res, next) => {
    try {
      const result = db.prepare("UPDATE follow_ups SET completed=CASE completed WHEN 1 THEN 0 ELSE 1 END WHERE id=? AND user_id=?").run(req.params.id, req.user.id);
      if (!result.changes) return res.status(404).json({ error: "Follow-up not found" });
      res.json(await buildSalesDay(req.user.id));
    } catch (error) { next(error); }
  });

  router.patch("/:id", async (req, res, next) => {
    try {
      const { notes, followUpType, completed, priority, dueDate } = req.body ?? {};
      if (dueDate !== undefined && !isDateOnly(dueDate)) return res.status(400).json({ error: "Enter a valid due date" });
      if (notes !== undefined && (typeof notes !== "string" || notes.length > 4000)) return res.status(400).json({ error: "Notes must be 4,000 characters or fewer" });
      if (!["call", "visit"].includes(followUpType ?? "call")) return res.status(400).json({ error: "Invalid follow-up type" });
      if (priority !== undefined && !["today", "high", "medium", "low", "overdue"].includes(priority)) return res.status(400).json({ error: "Invalid priority" });
      const exists = db.prepare("SELECT 1 FROM follow_ups WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
      if (!exists) return res.status(404).json({ error: "Follow-up not found" });
      transaction(() => {
        if (notes !== undefined) db.prepare("UPDATE follow_ups SET notes=? WHERE id=? AND user_id=?").run(notes, req.params.id, req.user.id);
        if (followUpType !== undefined) db.prepare("UPDATE follow_ups SET follow_up_type=? WHERE id=? AND user_id=?").run(followUpType, req.params.id, req.user.id);
        if (completed !== undefined) db.prepare("UPDATE follow_ups SET completed=? WHERE id=? AND user_id=?").run(completed ? 1 : 0, req.params.id, req.user.id);
        if (priority !== undefined) db.prepare("UPDATE follow_ups SET priority=? WHERE id=? AND user_id=?").run(priority, req.params.id, req.user.id);
        if (dueDate !== undefined) db.prepare("UPDATE follow_ups SET due_date=? WHERE id=? AND user_id=?").run(dueDate, req.params.id, req.user.id);
      });
      res.json(await buildSalesDay(req.user.id));
    } catch (error) { next(error); }
  });

  router.post("/", async (req, res, next) => {
    try {
      const { customerId, title, dueDate, priority, followUpType, notes } = req.body ?? {};
      if (typeof customerId !== "string" || !customerId || !title || !dueDate) return res.status(400).json({ error: "Customer, title, and due date are required" });
      if (typeof title !== "string" || title.length > 200 || !isDateOnly(dueDate)) return res.status(400).json({ error: "Enter a title up to 200 characters and a valid due date" });
      if (!canAccessCustomer(req.user.id, customerId)) return res.status(403).json({ error: "This customer is not assigned to you" });
      if (followUpType !== undefined && !["call", "visit"].includes(followUpType)) return res.status(400).json({ error: "Invalid follow-up type" });
      if (priority !== undefined && !["today", "high", "medium", "low", "overdue"].includes(priority)) return res.status(400).json({ error: "Invalid priority" });
      db.prepare("INSERT INTO follow_ups (id,user_id,tally_customer_id,title,due_date,priority,follow_up_type,notes) VALUES (?,?,?,?,?,?,?,?)").run(randomUUID(), req.user.id, customerId, title, dueDate, priority || "today", followUpType || "call", notes || null);
      res.json(await buildSalesDay(req.user.id));
    } catch (error) { next(error); }
  });
  return router;
}
