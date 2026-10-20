const boundedInteger = (raw, fallback, min, max) => {
  const value = Number(raw);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
};

export function rmReportThresholds(env = process.env) {
  const dormantDays = boundedInteger(env.RM_DORMANT_INACTIVITY_DAYS, 90, 30, 730);
  const targetAlertPercent = boundedInteger(env.RM_TARGET_ALERT_PERCENT, 80, 1, 200);
  const concentrationAlertPercent = boundedInteger(env.RM_DEALER_CONCENTRATION_ALERT_PERCENT, 70, 1, 100);
  const visitCompletionAlertPercent = boundedInteger(env.RM_VISIT_COMPLETION_ALERT_PERCENT, 70, 1, 100);
  const isConfigured = (raw, min, max) => Number.isInteger(Number(raw)) && Number(raw) >= min && Number(raw) <= max;
  return {
    dormantDays, targetAlertPercent, concentrationAlertPercent, visitCompletionAlertPercent,
    provisional: !isConfigured(env.RM_DORMANT_INACTIVITY_DAYS, 30, 730)
      || !isConfigured(env.RM_TARGET_ALERT_PERCENT, 1, 200)
      || !isConfigured(env.RM_DEALER_CONCENTRATION_ALERT_PERCENT, 1, 100)
      || !isConfigured(env.RM_VISIT_COMPLETION_ALERT_PERCENT, 1, 100),
  };
}

export function classifyDealerIntelligence(rows, { periodFrom, periodTo, dormantDays = 90 } = {}) {
  const dormantCutoff = periodTo ? new Date(Date.parse(`${periodTo}T00:00:00Z`) - dormantDays * 86400000).toISOString().slice(0, 10) : null;
  return rows.map((row) => {
    const currentSales = Number(row.salesValue) || 0;
    const previousSales = Number(row.previousSalesValue) || 0;
    const historyCount = Number(row.historyInvoiceCount) || 0;
    const first = row.firstInvoiceDate;
    const last = row.lastInvoiceDate;
    const enoughHistoryForTrend = Boolean(previousSales > 0 && row.previousInvoiceCount > 0);
    const noSalesInPeriod = historyCount > 0 && Number(row.invoiceCount) === 0;
    const dormant = Boolean(dormantCutoff && last && last < dormantCutoff && first && first <= dormantCutoff);
    const insufficientHistory = historyCount === 0 || (!enoughHistoryForTrend && !dormant);
    const declining = enoughHistoryForTrend && currentSales < previousSales;
    return {
      id: row.id, name: row.name, dealerName: row.name, city: row.city ?? null,
      salesValue: currentSales, previousSalesValue: previousSales,
      invoiceCount: Number(row.invoiceCount) || 0,
      previousInvoiceCount: Number(row.previousInvoiceCount) || 0,
      historyInvoiceCount: historyCount, firstInvoiceDate: first ?? null, lastInvoiceDate: last ?? null,
      declinePercent: declining ? Number((((previousSales - currentSales) / Math.abs(previousSales)) * 100).toFixed(1)) : null,
      noSalesInPeriod, dormant, insufficientHistory,
      followUpOpportunity: noSalesInPeriod ? "Review account and schedule a customer follow-up." : null,
      periodFrom, periodTo,
    };
  });
}

export function calculatePeriodPerformance(actual, target, from, to, label) {
  const actualValue = actual == null ? null : Number(actual);
  const targetValue = target == null || Number(target) <= 0 ? null : Number(target);
  return {
    from, to, label, actual: actualValue, target: targetValue,
    achievementPercent: actualValue != null && targetValue != null ? Math.round((actualValue / targetValue) * 100) : null,
  };
}

export function calculateDealerConcentration(rows, totalSales) {
  const topDealers = [...rows].filter((row) => Number(row.salesValue) > 0).sort((a, b) => Number(b.salesValue) - Number(a.salesValue)).slice(0, 5);
  const topFiveRevenue = topDealers.reduce((sum, row) => sum + Number(row.salesValue), 0);
  const total = Number(totalSales);
  return {
    topDealers, topFiveRevenue,
    topFivePercent: Number.isFinite(total) && total > 0 ? Number(((topFiveRevenue / total) * 100).toFixed(1)) : null,
  };
}

export function classifyPlannedVisits(rows, { asOf, now }) {
  return rows.map((row) => {
    const completed = row.status === "completed";
    const scheduledTime = Date.parse(String(row.scheduledAt ?? ""));
    const currentTime = Date.parse(now);
    const pastScheduledTime = !completed && (row.businessDate < asOf
      || (row.businessDate === asOf && Number.isFinite(scheduledTime) && scheduledTime <= currentTime));
    return {
      ...row, completed,
      pastScheduledTime,
      pendingToday: !completed && row.businessDate === asOf,
      // A scheduled time passing proves the visit is outstanding, not why it was missed.
      attentionReason: pastScheduledTime ? "Scheduled time passed; visit is not recorded complete. Confirm outcome with owner." : null,
    };
  });
}

export function dedupeManagementActions(actions) {
  return [...new Map(actions.map((item) => [item.id, item])).values()];
}

export function tallySyncNeedsReview(latestRun) {
  return Boolean(latestRun && !["completed", "stored"].includes(latestRun.status));
}

export function buildRmManagementInsights({
  name, period, monthlyPerformance, ytdPerformance, topFiveDealerConcentrationPercent,
  activeDealerCount, dormantCount, decliningCount, overdueFollowUps, visitCompletionPercent,
  decliningProductCount = 0, ownershipMapping, thresholds,
}) {
  const insights = [];
  const add = (id, severity, metric, title, action, href, insightPeriod = period) => insights.push({ id, severity, rmName: name, period: insightPeriod, metric, title, action, href, thresholdsProvisional: thresholds.provisional });
  if (ownershipMapping !== "verified") {
    add("ownership-mapping", "data", "RM/team ownership mapping is not uniquely verified", "Sales attribution unavailable", "Resolve the RM-to-CRM user and team mapping before using this report for performance decisions.", null);
    return insights;
  }
  const performance = monthlyPerformance?.achievementPercent != null ? monthlyPerformance : ytdPerformance?.achievementPercent != null ? ytdPerformance : null;
  if (performance?.achievementPercent != null && performance.achievementPercent < thresholds.targetAlertPercent) {
    add("target-achievement", "high", `${performance.achievementPercent}% of ${performance.label} target`, "Target achievement below review threshold", "Review the qualified pipeline and agree on account-level recovery actions with the RM.", `/admin/team?search=${encodeURIComponent(name)}`, { from: performance.from ?? period.from, to: performance.to ?? period.to });
  }
  if (topFiveDealerConcentrationPercent != null && topFiveDealerConcentrationPercent >= thresholds.concentrationAlertPercent && activeDealerCount > 0) {
    add("dealer-concentration", "medium", `${topFiveDealerConcentrationPercent}% of attributed sales from the top five dealers`, "Revenue concentration needs review", "Review continuity plans for the leading accounts and assess diversification opportunities.", `/admin/customers?search=${encodeURIComponent(name)}`);
  }
  if (decliningCount > 0) add("declining-dealers", "medium", `${decliningCount} dealers declined against the prior comparable period`, "Dealer purchases declined", "Review the affected dealer accounts and document verified order or service issues.", `/admin/customers?search=${encodeURIComponent(name)}`);
  if (decliningProductCount > 0) add("declining-products", "medium", `${decliningProductCount} products declined against the prior comparable period`, "Product revenue declined", "Review affected product demand with the RM and confirm customer feedback before changing inventory or sales plans.", `/admin/team?search=${encodeURIComponent(name)}`);
  if (dormantCount > 0) add("dormant-dealers", "medium", `${dormantCount} dealers crossed the configured ${thresholds.dormantDays}-day invoice inactivity threshold`, "Dormant dealers require review", "Schedule account reviews for dealers with verified historical invoices.", `/admin/customers?search=${encodeURIComponent(name)}`);
  if (overdueFollowUps > 0) add("overdue-followups", "high", `${overdueFollowUps} overdue follow-ups`, "Customer follow-ups are overdue", "Review the overdue items with the owner and record the next customer-contact date.", `/admin/team?search=${encodeURIComponent(name)}`);
  if (visitCompletionPercent != null && visitCompletionPercent < thresholds.visitCompletionAlertPercent) add("visit-completion", "medium", `${visitCompletionPercent}% visit completion`, "Visit completion is below review threshold", "Review planned and completed visits with the RM before changing route or coverage plans.", `/admin/team?search=${encodeURIComponent(name)}`);
  return insights;
}
