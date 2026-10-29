import { randomUUID } from "node:crypto";

// Call inside the visit-completion transaction so the visit and pipeline entry
// are committed together. A later visit refreshes an active opportunity without
// resetting the stage selected by the RM.
export function upsertLeadFromCompletedVisit(db, visit, completion) {
  const customer = db.prepare("SELECT id,name,contact_name,phone,email,city FROM tally_customers WHERE id=?").get(visit.tally_customer_id);
  if (!customer) throw new Error("The visit customer is unavailable");
  const current = db.prepare("SELECT id FROM leads WHERE source_visit_id=?").get(visit.id)
    ?? db.prepare("SELECT id FROM leads WHERE user_id=? AND tally_customer_id=? AND source='Customer visit' AND stage NOT IN ('won','lost') ORDER BY created_at DESC LIMIT 1").get(visit.user_id, customer.id);
  if (current) {
    db.prepare("UPDATE leads SET interested_product_id=?,expected_value=CASE WHEN ?>0 THEN ? ELSE expected_value END,next_action_date=?,notes=? WHERE id=?")
      .run(completion.productId, completion.expectedOrderValue, completion.expectedOrderValue, completion.nextFollowUp, completion.notes || completion.outcome, current.id);
    return current.id;
  }
  const id = randomUUID();
  db.prepare(`INSERT INTO leads
    (id,user_id,name,company,phone,email,city,source,interested_product_id,stage,expected_value,next_action_date,notes,tally_customer_id,source_visit_id)
    VALUES (?,?,?,?,?,?,?,?,?,'lead',?,?,?,?,?)`)
    .run(id, visit.user_id, customer.contact_name || customer.name, customer.name, customer.phone, customer.email, customer.city,
      "Customer visit", completion.productId, completion.expectedOrderValue, completion.nextFollowUp, completion.notes || completion.outcome,
      customer.id, visit.id);
  return id;
}

export function completeVisitWithLead(db, transaction, visit, completion) {
  return transaction(() => {
    const updated = db.prepare("UPDATE visits SET status='completed',completed_at=?,outcome=?,notes=?,visit_tags=? WHERE id=? AND user_id=? AND status='in_progress'")
      .run(new Date().toISOString(), completion.outcome, completion.notes ?? null, JSON.stringify(completion.visitTags ?? []), visit.id, visit.user_id);
    if (!updated.changes) throw Object.assign(new Error("Visit has already been completed"), { status: 409 });
    db.prepare("DELETE FROM visit_products WHERE visit_id=?").run(visit.id);
    db.prepare("INSERT INTO visit_products (visit_id,tally_product_id) VALUES (?,?)").run(visit.id, completion.productId);
    if (completion.expectedOrderValue > 0) db.prepare("INSERT INTO expected_orders (id,visit_id,user_id,tally_customer_id,tally_product_id,expected_value,expected_date) VALUES (?,?,?,?,?,?,?)")
      .run(randomUUID(), visit.id, visit.user_id, visit.tally_customer_id, completion.productId, completion.expectedOrderValue, completion.expectedOrderDate || null);
    db.prepare("INSERT INTO follow_ups (id,user_id,visit_id,tally_customer_id,title,due_date,priority,follow_up_type,notes) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(randomUUID(), visit.user_id, visit.id, visit.tally_customer_id, `Follow up: ${completion.outcome}`, completion.nextFollowUp, "today", completion.nextFollowUpType || "call", completion.nextFollowUpNotes || completion.notes || null);
    return upsertLeadFromCompletedVisit(db, visit, completion);
  });
}
