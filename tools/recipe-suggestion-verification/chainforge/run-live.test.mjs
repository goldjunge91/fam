import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./run-live.mjs', import.meta.url));
const run = (...args) => execFileSync(process.execPath, [script, ...args], {
  encoding: 'utf8', timeout: 10_000, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, OPENROUTER_API_KEY: '' },
});

test('ChainForge dry-run resolves exactly the twelve flow cases without a key or network', () => {
  const cases = JSON.parse(run('--dry-run'));
  assert.equal(cases.length, 12);
  assert.equal(new Set(cases.map((item) => item.model)).size, 3);
  assert.equal(new Set(cases.map((item) => item.scenario_id)).size, 4);
});

test('ChainForge control selections preserve model IDs and reject unknown or duplicate input', () => {
  assert.deepEqual(JSON.parse(run('--dry-run', '--model', 'upstage/solar-pro4', '--scenario', 'empty-shopping-list')), [
    { model: 'upstage/solar-pro4', scenario_id: 'empty-shopping-list' },
  ]);
  for (const args of [
    ['--model', 'unknown'], ['--scenario', 'unknown'],
    ['--model', 'upstage/solar-pro4', '--model', 'upstage/solar-pro4'],
  ]) assert.throws(() => run('--dry-run', ...args));
});
