import {
  calculateAdjustedServingNutrition,
  calculateComponentPer100g,
  calculateServingNutrition,
  type ProductNutritionRow,
  type RecipeComponentItemRow,
  type RecipeComponentRow,
  scaleServing,
} from '@/features/recipes/nutrition';

// Referenzbeispiel aus docs/plans/phase-2-4-brainstorm.md, Abschnitt #12:
// Nudeln 200kcal/100g, Soße aus 50g Tomaten (30kcal/100g) + 300g Hackfleisch
// (100kcal/100g) -> 90kcal/100g Soße; Portion 300g Nudeln + 200g Soße -> 780kcal.
const nudeln: ProductNutritionRow = {
  id: 'nudeln',
  kcal_per_100: 200,
  protein_g_per_100: 7,
  carbs_g_per_100: 40,
  fat_g_per_100: 1.5,
};
const tomaten: ProductNutritionRow = {
  id: 'tomaten',
  kcal_per_100: 30,
  protein_g_per_100: 1,
  carbs_g_per_100: 4,
  fat_g_per_100: 0,
};
const hackfleisch: ProductNutritionRow = {
  id: 'hackfleisch',
  kcal_per_100: 100,
  protein_g_per_100: 18,
  carbs_g_per_100: 0,
  fat_g_per_100: 3,
};

const productsById = new Map([nudeln, tomaten, hackfleisch].map((p) => [p.id, p]));

const nudelnKomponente: RecipeComponentRow = { id: 'nudeln-komponente', serving_grams: 300 };
const sauceKomponente: RecipeComponentRow = { id: 'sauce', serving_grams: 200 };
const components: RecipeComponentRow[] = [nudelnKomponente, sauceKomponente];

const items: RecipeComponentItemRow[] = [
  { component_id: 'nudeln-komponente', product_id: 'nudeln', sub_component_id: null, grams: 300 },
  { component_id: 'sauce', product_id: 'tomaten', sub_component_id: null, grams: 50 },
  { component_id: 'sauce', product_id: 'hackfleisch', sub_component_id: null, grams: 300 },
];

describe('calculateComponentPer100g', () => {
  it('berechnet den Bolognese-Referenzwert fuer die Soße (90kcal/100g)', () => {
    const per100 = calculateComponentPer100g('sauce', items, productsById);
    expect(per100.kcal).toBeCloseTo(90, 5);
  });

  it('gibt den reinen Zutaten-Wert weiter, wenn die Komponente nur eine Zutat hat', () => {
    const per100 = calculateComponentPer100g('nudeln-komponente', items, productsById);
    expect(per100.kcal).toBeCloseTo(200, 5);
  });

  it('berechnet rekursiv ueber eine Unterkomponente', () => {
    const nestedItems: RecipeComponentItemRow[] = [
      ...items,
      { component_id: 'gericht', product_id: null, sub_component_id: 'sauce', grams: 200 },
      {
        component_id: 'gericht',
        product_id: null,
        sub_component_id: 'nudeln-komponente',
        grams: 300,
      },
    ];
    const per100 = calculateComponentPer100g('gericht', nestedItems, productsById);
    // (200*3 + 90*2) / 5 = 156
    expect(per100.kcal).toBeCloseTo(156, 5);
  });

  it('gibt 0 fuer eine Komponente ohne Positionen zurueck', () => {
    const per100 = calculateComponentPer100g('leer', [], productsById);
    expect(per100).toEqual({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  });

  it('wirft bei einer zyklischen Verschachtelung, statt in eine Endlosschleife zu laufen', () => {
    const cyclicItems: RecipeComponentItemRow[] = [
      { component_id: 'a', product_id: null, sub_component_id: 'b', grams: 100 },
      { component_id: 'b', product_id: null, sub_component_id: 'a', grams: 100 },
    ];
    expect(() => calculateComponentPer100g('a', cyclicItems, productsById)).toThrow(
      /Zyklische Komponenten-Verschachtelung/,
    );
  });
});

describe('calculateServingNutrition', () => {
  it('berechnet die Bolognese-Referenzportion (780kcal aus 300g Nudeln + 200g Soße)', () => {
    const serving = calculateServingNutrition(components, items, productsById);
    expect(serving.kcal).toBeCloseTo(780, 5);
    expect(serving.grams).toBe(500);
  });

  it('ignoriert Komponenten ohne serving_grams (nur Unterkomponenten)', () => {
    const withSubOnly: RecipeComponentRow[] = [
      ...components,
      { id: 'nur-unterkomponente', serving_grams: null },
    ];
    const serving = calculateServingNutrition(withSubOnly, items, productsById);
    expect(serving.kcal).toBeCloseTo(780, 5);
  });
});

describe('calculateAdjustedServingNutrition', () => {
  it('verhaelt sich wie calculateServingNutrition ohne Overrides', () => {
    const adjusted = calculateAdjustedServingNutrition(components, items, productsById, new Map());
    expect(adjusted.kcal).toBeCloseTo(780, 5);
    expect(adjusted.grams).toBe(500);
  });

  it('nutzt "mehr Soße" nur fuer die Berechnung, ohne serving_grams zu veraendern', () => {
    const overrides = new Map([['sauce', 400]]); // statt 200g
    const adjusted = calculateAdjustedServingNutrition(components, items, productsById, overrides);
    // 300g Nudeln (600kcal) + 400g Soße a 90kcal/100g (360kcal) = 960kcal
    expect(adjusted.kcal).toBeCloseTo(960, 5);
    expect(adjusted.grams).toBe(700);
    expect(sauceKomponente.serving_grams).toBe(200); // Original unveraendert
  });

  it('ueberspringt eine auf 0 gesetzte Komponente', () => {
    const overrides = new Map([['sauce', 0]]);
    const adjusted = calculateAdjustedServingNutrition(components, items, productsById, overrides);
    expect(adjusted.kcal).toBeCloseTo(600, 5); // nur noch die Nudeln
    expect(adjusted.grams).toBe(300);
  });
});

describe('scaleServing', () => {
  it('skaliert alle Werte linear ("2 Portionen")', () => {
    const serving = calculateServingNutrition(components, items, productsById);
    const doubled = scaleServing(serving, 2);
    expect(doubled.kcal).toBeCloseTo(1560, 5);
    expect(doubled.grams).toBe(1000);
  });
});
