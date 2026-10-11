import { render, screen, userEvent } from '@testing-library/react-native';
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
  beforeEach(() => {
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

    expect(screen.getByRole('button', { name: 'Klassisch (CICO) ausschalten' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Intervallfasten einschalten' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Low-Carb ausschalten' })).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: 'Tracking-Methoden-Overrides zurücksetzen' }),
    ).not.toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Intervallfasten einschalten' }));

    expect(mockSetOverride).toHaveBeenCalledWith('fasting', true);
  });

  it('allows turning on a method that is off remotely and resets stored overrides', async () => {
    mockOverrides = { fasting: true };
    mockFlags = { 'tracking-method-fasting': false };
    const user = userEvent.setup();
    await render(<TrackingMethodControls />);

    await user.press(screen.getByRole('button', { name: 'Intervallfasten ausschalten' }));
    expect(mockSetOverride).toHaveBeenCalledWith('fasting', false);

    await user.press(
      screen.getByRole('button', { name: 'Tracking-Methoden-Overrides zurücksetzen' }),
    );
    expect(mockResetOverrides).toHaveBeenCalledTimes(1);
  });
});
