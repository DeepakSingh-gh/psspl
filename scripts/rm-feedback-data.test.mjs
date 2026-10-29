import test from 'node:test';
import assert from 'node:assert/strict';
import { feedbackById, feedbackCatalog } from '../server/rm-feedback.mjs';
import { feedbackFinancials, feedAdminFeedback, feedRmFeedback } from '../src/lib/rm-feedback-data.ts';
import { achievementPercent } from '../shared/achievement.mjs';

const live = () => ({ from: '2026-10-01', to: '2026-10-21', ownershipMapping: 'ambiguous', kpi: { visitsCompleted: 3, actualSalesValue: null }, actualSales: [], reportingThresholds: { targetAlertPercent: 80, provisional: true }, managementInsights: [{ id: 'ownership-mapping' }], monthlyTargetVsActual: [] });


test('all RM snapshots feed existing financial fields with lakh-to-rupee conversion and their own identity', () => {
  for (const item of feedbackCatalog) {
    const snapshot = feedbackById(item.id);
    const source = live();
    const mapped = feedAdminFeedback(source, snapshot, 'month');
    const sep = snapshot.monthlyMetrics[5];
    assert.equal(mapped.kpi.actualSalesValue, sep.achieved == null ? null : Math.round(sep.achieved * 100000));
    assert.equal(mapped.kpi.targetValue, sep.target == null ? null : Math.round(sep.target * 100000));
    assert.equal(mapped.rmCode, snapshot.rm.rmCode);
    assert.equal(mapped.kpi.visitsCompleted, 3);
    assert.equal(mapped.ownershipMapping, 'ambiguous', 'PDF aggregates cannot verify live ownership');
    assert.deepEqual(mapped.actualSales, []);
    assert.equal(source.kpi.actualSalesValue, null, 'do not mutate cached live responses');
    assert.equal(mapped.monthlyTargetVsActual[6].actual, null);
    assert.equal(mapped.thrustProducts.totalYtdLakh, snapshot.thrustTotalLakh);
    assert.ok(mapped.thrustProducts.products.every(product => product.ytdSalesRupees == null));
  }
});

test('FYTD preserves the printed YTD denominator and percentage in original report cards', () => {
  const mapped = feedAdminFeedback({ ...live(), from: '2026-04-01' }, feedbackById('aniljena'), 'fytd');
  assert.equal(mapped.kpi.actualSalesValue, 11424000);
  assert.equal(mapped.kpi.targetValue, 25468000);
  assert.equal(mapped.kpi.achievementPercent, 45);
  assert.equal(mapped.monthlyPerformance.actual, 1985000);
  assert.equal(mapped.monthlyPerformance.achievementPercent, 43);
  assert.equal(mapped.managementInsights[0].period.to, '2026-09-30');
});

test('historical monthly aggregates never become today/week, another FY or a partial future month', () => {
  const snapshot = feedbackById('aniljena');
  for (const period of ['today', 'week']) {
    const source = live();
    const mapped = feedAdminFeedback(source, snapshot, period);
    assert.equal(mapped.kpi, source.kpi);
    assert.equal(mapped.monthlyTargetVsActual, source.monthlyTargetVsActual);
    assert.equal(mapped.reportSource, undefined);
    assert.equal(mapped.rmCode, snapshot.rm.rmCode);
  }
  assert.equal(feedbackFinancials(snapshot, '2027-04-01', '2027-04-30', 'month'), null);
  const august = feedbackFinancials(snapshot, '2026-09-01', '2026-09-15', 'month');
  assert.equal(august.selected.to, '2026-08-31');
  assert.equal(august.selected.actual, 2302000);
});

test('RM original Report Card receives own monthly figures while preserving operational activity', () => {
  const mapped = feedRmFeedback({ profile: { fullName: 'Ketan Bhat' }, period: { from: '2026-10-01', to: '2026-10-21' }, fieldActivity: { visitsTotal: 4 } }, feedbackById('ketanbhatt'));
  assert.equal(mapped.salesValue, Math.round(feedbackById('ketanbhatt').monthlyMetrics[5].achieved * 100000));
  assert.equal(mapped.profile.rmCode, '271704');
  assert.equal(mapped.fieldActivity.visitsTotal, 4);
  assert.match(mapped.periodLabel, /Sep 2026/);
});

test('all observed source percentages match actual divided by the appropriate target', () => {
  for (const item of feedbackCatalog) {
    const snapshot = feedbackById(item.id);
    const financials = feedbackFinancials(snapshot, '2026-04-01', '2026-10-21', 'fytd');
    assert.equal(financials.ytdPerformance.achievementPercent, achievementPercent(snapshot.annual.currentYearActual, snapshot.annual.currentYearTargetTillMonth));
    assert.equal(financials.annualPerformance.achievementPercent, achievementPercent(snapshot.annual.currentYearActual, snapshot.annual.currentYearTarget));
    assert.equal(snapshot.annual.currentYearPct, financials.ytdPerformance.achievementPercent);
    assert.equal(snapshot.annual.lastYearPct, achievementPercent(snapshot.annual.lastYearActual, snapshot.annual.lastYearTargetTillMonth));
    for (const month of snapshot.monthlyMetrics) {
      const actualPercent = financials.monthlyTargetVsActual.find(row => row.month === month.period).achievementPercent;
      if (month.achieved == null) assert.equal(actualPercent, null, 'missing actuals must not imply zero achievement');
      else assert.equal(actualPercent, month.pct, `${item.rm.name}: ${month.month}`);
    }
  }
});

test('Pradeep annual, FYTD and monthly percentages use distinct denominators and are never capped', () => {
  const financials = feedbackFinancials(feedbackById('pradeepmulik'), '2026-04-01', '2026-10-21', 'fytd');
  assert.equal(financials.annualPerformance.achievementPercent, 301);
  assert.equal(financials.ytdPerformance.achievementPercent, 593);
  assert.equal(financials.monthlyTargetVsActual[4].achievementPercent, 1461);
  assert.equal(financials.monthlyTargetVsActual[5].achievementPercent, 1030);
  assert.equal(financials.monthlyTargetVsActual[8].achievementPercent, null);
  assert.equal(achievementPercent(0, 100), 0);
  for (const [actual, target] of [[null, 100], [100, null], [100, 0], [100, -1], [NaN, 100]]) assert.equal(achievementPercent(actual, target), null);
});
