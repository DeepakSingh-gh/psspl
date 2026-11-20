import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { financialMonths, reportingWeeks, variations } from '../shared/rm-performance.mjs';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime.js';

// Execute the real TSX components without starting the app or accessing a database.
const require = createRequire(import.meta.url), cache = new Map();
function componentModule(path) {
  const file = resolve(path);
  if (extname(file) === '.css') return {};
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const localRequire = name => {
    if (!name.startsWith('.') && !name.startsWith('@/')) return require(name);
    const target = name.startsWith('@/') ? resolve('src', name.slice(2)) : resolve(dirname(file), name);
    if (extname(target) === '.mjs') return require(target);
    const found = extname(target) ? target : ['.tsx', '.ts'].map(suffix => target + suffix).find(candidate => {
      try { readFileSync(candidate); return true; } catch { return false; }
    });
    return componentModule(found);
  };
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return module.exports;
}
const { PerformanceSummary } = componentModule('src/components/reports/rm-performance-view.tsx');
const { ThrustProductCells } = componentModule('src/components/reports/rm-thrust-products.tsx');
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
const report = summary => ({
  selectedPeriod: { reportType: 'yearly' }, historical: false, asOf: '2026-09-30', annualTarget: null,
  summary, kpi: { visitsCompleted: null, visitsPlanned: null, followUpsOpen: null },
  // Legacy metadata must never turn an unknown fact into an invented amount.
  clientSnapshotFallback: { fields: [] },
});

test('missing report facts remain unavailable even with legacy snapshot metadata', () => {
  const html = render(PerformanceSummary, { report: report({ actual: 100000, target: 200000, achievementPercent: null, variation: null, previousActual: null, growthPercent: null }) });
  assert.doesNotMatch(html, /41\.93|14\.07|50\.00%|>8</);
  assert.match(html, /Achievement<\/span><strong>N\/A/);
  assert.match(html, /Pending follow-ups<\/span><strong>N\/A/);
});

test('recorded zero and signed report amounts remain visible', () => {
  const html = render(PerformanceSummary, { report: report({ actual: 0, target: 100000, achievementPercent: 0, variation: -100000, previousActual: 0, growthPercent: -100 }) });
  assert.match(html, /Actual sales<\/span><strong>₹0/);
  assert.match(html, /Achievement<\/span><strong>0\.00%/);
  assert.match(html, /-100\.00%/);
});

test('synthetic product metrics never fill missing real sales or contributions', () => {
  const html = render(ThrustProductCells, { products: [{ id: 'unknown', name: 'Recorded portfolio product', sales: null, companyContributionPercent: null, demoMetrics: { sales: 777000, companyContributionPercent: 42 } }] });
  assert.doesNotMatch(html, /7\.77|42\.00/);
  assert.match(html, /YTD net sales unavailable/);
  assert.match(html, /Company contribution unavailable/);
});

test('synthetic product examples never appear beside recorded zero or signed sales', () => {
  const html = render(ThrustProductCells, { products: [{ id: 'known', name: 'Recorded product', sales: -100000, companyContributionPercent: 0, demoMetrics: { sales: 777000, companyContributionPercent: 42 } }] });
  assert.match(html, /-1\.00 L/);
  assert.match(html, /0\.00%/);
  assert.doesNotMatch(html, /7\.77|42\.00/);
});

test('the operational workspace renders API records without a snapshot replacing empty CRM entries', () => {
  const from = '2026-04-01', to = '2027-03-31';
  const data = {
    version: 2, id: 'raiskhan', name: 'Rais Khan', rmCode: '033705',
    selectedPeriod: { reportType: 'yearly', financialYear: '2026-27' },
    from, to, asOf: '2026-09-30', reportLabel: 'Verified API report',
    financialYears: ['2026-27'], team: [], salespeople: [], narratives: [], tables: [],
    summary: variations(null, null), kpi: {}, myDayEntries: [], ownershipMapping: 'verified',
    yearRows: financialMonths('2026-27').map(row => ({ ...row, ...variations(null, null) })),
    weekRows: reportingWeeks('2026-27', 9).map(row => ({ ...row, ...variations(null, null) })),
  };
  // Only the asynchronous data boundary is replaced; the workspace and its visible children execute.
  cache.set(resolve('src/lib/use-admin-data.ts'), { exports: { useAdminData: () => ({ data, loading: false, error: null, reload() {} }) } });
  const { RmPerformanceWorkspace } = componentModule('src/components/admin/rm-performance-workspace.tsx');
  const html = renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: { refresh() {} } }, React.createElement(RmPerformanceWorkspace, { rmId: 'raiskhan' })));
  assert.match(html, /No saved entries in the selected CRM date range/);
  assert.doesNotMatch(html, /Al Sarah Chemicals|Capital Marketing Corp|14\.07|41\.93/);
  assert.match(html, /Download PDF/);
  assert.match(html, /Actual sales<\/span><strong>N\/A/);
});

test('retired production compatibility helpers cannot generate records even when explicitly enabled', async () => {
  const { raisKhanClientSnapshot } = await import('../src/lib/rais-khan-client-snapshot.mjs');
  const { localReportPreview, canUseLocalReportPreview } = await import('../src/lib/rm-client-demo.mjs');
  const raw = { id: 'raiskhan', rmCode: '033705', from: '2026-04-01', asOf: '2026-09-30', selectedPeriod: { financialYear: '2026-27', reportType: 'yearly' }, myDayEntries: [] };
  assert.equal(raisKhanClientSnapshot(raw), raw);
  assert.equal(localReportPreview(raw, { enabled: true, role: 'admin', audience: 'admin', hostname: 'localhost' }), raw);
  assert.equal(canUseLocalReportPreview({ role: 'admin', audience: 'admin', hostname: 'localhost' }), false);
});
