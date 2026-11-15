import { resolveKaufdaLocation } from '../../scripts/scrapers/locations';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function queuedFetcher(responses: Response[]) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    const response = responses.shift();
    if (!response) throw new Error('Unexpected request.');
    return response;
  };
  return { fetcher, calls };
}

const autocompleteResponse = {
  suggestions: [
    {
      placePrediction: {
        placeId: 'postal-code-22043',
        types: ['postal_code', 'geocode'],
      },
    },
  ],
};

const detailsResponse = {
  id: 'postal-code-22043',
  location: {
    latitude: 53.5683271,
    longitude: 10.100758599999999,
  },
  addressComponents: [
    { longText: '22043', shortText: '22043', types: ['postal_code'] },
    { longText: 'Hamburg', shortText: 'Hamburg', types: ['locality', 'political'] },
    { longText: 'Deutschland', shortText: 'DE', types: ['country', 'political'] },
  ],
};

const resolveOptions = {
  apiKey: 'test-google-places-key',
  sessionToken: 'test-session-token',
};

describe('KaufDA postal-code location resolution', () => {
  it('uses the exact German postal-code place selected by Google and verified by KaufDA', async () => {
    const { fetcher, calls } = queuedFetcher([
      jsonResponse(200, autocompleteResponse),
      jsonResponse(200, detailsResponse),
      jsonResponse(200, {
        code: '22043',
        latitude: 53.570966913,
        longitude: 10.108656178,
        lat: '53.5683271',
        lng: '10.100758599999999',
      }),
    ]);

    await expect(
      resolveKaufdaLocation('22043', { ...resolveOptions, fetcher }),
    ).resolves.toEqual({
      zipCode: '22043',
      city: 'Hamburg',
      latitude: 53.5683271,
      longitude: 10.100758599999999,
    });

    expect(calls).toHaveLength(3);
    expect(calls[0]?.url).toBe('https://places.googleapis.com/v1/places:autocomplete');
    expect(calls[0]?.init).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: expect.objectContaining({
        'X-Goog-Api-Key': 'test-google-places-key',
        'X-Goog-FieldMask':
          'suggestions.placePrediction.placeId,suggestions.placePrediction.types',
      }),
    });
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      input: '22043',
      includedPrimaryTypes: ['postal_code', 'locality', 'sublocality', 'route'],
      includedRegionCodes: ['de'],
      languageCode: 'de',
      regionCode: 'de',
      sessionToken: 'test-session-token',
    });
    expect(calls[0]?.url).not.toContain('test-google-places-key');

    const detailsUrl = new URL(calls[1]?.url ?? '');
    expect(detailsUrl.pathname).toBe('/v1/places/postal-code-22043');
    expect(detailsUrl.searchParams.get('sessionToken')).toBe('test-session-token');
    expect(calls[1]?.init).toMatchObject({
      redirect: 'error',
      headers: expect.objectContaining({
        'X-Goog-FieldMask': 'id,location,addressComponents',
      }),
    });

    const kaufdaUrl = new URL(calls[2]?.url ?? '');
    expect(kaufdaUrl.origin).toBe('https://www.kaufda.de');
    expect(kaufdaUrl.pathname).toBe('/api/localize');
    expect(kaufdaUrl.searchParams.get('lat')).toBe('53.5683271');
    expect(kaufdaUrl.searchParams.get('lng')).toBe('10.100758599999999');
    expect(calls[2]?.init?.redirect).toBe('error');
  });

  it('rejects ambiguous Google postal-code predictions', async () => {
    const { fetcher, calls } = queuedFetcher([
      jsonResponse(200, {
        suggestions: [
          ...autocompleteResponse.suggestions,
          {
            placePrediction: {
              placeId: 'another-postal-code',
              types: ['postal_code', 'geocode'],
            },
          },
        ],
      }),
    ]);

    await expect(
      resolveKaufdaLocation('22043', { ...resolveOptions, fetcher }),
    ).rejects.toThrow('exactly one postal-code place');
    expect(calls).toHaveLength(1);
  });

  it('rejects Place Details for a different postal code', async () => {
    const { fetcher, calls } = queuedFetcher([
      jsonResponse(200, autocompleteResponse),
      jsonResponse(200, {
        ...detailsResponse,
        addressComponents: detailsResponse.addressComponents.map((component) =>
          component.types.includes('postal_code')
            ? { ...component, longText: '22087', shortText: '22087' }
            : component,
        ),
      }),
    ]);

    await expect(
      resolveKaufdaLocation('22043', { ...resolveOptions, fetcher }),
    ).rejects.toThrow('postal code 22087 instead of 22043');
    expect(calls).toHaveLength(2);
  });

  it('rejects conflicting Google address components', async () => {
    const { fetcher, calls } = queuedFetcher([
      jsonResponse(200, autocompleteResponse),
      jsonResponse(200, {
        ...detailsResponse,
        addressComponents: [
          ...detailsResponse.addressComponents,
          { longText: 'Niederlande', shortText: 'NL', types: ['country', 'political'] },
        ],
      }),
    ]);

    await expect(
      resolveKaufdaLocation('22043', { ...resolveOptions, fetcher }),
    ).rejects.toThrow('exactly one country');
    expect(calls).toHaveLength(2);
  });

  it('rejects coordinates outside geographic bounds', async () => {
    const { fetcher, calls } = queuedFetcher([
      jsonResponse(200, autocompleteResponse),
      jsonResponse(200, {
        ...detailsResponse,
        location: { latitude: 91, longitude: 10.100758599999999 },
      }),
    ]);

    await expect(
      resolveKaufdaLocation('22043', { ...resolveOptions, fetcher }),
    ).rejects.toThrow('invalid coordinates');
    expect(calls).toHaveLength(2);
  });

  it('rejects coordinates that KaufDA assigns to another postal code', async () => {
    const { fetcher } = queuedFetcher([
      jsonResponse(200, autocompleteResponse),
      jsonResponse(200, detailsResponse),
      jsonResponse(200, { code: '22087' }),
    ]);

    await expect(
      resolveKaufdaLocation('22043', { ...resolveOptions, fetcher }),
    ).rejects.toThrow('KaufDA assigned the coordinates for 22043 to 22087');
  });
});
