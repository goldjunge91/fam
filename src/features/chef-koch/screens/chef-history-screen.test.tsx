import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';

import { ChefHistoryScreen } from './chef-history-screen';

const mockConversationFetchNext = jest.fn();
const mockRecipeFetchNext = jest.fn();
let mockHouseholdId: string | null = 'household-1';
let mockConversations: Record<string, unknown>;
let mockRecipes: Record<string, unknown>;

const conversation = {
  id: 'conversation-1',
  household_id: 'household-1',
  created_by: 'user-1',
  created_at: '2026-11-07T08:00:00.000Z',
  last_activity_at: new Date().toISOString(),
  continued_from_id: null,
  first_user_text: 'Was soll ich heute kochen?',
};

const recipe = {
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
          used_items: [],
          additional_ingredients: [],
          steps: ['Garen.'],
          notes: [],
        },
        {
          title: 'Suppe',
          source: 'model_generated',
          recipe_id: null,
          servings: 2,
          used_items: [],
          additional_ingredients: [],
          steps: ['Kochen.'],
          notes: [],
        },
      ],
    },
    used_item_snapshots: [],
  },
  created_at: '2026-11-07T08:00:00.000Z',
};

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@shopify/flash-list', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    FlashList: ({
      data,
      keyExtractor,
      renderItem,
      ListEmptyComponent,
      onEndReached,
    }: {
      data: Array<{ id: string }>;
      keyExtractor: (item: { id: string }) => string;
      renderItem: (input: { item: { id: string } }) => ReactNode;
      ListEmptyComponent?: ReactNode;
      onEndReached?: () => void;
    }) =>
      React.createElement(
        View,
        null,
        data.length === 0
          ? ListEmptyComponent
          : data.map((item) =>
              React.createElement(
                React.Fragment,
                { key: keyExtractor(item) },
                renderItem({ item }),
              ),
            ),
        React.createElement(
          Pressable,
          {
            accessibilityRole: 'button',
            accessibilityLabel: 'Weitere laden',
            onPress: onEndReached,
          },
          React.createElement(Text, null, 'Weitere laden'),
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
    Button: ({ title, onPress }: { title: string; onPress: () => void }) =>
      React.createElement(
        Pressable,
        { accessibilityRole: 'button', accessibilityLabel: title, onPress },
        React.createElement(Text, null, title),
      ),
    Press: ({ children, ...props }: { children: ReactNode }) =>
      React.createElement(Pressable, props, children),
    Txt: ({ children, role }: { children: ReactNode; role?: 'alert' }) =>
      React.createElement(Text, { accessibilityRole: role }, children),
  };
});
jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: mockHouseholdId }),
}));
jest.mock('@/features/chef-koch/data/use-chef-history', () => ({
  useChefConversations: () => mockConversations,
  useChefRecipeHistoryList: () => mockRecipes,
}));

describe('ChefHistoryScreen', () => {
  beforeEach(() => {
    mockHouseholdId = 'household-1';
    mockConversations = {
      data: [conversation],
      isPending: false,
      isError: false,
      hasNextPage: true,
      isFetchingNextPage: false,
      fetchNextPage: mockConversationFetchNext,
      refetch: jest.fn(),
    };
    mockRecipes = {
      data: [recipe],
      isPending: false,
      isError: false,
      hasNextPage: true,
      isFetchingNextPage: false,
      fetchNextPage: mockRecipeFetchNext,
      refetch: jest.fn(),
    };
    mockConversationFetchNext.mockReset();
    mockRecipeFetchNext.mockReset();
    jest.mocked(router.push).mockClear();
  });

  it('opens household conversations from the local History list', async () => {
    const user = userEvent.setup();
    await render(<ChefHistoryScreen />);

    expect(screen.getByRole('tab', { name: 'Unterhaltungen' })).toBeSelected();
    await user.press(
      screen.getByRole('button', { name: /Was soll ich heute kochen\?.*Fortsetzen möglich/ }),
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/chef-koch-history/[id]',
      params: { id: 'conversation-1', kind: 'conversation' },
    });
  });

  it('keeps recipe responses on their own cursor and opens all saved meals together', async () => {
    const user = userEvent.setup();
    await render(<ChefHistoryScreen />);

    await user.press(screen.getByRole('tab', { name: 'Rezeptvorschläge' }));
    expect(
      screen.getByRole('button', { name: /Tomatenpfanne und Suppe.*2 Rezeptvorschläge/ }),
    ).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Weitere laden' }));
    expect(mockRecipeFetchNext).toHaveBeenCalledTimes(1);
    expect(mockConversationFetchNext).not.toHaveBeenCalled();

    await user.press(
      screen.getByRole('button', { name: /Tomatenpfanne und Suppe.*2 Rezeptvorschläge/ }),
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/chef-koch-history/[id]',
      params: { id: 'recipe-history-1', kind: 'recipe' },
    });
  });

  it('keeps an older conversation readable without offering continuation', async () => {
    mockConversations = {
      ...mockConversations,
      data: [{ ...conversation, last_activity_at: '2020-01-01T00:00:00.000Z' }],
      hasNextPage: false,
    };
    const user = userEvent.setup();
    await render(<ChefHistoryScreen />);

    const oldConversation = screen.getByRole('button', { name: /Nur ansehen/ });
    expect(oldConversation).toBeOnTheScreen();
    await user.press(oldConversation);

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/chef-koch-history/[id]',
      params: { id: 'conversation-1', kind: 'conversation' },
    });
  });

  it('shows a household requirement without starting a remote request', async () => {
    mockHouseholdId = null;
    await render(<ChefHistoryScreen />);

    expect(screen.getByText('Wähle zuerst einen Haushalt aus.')).toBeOnTheScreen();
  });
});
