import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function loadHelper(name) {
  const source = readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const exports = {};
  new Function('require', 'exports', outputText)(specifier => {
    assert.equal(specifier, '@/lib/rm-report-demo');
    return loadHelper('rm-report-demo');
  }, exports);
  return exports;
}

const { raisKhanLivePreview } = loadHelper('rais-khan-live-preview');
const emptyPeriod = {
  id: 'raiskhan', from: '2026-10-19', to: '2026-10-22',
  kpi: { actualSalesValue: 0, visitsCompleted: 0, callsLogged: 0, followUpsOpen: 0 },
  customerVisits: [{ status: 'planned' }, { status: 'scheduled' }], pipeline: [],
};

test('planned visits retain the labeled Today and This Week previews without changing source data', () => {
  const original = structuredClone(emptyPeriod);
  for (const [period, actual, bars] of [['today', 86000, 1], ['week', 385000, 6]]) {
    const preview = raisKhanLivePreview(emptyPeriod, period);
    assert.equal(preview.livePreviewDemo, true);
    assert.equal(preview.kpi.actualSalesValue, actual);
    assert.equal(preview.periodChartRows.length, bars);
  }
  assert.deepEqual(emptyPeriod, original);
});

test('reported visits, sales, pipeline, calls and follow-ups suppress the preview', () => {
  for (const status of ['in_progress', 'completed']) {
    assert.equal(raisKhanLivePreview({ ...emptyPeriod, customerVisits: [{ status }] }, 'today'), null);
  }
  for (const key of ['actualSalesValue', 'visitsCompleted', 'callsLogged', 'followUpsOpen']) {
    assert.equal(raisKhanLivePreview({ ...emptyPeriod, kpi: { ...emptyPeriod.kpi, [key]: 1 } }, 'week'), null);
  }
  assert.equal(raisKhanLivePreview({ ...emptyPeriod, pipeline: [{ id: 'real-order' }] }, 'today'), null);
});

test('preview is limited to Rais Khan and the two short periods', () => {
  assert.equal(raisKhanLivePreview(null, 'today'), null);
  assert.equal(raisKhanLivePreview({ ...emptyPeriod, id: 'another-rm' }, 'today'), null);
  for (const period of ['month', 'fytd']) assert.equal(raisKhanLivePreview(emptyPeriod, period), null);
});
