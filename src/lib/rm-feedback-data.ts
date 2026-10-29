import type { RmFeedbackSnapshot } from "@/types/rm-feedback";
import { achievementPercent } from "../../shared/achievement.mjs";

const rupees = (value: number | null) => value == null ? null : Math.round(value * 100000);

// Adapt supplied figures to the existing report contracts; do not create live
// invoices, team memberships, visits or product-level sales from PDF aggregates.
export function feedbackFinancials(snapshot: RmFeedbackSnapshot, from: string, to: string, period: string) {
  const start = `${snapshot.financialYear.slice(0, 4)}-04-01`;
  const end = `${Number(snapshot.financialYear.slice(0, 4)) + 1}-03-31`;
  if (!["month", "fytd"].includes(period) || to < start || from > end) return null;
  const cutoff = to < snapshot.asOf ? to : snapshot.asOf;
  const monthEnd = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const months = snapshot.monthlyMetrics.filter(month => monthEnd(month.period) <= cutoff);
  const last = months.at(-1);
  if (!last) return null;
  const monthFrom = `${last.period}-01`;
  const monthTo = last.period === snapshot.asOf.slice(0, 7) ? snapshot.asOf : new Date(Date.UTC(Number(last.period.slice(0, 4)), Number(last.period.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const fullSnapshot = cutoff === snapshot.asOf;
  const ytdActual = fullSnapshot ? snapshot.annual.currentYearActual : months.reduce((sum, item) => sum + (item.achieved ?? 0), 0);
  const ytdTarget = fullSnapshot ? snapshot.annual.currentYearTargetTillMonth : months.reduce((sum, item) => sum + (item.target ?? 0), 0);
  const monthlyPerformance = { from: monthFrom, to: monthTo, label: `reported month (${last.month} ${last.period.slice(0, 4)})`, actual: rupees(last.achieved), target: rupees(last.target), achievementPercent: achievementPercent(last.achieved, last.target) };
  const ytdPerformance = { from: start, to: monthTo, label: "reported FYTD", actual: rupees(ytdActual), target: rupees(ytdTarget), achievementPercent: achievementPercent(ytdActual, ytdTarget) };
  const selected = period === "fytd" ? ytdPerformance : monthlyPerformance;
  const products = [...new Set(snapshot.thrustProductGroups.flatMap(group => group.productsText.split("\n").map(name => name.trim()).filter(Boolean)))].map((name, index) => ({ id: `${snapshot.id}-${index}`, name, ytdSalesLakh: null, ytdSalesRupees: null, quantity: null, invoiceCount: null, isSold: null }));
  return {
    selected, monthlyPerformance, ytdPerformance,
    annualPerformance: { actual: rupees(snapshot.annual.currentYearActual), target: rupees(snapshot.annual.currentYearTarget), achievementPercent: achievementPercent(snapshot.annual.currentYearActual, snapshot.annual.currentYearTarget) },
    thrustProducts: { products, totalYtdLakh: snapshot.thrustTotalLakh, totalSalesRupees: rupees(snapshot.thrustTotalLakh), activeCount: null, totalCount: products.length, financialYear: snapshot.financialYear, source: "supplied_pdf_snapshot" },
    reportSource: { kind: "supplied_pdf_snapshot", asOf: snapshot.asOf, financialYear: snapshot.financialYear, fileName: snapshot.source.fileName },
    monthlyTargetVsActual: snapshot.monthlyMetrics.map(month => ({ month: month.period, label: `${month.month} '${month.period.slice(2, 4)}`, target: rupees(month.target), actual: rupees(month.achieved), achievementPercent: achievementPercent(month.achieved, month.target) })),
  };
}

export function feedAdminFeedback(data: any, snapshot: RmFeedbackSnapshot, period: string) {
  const figures = feedbackFinancials(snapshot, data.from, data.to, period);
  const identity = {
    rmCode: snapshot.rm.rmCode,
    operatingFrom: snapshot.rm.operatingFrom,
    technicalService: snapshot.technicalService,
    operatingCities: [snapshot.rm.operatingFrom],
    teamExecutiveCities: [...new Set(snapshot.teamEntries.flatMap(member => member.citiesCovered.split(",").map(city => city.trim()).filter(Boolean)))],
  };
  // Today and this week use live CRM figures, but the stable RM identity still
  // comes from the supplied RM profile. Never substitute a monthly PDF total.
  if (!figures) return { ...data, ...identity };
  const { selected, monthlyPerformance, ytdPerformance, annualPerformance, reportSource, monthlyTargetVsActual, thrustProducts } = figures;
  const insight = monthlyPerformance.achievementPercent != null && monthlyPerformance.achievementPercent < (data.reportingThresholds?.targetAlertPercent ?? 80)
    ? [{ id: "snapshot-target-achievement", severity: "high", rmName: data.name, period: { from: monthlyPerformance.from, to: monthlyPerformance.to }, metric: `${monthlyPerformance.achievementPercent}% of ${monthlyPerformance.label} target (supplied PDF)`, title: "Target achievement below review threshold", action: "Review the reported target gap with the RM and agree on recovery actions.", href: null, thresholdsProvisional: data.reportingThresholds?.provisional ?? true }]
    : [];
  return {
    ...data, reportSource, monthlyPerformance, ytdPerformance, annualPerformance, monthlyTargetVsActual, thrustProducts,
    effectiveFrom: selected.from, effectiveTo: selected.to,
    ...identity,
    specialAchievements: snapshot.specialAchievementsNotes ? [snapshot.specialAchievementsNotes] : [],
    managementInsights: [...insight, ...(data.managementInsights ?? []).filter((item: any) => !["ownership-mapping", "target-achievement"].includes(item.id))],
    kpi: { ...data.kpi, targetValue: selected.target, actualSalesValue: selected.actual, achievementPercent: selected.achievementPercent, monthlyTarget: monthlyPerformance.target },
  };
}

export function feedRmFeedback(data: any, snapshot: RmFeedbackSnapshot) {
  const figures = feedbackFinancials(snapshot, data.period.from, data.period.to, "month");
  if (!figures) return { ...data, technicalService: snapshot.technicalService };
  return {
    ...data, technicalService: snapshot.technicalService, reportSource: figures.reportSource,
    period: { from: figures.selected.from, to: figures.selected.to },
    periodLabel: `${figures.monthlyPerformance.label} · PDF as of ${snapshot.reportDate}`,
    monthlyTarget: figures.selected.target, salesValue: figures.selected.actual, achievementPercent: figures.selected.achievementPercent,
    monthlyTargetVsActual: figures.monthlyTargetVsActual,
    specialAchievements: snapshot.specialAchievementsNotes ? [snapshot.specialAchievementsNotes] : [],
    profile: { ...data.profile, rmCode: snapshot.rm.rmCode, operatingFrom: snapshot.rm.operatingFrom, regCode1: snapshot.rm.registrationCodes[0] ?? null, regCode2: snapshot.rm.registrationCodes[1] ?? null, teamExecutiveCities: snapshot.teamEntries.map(member => member.citiesCovered).filter(Boolean) },
    statusLabel: figures.selected.achievementPercent == null ? "Target unavailable" : figures.selected.achievementPercent >= 80 ? "On Track" : figures.selected.achievementPercent >= 50 ? "Moderate Pace" : "Under Quota Pace",
  };
}
