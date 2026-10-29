import { rmActivityDemo } from "@/lib/rm-activity-demo";
import { rmMonthlyChart } from "../../shared/rm-monthly-chart.mjs";

// Display-only samples. Keep the original records available for analysis.
export function rmReportPresentation(data: any, period: string): any {
  if (!data) return data;
  const presentation = rmActivityDemo(data, period);
  const monthlyChart = period === "month" ? rmMonthlyChart(data) : null;
  const scale = period === "today" ? 0.08 : period === "week" ? 0.35 : period === "fytd" ? 3 : 1;
  const products = data.thrustProducts?.products?.map((product: any, index: number) => ({
    ...product,
    isDemo: product.ytdSalesRupees == null,
    ytdSalesRupees: product.ytdSalesRupees ?? Math.round((42000 + index * 8500) * scale),
    ytdSalesLakh: product.ytdSalesLakh ?? Math.round((42000 + index * 8500) * scale) / 100000,
  }));
  const managementInsights = data.managementInsights?.length ? data.managementInsights : [
    { id: period === "fytd" ? "claude-fytd" : data.monthlyPerformance ? "claude-monthly" : "target-achievement", severity: "medium" },
    ...((data.kpi?.visitsPlanned ?? 0) > (data.kpi?.visitsCompleted ?? 0) ? [{ id: "visit-completion", severity: "medium" }] : []),
  ];
  return {
    ...presentation,
    ...(monthlyChart ? { periodChartRows: monthlyChart.rows, monthlyChartDemo: monthlyChart.demo } : {}),
    insightSource: { ...data, managementInsights },
    thrustProducts: products ? { ...data.thrustProducts, products, hasDemoProducts: products.some((product: any) => product.isDemo) } : data.thrustProducts,
  };
}
