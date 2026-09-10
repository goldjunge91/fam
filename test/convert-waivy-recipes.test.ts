import {
  convertWaivyRecipe,
  convertWaivyRecipes,
  stableUuid,
  type WaivyIngredient,
  type WaivyRecipe,
  type WaivyRecipeImage,
} from '../scripts/convert-waivy-recipes';

const ingredients: WaivyIngredient[] = [
  { id: 'eggs', name: 'Eggs', category: 'protein', unit: 'egg' },
  { id: 'soy-sauce', name: 'Soy sauce', category: 'condiment', unit: 'tbsp' },
];

const recipe: WaivyRecipe = {
  id: 'egg-fried-rice',
  name: 'Egg Fried Rice',
  description: 'Rice with eggs.',
  mealType: 'meal-prep',
  servings: 2,
  ingredients: [
    { ingredientId: 'eggs', quantity: 2 },
    { ingredientId: 'soy-sauce', quantity: 1, optional: true, note: 'to taste' },
  ],
  steps: ['Cook the eggs.', 'Add the rice.'],
  totalTimeMinutes: 12,
  prepTimeMinutes: 10,
  cookTimeMinutes: 12,
  difficulty: 'easy',
  equipment: ['stovetop'],
  dietTags: ['vegetarian', 'high-protein', 'dairy-free'],
  cuisine: 'Asian',
  tags: ['one-pot'],
  storageInstructions: 'Keep refrigerated for up to 3 days.',
  reheatingInstructions: 'Microwave for 60 seconds.',
  cheapTips: ['Use leftover rice.'],
  substitutions: [
    { forIngredientId: 'soy-sauce', swap: 'Tamari', savings: 'varies' },
  ],
  crispinessLevel: 'crispy',
  airFryerTimeMinutes: 8,
  airFryerTemperatureF: 400,
  variantGroup: 'fried-rice',
  variantType: 'original',
  dormFriendly: true,
  mealPrepFriendly: true,
  whyCheap: 'Uses inexpensive pantry staples.',
  healthierTips: ['Use less oil.'],
  batchPrepTips: ['Cook extra rice.'],
  optionalAddIns: ['Chili crisp'],
};

const image: WaivyRecipeImage = {
  recipeId: 'egg-fried-rice',
  src: 'https://upload.wikimedia.org/example.jpg',
  alt: 'Photo of egg fried rice',
  sourceName: 'Wikimedia Commons',
  sourceUrl: 'https://commons.wikimedia.org/example',
  license: 'CC BY 4.0',
  attributionRequired: true,
  attributionText: 'Photo: Example',
  verifiedMatch: true,
};

describe('Waivy recipe conversion', () => {
  it('creates stable ids for the catalog rows', () => {
    expect(stableUuid('recipe:waivy:egg-fried-rice')).toBe(
      stableUuid('recipe:waivy:egg-fried-rice'),
    );
    expect(stableUuid('recipe:waivy:egg-fried-rice')).not.toBe(
      stableUuid('recipe:waivy:tuna-mayo-rice-bowl'),
    );
  });

  it('maps Waivy metadata and ingredients to the catalog format', () => {
    const converted = convertWaivyRecipe(recipe, ingredients, 7, 'draft', image);

    expect(converted.recipe).toMatchObject({
      external_id: 'waivy:egg-fried-rice',
      slug: 'egg-fried-rice',
      title: 'Egg Fried Rice',
      instructions: 'Rice with eggs.',
      cook_time_minutes: 12,
      prep_time_minutes: 10,
      storage_instructions: 'Keep refrigerated for up to 3 days.',
      reheating_instructions: 'Microwave for 60 seconds.',
      cheap_tips: ['Use leftover rice.'],
      substitutions: [
        { forIngredientId: 'soy-sauce', swap: 'Tamari', savings: 'varies' },
      ],
      crispiness_level: 'crispy',
      air_fryer_time_minutes: 8,
      air_fryer_temperature_f: 400,
      variant_group: 'fried-rice',
      variant_type: 'original',
      dorm_friendly: true,
      meal_prep_friendly: true,
      why_cheap: 'Uses inexpensive pantry staples.',
      healthier_tips: ['Use less oil.'],
      batch_prep_tips: ['Cook extra rice.'],
      optional_add_ins: ['Chili crisp'],
      default_servings: 2,
      dish_types: ['dinner'],
      dietary_tags: ['vegetarian', 'lactose_free'],
      hashtags: ['meal-prep', 'high-protein', 'dairy-free', 'asian', 'one-pot'],
      sort_order: 7,
      status: 'draft',
    });

    expect(converted.components).toHaveLength(1);
    expect(converted.components[0]).toMatchObject({ serving_grams: 57.5 });
    expect(converted.items).toHaveLength(2);
    expect(converted.items[0]).toMatchObject({
      ingredient_name: 'Eggs',
      quantity: 2,
      unit: 'piece',
      grams: 100,
      position: 0,
    });
    expect(converted.items[1]).toMatchObject({
      ingredient_name: 'Soy sauce',
      quantity: 15,
      unit: 'g',
      grams: 15,
      position: 1,
      optional: true,
      source_note: 'to taste',
    });
    expect(converted.steps).toEqual([
      expect.objectContaining({ position: 0, text: 'Cook the eggs.' }),
      expect.objectContaining({ position: 1, text: 'Add the rice.' }),
    ]);
    expect(converted.images).toEqual([
      expect.objectContaining({
        source_url: image.src,
        source_page_url: image.sourceUrl,
        source_name: image.sourceName,
        license: image.license,
        attribution_required: true,
        attribution_text: image.attributionText,
        verified_match: true,
        storage_path: null,
      }),
    ]);
  });

  it('includes image rows in the versioned import bundle', () => {
    const bundle = convertWaivyRecipes(
      [recipe],
      ingredients,
      'draft',
      [image],
      new Map([['egg-fried-rice', 'assets/rezepte/waivy-recipe-photos/egg-fried-rice.jpg']]),
    );

    expect(bundle.format).toBe('fam.catalog_recipe_batch_import.v2');
    expect(bundle.schemaVersion).toBe(2);
    expect(bundle.recipes).toHaveLength(1);
    expect(bundle.recipes[0]).toMatchObject({
      externalId: 'waivy:egg-fried-rice',
      slug: 'egg-fried-rice',
      prepTimeMinutes: 10,
      cookTimeMinutes: 12,
      storageInstructions: 'Keep refrigerated for up to 3 days.',
      reheatingInstructions: 'Microwave for 60 seconds.',
      cheapTips: ['Use leftover rice.'],
      substitutions: [
        { forIngredientId: 'soy-sauce', swap: 'Tamari', savings: 'varies' },
      ],
      crispinessLevel: 'crispy',
      airFryerTimeMinutes: 8,
      airFryerTemperatureF: 400,
      variantGroup: 'fried-rice',
      variantType: 'original',
      dormFriendly: true,
      mealPrepFriendly: true,
      whyCheap: 'Uses inexpensive pantry staples.',
      healthierTips: ['Use less oil.'],
      batchPrepTips: ['Cook extra rice.'],
      optionalAddIns: ['Chili crisp'],
    });
    expect(bundle.recipes[0].components[0].items[1]).toMatchObject({
      ingredientName: 'Soy sauce',
      optional: true,
      source_note: 'to taste',
    });
    expect(bundle.recipes[0].images).toEqual([
      expect.objectContaining({
        storagePath: 'waivy/egg-fried-rice.jpg',
        localPath: 'assets/rezepte/waivy-recipe-photos/egg-fried-rice.jpg',
        sourceUrl: image.src,
        sourcePageUrl: image.sourceUrl,
        sourceName: image.sourceName,
        license: image.license,
        attributionRequired: true,
        attributionText: image.attributionText,
        verifiedMatch: true,
        altText: image.alt,
        position: 0,
      }),
    ]);
  });

  it('publishes recipes by default for the production catalog import', () => {
    const bundle = convertWaivyRecipes([recipe], ingredients);

    expect(bundle.recipes[0].status).toBe('published');
  });

  it('omits source ingredients whose quantity is zero and reports them', () => {
    const converted = convertWaivyRecipe(
      { ...recipe, ingredients: [...recipe.ingredients, { ingredientId: 'eggs', quantity: 0 }] },
      ingredients,
      7,
    );

    expect(converted.items).toHaveLength(2);
    expect(converted.warnings).toContainEqual({
      code: 'zero_quantity_ingredient',
      source_unit: 'egg',
    });
  });
});
