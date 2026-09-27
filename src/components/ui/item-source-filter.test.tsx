import { render, screen, userEvent } from '@testing-library/react-native';

import { colorsLight as mockColorsLight } from '@/components/theme';

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: mockColorsLight }),
}));

import { ItemSourceFilterRow } from './item-source-filter';

describe('ItemSourceFilterRow', () => {
  it('reports a source selection and ignores the disabled source option', async () => {
    const onSourceChange = jest.fn();
    const user = userEvent.setup();

    await render(
      <ItemSourceFilterRow
        source="dish"
        onSourceChange={onSourceChange}
        sourceAccessibilityLabel="Quelle auswählen"
        suggestionFilter="frequent"
        onSuggestionFilterChange={jest.fn()}
        suggestionAccessibilityLabel="Vorschläge auswählen"
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Quelle auswählen' }));
    await user.press(screen.getByRole('menuitem', { name: '🥕 Lebensmittel' }));

    expect(onSourceChange).toHaveBeenCalledTimes(1);
    expect(onSourceChange).toHaveBeenCalledWith('food');

    await user.press(screen.getByRole('button', { name: 'Quelle auswählen' }));
    await user.press(screen.getByRole('menuitem', { name: '🍽️ Gerichte bald', disabled: true }));

    expect(onSourceChange).toHaveBeenCalledTimes(1);
  });

  it('changes the suggestion filter and closes the previously open menu', async () => {
    const onSuggestionFilterChange = jest.fn();
    const user = userEvent.setup();

    await render(
      <ItemSourceFilterRow
        source="food"
        onSourceChange={jest.fn()}
        sourceAccessibilityLabel="Quelle auswählen"
        suggestionFilter="frequent"
        onSuggestionFilterChange={onSuggestionFilterChange}
        suggestionAccessibilityLabel="Vorschläge auswählen"
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Quelle auswählen' }));
    await user.press(screen.getByRole('button', { name: 'Vorschläge auswählen' }));

    expect(screen.queryByRole('menuitem', { name: '🥕 Lebensmittel' })).not.toBeOnTheScreen();

    await user.press(screen.getByRole('menuitem', { name: '🔁 Zuletzt' }));

    expect(onSuggestionFilterChange).toHaveBeenCalledTimes(1);
    expect(onSuggestionFilterChange).toHaveBeenCalledWith('recent');
    expect(screen.queryByRole('menuitem', { name: '🔁 Zuletzt' })).not.toBeOnTheScreen();
  });
});
