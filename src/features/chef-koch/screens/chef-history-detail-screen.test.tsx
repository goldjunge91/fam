import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';

import { ChefHistoryDetailScreen } from './chef-history-detail-screen';

let mockHasAI = true;
let mockConversation: Record<string, unknown>;
let mockTurns: Record<string, unknown>;
let mockRecipe: Record<string, unknown>;

const activeConversation = {
  id: 'conversation-1',
  household_id: 'household-1',
  created_by: 'user-1',
  created_at: '2026-11-07T08:00:00.000Z',
  last_activity_at: new Date().toISOString(),
  continued_from_id: 'conversation-parent',
};

const turn = {
  id: 'turn-1',
  conversation_id: 'conversation-1',
  household_id: 'household-1',
  created_by: 'user-1',
  client_request_id: 'request-1',
  request_fingerprint: 'a'.repeat(64),
  user_text: 'Ja, ich gehe einkaufen.',
  request_payload: {
    schema_version: 1,
    user_text: 'Ja, ich gehe einkaufen.',
    servings: 2,
    max_minutes: null,
    dietary_pattern: null,
    shopping_decision: 'yes',
    selected_inventory_item_ids: [],
  },
  response_payload: {
    schema_version: 1,
    skill: 'fam-cook-from-inventory',
    model: 'test-model',
    generated_at: '2026-11-07T08:00:00.000Z',
    priority_food_count: 1,
    shopping_question: 'Willst du heute noch einkaufen?',
    result: null,
  },
  created_at: '2026-11-07T08:00:00.000Z',
  recipe_history_id: 'recipe-history-1',
};

const recipeData = {
  id: 'recipe-history-1',
  conversation_id: 'conversation-1',
  turn_id: 'turn-1',
  household_id: 'household-1',
  title: 'Tomatenpfanne und Suppe',
  recipe_payload: {
    schema_version: 1,
    response: {
      schema_version: 1,
      meals: [
        {
          title: 'Tomatenpfanne',
          source: 'catalog',
          recipe_id: 'recipe-1',
          servings: 2,
          used_items: [{ inventory_item_id: 'item-1', quantity: 1, unit: 'piece' }],
          shopping_needs: [{ name: 'Öl', quantity: 10, unit: 'ml' }],
          additional_ingredients: [],
          steps: ['Tomate garen.'],
          notes: ['Nicht zu heiß.'],
        },
        {
          title: 'Tomatensuppe',
          source: 'model_generated',
          recipe_id: null,
          servings: 2,
          used_items: [{ inventory_item_id: 'item-1', quantity: 1, unit: 'piece' }],
          additional_ingredients: [],
          steps: ['Tomate kochen.'],
          notes: [],
        },
      ],
    },
    used_item_snapshots: [
      { inventory_item_id: 'item-1', name: 'Tomate', quantity: 1, unit: 'piece' },
    ],
  },
  created_at: '2026-11-07T08:00:00.000Z',
};

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@shopify/flash-list', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    FlashList: ({
      data,
      keyExtractor,
      renderItem,
      ListHeaderComponent,
      ListEmptyComponent,
    }: {
      data: Array<{ id: string }>;
      keyExtractor: (item: { id: string }) => string;
      renderItem: (input: { item: { id: string } }) => ReactNode;
      ListHeaderComponent?: ReactNode;
      ListEmptyComponent?: ReactNode;
    }) =>
      React.createElement(
        View,
        null,
        ListHeaderComponent,
        data.length === 0
          ? ListEmptyComponent
          : data.map((item) =>
              React.createElement(
                React.Fragment,
                { key: keyExtractor(item) },
                renderItem({ item }),
              ),
            ),
      ),
  };
});
jest.mock('@/components/layout/back-button', () => ({ BackButton: () => null }));
jest.mock('@/components/layout/hub-screen', () => {
  const React = require('react') as typeof import('react');
  const { Text, View } = require('react-native') as typeof import('react-native');
  return {
    HubScreen: ({ children, header }: { children: ReactNode; header: { title: string } }) =>
      React.createElement(View, null, React.createElement(Text, null, header.title), children),
  };
});
jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: { accent: '#8B5E63' } }),
}));
jest.mock('@/constants/ui', () => {
  const React = require('react') as typeof import('react');
  const { Pressable, Text } = require('react-native') as typeof import('react-native');
  return {
    Button: ({
      title,
      onPress,
      disabled,
    }: {
      title: string;
      onPress: () => void;
      disabled?: boolean;
    }) =>
      React.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          accessibilityLabel: title,
          accessibilityState: { disabled },
          disabled,
          onPress,
        },
        React.createElement(Text, null, title),
      ),
    Press: ({ children, ...props }: { children: ReactNode }) =>
      React.createElement(Pressable, props, children),
    Txt: ({ children, role }: { children: ReactNode; role?: 'alert' }) =>
      React.createElement(Text, { accessibilityRole: role }, children),
  };
});
jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'household-1' }),
}));
jest.mock('@/features/premium/premium-provider', () => ({
  usePremium: () => ({ hasAI: mockHasAI }),
}));
jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));
jest.mock('@/features/chef-koch/data/use-chef-history', () => ({
  useChefConversation: () => mockConversation,
  useChefConversationTurns: () => mockTurns,
  useChefRecipeHistory: () => mockRecipe,
}));

describe('ChefHistoryDetailScreen', () => {
  beforeEach(() => {
    mockHasAI = true;
    mockConversation = { data: activeConversation, isPending: false, isError: false };
    mockTurns = {
      data: [turn],
      isPending: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: jest.fn(),
    };
    mockRecipe = { data: recipeData, isPending: false, isError: false };
    jest.mocked(router.push).mockClear();
  });

  it('shows visible chat messages, shopping decisions, and separate source links', async () => {
    const user = userEvent.setup();
    await render(<ChefHistoryDetailScreen id="conversation-1" kind="conversation" />);

    expect(screen.getByText('Ja, ich gehe einkaufen.')).toBeOnTheScreen();
    expect(screen.getByText('Einkaufen: Ja')).toBeOnTheScreen();
    expect(screen.getByText('Willst du heute noch einkaufen?')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Vorherige Unterhaltung' }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/chef-koch-history/[id]',
      params: { id: 'conversation-parent', kind: 'conversation' },
    });

    await user.press(screen.getByRole('button', { name: 'Rezeptvorschläge ansehen' }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/chef-koch-history/[id]',
      params: { id: 'recipe-history-1', kind: 'recipe' },
    });
  });

  it('starts a new target conversation only while the source is locally active', async () => {
    const user = userEvent.setup();
    await render(<ChefHistoryDetailScreen id="conversation-1" kind="conversation" />);

    await user.press(screen.getByRole('button', { name: 'Fortsetzen' }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/chef-koch',
      params: { continuedFromConversationId: 'conversation-1' },
    });

    mockConversation = {
      ...mockConversation,
      data: { ...activeConversation, last_activity_at: '2020-01-01T00:00:00.000Z' },
    };
    await render(<ChefHistoryDetailScreen id="conversation-1" kind="conversation" />);
    expect(screen.getByRole('button', { name: 'Nicht mehr fortsetzbar' })).toBeDisabled();
  });

  it('keeps a server-rejected conversation readable but read-only despite a fresh local timestamp', async () => {
    mockConversation = {
      ...mockConversation,
      data: { ...activeConversation, continuationRejected: true },
    };

    await render(<ChefHistoryDetailScreen id="conversation-1" kind="conversation" />);

    expect(screen.getByText('Ja, ich gehe einkaufen.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Nicht mehr fortsetzbar' })).toBeDisabled();
  });

  it('keeps the chat readable without AI and sends a new action to the paywall', async () => {
    mockHasAI = false;
    const user = userEvent.setup();
    await render(<ChefHistoryDetailScreen id="conversation-1" kind="conversation" />);

    expect(screen.getByText('Ja, ich gehe einkaufen.')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Fortsetzen' }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/settings/plus-and-ai',
      params: { tier: 'ai' },
    });
  });

  it('opens every meal from one immutable recipe response without live inventory', async () => {
    await render(<ChefHistoryDetailScreen id="recipe-history-1" kind="recipe" />);

    expect(screen.getByText('Tomatenpfanne')).toBeOnTheScreen();
    expect(screen.getByText('Tomatensuppe')).toBeOnTheScreen();
    expect(screen.getAllByText('Tomate')).toHaveLength(2);
    expect(screen.getByText('Öl')).toBeOnTheScreen();
    expect(screen.getByText('Tomate garen.')).toBeOnTheScreen();
    expect(screen.getByText('Nicht zu heiß.')).toBeOnTheScreen();
  });
});
