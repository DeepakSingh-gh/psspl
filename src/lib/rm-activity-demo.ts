import { indiaBusinessDate, shiftBusinessDate } from "@/lib/business-date";
import { rmReportDemo } from "@/lib/rm-report-demo";

// Display-only rows for the five activity tabs. Never use for KPIs, AI or API writes.
export function rmActivityDemo(data: any, period: string): any {
  if (!data) return data;
  const demo = rmReportDemo(period);
  const end = data.to ?? indiaBusinessDate();
  const start = data.from ?? end;
  const recentDate = (offset: number) => {
    const date = shiftBusinessDate(end, -offset);
    return date < start ? start : date;
  };
  const demoSections = {
    visits: !data.customerVisits?.length,
    pipeline: !data.pipeline?.length,
    sales: !data.actualSales?.length,
    products: !data.topProducts?.length,
    followups: !data.followUps?.length,
  };
  const customerVisits = demo.dealers.slice(0, 3).map((dealer, index) => ({
    id: `demo-visit-${index}`, customerName: dealer.dealerName, date: recentDate(index),
    status: ["completed", "completed", "in_progress"][index],
    purpose: ["Product demonstration", "Repeat order discussion", "Technical support visit"][index],
    outcome: ["Trial sample requested", "Quotation shared; awaiting approval", "Application requirements under review"][index],
    expectedOrderValue: demo.pipeline[index].expectedValue,
    nextFollowUpDate: shiftBusinessDate(end, index + 1),
  }));
  const pipeline = demo.pipeline.map((row, index) => ({
    ...row, expectedDate: shiftBusinessDate(end, index === 2 ? -1 : index + 2),
    stage: ["quotation", "negotiation", "qualified"][index], isOverdue: index === 2,
  }));
  const actualSales = demo.dealers.map((dealer, index) => ({
    id: `demo-invoice-${index}`, invoiceNumber: `DEMO-${end.replaceAll("-", "")}-${String(index + 1).padStart(3, "0")}`,
    invoiceDate: recentDate(index), customerName: dealer.dealerName, amount: dealer.salesValue,
  }));
  const topProducts = demo.products.map((product, index) => {
    const previousSalesValue = Math.round(product.salesValue * [0.9, 1.08, 0.8, 0.95, 0.85][index]);
    return { ...product, previousSalesValue, growthPercent: Math.round((product.salesValue - previousSalesValue) / previousSalesValue * 100), invoiceCount: [3, 2, 2, 1, 1][index] };
  });
  const followUps = demo.dealers.slice(0, 3).map((dealer, index) => ({
    id: `demo-followup-${index}`, customerName: dealer.dealerName,
    title: ["Confirm sample trial feedback", "Follow up on quotation approval", "Schedule technical discussion"][index],
    dueDate: shiftBusinessDate(end, index === 0 ? -1 : index), priority: ["high", "normal", "normal"][index],
    isOverdue: index === 0,
  }));
  return {
    ...data, demoSections,
    customerVisits: demoSections.visits ? customerVisits : data.customerVisits,
    pipeline: demoSections.pipeline ? pipeline : data.pipeline,
    actualSales: demoSections.sales ? actualSales : data.actualSales,
    topProducts: demoSections.products ? topProducts : data.topProducts,
    followUps: demoSections.followups ? followUps : data.followUps,
    salesInvoiceCount: demoSections.sales ? actualSales.length : data.salesInvoiceCount,
    activitySalesTotal: demoSections.sales ? actualSales.reduce((sum, row) => sum + row.amount, 0) : data.kpi?.actualSalesValue,
  };
}
