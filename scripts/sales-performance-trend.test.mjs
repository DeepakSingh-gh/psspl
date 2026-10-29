import test from 'node:test';
import assert from 'node:assert/strict';
import {salesTrendPoints,salesComparison,salesAxis,salesMoney,salesLine} from '../src/lib/sales-trend.mjs';
const options={financialYear:'2026-27',periodEnd:'2026-10-26',today:'2026-10-26'};
const row=(period,salesValue,previousSalesValue=50,previousInvoiceCount=1)=>({period,salesValue,previousSalesValue,previousInvoiceCount});
test('FY order, signed/zero amounts, sparse months and future gaps preserve source data',()=>{
 const rows=[row('2026-04',0,0),row('2026-06',-100),row('2026-09',1360000,1110000),row('2027-01',999)];const before=JSON.stringify(rows);
 const points=salesTrendPoints(rows,options);assert.deepEqual(points.map(p=>p.label),['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']);assert.equal(points[0].current,0);assert.equal(points[0].previous,0);assert.equal(points[1].current,null);assert.equal(points[2].current,-100);assert.equal(points[9].current,null);assert.equal(points[5].title,'September 2026');assert.equal(points[6].partial,true);assert.equal(JSON.stringify(rows),before);
 const unknown=salesTrendPoints([row('2026-04',1,0,0)],options);assert.equal(unknown[0].previous,null,'no prior invoices does not establish a zero');
 assert.equal(salesTrendPoints([{period:'2026-04',salesValue:1,previousSalesValue:0}],options)[0].previous,null,'older API zero without supporting invoice metadata remains unavailable');
});
test('quarterly sums use matching elapsed months, never silently sum incomplete evidence',()=>{
 const rows=[row('2026-04',10,5),row('2026-05',20,10),row('2026-06',0,0),row('2026-07',5),row('2026-09',30),row('2026-10',-2,0)];
 const q=salesTrendPoints(rows,{...options,grain:'quarter'});assert.deepEqual(q.map(p=>p.label),['Q1','Q2','Q3','Q4']);assert.equal(q[0].current,30);assert.equal(q[0].previous,15);assert.equal(q[1].current,null);assert.equal(q[2].current,-2);assert.equal(q[2].previous,0);assert.equal(q[2].partial,true);assert.equal(q[3].current,null);
 const leap=salesTrendPoints([],{financialYear:'2023-24',periodEnd:'2024-03-31',today:'2026-10-26'});assert.equal(leap[10].to,'2024-02-29');
});
test('precise growth, zero denominator and currency units remain accurate',()=>{
 const c=salesComparison(1360000,1110000);assert.equal(c.difference,250000);assert.equal(c.growth.toFixed(2),'22.52');assert.equal(salesComparison(1,0).growth,null);assert.equal(salesComparison(null,1).difference,null);assert.equal(salesComparison(-20,100).growth,-120);assert.equal(salesMoney(1360000),'₹13.60L');assert.equal(salesMoney(6000),'₹6.00K');assert.equal(salesMoney(12000000),'₹1.20Cr');assert.equal(salesMoney(null),'N/A');
});
test('shared axis contains zero and signed observations, paths break at missing values',()=>{
 const points=[{current:10,previous:1},{current:null,previous:-7},{current:20,previous:0}];const axis=salesAxis(points);assert.ok(axis.min<=-7&&axis.max>=20);assert.ok(axis.ticks.includes(0));assert.equal(salesLine(points,'current',i=>i,n=>n),'M0,10 M2,20');assert.equal(salesLine(points,'previous',i=>i,n=>n),'M0,1 L1,-7 L2,0');assert.ok(salesAxis([]).max>salesAxis([]).min);
});
