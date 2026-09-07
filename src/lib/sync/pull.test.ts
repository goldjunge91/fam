import { buildOrFilter } from '@/lib/sync/pull';

describe('Transaktions-Pull-Cursor', () => {
  it('startet den serverseitigen Sequenzcursor bei null statt bei einer ISO-Zeit', () => {
    expect(
      buildOrFilter(
        { lastSyncedAt: '0', lastSyncedId: '00000000-0000-0000-0000-000000000000' },
        'sync_sequence',
      ),
    ).toBe('sync_sequence.gt.0,and(sync_sequence.eq.0,id.gt.00000000-0000-0000-0000-000000000000)');
  });

  it('ordnet Transaktionen nach der serverseitigen Sequenz statt nach Eventzeit', () => {
    expect(
      buildOrFilter(
        { lastSyncedAt: '41', lastSyncedId: '00000000-0000-0000-0000-000000000001' },
        'sync_sequence',
      ),
    ).toBe(
      'sync_sequence.gt.41,and(sync_sequence.eq.41,id.gt.00000000-0000-0000-0000-000000000001)',
    );
  });
});
