import {
  distinctCategoryColors,
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
