import { rmTopSales } from './rm-top-sales.mjs';
import { authoritativeInvoiceWhere, netInvoiceAmount, netInvoiceLineAmount } from './tally/metrics.mjs';
import { rmReportPeriod, targetForRange } from '../shared/rm-report-period.mjs';
import { financialMonths, reportingWeeks, variations, comparisonRange, performanceNarratives, WEEK_RULE, round } from '../shared/rm-performance.mjs';
import { shiftBusinessDate } from '../shared/business-date.mjs';
import { rmMyDayTables, rmMyDaySummary } from './rm-my-day-report.mjs';
import { reportAttendance, reportThrustYtd } from './rm-report-v4.mjs';
import { rmMyDayEntries } from './rm-my-day-entries.mjs';

/** Read-only V2 projection. Uses the existing verified RM/team IDs and accounting predicates. */
export function buildRmPerformanceReport(database, { rm, crmUser, linkedUserIds, crmUsers, ownershipMapping, selection, today, snapshot, financialYears, thrust, targetScope='rm', discloseCompanyTotal=false }) {
  const range = rmReportPeriod({ ...selection, weekScheme: 'four' });
  const historical = range.to < today;
  const future = range.from > today;
  const cutoff = range.to < today ? range.to : today;
  const ids = linkedUserIds;
  const placeholders = ids.length ? ids.map(() => '?').join(',') : "''";
  const names = [rm.name, ...rm.aliases];
  const nameSlots = names.map(() => '?').join(',');
  const months = financialMonths(selection.financialYear);
  const fyFrom = months[0].from, fyTo = months[11].to;
  const targets = targetScope==='salesperson'?new Map():new Map(database.prepare(`SELECT period,SUM(target_lakh*100000) value FROM tally_rm_targets WHERE rm_name IN (${nameSlots}) AND period BETWEEN ? AND ? GROUP BY period`).all(...names, fyFrom.slice(0,7), fyTo.slice(0,7)).map(row => [row.period, row.value]));
  // One grouped scan supplies every chart bucket and comparable period.
  const dailyFinancials = database.prepare(`SELECT i.invoice_date day,SUM(${netInvoiceAmount('i')}) value,COUNT(*) count FROM tally_invoices i JOIN tally_customers c ON c.id=i.customer_id WHERE ${authoritativeInvoiceWhere('i')} AND c.owner_user_id IN (${placeholders}) AND i.invoice_date BETWEEN ? AND ? GROUP BY i.invoice_date`).all(...ids,`${Number(fyFrom.slice(0,4))-1}-04-01`,today < fyTo ? today : fyTo);
  const liveYearCount = dailyFinancials.filter(row=>row.day>=fyFrom&&row.day<=fyTo).reduce((sum,row)=>sum+row.count,0);
  const financialYearOf = day => Number(day.slice(0,4))-(Number(day.slice(5,7))<4?1:0);
  const evidencedYears = new Set(dailyFinancials.map(row=>financialYearOf(row.day)));
  // Use a single financial source for the whole FY, avoiding month-by-month source switching.
  const priorSourceYear = snapshot ? `${Number(snapshot.financialYear.slice(0,4))-1}-${snapshot.financialYear.slice(2,4)}` : null;
  const priorSource = snapshot && selection.financialYear === priorSourceYear;
  const sourceSnapshot = !liveYearCount && (snapshot?.financialYear === selection.financialYear || priorSource) ? snapshot : null;
  const sourceAsOf = sourceSnapshot?.asOf < today ? sourceSnapshot.asOf : today;
  const asOf = sourceSnapshot ? (cutoff < sourceAsOf ? cutoff : sourceAsOf) : cutoff;
  const chartAsOf = sourceSnapshot ? sourceAsOf : today;
  const canReadSales = ownershipMapping === 'verified';
  const liveSales = (from, to) => !canReadSales || from > to || !evidencedYears.has(financialYearOf(from)) ? null : round(dailyFinancials.filter(row=>row.day>=from&&row.day<=to).reduce((sum,row)=>sum+row.value,0));
  const asMoney = value => value == null ? null : round(value * 100000);
  const snapshotMonths = new Map((sourceSnapshot ? priorSource ? sourceSnapshot.previousYearPerformance.map((row,index)=>({...row,period:months[index].key,achieved:row.actual})) : sourceSnapshot.monthlyMetrics : []).map(row => [row.period, row]));
  const sumKnown = values => values.length && values.every(v => v != null) ? round(values.reduce((a,b) => a+b,0)) : null;
  const snapshotActual = (from, to) => {
    const month = snapshotMonths.get(from.slice(0,7));
    if (!month || to > chartAsOf) return null;
    const days = new Date(Date.UTC(Number(from.slice(0,4)),Number(from.slice(5,7)),0)).getUTCDate();
    if (from.endsWith('-01') && Number(to.slice(8)) === days) return asMoney(month.achieved);
    const week = reportingWeeks(selection.financialYear, Number(from.slice(5,7))).find(w => w.from === from && w.to === to);
    return week && !priorSource ? asMoney(sourceSnapshot.weeklySummary?.[week.week-1]?.achieved?.[months.findIndex(m=>m.key===from.slice(0,7))]) : null;
  };
  const selectedMonth = Number(selection.month ?? Number(today.slice(5,7)));
  const selectedWeeks = reportingWeeks(selection.financialYear, selectedMonth);
  const getTarget = (from, to, week) => {
    const index = months.findIndex(m=>m.key===from.slice(0,7));
    const storedWeekly = sourceSnapshot && week && !priorSource ? asMoney(sourceSnapshot.weeklySummary?.[week-1]?.targets?.[index]) : null;
    if (sourceSnapshot && week) return { value: storedWeekly, basis: 'Stored source weekly target (blank means unavailable)' };
    const map = sourceSnapshot ? new Map([...snapshotMonths].map(([key,row])=>[key,asMoney(row.target)])) : targets;
    // Allocate rounding residual to the last bucket so four live targets reconcile to the stored month.
    const value = week === 4 && map.has(from.slice(0,7)) ? round(map.get(from.slice(0,7)) - reportingWeeks(selection.financialYear,Number(from.slice(5,7))).slice(0,3).reduce((sum,w)=>sum+targetForRange(map,w.from,w.to),0)) : targetForRange(map,from,to);
    return { value, basis: from.endsWith('-01') && Number(to.slice(8)) === new Date(Date.UTC(Number(to.slice(0,4)),Number(to.slice(5,7)),0)).getUTCDate() ? 'Stored monthly target' : 'Monthly target prorated by calendar days; no configured weekly target' };
  };
  const rowFor = (row, reportType) => {
    const end = row.to < chartAsOf ? row.to : chartAsOf;
    const rowSelection = { financialYear: selection.financialYear, reportType, month: row.month ?? Number(row.from.slice(5,7)), week: row.week, weekScheme: 'four' };
    const comparison = comparisonRange(rowSelection,end);
    const actual = sourceSnapshot ? snapshotActual(row.from,row.to) : liveSales(row.from,end);
    let previous = comparison ? liveSales(comparison.from, comparison.to) : null;
    if (sourceSnapshot) {
      const prevIndex = months.findIndex(m=>m.key===row.from.slice(0,7))-1;
      previous = row.week ? (row.week > 1 ? snapshotActual(shiftBusinessDate(row.from,-7),shiftBusinessDate(row.from,-1)) : null) : prevIndex >= 0 ? snapshotActual(months[prevIndex].from,months[prevIndex].to) : null;
    }
    const target = getTarget(row.from,row.to,row.week);
    return { ...row, ...variations(actual,target.value,previous), partial: row.from <= chartAsOf && row.to > chartAsOf, source: sourceSnapshot ? 'Supplied PDF snapshot' : 'Tally net invoices', targetBasis: target.basis };
  };
  const yearRows = months.map(row=>rowFor(row,'monthly'));
  const weekRows = selectedWeeks.map(row=>rowFor(row,'weekly'));
  let actual, target;
  const annualTarget = sourceSnapshot ? sumKnown(yearRows.map(row=>row.target)) : targetForRange(targets,fyFrom,fyTo);
  if (selection.reportType === 'yearly') {
    const eligible = yearRows.filter(row=>row.to<=asOf);
    actual = sourceSnapshot ? sumKnown(eligible.map(row=>row.actual)) : liveSales(range.from,cutoff);
    // Annual targets and elapsed targets are intentionally separate.
    target = sourceSnapshot ? sumKnown(eligible.map(row=>row.target)) : future ? null : targetForRange(targets,range.from,cutoff);
  } else {
    const selectedRow = selection.reportType === 'weekly' ? weekRows[Number(selection.week)-1] : yearRows.find(row=>row.month===Number(selection.month));
    actual = selectedRow?.actual ?? null;
    target = selectedRow?.target ?? null;
  }
  let comparison = comparisonRange(selection,asOf);
  if (sourceSnapshot && selection.reportType === 'monthly') {
    const previousMonth = months[months.findIndex(month => month.month === Number(selection.month)) - 1];
    // PDF snapshots supply full monthly totals, never an inferred daily split.
    if (previousMonth) comparison = { from:previousMonth.from, to:previousMonth.to, label:'Previous source-reported month (full calendar month)' };
  }
  let previous = comparison ? liveSales(comparison.from,comparison.to) : null;
  if (sourceSnapshot) {
    if (selection.reportType === 'yearly') {
      const eligibleCount = yearRows.filter(row=>row.to<=asOf).length;
      previous = priorSource ? null : sumKnown((sourceSnapshot.previousYearPerformance ?? []).slice(0,eligibleCount).map(row=>asMoney(row.actual)));
    } else previous = (selection.reportType === 'weekly' ? weekRows[Number(selection.week)-1] : yearRows.find(row=>row.month===Number(selection.month)))?.previousActual ?? null;
  }
  const summary = variations(actual,target,previous);
  // Keep operational events at the same as-of date as the displayed financial report.
  const statusUnavailable = historical || asOf < today;
  const params = [...ids,range.from,asOf];
  const activityAvailable = canReadSales && !future && range.from <= asOf;
  const visits = database.prepare(`SELECT v.id,v.business_date date,c.name customerName,v.purpose,v.outcome,v.status,date(v.completed_at,'+5 hours','+30 minutes') completedDate FROM visits v LEFT JOIN tally_customers c ON c.id=v.tally_customer_id WHERE v.user_id IN (${placeholders}) AND v.business_date BETWEEN ? AND ? ORDER BY v.business_date,v.id`).all(...params);
  const completed = visits.filter(v=>v.status==='completed' && v.completedDate && v.completedDate<=asOf);
  const calls = database.prepare(`SELECT COUNT(*) count FROM customer_activities WHERE user_id IN (${placeholders}) AND activity_type IN ('call','call_incoming','call_outgoing') AND date(occurred_at,'+5 hours','+30 minutes') BETWEEN ? AND ?`).get(...params).count;
  const contacts = database.prepare(`SELECT COUNT(DISTINCT customerId) count FROM (SELECT tally_customer_id customerId FROM customer_activities WHERE user_id IN (${placeholders}) AND activity_type IN ('call','call_incoming','call_outgoing') AND date(occurred_at,'+5 hours','+30 minutes') BETWEEN ? AND ? UNION SELECT tally_customer_id FROM visits WHERE user_id IN (${placeholders}) AND status='completed' AND completed_at IS NOT NULL AND date(completed_at,'+5 hours','+30 minutes')<=? AND business_date BETWEEN ? AND ?)`).get(...params,...ids,asOf,range.from,asOf).count;
  const followUps = statusUnavailable || future ? [] : database.prepare(`SELECT f.id,f.title,c.name customerName,f.due_date dueDate,f.priority FROM follow_ups f LEFT JOIN tally_customers c ON c.id=f.tally_customer_id WHERE f.user_id IN (${placeholders}) AND f.completed=0 AND f.due_date BETWEEN ? AND ? ORDER BY f.due_date,f.id`).all(...params);
  const pipeline = statusUnavailable || future ? [] : database.prepare(`SELECT e.id,c.name customerName,p.name productName,e.expected_value expectedValue,e.expected_date expectedDate FROM expected_orders e LEFT JOIN tally_customers c ON c.id=e.tally_customer_id LEFT JOIN tally_products p ON p.id=e.tally_product_id WHERE e.user_id IN (${placeholders}) AND e.status='open' AND COALESCE(e.expected_date,date(e.created_at,'+5 hours','+30 minutes')) BETWEEN ? AND ? ORDER BY e.expected_date,e.id`).all(...params);
  const dealers = database.prepare(`SELECT c.id,c.name,c.city,COUNT(*) invoiceCount,SUM(${netInvoiceAmount('i')}) salesValue FROM tally_invoices i JOIN tally_customers c ON c.id=i.customer_id WHERE ${authoritativeInvoiceWhere('i')} AND c.owner_user_id IN (${placeholders}) AND i.invoice_date BETWEEN ? AND ? GROUP BY c.id ORDER BY salesValue DESC,c.id`).all(...params);
  const products = database.prepare(`SELECT l.product_name name,SUM(${netInvoiceLineAmount('i','l')}) salesValue,COUNT(DISTINCT i.id) invoiceCount FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id JOIN tally_customers c ON c.id=i.customer_id WHERE ${authoritativeInvoiceWhere('i')} AND c.owner_user_id IN (${placeholders}) AND i.invoice_date BETWEEN ? AND ? GROUP BY l.product_name ORDER BY salesValue DESC,l.product_name`).all(...params);
  const invoices = database.prepare(`SELECT i.invoice_date date,i.voucher_number number,c.name customerName,${netInvoiceAmount('i')} amount FROM tally_invoices i JOIN tally_customers c ON c.id=i.customer_id WHERE ${authoritativeInvoiceWhere('i')} AND c.owner_user_id IN (${placeholders}) AND i.invoice_date BETWEEN ? AND ? ORDER BY i.invoice_date,i.id`).all(...params);
  const dormant = database.prepare(`SELECT c.name,c.city,MAX(i.invoice_date) lastInvoiceDate FROM tally_customers c JOIN tally_invoices i ON i.customer_id=c.id AND ${authoritativeInvoiceWhere('i')} AND i.invoice_date<=? WHERE c.owner_user_id IN (${placeholders}) GROUP BY c.id HAVING MAX(i.invoice_date) < ? ORDER BY lastInvoiceDate`).all(asOf,...ids,shiftBusinessDate(asOf,-90));
  const team = crmUsers.filter(u=>u.role==='salesperson' && u.manager_user_id===crmUser?.id).map(u=>({name:u.full_name,territory:u.territory ?? null}));
  const teamSales = database.prepare(`SELECT p.full_name name,p.territory,SUM(${netInvoiceAmount('i')}) salesValue FROM tally_invoices i JOIN tally_customers c ON c.id=i.customer_id JOIN salesperson_profiles p ON p.user_id=c.owner_user_id WHERE ${authoritativeInvoiceWhere('i')} AND c.owner_user_id IN (${placeholders}) AND i.invoice_date BETWEEN ? AND ? GROUP BY p.user_id ORDER BY salesValue DESC`).all(...params);
  const lastSyncAt = database.prepare("SELECT MAX(completed_at) value FROM tally_sync_runs WHERE status='completed'").get()?.value ?? null;
  const limitations = [
    ...(targetScope==='salesperson'?['Verified period-specific salesperson targets are unavailable. RM targets and supplied RM snapshots are not allocated to a salesperson.']:[]),
    'Historical customer assignments are not versioned. Sales use the current verified ownership mapping.',
    'Net sales reflect recorded authoritative invoices, not proof of complete Tally coverage. A financial year with no invoice evidence is unavailable, not zero.',
    'Customer creation dates and complete historical contact coverage are unavailable; acquisition and uncontacted-account counts are not inferred.',
    ...(statusUnavailable ? ['Historical follow-up and pipeline status cannot be reconstructed; these metrics are unavailable.'] : []),
    'Visit completion uses recorded completion timestamps; missing timestamps are not treated as evidence of completion by the cutoff.',
    ...(sourceSnapshot ? ['Financials use supplied PDF aggregates, not invoice detail. Blank achievements remain unavailable. Source rounding may cause weekly/monthly reconciliation differences; totals are never forced to agree.', 'Operational tables use CRM records only and are not inferred from the PDF. Events after the displayed source cutoff are excluded.'] : []),
    ...(!canReadSales ? ['No unique active RM profile is mapped; live financial and activity metrics are unavailable.'] : []),
  ];
  const source = sourceSnapshot ? 'Supplied PDF snapshot' : 'Tally net invoices';
  // Saved CRM inputs have their own visible window. An older sales snapshot must
  // not hide newer entries made within the selected FY/month/week.
  const myDayAvailable=canReadSales&&!future&&range.from<=cutoff;
  const myDayTables=rmMyDayTables(database,{ids,from:range.from,asOf:cutoff,available:myDayAvailable});
  const myDayEntries=rmMyDayEntries(database,{ids,from:range.from,asOf:cutoff,available:myDayAvailable});
  const myDaySummary=rmMyDaySummary(myDayTables,{asOf:cutoff,available:myDayAvailable});
  if(historical){myDaySummary.followUpsOpen=null;myDaySummary.followUpsOverdue=null;myDaySummary.expectedOrdersValue=null;}
  const tables = [
    { id:'customers',title:'Customer performance',columns:['Customer','City','Net sales','Invoices'],rows:dealers.map(d=>[d.name,d.city,d.salesValue,d.invoiceCount]) },
    { id:'products',title:'Product performance',columns:['Product','Net sales','Invoices'],rows:products.map(p=>[p.name,p.salesValue,p.invoiceCount]) },
    { id:'invoices',title:'Actual sales / invoice detail',columns:['Date','Invoice','Customer','Net sales'],rows:invoices.map(i=>[i.date,i.number,i.customerName,i.amount]) },
    { id:'dormant',title:'Dormant customers',note:'No authoritative invoice for 90+ days at the reporting cutoff. Historical assignment is unversioned.',columns:['Customer','City','Last invoice'],rows:dormant.map(d=>[d.name,d.city,d.lastInvoiceDate]) },
    { id:'team',title:'Team and territory performance',columns:['Executive','Territory','Net sales'],rows:teamSales.map(t=>[t.name,t.territory,t.salesValue]) },
    { id:'visits',title:'Visits and field activity',note:'Outcomes are current stored text. Completion at cutoff requires a timestamp; later or undated completions are explicitly unverified.',columns:['Date','Customer','Purpose','Recorded outcome'],rows:visits.map(v=>[v.date,v.customerName,v.purpose,v.status==='completed'&&(!v.completedDate||v.completedDate>asOf)?'Completion at cutoff unverified':v.outcome ?? v.status]) },
    { id:'followups',title:'Follow-ups',note:statusUnavailable?'Historical open/overdue status unavailable.':'Currently open follow-ups due within the selected range.',columns:['Due date','Customer','Title','Priority'],rows:followUps.map(f=>[f.dueDate,f.customerName,f.title,f.priority]) },
    { id:'pipeline',title:'Sales pipeline',note:statusUnavailable?'Historical open pipeline unavailable.':'Currently open possible orders due in this range; not billed sales.',columns:['Expected date','Customer','Product','Expected value'],rows:pipeline.map(p=>[p.expectedDate,p.customerName,p.productName,p.expectedValue]) },
  ];
  const thrustYtd = reportThrustYtd(database,{ids,from:fyFrom,to:asOf,available:canReadSales,thrust,discloseCompanyTotal});
  tables.splice(1,0,{id:'thrust',title:'Thrust products — YTD performance',note:thrustYtd.note,columns:['Product','YTD net sales','Company contribution %'],rows:thrustYtd.products.map(p=>[p.name,p.sales,p.companyContributionPercent])});
  const report = {
    version:2,id:rm.id,name:rm.name,rmCode:targetScope==='rm'&&rm.name.trim().toLocaleLowerCase()==='rais khan'?'033705':crmUser?.employee_code ?? snapshot?.rm.rmCode ?? null,region:crmUser?.region ?? null,territory:crmUser?.territory ?? null,operatingFrom:crmUser?.operating_city ?? snapshot?.rm.operatingFrom ?? null,
    selectedPeriod:{...selection,weekScheme:'four'},from:range.from,to:range.to,asOf,historical,future,
    reportLabel:`FY ${selection.financialYear}${selection.reportType!=='yearly'?` / ${new Date(`${range.from}T12:00:00Z`).toLocaleString('en-IN',{month:'long',timeZone:'UTC'})}`:''}${selection.reportType==='weekly'?` / Week ${selection.week}`:''}`,
    financialYears:[...new Set([...financialYears,selection.financialYear])].sort().reverse(),ownershipMapping,source,sourceAsOf:sourceSnapshot?.asOf??null,lastSyncAt,limitations,weekRule:WEEK_RULE,
    summary,annualTarget,comparison,
    kpi:{actualSalesValue:actual,targetValue:target,achievementPercent:summary.achievementPercent,visitsPlanned:activityAvailable?visits.length:null,visitsCompleted:activityAvailable?completed.length:null,callsLogged:activityAvailable?calls:null,customersContacted:activityAvailable?contacts:null,followUpsOpen:activityAvailable&&!statusUnavailable?followUps.length:null,followUpsOverdue:activityAvailable&&!statusUnavailable?followUps.filter(f=>f.dueDate<today).length:null,expectedOrdersValue:activityAvailable&&!statusUnavailable?pipeline.reduce((s,p)=>s+p.expectedValue,0):null},
    activeDealerCount:canReadSales&&liveYearCount>0&&!future&&!sourceSnapshot?dealers.length:null,yearRows,weekRows,periodChartRows:selection.reportType==='yearly'?yearRows:selection.reportType==='monthly'?weekRows:[weekRows[Number(selection.week)-1]],
    technicalService:snapshot?.technicalService,executiveTerritoryCoverage:snapshot?.teamEntries?.length?{asOf:snapshot.asOf,entries:snapshot.teamEntries}:null,team,tables,narratives:[],
    myDayTables,myDayEntries,myDayRange:{from:range.from,to:cutoff},myDaySummary,
  };
  report.topSales=rmTopSales(database,{ids,dealers,from:range.from,to:asOf,totalSales:actual,
    available:canReadSales&&ids.length>0&&!future&&!sourceSnapshot&&actual!=null,
    reason:!canReadSales?'Verified RM ownership is unavailable.':sourceSnapshot?'This report uses aggregate snapshot sales; customer and product invoice breakdowns are unavailable.':future?'The selected reporting period is in the future.':'No authoritative Tally invoice evidence exists for this reporting period.'});
  report.thrustYtd=thrustYtd;
  report.attendance=reportAttendance(database,{user:crmUser,name:report.name,code:report.rmCode,financialYear:selection.financialYear,cutoff:fyTo<today?fyTo:today,today});
  report.narratives=performanceNarratives(report);
  return report;
}
