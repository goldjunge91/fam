import { render, screen, userEvent } from '@testing-library/react-native';

import { ALLERGY_PRESETS } from '@/features/profile/domain/food-rules';

const { FoodRuleSelectionSheet } = jest.requireActual<
  typeof import('./food-rule-selection-sheet.android')
>('./food-rule-selection-sheet.android');

describe('FoodRuleSelectionSheet Android', () => {
  test('filters and toggles presets, then applies a custom entry', async () => {
    const user = userEvent.setup();
    const onApply = jest.fn();
    const onClose = jest.fn();

    await render(
      <FoodRuleSelectionSheet
        visible
        title="Allergien"
        inputLabel="Allergie suchen oder ergänzen"
        presets={ALLERGY_PRESETS}
        value={[]}
        onApply={onApply}
        onClose={onClose}
      />,
    );

    await user.press(screen.getByRole('checkbox', { name: 'Erdnüsse' }));
    expect(screen.getByRole('checkbox', { name: 'Erdnüsse' }).props.accessibilityState).toEqual({
      checked: true,
    });

    await user.type(screen.getByLabelText('Allergie suchen oder ergänzen'), 'Erdnüsse');
    expect(screen.getByRole('checkbox', { name: 'Erdnüsse' })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: 'Milch' })).toBeNull();
    await user.clear(screen.getByLabelText('Allergie suchen oder ergänzen'));

    await user.type(screen.getByLabelText('Allergie suchen oder ergänzen'), '  Histamin  ');
    await user.press(screen.getByRole('button', { name: 'Histamin hinzufügen' }));
    expect(screen.getByText('Histamin')).toBeTruthy();
    await user.press(screen.getByRole('button', { name: 'Histamin entfernen' }));
    expect(screen.queryByText('Histamin')).toBeNull();

    await user.type(screen.getByLabelText('Allergie suchen oder ergänzen'), 'Histamin');
    await user.press(screen.getByRole('button', { name: 'Histamin hinzufügen' }));
    await user.press(screen.getByRole('button', { name: 'Auswahl übernehmen' }));

    expect(onApply).toHaveBeenCalledWith([
      { source: 'preset', code: 'peanuts' },
      { source: 'custom', label: 'Histamin', normalizedLabel: 'histamin' },
    ]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('matches a preset entered as custom text and reports an empty value', async () => {
    const user = userEvent.setup();
    const onApply = jest.fn();

    await render(
      <FoodRuleSelectionSheet
        visible
        title="Allergien"
        inputLabel="Allergie suchen oder ergänzen"
        presets={ALLERGY_PRESETS}
        value={[]}
        onApply={onApply}
        onClose={jest.fn()}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Eintrag hinzufügen' }));
    expect(screen.getAllByText('Bitte gib ein Lebensmittel ein.')).toHaveLength(2);

    await user.type(screen.getByLabelText('Allergie suchen oder ergänzen'), '  erdnüsse ');
    await user.press(screen.getByRole('button', { name: 'erdnüsse hinzufügen' }));
    await user.press(screen.getByRole('button', { name: 'Auswahl übernehmen' }));

    expect(onApply).toHaveBeenCalledWith([{ source: 'preset', code: 'peanuts' }]);
  });

  test('shows an empty-preset subtitle and resets local state when reopened', async () => {
    const user = userEvent.setup();
    const { rerender } = await render(
      <FoodRuleSelectionSheet
        visible
        title="Unverträglichkeiten"
        inputLabel="Lebensmittel ergänzen"
        presets={[]}
        value={[]}
        onApply={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText('Eigene Lebensmittel ergänzen')).toBeTruthy();
    await user.type(screen.getByLabelText('Lebensmittel ergänzen'), 'Laktose');
    await rerender(
      <FoodRuleSelectionSheet
        visible
        title="Unverträglichkeiten"
        inputLabel="Lebensmittel ergänzen"
        presets={[]}
        value={[{ source: 'custom', label: 'Gluten', normalizedLabel: 'gluten' }]}
        onApply={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText('Gluten')).toBeTruthy();
    expect(screen.queryByText('Laktose')).toBeNull();
    expect(screen.getByLabelText('Lebensmittel ergänzen')).toHaveDisplayValue('');
  });
});
