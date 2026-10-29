import { formatDate } from "@/lib/format";
import { raisKhanSourceReport } from "../../shared/rais-khan-source-report.mjs";

/** Keep requested sample detail rows, but use the existing source for finances. */
export function raisKhanReportPresentation(data: any): any {
  const financials = raisKhanSourceReport(data);
  const preview = raisKhanPeriodPreview(data);
  if (!financials) return preview;
  if (!preview?.livePreviewDemo) return financials;
  const actual = financials.kpi.actualSalesValue;
  const rescale = (rows: any[]) => {
    if (actual == null) return [];
    const total = rows.reduce((sum,row) => sum + row.salesValue,0);
    let allocated = 0;
    return rows.map((row,index) => { const salesValue = index === rows.length - 1 ? actual - allocated : Math.round(actual * row.salesValue / (total || 1)); allocated += salesValue; return {...row,salesValue}; });
  };
  const topDealers = rescale(preview.topDealers);
  const topProducts = rescale(preview.topProducts);
  const actualSales = topDealers.map((row,index) => ({id:`demo-source-invoice-${index}`,invoiceNumber:`DEMO-${index + 1}`,customerName:row.dealerName,invoiceDate:data.to,amount:row.salesValue}));
  const activity = Object.fromEntries(['visitsPlanned','visitsCompleted','visitCompletionPercent','customersCovered','callsLogged','expectedOrdersValue','followUpsOpen','followUpsOverdue'].map(key=>[key,preview.kpi[key]]));
  return {
    ...preview,...financials,
    livePreviewDemo:true, monthlyChartDemo:false,
    reportLabel:`${financials.reportLabel} · Demo details`,
    topDealers,topProducts,actualSales,salesInvoiceCount:actualSales.length,
    customerVisits:preview.customerVisits,pipeline:preview.pipeline,followUps:preview.followUps,
    activeDealerCount:topDealers.length,
    demoSections:{...preview.demoSections,dealers:true,products:true},
    kpi:{...financials.kpi,...activity,salesInvoiceCount:actualSales.length,productsSold:topProducts.length},
  };
}

/** Display-only samples for Rais Khan's empty periods. Never persisted or sent to APIs. */
export function raisKhanPeriodPreview(data: any): any {
  if (!data?.selectedPeriod || !["raiskhan"].includes(String(data.id).toLowerCase().replace(/[^a-z]/g, ""))) return data;
  if ((data.salesInvoiceCount ?? 0) > 0 || data.actualSales?.length || data.kpi?.actualSalesValue || data.customerVisits?.length || data.pipeline?.length || data.followUps?.length || data.kpi?.callsLogged) return data;
  const year = Number(data.selectedPeriod.financialYear.slice(0, 4));
  const monthActuals = [822000,1572000,1080000,452000,734000,656000,1180000,960000,1040000,1110000,970000,1320000];
  const monthTargets = [923000,1230000,1025000,923000,1025000,1128000,1400000,923000,820000,923000,1025000,1230000];
  const days: Array<{ month: string; label: string; actual: number; target: number; achievementPercent: number }> = [];
  for (let index = 0; index < 12; index++) {
    const m = (index + 3) % 12 + 1;
    const prefix = `${year + (m < 4 ? 1 : 0)}-${String(m).padStart(2, "0")}`;
    const count = new Date(Date.UTC(year + (m < 4 ? 1 : 0), m, 0)).getUTCDate();
    const weights = Array.from({ length: count }, (_, day) => [1,1.2,0.8,1.3,1.1,0.9,0.7][day % 7]);
    const totalWeight = weights.reduce((sum, value) => sum + value, 0);
    let allocated = 0;
    for (let day = 1; day <= count; day++) {
      const actual = day === count ? monthActuals[index] - allocated : Math.round(monthActuals[index] * weights[day - 1] / totalWeight);
      allocated += actual;
      const date = `${prefix}-${String(day).padStart(2, "0")}`;
      if (date < data.from || date > data.to) continue;
      const target = monthTargets[index] / count;
      days.push({ month: date, label: `${date.slice(8)}-${date.slice(5,7)}`, actual, target, achievementPercent: Math.round(actual / target * 100) });
    }
  }
  const actual = days.reduce((sum, row) => sum + row.actual, 0);
  const target = Math.round(days.reduce((sum, row) => sum + row.target, 0));
  const split = (total: number, weights: number[]) => {
    let allocated = 0;
    return weights.map((weight, index) => { const value = index === weights.length - 1 ? total - allocated : Math.round(total * weight); allocated += value; return value; });
  };
  const dealerNames = ["North Star Traders","Pragati Chemicals","Sunrise Surface Co.","Arora Industrial Supplies","Metro Coating House"];
  const productNames = ["Industrial Protective Coating","Corrosion Guard Primer","High Build Epoxy","Surface Prep Solvent","Zinc Phosphate Primer"];
  const invoices = days.flatMap((day, dayIndex) => split(day.actual,[0.34,0.26,0.17,0.13,0.1]).map((amount,i) => ({ id: `preview-invoice-${dayIndex}-${i}`, invoiceNumber: `PREVIEW-${dayIndex + 1}-${i + 1}`, customerName: dealerNames[i], invoiceDate: day.month, amount })));
  const amounts = dealerNames.map(name => invoices.filter(row => row.customerName === name).reduce((sum,row) => sum + row.amount,0));
  const topDealers = dealerNames.map((dealerName, i) => ({ dealerName, salesValue: amounts[i] }));
  const productAmounts = amounts;
  const dateAt = (i: number) => days[Math.min(i, days.length - 1)].month;
  const pipeline = dealerNames.slice(0,3).map((customerName,i) => ({ id: `preview-order-${i}`, customerName, productName: productNames[i], expectedValue: [245000,186000,124000][i], expectedDate: dateAt(i), stage: "open", isOverdue: false }));
  const visits = dealerNames.map((customerName,i) => ({ id: `preview-visit-${i}`, customerName, date: dateAt(i), status: i < 4 ? "completed" : "planned", purpose: ["Product discussion","Order review","Technical support"][i % 3], outcome: i < 4 ? "Quotation shared; next contact agreed" : null, expectedOrderValue: pipeline[i % 3].expectedValue, nextFollowUpDate: dateAt(i) }));
  const followUps = dealerNames.slice(0,3).map((customerName,i) => ({ id: `preview-followup-${i}`, customerName, title: ["Confirm sample feedback","Review quotation approval","Schedule technical discussion"][i], dueDate: dateAt(i), priority: i === 0 ? "high" : "normal", isOverdue: false }));
  const monthlyRows = [...new Set(days.map(row => row.month.slice(0,7)))].map(month => {
    const rows = days.filter(row => row.month.startsWith(month));
    const actual = rows.reduce((sum,row) => sum + row.actual,0), target = Math.round(rows.reduce((sum,row) => sum + row.target,0));
    return { month, label: new Date(`${month}-01T00:00:00Z`).toLocaleString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }), actual, target, achievementPercent: Math.round(actual / target * 100) };
  });
  const performance = { from: data.from, to: data.to, actual, target, achievementPercent: Math.round(actual / target * 100), label: data.selectedPeriod.label };
  const thrustRows = data.thrustProducts?.products ?? [];
  const thrustAmounts = thrustRows.length ? split(Math.round(actual * .22), thrustRows.map(() => 1 / thrustRows.length)) : [];
  return {
    ...data, hasRecords: true, livePreviewDemo: true, monthlyChartDemo: true, actualOnly: true,
    reportLabel: `${data.selectedPeriod.label} · ${formatDate(data.from)} to ${formatDate(data.to)} · Demo`,
    technicalService: data.technicalService ?? { center: "Ludhiana", executive: "Sartaj Khan" },
    operatingFrom: "Ludhiana", ownershipMapping: "verified", activeDealerCount: 5,
    monthlyPerformance: performance, ytdPerformance: performance,
    periodChartRows: data.selectedPeriod.reportType === "yearly" ? monthlyRows : days,
    monthlyTargetVsActual: monthlyRows,
    topDealers, topFiveDealerConcentrationPercent: 100, topFiveDealerRevenue: actual,
    topProducts: productNames.map((name,i) => ({ name, salesValue: productAmounts[i], invoiceCount: days.length, previousSalesValue: null, growthPercent: null })),
    actualSales: invoices.slice(-50).reverse(),
    salesInvoiceCount: invoices.length, customerVisits: visits, pipeline, followUps,
    demoSections: { visits: true, pipeline: true, sales: true, products: true, followups: true },
    dormantDealers: [], dealerIntelligence: { all: [], noSalesInSelectedPeriod: [], declining: [], insufficientHistory: [] },
    thrustProducts: thrustRows.length ? { ...data.thrustProducts, source: "selected_period_demo", totalSalesRupees: thrustAmounts.reduce((sum,value) => sum + value,0), totalYtdLakh: thrustAmounts.reduce((sum,value) => sum + value,0) / 100000, activeCount: thrustRows.length, products: thrustRows.map((product: any,i: number) => ({ ...product, ytdSalesRupees: thrustAmounts[i], ytdSalesLakh: thrustAmounts[i] / 100000, salesRupees: thrustAmounts[i], isSold: true, isDemo: true })) } : data.thrustProducts,
    managementInsights: [{ id: "target-achievement", title: "Review selected period sales", metric: `${performance.achievementPercent}% achieved`, severity: "medium" }],
    kpi: { ...data.kpi, actualSalesValue: actual, targetValue: target, achievementPercent: performance.achievementPercent, visitsPlanned: 5, visitsCompleted: 4, visitCompletionPercent: 80, customersCovered: 4, callsLogged: 12, expectedOrdersValue: pipeline.reduce((sum,row) => sum + row.expectedValue,0), followUpsOpen: 3, followUpsOverdue: 0, salesInvoiceCount: invoices.length, productsSold: 5 },
  };
}
