import { formatRelativeTime } from './format-relative-time';

describe('formatRelativeTime', () => {
  const now = new Date('2026-08-10T12:00:00.000Z').getTime();

  it('sollte "gerade eben" fuer unter einer Minute zeigen', () => {
    expect(formatRelativeTime(now, now)).toBe('gerade eben');
    expect(formatRelativeTime(now - 30_000, now)).toBe('gerade eben');
  });

  it('sollte Minuten korrekt formatieren', () => {
    expect(formatRelativeTime(now - 2 * 60_000, now)).toBe('vor 2 Min.');
    expect(formatRelativeTime(now - 59 * 60_000, now)).toBe('vor 59 Min.');
  });

  it('sollte Stunden korrekt formatieren', () => {
    expect(formatRelativeTime(now - 3 * 60 * 60_000, now)).toBe('vor 3 Std.');
    expect(formatRelativeTime(now - 23 * 60 * 60_000, now)).toBe('vor 23 Std.');
  });

  it('sollte Tage korrekt formatieren, mit Singular/Plural', () => {
    expect(formatRelativeTime(now - 24 * 60 * 60_000, now)).toBe('vor 1 Tag');
    expect(formatRelativeTime(now - 5 * 24 * 60 * 60_000, now)).toBe('vor 5 Tagen');
  });

  it('sollte zukuenftige Zeitpunkte nicht negativ formatieren', () => {
    expect(formatRelativeTime(now + 60_000, now)).toBe('gerade eben');
  });
});
