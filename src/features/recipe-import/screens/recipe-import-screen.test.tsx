import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import { UNKNOWN_INGREDIENT_MAPPING } from '@/features/recipes/domain/ingredient-mapping';
import type { RecipeImportDraft, RecipeImportDraftRecord } from '../types';
import { RecipeImportScreen } from './recipe-import-screen';

const mockPush = jest.fn();
const mockLoadDrafts = jest.fn();
const mockFindSavedSource = jest.fn();
const mockSaveDraft = jest.fn();
const mockRemoveDraft = jest.fn();
const mockGetCreditStatus = jest.fn();
const mockImportSource = jest.fn();
const mockRequestMediaPermission = jest.fn();
const mockLaunchImagePicker = jest.fn();
const mockPickDocument = jest.fn();
const mockExtractVideoFrames = jest.fn();
let mockUserId: string | null = 'user-1';
let mockHouseholdId: string | null = 'household-1';
let mockHasAI = true;
let mockDrafts: RecipeImportDraftRecord[] = [];

type MockTheme = {
  space: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
  radius: { sm: number; md: number; lg: number };
  backgroundElement: string;
  backgroundSoft: string;
  accent: string;
  text: string;
  border: string;
  borderWidth: { base: number; strong: number };
  onAccent: string;
};
type MockHeaderProps = { header: { title: string }; children: ReactNode };

jest.mock('@shopify/flash-list', () => {
  const React = require('react');
  const { View: NativeView } = require('react-native');
  return {
    FlashList: ({
      data,
      renderItem,
      ListHeaderComponent,
      ListEmptyComponent,
    }: {
      data: unknown[];
      renderItem: (args: { item: unknown }) => ReactNode;
      ListHeaderComponent?: ReactNode;
      ListEmptyComponent?: ReactNode;
    }) =>
      React.createElement(
        NativeView,
        null,
        ListHeaderComponent,
        data.length
          ? data.map((item, index) =>
              React.createElement(React.Fragment, { key: index }, renderItem({ item })),
            )
          : ListEmptyComponent,
      ),
  };
});
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockPickDocument(...args),
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) => mockRequestMediaPermission(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImagePicker(...args),
}));
jest.mock('../data/extract-video-recipe-frames', () => ({
  extractVideoRecipeFrames: (...args: unknown[]) => mockExtractVideoFrames(...args),
}));
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), back: jest.fn() },
}));
jest.mock('react-native-unistyles', () => ({
  StyleSheet: {
    hairlineWidth: 1,
    create: (factory: (theme: MockTheme) => unknown) =>
      factory({
        space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 },
        radius: { sm: 8, md: 12, lg: 16 },
        backgroundElement: '#fff',
        accent: '#a56',
        backgroundSoft: '#eee',
        text: '#222',
        border: '#E4DDE3',
        borderWidth: { base: 1.5, strong: 2 },
        onAccent: '#fff',
      }),
  },
}));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      accent: '#a56',
      background: '#fff',
      onAccent: '#fff',
      text: '#222',
      textSecondary: '#666',
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
      children,
    );
  },
}));
jest.mock('@/components/layout/back-button', () => ({ BackButton: () => null }));
jest.mock('@/constants/ui', () => {
  const React = require('react');
  const {
    Pressable: NativePressable,
    Text: NativeText,
    TextInput: NativeTextInput,
    View: NativeView,
  } = require('react-native');
  return {
    Divider: () => React.createElement(NativeText, null, '—'),
    Press: ({
      children,
      onPress,
      accessibilityRole,
      accessibilityState,
      disabled,
      style,
      containerStyle,
    }: Pick<
      PressableProps,
      'children' | 'onPress' | 'accessibilityRole' | 'accessibilityState' | 'disabled' | 'style'
    > & { containerStyle?: StyleProp<ViewStyle> }) =>
      React.createElement(
        NativeView,
        { style: containerStyle },
        React.createElement(
          NativePressable,
          {
            accessibilityRole: accessibilityRole ?? 'button',
            accessibilityState,
            disabled,
            onPress,
            style,
          },
          children,
        ),
      ),
    Txt: ({ children }: { children: ReactNode }) => React.createElement(NativeText, null, children),
    TextField: (props: Record<string, unknown>) =>
      React.createElement(NativeTextInput, {
        ...props,
        accessibilityLabel: props.accessibilityLabel ?? props.label,
      }),
  };
});
jest.mock('@/features/ai-assistant/data/assistant-api', () => ({
  getAiCreditStatus: (...args: unknown[]) => mockGetCreditStatus(...args),
}));
jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: mockUserId ? { user: { id: mockUserId } } : null }),
}));
jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: mockHouseholdId }),
}));
jest.mock('@/features/premium/premium-provider', () => ({
  usePremium: () => ({ hasAI: mockHasAI }),
}));
jest.mock('../data/recipe-import-api', () => ({
  importRecipeSource: (...args: unknown[]) => mockImportSource(...args),
}));
jest.mock('../data/recipe-import-storage', () => ({
  findSavedRecipeImportSource: (...args: unknown[]) => mockFindSavedSource(...args),
  loadRecipeImportDrafts: (...args: unknown[]) => mockLoadDrafts(...args),
  normalizeRecipeSourceUrl: (value: string) => value.trim().toLowerCase().replace(/#.*$/u, ''),
  removeRecipeImportDraft: (...args: unknown[]) => mockRemoveDraft(...args),
  saveRecipeImportDraft: (...args: unknown[]) => mockSaveDraft(...args),
}));

const draft: RecipeImportDraft = {
  kind: 'recipe_import_draft.v1',
  title: 'Linsensuppe',
  servings: 4,
  ingredients: [
    {
      text: 'Linsen',
      confidence: 'high',
      mapping: UNKNOWN_INGREDIENT_MAPPING,
    },
  ],
  steps: ['Kochen'],
  notes: null,
  warnings: [],
};

function draftRecord(overrides: Partial<RecipeImportDraftRecord> = {}): RecipeImportDraftRecord {
  return {
    id: 'draft-1',
    sourceType: 'url',
    sourceLabel: 'https://example.test/recipe',
    sourceUrl: 'https://example.test/recipe',
    originalText: null,
    mediaUris: [],
    method: 'structured',
    draft,
    createdAt: '2026-11-08T00:00:00Z',
    ...overrides,
  };
}

async function renderImporter() {
  const result = await render(<RecipeImportScreen />);
  await waitFor(() => {
    expect(
      Boolean(
        screen.queryByRole('button', { name: 'Link importieren' }) ||
          screen.queryByText('Wähle zuerst einen aktiven Haushalt.'),
      ),
    ).toBe(true);
  });
  return result;
}

describe('RecipeImportScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserId = 'user-1';
    mockHouseholdId = 'household-1';
    mockHasAI = true;
    mockDrafts = [];
    mockLoadDrafts.mockImplementation(async () => mockDrafts);
    mockFindSavedSource.mockResolvedValue(null);
    mockSaveDraft.mockResolvedValue(undefined);
    mockRemoveDraft.mockResolvedValue(undefined);
    mockGetCreditStatus.mockResolvedValue({
      creditsUsed: 3,
      creditsRemaining: 7,
      creditLimit: 10,
      warningReached: false,
      blocked: false,
    });
    mockImportSource.mockResolvedValue({ draft, method: 'ai' });
    mockRequestMediaPermission.mockResolvedValue({ granted: true });
    mockLaunchImagePicker.mockResolvedValue({ canceled: true, assets: [] });
    mockPickDocument.mockResolvedValue({ canceled: true, assets: [] });
    mockExtractVideoFrames.mockResolvedValue([
      { uri: 'frame://1', name: 'Videoausschnitt 1.jpg', mimeType: 'image/jpeg' },
      { uri: 'frame://2', name: 'Videoausschnitt 2.jpg', mimeType: 'image/jpeg' },
    ]);
  });

  it('asks the user to sign in when there is no session', async () => {
    mockUserId = null;
    await render(<RecipeImportScreen />);
    expect(screen.getByText('Bitte melde dich an, um Rezepte zu importieren.')).toBeOnTheScreen();
  });

  it('shows the importer without a data-processing consent dialog', async () => {
    await renderImporter();
    expect(screen.queryByText('AI-Datenverarbeitung freigeben')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Zustimmen und fortfahren' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Link importieren' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mehrere Links importieren' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Text einfügen' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Foto oder PDF' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Rezept manuell eingeben' })).toBeOnTheScreen();
    expect(screen.getByText('fam')).toBeOnTheScreen();
    expect(screen.getByText('Rezept hinzufügen')).toBeOnTheScreen();
    expect(
      screen.getByText('Rezeptlink einfügen oder eine andere Quelle wählen.'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Text einfügen' }).parent).toHaveStyle({ flex: 1 });
    expect(screen.getByRole('button', { name: 'Foto oder PDF' }).parent).toHaveStyle({ flex: 1 });
    expect(screen.getByLabelText('Rezeptlink')).toHaveStyle({
      borderWidth: 1.5,
      borderColor: '#E4DDE3',
    });
    expect(screen.queryByText(/Vollständige Weblinks sind kostenlos/u)).toBeNull();
    expect(screen.queryByText(/Vollständige strukturierte Weblinks sind ohne AI-Abo/u)).toBeNull();
    expect(screen.queryByText(/Das monatliche Credit-Limit ist erreicht/u)).toBeNull();
    expect(screen.queryByText('Importentwürfe')).not.toBeOnTheScreen();
    expect(screen.queryByText('Noch keine Importentwürfe gespeichert.')).not.toBeOnTheScreen();
  });

  it('opens the manual recipe editor from the import start screen', async () => {
    await renderImporter();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Rezept manuell eingeben' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/recipe/create' });
  });

  it('keeps the fam brand header while moving into a source-specific import step', async () => {
    await renderImporter();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Text einfügen' }));

    expect(screen.getByText('fam')).toBeOnTheScreen();
    expect(screen.getByText('Text einfügen')).toBeOnTheScreen();
    expect(screen.getAllByText('Text einfügen')).toHaveLength(1);
  });

  it('requires an active household before showing the importer', async () => {
    mockHouseholdId = null;
    await renderImporter();
    expect(screen.getByText('Wähle zuerst einen aktiven Haushalt.')).toBeOnTheScreen();
  });

  it('renders AI credit status and explains an exhausted monthly limit', async () => {
    mockGetCreditStatus.mockResolvedValue({
      creditsUsed: 10,
      creditsRemaining: 0,
      creditLimit: 10,
      warningReached: true,
      blocked: true,
    });
    await renderImporter();
    expect(screen.queryByText(/Das monatliche Credit-Limit ist erreicht/u)).toBeNull();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Text einfügen' }));
    await waitFor(() =>
      expect(screen.getByText(/Das monatliche Credit-Limit ist erreicht/u)).toBeOnTheScreen(),
    );
    expect(screen.getByText(/Verbraucht: 10\/10 diesen Monat/u)).toBeOnTheScreen();
  });

  it('validates empty and over-limit links before starting work', async () => {
    await renderImporter();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Link importieren' }));
    expect(screen.getByText('Füge mindestens einen Rezeptlink ein.')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Mehrere Links importieren' }));
    fireEvent.changeText(
      screen.getByLabelText('Rezeptlinks'),
      Array.from({ length: 21 }, (_, index) => `https://example.test/${index}`).join('\n'),
    );
    await user.press(screen.getByRole('button', { name: 'Links importieren' }));
    expect(screen.getByText('Importiere höchstens 20 Links auf einmal.')).toBeOnTheScreen();
    expect(mockImportSource).not.toHaveBeenCalled();
  });

  it('accepts exactly 20 non-empty links while ignoring blank lines', async () => {
    await renderImporter();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Mehrere Links importieren' }));
    const links = Array.from({ length: 20 }, (_, index) => `https://example.test/${index}`);
    fireEvent.changeText(screen.getByLabelText('Rezeptlinks'), `\n${links.join('\n')}\n\n`);
    await user.press(screen.getByRole('button', { name: 'Links importieren' }));

    await waitFor(() => expect(mockImportSource).toHaveBeenCalledTimes(20));
    expect(mockImportSource).toHaveBeenNthCalledWith(1, {
      householdId: 'household-1',
      sourceType: 'url',
      sourceUrl: 'https://example.test/0',
    });
    expect(mockImportSource).toHaveBeenLastCalledWith({
      householdId: 'household-1',
      sourceType: 'url',
      sourceUrl: 'https://example.test/19',
    });
  });

  it('keeps mixed batch outcomes independent and skips a saved duplicate', async () => {
    mockFindSavedSource.mockImplementation(async (_userId: string, sourceUrl: string) =>
      sourceUrl.endsWith('/saved')
        ? {
            recipeId: 'recipe-1',
            title: 'Gespeichert',
            sourceUrl,
            normalizedSourceUrl: sourceUrl,
            savedAt: 'now',
          }
        : null,
    );
    mockImportSource.mockImplementation(async ({ sourceUrl }: { sourceUrl?: string }) => {
      if (sourceUrl?.endsWith('/failed')) throw new Error('Quelle nicht lesbar');
      return { draft, method: 'ai' as const };
    });
    await renderImporter();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Mehrere Links importieren' }));
    fireEvent.changeText(
      screen.getByLabelText('Rezeptlinks'),
      'https://example.test/saved\n\nhttps://example.test/failed\nhttps://example.test/success',
    );
    await user.press(screen.getByRole('button', { name: 'Links importieren' }));

    expect(await screen.findByText('Quelle wurde schon importiert')).toBeOnTheScreen();
    expect(await screen.findByText('Quelle nicht lesbar')).toBeOnTheScreen();
    expect(await screen.findByText('Entwurf bereit')).toBeOnTheScreen();
    expect(mockImportSource).toHaveBeenCalledTimes(2);
    expect(mockImportSource).not.toHaveBeenCalledWith(
      expect.objectContaining({ sourceUrl: 'https://example.test/saved' }),
    );
  });

  it('imports each link entered in the multiple-link flow', async () => {
    await renderImporter();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Mehrere Links importieren' }));
    fireEvent.changeText(
      screen.getByLabelText('Rezeptlinks'),
      'https://example.test/one\nhttps://example.test/two',
    );
    await user.press(screen.getByRole('button', { name: 'Links importieren' }));
    await waitFor(() => expect(mockImportSource).toHaveBeenCalledTimes(2));
    expect(mockImportSource).toHaveBeenNthCalledWith(1, {
      householdId: 'household-1',
      sourceType: 'url',
      sourceUrl: 'https://example.test/one',
    });
    expect(mockImportSource).toHaveBeenNthCalledWith(2, {
      householdId: 'household-1',
      sourceType: 'url',
      sourceUrl: 'https://example.test/two',
    });
  });

  it('imports a recipe URL to a reviewable draft and opens it in the recipe editor', async () => {
    await renderImporter();
    fireEvent.changeText(screen.getByLabelText('Rezeptlink'), 'https://example.test/recipe');
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Link importieren' }));
    await waitFor(() => expect(screen.getByText('Entwurf bereit')).toBeOnTheScreen());
    expect(mockImportSource).toHaveBeenCalledWith({
      householdId: 'household-1',
      sourceType: 'url',
      sourceUrl: 'https://example.test/recipe',
    });
    expect(mockSaveDraft).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ sourceUrl: 'https://example.test/recipe', draft }),
    );
    await user.press(screen.getByRole('button', { name: 'Entwurf prüfen' }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/recipe/create',
      params: { importDraftId: expect.any(String) },
    });
  });

  it('reports a local draft persistence failure after a successful import response', async () => {
    mockSaveDraft.mockRejectedValueOnce(new Error('Lokaler Speicher ist voll.'));
    await renderImporter();
    fireEvent.changeText(screen.getByLabelText('Rezeptlink'), 'https://example.test/recipe');
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Link importieren' }));

    expect(await screen.findByText('Lokaler Speicher ist voll.')).toBeOnTheScreen();
    expect(screen.queryByText('Entwurf bereit')).not.toBeOnTheScreen();
    expect(mockImportSource).toHaveBeenCalledTimes(1);
  });

  it('recognizes a previously imported source and opens its saved recipe', async () => {
    mockFindSavedSource.mockResolvedValue({
      recipeId: 'recipe-1',
      title: 'Linsensuppe',
      sourceUrl: 'https://example.test/recipe',
      normalizedSourceUrl: 'https://example.test/recipe',
      savedAt: 'now',
    });
    await renderImporter();
    fireEvent.changeText(screen.getByLabelText('Rezeptlink'), 'https://example.test/recipe');
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Link importieren' }));
    await waitFor(() =>
      expect(screen.getByText('Quelle wurde schon importiert')).toBeOnTheScreen(),
    );
    await user.press(screen.getByRole('button', { name: 'Öffnen' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/recipe/[id]', params: { id: 'recipe-1' } });
    expect(mockImportSource).not.toHaveBeenCalled();
  });

  it('checks draft duplicates, retries failed imports, and removes stored drafts', async () => {
    mockDrafts = [draftRecord()];
    mockLoadDrafts.mockImplementation(async () => mockDrafts);
    await renderImporter();
    fireEvent.changeText(screen.getByLabelText('Rezeptlink'), 'https://example.test/recipe#source');
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Link importieren' }));
    await waitFor(() =>
      expect(screen.getByText('Quelle wurde schon importiert')).toBeOnTheScreen(),
    );
    expect(mockImportSource).not.toHaveBeenCalled();

    mockDrafts = [];
    mockImportSource.mockRejectedValueOnce(new Error('Server nicht erreichbar'));
    fireEvent.changeText(screen.getByLabelText('Rezeptlink'), 'https://example.test/other');
    await user.press(screen.getByRole('button', { name: 'Link importieren' }));
    await waitFor(() => expect(screen.getByText('Server nicht erreichbar')).toBeOnTheScreen());
    mockImportSource.mockResolvedValueOnce({ draft, method: 'ai' });
    await user.press(screen.getByRole('button', { name: 'Erneut versuchen' }));
    await waitFor(() => expect(mockImportSource).toHaveBeenCalledTimes(2));

    const deleteButtons = screen.getAllByRole('button', { name: 'Entfernen' });
    expect(deleteButtons).toHaveLength(2);
    const savedDraftDeleteButton = deleteButtons[1];
    expect(savedDraftDeleteButton).toBeDefined();
    if (!savedDraftDeleteButton)
      throw new Error('Gespeicherter Entwurf hat keinen Entfernen-Knopf.');
    await user.press(savedDraftDeleteButton);
    await waitFor(() => expect(mockRemoveDraft).toHaveBeenCalledWith('user-1', 'draft-1'));
  });

  it('validates text and video imports and respects the household AI entitlement', async () => {
    mockHasAI = false;
    await renderImporter();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Text einfügen' }));
    await user.press(screen.getByRole('button', { name: 'Text importieren' }));
    expect(screen.getByText('Füge zuerst den Rezepttext ein.')).toBeOnTheScreen();
    fireEvent.changeText(screen.getByLabelText('Rezepttext'), 'Mehl und Wasser vermengen.');
    await user.press(screen.getByRole('button', { name: 'Text importieren' }));
    expect(
      screen.getByText('Für den Textimport brauchst du das AI-Abo dieses Haushalts.'),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Zurück' }));
    fireEvent.changeText(screen.getByLabelText('Rezeptlink'), 'https://www.instagram.com/reel/abc');
    await user.press(screen.getByRole('button', { name: 'Link importieren' }));
    expect(
      screen.getByText('Für den Videoimport brauchst du das AI-Abo dieses Haushalts.'),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Foto oder PDF' }));
    await user.press(screen.getByRole('button', { name: 'Video aus Fotos auswählen' }));
    expect(
      screen.getByText('Für den Videoimport brauchst du das AI-Abo dieses Haushalts.'),
    ).toBeOnTheScreen();
    expect(mockRequestMediaPermission).not.toHaveBeenCalled();
  });

  it('routes Instagram video links through the AI recipe importer', async () => {
    await renderImporter();
    fireEvent.changeText(screen.getByLabelText('Rezeptlink'), 'https://www.instagram.com/reel/abc');
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Link importieren' }));
    await waitFor(() =>
      expect(mockImportSource).toHaveBeenCalledWith({
        householdId: 'household-1',
        sourceType: 'video',
        sourceUrl: 'https://www.instagram.com/reel/abc',
      }),
    );
  });

  it('handles photo permissions, invalid image types and valid multi-page image import', async () => {
    await renderImporter();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Foto oder PDF' }));
    mockRequestMediaPermission.mockResolvedValueOnce({ granted: false });
    await user.press(screen.getByRole('button', { name: 'Fotos auswählen' }));
    expect(
      await screen.findByText('Erlaube den Zugriff auf Fotos, um Rezeptseiten auszuwählen.'),
    ).toBeOnTheScreen();

    mockRequestMediaPermission.mockResolvedValue({ granted: true });
    mockLaunchImagePicker.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'image://bad', fileName: 'clip.gif', mimeType: 'image/gif' }],
    });
    await user.press(screen.getByRole('button', { name: 'Fotos auswählen' }));
    expect(
      await screen.findByText('Bitte wähle JPEG-, PNG- oder WebP-Bilder aus.'),
    ).toBeOnTheScreen();

    mockLaunchImagePicker.mockResolvedValueOnce({
      canceled: false,
      assets: [
        { uri: 'image://one', fileName: 'Seite 1.jpg', mimeType: 'image/jpeg' },
        { uri: 'image://two', fileName: null, mimeType: null },
      ],
    });
    await user.press(screen.getByRole('button', { name: 'Fotos auswählen' }));
    expect(await screen.findByText('Seite 1.jpg')).toBeOnTheScreen();
    expect(screen.getByText('Rezeptseite 2')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Import starten' }));
    await waitFor(() =>
      expect(mockImportSource).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: 'image',
          media: expect.arrayContaining([expect.objectContaining({ uri: 'image://one' })]),
        }),
      ),
    );
  });

  it('shows a media import error without marking the queue item as imported', async () => {
    mockImportSource.mockRejectedValueOnce(new Error('Medienquelle nicht lesbar.'));
    mockLaunchImagePicker.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'image://one', fileName: 'Seite.jpg', mimeType: 'image/jpeg' }],
    });
    await renderImporter();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Foto oder PDF' }));
    await user.press(screen.getByRole('button', { name: 'Fotos auswählen' }));
    await user.press(screen.getByRole('button', { name: 'Import starten' }));

    expect(await screen.findByText('Medienquelle nicht lesbar.')).toBeOnTheScreen();
    expect(screen.queryByText('Entwurf bereit')).not.toBeOnTheScreen();
  });

  it('handles PDF picker cancellation, missing assets and a successful PDF selection', async () => {
    await renderImporter();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Foto oder PDF' }));
    await user.press(screen.getByRole('button', { name: 'PDF auswählen' }));
    expect(mockPickDocument).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'application/pdf', multiple: false }),
    );
    mockPickDocument.mockResolvedValueOnce({ canceled: false, assets: [] });
    await user.press(screen.getByRole('button', { name: 'PDF auswählen' }));
    await user.press(screen.getByRole('button', { name: 'Import starten' }));
    expect(screen.getByText('Wähle zuerst Fotos, ein Video oder ein PDF aus.')).toBeOnTheScreen();

    mockPickDocument.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file://recipe.pdf', name: 'Rezept.pdf', mimeType: null }],
    });
    await user.press(screen.getByRole('button', { name: 'PDF auswählen' }));
    expect(await screen.findByText('Rezept.pdf')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Import starten' }));
    await waitFor(() =>
      expect(mockImportSource).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: 'pdf',
          media: [{ uri: 'file://recipe.pdf', name: 'Rezept.pdf', mimeType: 'application/pdf' }],
        }),
      ),
    );
  });

  it('imports a Shortcut-downloaded Reel from Photos as extracted recipe frames', async () => {
    await renderImporter();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Foto oder PDF' }));
    mockLaunchImagePicker.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file://shortcut-reel.mp4', fileName: 'reel.mp4', mimeType: 'video/mp4' }],
    });
    await user.press(screen.getByRole('button', { name: 'Video aus Fotos auswählen' }));

    await waitFor(() =>
      expect(mockExtractVideoFrames).toHaveBeenCalledWith('file://shortcut-reel.mp4'),
    );
    expect(screen.getByText('Videoausschnitt 1.jpg')).toBeOnTheScreen();
    expect(
      screen.getByText(/Speichere das Reel zuerst.*fünf aussagekräftige Videobilder/),
    ).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Import starten' }));

    await waitFor(() =>
      expect(mockImportSource).toHaveBeenCalledWith({
        householdId: 'household-1',
        sourceType: 'image',
        media: [
          { uri: 'frame://1', name: 'Videoausschnitt 1.jpg', mimeType: 'image/jpeg' },
          { uri: 'frame://2', name: 'Videoausschnitt 2.jpg', mimeType: 'image/jpeg' },
        ],
      }),
    );
  });

  it('clears a previous media selection when video extraction fails', async () => {
    mockExtractVideoFrames.mockRejectedValueOnce(new Error('Videoformat nicht lesbar.'));
    mockLaunchImagePicker
      .mockResolvedValueOnce({
        canceled: false,
        assets: [
          { uri: 'image://previous', fileName: 'Vorherige Seite.jpg', mimeType: 'image/jpeg' },
        ],
      })
      .mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: 'file://broken.mp4', fileName: 'broken.mp4', mimeType: 'video/mp4' }],
      });
    await renderImporter();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Foto oder PDF' }));
    await user.press(screen.getByRole('button', { name: 'Fotos auswählen' }));
    expect(await screen.findByText('Vorherige Seite.jpg')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Video aus Fotos auswählen' }));

    expect(await screen.findByText('Videoformat nicht lesbar.')).toBeOnTheScreen();
    expect(screen.queryByText('Vorherige Seite.jpg')).not.toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Import starten' }));
    expect(screen.getByText('Wähle zuerst Fotos, ein Video oder ein PDF aus.')).toBeOnTheScreen();
    expect(mockImportSource).not.toHaveBeenCalled();
  });
});
