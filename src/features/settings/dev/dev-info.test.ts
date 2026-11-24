import {
  classifySupabaseTarget,
  describeDatabaseOwnership,
  formatTokenExpiry,
  maskSecret,
} from '@/features/settings/dev/dev-info';

describe('classifySupabaseTarget', () => {
  it.each([
    ['http://127.0.0.1:54321', 'dev.info.supabaseLocal'],
    ['http://localhost:54321', 'dev.info.supabaseLocal'],
    ['http://10.0.2.2:54321', 'dev.info.supabaseLan'],
    ['http://192.168.178.25:54321', 'dev.info.supabaseLan'],
  ])('erkennt %s als lokal', (url, labelKey) => {
    const target = classifySupabaseTarget(url);
    expect(target.kind).toBe('lokal');
    expect(target.labelKey).toBe(labelKey);
    expect(target.tone).toBe('accent');
  });

  it('warnt bei einem gehosteten Projekt', () => {
    // Der eigentliche Zweck der Funktion: Ein Build, der unbemerkt gegen das
    // verlinkte Projekt laeuft, legt beim Ausprobieren echte Daten an.
    const target = classifySupabaseTarget('https://abcdefgh.supabase.co');
    expect(target.kind).toBe('remote');
    expect(target.tone).toBe('danger');
    expect(target.labelKey).toBe('dev.info.supabaseRemote');
  });

  it('behauptet bei einer unlesbaren URL nichts', () => {
    const target = classifySupabaseTarget('keine-url');
    expect(target.kind).toBe('unbekannt');
    expect(target.tone).toBe('warning');
    expect(target.labelKey).toBe('dev.info.supabaseUnreadable');
  });

  it('haelt eine Domain mit 192.168 im Namen nicht fuer lokal', () => {
    // `192.168.178.25.example.com` waere eine fremde Domain — der Test steht
    // hier, weil eine Prefix-Pruefung statt des Ankers genau das durchliesse.
    expect(classifySupabaseTarget('https://192.168.178.25.example.com').kind).toBe('remote');
  });
});

describe('maskSecret', () => {
  it('zeigt den Anfang und verbirgt den Rest', () => {
    expect(maskSecret('sb_publishable_abcdefghijklmnop')).toBe('sb_publi…');
  });

  it('gibt kurze Werte gar nicht preis', () => {
    expect(maskSecret('kurz')).toBe('…');
  });
});

describe('formatTokenExpiry', () => {
  const jetzt = Date.UTC(2026, 7, 9, 12, 0, 0);
  const inSekunden = (ms: number) => Math.floor((jetzt + ms) / 1000);

  it('meldet einen abgelaufenen Token als solchen', () => {
    expect(formatTokenExpiry(inSekunden(-60_000), jetzt)).toEqual({
      key: 'dev.info.tokenExpired',
    });
  });

  it('rundet unter einer Minute nicht auf null ab', () => {
    expect(formatTokenExpiry(inSekunden(30_000), jetzt)).toEqual({
      key: 'dev.info.tokenUnderMinute',
    });
  });

  it('zaehlt Minuten und ab einer Stunde auch Stunden', () => {
    expect(formatTokenExpiry(inSekunden(42 * 60_000), jetzt)).toEqual({
      key: 'dev.info.tokenMinutes',
      minutes: 42,
    });
    expect(formatTokenExpiry(inSekunden(90 * 60_000), jetzt)).toEqual({
      key: 'dev.info.tokenHours',
      hours: 1,
      minutes: 30,
    });
  });

  it('behauptet ohne exp nichts', () => {
    expect(formatTokenExpiry(undefined, jetzt)).toEqual({ key: 'dev.info.tokenUnknown' });
  });
});

describe('describeDatabaseOwnership', () => {
  it('bestaetigt den Normalfall', () => {
    expect(describeDatabaseOwnership('user-a', 'user-a')).toEqual({
      key: 'dev.info.ownershipMatches',
    });
  });

  it('schlaegt Alarm, wenn die lokale DB einem anderen Nutzer gehoert', () => {
    // Genau diese Abweichung war das Cross-Account-Datenleck.
    const result = describeDatabaseOwnership('11111111-2222-3333', 'user-b');
    expect(result).toEqual({ key: 'dev.info.ownershipForeign', userId: '11111111' });
  });

  it('unterscheidet "noch nicht zugeordnet" von einem Fremdbesitz', () => {
    expect(describeDatabaseOwnership(null, 'user-a')).toEqual({
      key: 'dev.info.ownershipUnassigned',
    });
    expect(describeDatabaseOwnership('user-a', null)).toEqual({
      key: 'dev.info.ownershipUnauthenticated',
    });
  });
});
