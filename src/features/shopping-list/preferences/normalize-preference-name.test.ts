import { normalizePreferenceName } from './normalize-preference-name';

describe('normalizePreferenceName', () => {
  it('trimmt und kleinschreibt', () => {
    expect(normalizePreferenceName('  HaferMilch  ')).toBe('hafermilch');
  });

  it('kollabiert mehrfache Leerzeichen', () => {
    expect(normalizePreferenceName('Hafer   milch')).toBe('hafer milch');
  });

  it('erhaelt Umlaute und Akzente', () => {
    expect(normalizePreferenceName('Crème Fraîche')).toBe('crème fraîche');
  });

  it('ist idempotent', () => {
    const once = normalizePreferenceName('  Apfelsaft Direkt  ');
    expect(normalizePreferenceName(once)).toBe(once);
  });

  it('liefert einen leeren String fuer reinen Whitespace, statt zu werfen', () => {
    expect(normalizePreferenceName('   ')).toBe('');
  });
});
