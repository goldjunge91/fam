import {
  categoryIdForLabel,
  categoryLabelForId,
  colorForCategory,
  distinctCategoryColors,
  effectiveSortOrder,
  normalizeCategoryId,
  parseCategoryOrder,
  serializeCategoryOrder,
  sortOrderForCategory,
  storageKindForCategory,
} from './shopping-categories';

describe('distinctCategoryColors', () => {
  it('liefert jede Kategoriefarbe nur einmal in Laufreihenfolge', () => {
    expect(
      distinctCategoryColors(['Sonstiges', 'Obst & Gemüse', 'Sonstiges', 'Obst & Gemüse']),
    ).toEqual(['#748C5B', '#786F79']);
  });
});

describe('colorForCategory', () => {
  it('bezieht die Markierungsfarbe aus der kanonischen Placement-Taxonomie', () => {
    expect(colorForCategory('Obst & Gemüse')).toBe('#748C5B');
    expect(colorForCategory('Unbekannte Kategorie')).toBeNull();
  });
});

describe('sortOrderForCategory', () => {
  it('sollte unkategorisierte Artikel ans Ende sortieren', () => {
    expect(sortOrderForCategory(null)).toBe(999);
    expect(sortOrderForCategory('Unbekannte Kategorie')).toBe(999);
    expect(sortOrderForCategory('Obst & Gemüse')).toBe(10);
  });
});

describe('storageKindForCategory', () => {
  it('sollte auf pantry zurückfallen, wenn nichts passt', () => {
    expect(storageKindForCategory(null)).toBe('pantry');
    expect(storageKindForCategory('Tiefkühl')).toBe('freezer');
    expect(storageKindForCategory('Milchprodukte & Eier')).toBe('fridge');
  });
});

describe('placement category adapters', () => {
  it('maps labels and ids while returning null for unknown values', () => {
    expect(categoryIdForLabel('Obst & Gemüse')).toBe('fresh_produce');
    expect(categoryIdForLabel(null)).toBeNull();
    expect(categoryIdForLabel('Unbekannt')).toBeNull();
    expect(categoryLabelForId('fresh_produce')).toBe('Obst & Gemüse');
    expect(categoryLabelForId('unknown')).toBeNull();
    expect(normalizeCategoryId('fresh_produce')).toBe('fresh_produce');
    expect(normalizeCategoryId(null)).toBeNull();
  });

  it('parses, normalizes and serializes a custom order', () => {
    expect(parseCategoryOrder(null)).toEqual([]);
    expect(parseCategoryOrder('cold_drinks,meat_poultry,cold_drinks,unknown').slice(0, 2)).toEqual([
      'cold_drinks',
      'meat_poultry',
    ]);
    expect(serializeCategoryOrder(['cold_drinks', 'meat_poultry', 'cold_drinks'])).toMatch(
      /^cold_drinks,meat_poultry,/,
    );
  });

  it('uses either the default rank or the custom position', () => {
    expect(effectiveSortOrder('Obst & Gemüse', null)).toBe(10);
    expect(effectiveSortOrder('Obst & Gemüse', ['cold_drinks', 'fresh_produce'])).toBe(1);
    expect(effectiveSortOrder('Unbekannt', null)).toBe(999);
    expect(effectiveSortOrder('Obst & Gemüse', ['cold_drinks'])).toBe(1);
  });
});
