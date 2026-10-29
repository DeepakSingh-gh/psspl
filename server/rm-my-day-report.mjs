/** Saved field inputs; scope is supplied by the authenticated RM report resolver. */
export function rmMyDayTables(db, { ids, from, asOf, available }) {
  const slots = ids.length ? ids.map(() => '?').join(',') : "''";
  const params = [...ids, from, asOf];
  const read = (sql) => available ? db.prepare(sql).all(...params) : [];
  const date = column => `date(${column},'+5 hours','+30 minutes')`;
  const person = alias => `(SELECT full_name FROM salesperson_profiles WHERE user_id=${alias}.user_id)`;
  const customer = alias => `(SELECT name FROM tally_customers WHERE id=${alias}.tally_customer_id)`;
  const product = column => `(SELECT name FROM tally_products WHERE id=${column})`;
  const note = 'Saved CRM inputs in the selected period, through the displayed cutoff. Text and status are current stored values, not a reconstructed historical state.';
  const table = (id, title, columns, rows) => ({ id, title, columns, rows, note });
  const tags = value => { try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed.join(', ') : value; } catch { return value; } };
  const visits = read(`SELECT v.*,${person('v')} executive,${customer('v')} customer,
    (SELECT group_concat(COALESCE(p.name,vp.tally_product_id),', ') FROM visit_products vp LEFT JOIN tally_products p ON p.id=vp.tally_product_id WHERE vp.visit_id=v.id) products
    FROM visits v WHERE v.user_id IN (${slots}) AND v.business_date BETWEEN ? AND ? ORDER BY v.business_date DESC,v.scheduled_at DESC,v.id`);
  const activities = read(`SELECT a.*,${person('a')} executive,${customer('a')} customer,
    (SELECT name FROM leads WHERE id=a.lead_id) lead FROM customer_activities a
    WHERE a.user_id IN (${slots}) AND ${date('a.occurred_at')} BETWEEN ? AND ? ORDER BY a.occurred_at DESC,a.id`);
  const followups = read(`SELECT f.*,${person('f')} executive,${customer('f')} customer,
    (SELECT full_name FROM salesperson_profiles WHERE user_id=f.assigned_to_user_id) assignee
    FROM follow_ups f WHERE f.user_id IN (${slots}) AND ${date('f.created_at')} BETWEEN ? AND ? ORDER BY f.created_at DESC,f.id`);
  const orders = read(`SELECT e.*,${person('e')} executive,${customer('e')} customer,${product('e.tally_product_id')} product
    FROM expected_orders e WHERE e.user_id IN (${slots}) AND ${date('e.created_at')} BETWEEN ? AND ? ORDER BY e.created_at DESC,e.id`);
  const requests = read(`SELECT r.*,${person('r')} executive,${customer('r')} customer,${product('r.product_id')} product,
    (SELECT name FROM leads WHERE id=r.lead_id) lead FROM service_requests r
    WHERE r.user_id IN (${slots}) AND ${date('r.created_at')} BETWEEN ? AND ? ORDER BY r.created_at DESC,r.id`);
  const leads = read(`SELECT l.*,${person('l')} executive,${product('l.interested_product_id')} product FROM leads l
    WHERE l.user_id IN (${slots}) AND ${date('l.created_at')} BETWEEN ? AND ? ORDER BY l.created_at DESC,l.id`);
  const attendance = read(`SELECT a.*,${person('a')} executive,
    (SELECT lp.accuracy FROM location_pings lp WHERE lp.user_id=a.user_id AND ${date('lp.captured_at')}=a.business_date ORDER BY lp.captured_at,lp.id LIMIT 1) gps_accuracy_meters FROM attendance a
    WHERE a.user_id IN (${slots}) AND a.business_date BETWEEN ? AND ? ORDER BY a.business_date DESC,a.id`);
  return [
    table('input-visits','Visits',['Customer','Executive','Visit date','Scheduled at','Purpose','Priority','Products discussed','Recorded outcome','Discussion notes','Visit tags','Recorded status','Started at','Completed at','Latitude','Longitude','Voice note'],visits.map(v=>[v.customer ?? v.tally_customer_id,v.executive,v.business_date,v.scheduled_at,v.purpose,v.priority,v.products,v.outcome,v.notes,tags(v.visit_tags),v.status,v.started_at,v.completed_at,v.latitude,v.longitude,v.voice_note_path?'Recorded':'Not recorded'])),
    table('input-activities','Calls & interactions',['Customer','Executive','Recorded at','Interaction type','Purpose / subject','Outcome & notes','Lead'],activities.map(a=>[a.customer,a.executive,a.occurred_at,a.activity_type,a.subject,a.notes,a.lead])),
    table('input-followups','Follow-ups',['Customer','Executive','Created at','Title','Follow-up mode','Due date','Priority','Discussion notes','Recorded status','Assigned to','Linked visit'],followups.map(f=>[f.customer,f.executive,f.created_at,f.title,f.follow_up_type,f.due_date,f.priority,f.notes,f.completed?'Completed':'Open',f.assignee,f.visit_id])),
    table('input-orders','Expected orders',['Customer','Executive','Created at','Product','Expected value','Expected date','Recorded status','Linked visit'],orders.map(e=>[e.customer,e.executive,e.created_at,e.product ?? e.tally_product_id,e.expected_value,e.expected_date,e.status,e.visit_id])),
    table('input-requests','Service requests',['Customer','Executive','Created at','Request type','Product','Details','Responsible person','Due date','Recorded status','Lead'],requests.map(r=>[r.customer,r.executive,r.created_at,r.request_type,r.product,r.details,r.responsible_person,r.due_date,r.status,r.lead])),
    table('input-leads','Leads',['Name','Executive','Created at','Company','Phone','Email','City','Source','Interested product','Expected value','Next action date','Notes','Recorded stage'],leads.map(l=>[l.name,l.executive,l.created_at,l.company,l.phone,l.email,l.city,l.source,l.product,l.expected_value,l.next_action_date,l.notes,l.stage])),
    table('input-attendance','Attendance',['Executive','Business date','Check-in at','Recorded check-out at','Latitude','Longitude','GPS accuracy (m)'],attendance.map(a=>[a.executive,a.business_date,a.check_in_at,a.check_out_at,a.latitude,a.longitude,a.gps_accuracy_meters ?? null])),
  ];
}

/** Operational summary for the explicitly separate CRM entry window. */
export function rmMyDaySummary(tables, { asOf, available }) {
  const rows = id => tables.find(t=>t.id===id)?.rows ?? [];
  const value = (id,row,column) => row[tables.find(t=>t.id===id).columns.indexOf(column)];
  const visits=rows('input-visits'), followups=rows('input-followups'), orders=rows('input-orders');
  const open=followups.filter(row=>value('input-followups',row,'Recorded status')==='Open');
  const completed=visits.filter(row=>{
    const timestamp=value('input-visits',row,'Completed at');
    if(value('input-visits',row,'Recorded status')!=='completed'||!timestamp)return false;
    const date=new Date(/[Zz]$|[+-]\d{2}:\d{2}$/.test(timestamp)?timestamp:`${timestamp.replace(' ','T')}Z`);
    return Number.isFinite(date.getTime())&&new Date(date.getTime()+19800000).toISOString().slice(0,10)<=asOf;
  });
  return {
    visitsPlanned:available?visits.length:null,visitsCompleted:available?completed.length:null,
    callsLogged:available?rows('input-activities').filter(row=>['call','call_incoming','call_outgoing'].includes(value('input-activities',row,'Interaction type'))).length:null,
    followUpsOpen:available?open.length:null,followUpsOverdue:available?open.filter(row=>value('input-followups',row,'Due date')<asOf).length:null,
    expectedOrdersValue:available?orders.filter(row=>value('input-orders',row,'Recorded status')==='open').reduce((sum,row)=>sum+Number(value('input-orders',row,'Expected value')??0),0):null,
  };
}
