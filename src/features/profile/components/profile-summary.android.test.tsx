import { render, screen, userEvent } from '@testing-library/react-native';
import { EMPTY_PROFILE_BIOMETRICS } from '@/features/profile/domain/biometrics';
import {
  createCustomFoodSelection,
  EMPTY_PROFILE_FOOD_RULES,
} from '@/features/profile/domain/food-rules';
import { BiometricsSummary } from './biometrics-summary.android';
import { FoodRulesSummary } from './food-rules-summary.android';

describe('Android profile summaries', () => {
  test('shows saved biometrics and opens profile editing', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();

    await render(
      <BiometricsSummary
        value={{
          birthDate: '1990-10-10',
          heightCm: 178,
          weightKg: 80.5,
          sex: 'female',
          activityLevel: 'active',
        }}
        onPress={onPress}
      />,
    );

    expect(screen.getByText('80,5 kg')).toBeOnTheScreen();
    expect(screen.getByText('178 cm')).toBeOnTheScreen();
    const editButton = screen.getByRole('button', {
      name: 'Körper & Aktivität bearbeiten. 178 cm, 80,5 kg, 10.10.1990, Weiblich, Aktiv',
    });
    await user.press(editButton);

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('uses empty-value summaries when no biometrics are stored', async () => {
    await render(<BiometricsSummary value={EMPTY_PROFILE_BIOMETRICS} onPress={jest.fn()} />);

    expect(screen.getAllByText('Nicht gesetzt')).toHaveLength(5);
  });

  test('summarizes food rules and opens each editor', async () => {
    const onSelect = jest.fn();
    const user = userEvent.setup();
    const rules = {
      allergies: [{ source: 'preset' as const, code: 'peanuts' as const }],
      intolerances: [createCustomFoodSelection('Laktose')],
      dislikedFoods: [createCustomFoodSelection('Oliven')],
    };

    await render(<FoodRulesSummary rules={rules} onSelect={onSelect} />);

    const allergiesButton = screen.getByRole('button', {
      name: 'Allergien bearbeiten. Erdnüsse',
    });
    const intolerancesButton = screen.getByRole('button', {
      name: 'Unverträglichkeiten bearbeiten. Laktose',
    });
    const dislikedFoodsButton = screen.getByRole('button', {
      name: 'Mag ich nicht bearbeiten. Oliven',
    });
    await user.press(allergiesButton);
    await user.press(intolerancesButton);
    await user.press(dislikedFoodsButton);

    expect(onSelect.mock.calls).toEqual([['allergies'], ['intolerances'], ['dislikedFoods']]);
  });

  test('labels empty food-rule groups', async () => {
    await render(<FoodRulesSummary rules={EMPTY_PROFILE_FOOD_RULES} onSelect={jest.fn()} />);

    expect(screen.getAllByText('Keine Angaben')).toHaveLength(3);
  });
});
