import {
  APP_FEATURES,
  type FeatureDefinition,
  getDrawerGroups,
  getFeature,
  getFeatureByFlag,
  getSettingsModules,
  getSpeedDialOptions,
} from './feature-registry';

describe('feature registry SpeedDial configuration', () => {
  it('transports semantic theme keys instead of UI color values', () => {
    expect(getSpeedDialOptions().map((option) => option.backgroundToken)).toEqual([
      'speedDialPantry',
      'speedDialShopping',
      'speedDialCalories',
      'speedDialRecipes',
    ]);
  });

  it('looks up features by id and remote flag', () => {
    expect(getFeature('recipes')).toMatchObject({ id: 'recipes', title: 'Rezepte' });
    expect(getFeature('unknown')).toBeUndefined();
    expect(getFeatureByFlag('module-recipes')).toMatchObject({ id: 'recipes' });
  });

  it('groups drawer routes by household scope and configured order', () => {
    expect(getDrawerGroups().map(({ key, routes }) => [key, routes.map(({ id }) => id)])).toEqual([
      ['today', ['overview']],
      ['household', ['fridge', 'shoppingList', 'recipes', 'brochures', 'mealPlanner']],
      ['private', ['calories']],
    ]);
  });

  it('derives settings modules from features with both a module and settings entry', () => {
    expect(getSettingsModules().map(({ key }) => key)).toEqual([
      'fridge',
      'shoppingList',
      'calories',
      'recipes',
      'mealPlanner',
    ]);
  });

  it('uses stable fallback order when an optional order is absent', () => {
    const features = APP_FEATURES as unknown as FeatureDefinition[];
    const originalLength = features.length;
    features.push({
      id: 'coverage-fallbacks',
      title: 'Fallbacks',
      moduleKey: 'fridge',
      drawer: { group: 'today', href: '/fallbacks', icon: 'overview' },
      speedDial: {
        title: 'Fallback',
        icon: 'overview',
        href: '/fallbacks',
        backgroundToken: 'speedDialPantry',
      },
      settings: { iconEmoji: '🧪', title: 'Fallback', desc: 'Fallback order' },
    });

    try {
      expect(getDrawerGroups()[0]?.routes.at(-1)?.id).toBe('coverage-fallbacks');
      expect(getSpeedDialOptions().at(-1)?.id).toBe('coverage-fallbacks');
      expect(getSettingsModules().at(-1)?.feature.id).toBe('coverage-fallbacks');
    } finally {
      features.length = originalLength;
    }
  });

  it.each([
    [8, 'breakfast'],
    [12, 'lunch'],
    [17, 'dinner'],
    [22, 'snack'],
  ])('builds the calorie quick action for local hour %i', (hour, mealType) => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 0, 15, hour));

    const calorieAction = getSpeedDialOptions().find(({ id }) => id === 'calories');
    if (!calorieAction || typeof calorieAction.href !== 'function') {
      throw new Error('The calorie quick action must build its route at press time.');
    }

    expect(calorieAction.href()).toContain(`date=2026-01-15&mealType=${mealType}`);
    jest.useRealTimers();
  });
});
