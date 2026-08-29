import {
  isLikelyBarcode,
  parseCategoryTagsJson,
  parseQuantityAndUnit,
  toSearchTokens,
} from './product-parsing';

describe('Produkt-Parsing', () => {
  it('sollte Mengen und Einheiten korrekt parsen', () => {
    expect(parseQuantityAndUnit('500 g')).toEqual({ quantity: 500, unit: 'g' });
    expect(parseQuantityAndUnit('1.5 L')).toEqual({ quantity: 1.5, unit: 'l' });
    expect(parseQuantityAndUnit('1 kg')).toEqual({ quantity: 1, unit: 'kg' });
    expect(parseQuantityAndUnit('250 ml')).toEqual({ quantity: 250, unit: 'ml' });
    expect(parseQuantityAndUnit('1 Stück')).toEqual({ quantity: 1, unit: 'piece' });
    expect(parseQuantityAndUnit(undefined)).toEqual({ quantity: 1, unit: 'piece' });
  });

  it.each([
    ['40193000053', true], // EAN-11 artig, im 6-14-Fenster
    ['4019300005307', true], // EAN-13
    ['12345678', true], // EAN-8
    ['Haferflocken', false],
    ['123', false], // zu kurz, eher eine Mengenangabe als ein Barcode
    ['123456789012345', false], // zu lang
    ['4019 300 005 307', false], // Leerzeichen -> kein reiner Zifferncode
  ])('sollte "%s" korrekt als Barcode einstufen: %s', (value, expected) => {
    expect(isLikelyBarcode(value)).toBe(expected);
  });

  it('liest categoryTags aus serialisiertem JSON und faengt kaputte Werte ab', () => {
    expect(parseCategoryTagsJson('["en:milks","en:dairies"]')).toEqual(['en:milks', 'en:dairies']);
    expect(parseCategoryTagsJson('{kaputt')).toEqual([]);
    expect(parseCategoryTagsJson(null)).toEqual([]);
    // Nicht-Strings im Array fallen raus, statt die Liste zu vergiften.
    expect(parseCategoryTagsJson('["en:milks",42,null]')).toEqual(['en:milks']);
  });

  it('zerlegt eine Sucheingabe in Suchanker ohne Mengenangaben', () => {
    expect(toSearchTokens('1l coca cola')).toEqual(['coca', 'cola']);
    expect(toSearchTokens('500g Vollmilch')).toEqual(['vollmilch']);
    // Zu kurze Fragmente sind als LIKE-Anker wertlos.
    expect(toSearchTokens('a b')).toEqual([]);
  });
});
