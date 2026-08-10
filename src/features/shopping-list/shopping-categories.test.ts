import { guessCategory, sortOrderForCategory, storageKindForCategory } from './shopping-categories';

describe('guessCategory', () => {
  it('sollte gängige Artikel korrekt erkennen', () => {
    expect(guessCategory('Vollmilch')).toBe('Molkerei');
    expect(guessCategory('Bio-Äpfel')).toBe('Obst & Gemüse');
    expect(guessCategory('Hähnchenbrust')).toBe('Wurst & Fleisch (Kühl)');
    expect(guessCategory('Vollkornbrot')).toBe('Backwaren & Brot');
    expect(guessCategory('Mineralwasser')).toBe('Getränke');
    expect(guessCategory('Toilettenpapier')).toBe('Drogerie & Haushalt');
  });

  it('sollte Gross-/Kleinschreibung ignorieren', () => {
    expect(guessCategory('SCHOKOLADE')).toBe('Süßwaren & Snacks');
  });

  it('sollte kurze Keywords nicht als Substring in anderen Woertern matchen', () => {
    // "ei" (Molkerei) als freier Substring wuerde all das faelschlich treffen.
    expect(guessCategory('Eis')).toBe('Tiefkühlkost');
    expect(guessCategory('Teig')).toBeNull();
    expect(guessCategory('Seife')).toBe('Drogerie & Haushalt');
    expect(guessCategory('Eimer')).toBeNull();
  });

  it('sollte kurze Keywords als eigenstaendiges Wort trotzdem erkennen', () => {
    expect(guessCategory('Ei')).toBe('Molkerei');
    expect(guessCategory('6 Eier')).toBe('Molkerei');
    expect(guessCategory('Sonnenblumenöl')).toBe('Grundnahrungsmittel');
    expect(guessCategory('Grüner Tee')).toBe('Müsli & Frühstück');
  });

  it('sollte null liefern, wenn kein Stichwort passt', () => {
    expect(guessCategory('Restposten XY')).toBeNull();
    expect(guessCategory('')).toBeNull();
    expect(guessCategory('   ')).toBeNull();
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
    expect(storageKindForCategory('Tiefkühlkost')).toBe('freezer');
    expect(storageKindForCategory('Molkerei')).toBe('fridge');
  });
});
