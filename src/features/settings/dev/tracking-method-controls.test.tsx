import { render, screen, userEvent } from '@testing-library/react-native';

import { i18n } from '@/i18n';
import { TrackingMethodControls } from './tracking-method-controls';

let mockOverrides: Record<string, boolean> = {};
let mockFlags: Record<string, boolean | string> | undefined;
const mockSetOverride = jest.fn();
const mockResetOverrides = jest.fn();

jest.mock('@/constants/dev-settings', () => ({
  useDevSettingsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      trackingMethodOverrides: mockOverrides,
      setTrackingMethodOverride: mockSetOverride,
      resetTrackingMethodOverrides: mockResetOverrides,
    }),
}));

jest.mock('@/lib/observability/providers/posthog', () => ({
  useFeatureFlags: () => mockFlags,
}));

describe('TrackingMethodControls', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
    mockOverrides = {};
    mockFlags = {
      'tracking-method-fasting': false,
      'low-carb-tracking': true,
      'tracking-method-keto': false,
      'workout-log': true,
      'tracking-method-cgm': false,
      'tracking-method-volumetrics': true,
    };
    mockSetOverride.mockClear();
    mockResetOverrides.mockClear();
  });

  it('shows enabled and disabled remote methods and applies a local override', async () => {
    const user = userEvent.setup();
    await render(<TrackingMethodControls />);

    expect(
      screen.getByRole('button', {
        name: `${i18n.t('profile.tracking.methods.standard.label')} ${i18n.t('dev.featureFlags.turnOff')}`,
      }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: `${i18n.t('profile.tracking.methods.fasting.label')} ${i18n.t('dev.featureFlags.turnOn')}`,
      }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: `${i18n.t('profile.tracking.methods.lowCarb.label')} ${i18n.t('dev.featureFlags.turnOff')}`,
      }),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: i18n.t('dev.tracking.reset') }),
    ).not.toBeOnTheScreen();

    await user.press(
      screen.getByRole('button', {
        name: `${i18n.t('profile.tracking.methods.fasting.label')} ${i18n.t('dev.featureFlags.turnOn')}`,
      }),
    );

    expect(mockSetOverride).toHaveBeenCalledWith('fasting', true);
  });

  it('allows turning on a method that is off remotely and resets stored overrides', async () => {
    mockOverrides = { fasting: true };
    mockFlags = { 'tracking-method-fasting': false };
    const user = userEvent.setup();
    await render(<TrackingMethodControls />);

    await user.press(
      screen.getByRole('button', {
        name: `${i18n.t('profile.tracking.methods.fasting.label')} ${i18n.t('dev.featureFlags.turnOff')}`,
      }),
    );
    expect(mockSetOverride).toHaveBeenCalledWith('fasting', false);

    await user.press(screen.getByRole('button', { name: i18n.t('dev.tracking.reset') }));
    expect(mockResetOverrides).toHaveBeenCalledTimes(1);
  });
});
