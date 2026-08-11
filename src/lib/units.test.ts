import { normalizeUnit, scaleToQuantity, toGramsEquivalent } from './units';

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

describe('toGramsEquivalent', () => {
  it('gibt g/ml unveraendert zurueck', () => {
    expect(toGramsEquivalent(250, 'g')).toEqual({ convertible: true, grams: 250 });
    expect(toGramsEquivalent(330, 'ml')).toEqual({ convertible: true, grams: 330 });
  });

  it('rechnet kg/l mit Faktor 1000 um', () => {
    expect(toGramsEquivalent(1.5, 'kg')).toEqual({ convertible: true, grams: 1500 });
    expect(toGramsEquivalent(0.5, 'l')).toEqual({ convertible: true, grams: 500 });
  });

  it('rechnet Stueck-Einheiten mit servingWeightG um', () => {
    expect(toGramsEquivalent(2, 'piece', { servingWeightG: 45 })).toEqual({
      convertible: true,
      grams: 90,
    });
    expect(toGramsEquivalent(1, 'package', { servingWeightG: 500 })).toEqual({
      convertible: true,
      grams: 500,
    });
    expect(toGramsEquivalent(3, 'portion', { servingWeightG: 150 })).toEqual({
      convertible: true,
      grams: 450,
    });
  });

  it('meldet convertible:false ohne servingWeightG', () => {
    expect(toGramsEquivalent(2, 'piece')).toEqual({ convertible: false });
    expect(toGramsEquivalent(1, 'package')).toEqual({ convertible: false });
    expect(toGramsEquivalent(1, 'portion')).toEqual({ convertible: false });
  });

  it('meldet convertible:false fuer unbekannte Einheiten', () => {
    expect(toGramsEquivalent(1, 'unbekannt')).toEqual({ convertible: false });
  });
});

describe('scaleToQuantity', () => {
  it('skaliert per100 auf die Menge bei g/ml', () => {
    expect(scaleToQuantity(250, 200, 'g')).toEqual({ convertible: true, value: 500 });
    expect(scaleToQuantity(40, 330, 'ml')).toEqual({ convertible: true, value: 132 });
  });

  it('skaliert per100 auf die Menge bei kg/l', () => {
    expect(scaleToQuantity(250, 1.5, 'kg')).toEqual({ convertible: true, value: 3750 });
  });

  it('skaliert Stueck-Einheiten mit servingWeightG', () => {
    expect(scaleToQuantity(250, 2, 'piece', { servingWeightG: 45 })).toEqual({
      convertible: true,
      value: 225,
    });
  });

  it('meldet convertible:false fuer Stueck-Einheiten ohne servingWeightG', () => {
    expect(scaleToQuantity(250, 2, 'piece')).toEqual({ convertible: false });
  });
});
