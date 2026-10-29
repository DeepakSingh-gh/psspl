/** Compact view of saved CRM inputs. Only database identifiers establish relationships. */
export function rmMyDayEntries(db, { ids, from, asOf, available }) {
  if (!available || !ids.length) return [];
  const slots = ids.map(() => '?').join(',');
  const read = (sql) => db.prepare(sql).all(...ids, from, asOf);
  const localDate = column => `date(${column},'+5 hours','+30 minutes')`;
  const customer = alias => `(SELECT name FROM tally_customers WHERE id=${alias}.tally_customer_id)`;
  const product = column => `(SELECT name FROM tally_products WHERE id=${column})`;
  const visits = read(`SELECT v.*,${customer('v')} customer,
    (SELECT group_concat(COALESCE(p.name,vp.tally_product_id),', ') FROM visit_products vp LEFT JOIN tally_products p ON p.id=vp.tally_product_id WHERE vp.visit_id=v.id) products
    FROM visits v WHERE v.user_id IN (${slots}) AND v.status='completed' AND v.business_date BETWEEN ? AND ? ORDER BY v.business_date DESC,v.scheduled_at DESC,v.id`);
  const followups = read(`SELECT f.*,${customer('f')} customer FROM follow_ups f
    WHERE f.user_id IN (${slots}) AND ${localDate('f.created_at')} BETWEEN ? AND ? ORDER BY f.created_at DESC,f.id`);
  const orders = read(`SELECT e.*,${customer('e')} customer,${product('e.tally_product_id')} product FROM expected_orders e
    WHERE e.user_id IN (${slots}) AND ${localDate('e.created_at')} BETWEEN ? AND ? ORDER BY e.created_at DESC,e.id`);
  const leads = read(`SELECT l.*,${product('l.interested_product_id')} product FROM leads l
    WHERE l.user_id IN (${slots}) AND ${localDate('l.created_at')} BETWEEN ? AND ? ORDER BY l.created_at DESC,l.id`);
  // Pipeline stage is a current status, so a lead created before the selected
  // report window must still be visible beside a visit in that window.
  const linkedLeads = db.prepare(`SELECT l.id,l.user_id,l.name,l.tally_customer_id,l.source_visit_id,l.stage
    FROM leads l WHERE l.user_id IN (${slots}) AND (l.source_visit_id IS NOT NULL OR l.tally_customer_id IS NOT NULL)`).all(...ids);
  const activities = read(`SELECT a.*,${customer('a')} customer FROM customer_activities a
    WHERE a.user_id IN (${slots}) AND ${localDate('a.occurred_at')} BETWEEN ? AND ? ORDER BY a.occurred_at DESC,a.id`);
  const requests = read(`SELECT r.*,${customer('r')} customer,${product('r.product_id')} product FROM service_requests r
    WHERE r.user_id IN (${slots}) AND ${localDate('r.created_at')} BETWEEN ? AND ? ORDER BY r.created_at DESC,r.id`);
  const leadById = new Map(leads.map(lead => [lead.id, lead]));
  const leadBySourceVisit = new Map(linkedLeads.filter(lead => lead.source_visit_id).map(lead => [lead.source_visit_id, lead]));
  const leadsByCustomer = new Map();
  for (const lead of linkedLeads) if (lead.tally_customer_id) {
    const key = `${lead.user_id}\u0000${lead.tally_customer_id}`;
    const group = leadsByCustomer.get(key) ?? [];
    group.push(lead); leadsByCustomer.set(key, group);
  }
  const linkedLead = record => {
    if (record.visit_id && leadBySourceVisit.has(record.visit_id)) return leadBySourceVisit.get(record.visit_id);
    if (record.id && leadBySourceVisit.has(record.id)) return leadBySourceVisit.get(record.id);
    if (!record.tally_customer_id) return null;
    const group = leadsByCustomer.get(`${record.user_id}\u0000${record.tally_customer_id}`) ?? [];
    // Multiple opportunities for one customer are ambiguous without a visit ID.
    return group.length === 1 ? group[0] : null;
  };
  const byVisit = (items) => {
    const map = new Map();
    for (const item of items) if (item.visit_id) {
      const group = map.get(item.visit_id) ?? [];
      group.push(item); map.set(item.visit_id, group);
    }
    return map;
  };
  const ordersByVisit = byVisit(orders), followupsByVisit = byVisit(followups);
  const attachedOrders = new Set(), attachedFollowups = new Set(), attachedLeads = new Set();
  const tags = value => { try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed.join(', ') : value; } catch { return value; } };
  const entry = (id, customerName, extra = {}) => ({ id, customer: customerName || null, purpose: null, priority: null, product: null, outcome: null, tags: null, expectedValue: null, expectedDate: null, followUpMode: null, followUpDate: null, notes: null, leadStage: null, ...extra });
  const rows = visits.map(visit => {
    const linkedOrders = ordersByVisit.get(visit.id) ?? [];
    const linkedFollowups = followupsByVisit.get(visit.id) ?? [];
    const order = linkedOrders[0], followup = linkedFollowups.find(f => !f.completed && f.due_date >= asOf) ?? linkedFollowups.find(f => !f.completed) ?? linkedFollowups[0];
    if (order) attachedOrders.add(order.id);
    if (followup) attachedFollowups.add(followup.id);
    const lead = linkedLead(visit);
    if (lead) attachedLeads.add(lead.id);
    return entry(`visit:${visit.id}`, visit.customer || visit.tally_customer_id, {
      purpose: visit.purpose, priority: visit.priority, product: visit.products, outcome: visit.outcome, tags: tags(visit.visit_tags),
      expectedValue: order?.expected_value ?? null, expectedDate: order?.expected_date ?? null,
      followUpMode: followup?.follow_up_type ?? null, followUpDate: followup?.due_date ?? null,
      notes: visit.notes, relatedNotes: followup?.notes ?? null,
      leadStage: lead?.stage ?? null,
    });
  });
  for (const order of orders) if (!attachedOrders.has(order.id)) rows.push(entry(`order:${order.id}`, order.customer || order.tally_customer_id, { product: order.product || order.tally_product_id, expectedValue: order.expected_value, expectedDate: order.expected_date, leadStage: linkedLead(order)?.stage ?? null }));
  for (const followup of followups) if (!attachedFollowups.has(followup.id)) rows.push(entry(`followup:${followup.id}`, followup.customer || followup.tally_customer_id, { purpose: followup.title, priority: ['high','medium','low'].includes(followup.priority) ? followup.priority : null, followUpMode: followup.follow_up_type, followUpDate: followup.due_date, notes: followup.notes, leadStage: linkedLead(followup)?.stage ?? null }));
  for (const lead of leads) if (!attachedLeads.has(lead.id)) rows.push(entry(`lead:${lead.id}`, lead.name, { product: lead.product, expectedValue: lead.expected_value, notes: lead.notes, leadStage: lead.stage }));
  for (const activity of activities) rows.push(entry(`activity:${activity.id}`, activity.customer || leadById.get(activity.lead_id)?.name, { purpose: activity.subject, notes: activity.notes, leadStage: leadById.get(activity.lead_id)?.stage ?? null }));
  for (const request of requests) rows.push(entry(`request:${request.id}`, request.customer || leadById.get(request.lead_id)?.name, { purpose: request.request_type, product: request.product, notes: request.details, leadStage: leadById.get(request.lead_id)?.stage ?? null }));
  return rows;
}
