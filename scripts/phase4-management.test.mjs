import test from "node:test";
import assert from "node:assert/strict";
import { rankRmPerformance, teamPerformanceMetric } from "../src/lib/admin-performance.ts";
import { calculateDealerConcentration, calculatePeriodPerformance, classifyDealerIntelligence, classifyPlannedVisits, dedupeManagementActions, tallySyncNeedsReview } from "../server/rm-report-intelligence.mjs";

const member = (id, name, achievementPercent, salesValue = 0) => ({
  id, name, achievementPercent, salesValue,
});

test("RM ranking uses achievement when every member has a target", () => {
  const rows = [member("low", "Low", 22, 900), member("high", "High", 91, 100), member("mid", "Mid", 54, 500)];
  assert.equal(teamPerformanceMetric(rows), "achievement");
  assert.deepEqual(rankRmPerformance(rows, "asc").map((row) => row.id), ["low", "mid", "high"]);
  assert.deepEqual(rankRmPerformance(rows, "desc").map((row) => row.id), ["high", "mid", "low"]);
});

test("mixed target coverage keeps known achievement ranking and lists missing targets last", () => {
  const rows = [member("top", "Top", 280, 14_010_000), member("zero", "Zero", null, 0), member("middle", "Middle", null, 500_000)];
  const before = structuredClone(rows);
  assert.equal(teamPerformanceMetric(rows), "achievement");
  assert.deepEqual(rankRmPerformance(rows, "asc").map((row) => row.id), ["top", "middle", "zero"]);
  assert.deepEqual(rankRmPerformance(rows, "desc").map((row) => row.id), ["top", "middle", "zero"]);
  assert.deepEqual(rows, before);
});

test("poor-to-good follows achievement rather than sales volume and keeps unknowns last in either direction", () => {
  const rows = [member('nazmul', 'Nazmul Islam', 140, 1049000), member('vijay', 'Vijay Nair', null, 0), member('anil', 'Anil Jena', 45, 11424000), member('zero', 'Zero target achievement', 0, 900000), member('unknown', 'Unknown', NaN, 2000000)];
  assert.deepEqual(rankRmPerformance(rows, 'asc').map(row => row.id), ['zero', 'anil', 'nazmul', 'unknown', 'vijay']);
  assert.deepEqual(rankRmPerformance(rows, 'desc').map(row => row.id), ['nazmul', 'anil', 'zero', 'unknown', 'vijay']);
});

test("no-target, negative and zero sales sort numerically with deterministic ties", () => {
  const rows = [member("z", "Zulu", null, 100), member("a", "Alpha", null, 100), member("zero", "Zero", null, 0), member("return", "Returns", null, -50)];
  assert.deepEqual(rankRmPerformance(rows, "asc").map((row) => row.id), ["return", "zero", "a", "z"]);
  assert.deepEqual(rankRmPerformance(rows, "desc").map((row) => row.id), ["a", "z", "zero", "return"]);
  assert.deepEqual(rankRmPerformance([]), []);
});

test("zero achievement is a valid score and unavailable sales stay last", () => {
  const rows = [member("good", "Good", 100, 10), member("zero", "Zero", 0, 999)];
  assert.equal(teamPerformanceMetric(rows), "achievement");
  assert.equal(rankRmPerformance(rows, "asc")[0].id, "zero");
  const missing = [member("unknown", "Unknown", null, NaN), member("known", "Known", null, 0)];
  for (const order of ["asc", "desc"]) assert.equal(rankRmPerformance(missing, order)[1].id, "unknown");
});

test("dealer concentration uses the top five actual attributed invoices and nulls empty totals", () => {
  const dealers = Array.from({ length: 6 }, (_, index) => ({ id: String(index), salesValue: [40, 30, 20, 10, 5, 95][index] }));
  const result = calculateDealerConcentration(dealers, 200);
  assert.deepEqual(result.topDealers.map((row) => row.id), ["5", "0", "1", "2", "3"]);
  assert.equal(result.topFiveRevenue, 195);
  assert.equal(result.topFivePercent, 97.5);
  assert.equal(calculateDealerConcentration(dealers, 0).topFivePercent, null);
});

test("dealer decline needs comparable prior invoice evidence; missing history is not decline", () => {
  const rows = classifyDealerIntelligence([
    { id: "decline", name: "Declining", salesValue: 40, previousSalesValue: 100, invoiceCount: 1, previousInvoiceCount: 1, historyInvoiceCount: 2 },
    { id: "no-history", name: "Unknown history", salesValue: 0, previousSalesValue: 0, invoiceCount: 0, previousInvoiceCount: 0, historyInvoiceCount: 0 },
  ], { periodFrom: "2026-04-01", periodTo: "2026-10-17", dormantDays: 90 });
  assert.equal(rows[0].declinePercent, 60);
  assert.equal(rows[1].declinePercent, null);
  assert.equal(rows[1].insufficientHistory, true);
});

test("MTD and FYTD metrics expose absent targets instead of estimating achievement", () => {
  assert.deepEqual(calculatePeriodPerformance(250, 500, "2026-10-01", "2026-10-17", "month-to-date"), {
    from: "2026-10-01", to: "2026-10-17", label: "month-to-date", actual: 250, target: 500, achievementPercent: 50,
  });
  assert.equal(calculatePeriodPerformance(250, 0, "2026-04-01", "2026-10-17", "FYTD").achievementPercent, null);
  assert.equal(calculatePeriodPerformance(null, 500, "2026-10-01", "2026-10-17", "month-to-date").actual, null);
});

test("planned visits become past-scheduled only after their saved time and stay distinct from pending", () => {
  const rows = classifyPlannedVisits([
    { id: "past", businessDate: "2026-10-16", scheduledAt: "2026-10-16T12:00:00.000Z", status: "planned" },
    { id: "pending", businessDate: "2026-10-17", scheduledAt: "2026-10-17T18:00:00.000Z", status: "planned" },
    { id: "done", businessDate: "2026-10-17", scheduledAt: "2026-10-17T09:00:00.000Z", status: "completed" },
  ], { asOf: "2026-10-17", now: "2026-10-17T15:00:00.000Z" });
  assert.equal(rows[0].pastScheduledTime, true);
  assert.equal(rows[1].pendingToday, true);
  assert.equal(rows[1].pastScheduledTime, false);
  assert.equal(rows[2].pastScheduledTime, false);
  assert.match(rows[0].attentionReason, /Confirm outcome/);
});

test("duplicate management findings with the same stable issue id are published once", () => {
  const items = [{ id: "dealer:d1", metric: "first" }, { id: "dealer:d1", metric: "duplicate" }, { id: "dealer:d2", metric: "separate" }];
  assert.deepEqual(dedupeManagementActions(items), [items[1], items[2]]);
});

test("Tally completion and failure states are distinguished without inventing a freshness SLA", () => {
  assert.equal(tallySyncNeedsReview(null), false);
  assert.equal(tallySyncNeedsReview({ status: "completed" }), false);
  assert.equal(tallySyncNeedsReview({ status: "stored" }), false);
  assert.equal(tallySyncNeedsReview({ status: "failed" }), true);
  assert.equal(tallySyncNeedsReview({ status: "running" }), true);
});
