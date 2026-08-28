import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  BrochureLocation,
  BrochureSource,
  CrawlerBrochure,
  CrawlerHotspot,
  CrawlerPage,
  CrawlerStore,
  ScraperResult,
} from '../types';

type LiveTokenConfig = {
  authToken: string;
  apiKey: string;
  userUuid: string;
};

function getLiveTokens(): LiveTokenConfig | null {
  let authToken = process.env.BRING_AUTH_TOKEN?.trim();
  let apiKey = process.env.BRING_API_KEY?.trim();
  let userUuid = process.env.BRING_USER_UUID?.trim();

  if (!authToken || !apiKey || !userUuid) {
    // Versuche aus tokens_backup.env zu laden
    const candidatePaths = [
      join(process.cwd(), 'tokens_backup.env'),
      join(import.meta.dirname, '..', 'tokens_backup.env'),
      join(import.meta.dirname, '..', '..', '..', 'tokens_backup.env'),
      join(import.meta.dirname, '..', '..', 'brochure-viewer', 'tokens_backup.env'),
    ];

    for (const p of candidatePaths) {
      if (existsSync(p)) {
        try {
          const content = readFileSync(p, 'utf8');
          for (const line of content.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const match = trimmed.match(/^([^=]+)=(.*)$/);
            if (match) {
              const key = match[1].trim();
              const val = match[2].trim().replace(/^["']|["']$/g, '');
              if (key === 'BRING_AUTH_TOKEN' && !authToken) authToken = val;
              if (key === 'BRING_API_KEY' && !apiKey) apiKey = val;
              if (key === 'BRING_USER_UUID' && !userUuid) userUuid = val;
            }
          }
        } catch {
          // Ignorieren
        }
      }
    }
  }

  if (!authToken || !apiKey || !userUuid) {
    return null;
  }

  return {
    authToken: authToken.replace(/^Bearer\s+/i, ''),
    apiKey,
    userUuid,
  };
}

function liveHeaders(config: LiveTokenConfig): HeadersInit {
  return {
    Authorization: `Bearer ${config.authToken}`,
    'X-BRING-API-KEY': config.apiKey,
    'X-BRING-CLIENT': 'iOS',
    'X-BRING-COUNTRY': 'DE',
    'X-BRING-VERSION': '4.110.0',
    'X-BRING-USER-UUID': config.userUuid,
    'Accept-Language': 'de-DE',
    Accept: 'application/json',
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry(url: string, headers: HeadersInit): Promise<unknown> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
      if (response.ok) return await response.json();

      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === 3) {
        throw new Error(`API Status ${response.status} für ${new URL(url).pathname}`);
      }
      const retryAfter = Number(response.headers.get('retry-after'));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000;
      await wait(Math.min(delay, 30000));
    } catch (err: unknown) {
      if (attempt === 3) throw err;
      await wait(2 ** attempt * 1000);
    }
  }
  throw new Error('API konnte nicht erreicht werden.');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim()
    ? value.replace(/\0/g, '').replace(/\\u0000/g, '').trim()
    : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(
      value
        .replace(/[^\d,.-]/g, '')
        .replace(/\.(?=\d{3}(?:\D|$))/g, '')
        .replace(',', '.')
        .trim(),
    );
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function moneyToCents(value: unknown): number | null {
  const direct = asNumber(value);
  if (direct !== null) {
    // Bring liefert Preise je nach Endpoint als Eurobetrag (1.29) oder bereits
    // in Cent (129). Beide Formen werden intern einheitlich als Cent gespeichert.
    return Number.isInteger(direct) && Math.abs(direct) >= 100
      ? direct
      : Math.round(direct * 100);
  }

  const money = asRecord(value);
  if (!money) return null;

  const cents = asNumber(money.cents) ?? asNumber(money.amountCents) ?? asNumber(money.valueCents);
  if (cents !== null) return Math.round(cents);

  return moneyToCents(money.amount ?? money.value ?? money.price);
}

function pricesFromLabel(label: string | null): { priceCents?: number; oldPriceCents?: number } {
  if (!label) return {};

  const prices = [...label.matchAll(/\b(\d+(?:[.,]\d{1,2})?)(?=\s*(?:€|\*?\s+statt|$))/g)]
    .map((match) => moneyToCents(match[1]))
    .filter((price): price is number => price !== null);

  return {
    priceCents: prices[0],
    oldPriceCents: prices[1],
  };
}

function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    const s = asString(v);
    if (s) return s;
  }
  return null;
}

function imageUrl(value: unknown): string | null {
  const direct = asString(value);
  if (direct) return direct;
  const img = asRecord(value);
  return img ? firstString(img.imageUrl, img.url) : null;
}

function normalizeStoreId(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function percentage(value: number): number {
  return value >= 0 && value <= 1 ? value * 100 : value;
}

function transformHotspot(
  value: unknown,
  brochureId: string,
  pageNumber: number,
  index: number,
): CrawlerHotspot | null {
  const discount = asRecord(value);
  const coordinates = asRecord(discount?.coordinates);
  if (!discount || !coordinates) return null;

  const top = asNumber(coordinates.top);
  const left = asNumber(coordinates.left);
  const width = asNumber(coordinates.width);
  const height = asNumber(coordinates.height);
  if (top === null || left === null || width === null || height === null) return null;

  const x = percentage(left);
  const y = percentage(top);
  const pWidth = percentage(width);
  const pHeight = percentage(height);
  if (x < 0 || y < 0 || pWidth <= 0 || pHeight <= 0 || x >= 100 || y >= 100) return null;

  const title = firstString(discount.name, discount.title, discount.description) ?? 'Angebot';
  const providerId = firstString(discount.providerDiscountId, discount.id);

  const hotspot: CrawlerHotspot = {
    kind: 'discount',
    id: providerId ?? `${brochureId}-${pageNumber}-${index}`,
    x,
    y,
    width: Math.min(pWidth, 100 - x),
    height: Math.min(pHeight, 100 - y),
    title,
  };

  const description = asString(discount.description);
  const discountLabel = asString(discount.discount);
  const priceValue = discount.price ?? discount.currentPrice ?? discount.salePrice ?? discount.offerPrice;
  const oldPriceValue = discount.oldPrice ?? discount.regularPrice ?? discount.originalPrice;
  const priceCents = moneyToCents(priceValue);
  const oldPriceCents = moneyToCents(oldPriceValue);
  const labelPrices = pricesFromLabel(discountLabel);
  const resolvedPriceCents = priceCents ?? labelPrices.priceCents;
  const resolvedOldPriceCents = oldPriceCents ?? labelPrices.oldPriceCents;
  const priceLabel = firstString(
    discount.priceLabel,
    discount.priceText,
    discount.formattedPrice,
    discount.currentPriceText,
    discount.priceFormatted,
  );
  const currency = asString(discount.currency);
  const productImg = imageUrl(discount.imageUrl ?? discount.image);

  if (description && description !== title) hotspot.description = description;
  if (discountLabel) hotspot.discount = discountLabel;
  if (priceLabel) hotspot.priceLabel = priceLabel;
  if (resolvedPriceCents !== undefined) hotspot.priceCents = resolvedPriceCents;
  if (resolvedOldPriceCents !== undefined) hotspot.oldPriceCents = resolvedOldPriceCents;
  if (currency) hotspot.currency = currency;
  if (productImg) hotspot.imageUrl = productImg;

  return hotspot;
}

function transformLinkout(
  value: unknown,
  brochureId: string,
  pageNumber: number,
  index: number,
): CrawlerHotspot | null {
  const linkout = asRecord(value);
  const top = asNumber(linkout?.top);
  const left = asNumber(linkout?.left);
  const width = asNumber(linkout?.width);
  const height = asNumber(linkout?.height);
  const linkoutUrl = asString(linkout?.linkoutUrl);
  if (
    top === null ||
    left === null ||
    width === null ||
    height === null ||
    !linkoutUrl
  ) {
    return null;
  }

  const x = percentage(left);
  const y = percentage(top);
  const pWidth = percentage(width);
  const pHeight = percentage(height);
  if (x < 0 || y < 0 || pWidth <= 0 || pHeight <= 0 || x >= 100 || y >= 100) return null;

  return {
    kind: 'linkout',
    id: `linkout:${brochureId}:${pageNumber}:${index}`,
    x,
    y,
    width: Math.min(pWidth, 100 - x),
    height: Math.min(pHeight, 100 - y),
    title: 'Produktangebot',
    linkoutUrl,
  };
}

function transformUnknownEntry(
  value: unknown,
  brochureId: string,
  pageNumber: number,
  index: number,
): CrawlerHotspot | null {
  const entry = asRecord(value);
  const coordinates = asRecord(entry?.coordinates) ?? entry;
  const top = asNumber(coordinates?.top);
  const left = asNumber(coordinates?.left);
  const width = asNumber(coordinates?.width);
  const height = asNumber(coordinates?.height);
  if (top === null || left === null || width === null || height === null) return null;

  const x = percentage(left);
  const y = percentage(top);
  const pWidth = percentage(width);
  const pHeight = percentage(height);
  if (x < 0 || y < 0 || pWidth <= 0 || pHeight <= 0 || x >= 100 || y >= 100) return null;

  const url = firstString(entry?.linkoutUrl, entry?.url, entry?.link);
  return {
    kind: 'unknown',
    id: `unknown:${brochureId}:${pageNumber}:${index}`,
    x,
    y,
    width: Math.min(pWidth, 100 - x),
    height: Math.min(pHeight, 100 - y),
    title: firstString(entry?.name, entry?.title, entry?.description) ?? 'Angebot',
    linkoutUrl: url ?? undefined,
  };
}

function transformPage(value: unknown, brochureId: string, index: number): CrawlerPage | null {
  const page = asRecord(value);
  if (!page) return null;

  const number = asNumber(page.page) ?? asNumber(page.number) ?? index + 1;
  const pageImgUrl = imageUrl(page.image ?? page.originalImage ?? page.original_image);
  if (!pageImgUrl) return null;

  const hotspots = asArray(page.discounts)
    .map((d, dIndex) => transformHotspot(d, brochureId, number, dIndex))
    .filter((h): h is CrawlerHotspot => h !== null);
  const linkouts = asArray(page.linkouts)
    .map((linkout, linkoutIndex) => transformLinkout(linkout, brochureId, number, linkoutIndex))
    .filter((h): h is CrawlerHotspot => h !== null);
  const unknownEntries = Object.entries(page)
    .filter(([key, value]) => key !== 'discounts' && key !== 'linkouts' && Array.isArray(value))
    .flatMap(([, value]) =>
      asArray(value).map((entry, entryIndex) =>
        transformUnknownEntry(entry, brochureId, number, entryIndex),
      ),
    )
    .filter((h): h is CrawlerHotspot => h !== null);

  return { number, imageUrl: pageImgUrl, hotspots: [...hotspots, ...linkouts, ...unknownEntries] };
}

function transformLiveBrochure(
  offerValue: unknown,
  detailValue: unknown,
): { store: CrawlerStore; brochure: CrawlerBrochure } | null {
  const offer = asRecord(offerValue);
  const detail = asRecord(detailValue);
  if (!offer || !detail) return null;

  const brochureId = firstString(offer.brn, offer.id);
  const company = asRecord(offer.company) ?? asRecord(detail.company) ?? asRecord(offer.retailer);
  const storeName = firstString(company?.title, company?.name);
  const validFrom = firstString(offer.activeFrom, offer.validFrom);
  const validUntil = firstString(offer.activeTo, offer.validUntil);
  if (!brochureId || !storeName || !validFrom || !validUntil) return null;

  const pages = asArray(detail.pages)
    .map((p, idx) => transformPage(p, brochureId, idx))
    .filter((p): p is CrawlerPage => p !== null);
  if (pages.length === 0) return null;

  const summaryPages = asArray(offer.pages);
  const firstSummaryPage = asRecord(summaryPages[0]);
  const coverImage = imageUrl(firstSummaryPage?.image) ?? pages[0].imageUrl;
  const storeId = normalizeStoreId(storeName) || brochureId;

  return {
    store: {
      id: storeId,
      name: storeName,
      logoUrl: imageUrl(company?.logoUrl ?? company?.logo),
    },
    brochure: {
      id: brochureId,
      storeId,
      title: firstString(offer.title, detail.title) ?? `${storeName} Angebote`,
      validFrom,
      validUntil,
      coverImage,
      pages,
    },
  };
}

export class LiveOfferBrochureSource implements BrochureSource {
  name = 'live';
  private detailCache = new Map<string, Promise<unknown>>();

  async fetchBrochuresForLocation(location: BrochureLocation): Promise<ScraperResult[]> {
    const tokens = getLiveTokens();
    if (!tokens) {
      throw new Error(
        'Live-Quelle benötigt BRING_AUTH_TOKEN, BRING_API_KEY und BRING_USER_UUID.',
      );
    }

    const headers = liveHeaders(tokens);
    const params = new URLSearchParams({
      type: 'brochure',
      providerId: 'bring-de',
      lat: String(location.latitude),
      long: String(location.longitude),
      zipCode: location.zipCode,
    });

    const listUrl = `https://production.bringapi.app/offers/rest/v1/offers?${params}`;
    const list = asRecord(await fetchJsonWithRetry(listUrl, headers));
    if (!list || !Array.isArray(list.offers)) {
      throw new Error(`Ungültige Angebotsantwort für PLZ ${location.zipCode}.`);
    }
    const offers = list.offers;

    const storeMap = new Map<string, { store: CrawlerStore; brochures: CrawlerBrochure[] }>();

    for (const offerValue of offers) {
      const offer = asRecord(offerValue);
      const brochureId = typeof offer?.brn === 'string' ? offer.brn : null;
      if (!brochureId) continue;

      let detailPromise = this.detailCache.get(brochureId);
      if (!detailPromise) {
        const detailParams = new URLSearchParams({
          brochureId,
          lat: String(location.latitude),
          long: String(location.longitude),
          providerId: 'bring-de',
          zipCode: location.zipCode,
        });
        const detailUrl = `https://production.bringapi.app/offers/rest/v1/offers/brochures/${encodeURIComponent(brochureId)}?${detailParams}`;
        detailPromise = fetchJsonWithRetry(detailUrl, headers);
        this.detailCache.set(brochureId, detailPromise);
        detailPromise.catch(() => this.detailCache.delete(brochureId));
      }

      try {
        const detail = await detailPromise;
        const transformed = transformLiveBrochure(offer, detail);
        if (!transformed) continue;

        let entry = storeMap.get(transformed.store.id);
        if (!entry) {
          entry = { store: transformed.store, brochures: [] };
          storeMap.set(transformed.store.id, entry);
        }
        entry.brochures.push(transformed.brochure);
      } catch (detailErr) {
        console.warn(`⚠️ Konnte Detail für Prospekt ${brochureId} nicht laden:`, detailErr);
      }
    }

    return [...storeMap.values()];
  }
}
