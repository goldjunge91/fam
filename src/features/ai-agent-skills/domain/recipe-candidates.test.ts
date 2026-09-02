import type { PerishableInventoryContext } from '@/features/ai-agent-skills/domain/contracts';
import {
  bindRecipeCandidateToInventory,
  filterRecipeCandidates,
  type RecipeCandidate,
} from '@/features/ai-agent-skills/domain/recipe-candidates';

const candidate = (overrides: Partial<RecipeCandidate> = {}): RecipeCandidate => ({
  id: 'recipe-1',
  title: 'Schnelle Gemüsepfanne',
  cookTimeMinutes: 20,
  defaultServings: 2,
  dietaryTags: ['vegetarian'],
  allergens: [],
  ingredients: [],
  ...overrides,
});

const context: PerishableInventoryContext = {
  source: 'inventory',
  fetchedAt: '2026-09-01T10:00:00.000Z',
  lots: [
    {
      lotId: 'lot-tomato',
      productId: 'product-tomato',
      normalizedName: 'Tomate',
      quantity: 2,
      unit: 'Stück',
      bestBefore: '2026-09-02',
      useBy: null,
      storage: 'fridge',
    },
  ],
};

describe('filterRecipeCandidates', () => {
  it('excludes candidates that violate an explicit allergy or dietary pattern', () => {
    const result = filterRecipeCandidates(
      [
        candidate({ id: 'recipe-allergen', allergens: ['peanuts'] }),
        candidate({ id: 'recipe-diet', dietaryTags: ['vegan'] }),
        candidate({ id: 'recipe-safe' }),
      ],
      { allergies: ['Erdnüsse'], dietaryPattern: 'vegetarian', maxMinutes: null, servings: null },
    );

    expect(result.map(({ recipe }) => recipe.id)).toEqual(['recipe-safe']);
    expect(result[0]?.constraintChecks).toEqual({
      allergies: 'pass',
      dietaryPattern: 'pass',
      time: 'unknown',
    });
  });

  it('rejects unknown safety metadata when a hard constraint is requested', () => {
    const result = filterRecipeCandidates(
      [
        candidate({ id: 'unknown-allergens', allergens: null }),
        candidate({ id: 'unknown-time', cookTimeMinutes: null }),
        candidate({ id: 'safe', cookTimeMinutes: 15 }),
      ],
      { allergies: ['Nüsse'], dietaryPattern: null, maxMinutes: 20, servings: null },
    );

    expect(result.map(({ recipe }) => recipe.id)).toEqual(['safe']);
  });

  it('rejects recipes without serving metadata when a serving target is requested', () => {
    const result = filterRecipeCandidates(
      [candidate({ id: 'unknown-servings', defaultServings: null }), candidate({ id: 'scalable' })],
      { allergies: [], dietaryPattern: null, maxMinutes: null, servings: 4 },
    );

    expect(result.map(({ recipe }) => recipe.id)).toEqual(['scalable']);
  });

  it('sorts deterministically and caps the result at three candidates', () => {
    const candidates = [
      candidate({ id: 'recipe-c', title: 'Zucchini', cookTimeMinutes: 30 }),
      candidate({ id: 'recipe-b', title: 'Apfel', cookTimeMinutes: 10 }),
      candidate({ id: 'recipe-a', title: 'Birne', cookTimeMinutes: 10 }),
      candidate({ id: 'recipe-d', title: 'Karotte', cookTimeMinutes: null }),
    ];

    const result = filterRecipeCandidates(candidates, {
      allergies: [],
      dietaryPattern: null,
      maxMinutes: null,
      servings: null,
    });

    expect(result.map(({ recipe }) => recipe.id)).toEqual(['recipe-b', 'recipe-a', 'recipe-c']);
  });

  it('binds ingredients only to an available lot and reports the rest as missing', () => {
    const result = bindRecipeCandidateToInventory(
      candidate({
        ingredients: [
          { productId: 'product-tomato', normalizedName: 'Tomate', quantity: 1, unit: 'Stück' },
          { productId: null, normalizedName: 'Zwiebel', quantity: 1, unit: 'Stück' },
        ],
      }),
      context,
    );

    expect(result).toEqual({ usedLots: ['lot-tomato'], missingIngredients: ['Zwiebel'] });
  });
});
