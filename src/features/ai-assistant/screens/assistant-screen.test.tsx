import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert, type PressableProps, type TextInputProps } from 'react-native';
import type { LocalInventoryItem } from '@/features/inventory/use-inventory-items';
import type { AssistantThread } from '../types';
import { AssistantScreen } from './assistant-screen';

const mockRouterPush = jest.fn();
const mockRouterBack = jest.fn();
const mockLoadThreads = jest.fn();
const mockSaveThreads = jest.fn();
const mockGetCreditStatus = jest.fn();
const mockSendMessage = jest.fn();
const mockApplyProposal = jest.fn();
const mockApplyShoppingList = jest.fn();
const mockAddShoppingItem = jest.fn();
const mockRestorePurchases = jest.fn();
const mockRefreshPremium = jest.fn();
const mockSyncEntitlement = jest.fn();
const mockPollEntitlement = jest.fn();
const mockInvalidate = jest.fn();
const mockRequestImagePermission = jest.fn();
const mockLaunchImageLibrary = jest.fn();
const mockGetDocument = jest.fn();
const mockEncodeAttachments = jest.fn();
let mockUserId: string | null = 'user-1';
let mockHouseholdId: string | null = 'household-1';
let mockHasAI = true;
let mockThreads: AssistantThread[] = [];
let mockInventoryItems: LocalInventoryItem[] = [];
let mockRouteParams: Record<string, string | string[]> = {};

type MockTheme = {
  space: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
  radius: { sm: number; md: number; lg: number; pill: number };
  backgroundElement: string;
  backgroundSoft: string;
  accent: string;
  text: string;
};
type MockButtonProps = Pick<PressableProps, 'onPress' | 'disabled' | 'accessibilityLabel'> & {
  title: string;
  children?: ReactNode;
};
type MockHeaderProps = { header: { title: string; trailing?: ReactNode }; children: ReactNode };

jest.mock('@shopify/flash-list', () => {
  const React = require('react');
  const { View: NativeView } = require('react-native');
  return {
    FlashList: ({
      data,
      renderItem,
      ListEmptyComponent,
    }: {
      data: unknown[];
      renderItem: (args: { item: unknown }) => ReactNode;
      ListEmptyComponent?: ReactNode | (() => ReactNode);
    }) =>
      React.createElement(
        NativeView,
        null,
        data.length
          ? data.map((item, index) =>
              React.createElement(React.Fragment, { key: index }, renderItem({ item })),
            )
          : typeof ListEmptyComponent === 'function'
            ? React.createElement(ListEmptyComponent)
            : ListEmptyComponent,
      ),
  };
});

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: (...args: unknown[]) => mockInvalidate(...args) }),
  useQuery: () => ({ data: null }),
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
    back: () => mockRouterBack(),
  },
  useLocalSearchParams: () => mockRouteParams,
}));
jest.mock('@/features/recipes/components/recipe-preview-card', () => {
  const React = require('react');
  const { Pressable: NativePressable, Text: NativeText } = require('react-native');
  return {
    RecipePreviewCard: ({ title, onPress }: { title: string; onPress: () => void }) =>
      React.createElement(
        NativePressable,
        { accessibilityRole: 'button', accessibilityLabel: title, onPress },
        React.createElement(NativeText, null, title),
      ),
  };
});
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) => mockRequestImagePermission(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibrary(...args),
}));
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockGetDocument(...args),
}));
jest.mock('react-native-unistyles', () => ({
  StyleSheet: {
    create: (factory: (theme: MockTheme) => unknown) =>
      factory({
        space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 },
        radius: { sm: 8, md: 12, lg: 16, pill: 999 },
        backgroundElement: '#fff',
        backgroundSoft: '#eee',
        accent: '#a56',
        text: '#222',
      }),
  },
}));
jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      accent: '#a56',
      background: '#fff',
      backgroundSoft: '#eee',
      danger: '#c33',
      onAccent: '#fff',
    },
  }),
}));
jest.mock('@/components/layout/hub-screen', () => ({
  HubScreen: ({ header, children }: MockHeaderProps) => {
    const React = require('react');
    const { Text: NativeText, View: NativeView } = require('react-native');
    return React.createElement(
      NativeView,
      null,
      React.createElement(NativeText, null, header.title),
      header.trailing,
      children,
    );
  },
}));
jest.mock('@/components/layout/back-button', () => ({
  BackButton: ({ label, onPress }: { label: string; onPress?: () => void }) => {
    const React = require('react');
    const { Pressable: NativePressable, Text: NativeText } = require('react-native');
    return React.createElement(
      NativePressable,
      { accessibilityRole: 'button', onPress: onPress ?? jest.fn() },
      React.createElement(NativeText, null, label),
    );
  },
}));
jest.mock('@/constants/ui', () => {
  const React = require('react');
  const {
    Pressable: NativePressable,
    Text: NativeText,
    TextInput: NativeInput,
    View: NativeView,
  } = require('react-native');
  const Button = ({ title, accessibilityLabel, onPress, disabled, children }: MockButtonProps) =>
    React.createElement(
      NativePressable,
      {
        accessibilityRole: 'button',
        accessibilityLabel: accessibilityLabel ?? title,
        disabled,
        onPress,
      },
      children ?? React.createElement(NativeText, null, title),
    );
  return {
    Button,
    Card: ({ children }: { children: ReactNode }) =>
      React.createElement(NativeView, null, children),
    IconButton: ({
      accessibilityLabel,
      onPress,
      disabled,
    }: {
      accessibilityLabel: string;
      onPress: () => void;
      disabled?: boolean;
    }) =>
      React.createElement(
        NativePressable,
        { accessibilityRole: 'button', accessibilityLabel, onPress, disabled },
        React.createElement(NativeText, null, accessibilityLabel),
      ),
    Badge: ({
      label,
      tone,
      icon,
      solid,
    }: {
      label: string;
      tone?: string;
      icon?: string;
      solid?: boolean;
    }) =>
      React.createElement(
        NativeText,
        {
          accessibilityLabel: `${label} (${tone ?? 'pantry'}, ${icon ?? 'none'}, ${solid ? 'solid' : 'soft'})`,
        },
        label,
      ),
    Pill: ({ label }: { label: string }) => React.createElement(NativeText, null, label),
    Press: ({
      children,
      onPress,
      onLongPress,
      accessibilityLabel,
      accessibilityRole,
      disabled,
    }: Pick<
      PressableProps,
      | 'children'
      | 'onPress'
      | 'onLongPress'
      | 'accessibilityLabel'
      | 'accessibilityRole'
      | 'disabled'
    >) =>
      React.createElement(
        NativePressable,
        {
          accessibilityRole: accessibilityRole ?? 'button',
          accessibilityLabel,
          onPress,
          onLongPress,
          disabled,
        },
        children,
      ),
    Surface: ({ children }: { children: ReactNode }) =>
      React.createElement(NativeView, null, children),
    TextField: (props: TextInputProps) => React.createElement(NativeInput, props),
    Txt: ({ children }: { children: ReactNode }) => React.createElement(NativeText, null, children),
  };
});
jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: mockUserId ? { user: { id: mockUserId } } : null }),
}));
jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: mockHouseholdId }),
}));
jest.mock('@/features/inventory/use-inventory-items', () => ({
  useInventoryItems: () => ({ data: mockInventoryItems }),
}));
jest.mock('@/features/premium/premium-provider', () => ({
  usePremium: () => ({ hasAI: mockHasAI, refresh: mockRefreshPremium }),
}));
jest.mock('@/features/premium/household-entitlement-sync', () => ({
  pollHouseholdUntilEntitlementActive: (...args: unknown[]) => mockPollEntitlement(...args),
}));
jest.mock('@/features/premium/revenuecat-entitlement-sync', () => ({
  syncRevenueCatAiEntitlement: (...args: unknown[]) => mockSyncEntitlement(...args),
}));
jest.mock('@/features/recipes/data/household-recipe-images', () => ({
  useRecipeCoverUrl: () => ({ data: null }),
}));
jest.mock('@/lib/backend/revenuecat', () => ({
  hasAIEntitlement: jest.fn((customerInfo: { active?: boolean }) => customerInfo.active === true),
  restorePurchases: (...args: unknown[]) => mockRestorePurchases(...args),
}));
jest.mock('@/lib/db/local-client', () => ({ getDatabase: jest.fn() }));
jest.mock('@/features/shopping-list/hooks/use-shopping-list-mutations', () => ({
  useAddShoppingItem: () => ({ mutateAsync: (...args: unknown[]) => mockAddShoppingItem(...args) }),
}));
jest.mock('../data/apply-meal-plan-proposal', () => ({
  ApplyMealPlanProposalError: class extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
  applyAssistantMealPlanProposal: (...args: unknown[]) => mockApplyProposal(...args),
}));
jest.mock('../data/apply-shopping-list-proposal', () => ({
  applyAssistantShoppingListProposal: (...args: unknown[]) => mockApplyShoppingList(...args),
}));
jest.mock('../data/assistant-api', () => ({
  getAiCreditStatus: (...args: unknown[]) => mockGetCreditStatus(...args),
  sendAssistantMessage: (...args: unknown[]) => mockSendMessage(...args),
}));
jest.mock('../data/assistant-attachments', () => ({
  encodeAssistantAttachments: (...args: unknown[]) => mockEncodeAttachments(...args),
}));
jest.mock('../data/assistant-storage', () => ({
  loadAssistantThreads: (...args: unknown[]) => mockLoadThreads(...args),
  saveAssistantThreads: (...args: unknown[]) => mockSaveThreads(...args),
}));

const mealPlanProposal = {
  kind: 'meal_plan_proposal.v1' as const,
  foodRulesUpdatedAt: 'rules-v1',
  foodRuleCoverage: {
    status: 'clear' as const,
    rulesUpdatedAt: 'rules-v1',
    recipeVersions: [
      { recipeId: 'recipe-1', recipeUpdatedAt: 'recipe-v1', coverageVersion: 'map-v1' },
    ],
  },
  meals: [
    {
      date: '2026-11-09',
      mealSlot: 'dinner' as const,
      recipeId: 'recipe-1',
      recipeTitle: 'Linsensuppe',
      recipeUpdatedAt: 'recipe-v1',
      portions: 4,
      rationale: 'Passt zum Vorrat.',
    },
  ],
  safetyNote: 'Allergien und Regeln wurden abgeglichen.',
};

const ingredientSwap = {
  kind: 'ingredient_swap_proposal.v1' as const,
  foodRulesUpdatedAt: null,
  foodRuleCoverage: {
    status: 'clear' as const,
    rulesUpdatedAt: null,
    recipeVersions: [
      { recipeId: 'recipe-1', recipeUpdatedAt: 'recipe-v1', coverageVersion: 'map-v1' },
    ],
  },
  recipeId: 'recipe-1',
  recipeTitle: 'Linsensuppe',
  ingredientName: 'Sahne',
  replacement: 'Hafercuisine',
  rationale: 'Laktosefrei.',
  safetyNote: 'Etikett prüfen.',
};

const shoppingItemProposal = {
  kind: 'shopping_list_item_proposal.v1' as const,
  name: 'Hafermilch',
  quantity: 2,
  unit: 'package' as const,
  foodRuleStatus: 'unknown' as const,
};

function assistantThread(messages: AssistantThread['messages'] = []): AssistantThread {
  return {
    id: 'thread-1',
    title: 'Abendessen',
    model: 'model',
    messages,
    createdAt: '2026-11-08T00:00:00Z',
    updatedAt: '2026-11-08T00:00:00Z',
  };
}

function expiringInventoryItem(id: string, name: string, expiryDate: string): LocalInventoryItem {
  return {
    id,
    household_id: 'household-1',
    location_id: null,
    product_id: null,
    name,
    quantity: 1,
    unit: 'piece',
    package_size: null,
    package_size_unit: null,
    expiry_date: expiryDate,
    opened_at: null,
    added_by: 'user-1',
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    location_kind: null,
    location_name: null,
  };
}

async function renderAssistant() {
  const result = await render(<AssistantScreen />);
  await waitFor(() => {
    expect(
      Boolean(
        screen.queryByText('AI-Abo erforderlich') ||
          screen.queryByText('Wähle zuerst einen aktiven Haushalt.') ||
          screen.queryByLabelText('Nachricht an den Assistant'),
      ),
    ).toBe(true);
  });
  return result;
}

describe('AssistantScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserId = 'user-1';
    mockHouseholdId = 'household-1';
    mockHasAI = true;
    mockThreads = [];
    mockInventoryItems = [];
    mockRouteParams = {};
    mockLoadThreads.mockImplementation(async () => mockThreads);
    mockSaveThreads.mockResolvedValue(undefined);
    mockGetCreditStatus.mockResolvedValue({
      creditsUsed: 2,
      creditsRemaining: 8,
      creditLimit: 10,
      warningReached: false,
      blocked: false,
    });
    mockSendMessage.mockResolvedValue({
      result: {
        text: 'Hier sind Ideen.',
        suggestions: ['Mit Reis'],
        proposals: [ingredientSwap],
        toolTrace: ['search_recipes', 'get_inventory'],
      },
    });
    mockApplyProposal.mockResolvedValue({ addedCount: 1 });
    mockApplyShoppingList.mockResolvedValue({ addedCount: 2, alreadyApplied: false });
    mockAddShoppingItem.mockResolvedValue('shopping-item-1');
    mockRestorePurchases.mockResolvedValue({ ok: true, customerInfo: { active: true } });
    mockSyncEntitlement.mockResolvedValue(true);
    mockPollEntitlement.mockResolvedValue(true);
    mockRequestImagePermission.mockResolvedValue({ granted: true });
    mockLaunchImageLibrary.mockResolvedValue({ canceled: true, assets: [] });
    mockGetDocument.mockResolvedValue({ canceled: true, assets: [] });
    mockEncodeAttachments.mockImplementation(
      async (files: Array<{ name: string; mimeType: string }>) =>
        files.map(({ name, mimeType }) => ({ filename: name, mimeType, data: 'encoded' })),
    );
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('asks the user to sign in when the session is missing', async () => {
    mockUserId = null;
    const signedOut = await render(<AssistantScreen />);
    expect(
      screen.getByText('Bitte melde dich an, um den Assistant zu verwenden.'),
    ).toBeOnTheScreen();
    signedOut.unmount();
  });

  it('asks for an active household before opening the assistant', async () => {
    mockHouseholdId = null;
    await renderAssistant();
    expect(screen.getByText('Wähle zuerst einen aktiven Haushalt.')).toBeOnTheScreen();
  });

  it('shows the household AI paywall and handles failed restoration', async () => {
    mockHasAI = false;
    mockRestorePurchases.mockResolvedValue({ ok: false, error: new Error('Store offline') });
    const view = await renderAssistant();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'AI ansehen' }));
    expect(mockRouterPush).toHaveBeenCalledWith('/settings/plus-and-ai?tier=ai');
    await user.press(screen.getByRole('button', { name: 'Käufe wiederherstellen' }));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Wiederherstellen fehlgeschlagen', 'Store offline'),
    );
    view.unmount();
  });

  it('restores an active AI entitlement for the current household', async () => {
    mockHasAI = false;
    await renderAssistant();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Käufe wiederherstellen' }));
    await waitFor(() =>
      expect(mockSyncEntitlement).toHaveBeenCalledWith('household-1', { active: true }),
    );
    expect(mockPollEntitlement).toHaveBeenCalledWith({
      tier: 'ai',
      userId: 'user-1',
      activeHouseholdId: 'household-1',
    });
    expect(Alert.alert).toHaveBeenCalledWith('Erfolgreich', 'Dein KI-Abo wurde wiederhergestellt.');
  });

  it('bietet einen erneuten Haushaltsabgleich an, wenn die Freigabe noch nicht aktiv ist', async () => {
    mockHasAI = false;
    mockPollEntitlement.mockResolvedValueOnce(false);
    await renderAssistant();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Käufe wiederherstellen' }));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Haushaltsfreigabe noch nicht aktiv',
        'Dein KI-Abo wurde gefunden, aber die Freigabe für den Haushalt ist noch nicht aktiv. Du kannst es jetzt erneut versuchen.',
        [
          { text: 'Später', style: 'cancel' },
          { text: 'Erneut versuchen', onPress: expect.any(Function) },
        ],
      ),
    );

    const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    const retryButton = buttons?.find((button) => button.text === 'Erneut versuchen');
    expect(retryButton?.onPress).toEqual(expect.any(Function));

    await act(async () => {
      retryButton?.onPress?.();
    });
    await waitFor(() => expect(mockRestorePurchases).toHaveBeenCalledTimes(2));
  });

  it('opens the assistant with a recipe context from route params and lets the user remove it', async () => {
    mockRouteParams = { pageContextKind: 'recipe', pageContextRecipeId: ['recipe-1', 'ignored'] };
    await renderAssistant();
    expect(screen.getByText('Rezept als Seitenkontext')).toBeOnTheScreen();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Seitenkontext entfernen' }));
    expect(screen.queryByText('Rezept als Seitenkontext')).toBeNull();
  });

  it('sends the selected week as page context while household rules remain included', async () => {
    mockRouteParams = {
      pageContextKind: 'meal_plan',
      pageContextWeekStart: '2026-11-09',
    };
    await renderAssistant();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Was kann ich heute kochen?' }));
    await user.press(screen.getByRole('button', { name: 'Nachricht senden' }));

    await waitFor(() =>
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          includeHouseholdContext: true,
          pageContext: { kind: 'meal_plan', weekStartDate: '2026-11-09' },
        }),
      ),
    );
  });

  it('adds image and PDF attachments, then can send an attachment without message text', async () => {
    await renderAssistant();
    const user = userEvent.setup();
    mockLaunchImageLibrary.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file://wrong.txt', fileName: 'Notiz.txt', mimeType: 'text/plain' }],
    });

    await user.press(screen.getByRole('button', { name: 'Anhang hinzufügen' }));
    let options = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    await act(async () => options?.find((option) => option.text === 'Bild auswählen')?.onPress?.());
    expect(mockRequestImagePermission).toHaveBeenCalled();
    expect(screen.getByText('Bitte wähle JPEG-, PNG- oder WebP-Bilder aus.')).toBeOnTheScreen();

    mockLaunchImageLibrary.mockResolvedValueOnce({
      canceled: false,
      assets: [
        { uri: 'file://recipe.png', fileName: 'Rezept.png', mimeType: 'image/png' },
        { uri: 'file://wrong.txt', fileName: 'Notiz.txt', mimeType: 'text/plain' },
      ],
    });
    await user.press(screen.getByRole('button', { name: 'Anhang hinzufügen' }));
    options = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    await act(async () => options?.find((option) => option.text === 'Bild auswählen')?.onPress?.());
    expect(screen.getByText('Rezept.png')).toBeOnTheScreen();
    expect(screen.queryByText('Bitte wähle JPEG-, PNG- oder WebP-Bilder aus.')).toBeNull();

    mockGetDocument.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file://recipe.pdf', name: 'Rezept.pdf' }],
    });
    await user.press(screen.getByRole('button', { name: 'Anhang hinzufügen' }));
    options = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    await act(async () => options?.find((option) => option.text === 'PDF auswählen')?.onPress?.());
    expect(screen.getByText('Rezept.pdf')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Nachricht senden' }));
    await waitFor(() =>
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '',
          attachments: [
            { filename: 'Rezept.png', mimeType: 'image/png', data: 'encoded' },
            { filename: 'Rezept.pdf', mimeType: 'application/pdf', data: 'encoded' },
          ],
        }),
      ),
    );
    expect(mockEncodeAttachments).toHaveBeenCalledWith([
      { uri: 'file://recipe.png', name: 'Rezept.png', mimeType: 'image/png' },
      { uri: 'file://recipe.pdf', name: 'Rezept.pdf', mimeType: 'application/pdf' },
    ]);
  });

  it('handles denied photo access and canceled or empty PDF selections', async () => {
    mockRequestImagePermission.mockResolvedValueOnce({ granted: false });
    await renderAssistant();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Anhang hinzufügen' }));
    let options = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    await act(async () => options?.find((option) => option.text === 'Bild auswählen')?.onPress?.());
    expect(
      screen.getByText('Erlaube den Zugriff auf Fotos, um einen Anhang auszuwählen.'),
    ).toBeOnTheScreen();
    expect(mockLaunchImageLibrary).not.toHaveBeenCalled();

    await user.press(screen.getByRole('button', { name: 'Anhang hinzufügen' }));
    options = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    await act(async () => options?.find((option) => option.text === 'PDF auswählen')?.onPress?.());
    expect(screen.queryByText('Rezept.pdf')).toBeNull();

    mockGetDocument.mockResolvedValueOnce({ canceled: false, assets: [] });
    await user.press(screen.getByRole('button', { name: 'Anhang hinzufügen' }));
    options = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    await act(async () => options?.find((option) => option.text === 'PDF auswählen')?.onPress?.());
    expect(screen.queryByText('Rezept.pdf')).toBeNull();
  });

  it('sends only the selected expiring inventory lots as Assistant context', async () => {
    const soon = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    mockInventoryItems = [
      expiringInventoryItem('lot-mushrooms', 'Champignons', soon),
      expiringInventoryItem('lot-cream', 'Saure Sahne', soon),
    ];
    await renderAssistant();
    expect(screen.getByText('Bald ablaufend')).toBeOnTheScreen();
    const user = userEvent.setup();
    await user.press(screen.getByRole('checkbox', { name: 'Champignons' }));
    await user.press(screen.getByRole('button', { name: 'Was kann ich heute kochen?' }));
    await user.press(screen.getByRole('button', { name: 'Nachricht senden' }));

    await waitFor(() => expect(mockSendMessage).toHaveBeenCalled());
    expect(mockSendMessage.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ focusedInventoryLotIds: ['lot-cream'] }),
    );
  });

  it('opens and sends messages without showing a consent prompt', async () => {
    await renderAssistant();
    expect(screen.getByText('fam')).toBeOnTheScreen();
    expect(screen.queryByText('Deine Essensplanung')).not.toBeOnTheScreen();
    expect(screen.queryByText(/Datenverarbeitung freigeben/u)).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Anhang hinzufügen' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Rezept importieren' })).not.toBeOnTheScreen();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Was kann ich heute kochen?' }));
    await user.press(screen.getByRole('button', { name: 'Nachricht senden' }));
    await waitFor(() =>
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          householdId: 'household-1',
          includeHouseholdContext: true,
          message: 'Was kann ich heute kochen?',
          history: [],
        }),
      ),
    );
    expect(screen.getByText('Hier sind Ideen.')).toBeOnTheScreen();
    expect(screen.getByText('Vorrat geprüft')).toBeOnTheScreen();
    expect(screen.getByText('Rezepte durchsucht')).toBeOnTheScreen();
    expect(screen.getByLabelText('Vorrat geprüft (grocery, archive, solid)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Rezepte durchsucht (grocery, search, solid)')).toBeOnTheScreen();
    expect(screen.queryByText('Hinterlegte Regeln abgeglichen')).not.toBeOnTheScreen();
    expect(screen.getByText('Linsensuppe: Sahne → Hafercuisine')).toBeOnTheScreen();
    expect(screen.getByText('8 Credits übrig')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Mit Reis' }));
    await waitFor(() => expect(mockSendMessage).toHaveBeenCalledTimes(2));
    expect(mockSendMessage.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ message: 'Mit Reis' }),
    );
  });

  it('renders recipe cards and opens catalog recipes from assistant results', async () => {
    mockSendMessage.mockResolvedValueOnce({
      result: {
        text: 'Dazu passt dieses Gericht.',
        suggestions: [],
        recipeReferences: [
          {
            recipeId: 'catalog-1',
            title: 'Kichererbsenpfanne',
            source: 'catalog',
            slug: 'kichererbsenpfanne',
            coverImagePath: 'catalog/kichererbsenpfanne.jpg',
          },
        ],
        proposals: [],
        toolTrace: ['search_recipes'],
      },
    });
    await renderAssistant();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Was kann ich heute kochen?' }));
    await user.press(screen.getByRole('button', { name: 'Nachricht senden' }));

    expect(await screen.findByText('Kichererbsenpfanne')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Kichererbsenpfanne' }));
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/recipe/catalog/[slug]',
      params: { slug: 'kichererbsenpfanne' },
    });
  });

  it('shows visible progress while the Assistant is working', async () => {
    let resolveReply: ((value: unknown) => void) | undefined;
    mockSendMessage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveReply = resolve;
        }),
    );
    await renderAssistant();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Was kann ich heute kochen?' }));
    await user.press(screen.getByRole('button', { name: 'Nachricht senden' }));

    expect(screen.getByRole('progressbar', { name: 'Assistant arbeitet' })).toBeOnTheScreen();
    resolveReply?.({
      result: {
        text: 'Fertig.',
        suggestions: [],
        recipeReferences: [],
        proposals: [],
        toolTrace: [],
      },
    });
    await waitFor(() =>
      expect(screen.queryByRole('progressbar', { name: 'Assistant arbeitet' })).toBeNull(),
    );
  });

  it('shows failures returned by the Assistant service', async () => {
    mockSendMessage.mockRejectedValueOnce(new Error('Provider ist nicht erreichbar.'));
    await renderAssistant();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Was kann ich heute kochen?' }));
    await user.press(screen.getByRole('button', { name: 'Nachricht senden' }));
    await waitFor(() =>
      expect(screen.getByText('Provider ist nicht erreichbar.')).toBeOnTheScreen(),
    );
  });

  it('retries a refunded provider response without duplicating the user message', async () => {
    mockSendMessage.mockRejectedValueOnce(
      Object.assign(new Error('Die KI konnte gerade keine passende Antwort erstellen.'), {
        retryable: true,
      }),
    );
    await renderAssistant();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Was kann ich heute kochen?' }));
    await user.press(screen.getByRole('button', { name: 'Nachricht senden' }));
    await user.press(await screen.findByRole('button', { name: 'Erneut versuchen' }));

    await waitFor(() => expect(screen.getByText('Hier sind Ideen.')).toBeOnTheScreen());
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
    expect(mockSendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        message: 'Was kann ich heute kochen?',
        history: [],
      }),
    );
    const savedThreads = mockSaveThreads.mock.calls.at(-1)?.[1] as AssistantThread[] | undefined;
    expect(savedThreads?.[0]?.messages.map(({ role }) => role)).toEqual(['user', 'assistant']);
  });

  it('keeps the prompt editable when a manual retry also fails', async () => {
    mockSendMessage
      .mockRejectedValueOnce(
        Object.assign(new Error('Die KI konnte gerade keine passende Antwort erstellen.'), {
          retryable: true,
        }),
      )
      .mockRejectedValueOnce(new Error('Die Verbindung wurde unterbrochen.'));
    await renderAssistant();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Was kann ich heute kochen?' }));
    await user.press(screen.getByRole('button', { name: 'Nachricht senden' }));
    await user.press(await screen.findByRole('button', { name: 'Erneut versuchen' }));

    await waitFor(() =>
      expect(screen.getByText('Die Verbindung wurde unterbrochen.')).toBeOnTheScreen(),
    );
    expect(screen.getByDisplayValue('Was kann ich heute kochen?')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Erneut versuchen' })).toBeNull();
  });

  it('keeps a successful reply when refreshing credits fails', async () => {
    mockGetCreditStatus
      .mockResolvedValueOnce({
        creditsUsed: 2,
        creditsRemaining: 8,
        creditLimit: 10,
        warningReached: false,
        blocked: false,
      })
      .mockRejectedValueOnce(new Error('Creditstatus nicht verfügbar'));
    await renderAssistant();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Was kann ich heute kochen?' }));
    await user.press(screen.getByRole('button', { name: 'Nachricht senden' }));

    expect(await screen.findByText('Hier sind Ideen.')).toBeOnTheScreen();
    expect(screen.queryByText('Creditstatus nicht verfügbar')).toBeNull();
  });

  it('keeps a successful retry when refreshing credits fails', async () => {
    mockSendMessage.mockRejectedValueOnce(
      Object.assign(new Error('Die KI konnte gerade keine passende Antwort erstellen.'), {
        retryable: true,
      }),
    );
    mockGetCreditStatus
      .mockResolvedValueOnce({
        creditsUsed: 2,
        creditsRemaining: 8,
        creditLimit: 10,
        warningReached: false,
        blocked: false,
      })
      .mockRejectedValueOnce(new Error('Creditstatus nicht verfügbar'));
    await renderAssistant();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Was kann ich heute kochen?' }));
    await user.press(screen.getByRole('button', { name: 'Nachricht senden' }));
    await user.press(await screen.findByRole('button', { name: 'Erneut versuchen' }));

    expect(await screen.findByText('Hier sind Ideen.')).toBeOnTheScreen();
    expect(screen.queryByText('Creditstatus nicht verfügbar')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Erneut versuchen' })).toBeNull();
  });

  it('blocks sending when credits are exhausted', async () => {
    mockGetCreditStatus.mockResolvedValue({
      creditsUsed: 10,
      creditsRemaining: 0,
      creditLimit: 10,
      warningReached: true,
      blocked: true,
    });
    await renderAssistant();
    await waitFor(() =>
      expect(screen.getByText('Das monatliche Credit-Limit ist erreicht.')).toBeOnTheScreen(),
    );
    expect(screen.getByRole('button', { name: 'Nachricht senden' })).toBeDisabled();
  });

  it('lets the user start a chat before any conversations exist', async () => {
    mockThreads = [];
    await renderAssistant();

    expect(screen.getByRole('button', { name: 'Neuen Chat starten' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Gesprächsverlauf öffnen' })).toBeNull();

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Neuen Chat starten' }));

    await waitFor(() => {
      const savedThreads = mockSaveThreads.mock.calls.at(-1)?.[1] as AssistantThread[] | undefined;
      expect(savedThreads).toEqual([
        expect.objectContaining({ title: 'Neues Gespräch', messages: [] }),
      ]);
    });
  });

  it('opens history, starts a new conversation, and deletes a selected conversation', async () => {
    mockThreads = [
      assistantThread([{ id: 'message-1', role: 'user', text: 'Plan', createdAt: 'now' }]),
    ];
    await renderAssistant();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Neuen Chat starten' }));
    await waitFor(() => {
      const savedThreads = mockSaveThreads.mock.calls.at(-1)?.[1] as AssistantThread[] | undefined;
      expect(savedThreads).toHaveLength(2);
    });
    await user.press(screen.getByRole('button', { name: 'Gesprächsverlauf öffnen' }));
    expect(screen.getByText('Gesprächsverlauf')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Gespräch Abendessen löschen' }));
    const options = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    await act(async () => options?.find((option) => option.text === 'Löschen')?.onPress?.());
    await waitFor(() =>
      expect(mockSaveThreads).toHaveBeenLastCalledWith('user-1', [
        expect.objectContaining({ title: 'Neues Gespräch', messages: [] }),
      ]),
    );
  });

  it('applies a meal-plan proposal only after confirmation and reports result', async () => {
    mockThreads = [
      assistantThread([
        {
          id: 'reply-1',
          role: 'assistant',
          text: 'Wochenidee',
          createdAt: 'now',
          proposals: [mealPlanProposal],
        },
      ]),
    ];
    await renderAssistant();
    expect(screen.getByText('Vorschlag für 1 Mahlzeiten')).toBeOnTheScreen();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Vorschlag prüfen' }));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Vorschlag prüfen',
      expect.stringContaining('Linsensuppe'),
      expect.any(Array),
    );
    const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    await act(async () =>
      buttons?.find((button) => button.text === 'In Wochenplan übernehmen')?.onPress?.(),
    );
    await waitFor(() =>
      expect(mockApplyProposal).toHaveBeenCalledWith({
        householdId: 'household-1',
        userId: 'user-1',
        proposal: mealPlanProposal,
      }),
    );
    expect(mockInvalidate).toHaveBeenCalledTimes(4);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Zum Wochenplan hinzugefügt',
      '1 Mahlzeiten wurden lokal vorgemerkt.',
    );
  });

  it('requires confirmation before adding a shopping item and persists the applied state', async () => {
    mockThreads = [
      assistantThread([
        {
          id: 'reply-1',
          role: 'assistant',
          text: 'Ich kann Hafermilch ergänzen.',
          createdAt: 'now',
          proposals: [shoppingItemProposal],
          toolTrace: ['propose_shopping_list_item'],
        },
      ]),
    ];
    await renderAssistant();
    const user = userEvent.setup();
    const applyButton = screen.getByRole('button', {
      name: 'Einkaufsartikel übernehmen: Hafermilch',
    });

    expect(screen.getByText('2 Packungen · Hafermilch')).toBeOnTheScreen();
    expect(screen.getByText(/keiner geprüften Lebensmittelzuordnung/u)).toBeOnTheScreen();
    await user.press(applyButton);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Artikel übernehmen?',
      expect.stringContaining('2 Packungen · Hafermilch'),
      expect.any(Array),
    );
    let options = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    await act(async () => options?.find((option) => option.text === 'Abbrechen')?.onPress?.());
    expect(mockAddShoppingItem).not.toHaveBeenCalled();

    await user.press(applyButton);
    options = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    await act(async () => {
      const confirm = options?.find((option) => option.text === 'Übernehmen')?.onPress;
      confirm?.();
      confirm?.();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() =>
      expect(mockAddShoppingItem).toHaveBeenCalledWith({
        household_id: 'household-1',
        name: 'Hafermilch',
        quantity: 2,
        unit: 'package',
        product_id: null,
        category_id: null,
        category_source: null,
      }),
    );
    expect(mockAddShoppingItem).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(mockSaveThreads).toHaveBeenCalledWith(
        'user-1',
        expect.arrayContaining([
          expect.objectContaining({
            id: 'thread-1',
            messages: [expect.objectContaining({ id: 'reply-1', appliedProposalIndexes: [0] })],
          }),
        ]),
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Einkaufsartikel übernehmen: Hafermilch' }),
      ).toBeDisabled(),
    );
  });

  it('leaves a meal-plan proposal unchanged when confirmation is canceled', async () => {
    mockThreads = [
      assistantThread([
        {
          id: 'reply-1',
          role: 'assistant',
          text: 'Wochenidee',
          createdAt: 'now',
          proposals: [mealPlanProposal],
        },
      ]),
    ];
    await renderAssistant();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Vorschlag prüfen' }));
    const options = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    await act(async () => options?.find((option) => option.text === 'Zurück')?.onPress?.());

    expect(mockApplyProposal).not.toHaveBeenCalled();
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it('reports a failed meal-plan apply without persisting an applied state or invalidating queries', async () => {
    mockThreads = [
      assistantThread([
        {
          id: 'reply-1',
          role: 'assistant',
          text: 'Wochenidee',
          createdAt: 'now',
          proposals: [mealPlanProposal],
        },
      ]),
    ];
    mockApplyProposal.mockRejectedValue(new Error('SQLite write failed'));
    await renderAssistant();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'In Wochenplan übernehmen' }));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Vorschlag nicht übernommen',
        'Der Wochenplan konnte nicht aktualisiert werden. Es wurde nichts übernommen.',
      ),
    );
    expect(mockSaveThreads).not.toHaveBeenCalled();
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it('reports stale meal-plan evidence without invalidating current queries', async () => {
    mockThreads = [
      assistantThread([
        {
          id: 'reply-1',
          role: 'assistant',
          text: 'Wochenidee',
          createdAt: 'now',
          proposals: [mealPlanProposal],
        },
      ]),
    ];
    mockApplyProposal.mockRejectedValue(
      new (jest.requireMock('../data/apply-meal-plan-proposal').ApplyMealPlanProposalError)(
        'food_rules_changed',
      ),
    );
    await renderAssistant();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'In Wochenplan übernehmen' }));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Vorschlag nicht übernommen',
        'Deine Ernährungsregeln haben sich geändert. Erstelle bitte einen neuen Vorschlag.',
      ),
    );
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it('does not persist a shopping proposal after its local mutation fails', async () => {
    mockThreads = [
      assistantThread([
        {
          id: 'reply-1',
          role: 'assistant',
          text: 'Ich kann Hafermilch ergänzen.',
          createdAt: 'now',
          proposals: [shoppingItemProposal],
          toolTrace: ['propose_shopping_list_item'],
        },
      ]),
    ];
    mockAddShoppingItem.mockRejectedValue(new Error('offline'));
    await renderAssistant();
    const user = userEvent.setup();
    await user.press(
      screen.getByRole('button', { name: 'Einkaufsartikel übernehmen: Hafermilch' }),
    );
    const options = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    await act(async () => options?.find((option) => option.text === 'Übernehmen')?.onPress?.());

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Artikel nicht übernommen',
        'Der Artikel konnte nicht vorgemerkt werden. Bitte versuche es erneut.',
      ),
    );
    expect(mockSaveThreads).not.toHaveBeenCalled();
  });

  it('does not persist or invalidate when a shopping-list transaction fails', async () => {
    mockThreads = [
      assistantThread([
        {
          id: 'reply-failed',
          role: 'assistant',
          text: 'Hafermilch fehlt.',
          createdAt: 'now',
          proposals: [
            {
              kind: 'shopping_list_proposal.v1',
              summary: 'Hafermilch ergänzen',
              items: [
                { name: 'Hafermilch', quantity: 2, unit: 'package', foodRuleStatus: 'clear' },
              ],
            },
          ],
        },
      ]),
    ];
    mockApplyShoppingList.mockRejectedValueOnce(new Error('SQLite write failed'));
    await renderAssistant();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Einkaufsartikel übernehmen' }));
    const options = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    await act(async () => options?.find((option) => option.text === 'Übernehmen')?.onPress?.());

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenLastCalledWith(
        'Artikel nicht übernommen',
        'Die Artikel konnten nicht vorgemerkt werden. Bitte versuche es erneut.',
      ),
    );
    expect(mockSaveThreads).not.toHaveBeenCalled();
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it('marks a committed shopping proposal applied even if saving the chat fails', async () => {
    mockThreads = [
      assistantThread([
        {
          id: 'reply-1',
          role: 'assistant',
          text: 'Ich kann Hafermilch ergänzen.',
          createdAt: 'now',
          proposals: [
            {
              kind: 'shopping_list_proposal.v1',
              summary: 'Hafermilch ergänzen',
              items: [
                { name: 'Hafermilch', quantity: 2, unit: 'package', foodRuleStatus: 'clear' },
              ],
            },
          ],
        },
      ]),
    ];
    mockSaveThreads.mockRejectedValueOnce(new Error('encrypted storage unavailable'));
    await renderAssistant();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Einkaufsartikel übernehmen' }));
    const options = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    await act(async () => options?.find((option) => option.text === 'Übernehmen')?.onPress?.());

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenLastCalledWith(
        'Einkaufsliste aktualisiert',
        expect.stringContaining('Ein erneutes Übernehmen fügt nichts doppelt hinzu.'),
      ),
    );
    expect(mockApplyShoppingList).toHaveBeenCalledWith({
      userId: 'user-1',
      householdId: 'household-1',
      proposalKey: 'reply-1-0',
      proposal: expect.objectContaining({ kind: 'shopping_list_proposal.v1' }),
    });
    expect(screen.getByRole('button', { name: 'Einkaufsartikel übernehmen' })).toBeDisabled();
  });

  it('reports a durable duplicate receipt without increasing merged quantities', async () => {
    mockThreads = [
      assistantThread([
        {
          id: 'reply-duplicate',
          role: 'assistant',
          text: 'Vorschlag',
          createdAt: 'now',
          proposals: [
            {
              kind: 'shopping_list_proposal.v1',
              summary: 'Hafermilch ergänzen',
              items: [
                { name: 'Hafermilch', quantity: 2, unit: 'package', foodRuleStatus: 'clear' },
              ],
            },
          ],
        },
      ]),
    ];
    mockApplyShoppingList.mockResolvedValueOnce({ addedCount: 0, alreadyApplied: true });
    await renderAssistant();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Einkaufsartikel übernehmen' }));
    const options = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    await act(async () => options?.find((option) => option.text === 'Übernehmen')?.onPress?.());

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenLastCalledWith(
        'Einkaufsliste aktualisiert',
        'Dieser Vorschlag war bereits in der Einkaufsliste vorgemerkt.',
      ),
    );
    expect(mockApplyShoppingList).toHaveBeenCalledTimes(1);
  });

  it('routes ingredient-swap recipe actions and explains stale safety evidence', async () => {
    mockThreads = [
      assistantThread([
        {
          id: 'reply-1',
          role: 'assistant',
          text: 'Tauschidee',
          createdAt: 'now',
          proposals: [ingredientSwap],
        },
      ]),
    ];
    mockApplyProposal.mockRejectedValue(new Error('changed'));
    await renderAssistant();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Rezept ansehen' }));
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/recipe/[id]',
      params: { id: 'recipe-1' },
    });
    await user.press(screen.getByRole('button', { name: 'Gesprächsverlauf öffnen' }));
    await user.press(screen.getByRole('button', { name: 'Neuen Chat starten' }));
    await waitFor(() => expect(mockSaveThreads).toHaveBeenCalled());
    expect(screen.getByText('Was möchtest du heute kochen?')).toBeOnTheScreen();
  });
});
