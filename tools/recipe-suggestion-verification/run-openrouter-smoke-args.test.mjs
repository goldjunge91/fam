import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_RETRIES, parseSmokeArgs } from './run-openrouter-smoke-args.mjs';

const scenarioIds = ['first', 'second'];

test('defaults to the first scenario and makes one provider attempt', () => {
  assert.deepEqual(parseSmokeArgs([], scenarioIds), { scenarioId: 'first', retries: 0 });
});

test('parses a bounded retry count in both CLI forms', () => {
  assert.deepEqual(parseSmokeArgs(['second', '--retries', '2'], scenarioIds), {
    scenarioId: 'second',
    retries: 2,
  });
  assert.deepEqual(parseSmokeArgs(['--retries=3'], scenarioIds), {
    scenarioId: 'first',
    retries: MAX_RETRIES,
  });
});

test('rejects invalid, excessive and ambiguous retry arguments', () => {
  assert.throws(() => parseSmokeArgs(['--retries'], scenarioIds), /benötigt einen Wert/);
  assert.throws(() => parseSmokeArgs(['--retries', '-1'], scenarioIds), /ganze Zahl/);
  assert.throws(() => parseSmokeArgs(['--retries', '1.5'], scenarioIds), /ganze Zahl/);
  assert.throws(() => parseSmokeArgs(['--retries', '4'], scenarioIds), /höchstens 3/);
  assert.throws(() => parseSmokeArgs(['first', 'second'], scenarioIds), /nur ein Szenario/);
  assert.throws(() => parseSmokeArgs(['third'], scenarioIds), /Unbekanntes Szenario/);
});
