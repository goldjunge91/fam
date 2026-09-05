import assert from 'node:assert/strict';
import { test } from 'node:test';
import { priorityScore } from './priority-score.mjs';

const referenceDate = '2026-09-03';

test('earlier best-before dates rank ahead of later dates and undated stock', () => {
  const scores = ['2026-09-03', '2026-09-04', '2026-09-05', '2026-09-17', null]
    .map((bestBefore) => priorityScore({ bestBefore }, referenceDate));
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  assert.equal(new Set(scores).size, scores.length);
  assert.equal(scores.at(-1), 0);
});

test('opening age increases priority and an explicit after-opening window advances urgency', () => {
  const unopened = priorityScore({ bestBefore: '2026-09-20' }, referenceDate);
  const recent = priorityScore({ bestBefore: '2026-09-20', openedAt: '2026-09-02' }, referenceDate);
  const older = priorityScore({ bestBefore: '2026-09-20', openedAt: '2026-08-30' }, referenceDate);
  const due = priorityScore({ bestBefore: '2026-09-20', openedAt: '2026-08-30', consumeWithinDays: 4 }, referenceDate);
  assert.ok(unopened < recent && recent < older && older < due);
});

test('a past best-before date raises urgency without mutating or declaring food unusable', () => {
  const item = Object.freeze({ bestBefore: '2026-09-01', usable: true });
  assert.equal(priorityScore(item, referenceDate), 80);
  assert.equal(item.usable, true);
  assert.equal(priorityScore(item, referenceDate), priorityScore(item, referenceDate));
});

test('UTC dates and timestamps are deterministic across leap days and timezone offsets', () => {
  assert.equal(priorityScore({ bestBefore: '2024-03-01' }, '2024-02-29'), 40);
  assert.equal(priorityScore({ openedAt: '2026-09-02T23:00:00-02:00' }, referenceDate), 5);
  assert.equal(priorityScore({ openedAt: '2026-09-03' }, referenceDate), 5);
});

test('invalid or ambiguous dates, future opening dates and invalid windows fail explicitly', () => {
  for (const reference of [undefined, 'yesterday', '2026-02-30', '2026-09-03T12:00:00']) {
    assert.throws(() => priorityScore({}, reference), /date/i);
  }
  for (const item of [
    { bestBefore: '2026-02-30' }, { openedAt: 'invalid' }, { openedAt: '2026-09-04' },
    { openedAt: '2026-09-01', consumeWithinDays: -1 }, { consumeWithinDays: 3 },
    { openedAt: '2026-09-01', consumeWithinDays: Infinity },
  ]) assert.throws(() => priorityScore(item, referenceDate));
});

test('scores are finite and bounded for long-opened stock and distant dates', () => {
  for (const bestBefore of ['2000-01-01', '2099-01-01']) {
    const score = priorityScore({ bestBefore, openedAt: '2000-01-01' }, referenceDate);
    assert.ok(Number.isFinite(score) && score >= 0 && score <= 100);
  }
});
