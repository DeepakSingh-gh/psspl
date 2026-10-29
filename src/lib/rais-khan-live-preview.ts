import { rmReportDemo } from "@/lib/rm-report-demo";

// Display-only preview for the named RM's empty operational periods.
// Never send this object to the API or reuse it for AI/action-plan decisions.
export function raisKhanLivePreview(data: any, period: string): any | null {
  if (data?.id !== "raiskhan" || (period !== "today" && period !== "week")) return null;
  if (
    (data.kpi?.actualSalesValue ?? 0) > 0 ||
    // Planned visits alone do not mean this empty period has reported activity.
    (data.kpi?.visitsCompleted ?? 0) > 0 ||
    data.customerVisits?.some((visit: { status?: string }) => !["planned", "scheduled"].includes(visit.status ?? "")) ||
    (data.pipeline?.length ?? 0) > 0 ||
    (data.kpi?.callsLogged ?? 0) > 0 ||
    (data.kpi?.followUpsOpen ?? 0) > 0
  ) return null;

  const isToday = period === "today";
  const actual = isToday ? 86000 : 385000;
  const target = isToday ? 110000 : 520000;
  const demo = rmReportDemo(period);
  const visits = isToday ? 3 : 12;
  const month = data.to?.slice(0, 7) ?? "2026-10";
  const [year, monthNumber] = month.split("-").map(Number);
  const financialYearStart = monthNumber < 4 ? year - 1 : year;
  const from = new Date(`${data.from ?? data.to}T00:00:00Z`);
  const through = new Date(`${data.to}T00:00:00Z`);
  const weekdays = isToday ? 1 : 6;
  const elapsedWeekdays = isToday ? 1 : Array.from({ length: weekdays }, (_, index) => {
    const day = new Date(from);
    day.setUTCDate(day.getUTCDate() + index);
    return day <= through;
  }).filter(Boolean).length;
  const dailyWeights = [72, 91, 136, 86, 100, 95];
  const elapsedWeight = dailyWeights.slice(0, elapsedWeekdays).reduce((sum, value) => sum + value, 0);
  let allocated = 0;
  const periodChartRows = Array.from({ length: weekdays }, (_, index) => {
    const day = new Date(from);
    day.setUTCDate(day.getUTCDate() + index);
    const hasActual = isToday || index < elapsedWeekdays;
    const dailyActual = !hasActual ? null : index === elapsedWeekdays - 1
      ? actual - allocated
      : Math.round(actual * dailyWeights[index] / elapsedWeight);
    if (dailyActual != null) allocated += dailyActual;
    const dailyTarget = isToday ? target : target / weekdays;
    return {
      month: day.toISOString().slice(0, 10),
      label: isToday ? "Today" : day.toLocaleString("en-IN", { weekday: "short", timeZone: "UTC" }),
      target: dailyTarget,
      actual: dailyActual,
      achievementPercent: dailyActual == null ? null : Math.round(dailyActual / dailyTarget * 100),
    };
  });
  const customerVisits = [
    { id: "preview-visit-1", customerName: "North Star Traders", date: data.to, purpose: "Product discussion", outcome: "Sample requested" },
    { id: "preview-visit-2", customerName: "Pragati Chemicals", date: data.to, purpose: "Order follow-up", outcome: "Pricing under review" },
    { id: "preview-visit-3", customerName: "Sunrise Surface Co.", date: data.to, purpose: "Dealer visit", outcome: "Next meeting scheduled" },
  ];
  return {
    ...data,
    livePreviewDemo: true,
    periodChartRows,
    monthlyPerformance: { from: `${month}-01`, to: data.to, label: "Month to date · Demo", actual: 1180000, target: 1400000, achievementPercent: 84 },
    ytdPerformance: { from: `${financialYearStart}-04-01`, to: data.to, label: "Financial year to date · Demo", actual: 6840000, target: 7800000, achievementPercent: 88 },
    customerVisits,
    kpi: {
      ...data.kpi,
      actualSalesValue: actual,
      targetValue: target,
      achievementPercent: Math.round(actual / target * 100),
      visitsPlanned: isToday ? 4 : 15,
      visitsCompleted: visits,
      callsLogged: isToday ? 7 : 28,
      customersCovered: isToday ? 3 : 10,
      expectedOrdersValue: demo.pipelineValue,
      followUpsOpen: isToday ? 2 : 5,
      followUpsOverdue: isToday ? 0 : 1,
    },
  };
}
