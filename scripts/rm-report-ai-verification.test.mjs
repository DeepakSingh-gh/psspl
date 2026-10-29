import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {finalReportFixture} from './fixtures/rm-report-finalization.mjs';

test('existing AI flow keeps RM/period facts, cache isolation and honest failure handling',async()=>{
  const root=mkdtempSync(join(tmpdir(),'psspl-final-ai-'));
  process.env.NODE_ENV='test';process.env.CRM_TEST_DATABASE_ROOT=root;process.env.CRM_DATABASE_PATH=join(root,'isolated.sqlite');process.env.CRM_DISABLE_BASELINE_RESTORE='true';
  const {enrichPerformanceReview}=await import('../server/rm-ai-analysis.mjs');
  const {db}=await import('../server/db.mjs');
  try{
    for(const selection of [{reportType:'yearly'},{reportType:'monthly',month:9},{reportType:'weekly',month:9,week:2}]){
      const raw=finalReportFixture(selection);let calls=0;
      const provider=async(system,payload)=>{calls++;const data=JSON.parse(payload);assert.equal(data.period,raw.reportLabel);assert.equal(data.from,raw.from);assert.equal(data.to,raw.to);assert.equal(data.historical,raw.historical);assert.deepEqual(data.summary,raw.summary);assert.deepEqual(data.kpi,raw.kpi);assert.deepEqual(data.findings,raw.narratives);assert.match(system,/Historical findings are retrospective/);return JSON.stringify({order:raw.narratives.map(n=>n.id).reverse()});};
      const result=await enrichPerformanceReview(raw,{configured:true,provider});assert.equal(result.analysisMethod,'ai-assisted');assert.deepEqual(result.summary,raw.summary);assert.deepEqual(result.kpi,raw.kpi);assert.deepEqual(result.narratives,[...raw.narratives].reverse());
      await enrichPerformanceReview(raw,{configured:true,provider});assert.equal(calls,1,'same context is cached');
      await enrichPerformanceReview({...raw,id:'another-rm'},{configured:true,provider});assert.equal(calls,2,'another RM is independently scoped');
    }
    const raw=finalReportFixture();
    const failure=await enrichPerformanceReview({...raw,id:'failure-scope'},{configured:true,provider:async()=>{throw new Error('Isolated provider failure');}});assert.equal(failure.analysisMethod,'rule-based');assert.ok(failure.analysisNote);assert.deepEqual(failure.narratives,raw.narratives);
    const invalid=await enrichPerformanceReview({...raw,id:'invalid-scope'},{configured:true,provider:async()=>JSON.stringify({order:['invented'],actual:999})});assert.equal(invalid.analysisMethod,'rule-based');assert.deepEqual(invalid.summary,raw.summary);
    const disabled=await enrichPerformanceReview(raw,{configured:false,provider:async()=>{throw new Error('Provider should not be called');}});assert.equal(disabled.analysisMethod,'rule-based');
  }finally{db.close();assert.ok(resolve(root).startsWith(resolve(tmpdir())));rmSync(root,{recursive:true,force:true});}
});
