import { fireEvent, render, screen } from '@testing-library/react-native';

import type { RecipeListItem } from '@/features/recipes/hooks/use-recipes';
import { CookingModeNoSteps } from './cooking-mode-no-steps';

const recipe: RecipeListItem = {
  id: 'recipe-1',
  household_id: 'household-1',
  title: 'Ofengemüse',
  instructions: 'Gemüse schneiden und im Ofen rösten.',
  cover_image_path: null,
  cook_time_minutes: 35,
  difficulty: 'easy',
  dish_types: ['dinner'],
  dietary_tags: [],
  hashtags: [],
  default_servings: 2,
  created_by: 'user-1',
  created_at: '2026-10-11T00:00:00.000Z',
};

describe('CookingModeNoSteps', () => {
  test('shows recipe instructions and finishes cooking', async () => {
    const onFinish = jest.fn();
    await render(<CookingModeNoSteps recipe={recipe} onFinish={onFinish} />);

    expect(screen.getByText('Ofengemüse')).toBeOnTheScreen();
    expect(screen.getByText('Gemüse schneiden und im Ofen rösten.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Zubereitung abschließen' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  test('uses the explanation when instructions are missing', async () => {
    await render(
      <CookingModeNoSteps recipe={{ ...recipe, instructions: null }} onFinish={jest.fn()} />,
    );

    expect(
      screen.getByText('Für dieses Rezept sind noch keine Schritte hinterlegt.'),
    ).toBeOnTheScreen();
  });
});
