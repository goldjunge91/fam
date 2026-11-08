import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { PressableProps } from 'react-native';
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
        border: '#ddd',
      }),
  },
}));
jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: { accent: '#a56', background: '#fff', textSecondary: '#666' } }),
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
  const { Pressable: NativePressable, Text: NativeText } = require('react-native');
  return {
    Press: ({
      children,
      onPress,
      accessibilityRole,
      accessibilityState,
      disabled,
    }: Pick<
      PressableProps,
      'children' | 'onPress' | 'accessibilityRole' | 'accessibilityState' | 'disabled'
    >) =>
      React.createElement(
        NativePressable,
        { accessibilityRole: accessibilityRole ?? 'button', accessibilityState, disabled, onPress },
        children,
      ),
    Txt: ({ children }: { children: ReactNode }) => React.createElement(NativeText, null, children),
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
        screen.queryByRole('button', { name: 'Import starten' }) ||
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
    expect(screen.getByRole('button', { name: 'Import starten' })).toBeOnTheScreen();
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
    await waitFor(() =>
      expect(screen.getByText(/Das monatliche Credit-Limit ist erreicht/u)).toBeOnTheScreen(),
    );
    expect(screen.getByText(/Verbraucht: 10\/10 diesen Monat/u)).toBeOnTheScreen();
  });

  it('validates empty and over-limit links before starting work', async () => {
    await renderImporter();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Import starten' }));
    expect(screen.getByText('Füge mindestens einen Rezeptlink ein.')).toBeOnTheScreen();

    fireEvent.changeText(
      screen.getByLabelText('Rezeptlinks'),
      Array.from({ length: 21 }, (_, index) => `https://example.test/${index}`).join('\n'),
    );
    await user.press(screen.getByRole('button', { name: 'Import starten' }));
    expect(screen.getByText('Importiere höchstens 20 Links auf einmal.')).toBeOnTheScreen();
    expect(mockImportSource).not.toHaveBeenCalled();
  });

  it('imports a recipe URL to a reviewable draft and opens it in the recipe editor', async () => {
    await renderImporter();
    fireEvent.changeText(screen.getByLabelText('Rezeptlinks'), 'https://example.test/recipe');
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Import starten' }));
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

  it('recognizes a previously imported source and opens its saved recipe', async () => {
    mockFindSavedSource.mockResolvedValue({
      recipeId: 'recipe-1',
      title: 'Linsensuppe',
      sourceUrl: 'https://example.test/recipe',
      normalizedSourceUrl: 'https://example.test/recipe',
      savedAt: 'now',
    });
    await renderImporter();
    fireEvent.changeText(screen.getByLabelText('Rezeptlinks'), 'https://example.test/recipe');
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Import starten' }));
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
    fireEvent.changeText(
      screen.getByLabelText('Rezeptlinks'),
      'https://example.test/recipe#source',
    );
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Import starten' }));
    await waitFor(() =>
      expect(screen.getByText('Quelle wurde schon importiert')).toBeOnTheScreen(),
    );
    expect(mockImportSource).not.toHaveBeenCalled();

    mockDrafts = [];
    mockImportSource.mockRejectedValueOnce(new Error('Server nicht erreichbar'));
    fireEvent.changeText(screen.getByLabelText('Rezeptlinks'), 'https://example.test/other');
    await user.press(screen.getByRole('button', { name: 'Import starten' }));
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

  it('validates text and video modes and respects the household AI entitlement', async () => {
    mockHasAI = false;
    await renderImporter();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Text' }));
    await user.press(screen.getByRole('button', { name: 'Import starten' }));
    expect(screen.getByText('Füge zuerst den Rezepttext ein.')).toBeOnTheScreen();
    fireEvent.changeText(screen.getByLabelText('Rezepttext'), 'Mehl und Wasser vermengen.');
    await user.press(screen.getByRole('button', { name: 'Import starten' }));
    expect(
      screen.getByText('Für den Textimport brauchst du das AI-Abo dieses Haushalts.'),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Video' }));
    await user.press(screen.getByRole('button', { name: 'Import starten' }));
    expect(screen.getByText('Füge zuerst einen Videolink ein.')).toBeOnTheScreen();
    fireEvent.changeText(screen.getByLabelText('Videolink'), 'https://video.test/reel');
    await user.press(screen.getByRole('button', { name: 'Import starten' }));
    expect(
      screen.getByText('Für den Videoimport brauchst du das AI-Abo dieses Haushalts.'),
    ).toBeOnTheScreen();
  });

  it('handles photo permissions, invalid image types and valid multi-page image import', async () => {
    await renderImporter();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Foto' }));
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

  it('handles PDF picker cancellation, missing assets and a successful PDF selection', async () => {
    await renderImporter();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'PDF' }));
    await user.press(screen.getByRole('button', { name: 'PDF auswählen' }));
    expect(mockPickDocument).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'application/pdf', multiple: false }),
    );
    mockPickDocument.mockResolvedValueOnce({ canceled: false, assets: [] });
    await user.press(screen.getByRole('button', { name: 'PDF auswählen' }));
    await user.press(screen.getByRole('button', { name: 'Import starten' }));
    expect(screen.getByText('Wähle zuerst ein Foto oder ein PDF aus.')).toBeOnTheScreen();

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
});
