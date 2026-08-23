import { describeSyncStatus } from '@/features/settings/sync-status-text';

describe('describeSyncStatus', () => {
  it('meldet den Normalfall unauffaellig', () => {
    expect(describeSyncStatus({ kind: 'hidden' })).toEqual({
      text: 'Alle Daten sind synchronisiert',
      short: 'Aktuell',
      tone: 'accent',
    });
  });

  it('unterscheidet offline mit und ohne ausstehende Aenderungen', () => {
    expect(describeSyncStatus({ kind: 'offline', pendingCount: 0 })).toMatchObject({
      text: 'Offline (Keine Internetverbindung)',
      short: 'Offline',
      tone: 'warning',
    });

    expect(describeSyncStatus({ kind: 'offline', pendingCount: 3 })).toMatchObject({
      text: 'Offline (3 Änderungen ausstehend)',
      short: 'Offline, 3 offen',
      tone: 'warning',
    });
  });

  it('nennt beim Synchronisieren die Anzahl', () => {
    expect(describeSyncStatus({ kind: 'syncing', pendingCount: 2 })).toMatchObject({
      short: '2 ausstehend',
      tone: 'warning',
    });
  });

  it('hebt Fehlgeschlagenes hervor', () => {
    expect(describeSyncStatus({ kind: 'failed', failedCount: 4 })).toEqual({
      text: '4 Änderungen konnten nicht synchronisiert werden.',
      short: '4 fehlgeschlagen',
      tone: 'danger',
    });
  });

  it('haelt die Kurzfassung kurz genug fuer die Menuezeile', () => {
    const alle = [
      describeSyncStatus({ kind: 'hidden' }),
      describeSyncStatus({ kind: 'offline', pendingCount: 0 }),
      describeSyncStatus({ kind: 'offline', pendingCount: 12 }),
      describeSyncStatus({ kind: 'syncing', pendingCount: 12 }),
      describeSyncStatus({ kind: 'failed', failedCount: 12 }),
    ];

    // Die Kurzfassung muss in die schmale Wertespalte passen.
    for (const eintrag of alle) {
      expect(eintrag.short.length).toBeLessThanOrEqual(20);
    }
  });
});
