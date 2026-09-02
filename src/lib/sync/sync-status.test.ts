import { computeSyncStatusView } from '@/lib/sync/sync-status';

describe('computeSyncStatusView', () => {
  it('zeigt nichts, wenn online und nichts aussteht', () => {
    expect(computeSyncStatusView({ isOnline: true, pendingCount: 0, failedCount: 0 })).toEqual({
      kind: 'hidden',
    });
  });

  it('zeigt nichts, auch direkt nach einem erfolgreichen Online-Sync mit ausstehenden Eintraegen', () => {
    // Local-First: ein erfolgreicher Sync ist fuer den Nutzer unsichtbar,
    // solange nichts dauerhaft fehlschlaegt oder die Verbindung fehlt
    // (siehe docs/issue-131-missing-ingredients-transfer.md-Diskussion,
    // AGENTS.md "Local-First & Offline-Belastbarkeit").
    expect(computeSyncStatusView({ isOnline: true, pendingCount: 2, failedCount: 0 })).toEqual({
      kind: 'hidden',
    });
  });

  it('zeigt offline, auch ohne ausstehende Aenderungen', () => {
    expect(computeSyncStatusView({ isOnline: false, pendingCount: 0, failedCount: 0 })).toEqual({
      kind: 'offline',
      pendingCount: 0,
    });
  });

  it('zeigt offline mit Zaehler, wenn zusaetzlich Aenderungen ausstehen', () => {
    expect(computeSyncStatusView({ isOnline: false, pendingCount: 3, failedCount: 0 })).toEqual({
      kind: 'offline',
      pendingCount: 3,
    });
  });

  it('zeigt gescheitert, wenn online mit dauerhaft gescheiterten Eintraegen', () => {
    expect(computeSyncStatusView({ isOnline: true, pendingCount: 0, failedCount: 1 })).toEqual({
      kind: 'failed',
      failedCount: 1,
    });
  });

  it('gescheitert schlaegt offline', () => {
    expect(computeSyncStatusView({ isOnline: false, pendingCount: 5, failedCount: 2 })).toEqual({
      kind: 'failed',
      failedCount: 2,
    });
  });
});
