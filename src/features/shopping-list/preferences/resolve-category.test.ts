import { CLASSIFIER_VERSION } from '../classification/classifier-version';
import { resolveCategory } from './resolve-category';

describe('resolveCategory', () => {
  it('bevorzugt die Produkt-Praeferenz vor der Namens-Praeferenz', () => {
    const result = resolveCategory({
      name: 'Schwein Schnitzel',
      productPreference: { categoryId: 'deli_meat' },
      namePreference: { categoryId: 'beverages' },
    });

    expect(result).toEqual({
      categoryId: 'deli_meat',
      source: 'household_preference',
      classifierVersion: CLASSIFIER_VERSION,
    });
  });

  it('nutzt die Namens-Praeferenz, wenn keine Produkt-Praeferenz existiert', () => {
    const result = resolveCategory({
      name: 'Hafermilch',
      namePreference: { categoryId: 'dairy' },
    });

    expect(result).toEqual({
      categoryId: 'dairy',
      source: 'household_preference',
      classifierVersion: CLASSIFIER_VERSION,
    });
  });

  it('behandelt eine bewusste "Sonstiges"-Praeferenz (categoryId: null) als Treffer, nicht als Fehlschlag', () => {
    const result = resolveCategory({
      name: 'Irgendwas Kurioses',
      namePreference: { categoryId: null },
    });

    expect(result).toEqual({
      categoryId: null,
      source: 'household_preference',
      classifierVersion: CLASSIFIER_VERSION,
    });
  });

  it('faellt ohne jede Praeferenz auf die automatische Klassifikation zurueck', () => {
    const result = resolveCategory({
      name: '2 Schnitzel vom Schwein Spar Fein Küche',
    });

    expect(result.source).not.toBe('household_preference');
    expect(result.categoryId).toBe('deli_meat');
  });

  it('faellt bei fehlender Produkt-Praeferenz aber ohne Namens-Praeferenz ebenfalls auf die Klassifikation zurueck', () => {
    const result = resolveCategory({
      name: 'Apfelsaft',
      productPreference: null,
      namePreference: undefined,
    });

    expect(result.source).not.toBe('household_preference');
  });
});
