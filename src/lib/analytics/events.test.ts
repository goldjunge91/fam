import { trackAnalyticsEvent } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/telemetry';

jest.mock('@/lib/telemetry', () => ({
  normalizeTelemetryProperties: (properties: Record<string, string | number | boolean>) =>
    Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [
        key,
        typeof value === 'boolean' ? Number(value) : value,
      ]),
    ),
  trackEvent: jest.fn(),
}));

describe('trackAnalyticsEvent', () => {
  beforeEach(() => jest.clearAllMocks());

  it('delegiert typisierte Produkt-Events an den gemeinsamen Telemetrie-Fan-out', () => {
    trackAnalyticsEvent('paywall.view.completed', {
      source: 'settings',
      offering_id: 'default',
    });

    expect(trackEvent).toHaveBeenCalledWith(
      'paywall.view.completed',
      {
        source: 'settings',
        offering_id: 'default',
      },
      'productEvents',
    );
  });

  it('normalisiert Boolean-Properties auf den gemeinsamen kleinsten Datentyp', () => {
    trackAnalyticsEvent('product.barcode_scan.completed', { found: false });

    expect(trackEvent).toHaveBeenCalledWith(
      'product.barcode_scan.completed',
      { found: 0 },
      'productEvents',
    );
  });

  it('unterstuetzt Events ohne Properties', () => {
    trackAnalyticsEvent('purchase.restore.started');

    expect(trackEvent).toHaveBeenCalledWith('purchase.restore.started', {}, 'productEvents');
  });
});
