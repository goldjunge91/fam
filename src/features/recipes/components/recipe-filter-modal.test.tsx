import { render, screen, userEvent } from '@testing-library/react-native';
import { EMPTY_RECIPE_FILTERS, RecipeFilterModal, type RecipeFilters } from './recipe-filter-modal';

jest.mock('@/features/recipes/components/category-carousel', () => ({
  CategoryCarousel: () => null,
}));

jest.mock('@/features/recipes/components/calorie-carousel', () => ({
  CalorieCarousel: () => null,
}));

describe('RecipeFilterModal', () => {
  it('toggles selected and unselected tags before applying the draft', async () => {
    const user = userEvent.setup();
    const onApply = jest.fn();
    const filters: RecipeFilters = { ...EMPTY_RECIPE_FILTERS, tags: ['vegan'] };

    await render(
      <RecipeFilterModal
        visible
        filters={filters}
        tags={['vegan', 'schnell']}
        getResultCount={(draft) => draft.tags.length}
        onApply={onApply}
        onClose={jest.fn()}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Tag vegan' }));
    await user.press(screen.getByRole('button', { name: 'Tag schnell' }));
    await user.press(screen.getByRole('button', { name: '1 Rezept anzeigen' }));

    expect(onApply).toHaveBeenCalledWith({ ...EMPTY_RECIPE_FILTERS, tags: ['schnell'] });
  });
});
