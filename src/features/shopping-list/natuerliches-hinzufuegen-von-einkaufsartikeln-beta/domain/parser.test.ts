import { parseNaturalLanguageShoppingInput } from './parser';

describe('parseNaturalLanguageShoppingInput', () => {
  it('returns no items for empty input', () => {
    expect(parseNaturalLanguageShoppingInput('   ')).toEqual({
      items: [],
      unparsedText: null,
      qualityFlags: [],
    });
  });

  it.each([
    ['Brot', 1],
    ['3x Joghurt', 3],
    ['3 x Joghurt', 3],
    ['3 Joghurt', 3],
  ])('parses quantity variant %s', (input, quantity) => {
    expect(parseNaturalLanguageShoppingInput(input)).toEqual({
      items: [
        { name: input.includes('Joghurt') ? 'Joghurt' : 'Brot', quantity, unit: null, brand: null },
      ],
      unparsedText: null,
      qualityFlags: [],
    });
  });

  it.each([
    ['zwölf Eier', 12, 'Eier', null],
    ['zweihundert Gramm Käse', 200, 'Käse', 'g'],
    ['fünfhundert Gramm Hackfleisch', 500, 'Hackfleisch', 'g'],
  ])('parses dataset quantity word %s', (input, quantity, name, unit) => {
    expect(parseNaturalLanguageShoppingInput(input)).toEqual({
      items: [{ name, quantity, unit, brand: null }],
      unparsedText: null,
      qualityFlags: [],
    });
  });

  it('parses the required apple example with a default unit', () => {
    expect(parseNaturalLanguageShoppingInput('3 Äpfel')).toEqual({
      items: [{ name: 'Äpfel', quantity: 3, unit: null, brand: null }],
      unparsedText: null,
      qualityFlags: [],
    });
  });

  it.each([
    ['4x Skyr von JA', { name: 'Skyr', quantity: 4, unit: null, brand: 'JA' }],
    ['JA Skyr', { name: 'Skyr', quantity: 1, unit: null, brand: 'JA' }],
  ])('recognizes a brand in %s', (input, item) => {
    expect(parseNaturalLanguageShoppingInput(input)).toEqual({
      items: [item],
      unparsedText: null,
      qualityFlags: [],
    });
  });

  it('parses word quantities, units, and multiple items separated by und', () => {
    expect(parseNaturalLanguageShoppingInput('zwei Liter Milch und Brot')).toEqual({
      items: [
        { name: 'Milch', quantity: 2, unit: 'l', brand: null },
        { name: 'Brot', quantity: 1, unit: null, brand: null },
      ],
      unparsedText: null,
      qualityFlags: [],
    });
  });

  it('normalizes speech-split compound names and cup units', () => {
    expect(parseNaturalLanguageShoppingInput('ein Salat Kopf, vier Becher Joghurt')).toEqual({
      items: [
        { name: 'Salatkopf', quantity: 1, unit: null, brand: null },
        { name: 'Joghurt', quantity: 4, unit: 'piece', brand: null },
      ],
      unparsedText: null,
      qualityFlags: [],
    });
  });

  it.each(['hinzu', 'hinzufügen'])('removes the trailing speech command %s', (command) => {
    expect(
      parseNaturalLanguageShoppingInput(`eine Küchenrolle zur Einkaufsliste ${command}`),
    ).toEqual({
      items: [{ name: 'Küchenrolle', quantity: 1, unit: null, brand: null }],
      unparsedText: null,
      qualityFlags: [],
    });
  });

  it('removes a leading speech instruction before the first quantity', () => {
    expect(
      parseNaturalLanguageShoppingInput(
        'Ich gehe nachher einkaufen deshalb füge bitte für unsere Familie 2 l Milch und Brot',
      ),
    ).toEqual({
      items: [
        { name: 'Milch', quantity: 2, unit: 'l', brand: null },
        { name: 'Brot', quantity: 1, unit: null, brand: null },
      ],
      unparsedText: null,
      qualityFlags: [],
    });
  });

  it.each([
    ['eine Knolle Knoblauch', { name: 'Knoblauch', quantity: 1, unit: 'piece', brand: null }],
    ['zwei Packungen Nudeln', { name: 'Nudeln', quantity: 2, unit: 'package', brand: null }],
    ['zwei Gläser Tomatensoße', { name: 'Tomatensoße', quantity: 2, unit: 'piece', brand: null }],
    ['eine Flasche Olivenöl', { name: 'Olivenöl', quantity: 1, unit: 'piece', brand: null }],
    ['ein Paket Zucker', { name: 'Zucker', quantity: 1, unit: 'package', brand: null }],
    ['zwei Dosen Kidneybohnen', { name: 'Kidneybohnen', quantity: 2, unit: 'piece', brand: null }],
  ])('normalizes spoken packaging unit in %s', (input, item) => {
    expect(parseNaturalLanguageShoppingInput(input)).toEqual({
      items: [item],
      unparsedText: null,
      qualityFlags: [],
    });
  });

  it('splits speech without punctuation at explicit quantity starts', () => {
    expect(
      parseNaturalLanguageShoppingInput('ein Salat Kopf vier Becher Joghurt ein Kilo Reis'),
    ).toEqual({
      items: [
        { name: 'Salatkopf', quantity: 1, unit: null, brand: null },
        { name: 'Joghurt', quantity: 4, unit: 'piece', brand: null },
        { name: 'Reis', quantity: 1, unit: 'kg', brand: null },
      ],
      unparsedText: null,
      qualityFlags: [],
    });
  });

  it('does not split ordinary unpunctuated words on whitespace alone', () => {
    expect(parseNaturalLanguageShoppingInput('Apfelkuchen nehme ich Eier Wasser')).toEqual({
      items: [
        {
          name: 'Apfelkuchen nehme ich Eier Wasser',
          quantity: 1,
          unit: null,
          brand: null,
        },
      ],
      unparsedText: null,
      qualityFlags: [],
    });
  });

  it('supports comma, semicolon, and line-break separators', () => {
    expect(
      parseNaturalLanguageShoppingInput('1 kg Mehl, 2 l Milch; 6 Eier\n1 Packung Reis'),
    ).toEqual({
      items: [
        { name: 'Mehl', quantity: 1, unit: 'kg', brand: null },
        { name: 'Milch', quantity: 2, unit: 'l', brand: null },
        { name: 'Eier', quantity: 6, unit: null, brand: null },
        { name: 'Reis', quantity: 1, unit: 'package', brand: null },
      ],
      unparsedText: null,
      qualityFlags: [],
    });
  });

  it('supports punctuation separators produced by speech recognition', () => {
    expect(parseNaturalLanguageShoppingInput('Milch. Eier. Brot.')).toEqual({
      items: [
        { name: 'Milch', quantity: 1, unit: null, brand: null },
        { name: 'Eier', quantity: 1, unit: null, brand: null },
        { name: 'Brot', quantity: 1, unit: null, brand: null },
      ],
      unparsedText: null,
      qualityFlags: [],
    });
  });

  it('keeps the abbreviated piece unit intact', () => {
    expect(parseNaturalLanguageShoppingInput('1 stk. Äpfel')).toEqual({
      items: [{ name: 'Äpfel', quantity: 1, unit: 'piece', brand: null }],
      unparsedText: null,
      qualityFlags: [],
    });
  });

  it.each(['z. B.', 'z.B.'])('keeps the abbreviation %s in one segment', (input) => {
    expect(parseNaturalLanguageShoppingInput(input)).toEqual({
      items: [{ name: input, quantity: 1, unit: null, brand: null }],
      unparsedText: null,
      qualityFlags: [],
    });
  });

  it('keeps non-parseable parts visible as rest text', () => {
    const result = parseNaturalLanguageShoppingInput('3 Äpfel, ???');

    expect(result).toEqual({
      items: [{ name: 'Äpfel', quantity: 3, unit: null, brand: null }],
      unparsedText: '???',
      qualityFlags: ['unparsed_text_present'],
    });
  });
});
