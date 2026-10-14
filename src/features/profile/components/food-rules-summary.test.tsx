import { render, screen, userEvent } from '@testing-library/react-native';
import type { AllergyCode, ProfileFoodRules } from '@/features/profile/domain/food-rules';
import { FoodRulesSummary } from './food-rules-summary';

describe('FoodRulesSummary', () => {
  it('shows the empty summary and opens each editor', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    const rules: ProfileFoodRules = { allergies: [], intolerances: [], dislikedFoods: [] };

    await render(<FoodRulesSummary rules={rules} onSelect={onSelect} />);

    expect(screen.getAllByText('Keine Angaben')).toHaveLength(3);
    await user.press(screen.getByRole('button', { name: 'Allergien bearbeiten. Keine Angaben' }));
    await user.press(
      screen.getByRole('button', { name: 'Unverträglichkeiten bearbeiten. Keine Angaben' }),
    );
    await user.press(
      screen.getByRole('button', { name: 'Mag ich nicht bearbeiten. Keine Angaben' }),
    );

    expect(onSelect.mock.calls).toEqual([['allergies'], ['intolerances'], ['dislikedFoods']]);
  });

  it('summarizes preset and custom entries and falls back to an unknown preset code', async () => {
    const rules: ProfileFoodRules = {
      allergies: [
        { source: 'preset', code: 'milk' },
        { source: 'custom', label: 'Kiwi', normalizedLabel: 'kiwi' },
        { source: 'preset', code: 'unknown-code' as AllergyCode },
      ],
      intolerances: [{ source: 'preset', code: 'lactose' }],
      dislikedFoods: [{ source: 'custom', label: 'Pilze', normalizedLabel: 'pilze' }],
    };

    await render(<FoodRulesSummary rules={rules} onSelect={jest.fn()} />);

    expect(
      screen.getByRole('button', {
        name: 'Allergien bearbeiten. Milch / Milcheiweiß, Kiwi, unknown-code',
      }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Unverträglichkeiten bearbeiten. Laktose' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Mag ich nicht bearbeiten. Pilze' }),
    ).toBeOnTheScreen();
  });
});
