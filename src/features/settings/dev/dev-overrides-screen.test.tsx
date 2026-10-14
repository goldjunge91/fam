import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { analyticsToggles } from './analytics-controls';
import { DevOverridesScreen } from './dev-overrides-screen';

let mockHasAccess = true;
let mockSession: { user?: { id: string } } | null = { user: { id: 'user-1' } };
let mockActiveHousehold: { id: string } | null = { id: 'household-1' };
let mockPremiumOverride: boolean | null = null;
let mockAiOverride: boolean | null = null;
let mockAdsOverride: boolean | null = null;
let mockAdsEnabled = false;
let mockTestFeatureFlag = false;
let mockAnalyticsSettings = {
  enabled: true,
  providers: { aptabase: false, posthog: true },
  channels: { productEvents: true, errorReports: true, diagnostics: true },
  features: {
    onboarding: true,
    household: true,
    inventory: true,
    shoppingList: true,
    recipes: true,
    mealPlanner: true,
    productSearch: true,
    premium: true,
    sync: true,
  },
};
let mockAnalyticsOverrides: Record<string, unknown> = {};

const mockQueryClient = {};
const mockRefreshPremium = jest.fn();
const mockSetPremiumOverride = jest.fn((value: boolean | null) => {
  mockPremiumOverride = value;
});
const mockSetAiOverride = jest.fn((value: boolean | null) => {
  mockAiOverride = value;
});
const mockSetAdsOverride = jest.fn((value: boolean | null) => {
  mockAdsOverride = value;
  mockAdsEnabled = value ?? false;
});
const mockInitMobileAds = jest.fn();
const mockDevResetHouseholdPremium = jest.fn();
const mockInitAptabase = jest.fn();
const mockDisposeAptabase = jest.fn();
const mockInitPostHog = jest.fn();
const mockPostHogClient = { optIn: jest.fn(), optOut: jest.fn() };
const mockResetAnalyticsOverrides = jest.fn(() => {
  mockAnalyticsOverrides = {};
  mockAnalyticsSettings = {
    enabled: true,
    providers: { aptabase: false, posthog: true },
    channels: { productEvents: true, errorReports: true, diagnostics: true },
    features: {
      onboarding: true,
      household: true,
      inventory: true,
      shoppingList: true,
      recipes: true,
      mealPlanner: true,
      productSearch: true,
      premium: true,
      sync: true,
    },
  };
});
const mockSetAnalyticsOverride = jest.fn((path: string, value: boolean | null) => {
  if (value === null) {
    delete mockAnalyticsOverrides[path];
  } else {
    mockAnalyticsOverrides[path] = value;
  }

  if (path === 'enabled') {
    if (value !== null) mockAnalyticsSettings.enabled = value;
  } else {
    const [section, key] = path.split('.');
    if (section === 'providers' && key in mockAnalyticsSettings.providers) {
      if (value !== null) mockAnalyticsSettings.providers[key as 'aptabase' | 'posthog'] = value;
    } else if (section === 'channels' && key in mockAnalyticsSettings.channels) {
      if (value !== null) {
        mockAnalyticsSettings.channels[key as 'productEvents' | 'errorReports' | 'diagnostics'] =
          value;
      }
    } else if (section === 'features' && key in mockAnalyticsSettings.features) {
      if (value !== null) {
        mockAnalyticsSettings.features[key as keyof typeof mockAnalyticsSettings.features] = value;
      }
    }
  }
});

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockQueryClient,
}));

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Redirect: ({ href }: { href: string }) => React.createElement(Text, null, `Redirect: ${href}`),
  };
});

jest.mock('@/components/layout/screen', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return {
    Screen: ({ title, children }: { title: string; children: React.ReactNode }) =>
      React.createElement(View, null, React.createElement(Text, null, title), children),
  };
});

jest.mock('@/components/ui/content-card', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return {
    ContentCard: ({ title, children }: { title?: string; children: React.ReactNode }) =>
      React.createElement(
        View,
        null,
        title ? React.createElement(Text, null, title) : null,
        children,
      ),
  };
});

jest.mock('@/constants/ui', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({
      title,
      accessibilityLabel,
      onPress,
      loading,
    }: {
      title: string;
      accessibilityLabel?: string;
      onPress: () => void | Promise<void>;
      loading?: boolean;
    }) =>
      React.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          accessibilityLabel,
          accessibilityState: { busy: loading },
          onPress: () => {
            void onPress();
          },
        },
        React.createElement(Text, null, title),
      ),
    Txt: ({ children }: { children: React.ReactNode }) => React.createElement(Text, null, children),
  };
});

jest.mock('@/features/ads', () => ({
  initMobileAds: (...args: unknown[]) => mockInitMobileAds(...args),
  useAdsEnabled: () => mockAdsEnabled,
  useAdsOverrideStore: (selector: (state: unknown) => unknown) =>
    selector({ override: mockAdsOverride, setOverride: mockSetAdsOverride }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: mockSession }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHousehold: mockActiveHousehold }),
}));

jest.mock('@/features/premium/dev-reset-premium', () => ({
  devResetHouseholdPremium: (...args: unknown[]) => mockDevResetHouseholdPremium(...args),
}));

jest.mock('@/features/premium/force-premium-override', () => ({
  useForcePremiumOverrideStore: (selector: (state: unknown) => unknown) =>
    selector({ override: mockPremiumOverride, setOverride: mockSetPremiumOverride }),
  useForceAiOverrideStore: (selector: (state: unknown) => unknown) =>
    selector({ override: mockAiOverride, setOverride: mockSetAiOverride }),
}));

jest.mock('@/features/premium/premium-provider', () => ({
  usePremium: () => ({ refresh: mockRefreshPremium }),
}));

jest.mock('@/features/settings/dev/feature-flag-controls', () => ({
  FeatureFlagControls: () => null,
}));

jest.mock('@/features/settings/dev/language-override-control', () => ({
  LanguageOverrideControl: () => null,
}));

jest.mock('@/features/settings/dev/tracking-method-controls', () => ({
  TrackingMethodControls: () => null,
}));

jest.mock('@/hooks/use-dev-tools-access', () => ({
  useDevToolsAccess: () => mockHasAccess,
}));

jest.mock('@/lib/analytics/aptabase', () => ({
  disposeAptabase: (...args: unknown[]) => mockDisposeAptabase(...args),
  initAptabase: (...args: unknown[]) => mockInitAptabase(...args),
}));

jest.mock('@/constants/analytics', () => ({
  getAnalyticsSettings: () => mockAnalyticsSettings,
  useAnalyticsSettingsStore: (selector: (state: unknown) => unknown) =>
    selector({
      overrides: mockAnalyticsOverrides,
      setOverride: mockSetAnalyticsOverride,
      resetOverrides: mockResetAnalyticsOverrides,
    }),
}));

jest.mock('@/lib/config/env', () => ({ env: { forcePremium: false, adsEnabled: false } }));

jest.mock('@/lib/observability/providers/posthog', () => ({
  getPostHogClient: () => mockPostHogClient,
  initPostHog: (...args: unknown[]) => mockInitPostHog(...args),
  useFeatureFlag: () => mockTestFeatureFlag,
}));

jest.mock('./dev-screen-shared', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    devStyles: { actionStack: {}, devRow: {} },
    Zeile: ({ label, wert }: { label: string; wert: string }) =>
      React.createElement(Text, null, `${label}: ${wert}`),
  };
});

function defaultAnalyticsSettings() {
  return {
    enabled: true,
    providers: { aptabase: false, posthog: true },
    channels: { productEvents: true, errorReports: true, diagnostics: true },
    features: {
      onboarding: true,
      household: true,
      inventory: true,
      shoppingList: true,
      recipes: true,
      mealPlanner: true,
      productSearch: true,
      premium: true,
      sync: true,
    },
  };
}

describe('DevOverridesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasAccess = true;
    mockSession = { user: { id: 'user-1' } };
    mockActiveHousehold = { id: 'household-1' };
    mockPremiumOverride = null;
    mockAiOverride = null;
    mockAdsOverride = null;
    mockAdsEnabled = false;
    mockTestFeatureFlag = false;
    mockAnalyticsSettings = defaultAnalyticsSettings();
    mockAnalyticsOverrides = {};
    mockDevResetHouseholdPremium.mockResolvedValue(undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('leitet Personen ohne Entwicklerzugriff zurück', async () => {
    mockHasAccess = false;
    await render(<DevOverridesScreen />);

    expect(screen.getByText('Redirect: /settings')).toBeOnTheScreen();
  });

  it('meldet fehlenden Haushalt und setzt Plus und KI für den aktiven Haushalt zurück', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    mockActiveHousehold = null;
    const view = await render(<DevOverridesScreen />);

    await user.press(
      screen.getByRole('button', { name: 'Plus und KI für aktuellen Haushalt zurücksetzen' }),
    );
    expect(alert).toHaveBeenCalledWith(
      'Kein aktiver Haushalt',
      'Es wurde kein aktiver Haushalt gefunden.',
    );
    expect(mockDevResetHouseholdPremium).not.toHaveBeenCalled();

    mockActiveHousehold = { id: 'household-2' };
    mockSession = null;
    await view.rerender(<DevOverridesScreen />);
    await user.press(
      screen.getByRole('button', { name: 'Plus und KI für aktuellen Haushalt zurücksetzen' }),
    );

    await waitFor(() =>
      expect(mockDevResetHouseholdPremium).toHaveBeenCalledWith({
        householdId: 'household-2',
        userId: undefined,
        queryClient: mockQueryClient,
      }),
    );
    expect(mockRefreshPremium).toHaveBeenCalled();
    expect(alert).toHaveBeenLastCalledWith(
      'Erfolgreich',
      'Plus und KI wurden für diesen Haushalt zurückgesetzt.',
    );
  });

  it('zeigt Fehler beim Zurücksetzen des Haushalts verständlich an', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    mockDevResetHouseholdPremium.mockRejectedValue(new Error('server unavailable'));
    await render(<DevOverridesScreen />);

    await user.press(
      screen.getByRole('button', { name: 'Plus und KI für aktuellen Haushalt zurücksetzen' }),
    );

    await waitFor(() =>
      expect(alert).toHaveBeenLastCalledWith('Fehlgeschlagen', 'server unavailable'),
    );
  });

  it('schaltet Premium-, KI- und Werbe-Overrides samt Reset-Aktionen um', async () => {
    const user = userEvent.setup();
    const view = await render(<DevOverridesScreen />);

    await user.press(screen.getByRole('button', { name: 'Plus-Override einschalten' }));
    expect(mockSetPremiumOverride).toHaveBeenCalledWith(true);
    await view.rerender(<DevOverridesScreen />);
    await user.press(screen.getByRole('button', { name: /Plus-Override zurücksetzen/ }));
    expect(mockSetPremiumOverride).toHaveBeenLastCalledWith(null);

    await user.press(screen.getByRole('button', { name: 'KI-Override einschalten' }));
    expect(mockSetAiOverride).toHaveBeenCalledWith(true);
    await view.rerender(<DevOverridesScreen />);
    await user.press(screen.getByRole('button', { name: 'KI-Override zurücksetzen' }));
    expect(mockSetAiOverride).toHaveBeenLastCalledWith(null);

    await user.press(screen.getByRole('button', { name: 'Werbung einschalten' }));
    expect(mockSetAdsOverride).toHaveBeenCalledWith(true);
    expect(mockInitMobileAds).toHaveBeenCalled();
    await view.rerender(<DevOverridesScreen />);
    await user.press(screen.getByRole('button', { name: 'Werbung ausschalten' }));
    expect(mockSetAdsOverride).toHaveBeenLastCalledWith(false);
    await view.rerender(<DevOverridesScreen />);
    await user.press(screen.getByRole('button', { name: /Override zurücksetzen/ }));
    expect(mockSetAdsOverride).toHaveBeenLastCalledWith(null);
  });

  it('zeigt aktivierte und deaktivierte Remote-Feature-Flags', async () => {
    const view = await render(<DevOverridesScreen />);
    expect(screen.getByText('Flag „test-feature“: aus')).toBeOnTheScreen();

    mockTestFeatureFlag = true;
    await view.rerender(<DevOverridesScreen />);
    expect(screen.getByText('Flag „test-feature“: an')).toBeOnTheScreen();
  });

  it('schaltet alle Analytics-Optionen um und setzt sie über die Provider-APIs zurück', async () => {
    const user = userEvent.setup();
    const view = await render(<DevOverridesScreen />);

    for (const toggle of [...analyticsToggles.slice(1), analyticsToggles[0]]) {
      const enabled = toggle.getValue(mockAnalyticsSettings);
      await user.press(
        screen.getByRole('button', {
          name: `${toggle.label} ${enabled ? 'ausschalten' : 'einschalten'}`,
        }),
      );
    }

    expect(mockSetAnalyticsOverride).toHaveBeenCalledTimes(analyticsToggles.length);
    expect(mockInitPostHog).toHaveBeenCalled();
    expect(mockPostHogClient.optIn).toHaveBeenCalled();
    expect(mockPostHogClient.optOut).toHaveBeenCalled();
    expect(mockInitAptabase).toHaveBeenCalled();
    expect(mockDisposeAptabase).toHaveBeenCalled();

    await view.rerender(<DevOverridesScreen />);
    await user.press(screen.getByRole('button', { name: 'Analytics-Overrides zurücksetzen' }));

    expect(mockResetAnalyticsOverrides).toHaveBeenCalled();
    expect(mockInitPostHog).toHaveBeenCalledTimes(2);
    expect(mockPostHogClient.optIn).toHaveBeenCalledTimes(2);
  });
});
