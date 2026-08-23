const mockInvoke = jest.fn().mockResolvedValue({ data: null, error: null });
const mockGetSupabase = jest.fn(() => ({
  functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
}));

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => mockGetSupabase(),
}));

import { triggerOffEnrichment } from './trigger-off-enrichment';

describe('triggerOffEnrichment', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
    mockGetSupabase.mockClear();
  });

  it('ruft enrich-off-product ausschließlich mit der EAN auf', () => {
    triggerOffEnrichment('4008400401027');

    expect(mockInvoke).toHaveBeenCalledWith('enrich-off-product', {
      body: { ean: '4008400401027' },
    });
  });

  it('wirft nie, selbst wenn der Aufruf fehlschlägt (fire-and-forget)', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('offline'));

    expect(() => triggerOffEnrichment('4008400401027')).not.toThrow();
    // Der abgelehnten Promise Zeit geben, damit ein ungefangener Reject den Test träfe.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it('wirft nie, wenn getSupabase() selbst synchron wirft (z.B. fehlende Env-Variable)', () => {
    mockGetSupabase.mockImplementationOnce(() => {
      throw new Error('MissingEnvError: EXPO_PUBLIC_SUPABASE_URL fehlt');
    });

    expect(() => triggerOffEnrichment('4008400401027')).not.toThrow();
  });
});
