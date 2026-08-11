import { computeSyncStatusView } from '@/lib/sync/sync-status';

describe('computeSyncStatusView', () => {
  it('zeigt nichts, wenn online und nichts aussteht', () => {
    expect(
      computeSyncStatusView({
        isOnline: true,
        pendingCount: 0,
        failedCount: 0,
        recentLocalWrite: false,
      }),
    ).toEqual({
      kind: 'hidden',
    });
  });

  it('zeigt offline, auch ohne ausstehende Aenderungen', () => {
    expect(
      computeSyncStatusView({
        isOnline: false,
        pendingCount: 0,
        failedCount: 0,
        recentLocalWrite: false,
      }),
    ).toEqual({
      kind: 'offline',
      pendingCount: 0,
    });
  });

  it('zeigt offline mit Zaehler, wenn zusaetzlich Aenderungen ausstehen', () => {
    expect(
      computeSyncStatusView({
        isOnline: false,
        pendingCount: 3,
        failedCount: 0,
        recentLocalWrite: false,
      }),
    ).toEqual({
      kind: 'offline',
      pendingCount: 3,
    });
  });

  it('zeigt synchronisiert kurz nach einem lokalen Schreibvorgang', () => {
    expect(
      computeSyncStatusView({
        isOnline: true,
        pendingCount: 2,
        failedCount: 0,
        recentLocalWrite: true,
      }),
    ).toEqual({
      kind: 'syncing',
      pendingCount: 2,
    });
  });

  it('zeigt NICHT synchronisiert nur weil etwas aussteht — kein recentLocalWrite, kein Dauerzustand', () => {
    expect(
      computeSyncStatusView({
        isOnline: true,
        pendingCount: 2,
        failedCount: 0,
        recentLocalWrite: false,
      }),
    ).toEqual({
      kind: 'hidden',
    });
  });

  it('zeigt gescheitert, wenn online mit dauerhaft gescheiterten Eintraegen', () => {
    expect(
      computeSyncStatusView({
        isOnline: true,
        pendingCount: 0,
        failedCount: 1,
        recentLocalWrite: false,
      }),
    ).toEqual({
      kind: 'failed',
      failedCount: 1,
    });
  });

  it('gescheitert schlaegt offline', () => {
    expect(
      computeSyncStatusView({
        isOnline: false,
        pendingCount: 5,
        failedCount: 2,
        recentLocalWrite: false,
      }),
    ).toEqual({
      kind: 'failed',
      failedCount: 2,
    });
  });

  it('gescheitert schlaegt ausstehend', () => {
    expect(
      computeSyncStatusView({
        isOnline: true,
        pendingCount: 5,
        failedCount: 1,
        recentLocalWrite: true,
      }),
    ).toEqual({
      kind: 'failed',
      failedCount: 1,
    });
  });
});
