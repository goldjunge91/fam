import { parseNaturalLanguageShoppingInput } from './parser';

describe('parseNaturalLanguageShoppingInput', () => {
  it('returns no items for empty input', () => {
    expect(parseNaturalLanguageShoppingInput('   ')).toEqual({
      items: [],
      unparsedText: null,
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
    });
  });

  it('parses the required apple example with a default unit', () => {
    expect(parseNaturalLanguageShoppingInput('3 Äpfel')).toEqual({
      items: [{ name: 'Äpfel', quantity: 3, unit: null, brand: null }],
      unparsedText: null,
    });
  });

  it.each([
    ['4x Skyr von JA', { name: 'Skyr', quantity: 4, unit: null, brand: 'JA' }],
    ['JA Skyr', { name: 'Skyr', quantity: 1, unit: null, brand: 'JA' }],
  ])('recognizes a brand in %s', (input, item) => {
    expect(parseNaturalLanguageShoppingInput(input)).toEqual({
      items: [item],
      unparsedText: null,
    });
  });

  it('parses word quantities, units, and multiple items separated by und', () => {
    expect(parseNaturalLanguageShoppingInput('zwei Liter Milch und Brot')).toEqual({
      items: [
        { name: 'Milch', quantity: 2, unit: 'l', brand: null },
        { name: 'Brot', quantity: 1, unit: null, brand: null },
      ],
      unparsedText: null,
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
    });
  });

  it('keeps the abbreviated piece unit intact', () => {
    expect(parseNaturalLanguageShoppingInput('1 stk. Äpfel')).toEqual({
      items: [{ name: 'Äpfel', quantity: 1, unit: 'piece', brand: null }],
      unparsedText: null,
    });
  });

  it.each(['z. B.', 'z.B.'])('keeps the abbreviation %s in one segment', (input) => {
    expect(parseNaturalLanguageShoppingInput(input)).toEqual({
      items: [{ name: input, quantity: 1, unit: null, brand: null }],
      unparsedText: null,
    });
  });

  it('keeps non-parseable parts visible as rest text', () => {
    expect(parseNaturalLanguageShoppingInput('3 Äpfel, ???')).toEqual({
      items: [{ name: 'Äpfel', quantity: 3, unit: null, brand: null }],
      unparsedText: '???',
    });
  });
});
