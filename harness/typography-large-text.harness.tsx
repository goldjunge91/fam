import { File, Paths } from 'expo-file-system';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { createRef, type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, type LayoutChangeEvent, View } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';
import { beforeEach, describe, expect, it, mock, render } from 'react-native-harness';
import { screen, userEvent } from '@react-native-harness/ui';

import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { i18n } from '@/i18n';
import type { IngredientComponentGroup, WizardStepItem } from '@/features/recipes/wizard/types';
import {
  RecipeWizardStepSteps,
  type RecipeWizardStepListRef,
} from '@/features/recipes/wizard/recipe-wizard-step-steps';

mock('@/features/auth/api', () => ({
  confirmSignUpWithCode: async (_email: string, code: string) => ({
    data:
      code === '472913'
        ? { session: { user: { email_confirmed_at: '2026-11-18T00:00:00Z' } } }
        : { session: null },
    error: code === '472913' ? null : new Error('Token has expired or is invalid'),
  }),
  resendConfirmationEmail: async () => ({ error: null }),
  signIn: async () => ({ data: { session: null }, error: null }),
  signOut: async () => ({ error: null }),
}));

mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: () => ({
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => undefined } },
      }),
    },
  }),
}));

const { EmailVerificationPanel } = require('@/features/auth/components/email-verification-panel') as typeof import('@/features/auth/components/email-verification-panel');

const VIEWPORT_WIDTH = 320;
const EMAIL = 'user@example.invalid';
const EMAIL_DESCRIPTION =
  'Wir haben dir eine E-Mail geschickt. Klick den Link darin. Egal auf welchem Gerät, die App merkt das von selbst und geht weiter. Oder gib den 6-stelligen Code aus der E-Mail hier ein.';
const EMAIL_CODE_ERROR = 'Bitte die 6 Ziffern aus der E-Mail eingeben.';
const RECIPE_HINT =
  'Zutat mit @ einfügen (z. B. @Wurst50 = 50 g Wurst). Zum Umsortieren einen Schritt gedrückt halten und ziehen.';
const EDITOR_LABEL = 'Was ist in Schritt 1 zu tun? Zutat mit @ einfügen, z. B. @Wurst50';

type NativeScrollController = {
  scrollToEnd: () => Promise<void>;
};

type ScrollControllerRef = {
  current: NativeScrollController | null;
};

const initialStep: WizardStepItem = {
  id: 'step-1',
  serverId: null,
  text: '',
  localImageUris: [],
  existingImages: [],
  timerMinutes: null,
  ingredientIds: [],
};

const ingredients: IngredientComponentGroup[] = [
  {
    id: 'component-1',
    title: 'Zutaten',
    existingComponentId: null,
    items: [
      {
        id: 'ingredient-1',
        product: { barcode: 'redacted', name: 'Linsen', categoryTags: [] },
        productQuery: 'Linsen',
        quantity: '200',
        unit: 'g',
        notConvertible: false,
        existingItemId: null,
        existingProductId: null,
      },
    ],
  },
];

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
    },
  });
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}

function waitForNativeFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function Viewport({
  children,
  onLayout,
  scroll,
  scrollController,
}: {
  children: ReactNode;
  onLayout: (event: LayoutChangeEvent) => void;
  scroll?: boolean;
  scrollController: ScrollControllerRef;
}) {
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (!scroll) return;

    scrollController.current = {
      scrollToEnd: async () => {
        scrollRef.current?.scrollToEnd({ animated: false });
        await waitForNativeFrame();
      },
    };

    return () => {
      scrollController.current = null;
    };
  }, [scroll, scrollController]);

  return (
    <View
      testID="typography-large-text-viewport"
      onLayout={onLayout}
      style={{ width: VIEWPORT_WIDTH, flex: 1 }}>
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ width: VIEWPORT_WIDTH, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </View>
  );
}

async function renderViewport(children: ReactNode, scroll = false) {
  let resolveLayout!: (width: number) => void;
  const layoutReady = new Promise<number>((resolve) => {
    resolveLayout = resolve;
  });
  const scrollController: ScrollControllerRef = { current: null };

  await render(
    <Viewport
      scroll={scroll}
      scrollController={scrollController}
      onLayout={(event) => resolveLayout(event.nativeEvent.layout.width)}>
      {children}
    </Viewport>,
    { wrapper: Providers },
  );

  const viewport = await screen.findByTestId('typography-large-text-viewport');
  const layoutWidth = await layoutReady;
  return { layoutWidth, scrollController, viewport };
}

async function persistScreenshot(state: string, data: Uint8Array) {
  const file = new File(Paths.cache, 'fam-qu0f-typography', `${Platform.OS}-${state}.png`);
  file.create({ intermediates: true, overwrite: true });
  file.write(data);
  return file.uri;
}

async function captureEvidence(
  state: string,
  viewport: Awaited<ReturnType<typeof screen.findByTestId>>,
  layoutWidth: number,
) {
  const screenshot = await screen.screenshot(viewport);
  const fontScale = UnistylesRuntime.fontScale;
  const screenshotArtifact = screenshot ? await persistScreenshot(state, screenshot.data) : null;

  console.warn(
    `[typography-large-text] ${JSON.stringify({
      platform: Platform.OS,
      state,
      resolvedLayoutWidth: layoutWidth,
      fontScale,
      screenshotArtifact,
      screenshotBytes: screenshot?.data.length ?? null,
    })}`,
  );

  expect(screenshot).not.toBeNull();
  expect(screenshotArtifact).not.toBeNull();
  expect(layoutWidth).toBe(VIEWPORT_WIDTH);
  expect(fontScale).toBe(2);
}

async function scrollListToEnd(listRef: RefObject<RecipeWizardStepListRef | null>) {
  const list = listRef.current;
  if (!list) throw new Error('Recipe ReorderableList was not mounted');
  list.scrollToEnd({ animated: false });
  await waitForNativeFrame();
}

function RecipeFixture({
  listRef,
  onBack,
  onNext,
  onStepsChange,
}: {
  listRef: RefObject<RecipeWizardStepListRef | null>;
  onBack: () => void;
  onNext: () => void;
  onStepsChange: (steps: WizardStepItem[]) => void;
}) {
  const [steps, setSteps] = useState([initialStep]);

  return (
    <RecipeWizardStepSteps
      listRef={listRef}
      steps={steps}
      onStepsChange={(nextSteps) => {
        onStepsChange(nextSteps);
        setSteps(nextSteps);
      }}
      components={ingredients}
      onBack={onBack}
      onNext={onNext}
    />
  );
}

describe('large-text typography on the iOS product surfaces', () => {
  beforeEach(async () => {
    expect(Platform.OS).toBe('ios');
    await i18n.changeLanguage('de');
  });

  it('keeps email verification content and lower actions reachable', async () => {
    let changedEmail = 0;
    const { layoutWidth, scrollController, viewport } = await renderViewport(
      <EmailVerificationPanel
        email={EMAIL}
        password="redacted-password"
        onConfirmed={() => undefined}
        onChangeEmail={() => {
          changedEmail += 1;
        }}
      />,
      true,
    );

    await screen.findByAccessibilityLabel('Bestätigung ausstehend');
    await screen.findByAccessibilityLabel(EMAIL);
    await screen.findByAccessibilityLabel(EMAIL_DESCRIPTION);
    await screen.findByAccessibilityLabel('Code aus der E-Mail');
    await screen.findByAccessibilityLabel('Bestätigen');
    await captureEvidence('email-initial', viewport, layoutWidth);

    const codeInput = await screen.findByTestId('email-verification-code');
    await userEvent.type(codeInput, '4729', { skipBlur: true, submitEditing: true });
    await screen.findByAccessibilityLabel(EMAIL_CODE_ERROR);
    await captureEvidence('email-validation-error', viewport, layoutWidth);

    if (!scrollController.current) throw new Error('Email ScrollView was not mounted');
    await scrollController.current.scrollToEnd();
    const resend = await screen.findByAccessibilityLabel('Bestätigungs-E-Mail erneut senden');
    const checkNow = await screen.findByAccessibilityLabel('Jetzt prüfen');
    const changeEmail = await screen.findByAccessibilityLabel('Andere E-Mail-Adresse verwenden');
    await userEvent.press(resend);
    await userEvent.press(checkNow);
    await userEvent.press(changeEmail);
    expect(changedEmail).toBe(1);
    await captureEvidence('email-lower-actions', viewport, layoutWidth);
  });

  it('confirms a six-digit email code through the real input and button', async () => {
    let confirmed = 0;
    const { layoutWidth, viewport } = await renderViewport(
      <EmailVerificationPanel
        email={EMAIL}
        onConfirmed={() => {
          confirmed += 1;
        }}
      />,
      true,
    );

    await screen.findByAccessibilityLabel('Bestätigung ausstehend');
    await screen.findByAccessibilityLabel(EMAIL);
    await screen.findByAccessibilityLabel(EMAIL_DESCRIPTION);
    const codeInput = await screen.findByTestId('email-verification-code');
    await userEvent.type(codeInput, '472913', { skipBlur: true });
    await userEvent.press(await screen.findByAccessibilityLabel('Bestätigen'));
    expect(confirmed).toBe(1);
    await captureEvidence('email-six-digit-confirmed', viewport, layoutWidth);
  });

  it('keeps recipe mentions, timer input, and navigation reachable', async () => {
    const changes: WizardStepItem[][] = [];
    let backPressed = 0;
    let nextPressed = 0;
    const recipeListRef = createRef<RecipeWizardStepListRef>();
    const { layoutWidth, viewport } = await renderViewport(
      <RecipeFixture
        listRef={recipeListRef}
        onStepsChange={(nextSteps) => changes.push(nextSteps)}
        onBack={() => {
          backPressed += 1;
        }}
        onNext={() => {
          nextPressed += 1;
        }}
      />,
    );

    await screen.findByAccessibilityLabel('Zubereitungsschritte');
    await screen.findByAccessibilityLabel(RECIPE_HINT);
    const editor = await screen.findByAccessibilityLabel(EDITOR_LABEL);
    await captureEvidence('recipe-initial', viewport, layoutWidth);

    await userEvent.type(editor, '@Lin', { skipBlur: true });
    const mention = await screen.findByAccessibilityLabel('Linsen · 200g');
    await captureEvidence('recipe-mention-suggestion', viewport, layoutWidth);
    await userEvent.press(mention);
    expect(changes.at(-1)?.[0]?.text).toBe('@Linsen');

    await scrollListToEnd(recipeListRef);
    await userEvent.press(await screen.findByAccessibilityLabel('+ Timer hinzufügen'));
    const timerInput = await screen.findByAccessibilityLabel('Min.');
    await captureEvidence('recipe-timer-input', viewport, layoutWidth);
    await userEvent.type(timerInput, '12', { skipBlur: true });
    await userEvent.press(await screen.findByAccessibilityLabel('Übernehmen'));
    expect(changes.at(-1)?.[0]?.timerMinutes).toBe(12);
    await scrollListToEnd(recipeListRef);
    await captureEvidence('recipe-timer-applied', viewport, layoutWidth);

    await userEvent.press(await screen.findByAccessibilityLabel('Zurück'));
    await userEvent.press(await screen.findByAccessibilityLabel('Weiter'));
    expect(backPressed).toBe(1);
    expect(nextPressed).toBe(1);
    await captureEvidence('recipe-back-next-actions', viewport, layoutWidth);
  });
});
