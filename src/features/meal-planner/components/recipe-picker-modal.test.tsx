import { render, screen, userEvent } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { type RecipeOption, RecipePickerModal } from './recipe-picker-modal';

jest.mock('@shopify/flash-list', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    FlashList: ({
      data,
      renderItem,
    }: {
      data: readonly RecipeOption[];
      renderItem: ({ item }: { item: RecipeOption }) => React.ReactNode;
    }) =>
      React.createElement(
        View,
        null,
        ...data.map((item) =>
          React.createElement(React.Fragment, { key: item.id }, renderItem({ item })),
        ),
      ),
  };
});

jest.mock('@/features/recipes/components/recipe-preview-card', () => ({
  RecipeArtwork: () => null,
}));

jest.mock('@/features/recipes/data/household-recipe-images', () => ({
  useRecipeCoverUrl: () => ({ data: null }),
}));

jest.mock('@/constants/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, TextInput, View } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    Button: ({ title, onPress }: { title: string; onPress: () => void }) =>
      React.createElement(
        Pressable,
        { accessibilityRole: 'button', accessibilityLabel: title, onPress },
        React.createElement(Text, null, title),
      ),
    CloseButton: ({
      onPress,
      accessibilityLabel,
    }: {
      onPress: () => void;
      accessibilityLabel: string;
    }) =>
      React.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel, onPress }),
    Press: ({
      accessibilityLabel,
      onPress,
      children,
    }: {
      accessibilityLabel: string;
      onPress: () => void;
      children: React.ReactNode;
    }) =>
      React.createElement(
        Pressable,
        { accessibilityRole: 'button', accessibilityLabel, onPress },
        children,
      ),
    Surface: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    TextField: ({
      label,
      value,
      onChangeText,
      placeholder,
    }: {
      label: string;
      value: string;
      onChangeText: (text: string) => void;
      placeholder: string;
    }) =>
      React.createElement(TextInput, {
        accessibilityLabel: label,
        value,
        onChangeText,
        placeholder,
      }),
    Txt: ({ children }: { children: React.ReactNode }) => React.createElement(Text, null, children),
  };
});

const recipes: RecipeOption[] = [
  { id: 'soup', title: 'Kartoffelsuppe' },
  { id: 'salad', title: 'Bohnensalat' },
];

describe('RecipePickerModal', () => {
  const originalPlatform = Platform.OS;
  const onDismiss = jest.fn();
  const onSelect = jest.fn();
  const onCreateCustom = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  it('shows the create-first empty state and handles custom creation and dismissal', async () => {
    const user = userEvent.setup();
    await render(
      <RecipePickerModal
        visible
        recipes={[]}
        onDismiss={onDismiss}
        onSelect={onSelect}
        onCreateCustom={onCreateCustom}
      />,
    );

    expect(
      screen.getByText('Noch keine Rezepte vorhanden. Lege zuerst ein Rezept an.'),
    ).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Freies Gericht eintragen' }));
    await user.press(screen.getByRole('button', { name: 'Schließen' }));

    expect(onCreateCustom).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('filters recipes by trimmed case-insensitive text and selects a match', async () => {
    const user = userEvent.setup();
    await render(
      <RecipePickerModal
        visible
        recipes={recipes}
        onDismiss={onDismiss}
        onSelect={onSelect}
        onCreateCustom={onCreateCustom}
      />,
    );

    await user.type(screen.getByPlaceholderText('Rezept suchen…'), '  SUPPE ');

    expect(screen.getByRole('button', { name: 'Kartoffelsuppe eintragen' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Bohnensalat eintragen' })).not.toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Kartoffelsuppe eintragen' }));

    expect(onSelect).toHaveBeenCalledWith(recipes[0]);
  });

  it('shows a no-results message and uses the Android modal presentation', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const user = userEvent.setup();
    await render(
      <RecipePickerModal
        visible
        recipes={recipes}
        onDismiss={onDismiss}
        onSelect={onSelect}
        onCreateCustom={onCreateCustom}
      />,
    );

    await user.type(screen.getByPlaceholderText('Rezept suchen…'), 'does not exist');

    expect(screen.getByText('Kein Rezept gefunden.')).toBeOnTheScreen();
  });
});
