import { achievementPercent } from './achievement.mjs';

/** Financial fallback from the existing supplied report, restricted to Rais Khan.
 * CRM activity and invoice details remain untouched. Live invoices take priority.
 */
export function raisKhanSourceReport(data) {
  const source = data?.suppliedFinancialReport;
  if (!source || String(data.id).replace(/[^a-z]/gi, '').toLowerCase() !== 'raiskhan' || (data.salesInvoiceCount ?? 0) > 0 || data.actualSales?.length || data.kpi?.actualSalesValue) return null;
  const selected = data.selectedPeriod;
  const current = selected?.financialYear === source.financialYear;
  const priorYear = Number(source.financialYear.slice(0,4)) - 1;
  const prior = selected?.financialYear === `${priorYear}-${String(priorYear + 1).slice(-2)}`;
  if (!current && !prior) return null;
  const rupees = value => value == null ? null : Math.round(value * 100000);
  const labelDate = value => value.split('-').reverse().join('-');
  const rows = (current ? source.monthlyMetrics : source.previousYearPerformance).map((row,index) => {
    const number = (index + 3) % 12 + 1;
    const year = Number(selected.financialYear.slice(0,4)) + (number < 4 ? 1 : 0);
    return { month: `${year}-${String(number).padStart(2,'0')}`, label: `${row.month} '${String(year).slice(2)}`, target: rupees(row.target), actual: rupees(current ? row.achieved : row.actual) };
  }).map(row => ({...row, achievementPercent: achievementPercent(row.actual,row.target)}));
  const monthIndex = (Number(data.from.slice(5,7)) + 8) % 12;
  const month = rows[monthIndex];
  const monthDays = new Date(Date.UTC(Number(month.month.slice(0,4)), Number(month.month.slice(5,7)),0)).getUTCDate();
  const weeklyRows = Array.from({length:4},(_,index) => {
    const sourceRow = current ? source.weeklySummary[index] : null;
    const from = `${month.month}-${String(index * 7 + 1).padStart(2,'0')}`;
    const to = `${month.month}-${String(index === 3 ? monthDays : (index + 1) * 7).padStart(2,'0')}`;
    const target = rupees(sourceRow?.targets[monthIndex]);
    const actual = rupees(sourceRow?.achieved[monthIndex]);
    return { month:from, from, to, label:`Wk ${index + 1}`, target, actual, achievementPercent:achievementPercent(actual,target) };
  });
  let chartRows, actual, target;
  if (selected.reportType === 'yearly') {
    chartRows = rows;
    actual = rupees(current ? source.annual.currentYearActual : source.previousYearTotals.actual);
    target = rupees(current ? source.annual.currentYearTarget : source.previousYearTotals.target);
  } else if (selected.reportType === 'monthly') {
    // Prior-year source contains monthly aggregates only, never weekly splits.
    chartRows = current ? weeklyRows : [month];
    actual = month.actual; target = month.target;
  } else {
    const candidate = weeklyRows[Math.floor((Number(data.from.slice(8,10)) - 1) / 7)];
    const row = candidate?.from === data.from && candidate?.to === data.to ? candidate : null;
    chartRows = row ? [row] : [{month:data.from,label:'Source week unavailable',actual:null,target:null,achievementPercent:null}];
    actual = row?.actual ?? null; target = row?.target ?? null;
  }
  const note = selected.reportType === 'weekly'
    ? 'Supplied report uses four weekly buckets (Wk 4: 22–month end); daily splits and a separate fifth week are not provided.'
    : selected.reportType === 'monthly' && current
    ? 'Four-week reporting convention: 1–7, 8–14, 15–21 and 22–month end. Supplied blank achievements are unavailable; rounded weekly totals may differ from monthly totals.'
    : 'Existing supplied report totals; unreported achievements remain unavailable. Rounded monthly totals may differ from the reported annual total.';
  const selectedPerformance = {from:data.from,to:data.to,actual,target,achievementPercent:achievementPercent(actual,target),label:selected.label};
  return {
    ...data, hasRecords:data.hasRecords || target != null || actual != null,
    livePreviewDemo:false, monthlyChartDemo:false, actualOnly:true,
    financialSource:{kind:'supplied_pdf_snapshot',asOf:source.asOf},
    chartNote:note, chartGranularity:selected.reportType === 'monthly' && current ? 'weekly' : selected.reportType === 'weekly' ? 'source-week' : 'monthly',
    reportLabel:`${selected.label} · ${labelDate(data.from)} to ${labelDate(data.to)} · Supplied report as of ${labelDate(source.asOf)}`,
    periodChartRows:chartRows, monthlyTargetVsActual:selected.reportType === 'yearly' ? rows : rows.filter(row=>row.month>=data.from.slice(0,7)&&row.month<=data.to.slice(0,7)),
    monthlyPerformance:selectedPerformance,ytdPerformance:selectedPerformance,
    kpi:{...data.kpi,actualSalesValue:actual,targetValue:target,achievementPercent:selectedPerformance.achievementPercent},
    managementInsights:[...(data.managementInsights?.filter(item=>item.id!=='target-achievement') ?? []), ...(selectedPerformance.achievementPercent != null && selectedPerformance.achievementPercent < (data.reportingThresholds?.targetAlertPercent ?? 80) ? [{id:'target-achievement',title:'Selected period sales below target',severity:'high',metric:`${selectedPerformance.achievementPercent}% of selected period target`,period:{from:data.from,to:data.to}}] : [])],
  };
}
