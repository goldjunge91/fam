import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { LiveOfferBrochureSource } from './live-offers';

const location = { zipCode: '12345', latitude: 50, longitude: 10 };
type FetchMock = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const fetchMock = jest.fn<FetchMock>();

function jsonResponse(value: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => value,
  } as unknown as Response;
}

describe('Live-Angebotsquelle', () => {
  beforeEach(() => {
    if (!AbortSignal.timeout) {
      Object.defineProperty(AbortSignal, 'timeout', {
        configurable: true,
        value: () => new AbortController().signal,
      });
    }
    Object.defineProperty(global, 'fetch', {
      configurable: true,
      writable: true,
      value: fetchMock,
    });
  });

  afterEach(() => {
    fetchMock.mockReset();
    jest.restoreAllMocks();
    delete process.env.BRING_AUTH_TOKEN;
    delete process.env.BRING_API_KEY;
    delete process.env.BRING_USER_UUID;
  });

  it('liefert Diagnosen für synthetische Detailantworten und bewahrt Rohdaten', async () => {
    process.env.BRING_AUTH_TOKEN = 'token';
    process.env.BRING_API_KEY = 'key';
    process.env.BRING_USER_UUID = 'user';

    fetchMock.mockImplementation(async (input) => {
      if (String(input).includes('/brochures/')) {
        return jsonResponse({
          pages: [
            { page: 1, image: 'https://example.test/1.jpg' },
            { page: 3, image: null },
          ],
        });
      }
      return jsonResponse({
        offers: [
          {
            brn: 'brochure-1',
            company: { title: 'ALDI Nord' },
            activeFrom: 'source-date-is-invalid',
            activeTo: '2026-09-01T00:00:00Z',
          },
        ],
      });
    });

    const report = await new LiveOfferBrochureSource().fetchBrochuresForLocationWithDiagnostics(
      location,
    );

    expect(report.status).toBe('incomplete');
    expect(report.results).toHaveLength(1);
    expect(report.results[0].brochures[0].validFrom).toBe('source-date-is-invalid');
    expect(report.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'offers-list-succeeded',
        'brochure-found',
        'missing-image-url',
        'page-number-gap',
        'invalid-valid-from',
      ]),
    );
    expect(report.diagnostics.find(({ code }) => code === 'invalid-valid-from')?.rawValue).toBe(
      'source-date-is-invalid',
    );
  });

  it('unterscheidet einen nicht gefundenen Händler von einer Quellenstörung', async () => {
    process.env.BRING_AUTH_TOKEN = 'token';
    process.env.BRING_API_KEY = 'key';
    process.env.BRING_USER_UUID = 'user';

    fetchMock.mockResolvedValue(
      jsonResponse({ offers: [{ brn: 'b1', company: { title: 'ALDI Nord' } }] }),
    );

    const report = await new LiveOfferBrochureSource({
      storeNameIncludes: 'Lidl',
    }).fetchBrochuresForLocationWithDiagnostics(location);

    expect(report.status).toBe('not-found');
    expect(report.results).toEqual([]);
    expect(report.diagnostics.find(({ code }) => code === 'store-not-found')?.rawValue).toBe(
      'Lidl',
    );
    expect(report.diagnostics.some(({ code }) => code === 'detail-fetch-failed')).toBe(false);
  });

  it('behält einen fehlgeschlagenen Detailabruf als unvollständigen Befund', async () => {
    process.env.BRING_AUTH_TOKEN = 'token';
    process.env.BRING_API_KEY = 'key';
    process.env.BRING_USER_UUID = 'user';

    fetchMock.mockImplementation(async (input) => {
      if (String(input).includes('/brochures/')) return jsonResponse(null, 404);
      return jsonResponse({ offers: [{ brn: 'b1', company: { title: 'ALDI Nord' } }] });
    });

    const report = await new LiveOfferBrochureSource().fetchBrochuresForLocationWithDiagnostics(
      location,
    );

    expect(report.status).toBe('incomplete');
    expect(report.results).toEqual([]);
    expect(report.diagnostics.find(({ code }) => code === 'detail-fetch-failed')?.brochureId).toBe(
      'b1',
    );
  });
});
