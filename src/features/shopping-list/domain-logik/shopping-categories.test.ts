import {
  distinctCategoryColors,
  guessCategory,
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

describe('guessCategory', () => {
  it('sollte gängige Artikel korrekt erkennen', () => {
    expect(guessCategory('Vollmilch')).toBe('Milchprodukte & Eier');
    expect(guessCategory('Bio-Äpfel')).toBe('Obst & Gemüse');
    expect(guessCategory('Hähnchenbrust')).toBe('Fleisch & Geflügel');
    expect(guessCategory('Vollkornbrot')).toBe('Brot & Backwaren');
    expect(guessCategory('Mineralwasser')).toBe('Wasser, Saft & Softdrinks');
    expect(guessCategory('Toilettenpapier')).toBe('Haushalt & Reinigung');
  });

  it('sollte Gross-/Kleinschreibung ignorieren', () => {
    expect(guessCategory('SCHOKOLADE')).toBe('Snacks & Nüsse');
  });

  it('sollte kurze Keywords nicht als Substring in anderen Woertern matchen', () => {
    // "ei" (Molkerei) als freier Substring wuerde all das faelschlich treffen.
    expect(guessCategory('Eis')).toBe('Tiefkühl');
    expect(guessCategory('Teig')).toBe('Sonstiges');
    expect(guessCategory('Seife')).toBe('Drogerie & Körperpflege');
    expect(guessCategory('Eimer')).toBe('Sonstiges');
  });

  it('sollte kurze Keywords als eigenstaendiges Wort trotzdem erkennen', () => {
    expect(guessCategory('Ei')).toBe('Milchprodukte & Eier');
    expect(guessCategory('6 Eier')).toBe('Milchprodukte & Eier');
    expect(guessCategory('Sonnenblumenöl')).toBe('Öle, Essig & Gewürze');
    expect(guessCategory('Grüner Tee')).toBe('Kaffee, Tee & Kakao');
  });

  it('liefert immer die gültige Sonstiges-Zone, wenn kein Signal passt', () => {
    expect(guessCategory('Restposten XY')).toBe('Sonstiges');
    expect(guessCategory('')).toBe('Sonstiges');
    expect(guessCategory('   ')).toBe('Sonstiges');
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
