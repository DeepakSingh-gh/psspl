import test from "node:test";
import assert from "node:assert/strict";
import { buildRmManagementInsights, classifyDealerIntelligence, rmReportThresholds } from "../server/rm-report-intelligence.mjs";

test("dealer intelligence separates dormant, no-period-sales, decline and insufficient history", () => {
  const rows = classifyDealerIntelligence([
    { id: "d1", name: "Dormant 1", firstInvoiceDate: "2024-01-01", lastInvoiceDate: "2025-01-01", historyInvoiceCount: 4, invoiceCount: 0, previousInvoiceCount: 0 },
    { id: "d2", name: "Dormant 2", firstInvoiceDate: "2023-01-01", lastInvoiceDate: "2025-06-01", historyInvoiceCount: 8, invoiceCount: 0, previousInvoiceCount: 0 },
    { id: "quiet", name: "No Period Sales", firstInvoiceDate: "2026-01-01", lastInvoiceDate: "2026-08-01", historyInvoiceCount: 3, invoiceCount: 0, previousInvoiceCount: 1, previousSalesValue: 100, salesValue: 0 },
    { id: "decline", name: "Declining", firstInvoiceDate: "2025-01-01", lastInvoiceDate: "2026-10-01", historyInvoiceCount: 12, invoiceCount: 1, previousInvoiceCount: 1, previousSalesValue: 100, salesValue: 50 },
    { id: "new", name: "Insufficient History", firstInvoiceDate: "2026-10-01", lastInvoiceDate: "2026-10-01", historyInvoiceCount: 1, invoiceCount: 1, salesValue: 10 },
    { id: "none", name: "No Invoice History", historyInvoiceCount: 0, invoiceCount: 0 },
  ], { periodFrom: "2026-10-01", periodTo: "2026-10-17", dormantDays: 90 });
  assert.equal(rows.filter((row) => row.dormant).length, 2);
  assert.equal(rows.find((row) => row.id === "quiet").noSalesInPeriod, true);
  assert.equal(rows.find((row) => row.id === "quiet").dormant, false);
  assert.equal(rows.find((row) => row.id === "decline").declinePercent, 50);
  assert.equal(rows.find((row) => row.id === "new").insufficientHistory, true);
  assert.equal(rows.find((row) => row.id === "none").insufficientHistory, true);
});

test("synthetic 19 percent target and 96 percent dealer concentration produce sourced insights", () => {
  const thresholds = rmReportThresholds({});
  const insights = buildRmManagementInsights({
    name: "Synthetic RM", period: { from: "2026-10-01", to: "2026-10-31" },
    monthlyPerformance: { achievementPercent: 19, label: "month-to-date" }, ytdPerformance: null,
    topFiveDealerConcentrationPercent: 96, activeDealerCount: 6, dormantCount: 2,
    decliningCount: 1, overdueFollowUps: 3, visitCompletionPercent: 55,
    ownershipMapping: "verified", thresholds,
  });
  assert.equal(insights.find((item) => item.id === "target-achievement").metric, "19% of month-to-date target");
  assert.equal(insights.find((item) => item.id === "dealer-concentration").metric, "96% of attributed sales from the top five dealers");
  assert.match(insights.find((item) => item.id === "dormant-dealers").metric, /2 dealers/);
  assert.equal(insights.every((item) => item.period.from === "2026-10-01" && item.href), true);
  assert.equal(insights.every((item) => item.thresholdsProvisional), true);
});

test("missing targets and ownership mappings never become estimated underperformance", () => {
  const thresholds = rmReportThresholds({});
  const missingTarget = buildRmManagementInsights({
    name: "No Target RM", period: { from: "2026-10-01", to: "2026-10-31" },
    monthlyPerformance: { achievementPercent: null, label: "month-to-date" }, ytdPerformance: null,
    ownershipMapping: "verified", thresholds,
  });
  assert.equal(missingTarget.some((item) => item.id === "target-achievement"), false);
  const unmapped = buildRmManagementInsights({
    name: "Unmapped RM", period: { from: "2026-10-01", to: "2026-10-31" },
    monthlyPerformance: { achievementPercent: 19, label: "month-to-date" }, ytdPerformance: null,
    ownershipMapping: "unmapped", thresholds,
  });
  assert.equal(unmapped.length, 1);
  assert.equal(unmapped[0].id, "ownership-mapping");
  assert.equal(unmapped[0].href, null);
});

test("threshold configuration is provisional when values are missing or invalid", () => {
  const configured = rmReportThresholds({
    RM_DORMANT_INACTIVITY_DAYS: "120", RM_TARGET_ALERT_PERCENT: "85",
    RM_DEALER_CONCENTRATION_ALERT_PERCENT: "75", RM_VISIT_COMPLETION_ALERT_PERCENT: "65",
  });
  assert.equal(configured.provisional, false);
  const invalid = rmReportThresholds({
    RM_DORMANT_INACTIVITY_DAYS: "0", RM_TARGET_ALERT_PERCENT: "85",
    RM_DEALER_CONCENTRATION_ALERT_PERCENT: "75", RM_VISIT_COMPLETION_ALERT_PERCENT: "65",
  });
  assert.equal(invalid.dormantDays, 90);
  assert.equal(invalid.provisional, true);
});
