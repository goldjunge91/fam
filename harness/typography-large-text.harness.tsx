import { File, Paths } from 'expo-file-system';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { createElement, createRef, type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  ScrollView,
  type LayoutChangeEvent,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { UnistylesRuntime } from 'react-native-unistyles';
import { beforeEach, describe, expect, it, mock, render, requireActual } from 'react-native-harness';
import { screen, userEvent } from '@react-native-harness/ui';

import { ThemeProvider, useTheme } from '@/components/theme/ThemeProvider';
import { i18n } from '@/i18n';
import type { IngredientComponentGroup, WizardStepItem } from '@/features/recipes/wizard/types';
import type { RecipeWizardStepListRef } from '@/features/recipes/wizard/recipe-wizard-step-steps';

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

const gestureHandler = requireActual<typeof import('react-native-gesture-handler')>(
  'react-native-gesture-handler',
);

// Harness 1.4.1 touch synthesis terminates iOS 26 inside the drag detector.
// Keep the native list and disable only its drag recognizer for this layout proof.
mock('react-native-gesture-handler', () => ({
  ...gestureHandler,
  GestureDetector: ({ children }: { children: ReactNode }) => children,
}));

const { View: NativeView } = requireActual<typeof import('react-native')>('react-native');
const AnimatedView = ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) =>
  createElement(NativeView, props, children);

// ReorderableList still renders a native FlatList; synchronous worklet shims
// keep its layout and imperative scrolling available in Harness.
mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    createAnimatedComponent: (component: unknown) => component,
    FlatList,
    ScrollView,
    View: AnimatedView,
  },
  Easing: {
    cubic: (value: number) => value,
    ease: (value: number) => value,
    elastic: (_factor: number) => (value: number) => value,
    in: (easing: (value: number) => number) => easing,
    inOut: (easing: (value: number) => number) => easing,
    linear: (value: number) => value,
    out: (easing: (value: number) => number) => easing,
    sin: (value: number) => value,
  },
  measure: () => null,
  runOnJS: (callback: (...args: never[]) => unknown) => callback,
  runOnUI: (callback: (...args: never[]) => unknown) => callback,
  scrollTo: () => undefined,
  useAnimatedReaction: () => undefined,
  useAnimatedRef: () => {
    const ref = useRef<(((value: unknown) => void) & { current: unknown }) | null>(null);
    if (!ref.current) {
      const callback = ((value: unknown) => {
        callback.current = value;
      }) as ((value: unknown) => void) & { current: unknown };
      callback.current = null;
      ref.current = callback;
    }
    return ref.current;
  },
  useAnimatedScrollHandler: (handler: { onScroll?: (...args: unknown[]) => unknown }) =>
    handler.onScroll ?? (() => undefined),
  useAnimatedStyle: (updater: () => object) => updater(),
  useComposedEventHandler: (handlers: unknown[]) =>
    handlers.find(
      (handler): handler is (...args: unknown[]) => unknown => typeof handler === 'function',
    ) ?? (() => undefined),
  useDerivedValue: (updater: () => unknown) => ({ value: updater() }),
  useReducedMotion: () => true,
  useSharedValue: (value: unknown) => {
    const ref = useRef({ value });
    return ref.current;
  },
  withDelay: (_delay: number, value: unknown) => value,
  withSpring: (value: unknown) => value,
  withTiming: (value: unknown) => value,
}));

const { EmailVerificationPanel } = require('@/features/auth/components/email-verification-panel') as typeof import('@/features/auth/components/email-verification-panel');
const { RecipeWizardStepSteps } = require('@/features/recipes/wizard/recipe-wizard-step-steps') as typeof import('@/features/recipes/wizard/recipe-wizard-step-steps');

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
        </ThemeProvider>
      </I18nextProvider>
    </GestureHandlerRootView>
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
  const { colors } = useTheme();
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
      collapsable={false}
      onLayout={onLayout}
      style={{ width: VIEWPORT_WIDTH, flex: 1, backgroundColor: colors.background }}>
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
  const contentSizeCategory = UnistylesRuntime.contentSizeCategory;
  const fontScale = UnistylesRuntime.fontScale;
  const screenshotArtifact = screenshot ? await persistScreenshot(state, screenshot.data) : null;

  console.warn(
    `[typography-large-text] ${JSON.stringify({
      platform: Platform.OS,
      state,
      resolvedLayoutWidth: layoutWidth,
      contentSizeCategory,
      fontScale,
      screenshotArtifact,
      screenshotBytes: screenshot?.data.length ?? null,
    })}`,
  );

  expect(screenshot).not.toBeNull();
  expect(screenshotArtifact).not.toBeNull();
  expect(layoutWidth).toBe(VIEWPORT_WIDTH);
  expect(contentSizeCategory).toBe('accessibilityLarge');
  expect(Number.isFinite(fontScale)).toBe(true);
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

    const emailScroll = scrollController.current;
    if (!emailScroll) throw new Error('Email ScrollView was not mounted');
    await emailScroll.scrollToEnd();

    const codeInput = await screen.findByTestId('email-verification-code');
    await userEvent.type(codeInput, '4729', { submitEditing: true });
    await screen.findByAccessibilityLabel(EMAIL_CODE_ERROR);
    await captureEvidence('email-validation-error', viewport, layoutWidth);

    await emailScroll.scrollToEnd();
    await userEvent.press(
      await screen.findByAccessibilityLabel('Bestätigungs-E-Mail erneut senden'),
    );
    await emailScroll.scrollToEnd();
    await userEvent.press(await screen.findByAccessibilityLabel('Jetzt prüfen'));
    await emailScroll.scrollToEnd();
    await userEvent.press(
      await screen.findByAccessibilityLabel('Andere E-Mail-Adresse verwenden'),
    );
    expect(changedEmail).toBe(1);
    await captureEvidence('email-lower-actions', viewport, layoutWidth);
  });

  it('confirms a six-digit email code through the real input and button', async () => {
    let confirmed = 0;
    const { layoutWidth, scrollController, viewport } = await renderViewport(
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
    const confirmationScroll = scrollController.current;
    if (!confirmationScroll) throw new Error('Email ScrollView was not mounted');
    await confirmationScroll.scrollToEnd();
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

    await userEvent.type(editor, '@Lin');
    const mention = await screen.findByAccessibilityLabel('Linsen · 200g');
    await captureEvidence('recipe-mention-suggestion', viewport, layoutWidth);
    await userEvent.press(mention);
    expect(changes.at(-1)?.[0]?.text).toBe('@Linsen');

    await scrollListToEnd(recipeListRef);
    await userEvent.press(await screen.findByAccessibilityLabel('+ Timer hinzufügen'));
    await waitForNativeFrame();
    await scrollListToEnd(recipeListRef);
    const timerInput = await screen.findByTestId('recipe-step-timer-input');
    await captureEvidence('recipe-timer-input', viewport, layoutWidth);
    await userEvent.type(timerInput, '12');
    await userEvent.press(await screen.findByAccessibilityLabel('Übernehmen'));
    expect(changes.at(-1)?.[0]?.timerMinutes).toBe(12);
    await scrollListToEnd(recipeListRef);
    await captureEvidence('recipe-timer-applied', viewport, layoutWidth);
    await userEvent.press(await screen.findByAccessibilityLabel('Entfernen'));
    expect(changes.at(-1)?.[0]?.timerMinutes).toBeNull();

    await userEvent.press(await screen.findByAccessibilityLabel('Zurück'));
    await userEvent.press(await screen.findByAccessibilityLabel('Weiter'));
    expect(backPressed).toBe(1);
    expect(nextPressed).toBe(1);
    await captureEvidence('recipe-back-next-actions', viewport, layoutWidth);
  });
});
