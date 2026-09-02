import { render, screen, userEvent } from '@testing-library/react-native';

import { ALLERGY_PRESETS } from '@/features/profile/domain/food-rules';
import { FoodRuleSelectionSheet } from '@/features/profile/sheets/food-rule-selection-sheet';

describe('FoodRuleSelectionSheet', () => {
  test('übernimmt ausgewählte Presets und normalisierte freie Einträge gemeinsam', async () => {
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

    await user.press(screen.getByRole('checkbox', { name: 'Erdnüsse' }));
    await user.type(screen.getByLabelText('Allergie suchen oder ergänzen'), '  Histamin  ');
    await user.press(screen.getByRole('button', { name: 'Histamin hinzufügen' }));
    await user.press(screen.getByRole('button', { name: 'Auswahl übernehmen' }));

    expect(onApply).toHaveBeenCalledWith([
      { source: 'preset', code: 'peanuts' },
      { source: 'custom', label: 'Histamin', normalizedLabel: 'histamin' },
    ]);
  });

  test('verwirft lokale Änderungen beim Schließen', async () => {
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
    await user.press(screen.getByRole('button', { name: 'Allergien schließen' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });

  test('zeigt die Längengrenze für freie Einträge an', async () => {
    const user = userEvent.setup();

    await render(
      <FoodRuleSelectionSheet
        visible
        title="Mag ich nicht"
        inputLabel="Lebensmittel ergänzen"
        presets={[]}
        value={[]}
        onApply={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Lebensmittel ergänzen'), 'a'.repeat(81));
    await user.press(screen.getByRole('button', { name: 'Eintrag hinzufügen' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Der Eintrag darf höchstens 80 Zeichen lang sein.',
    );
  });
});
