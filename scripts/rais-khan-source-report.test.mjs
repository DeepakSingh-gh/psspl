import test from 'node:test';
import assert from 'node:assert/strict';
import { feedbackById } from '../server/rm-feedback.mjs';
import { rmReportPeriod } from '../shared/rm-report-period.mjs';
import { raisKhanSourceReport } from '../shared/rais-khan-source-report.mjs';

const snapshot = feedbackById('raiskhan');
function input(reportType, options={}) {
  const selectedPeriod = rmReportPeriod({reportType,financialYear:'2026-27',month:9,week:2,weekScheme:'four',...options});
  return {id:'raiskhan',...selectedPeriod,selectedPeriod,suppliedFinancialReport:snapshot,kpi:{actualSalesValue:0},actualSales:[],salesInvoiceCount:0,customerVisits:[{id:'real-visit'}],pipeline:[],followUps:[]};
}

test('existing monthly and four weekly values match the supplied Rais Khan table',()=>{
  const data=input('monthly'), before=structuredClone(data);
  const result=raisKhanSourceReport(data);
  assert.equal(result.kpi.actualSalesValue,656000);
  assert.equal(result.kpi.targetValue,1128000);
  assert.deepEqual(result.periodChartRows.map(row=>row.actual),[null,143000,null,513000]);
  assert.deepEqual(result.periodChartRows.map(row=>row.target),[282000,282000,282000,282000]);
  assert.equal(result.periodChartRows[3].to,'2026-09-30');
  assert.deepEqual(result.customerVisits,data.customerVisits,'CRM activity does not hide financial source history');
  assert.deepEqual(result.actualSales,[],'aggregate PDF values never create invoice records');
  assert.deepEqual(data,before);
});

test('weekly source dates use four buckets and do not invent daily splits or a fifth week',()=>{
  const second=raisKhanSourceReport(input('weekly'));
  assert.equal(second.from,'2026-09-08');
  assert.equal(second.to,'2026-09-14');
  assert.equal(second.kpi.actualSalesValue,143000);
  const fourth=raisKhanSourceReport(input('weekly',{week:4}));
  assert.equal(fourth.from,'2026-09-22');
  assert.equal(fourth.to,'2026-09-30');
  assert.equal(fourth.kpi.actualSalesValue,513000);
  const fifth=raisKhanSourceReport(input('weekly',{week:5,weekScheme:'calendar'}));
  assert.equal(fifth.kpi.actualSalesValue,null);
  assert.equal(fifth.periodChartRows[0].actual,null);
});

test('reported yearly totals and source rounding are preserved; blank months stay unavailable',()=>{
  const result=raisKhanSourceReport(input('yearly'));
  assert.equal(result.periodChartRows.length,12);
  assert.equal(result.kpi.actualSalesValue,5314000);
  assert.equal(result.kpi.targetValue,12300000);
  assert.equal(result.periodChartRows[3].actual,451000);
  assert.equal(result.periodChartRows[6].target,1128000);
  assert.equal(result.periodChartRows[6].actual,null);
  assert.equal(result.periodChartRows.reduce((sum,row)=>sum+(row.actual??0),0),5315000);
  const october=raisKhanSourceReport(input('monthly',{month:10}));
  assert.equal(october.kpi.actualSalesValue,null);
  assert.ok(october.periodChartRows.every(row=>row.actual===null));
  const previous=raisKhanSourceReport(input('yearly',{financialYear:'2025-26'}));
  assert.equal(previous.kpi.actualSalesValue,10552000);
  assert.equal(previous.periodChartRows[0].actual,1197000);
});

test('only Rais Khan can use this fallback, and actual invoices always win',()=>{
  assert.equal(raisKhanSourceReport({...input('monthly'),id:'bobother'}),null);
  assert.equal(raisKhanSourceReport({...input('monthly'),salesInvoiceCount:1}),null);
  assert.equal(raisKhanSourceReport({...input('monthly'),kpi:{actualSalesValue:1200}}),null);
  assert.equal(raisKhanSourceReport(input('monthly',{financialYear:'2024-25'})),null);
});
