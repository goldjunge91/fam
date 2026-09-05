import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeMeasurement } from './unit-normalization.mjs';

test('normalizes compatible mass and volume units without changing the source item', () => {
  assert.deepEqual(normalizeMeasurement(1, 'kg'), {
    quantity: 1000, dimension: 'mass', unit: 'g',
  });
  assert.deepEqual(normalizeMeasurement(0.5, 'l'), {
    quantity: 500, dimension: 'volume', unit: 'ml',
  });
});

test('keeps discrete units separate because pack sizes are not inferable', () => {
  assert.equal(normalizeMeasurement(1, 'pcs').dimension, 'count');
  assert.equal(normalizeMeasurement(1, 'piece').dimension, 'count');
  assert.notEqual(normalizeMeasurement(1, 'pack').dimension, normalizeMeasurement(1, 'pcs').dimension);
  assert.equal(normalizeMeasurement(1, 'unknown'), null);
});
