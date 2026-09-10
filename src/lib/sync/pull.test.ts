import { buildOrFilter } from '@/lib/sync/pull';

describe('Pull-Cursor', () => {
  it('ordnet aktualisierte Zeilen stabil nach Zeit und ID', () => {
    expect(
      buildOrFilter(
        { lastSyncedAt: '2026-09-10T10:00:00.000Z', lastSyncedId: 'item-1' },
        'updated_at',
      ),
    ).toBe(
      'updated_at.gt.2026-09-10T10:00:00.000Z,and(updated_at.eq.2026-09-10T10:00:00.000Z,id.gt.item-1)',
    );
  });

  it('ordnet append-only Ledgerzeilen nach created_at', () => {
    expect(
      buildOrFilter(
        { lastSyncedAt: '2026-09-10T10:00:00.000Z', lastSyncedId: 'txn-1' },
        'created_at',
      ),
    ).toContain('created_at.gt.2026-09-10T10:00:00.000Z');
  });
});
