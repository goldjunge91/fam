import type { Query } from '@tanstack/react-query';

import { shouldPersistQuery } from '@/lib/query-client';

function fakeQuery(queryKey: readonly unknown[]): Query {
  return { queryKey } as Query;
}

describe('shouldPersistQuery', () => {
  it('persistiert Kalorien-Tracking-Queries', () => {
    expect(
      shouldPersistQuery(fakeQuery(['calorie-tracking', 'food-entries', 'u1', '2026-08-10'])),
    ).toBe(true);
    expect(shouldPersistQuery(fakeQuery(['calorie-tracking', 'goal', 'current', 'u1']))).toBe(true);
    expect(shouldPersistQuery(fakeQuery(['calorie-tracking', 'weight', 'latest', 'u1']))).toBe(
      true,
    );
  });

  it('persistiert keine Haushalts-/Kuehlschrankdaten', () => {
    expect(shouldPersistQuery(fakeQuery(['fridge_items', 'hh1']))).toBe(false);
    expect(shouldPersistQuery(fakeQuery(['sync-status']))).toBe(false);
  });
});
