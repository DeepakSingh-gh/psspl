import { formatRupees } from "@/lib/format";

const topics: Record<string, { title: string; actions: string[] }> = {
  "ownership-mapping": { title: "Check which sales belong to this RM", actions: ["Check the customer names and sales assigned to this RM."] },
  "dealer-concentration": { title: "Most sales come from a few dealers", actions: ["Check which dealers bring in the most sales.", "Speak to other dealers about new orders."] },
  "declining-dealers": { title: "Some dealers are buying less", actions: ["Ask these dealers why they are buying less.", "Save their replies and the next date to contact them."] },
  "declining-products": { title: "Some products are selling less", actions: ["Ask the RM which products are selling less and why."] },
  "dormant-dealers": { title: "Some dealers have stopped ordering", actions: ["Ask these dealers if they still need our products.", "Set a date to speak with them again."] },
  "overdue-followups": { title: "Some customer follow-ups are late", actions: ["Ask the assigned team members to contact these customers.", "Save the next date to call or visit each customer."] },
  "visit-completion": { title: "Some planned visits are not done yet", actions: ["Ask the RM which visits are still pending.", "Save what happened during each visit, or set a new visit date."] },
};

type ManagementBrief = {
  id: string; title: string; metric: string; finding: string; actions: string[];
  severity: string; href?: string | null; thresholdsProvisional?: boolean;
};

export function rmManagementBriefs(data: any): ManagementBrief[] {
  return (data.managementInsights ?? []).map((item: any) => {
    const monthly = ["claude-monthly", "snapshot-target-achievement"].includes(item.id);
    const fytd = item.id === "claude-fytd";
    const live = ["claude-live-performance", "target-achievement"].includes(item.id);
    const performance = monthly ? data.monthlyPerformance : fytd ? data.ytdPerformance : live ? {
      actual: data.kpi?.actualSalesValue, target: data.kpi?.targetValue, achievementPercent: data.kpi?.achievementPercent,
    } : null;
    const topic = topics[item.id];
    let title = topic?.title ?? (String(item.title ?? "").split(/\s+/).length <= 10 ? item.title : "Check this with the RM");
    let metric = item.metric ?? "The numbers are not available";
    let finding = "";
    let actions = topic?.actions ?? [String(item.action ?? "").split(/\s+/).length <= 22 && item.action ? item.action : "Talk to the RM about this and decide what to do next."];
    if (performance) {
      const { actual, target, achievementPercent } = performance;
      const comparable = actual != null && target != null && target > 0;
      const gap = comparable ? target - actual : null;
      const label = monthly ? "Monthly sales" : fytd ? "Sales so far this financial year" : "Sales for these dates";
      title = !comparable ? `${label}: some numbers are missing` : gap! > 0 ? `${label} are below target` : `${label} reached target`;
      metric = `Actual ${actual == null ? "unavailable" : formatRupees(actual)} · Target ${target == null || target <= 0 ? "unavailable" : formatRupees(target)}`;
      finding = [achievementPercent == null ? "" : `${achievementPercent}% of target reached`, gap == null ? "" : gap > 0 ? `${formatRupees(gap)} more needed` : gap < 0 ? `${formatRupees(-gap)} above target` : "Target met"].filter(Boolean).join(" · ");
      actions = !comparable ? ["Ask the RM for the missing sales or target numbers."] : gap! > 0
        ? [monthly ? "Ask the RM which expected orders did not come in." : "Check which pending orders can help reach the target.", "Decide which customers to contact first and when."]
        : ["Check which customers helped reach the target.", "Ask the RM when to contact these customers for their next order."];
    }
    const askAi = `Ask AI: "${data.name ? `${data.name}: ` : ""}${title}. What happened? Why might this have happened? What should we do next?"`;
    return { ...item, title, metric, finding, actions: [askAi, ...actions] };
  }).sort((a: any, b: any) => (a.severity === "high" ? 0 : 1) - (b.severity === "high" ? 0 : 1));
}

export type RmAnalyticalInsight = {
  id: string; title: string; metric: string; value: string; comparison: string; meaning: string;
  tone: "positive" | "negative" | "neutral";
  series?: Array<{ label: string; actual: number }>;
  targetResults?: Array<{ label: string; met: boolean }>;
};

export function rmDetailedInsights(data: any, period?: string): Array<{ id: string; title: string; points: string[] }> {
  if (data.actualOnly) {
    const kpi = data.kpi ?? {};
    if (!data.hasRecords) return [{ id: "no-data", title: "No Data Available", points: [data.reportLabel] }];
    return [
      { id: "selected-sales", title: "Selected period performance", points: [`Sales: ${kpi.actualSalesValue == null ? "Unavailable" : formatRupees(kpi.actualSalesValue)} · Target: ${kpi.targetValue == null ? "Unavailable" : formatRupees(kpi.targetValue)}`, kpi.achievementPercent == null ? "A complete target is not available for these dates." : `${kpi.achievementPercent}% of selected period target achieved.`] },
      { id: "selected-activity", title: "Customer activity", points: [`${kpi.visitsCompleted ?? 0} of ${kpi.visitsPlanned ?? 0} visits completed · ${kpi.callsLogged ?? 0} calls logged`, `${kpi.followUpsOpen ?? 0} open follow-ups · ${formatRupees(kpi.expectedOrdersValue ?? 0)} expected orders due in this period`] },
    ];
  }
  const isOperational = period === "today" || period === "week";
  const cutoff = String(data.reportSource?.asOf ?? data.effectiveTo ?? data.to ?? "").slice(0, 7);
  const history = isOperational ? [] : [...(data.monthlyTargetVsActual ?? [])]
    .filter((row: any) => Number.isFinite(row.actual) && row.month?.slice(0, 7) <= cutoff)
    .sort((a: any, b: any) => a.month.localeCompare(b.month));
  const sections = rmAnalyticalInsights(data, period)
    .filter(item => period === "fytd" || !["best-month", "consistency"].includes(item.id))
    .map(item => ({
    id: item.id, title: item.title, points: [`${item.value}: ${item.comparison}.`, item.meaning],
  }));
  const performance = isOperational ? {
    actual: data.kpi?.actualSalesValue, target: data.kpi?.targetValue,
  } : period === "fytd" ? data.ytdPerformance : data.monthlyPerformance;
  if (performance && Number.isFinite(performance.actual)) {
    const { actual, target } = performance;
    const comparable = Number.isFinite(target) && target > 0;
    const label = period === "fytd" ? "So far this financial year" : period === "today" ? "Today" : period === "week" ? "This week" : "Latest month in the report";
    sections.unshift({ id: "performance-detail", title: `${label}: sales and target`, points: [
      `${label}: sales are ${formatRupees(actual)}${comparable ? ` and the target is ${formatRupees(target)}` : "; the target is not available"}.`,
      ...(comparable ? [`${(actual / target * 100).toFixed(1)}% of the target is reached; ${actual < target ? `${formatRupees(target - actual)} more is needed` : actual > target ? `${formatRupees(actual - target)} above target` : "the target is reached"}.`,
        actual < target ? "What to do next: ask the RM which pending orders can help reach the target." : "What to do next: speak to the customers who ordered and ask about their next order."] : ["We need the target number to check how much more sales are needed."]),
    ] });
  }
  const trend = sections.find(item => item.id === "trend");
  if (trend && history.length > 1) {
    const latest = history.at(-1);
    const previous = history.at(-2);
    const difference = latest.actual - previous.actual;
    trend.points.push(difference === 0 ? "Sales did not change from the month before." : `Sales are ${formatRupees(Math.abs(difference))} ${difference < 0 ? "lower" : "higher"} than the month before.`);
    trend.points.push("The report does not say why sales changed. Ask the RM and check customer orders and bill dates to find out.");
  }
  const consistency = sections.find(item => item.id === "consistency");
  const comparable = history.filter((row: any) => Number.isFinite(row.target) && row.target > 0);
  if (consistency && comparable.length) {
    const met = comparable.filter((row: any) => row.actual >= row.target);
    const missed = comparable.filter((row: any) => row.actual < row.target);
    if (met.length) consistency.points.push(`Months meeting target: ${met.map((row: any) => row.label).join(", ")}.`);
    if (missed.length) consistency.points.push(`Months below target: ${missed.map((row: any) => `${row.label} (${formatRupees(row.target - row.actual)} more was needed)`).join("; ")}.`);
    consistency.points.push("We check each month against that month's target. High sales in one month do not mean the other months reached target.");
  }
  const best = sections.find(item => item.id === "best-month");
  if (best && history.length) {
    const peak = history.reduce((top: any, row: any) => row.actual > top.actual ? row : top);
    const latest = history.at(-1);
    if (latest.month !== peak.month && peak.actual > 0) best.points.push(`Sales in the latest month are ${formatRupees(latest.actual)}. This is ${(Math.max(0, peak.actual - latest.actual) / peak.actual * 100).toFixed(1)}% less than the best month in the report.`);
    best.points.push("What to do next: check which customers and products brought the most sales in the best month. Ask those customers about new orders.");
  }
  const operationalNextSteps: Record<string, string> = {
    coverage: "What to do next: ask which visits are done. Save what happened, or set a new date for pending visits.",
    pipeline: "What to do next: ask the RM which orders may come in, their value and likely dates. Customers have not confirmed these sales yet.",
    followups: "What to do next: contact customers who are waiting for a call or visit. Save the next contact date.",
  };
  for (const item of sections) if (operationalNextSteps[item.id]) item.points.push(operationalNextSteps[item.id]);
  const thrust = data.thrustProducts;
  if (thrust?.products?.length) sections.push({ id: "thrust-detail", title: "Thrust products: products to focus on", points: [
    `${thrust.products.length} products or product groups are listed${thrust.financialYear ? ` for ${thrust.financialYear}` : ""}: ${thrust.products.map((product: any) => product.name).join(", ")}.`,
    thrust.totalSalesRupees == null ? "The report does not give total sales for these products." : `Total sales for these products in the report: ${formatRupees(thrust.totalSalesRupees)}.`,
    thrust.products.some((product: any) => product.ytdSalesRupees == null) ? "The report does not give sales for each product. We cannot tell which product sold the most." : `${thrust.products.filter((product: any) => product.ytdSalesRupees > 0).length} of these products have sales recorded for these dates.`,
    "What to do next: ask the RM for each product's sales and which customers may need these products.",
  ] });
  return sections;
}

/** Observations explain the result; manager actions remain in their own list. */
export function rmAnalyticalInsights(data: any, period?: string): RmAnalyticalInsight[] {
  const items: RmAnalyticalInsight[] = [];
  const isOperational = period === "today" || period === "week";
  const cutoff = String(data.reportSource?.asOf ?? data.effectiveTo ?? data.to ?? "").slice(0, 7);
  const history = isOperational ? [] : [...(data.monthlyTargetVsActual ?? [])]
    .filter((row: any) => typeof row.actual === "number" && Number.isFinite(row.actual) && row.month?.slice(0, 7) <= cutoff)
    .sort((a: any, b: any) => a.month.localeCompare(b.month));
  if (history.length) {
    const latest = history.at(-1);
    const previous = history.at(-2);
    if (previous && previous.actual > 0) {
      const change = Number(((latest.actual - previous.actual) / previous.actual * 100).toFixed(1));
      items.push({ id: "trend", title: "Sales compared with last month", value: `${change > 0 ? "+" : ""}${change.toFixed(1)}%`,
        comparison: `${latest.label} ${formatRupees(latest.actual)} vs ${previous.label} ${formatRupees(previous.actual)}`,
        meaning: change < 0 ? "Sales were lower than the month before." : change > 0 ? "Sales were higher than the month before." : "Sales were the same as the month before.",
        metric: `${latest.label}: ${Math.abs(change).toFixed(1)}% ${change < 0 ? "lower" : change > 0 ? "higher" : "unchanged"} vs ${previous.label}`,
        tone: change < 0 ? "negative" : change > 0 ? "positive" : "neutral",
        series: history.map((row: any) => ({ label: row.label, actual: row.actual })),
      });
    }
    const best = history.reduce((top: any, row: any) => row.actual > top.actual ? row : top);
    items.push({ id: "best-month", title: "Best sales month", value: formatRupees(best.actual), comparison: best.label,
      meaning: `This month had the highest sales out of ${history.length} months in the report.`,
      metric: `${best.label}: ${formatRupees(best.actual)} (reported months)`, tone: "neutral" });
    const comparable = history.filter((row: any) => typeof row.target === "number" && Number.isFinite(row.target) && row.target > 0);
    if (comparable.length) {
      const achieved = comparable.filter((row: any) => row.actual >= row.target).length;
      const missed = comparable.length - achieved;
      items.push({ id: "consistency", title: "Months that reached target", value: `${achieved} / ${comparable.length}`, comparison: "months reached target",
        meaning: missed ? `${missed} month${missed === 1 ? " was" : "s were"} below target.` : "Every month in the report reached its target.",
        metric: `${achieved} of ${comparable.length} months reached target`, tone: missed ? "negative" : "positive",
        targetResults: comparable.map((row: any) => ({ label: row.label, met: row.actual >= row.target })),
      });
    }
  } else {
    const kpi = data.kpi ?? {};
    if (typeof kpi.visitsPlanned === "number" && typeof kpi.visitsCompleted === "number") {
      const remaining = Math.max(0, kpi.visitsPlanned - kpi.visitsCompleted);
      items.push({ id: "coverage", title: "Customer visits done", value: `${kpi.visitsCompleted} / ${kpi.visitsPlanned}`,
        comparison: "completed / planned visits", metric: `${kpi.visitsCompleted} completed / ${kpi.visitsPlanned} planned visits`,
        meaning: !kpi.visitsPlanned ? "No visits are planned for these dates." : remaining ? `${remaining} planned visits are not done yet.` : "All planned visits are marked as done.",
        tone: remaining ? "negative" : "neutral" });
    }
    if (data.pipeline?.length) {
      const value = data.pipeline.reduce((sum: number, row: any) => sum + (Number(row.expectedValue) || 0), 0);
      items.push({ id: "pipeline", title: "Orders that may come in", value: formatRupees(value), comparison: `${data.pipeline.length} possible orders`,
        metric: `${data.pipeline.length} possible orders - ${formatRupees(value)} expected`, meaning: "These are possible orders. They are not counted as sales yet.", tone: "neutral" });
    }
    if (typeof kpi.followUpsOpen === "number") {
      const overdue = kpi.followUpsOverdue;
      items.push({ id: "followups", title: "Customers to contact again", value: String(kpi.followUpsOpen), comparison: "pending follow-ups",
        metric: `${kpi.followUpsOpen} open${typeof overdue === "number" ? ` - ${overdue} overdue` : ""}`,
        meaning: typeof overdue === "number" ? overdue ? `${overdue} customer follow-ups are late.` : "No customer follow-ups are marked as late." : "The next contact dates are not available.", tone: overdue > 0 ? "negative" : "neutral" });
    }
  }
  return items;
}
