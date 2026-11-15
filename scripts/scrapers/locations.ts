import { randomUUID } from 'node:crypto';

export type ScrapeLocation = {
  zipCode: string;
  city: string;
  latitude: number;
  longitude: number;
};

type ResolveKaufdaLocationOptions = {
  apiKey: string;
  fetcher?: typeof fetch;
  sessionToken?: string;
};

const GOOGLE_AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const GOOGLE_AUTOCOMPLETE_FIELDS =
  'suggestions.placePrediction.placeId,suggestions.placePrediction.types';
const GOOGLE_DETAILS_FIELDS = 'id,location,addressComponents';
const REQUEST_TIMEOUT_MS = 20_000;
const CITY_COMPONENT_TYPES = ['locality', 'postal_town'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Location provider returned an invalid ${field}.`);
  }
  return value.trim();
}

async function fetchJson(
  url: string | URL,
  init: RequestInit,
  fetcher: typeof fetch,
  service: string,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(url, {
      ...init,
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(`${service} request failed.`, { cause: error });
  }

  if (!response.ok) throw new Error(`${service} failed with HTTP ${response.status}.`);
  try {
    return (await response.json()) as unknown;
  } catch (error) {
    throw new Error(`${service} returned invalid JSON.`, { cause: error });
  }
}

function postalCodePlaceId(value: unknown, zipCode: string): string {
  if (!isRecord(value) || !Array.isArray(value.suggestions)) {
    throw new Error('Google Places autocomplete returned an invalid response.');
  }

  const placeIds = new Set<string>();
  for (const suggestion of value.suggestions) {
    if (!isRecord(suggestion) || !isRecord(suggestion.placePrediction)) continue;
    const prediction = suggestion.placePrediction;
    if (!Array.isArray(prediction.types) || !prediction.types.includes('postal_code')) continue;
    placeIds.add(requiredString(prediction.placeId, 'Google place ID'));
  }

  if (placeIds.size !== 1) {
    throw new Error(
      `Google Places must return exactly one postal-code place for ${zipCode}; received ${placeIds.size}.`,
    );
  }
  return [...placeIds][0] as string;
}

function matchingAddressComponents(components: unknown[], type: string): Record<string, unknown>[] {
  return components.filter(
    (component): component is Record<string, unknown> =>
      isRecord(component) && Array.isArray(component.types) && component.types.includes(type),
  );
}

function requiredAddressComponent(
  components: unknown[],
  type: string,
  label: string,
): Record<string, unknown> {
  const matches = matchingAddressComponents(components, type);
  if (matches.length !== 1) {
    throw new Error(`Google Places must return exactly one ${label}; received ${matches.length}.`);
  }
  return matches[0] as Record<string, unknown>;
}

function placeLocation(value: unknown, placeId: string, zipCode: string): ScrapeLocation {
  if (
    !isRecord(value) ||
    value.id !== placeId ||
    !isRecord(value.location) ||
    !Array.isArray(value.addressComponents)
  ) {
    throw new Error(`Google Places returned invalid details for postal code ${zipCode}.`);
  }

  const addressComponents = value.addressComponents;
  const latitude = value.location.latitude;
  const longitude = value.location.longitude;
  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error(`Google Places returned invalid coordinates for postal code ${zipCode}.`);
  }

  const postalCode = requiredAddressComponent(addressComponents, 'postal_code', 'postal code');
  const resolvedZipCode = requiredString(
    postalCode.shortText ?? postalCode.longText,
    'postal code',
  );
  if (resolvedZipCode !== zipCode) {
    throw new Error(`Google Places returned postal code ${resolvedZipCode} instead of ${zipCode}.`);
  }

  const country = requiredAddressComponent(addressComponents, 'country', 'country');
  const countryCode = requiredString(country.shortText, 'country code').toUpperCase();
  if (countryCode !== 'DE') {
    throw new Error(`Google Places returned country ${countryCode} instead of DE for ${zipCode}.`);
  }

  let cityComponent: Record<string, unknown> | undefined;
  for (const type of CITY_COMPONENT_TYPES) {
    const matches = matchingAddressComponents(addressComponents, type);
    if (matches.length > 1) {
      throw new Error(`Google Places must return at most one ${type}; received ${matches.length}.`);
    }
    if (matches[0]) {
      cityComponent = matches[0];
      break;
    }
  }
  const city = requiredString(cityComponent?.longText, 'city');

  return { zipCode, city, latitude, longitude };
}

async function verifyKaufdaPostalCode(
  location: ScrapeLocation,
  fetcher: typeof fetch,
): Promise<void> {
  const url = new URL('/api/localize', 'https://www.kaufda.de');
  url.search = new URLSearchParams({
    lat: String(location.latitude),
    lng: String(location.longitude),
  }).toString();
  const value = await fetchJson(
    url,
    { headers: { Accept: 'application/json', Referer: 'https://www.kaufda.de/' } },
    fetcher,
    'KaufDA location verification',
  );
  if (!isRecord(value))
    throw new Error('KaufDA location verification returned an invalid response.');
  const verifiedZipCode = requiredString(value.code, 'KaufDA postal code');
  if (verifiedZipCode !== location.zipCode) {
    throw new Error(
      `KaufDA assigned the coordinates for ${location.zipCode} to ${verifiedZipCode}.`,
    );
  }
}

export async function resolveKaufdaLocation(
  zipCode: string,
  options: ResolveKaufdaLocationOptions,
): Promise<ScrapeLocation> {
  if (!/^\d{5}$/.test(zipCode)) throw new Error('zipCode must contain five digits.');
  const apiKey = options.apiKey.trim();
  if (!apiKey) throw new Error('Google Places API key is required.');
  const sessionToken = options.sessionToken?.trim() || randomUUID();
  const fetcher = options.fetcher ?? fetch;

  const autocompleteValue = await fetchJson(
    GOOGLE_AUTOCOMPLETE_URL,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': GOOGLE_AUTOCOMPLETE_FIELDS,
      },
      body: JSON.stringify({
        input: zipCode,
        includedPrimaryTypes: ['postal_code', 'locality', 'sublocality', 'route'],
        includedRegionCodes: ['de'],
        languageCode: 'de',
        regionCode: 'de',
        sessionToken,
      }),
    },
    fetcher,
    'Google Places autocomplete',
  );
  const placeId = postalCodePlaceId(autocompleteValue, zipCode);

  const detailsUrl = new URL(
    `/v1/places/${encodeURIComponent(placeId)}`,
    'https://places.googleapis.com',
  );
  detailsUrl.searchParams.set('languageCode', 'de');
  detailsUrl.searchParams.set('regionCode', 'de');
  detailsUrl.searchParams.set('sessionToken', sessionToken);
  const detailsValue = await fetchJson(
    detailsUrl,
    {
      headers: {
        Accept: 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': GOOGLE_DETAILS_FIELDS,
      },
    },
    fetcher,
    'Google Place Details',
  );
  const location = placeLocation(detailsValue, placeId, zipCode);
  await verifyKaufdaPostalCode(location, fetcher);
  return location;
}
