import { normalizeUnit } from './units';

describe('normalizeUnit', () => {
  it('sollte leere oder ungültige Werte zu "piece" normalisieren', () => {
    expect(normalizeUnit(undefined)).toBe('piece');
    expect(normalizeUnit(null)).toBe('piece');
    expect(normalizeUnit('')).toBe('piece');
    expect(normalizeUnit('unbekannt')).toBe('piece');
  });

  it('sollte Volumen-Einheiten korrekt normalisieren', () => {
    expect(normalizeUnit('l')).toBe('l');
    expect(normalizeUnit('Liter')).toBe('l');
    expect(normalizeUnit('litre')).toBe('l');
    expect(normalizeUnit('ml')).toBe('ml');
    expect(normalizeUnit('Milliliter')).toBe('ml');
  });

  it('sollte Gewichts-Einheiten korrekt normalisieren', () => {
    expect(normalizeUnit('g')).toBe('g');
    expect(normalizeUnit('Gramm')).toBe('g');
    expect(normalizeUnit('gram')).toBe('g');
    expect(normalizeUnit('kg')).toBe('kg');
    expect(normalizeUnit('Kilogramm')).toBe('kg');
    expect(normalizeUnit('Kilo')).toBe('kg');
  });

  it('sollte Stück- und Packungs-Einheiten normalisieren', () => {
    expect(normalizeUnit('stk')).toBe('piece');
    expect(normalizeUnit('Stück')).toBe('piece');
    expect(normalizeUnit('stueck')).toBe('piece');
    expect(normalizeUnit('packung')).toBe('package');
    expect(normalizeUnit('pkg')).toBe('package');
    expect(normalizeUnit('portion')).toBe('portion');
    expect(normalizeUnit('pck')).toBe('portion');
  });
});
