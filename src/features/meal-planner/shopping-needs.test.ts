import {
  computeIngredientNeeds,
  computeMissingIngredients,
  type RecipeNeedInput,
  stockInGrams,
} from './shopping-needs';

// Referenzbeispiel wie in nutrition.test.ts: "Soße" aus 50g Tomaten + 300g
// Hackfleisch, oberste Komponente mit serving_grams=200 ("1 Portion Soße").
const sauceComponent = { id: 'sauce', serving_grams: 200 };
const sauceItems = [
  { component_id: 'sauce', product_id: 'tomaten', sub_component_id: null, grams: 50 },
  { component_id: 'sauce', product_id: 'hack', sub_component_id: null, grams: 300 },
];

describe('computeIngredientNeeds', () => {
  it('skaliert den Zutatenbedarf linear auf die eingetragenen Portionen', () => {
    const need: RecipeNeedInput = {
      recipeId: 'r1',
      portions: 2,
      components: [sauceComponent],
      items: sauceItems,
    };

    const { needs } = computeIngredientNeeds([need]);

    // 1 Portion Soße besteht zu 50/350 aus Tomaten, 300/350 aus Hackfleisch,
    // insgesamt aber immer auf serving_grams (200g) normiert -> bei 2
    // Portionen: 400g Gesamtmasse im selben Verhaeltnis.
    expect(needs.get('tomaten')).toBeCloseTo((50 / 350) * 200 * 2, 4);
    expect(needs.get('hack')).toBeCloseTo((300 / 350) * 200 * 2, 4);
  });

  it('summiert den Bedarf ueber mehrere Rezepte/Eintraege desselben Produkts', () => {
    const need1: RecipeNeedInput = {
      recipeId: 'r1',
      portions: 1,
      components: [sauceComponent],
      items: sauceItems,
    };
    const need2: RecipeNeedInput = {
      recipeId: 'r2',
      portions: 1,
      components: [{ id: 'other', serving_grams: 100 }],
      items: [{ component_id: 'other', product_id: 'tomaten', sub_component_id: null, grams: 100 }],
    };

    const { needs } = computeIngredientNeeds([need1, need2]);

    const fromSauce = (50 / 350) * 200;
    expect(needs.get('tomaten')).toBeCloseTo(fromSauce + 100, 4);
  });

  it('haelt fest, welche Rezepte zum Bedarf eines Produkts beigetragen haben', () => {
    const need1: RecipeNeedInput = {
      recipeId: 'r1',
      portions: 1,
      components: [sauceComponent],
      items: sauceItems,
    };
    const need2: RecipeNeedInput = {
      recipeId: 'r2',
      portions: 1,
      components: [{ id: 'other', serving_grams: 100 }],
      items: [{ component_id: 'other', product_id: 'tomaten', sub_component_id: null, grams: 100 }],
    };

    const { recipeIdsByProduct } = computeIngredientNeeds([need1, need2]);

    expect(recipeIdsByProduct.get('tomaten')).toEqual(new Set(['r1', 'r2']));
    expect(recipeIdsByProduct.get('hack')).toEqual(new Set(['r1']));
  });

  it('rekursiv verschachtelte Unterkomponenten werden mit eingerechnet', () => {
    const base: RecipeNeedInput = {
      recipeId: 'r1',
      portions: 1,
      components: [{ id: 'noodle_base', serving_grams: 300 }, sauceComponent],
      items: [
        ...sauceItems,
        { component_id: 'noodle_base', product_id: 'noodles', sub_component_id: null, grams: 100 },
        { component_id: 'noodle_base', product_id: null, sub_component_id: 'sauce', grams: 200 },
      ],
    };

    const { needs } = computeIngredientNeeds([base]);

    // "sauce" kommt zweimal vor: einmal als eigene oberste Komponente
    // (serving_grams=200) und einmal als Unterkomponente von noodle_base
    // (200g von serving-normierten 300g).
    const directSauceTomaten = (50 / 350) * 200;
    const viaNoodleBaseTomaten = (50 / 350) * ((200 / 300) * 300);
    expect(needs.get('tomaten')).toBeCloseTo(directSauceTomaten + viaNoodleBaseTomaten, 4);
    expect(needs.get('noodles')).toBeCloseTo((100 / 300) * 300, 4);
  });

  it('ignoriert Komponenten ohne serving_grams (reine Unterkomponenten)', () => {
    const need: RecipeNeedInput = {
      recipeId: 'r1',
      portions: 1,
      components: [{ id: 'sub_only', serving_grams: null }],
      items: [
        { component_id: 'sub_only', product_id: 'tomaten', sub_component_id: null, grams: 50 },
      ],
    };

    expect(computeIngredientNeeds([need]).needs.size).toBe(0);
  });
});

describe('stockInGrams', () => {
  it('rechnet g/kg/ml/l direkt um', () => {
    const result = stockInGrams(
      [
        { product_id: 'tomaten', quantity: 200, unit: 'g' },
        { product_id: 'milch', quantity: 1, unit: 'l' },
      ],
      new Map(),
    );
    expect(result.get('tomaten')).toBe(200);
    expect(result.get('milch')).toBe(1000);
  });

  it('rechnet stueckbasierte Einheiten mit bekanntem serving_size_g um', () => {
    const result = stockInGrams(
      [{ product_id: 'eier', quantity: 6, unit: 'piece' }],
      new Map([['eier', { serving_size_g: 60 }]]),
    );
    expect(result.get('eier')).toBe(360);
  });

  it('laesst nicht umrechenbare Positionen aus dem Bestand weg', () => {
    const result = stockInGrams(
      [{ product_id: 'unbekannt', quantity: 3, unit: 'piece' }],
      new Map(),
    );
    expect(result.has('unbekannt')).toBe(false);
  });

  it('summiert mehrere Zeilen desselben Produkts', () => {
    const result = stockInGrams(
      [
        { product_id: 'tomaten', quantity: 100, unit: 'g' },
        { product_id: 'tomaten', quantity: 200, unit: 'g' },
      ],
      new Map(),
    );
    expect(result.get('tomaten')).toBe(300);
  });
});

describe('computeMissingIngredients', () => {
  it('berechnet die fehlende Menge als Bedarf minus Bestand', () => {
    const needs = new Map([
      ['tomaten', 500],
      ['hack', 300],
    ]);
    const stock = new Map([['tomaten', 200]]);

    const result = computeMissingIngredients(needs, stock);

    expect(result).toEqual([
      { productId: 'tomaten', neededGrams: 500, availableGrams: 200, missingGrams: 300 },
      { productId: 'hack', neededGrams: 300, availableGrams: 0, missingGrams: 300 },
    ]);
  });

  it('nimmt Produkte, die vollstaendig vorraetig sind, mit missingGrams 0 auf statt sie wegzulassen', () => {
    // Nachschub-Fall (#131-Nachschaerfung): der Nutzer soll einen bereits
    // gedeckten Artikel weiterhin in der Vorschlagsliste sehen und bei
    // Bedarf trotzdem nachkaufen koennen, statt dass er komplett
    // verschwindet.
    const needs = new Map([['tomaten', 200]]);
    const stock = new Map([['tomaten', 200]]);

    expect(computeMissingIngredients(needs, stock)).toEqual([
      { productId: 'tomaten', neededGrams: 200, availableGrams: 200, missingGrams: 0 },
    ]);
  });

  it('laesst missingGrams negativ, wenn der Vorrat den Bedarf uebersteigt', () => {
    const needs = new Map([['tomaten', 200]]);
    const stock = new Map([['tomaten', 500]]);

    expect(computeMissingIngredients(needs, stock)).toEqual([
      { productId: 'tomaten', neededGrams: 200, availableGrams: 500, missingGrams: -300 },
    ]);
  });

  it('sortiert absteigend nach fehlender Menge, gedeckte Artikel rutschen ans Ende', () => {
    const needs = new Map([
      ['a', 100],
      ['b', 500],
      ['c', 50],
    ]);
    const stock = new Map([['c', 500]]);

    const result = computeMissingIngredients(needs, stock);
    expect(result.map((r) => r.productId)).toEqual(['b', 'a', 'c']);
  });
});
