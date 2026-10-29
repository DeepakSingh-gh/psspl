import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/components/reports/rm-pdf-pagination.ts', import.meta.url), 'utf8');
const exports = {};
new Function('exports', ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText)(exports);
const { paginatePdfBlocks: paginate } = exports;
const keys = pages => pages.map(page => page.map(item => item.keys.join('+')));

test('complete blocks fill the current page whenever they fit, including fractional heights', () => {
  assert.deepEqual(keys(paginate([{ key: 'a', height: 40.25 }, { key: 'b', height: 59.75 }, { key: 'c', height: 1 }], 100)), [['a', 'b'], ['c']]);
  assert.deepEqual(paginate([], 100), []);
});

test('section headings stay with their first complete row', () => {
  const blocks = [{ key: 'previous', height: 50 }, { key: 'title', height: 20, keepNext: true }, { key: 'row', height: 40 }];
  assert.deepEqual(keys(paginate(blocks, 100)), [['previous'], ['title', 'row']]);
});

test('product rows stay whole and continuation headings consume available height', () => {
  const blocks = [{ key: 'products', height: 25, continuationHeight: 10, keepNext: true },
    ...[60, 70, 15].map((height, index) => ({ key: `row-${index}`, height, continuationKey: 'products' }))];
  const pages = paginate(blocks, 100);
  assert.deepEqual(keys(pages), [['products', 'row-0'], ['products', 'row-1', 'row-2']]);
  assert.equal(pages[1][0].continuation, true);
});

test('adjacent insight cards use two columns and the taller card determines row height', () => {
  const blocks = [{ key: 'title', height: 10, keepNext: true },
    ...[70, 80, 5, 5].map((height, index) => ({ key: `insight-${index}`, height, pairWithNext: true }))];
  assert.deepEqual(keys(paginate(blocks, 100)), [['title', 'insight-0+insight-1', 'insight-2+insight-3']]);
});

test('a smaller insight uses remaining page space when its taller neighbor cannot fit', () => {
  const blocks = [{ key: 'previous', height: 50 }, { key: 'insights', height: 10, keepNext: true },
    { key: 'small', height: 25, pairWithNext: true, continuationKey: 'insights' },
    { key: 'large', height: 80, pairWithNext: true, continuationKey: 'insights' }];
  assert.deepEqual(keys(paginate(blocks, 100)), [['previous', 'insights', 'small'], ['insights', 'large']]);
});

test('an odd insight count does not prevent the next section from filling the page', () => {
  const blocks = [{ key: 'insight', height: 30, pairWithNext: true },
    { key: 'actions', height: 10, keepNext: true }, { key: 'action', height: 60 }];
  assert.deepEqual(keys(paginate(blocks, 100)), [['insight', 'actions', 'action']]);
});

test('complete action items keep reading order and input measurements remain unchanged', () => {
  const blocks = Object.freeze([{ key: 'actions', height: 15, keepNext: true },
    ...[40, 40, 40].map((height, index) => ({ key: `action-${index}`, height, continuationKey: 'actions' }))].map(Object.freeze));
  const pages = paginate(blocks, 100);
  assert.deepEqual(pages.flat().filter(item => !item.continuation).flatMap(item => item.keys), blocks.map(block => block.key));
  assert.deepEqual(keys(pages), [['actions', 'action-0', 'action-1'], ['actions', 'action-2']]);
});

test('oversized cards, orphaned headings and continuation overflow are reported instead of clipped', () => {
  assert.throws(() => paginate([{ key: 'large', height: 101 }], 100));
  assert.throws(() => paginate([{ key: 'title', height: 30, keepNext: true }, { key: 'card', height: 80 }], 100));
  assert.throws(() => paginate([{ key: 'title', height: 20 }, { key: 'prior', height: 70 }, { key: 'card', height: 90, continuationKey: 'title' }], 100));
  assert.throws(() => paginate([], 0));
});
