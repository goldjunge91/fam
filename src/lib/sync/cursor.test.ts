import { EPOCH_START, toEpochMs } from '@/lib/sync/cursor';

describe('toEpochMs', () => {
  it('parst Z als UTC', () => {
    expect(toEpochMs('2024-01-15T10:30:00Z')).toBe(Date.UTC(2024, 0, 15, 10, 30, 0));
  });

  it('parst +00:00 identisch zu Z', () => {
    expect(toEpochMs('2024-01-15T10:30:00+00:00')).toBe(toEpochMs('2024-01-15T10:30:00Z'));
  });

  it('behandelt 0 Nachkommastellen', () => {
    expect(toEpochMs('2024-01-15T10:30:00Z')).toBe(Date.UTC(2024, 0, 15, 10, 30, 0, 0));
  });

  it('behandelt 3 Nachkommastellen', () => {
    expect(toEpochMs('2024-01-15T10:30:00.123Z')).toBe(Date.UTC(2024, 0, 15, 10, 30, 0, 123));
  });

  it('behandelt 6 Nachkommastellen (Postgres-Standardformat), gekuerzt auf Millisekunden', () => {
    expect(toEpochMs('2024-01-15T10:30:00.123456Z')).toBe(Date.UTC(2024, 0, 15, 10, 30, 0, 123));
  });

  it('behandelt einen positiven Offset ohne Minuten', () => {
    const withOffset = toEpochMs('2024-01-15T12:30:00+02');
    const utc = toEpochMs('2024-01-15T10:30:00Z');
    expect(withOffset).toBe(utc);
  });

  it('behandelt einen positiven Offset mit Minuten', () => {
    const withOffset = toEpochMs('2024-01-15T12:45:00+02:15');
    const utc = toEpochMs('2024-01-15T10:30:00Z');
    expect(withOffset).toBe(utc);
  });

  it('behandelt einen negativen Offset', () => {
    const withOffset = toEpochMs('2024-01-15T05:30:00-05:00');
    const utc = toEpochMs('2024-01-15T10:30:00Z');
    expect(withOffset).toBe(utc);
  });

  it('behandelt ein Leerzeichen statt T als Trenner', () => {
    expect(toEpochMs('2024-01-15 10:30:00Z')).toBe(toEpochMs('2024-01-15T10:30:00Z'));
  });

  it('wirft bei einem ungueltigen String', () => {
    expect(() => toEpochMs('nicht-ein-datum')).toThrow(/nicht-ein-datum/);
  });

  it('wirft bei leerem String', () => {
    expect(() => toEpochMs('')).toThrow();
  });

  it('EPOCH_START liegt vor jedem realistischen Zeitstempel', () => {
    expect(toEpochMs(EPOCH_START)).toBeLessThan(toEpochMs('2024-01-01T00:00:00Z'));
  });
});
