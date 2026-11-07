import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { RecipeSuggestionGatewayError } from '@/features/recipes/data/recipe-suggestion-gateway';
import { ChefHistoryDetailScreen } from './chef-history-detail-screen';
import { ChefKochScreen } from './chef-koch-screen';

const mockMutate = jest.fn();
const mockRememberContinuationRejection = jest.fn();
let mockQueryClient: QueryClient;
const mockSetQueryData = jest.fn((queryKey: readonly unknown[], updater: unknown) => {
  const previous = mockQueryClient.getQueryData(queryKey);
  const next = typeof updater === 'function' ? updater(previous) : updater;
  mockQueryClient.setQueryData(queryKey, next);
});
const MOCK_CLIENT_REQUEST_ID = '22222222-2222-4222-8222-222222222222';
const mockHistoryConversation = {
  id: 'conversation-placeholder',
  household_id: 'household-1',
  created_by: 'user-1',
  created_at: '2026-11-07T08:00:00.000Z',
  last_activity_at: '2026-11-07T08:00:00.000Z',
  continued_from_id: null,
};
const mockHistoryTurn = {
  id: 'turn-1',
  conversation_id: 'conversation-placeholder',
  household_id: 'household-1',
  created_by: 'user-1',
  client_request_id: 'request-1',
  request_fingerprint: 'a'.repeat(64),
  user_text: 'Historischer Chat',
  request_payload: { shopping_decision: null },
  response_payload: {
    shopping_question: 'Historie bleibt lesbar',
    result: null,
  },
  created_at: '2026-11-07T08:00:00.000Z',
  recipe_history_id: null,
};
let mockHasAI = true;
let mockCreditStatus = {
  householdId: 'household-1',
  creditsUsed: 30,
  creditsRemaining: 70,
  creditLimit: 100,
  warningReached: false,
  blocked: false,
};
const mockCreditRefetch = jest.fn();
let mockHouseholdId: string | null = 'household-1';
let mockAccountId: string | null = 'user-1';
let mockInventory = [
  {
    id: 'lot-tomato',
    name: 'Tomate',
    quantity: 2,
    unit: 'Stk',
    expiry_date: '2026-11-10',
  },
];
let mockSuggestion: {
  data: unknown;
  error: Error | null;
  isError: boolean;
  isPending: boolean;
  mutate: typeof mockMutate;
};

const response = {
  requestId: 'request-1',
  model: 'z-ai/glm-5.3-flash',
  generatedAt: '2026-11-06T08:00:00.000Z',
  priorityFoodCount: 1,
  shoppingQuestion: null,
  conversationId: '33333333-3333-4333-8333-333333333333',
  turnId: '44444444-4444-4444-8444-444444444444',
  clientRequestId: MOCK_CLIENT_REQUEST_ID,
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
        steps: ['Tomate schneiden.', 'Tomate garen.'],
        notes: [],
      },
    ],
  },
};

type TestUser = ReturnType<typeof userEvent.setup>;

async function continueWithRescueIntent(user: TestUser) {
  await user.press(screen.getByRole('radio', { name: /Lebensmittel retten/ }));
  await user.press(screen.getByRole('button', { name: 'Weiter' }));
}

async function requestRecipes(user: TestUser) {
  await continueWithRescueIntent(user);
  await user.press(screen.getByRole('button', { name: 'Rezepte finden' }));
}

function StackedChefKochFlow({ conversationId }: { conversationId: string }) {
  const [showChefKoch, setShowChefKoch] = useState(true);

  return (
    <>
      <ChefHistoryDetailScreen id={conversationId} kind="conversation" />
      {showChefKoch ? (
        <>
          <ChefKochScreen continuedFromConversationId={conversationId} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Zurück aus Chef-Koch"
            onPress={() => setShowChefKoch(false)}>
            <Text>Zurück aus Chef-Koch</Text>
          </Pressable>
        </>
      ) : null}
    </>
  );
}

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual(
    '@tanstack/react-query',
  ) as typeof import('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({ setQueryData: mockSetQueryData }),
  };
});
jest.mock('@/features/chef-koch/data/use-chef-history', () => {
  const { useQuery } = jest.requireActual(
    '@tanstack/react-query',
  ) as typeof import('@tanstack/react-query');
  const chefConversationQueryKey = (
    householdId: string | null | undefined,
    conversationId: string,
    accountId: string | null | undefined,
  ) => ['chef-history', householdId, 'conversation', conversationId, 'account', accountId];
  return {
    chefConversationQueryKey,
    rememberChefConversationContinuationRejection: (...args: unknown[]) =>
      mockRememberContinuationRejection(...args),
    useChefConversation: (
      householdId: string | null,
      conversationId: string,
      accountId: string | null,
    ) =>
      useQuery({
        queryKey: chefConversationQueryKey(householdId, conversationId, accountId),
        queryFn: async () => ({ ...mockHistoryConversation, id: conversationId }),
        initialData: { ...mockHistoryConversation, id: conversationId },
      }),
    useChefConversationTurns: () => ({
      data: [{ ...mockHistoryTurn }],
      isPending: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: jest.fn(),
    }),
    useChefRecipeHistory: () => ({ data: null, isPending: false, isError: false }),
  };
});
jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({
    session: mockAccountId === null ? null : { user: { id: mockAccountId } },
  }),
}));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => MOCK_CLIENT_REQUEST_ID) }));
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
      data: typeof mockInventory;
      keyExtractor: (item: (typeof mockInventory)[number]) => string;
      renderItem: (input: { item: (typeof mockInventory)[number] }) => ReactNode;
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
  const { Pressable, Text, TextInput, View } =
    require('react-native') as typeof import('react-native');
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
    Press: ({
      accessibilityRole,
      accessibilityLabel,
      accessibilityState,
      disabled,
      onPress,
      children,
    }: {
      accessibilityRole: 'checkbox';
      accessibilityLabel: string;
      accessibilityState?: { checked?: boolean; disabled?: boolean };
      disabled?: boolean;
      onPress: () => void;
      children: ReactNode;
    }) =>
      React.createElement(
        Pressable,
        {
          accessibilityRole,
          accessibilityLabel,
          accessibilityState,
          disabled,
          onPress,
        },
        children,
      ),
    Surface: ({ children }: { children: ReactNode }) => React.createElement(View, null, children),
    TextField: ({ trailing, ...props }: { trailing?: ReactNode }) =>
      React.createElement(View, null, React.createElement(TextInput, props), trailing),
    Txt: ({ children, accessibilityRole }: { children: ReactNode; accessibilityRole?: 'alert' }) =>
      React.createElement(Text, { accessibilityRole }, children),
  };
});
jest.mock('@/features/ai-credits/api', () => ({
  useAiCreditStatus: () => ({
    data: mockCreditStatus,
    isPending: false,
    isError: false,
    refetch: mockCreditRefetch,
  }),
}));
jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: mockHouseholdId }),
}));
jest.mock('@/features/inventory/use-inventory-items', () => ({
  useInventoryItems: () => ({ data: mockInventory, isLoading: false }),
}));
jest.mock('@/features/premium/premium-provider', () => ({
  usePremium: () => ({ hasAI: mockHasAI }),
}));
jest.mock('@/features/recipes/data/use-recipe-suggestions', () => ({
  useRecipeSuggestions: () => mockSuggestion,
}));

describe('ChefKochScreen', () => {
  beforeEach(() => {
    mockQueryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
    });
    mockHasAI = true;
    mockHouseholdId = 'household-1';
    mockCreditStatus = {
      householdId: 'household-1',
      creditsUsed: 30,
      creditsRemaining: 70,
      creditLimit: 100,
      warningReached: false,
      blocked: false,
    };
    mockCreditRefetch.mockClear();
    mockAccountId = 'user-1';
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 3);
    mockInventory = [
      {
        id: 'lot-tomato',
        name: 'Tomate',
        quantity: 2,
        unit: 'Stk',
        expiry_date: `${expiry.getFullYear()}-${String(expiry.getMonth() + 1).padStart(2, '0')}-${String(expiry.getDate()).padStart(2, '0')}`,
      },
    ];
    mockSuggestion = {
      data: null,
      error: null,
      isError: false,
      isPending: false,
      mutate: mockMutate,
    };
    mockMutate.mockClear();
    mockRememberContinuationRejection.mockClear();
    mockSetQueryData.mockClear();
    mockRememberContinuationRejection.mockResolvedValue(undefined);
    jest.mocked(Crypto.randomUUID).mockClear();
    jest.mocked(router.push).mockClear();
  });

  afterEach(() => mockQueryClient.clear());

  it('waits for the food selection before requesting suggestions', async () => {
    const user = userEvent.setup();
    await render(<ChefKochScreen />);

    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Hallo!')).toBeOnTheScreen();
    expect(screen.queryByRole('checkbox', { name: /Tomate/ })).toBeNull();
    await continueWithRescueIntent(user);
    expect(screen.getByRole('checkbox', { name: /Tomate/ })).toBeChecked();
    await user.press(screen.getByRole('button', { name: 'Rezepte finden' }));

    expect(mockMutate).toHaveBeenCalledWith({
      householdId: 'household-1',
      userText: 'Was soll ich heute kochen?',
      servings: 2,
      maxMinutes: null,
      dietaryPattern: null,
      shoppingDecision: null,
      selectedInventoryItemIds: ['lot-tomato'],
      clientRequestId: MOCK_CLIENT_REQUEST_ID,
    });
  });

  it('shows suggestions and opens their local cooking instructions', async () => {
    mockSuggestion.data = response;
    const user = userEvent.setup();
    await render(<ChefKochScreen />);
    await requestRecipes(user);

    expect(screen.getByText('Tomatenpfanne')).toBeOnTheScreen();
    expect(screen.getByText('Verwendet 1 von 1 ausgewählten Lebensmitteln')).toBeOnTheScreen();
    expect(screen.getByText('Tomate')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Kochen' }));
    expect(screen.getByText('Zubereitung')).toBeOnTheScreen();
    expect(screen.getByText('Tomate schneiden.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Zurück zu Vorschlägen' })).toBeOnTheScreen();
  });

  it('submits the server-owned shopping decision before showing suggestions', async () => {
    mockSuggestion.data = {
      ...response,
      result: null,
      shoppingQuestion: 'Willst du heute noch einkaufen?',
    };
    const user = userEvent.setup();
    await render(<ChefKochScreen />);
    await requestRecipes(user);
    mockMutate.mockClear();

    await user.press(screen.getByRole('button', { name: 'Ja, heute' }));

    expect(mockMutate).toHaveBeenCalledWith({
      householdId: 'household-1',
      userText: 'Was soll ich heute kochen?',
      servings: 2,
      maxMinutes: null,
      dietaryPattern: null,
      shoppingDecision: 'yes',
      selectedInventoryItemIds: ['lot-tomato'],
      clientRequestId: MOCK_CLIENT_REQUEST_ID,
      conversationId: '33333333-3333-4333-8333-333333333333',
    });
  });

  it('blockiert neue Rezeptanfragen bei einem serverseitig gesperrten Credit-Stand', async () => {
    mockCreditStatus = {
      householdId: 'household-1',
      creditsUsed: 100,
      creditsRemaining: 0,
      creditLimit: 100,
      warningReached: true,
      blocked: true,
    };
    const user = userEvent.setup();
    await render(<ChefKochScreen />);
    await continueWithRescueIntent(user);

    const requestButton = screen.getByRole('button', { name: 'Rezepte finden' });
    expect(requestButton).toBeDisabled();
    await user.press(requestButton);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('ordnet den serverseitigen Credit-Fehler nicht dem Abo-Gate zu', async () => {
    mockSuggestion = {
      ...mockSuggestion,
      error: new RecipeSuggestionGatewayError(
        'gateway_request_failed',
        429,
        'ai_credit_limit_exceeded',
      ),
      isError: true,
    };
    const user = userEvent.setup();
    await render(<ChefKochScreen />);
    await requestRecipes(user);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Keine KI-Credits mehr verfügbar. Neue Credits gibt es ab dem nächsten UTC-Monatsanfang.',
    );
  });

  it('maps gateway failures to a recoverable user-facing state', async () => {
    mockSuggestion = {
      ...mockSuggestion,
      error: new RecipeSuggestionGatewayError('gateway_unavailable', 503, 'provider_unavailable'),
      isError: true,
    };
    const user = userEvent.setup();
    await render(<ChefKochScreen />);
    await requestRecipes(user);
    mockMutate.mockClear();

    expect(screen.getByRole('alert')).toHaveTextContent('Chef-Koch ist gerade nicht erreichbar.');
    await user.press(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });
  it('reuses the client request ID across repeated unknown History persistence results', async () => {
    const user = userEvent.setup();
    await render(<ChefKochScreen />);
    await requestRecipes(user);
    const firstRequest = mockMutate.mock.calls[0]?.[0];

    const unknownPersistenceError = new RecipeSuggestionGatewayError(
      'gateway_unavailable',
      500,
      'chef_history_persist_unknown',
    );
    mockSuggestion = {
      ...mockSuggestion,
      error: unknownPersistenceError,
      isError: true,
    };
    await screen.rerender(<ChefKochScreen />);
    mockMutate.mockClear();

    await user.press(screen.getByRole('button', { name: 'Neu suchen' }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ clientRequestId: firstRequest.clientRequestId }),
    );
    expect(Crypto.randomUUID).toHaveBeenCalledTimes(1);
    mockMutate.mockClear();

    await user.press(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ clientRequestId: firstRequest.clientRequestId }),
    );

    const lookupFailure = new RecipeSuggestionGatewayError(
      'gateway_unavailable',
      500,
      'chef_history_lookup_failed',
    );
    mockSuggestion = {
      ...mockSuggestion,
      error: lookupFailure,
      isError: true,
    };
    await screen.rerender(<ChefKochScreen />);
    mockMutate.mockClear();

    await user.press(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ clientRequestId: firstRequest.clientRequestId }),
    );
    expect(Crypto.randomUUID).toHaveBeenCalledTimes(1);

    const transportFailure = new RecipeSuggestionGatewayError('gateway_request_failed');
    mockSuggestion = {
      ...mockSuggestion,
      error: transportFailure,
      isError: true,
    };
    await screen.rerender(<ChefKochScreen />);
    mockMutate.mockClear();

    await user.press(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ clientRequestId: firstRequest.clientRequestId }),
    );
    expect(Crypto.randomUUID).toHaveBeenCalledTimes(1);

    mockSuggestion = {
      ...mockSuggestion,
      error: null,
      isError: false,
      isPending: true,
    };
    await screen.rerender(<ChefKochScreen />);
    mockSuggestion = {
      ...mockSuggestion,
      error: unknownPersistenceError,
      isError: true,
      isPending: false,
    };
    await screen.rerender(<ChefKochScreen />);
    mockMutate.mockClear();

    await user.press(screen.getByRole('button', { name: 'Erneut versuchen' }));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ clientRequestId: firstRequest.clientRequestId }),
    );
    expect(Crypto.randomUUID).toHaveBeenCalledTimes(1);
  });

  it.each([
    'chef_conversation_continuation_expired',
    'chef_conversation_source_immutable',
  ] as const)(
    'keeps an unresolved continuation read-only after %s without a retry',
    async (remoteCode) => {
      const sourceId = '55555555-5555-4555-8555-555555555555';
      const user = userEvent.setup();
      await render(<ChefKochScreen continuedFromConversationId={sourceId} />);
      await requestRecipes(user);

      mockSuggestion = {
        ...mockSuggestion,
        error: new RecipeSuggestionGatewayError('gateway_request_failed', 409, remoteCode),
        isError: true,
      };
      await screen.rerender(<ChefKochScreen continuedFromConversationId={sourceId} />);

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Diese Unterhaltung kann nicht mehr fortgesetzt werden.',
      );
      expect(screen.queryByRole('button', { name: 'Erneut versuchen' })).not.toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Neu suchen' })).not.toBeOnTheScreen();
      await waitFor(() =>
        expect(mockRememberContinuationRejection).toHaveBeenCalledWith(
          'user-1',
          'household-1',
          sourceId,
        ),
      );
      await waitFor(() =>
        expect(mockSetQueryData).toHaveBeenCalledWith(
          ['chef-history', 'household-1', 'conversation', sourceId, 'account', 'user-1'],
          expect.any(Function),
        ),
      );
      const updateConversation = mockSetQueryData.mock.calls.at(-1)?.[1] as (
        conversation: { id: string } | undefined,
      ) => { id: string; continuationRejected?: true } | undefined;
      expect(updateConversation({ id: sourceId })).toEqual({
        id: sourceId,
        continuationRejected: true,
      });
    },
  );

  it('returns to a stacked detail without remount after a source rejection', async () => {
    const sourceId = '55555555-5555-4555-8555-555555555555';
    const user = userEvent.setup();
    const view = await render(
      <QueryClientProvider client={mockQueryClient}>
        <StackedChefKochFlow conversationId={sourceId} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Historie bleibt lesbar')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Fortsetzen' })).toBeEnabled();
    await user.press(screen.getByRole('button', { name: 'Fortsetzen' }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/chef-koch',
      params: { continuedFromConversationId: sourceId },
    });

    await requestRecipes(user);
    mockSuggestion = {
      ...mockSuggestion,
      error: new RecipeSuggestionGatewayError(
        'gateway_request_failed',
        409,
        'chef_conversation_source_immutable',
      ),
      isError: true,
    };
    await view.rerender(
      <QueryClientProvider client={mockQueryClient}>
        <StackedChefKochFlow conversationId={sourceId} />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(mockRememberContinuationRejection).toHaveBeenCalledWith(
        'user-1',
        'household-1',
        sourceId,
      ),
    );
    expect(await screen.findByRole('button', { name: 'Nicht mehr fortsetzbar' })).toBeDisabled();
    expect(screen.getByText('Historie bleibt lesbar')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Zurück aus Chef-Koch' }));
    expect(screen.getByText('Historie bleibt lesbar')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Nicht mehr fortsetzbar' })).toBeDisabled();
  });

  it('sends a source only for the first turn of a continued conversation', async () => {
    const sourceId = '55555555-5555-4555-8555-555555555555';
    const user = userEvent.setup();
    await render(<ChefKochScreen continuedFromConversationId={sourceId} />);
    await requestRecipes(user);

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        clientRequestId: MOCK_CLIENT_REQUEST_ID,
        continuedFromConversationId: sourceId,
      }),
    );
    expect(mockMutate.mock.calls[0]?.[0]).not.toHaveProperty('conversationId');
  });

  it('uses the server target for later turns without mutating the source chat', async () => {
    const sourceId = '55555555-5555-4555-8555-555555555555';
    mockSuggestion.data = {
      ...response,
      result: null,
      shoppingQuestion: 'Willst du heute noch einkaufen?',
    };
    const user = userEvent.setup();
    await render(<ChefKochScreen continuedFromConversationId={sourceId} />);
    await requestRecipes(user);
    mockMutate.mockClear();

    await user.press(screen.getByRole('button', { name: 'Ja, heute' }));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: response.conversationId,
        clientRequestId: MOCK_CLIENT_REQUEST_ID,
      }),
    );
    expect(mockMutate.mock.calls[0]?.[0]).not.toHaveProperty('continuedFromConversationId');
  });

  it('marks the server-owned target when an append is rejected', async () => {
    const sourceId = '55555555-5555-4555-8555-555555555555';
    const user = userEvent.setup();
    await render(<ChefKochScreen continuedFromConversationId={sourceId} />);
    await requestRecipes(user);

    mockSuggestion = {
      ...mockSuggestion,
      data: {
        ...response,
        result: null,
        shoppingQuestion: 'Willst du heute noch einkaufen?',
      },
    };
    await screen.rerender(<ChefKochScreen continuedFromConversationId={sourceId} />);
    mockMutate.mockClear();

    await user.press(screen.getByRole('button', { name: 'Ja, heute' }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: response.conversationId }),
    );

    mockSuggestion = {
      ...mockSuggestion,
      error: new RecipeSuggestionGatewayError(
        'gateway_request_failed',
        409,
        'chef_conversation_source_immutable',
      ),
      isError: true,
    };
    await screen.rerender(<ChefKochScreen continuedFromConversationId={sourceId} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Diese Unterhaltung kann nicht mehr fortgesetzt werden.',
    );
    expect(screen.queryByRole('button', { name: 'Erneut versuchen' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Neu suchen' })).not.toBeOnTheScreen();
    expect(mockRememberContinuationRejection).toHaveBeenCalledWith(
      'user-1',
      'household-1',
      response.conversationId,
    );
  });

  it('keeps History readable without AI access while new actions open the paywall', async () => {
    mockHasAI = false;
    const user = userEvent.setup();
    await render(<ChefKochScreen />);

    expect(mockMutate).not.toHaveBeenCalled();
    await user.press(screen.getByRole('button', { name: 'History ansehen' }));
    expect(router.push).toHaveBeenCalledWith('/chef-koch-history');

    await user.press(screen.getByRole('button', { name: 'Fam KI ansehen' }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/settings/plus-and-ai',
      params: { tier: 'ai' },
    });
  });
});
