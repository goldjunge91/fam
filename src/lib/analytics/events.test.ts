import { trackAptabaseEvent } from '@/lib/analytics/aptabase';
import { trackAnalyticsEvent } from '@/lib/analytics/events';
import { getPostHogClient, isPostHogConfigured } from '@/lib/posthog';

jest.mock('@/lib/analytics/aptabase', () => ({
  trackAptabaseEvent: jest.fn(),
}));

jest.mock('@/lib/posthog', () => ({
  isPostHogConfigured: jest.fn(),
  getPostHogClient: jest.fn(),
}));

describe('trackAnalyticsEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('leitet Event an Aptabase und PostHog weiter, wenn beide konfiguriert sind', () => {
    const mockCapture = jest.fn();
    (isPostHogConfigured as jest.Mock).mockReturnValue(true);
    (getPostHogClient as jest.Mock).mockReturnValue({ capture: mockCapture });

    trackAnalyticsEvent('paywall_viewed', { source: 'settings', offering_id: 'default' });

    expect(trackAptabaseEvent).toHaveBeenCalledWith('paywall_viewed', {
      source: 'settings',
      offering_id: 'default',
    });
    expect(mockCapture).toHaveBeenCalledWith('paywall_viewed', {
      source: 'settings',
      offering_id: 'default',
    });
  });

  it('funktioniert ohne PostHog, wenn PostHog nicht konfiguriert ist', () => {
    (isPostHogConfigured as jest.Mock).mockReturnValue(false);

    trackAnalyticsEvent('purchase_started', { package_id: 'fam_premium_monthly' });

    expect(trackAptabaseEvent).toHaveBeenCalledWith('purchase_started', {
      package_id: 'fam_premium_monthly',
    });
  });

  it('faengt Fehler in Aptabase und PostHog lautlos ab', () => {
    (trackAptabaseEvent as jest.Mock).mockImplementation(() => {
      throw new Error('Aptabase error');
    });
    (isPostHogConfigured as jest.Mock).mockReturnValue(true);
    (getPostHogClient as jest.Mock).mockReturnValue({
      capture: jest.fn().mockImplementation(() => {
        throw new Error('PostHog error');
      }),
    });

    expect(() => {
      trackAnalyticsEvent('restore_purchases_clicked');
    }).not.toThrow();
  });
});
