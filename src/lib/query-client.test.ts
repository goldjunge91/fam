import type { Query } from '@tanstack/react-query';

import { shouldPersistQuery } from '@/lib/query-client';

function fakeQuery(
  queryKey: readonly unknown[],
  status: 'success' | 'pending' | 'error' = 'success',
): Query {
  return { queryKey, state: { status } } as Query;
}

describe('shouldPersistQuery', () => {
  it('persistiert erfolgreich geladene Kalorien-Tracking-Queries', () => {
    expect(
      shouldPersistQuery(fakeQuery(['calorie-tracking', 'food-entries', 'u1', '2026-08-10'])),
    ).toBe(true);
    expect(shouldPersistQuery(fakeQuery(['calorie-tracking', 'goal', 'current', 'u1']))).toBe(true);
    expect(shouldPersistQuery(fakeQuery(['calorie-tracking', 'weight', 'latest', 'u1']))).toBe(
      true,
    );
  });

  it('persistiert das Profil, damit der Kaltstart-Ladeindikator in (app)/_layout.tsx nicht auf jeden Neustart wartet', () => {
    expect(shouldPersistQuery(fakeQuery(['profile', 'u1']))).toBe(true);
  });

  it('persistiert keine Haushalts-/Kuehlschrankdaten', () => {
    expect(shouldPersistQuery(fakeQuery(['fridge_items', 'hh1']))).toBe(false);
    expect(shouldPersistQuery(fakeQuery(['sync-status']))).toBe(false);
  });

  it('persistiert keine noch laufenden oder fehlgeschlagenen Kalorien-Tracking-Queries', () => {
    // Sonst haengt beim App-Kill mitten im Fetch eine tote In-Flight-Promise
    // im AsyncStorage-Cache, die bei jedem folgenden App-Start erneut
    // aufgeloest wird ("A query that was dehydrated as pending ended up
    // rejecting") — unabhaengig davon, ob gerade ein Screen sie rendert.
    expect(
      shouldPersistQuery(
        fakeQuery(['calorie-tracking', 'food-entries', 'u1', '2026-08-10'], 'pending'),
      ),
    ).toBe(false);
    expect(
      shouldPersistQuery(fakeQuery(['calorie-tracking', 'goal', 'current', 'u1'], 'error')),
    ).toBe(false);
  });
});
