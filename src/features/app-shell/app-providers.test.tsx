import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import { AppProviders } from './app-providers';
import { AppProviders as AndroidAppProviders } from './app-providers.android';

type ShotsFlag = { enabled?: boolean } | null;

const mockLoadShotsFlag = jest.fn<Promise<ShotsFlag>, []>();
const mockSetBugBubbleActive = jest.fn();
const mockBugBubble = jest.fn(() => null);
const mockFeatureFlags: Record<string, boolean> = {};
const mockUseFeatureFlag = jest.fn((name: string) => mockFeatureFlags[name] ?? false);
const mockSession: { user: { id: string; email: string } } | null = {
  user: { id: 'user-1', email: 'marco@example.test' },
};
let mockBugBubbleAllowed = true;
let mockThemeMode: 'light' | 'dark' = 'light';

jest.mock('@lokal-dev/react-native-bugbubble', () => ({ BugBubble: () => mockBugBubble() }));
jest.mock('@tanstack/react-query', () => ({
  QueryClientProvider: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('expo-router', () => ({
  DarkTheme: { dark: true },
  DefaultTheme: { dark: false },
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardProvider: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('@/components/celebration/celebration-host', () => ({ CelebrationHost: () => null }));
jest.mock('@/components/icons/animated-icon', () => ({ AnimatedSplashOverlay: () => null }));
jest.mock('@/components/theme/index', () => ({ space: { xxxxl: 32 } }));
jest.mock('@/components/theme/ThemeProvider', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
  useTheme: () => ({ mode: mockThemeMode }),
}));
jest.mock('@/components/ui/snackbar', () => ({
  SnackbarProvider: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('@/constants/ui', () => ({
  Surface: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('@/features/app-shell/account-provider-gate', () => ({
  AccountProviderGate: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('@/features/app-shell/posthog-identity-sync', () => ({
  PostHogIdentitySync: () => null,
}));
jest.mock('@/features/auth/session-provider', () => ({
  SessionProvider: ({ children }: { children: ReactNode }) => children,
  useSession: () => ({ session: mockSession }),
}));
jest.mock('@/features/navigation/navigation-chrome-provider', () => ({
  NavigationChromeProvider: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('@/features/navigation/profile-sheet', () => ({ ProfileSheet: () => null }));
jest.mock('@/lib/analytics', () => ({ ScreenTracker: () => null }));
jest.mock('@/lib/analytics/bug-bubble', () => ({
  isBugBubbleEnabledForUser: () => mockBugBubbleAllowed,
  setBugBubbleActive: (...args: unknown[]) => mockSetBugBubbleActive(...args),
}));
jest.mock('@/lib/data/query-client', () => ({ queryClient: {} }));
jest.mock('@/lib/devtools/screenshots', () => ({
  loadShotsFlag: () => mockLoadShotsFlag(),
}));
jest.mock('@/lib/observability/providers/posthog', () => ({
  PostHogAppProvider: ({ children }: { children: ReactNode }) => children,
  useFeatureFlag: (name: string) => mockUseFeatureFlag(name),
}));
jest.mock('@/lib/observability/providers/sentry', () => ({
  Sentry: {
    ErrorBoundary: ({ children }: { children: ReactNode }) => children,
  },
}));
jest.mock('@/lib/telemetry', () => ({ reportCapturedError: jest.fn() }));
jest.mock('./crash-fallback', () => ({ CrashFallback: () => null }));
jest.mock('./update-experience', () => ({ UpdateExperience: () => null }));

describe('AppProviders', () => {
  beforeEach(() => {
    mockLoadShotsFlag.mockReset().mockResolvedValue(null);
    mockSetBugBubbleActive.mockClear();
    mockBugBubble.mockClear();
    mockUseFeatureFlag.mockClear();
    mockFeatureFlags['bug-bubble'] = false;
    mockFeatureFlags.bugbubble = false;
    mockBugBubbleAllowed = true;
    mockThemeMode = 'light';
  });

  it.each([
    ['shared', AppProviders],
    ['Android', AndroidAppProviders],
  ])(
    'mounts the %s provider tree and activates the configured debug overlay',
    async (_name, Providers) => {
      await render(
        <Providers>
          <Text>App content</Text>
        </Providers>,
      );

      expect(screen.getByText('App content')).toBeOnTheScreen();
      expect(mockLoadShotsFlag).toHaveBeenCalledTimes(1);
      expect(mockUseFeatureFlag).toHaveBeenCalledTimes(2);
      expect(mockSetBugBubbleActive).toHaveBeenLastCalledWith(true);
      expect(mockBugBubble).toHaveBeenCalledTimes(1);
    },
  );

  it('hides the overlay while screenshot mode is enabled', async () => {
    mockLoadShotsFlag.mockResolvedValue({ enabled: true });
    mockFeatureFlags.bugbubble = true;

    await render(
      <AppProviders>
        <Text>Screenshot content</Text>
      </AppProviders>,
    );

    expect(screen.getByText('Screenshot content')).toBeOnTheScreen();
    expect(mockSetBugBubbleActive).toHaveBeenLastCalledWith(false);
  });

  it('keeps the overlay hidden when the user is not eligible', async () => {
    mockBugBubbleAllowed = false;
    mockThemeMode = 'dark';

    await render(
      <AppProviders>
        <Text>Dark content</Text>
      </AppProviders>,
    );

    expect(screen.getByText('Dark content')).toBeOnTheScreen();
    expect(mockSetBugBubbleActive).toHaveBeenLastCalledWith(false);
    expect(mockBugBubble).not.toHaveBeenCalled();
  });
});
