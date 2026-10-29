import test from 'node:test';
import assert from 'node:assert/strict';
import { presentAiAnswer } from '../server/ai-answer-presentation.mjs';

const snapshot = {
  scope: 'admin', period: { from: '2026-04-01', to: '2026-10-22' },
  data: { status: 'age-requires-review', lastCompletedAt: '2026-10-10T12:31:53.237Z', ageHours: 281.3 },
  sales: { salesValue: 180565444.28, invoiceCount: 1496 },
  rmPerformance: [
    { name: 'Rais Khan', performance: { actual: null, target: null, achievementPercent: null } },
    { name: 'Anil Jena', performance: { actual: 140136103.33, target: 30062000, achievementPercent: 466 } },
  ],
  pipeline: [{ stage: 'won', count: 1, value: 2000000000000 }],
  followUps: { pending: 0, overdue: 0, dueToday: 0 },
  visits: { completedInPeriod: 5, upcomingToday: 0, pastScheduled: 9 },
};

test('a named RM answer excludes company totals and other managers without guessing missing numbers or causes', () => {
  const { answer, presentation } = presentAiAnswer(snapshot, ['rmPerformance', 'sales', 'pipeline', 'visits'], 'Why are Rais Khan monthly sales below target?');
  assert.match(presentation.title, /Rais Khan/);
  assert.match(answer, /does not mean sales are zero/);
  assert.match(answer, /do not explain why/);
  assert.doesNotMatch(answer, /Anil Jena|180565444|crore|2000000000000|evidence:|age-requires-review/);
  assert.equal(presentation.sections.length, 2);
});

test('company summary keeps large amounts and zero counts clear and groups missing RM figures', () => {
  const { answer, presentation } = presentAiAnswer(snapshot, ['rmPerformance', 'sales', 'pipeline', 'followUps', 'visits'], 'Show the overall business summary');
  assert.equal(presentation.metrics[0].value, '₹18.06 crore');
  assert.deepEqual(presentation.missing, ['Rais Khan']);
  assert.match(answer, /₹2,00,000 crore/);
  assert.match(answer, /0 pending, 0 late and 0 due today/);
  assert.match(answer, /9 earlier planned visits need a status update/);
  assert.match(answer, /10 Oct 2026/);
  assert.doesNotMatch(answer, /no-show|281.3|authoritative|snapshot|\[evidence:/i);
});

test('recorded zero sales stay zero rather than becoming unavailable', () => {
  const data = { ...snapshot, rmPerformance: [{ name: 'Rais Khan', performance: { actual: 0, target: 100000, achievementPercent: 0 } }] };
  const { answer } = presentAiAnswer(data, ['rmPerformance'], 'Rais Khan sales');
  assert.match(answer, /sales ₹0; target ₹1 lakh/);
  assert.match(answer, /0% of target reached/);
  assert.doesNotMatch(answer, /sales and target numbers are missing/);
});
