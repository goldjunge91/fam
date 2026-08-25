import { render } from '@testing-library/react-native';
import { usePathname } from 'expo-router';
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';

import { trackAnalyticsEvent } from '@/lib/analytics/events';
import { ScreenTracker } from '@/lib/analytics/screen-tracker';
import { getPostHogClient, isPostHogConfigured } from '@/lib/posthog';

jest.mock('expo-router', () => ({
  usePathname: jest.fn(),
}));

jest.mock('@/lib/analytics/events', () => ({
  trackAnalyticsEvent: jest.fn(),
}));

jest.mock('@/lib/posthog', () => ({
  isPostHogConfigured: jest.fn(),
  getPostHogClient: jest.fn(),
}));

describe('ScreenTracker', () => {
  let appStateListener: ((state: AppStateStatus) => void) | undefined;
  const mockPostHogScreen = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    (isPostHogConfigured as jest.Mock).mockReturnValue(true);
    (getPostHogClient as jest.Mock).mockReturnValue({
      screen: mockPostHogScreen,
    });

    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => {
      if (event === 'change') {
        appStateListener = listener;
      }
      return {
        remove: jest.fn(),
      } as unknown as NativeEventSubscription;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('erfasst screen_view beim ersten Rendern mit PostHog und Aptabase', async () => {
    (usePathname as jest.Mock).mockReturnValue('/(tabs)/inventory');

    await render(<ScreenTracker />);

    expect(trackAnalyticsEvent).toHaveBeenCalledWith('screen_view', {
      screen: '/(tabs)/inventory',
    });
    expect(mockPostHogScreen).toHaveBeenCalledWith('/(tabs)/inventory', {
      $screen_name: '/(tabs)/inventory',
    });
  });

  it('erfasst screen_leave mit Dauer beim Pfadwechsel', async () => {
    (usePathname as jest.Mock).mockReturnValue('/(tabs)/inventory');
    const { rerender } = await render(<ScreenTracker />);

    // 5 Sekunden auf dem Inventar-Screen verbringen
    jest.advanceTimersByTime(5000);

    // Wechsel zur Einkaufsliste
    (usePathname as jest.Mock).mockReturnValue('/(tabs)/shopping-list');
    await rerender(<ScreenTracker />);

    expect(trackAnalyticsEvent).toHaveBeenCalledWith('screen_leave', {
      screen: '/(tabs)/inventory',
      duration_seconds: 5,
    });
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('screen_view', {
      screen: '/(tabs)/shopping-list',
    });
    expect(mockPostHogScreen).toHaveBeenCalledWith('/(tabs)/shopping-list', {
      $screen_name: '/(tabs)/shopping-list',
    });
  });

  it('erfasst screen_leave beim Wechsel in den Hintergrund und resumed bei active', async () => {
    (usePathname as jest.Mock).mockReturnValue('/(tabs)/recipes');
    await render(<ScreenTracker />);

    expect(trackAnalyticsEvent).toHaveBeenCalledWith('screen_view', {
      screen: '/(tabs)/recipes',
    });

    // 10 Sekunden vergehen
    jest.advanceTimersByTime(10000);

    // App wird in den Hintergrund geschickt
    appStateListener?.('background');

    expect(trackAnalyticsEvent).toHaveBeenCalledWith('screen_leave', {
      screen: '/(tabs)/recipes',
      duration_seconds: 10,
    });

    // 30 Sekunden im Hintergrund (darf nicht zur Screen-Dauer zaehlen)
    jest.advanceTimersByTime(30000);

    // App kehrt in den Vordergrund zurueck
    appStateListener?.('active');

    expect(trackAnalyticsEvent).toHaveBeenCalledWith('screen_view', {
      screen: '/(tabs)/recipes',
    });
  });

  it('erfasst screen_leave beim Unmount', async () => {
    (usePathname as jest.Mock).mockReturnValue('/settings');
    const { unmount } = await render(<ScreenTracker />);

    jest.advanceTimersByTime(3000);
    await unmount();

    expect(trackAnalyticsEvent).toHaveBeenCalledWith('screen_leave', {
      screen: '/settings',
      duration_seconds: 3,
    });
  });
});
