import {
  classifySupabaseTarget,
  describeDatabaseOwnership,
  formatTokenExpiry,
  maskSecret,
} from '@/features/settings/dev/dev-info';

describe('classifySupabaseTarget', () => {
  it.each([
    ['http://127.0.0.1:54321', 'Lokal'],
    ['http://localhost:54321', 'Lokal'],
    ['http://10.0.2.2:54321', 'Lokal (über LAN)'],
    ['http://192.168.178.25:54321', 'Lokal (über LAN)'],
  ])('erkennt %s als lokal', (url, label) => {
    const target = classifySupabaseTarget(url);
    expect(target.kind).toBe('lokal');
    expect(target.label).toBe(label);
    expect(target.tone).toBe('accent');
  });

  it('warnt bei einem gehosteten Projekt', () => {
    const target = classifySupabaseTarget('https://abcdefgh.supabase.co');
    expect(target.kind).toBe('remote');
    expect(target.tone).toBe('danger');
    expect(target.label).toMatch(/echte Daten/);
  });

  it('behauptet bei einer unlesbaren URL nichts', () => {
    const target = classifySupabaseTarget('keine-url');
    expect(target.kind).toBe('unbekannt');
    expect(target.tone).toBe('warning');
  });

  it('haelt eine Domain mit 192.168 im Namen nicht fuer lokal', () => {
    // Verhindert eine zu breite Prefix-Pruefung auf lokale Hosts.
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
    expect(formatTokenExpiry(inSekunden(-60_000), jetzt)).toBe('abgelaufen');
  });

  it('rundet unter einer Minute nicht auf null ab', () => {
    expect(formatTokenExpiry(inSekunden(30_000), jetzt)).toBe('unter 1 min');
  });

  it('zaehlt Minuten und ab einer Stunde auch Stunden', () => {
    expect(formatTokenExpiry(inSekunden(42 * 60_000), jetzt)).toBe('noch 42 min');
    expect(formatTokenExpiry(inSekunden(90 * 60_000), jetzt)).toBe('noch 1 h 30 min');
  });

  it('behauptet ohne exp nichts', () => {
    expect(formatTokenExpiry(undefined, jetzt)).toBe('unbekannt');
  });
});

describe('describeDatabaseOwnership', () => {
  it('bestaetigt den Normalfall', () => {
    expect(describeDatabaseOwnership('user-a', 'user-a')).toEqual({
      label: 'stimmt überein',
      tone: 'accent',
    });
  });

  it('schlaegt Alarm, wenn die lokale DB einem anderen Nutzer gehoert', () => {
    const result = describeDatabaseOwnership('11111111-2222-3333', 'user-b');
    expect(result.tone).toBe('danger');
    expect(result.label).toContain('FREMD');
    expect(result.label).toContain('11111111');
  });

  it('unterscheidet "noch nicht zugeordnet" von einem Fremdbesitz', () => {
    expect(describeDatabaseOwnership(null, 'user-a').tone).toBe('warning');
    expect(describeDatabaseOwnership('user-a', null).tone).toBe('warning');
  });
});
