import { render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { RecipeSuggestionGatewayError } from '@/features/recipes/data/recipe-suggestion-gateway';
import { ChefKochScreen } from './chef-koch-screen';

const mockMutate = jest.fn();
let mockHasAI = true;
let mockHouseholdId: string | null = 'household-1';
let mockSuggestion = {
  data: null as unknown,
  error: null as Error | null,
  isError: false,
  isPending: false,
  mutate: mockMutate,
};

const inventory = [
  {
    id: 'lot-tomato',
    household_id: 'household-1',
    location_id: null,
    product_id: null,
    name: 'Tomate',
    quantity: 2,
    unit: 'Stück',
    package_size: null,
    package_size_unit: null,
    expiry_date: '2099-01-01',
    added_by: null,
    created_at: '2026-01-01T00:00:00.000Z',
    location_kind: 'fridge',
    location_name: 'Kühlschrank',
  },
];

const response = {
  requestId: 'request-1',
  provider: 'catalog',
  model: 'catalog',
  generatedAt: '2026-11-06T08:00:00.000Z',
  result: {
    schema_version: 1 as const,
    meals: [
      {
        title: 'Tomatenpfanne',
        source: 'catalog' as const,
        recipe_id: 'recipe-1',
        servings: 2,
        used_items: [{ inventory_item_id: 'lot-tomato', quantity: 1, unit: 'piece' }],
        additional_ingredients: [],
        steps: ['Tomate garen.'],
        notes: [],
      },
    ],
  },
};

jest.mock('@shopify/flash-list', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const native = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    FlashList: ({
      data,
      renderItem,
      ListHeaderComponent,
      ListEmptyComponent,
      ListFooterComponent,
    }: {
      data: typeof inventory;
      renderItem: (input: { item: (typeof inventory)[number] }) => ReactNode;
      ListHeaderComponent?: ReactNode;
      ListEmptyComponent?: ReactNode;
      ListFooterComponent?: ReactNode;
    }) =>
      React.createElement(
        native.View,
        null,
        ListHeaderComponent,
        data.length === 0
          ? ListEmptyComponent
          : data.map((item) =>
              React.createElement(React.Fragment, { key: item.id }, renderItem({ item })),
            ),
        ListFooterComponent,
      ),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; items?: string }) => {
      const values: Record<string, string> = {
        'dashboard.chefKoch.title': 'Aus Vorrat kochen',
        'dashboard.chefKoch.entry': 'Aus Vorrat kochen',
        'dashboard.chefKoch.intro': 'Finde passende Mahlzeiten aus eurem Bestand.',
        'dashboard.chefKoch.select': 'Lebensmittel auswählen',
        'dashboard.chefKoch.submit': 'Vorschläge anzeigen',
        'dashboard.chefKoch.loading': 'Passende Mahlzeiten werden gesucht.',
        'dashboard.chefKoch.empty': 'Keine passenden Lebensmittel im Vorrat.',
        'dashboard.chefKoch.noHousehold': 'Wähle zuerst einen Haushalt aus.',
        'dashboard.chefKoch.noAi': 'Für Chef-Koch ist ein aktives Fam KI-Abo erforderlich.',
        'dashboard.chefKoch.error': 'Vorschläge konnten nicht geladen werden.',
        'dashboard.chefKoch.retry': 'Erneut versuchen',
        'dashboard.chefKoch.resultTitle': 'Vorschläge aus eurem Vorrat',
        'dashboard.chefKoch.steps': 'Zubereitung',
        'common.units.piece': 'Stück',
      };
      if (key === 'dashboard.chefKoch.selected') return `${String(options?.count ?? 0)} ausgewählt`;
      if (key === 'dashboard.chefKoch.used') return `Verwendet: ${options?.items ?? ''}`;
      return values[key] ?? key;
    },
  }),
}));

jest.mock('@/components/layout/back-button', () => ({ BackButton: () => null }));
jest.mock('@/components/layout/hub-screen', () => {
  const React = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');
  return {
    HubScreen: ({ children }: { children: ReactNode }) => React.createElement(View, null, children),
  };
});
jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: { accent: '#8B5E63' } }),
}));
jest.mock('@/constants/ui', () => {
  const React = require('react') as typeof import('react');
  const { Pressable, Text, View } = require('react-native') as typeof import('react-native');
  return {
    Button: ({
      title,
      onPress,
      disabled,
      loading,
    }: {
      title: string;
      onPress?: () => void;
      disabled?: boolean;
      loading?: boolean;
    }) =>
      React.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          accessibilityLabel: title,
          accessibilityState: { disabled: disabled || loading },
          disabled: disabled || loading,
          onPress,
        },
        React.createElement(Text, null, title),
      ),
    Press: ({
      children,
      accessibilityRole,
      accessibilityLabel,
      accessibilityState,
      onPress,
    }: {
      children: ReactNode;
      accessibilityRole?: 'checkbox';
      accessibilityLabel?: string;
      accessibilityState?: { checked?: boolean };
      onPress?: () => void;
    }) =>
      React.createElement(
        Pressable,
        { accessibilityRole, accessibilityLabel, accessibilityState, onPress },
        children,
      ),
    Surface: ({ children }: { children: ReactNode }) => React.createElement(View, null, children),
    Txt: ({ children, accessibilityRole }: { children: ReactNode; accessibilityRole?: 'alert' }) =>
      React.createElement(Text, { accessibilityRole }, children),
  };
});
jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: mockHouseholdId }),
}));
jest.mock('@/features/inventory/use-inventory-items', () => ({
  useInventoryItems: () => ({ data: inventory, isLoading: false }),
}));
jest.mock('@/features/premium/premium-provider', () => ({
  usePremium: () => ({ hasAI: mockHasAI }),
}));
jest.mock('@/features/recipes/data/use-recipe-suggestions', () => ({
  useRecipeSuggestions: () => mockSuggestion,
}));

describe('ChefKochScreen', () => {
  beforeEach(() => {
    mockHasAI = true;
    mockHouseholdId = 'household-1';
    mockSuggestion = {
      data: null,
      error: null,
      isError: false,
      isPending: false,
      mutate: mockMutate,
    };
    mockMutate.mockClear();
  });

  it('localizes inventory units in visible and accessible labels', async () => {
    await render(<ChefKochScreen />);

    expect(screen.getByText('2 Stück')).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'Tomate, 2 Stück' })).toBeOnTheScreen();
  });

  it('requests read-only suggestions for selected inventory', async () => {
    const user = userEvent.setup();
    await render(<ChefKochScreen />);

    await user.press(screen.getByRole('checkbox', { name: /Tomate/ }));
    await user.press(screen.getByRole('button', { name: 'Vorschläge anzeigen' }));

    expect(mockMutate).toHaveBeenCalledWith({
      householdId: 'household-1',
      userText: 'Was soll ich heute kochen?',
      servings: 2,
      maxMinutes: null,
      dietaryPattern: null,
      allergies: [],
      shoppingDecision: 'no',
      selectedInventoryItemIds: ['lot-tomato'],
    });
  });

  it('renders validated results without mutation or save actions', async () => {
    mockSuggestion.data = response;
    await render(<ChefKochScreen />);

    expect(screen.getByText('Tomatenpfanne')).toBeOnTheScreen();
    expect(screen.getByText(/Tomate garen/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /speichern|save/i })).not.toBeOnTheScreen();
  });

  it('shows the specific message for safe-recipe failures', async () => {
    mockSuggestion.isError = true;
    mockSuggestion.error = new RecipeSuggestionGatewayError(
      'gateway_request_failed',
      400,
      'no_safe_recipe',
    );

    await render(<ChefKochScreen />);

    expect(screen.getByRole('alert')).toHaveTextContent('Keine passenden Lebensmittel im Vorrat.');
  });

  it('keeps the screen behind the current AI entitlement gate', async () => {
    mockHasAI = false;
    await render(<ChefKochScreen />);

    expect(screen.getByRole('alert')).toHaveTextContent(/aktives Fam KI-Abo/);
    expect(screen.queryByRole('button', { name: 'Vorschläge anzeigen' })).not.toBeOnTheScreen();
  });
});
