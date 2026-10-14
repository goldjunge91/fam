import { fireEvent, render, screen } from '@testing-library/react-native';

import { CATEGORY_TILES, CategoryCarousel } from './category-carousel';

type RecipeMatchData = {
  dish_types: string[];
  dietary_tags: string[];
  cook_time_minutes: number | null;
  kcalPerServing: number | null;
  proteinGPerServing: number | null;
  carbsGPerServing: number | null;
};

const BASE_RECIPE: RecipeMatchData = {
  dish_types: [] as string[],
  dietary_tags: [] as string[],
  cook_time_minutes: null,
  kcalPerServing: null,
  proteinGPerServing: null,
  carbsGPerServing: null,
};
const MATCHING_RECIPES: Array<[string, Partial<RecipeMatchData>]> = [
  ['breakfast', { dish_types: ['breakfast'] }],
  ['lunch', { dish_types: ['lunch'] }],
  ['dinner', { dish_types: ['dinner'] }],
  ['snack', { dish_types: ['snack'] }],
  ['vegan', { dietary_tags: ['vegan'] }],
  ['vegetarian', { dietary_tags: ['vegetarian'] }],
  ['high_protein', { kcalPerServing: 500, proteinGPerServing: 40 }],
  ['low_carb', { carbsGPerServing: 19 }],
  ['quick', { cook_time_minutes: 20 }],
  ['dessert', { dish_types: ['dessert'] }],
];

describe('CategoryCarousel', () => {
  it.each(MATCHING_RECIPES)('matches the %s recipe category', (key, recipe) => {
    const tile = CATEGORY_TILES.find((item) => item.key === key);
    expect(tile?.matches({ ...BASE_RECIPE, ...recipe })).toBe(true);
    expect(tile?.label).toBeTruthy();
    expect(tile?.emoji).toBeTruthy();
  });

  it('rejects incomplete nutrition values and values outside thresholds', () => {
    const highProtein = CATEGORY_TILES.find((tile) => tile.key === 'high_protein');
    const lowCarb = CATEGORY_TILES.find((tile) => tile.key === 'low_carb');
    const quick = CATEGORY_TILES.find((tile) => tile.key === 'quick');

    expect(
      highProtein?.matches({ ...BASE_RECIPE, kcalPerServing: 0, proteinGPerServing: 50 }),
    ).toBe(false);
    expect(
      highProtein?.matches({ ...BASE_RECIPE, kcalPerServing: 400, proteinGPerServing: 0 }),
    ).toBe(false);
    expect(
      highProtein?.matches({ ...BASE_RECIPE, kcalPerServing: 500, proteinGPerServing: 20 }),
    ).toBe(false);
    expect(lowCarb?.matches({ ...BASE_RECIPE, carbsGPerServing: null })).toBe(false);
    expect(lowCarb?.matches({ ...BASE_RECIPE, carbsGPerServing: 20 })).toBe(false);
    expect(quick?.matches({ ...BASE_RECIPE, cook_time_minutes: null })).toBe(false);
    expect(quick?.matches({ ...BASE_RECIPE, cook_time_minutes: 21 })).toBe(false);
  });

  it('toggles the selected tile off and selects a different tile', async () => {
    const onSelect = jest.fn();
    await render(<CategoryCarousel selectedKey="breakfast" onSelect={onSelect} />);

    expect(screen.getByRole('button', { name: 'Frühstück' }).props.accessibilityState).toEqual({
      selected: true,
    });
    expect(screen.getByRole('button', { name: 'Vegan' }).props.accessibilityState).toEqual({
      selected: false,
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Frühstück' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Vegan' }));

    expect(onSelect).toHaveBeenNthCalledWith(1, null);
    expect(onSelect).toHaveBeenNthCalledWith(2, 'vegan');
  });
});
