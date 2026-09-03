import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessSyntheticResponse } from './quality.mjs';
import assertSyntheticQuality from '../promptfoo/assertions/synthetic-quality.js';

const compact = { request: { servings: 3 }, priority_foods: [
  { inventory_item_id: 'spinach', available_quantity: 300, unit: 'g' },
  { inventory_item_id: 'tomato', available_quantity: 4, unit: 'pcs' },
] };
const expected = { servings: 3, required_priority_ids: ['spinach'], min_used_items: 2 };
const response = () => ({ meals: [{ servings: 3, used_items: [
  { inventory_item_id: 'spinach', quantity: 150, unit: 'g' },
  { inventory_item_id: 'tomato', quantity: 2, unit: 'pcs' },
] }] });

test('synthetic quality reports unit-independent consumption metrics', () => {
  const result = assessSyntheticResponse(JSON.stringify(response()), compact, expected);
  assert.equal(result.pass, true);
  assert.deepEqual(result.metrics, { priority_item_coverage: 1, mean_available_quantity_used: 0.5 });
});

test('synthetic expectations reject wrong servings, no food use and skipped urgent food', () => {
  for (const mutate of [
    (value) => { value.meals[0].servings = 2; },
    (value) => { value.meals[0].used_items = []; },
    (value) => { value.meals[0].used_items.shift(); },
    (value) => { value.meals[0].used_items.pop(); },
  ]) {
    const value = response();
    mutate(value);
    assert.equal(assessSyntheticResponse(value, compact, expected).pass, false);
  }
});

test('Promptfoo quality adapter uses only explicit test expectations and fails closed', () => {
  assert.equal(assertSyntheticQuality(JSON.stringify(response()), { vars: {
    compact_context: JSON.stringify(compact), expected: JSON.stringify(expected),
  } }).pass, true);
  assert.equal(assertSyntheticQuality('{}', { vars: {} }).pass, false);
  assert.equal(assertSyntheticQuality('not json', { vars: {
    compact_context: JSON.stringify(compact), expected: JSON.stringify(expected),
  } }).pass, false);
});
