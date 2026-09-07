import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { ChefKochScreen } from './chef-koch-screen';

const mockMutate = jest.fn();
const mockCookMutate = jest.fn();
const mockSuggestionResult = {
  schema_version: 1,
  meals: [
    {
      title: 'Tomaten-Spinat-Pasta',
      source: 'catalog',
      recipe_id: 'catalog-pasta',
      servings: 2,
      used_items: [
        { inventory_item_id: 'inventory-spinach', quantity: 150, unit: 'g' },
        { inventory_item_id: 'inventory-tomatoes', quantity: 2, unit: 'piece' },
      ],
      additional_ingredients: ['Parmesan'],
      steps: ['Kochen'],
      notes: [],
    },
  ],
};
type MockSuggestionState = {
  data:
    | {
        result: typeof mockSuggestionResult;
        shoppingQuestion: string | null;
      }
    | undefined;
  isPending: boolean;
  isError: boolean;
  mutate: typeof mockMutate;
};

let mockSuggestionState: MockSuggestionState = {
  data: { result: mockSuggestionResult, shoppingQuestion: null as string | null },
  isPending: false,
  isError: false,
  mutate: mockMutate,
};

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'household-1' }),
}));

jest.mock('@/features/inventory/use-inventory-items', () => ({
  useInventoryItems: () => ({
    data: [
      {
        id: 'inventory-spinach',
        name: 'Spinat',
        household_id: 'household-1',
        quantity: 500,
        unit: 'g',
      },
      {
        id: 'inventory-tomatoes',
        name: 'Tomaten',
        household_id: 'household-1',
        quantity: 4,
        unit: 'piece',
      },
    ],
  }),
}));

jest.mock('@/features/recipes/data/use-recipe-suggestions', () => ({
  useRecipeSuggestions: () => mockSuggestionState,
}));

jest.mock('@/features/recipes/data/use-recipe-suggestion-cook-review', () => ({
  useApplyRecipeSuggestionCookReviewMutation: () => ({
    mutate: mockCookMutate,
    isPending: false,
    isError: false,
    isSuccess: false,
  }),
}));

jest.mock('@/components/layout/screen', () => ({
  Screen: ({ children }: { children: React.ReactNode }) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
  ScreenHeader: ({ title }: { title: string }) => {
    const { Text } = require('react-native');
    return <Text>{title}</Text>;
  },
}));

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      accent: '#000',
      backgroundSoft: '#fff',
      border: '#000',
      text: '#000',
      textMuted: '#000',
      surface: '#fff',
    },
  }),
}));

jest.mock('@/constants/ui', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return {
    Row: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    Surface: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    Txt: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
  };
});

jest.mock('@/components/ui/buttons', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});

describe('Chef-Koch read-only screen', () => {
  let renderer: ReactTestRenderer;

  function textContent() {
    return JSON.stringify(renderer.toJSON());
  }

  function press(label: string) {
    const button = renderer.root.find((node) => node.props.accessibilityLabel === label);
    act(() => button.props.onPress());
  }

  beforeEach(() => {
    mockMutate.mockClear();
    mockCookMutate.mockClear();
    mockSuggestionState = {
      data: { result: mockSuggestionResult, shoppingQuestion: null },
      isPending: false,
      isError: false,
      mutate: mockMutate,
    };
  });

  it('shows the chat, source, inventory quantities and missing ingredients', () => {
    act(() => {
      renderer = create(<ChefKochScreen />);
    });

    expect(textContent()).toContain('Chef-Koch');
    expect(textContent()).toContain('Aus Katalog');
    expect(textContent()).toContain('Tomaten-Spinat-Pasta');
    expect(textContent()).toContain('Spinat');
    expect(textContent()).toContain('Noch zu besorgen: ');
    expect(textContent()).toContain('Parmesan');

    press('Rezept speichern');
    expect(mockCookMutate).not.toHaveBeenCalled();
  });

  it('shows loading and retryable error states without a cook mutation', () => {
    mockSuggestionState = {
      data: undefined,
      isPending: true,
      isError: false,
      mutate: mockMutate,
    };

    act(() => {
      renderer = create(<ChefKochScreen />);
    });
    expect(textContent()).toContain('Ich prüfe gerade euren Bestand');

    mockSuggestionState = {
      data: undefined,
      isPending: false,
      isError: true,
      mutate: mockMutate,
    };
    act(() => renderer.update(<ChefKochScreen />));
    expect(textContent()).toContain('Ich konnte gerade keinen Vorschlag laden.');
    press('Erneut versuchen');
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockCookMutate).not.toHaveBeenCalled();
  });

  it('asks about shopping and resubmits the read-only suggestion request', () => {
    mockSuggestionState = {
      data: {
        result: mockSuggestionResult,
        shoppingQuestion: 'Möchtest du heute noch fehlende Lebensmittel einkaufen?',
      },
      isPending: false,
      isError: false,
      mutate: mockMutate,
    };

    act(() => {
      renderer = create(<ChefKochScreen />);
    });
    expect(textContent()).toContain('Möchtest du heute noch fehlende Lebensmittel einkaufen?');
    press('Ja, heute');

    expect(mockMutate).toHaveBeenCalledWith({
      householdId: 'household-1',
      userText: 'Was soll ich heute kochen?',
      servings: 2,
      maxMinutes: null,
      dietaryPattern: null,
      shoppingDecision: 'yes',
    });
    expect(mockCookMutate).not.toHaveBeenCalled();
  });

  it('sends the user request without opening a mutation path', async () => {
    act(() => {
      renderer = create(<ChefKochScreen />);
    });

    press('Nachricht senden');

    expect(mockMutate).toHaveBeenCalledWith({
      householdId: 'household-1',
      userText: 'Was soll ich heute kochen?',
      servings: 2,
      maxMinutes: null,
      dietaryPattern: null,
      shoppingDecision: null,
    });
    expect(mockCookMutate).not.toHaveBeenCalled();
  });

  it('opens the review first and mutates only after cooked confirmation', async () => {
    act(() => {
      renderer = create(<ChefKochScreen />);
    });

    press('Kochen');
    expect(textContent()).toContain('Bestands-Review');
    expect(mockCookMutate).not.toHaveBeenCalled();

    press('Gekocht bestätigen');

    expect(mockCookMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        householdId: 'household-1',
        review: expect.objectContaining({ status: 'confirmed' }),
      }),
      expect.any(Object),
    );
  });

  it('keeps review edits local until confirmation and sends the edited selection', () => {
    act(() => {
      renderer = create(<ChefKochScreen />);
    });

    press('Kochen');
    const spinachCheckbox = renderer.root.find(
      (node) => node.props.accessibilityLabel === 'Spinat verwenden',
    );
    const spinachQuantity = renderer.root.find(
      (node) => node.props.accessibilityLabel === 'Menge Spinat',
    );

    act(() => spinachCheckbox.props.onPress());
    act(() => spinachQuantity.props.onChangeText('250'));

    expect(mockCookMutate).not.toHaveBeenCalled();
    press('Gekocht bestätigen');

    expect(mockCookMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        review: expect.objectContaining({
          status: 'confirmed',
          entries: expect.arrayContaining([
            expect.objectContaining({
              inventoryItemId: 'inventory-spinach',
              included: false,
              quantity: 250,
            }),
          ]),
        }),
      }),
      expect.any(Object),
    );
  });
});
