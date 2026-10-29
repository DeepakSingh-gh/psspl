import test from 'node:test';
import assert from 'node:assert/strict';
import { rmMyDayEntries } from '../server/rm-my-day-entries.mjs';

test('saved inputs join by visit ID, retain extra orders and follow-ups, and never join by customer name', () => {
  const source = {
    'FROM visits v': [{ id: 'visit-1', customer: 'Acme', tally_customer_id: 'c1', purpose: 'Discussion', priority: 'high', products: 'Zinc', outcome: 'Interested', visit_tags: '["sample required"]', notes: 'Visit note' }],
    'FROM follow_ups f': [
      { id: 'f1', visit_id: 'visit-1', customer: 'Acme', due_date: '2026-10-25', follow_up_type: 'call', notes: 'Linked note', completed: 0 },
      { id: 'f2', visit_id: 'visit-1', customer: 'Acme', due_date: '2026-10-29', follow_up_type: 'visit', completed: 0 },
      { id: 'f3', visit_id: null, customer: 'Acme', due_date: '2026-10-30', follow_up_type: 'call', completed: 0 },
    ],
    'FROM expected_orders e': [
      { id: 'o1', visit_id: 'visit-1', customer: 'Acme', expected_value: 800000, expected_date: '2026-10-28' },
      { id: 'o2', visit_id: 'visit-1', customer: 'Acme', expected_value: 500000, expected_date: '2026-11-02' },
    ],
    'FROM leads l': [{ id: 'lead-1', name: 'Lead name', stage: 'quotation', notes: 'Lead note' }],
    'FROM customer_activities a': [{ id: 'a1', lead_id: 'lead-1', customer: null, subject: 'Call', notes: 'Call note' }],
    'FROM service_requests r': [],
  };
  const db = { prepare(sql) { return { all() { return Object.entries(source).find(([part]) => sql.includes(part))?.[1] ?? []; } }; } };
  const rows = rmMyDayEntries(db, { ids: ['rm-1'], from: '2026-10-01', asOf: '2026-10-23', available: true });
  assert.equal(rows.length, 6);
  assert.equal(rows.find(row => row.id === 'visit:visit-1').expectedValue, 800000);
  assert.equal(rows.find(row => row.id === 'visit:visit-1').followUpDate, '2026-10-25');
  assert.equal(rows.find(row => row.id === 'order:o2').expectedValue, 500000);
  assert.equal(rows.find(row => row.id === 'followup:f3').followUpDate, '2026-10-30');
  assert.equal(rows.find(row => row.id === 'activity:a1').leadStage, 'quotation');
  assert.equal(rows.find(row => row.id === 'visit:visit-1').leadStage, null);
  assert.deepEqual(rmMyDayEntries(db, { ids: ['rm-1'], from: '2026-10-01', asOf: '2026-10-23', available: false }), []);
});

test('current stage follows exact visit link and does not guess between two opportunities', () => {
  const source = {
    'FROM visits v': [
      { id: 'source-visit', user_id: 'rm-1', tally_customer_id: 'customer-1', customer: 'Acme', purpose: 'Visit' },
      { id: 'other-visit', user_id: 'rm-1', tally_customer_id: 'customer-1', customer: 'Acme', purpose: 'Visit' },
    ],
    'FROM leads l': [
      { id: 'first', user_id: 'rm-1', tally_customer_id: 'customer-1', source_visit_id: 'source-visit', stage: 'technical_discussion' },
      { id: 'second', user_id: 'rm-1', tally_customer_id: 'customer-1', source_visit_id: null, stage: 'quotation' },
    ],
  };
  const db = { prepare(sql) { return { all() { return Object.entries(source).find(([part]) => sql.includes(part))?.[1] ?? []; } }; } };
  const rows = rmMyDayEntries(db, { ids: ['rm-1'], from: '2026-10-01', asOf: '2026-10-23', available: true });
  assert.equal(rows.find(row => row.id === 'visit:source-visit').leadStage, 'technical_discussion');
  assert.equal(rows.find(row => row.id === 'visit:other-visit').leadStage, null);
});
