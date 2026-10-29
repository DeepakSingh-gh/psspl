// Presentation-only rows. Keep them separate from CRM records and financial KPIs.
export type RmDemoPeriod = "today" | "week" | "month" | "fytd";

const periodScale: Record<RmDemoPeriod, number> = {
  today: 0.08,
  week: 0.35,
  month: 1,
  fytd: 3,
};

export function rmReportDemo(period: string | undefined) {
  const scale = periodScale[period as RmDemoPeriod] ?? periodScale.month;
  const amount = (value: number) => Math.round(value * scale);
  const pipeline = [
    { id: "demo-north-star", customerName: "North Star Traders", productName: "Industrial Protective Coating", expectedValue: amount(245000), expectedDate: "Upcoming" },
    { id: "demo-pragati", customerName: "Pragati Chemicals", productName: "Corrosion Guard Primer", expectedValue: amount(186000), expectedDate: "Upcoming" },
    { id: "demo-sunrise", customerName: "Sunrise Surface Co.", productName: "High Build Epoxy", expectedValue: amount(124000), expectedDate: "Upcoming" },
  ];
  const dealers = [
    { dealerName: "North Star Traders", salesValue: amount(245000) },
    { dealerName: "Pragati Chemicals", salesValue: amount(186000) },
    { dealerName: "Sunrise Surface Co.", salesValue: amount(124000) },
    { dealerName: "Arora Industrial Supplies", salesValue: amount(92000) },
    { dealerName: "Metro Coating House", salesValue: amount(68000) },
  ];
  const products = [
    { name: "Industrial Protective Coating", salesValue: amount(168000) },
    { name: "Corrosion Guard Primer", salesValue: amount(112000) },
    { name: "High Build Epoxy", salesValue: amount(84000) },
    { name: "Surface Prep Solvent", salesValue: amount(46000) },
    { name: "Zinc Phosphate Primer", salesValue: amount(39000) },
  ];
  return { pipeline, dealers, products, pipelineValue: pipeline.reduce((sum, row) => sum + row.expectedValue, 0) };
}
