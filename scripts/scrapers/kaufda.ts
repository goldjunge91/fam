import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

export interface ScrapedHotspot {
  kind: 'discount' | 'linkout' | 'unknown';
  id: string;
  title: string;
  description?: string;
  priceCents?: number;
  priceLabel?: string;
  discount?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  imageUrl?: string;
}

export interface ScrapedPage {
  page_number: number;
  image_url: string;
  thumbnail_url?: string;
  hotspots: ScrapedHotspot[];
}

export interface ScrapedBrochure {
  id: string;
  content_id: string;
  source_zip_code: string;
  store_id: string;
  store_name: string;
  title: string;
  valid_from: string;
  valid_until: string;
  source_url: string;
  cover_image_url: string;
  page_count: number;
  pages: ScrapedPage[];
  available_zip_codes: string[];
}

export interface ScrapeOptions {
  zipCode: string;
  city: string;
  latitude: number;
  longitude: number;
  fetcher?: typeof fetch;
}

interface KaufdaBrochureMetadata {
  contentId: string;
  publisherId: string;
  publisherName: string;
  title: string;
  validFrom: string;
  validUntil: string;
  pageCount: number;
}

type ParsedShelfPage = {
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  itemCount: number;
  brochures: KaufdaBrochureMetadata[];
};

interface BonialPageItem {
  images: Array<{ size: string; url: string }>;
  offers: unknown[];
}

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const SHELF_PAGE_SIZE = 250;
const MAX_SHELF_PAGES = 100;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 4;
const MAX_RETRY_DELAY_MS = 20_000;
const VIEWER_REQUEST_SPACING_MS = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`KaufDA returned an invalid ${field}.`);
  }
  return value.trim();
}

function requiredFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`KaufDA returned an invalid ${field}.`);
  }
  return value;
}

function requiredNonNegativeInteger(value: unknown, field: string): number {
  const number = requiredFiniteNumber(value, field);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`KaufDA returned an invalid ${field}.`);
  }
  return number;
}

function requiredValidDate(value: unknown, field: string): string {
  const date = requiredString(value, field);
  if (!Number.isFinite(Date.parse(date))) throw new Error(`KaufDA returned an invalid ${field}.`);
  return date;
}

function locationCookie(
  options: Pick<ScrapeOptions, 'zipCode' | 'city' | 'latitude' | 'longitude'>,
) {
  const location = {
    lat: options.latitude,
    lng: options.longitude,
    city: options.city,
    zip: options.zipCode,
    countryCode: 'DE',
  };
  return `location=${encodeURIComponent(JSON.stringify(location))}`;
}

function parseShelfBrochure(value: unknown, index: number): KaufdaBrochureMetadata | null {
  if (!isRecord(value)) throw new Error(`KaufDA shelf item ${index + 1} is invalid.`);
  const cardType = requiredString(value.contentType, `shelf item ${index + 1} type`).toLowerCase();
  if (!cardType.startsWith('brochure')) return null;
  if (!isRecord(value.content)) throw new Error(`KaufDA shelf item ${index + 1} has no content.`);

  const content = value.content;
  const contentType = requiredString(content.type, 'content type');
  if (contentType !== 'BROCHURE') return null;

  const contentId = requiredString(content.contentId, 'contentId');
  const title = requiredString(content.title, 'title');
  const validFrom = requiredValidDate(content.validFrom, 'validFrom');
  const validUntil = requiredValidDate(content.validUntil, 'validUntil');
  const publisher = content.publisher;
  if (!isRecord(publisher)) throw new Error(`KaufDA brochure ${contentId} has no publisher.`);
  const publisherId = requiredString(publisher.id, 'publisher id');
  const publisherName = requiredString(publisher.name, 'publisher name');
  const pageCount = requiredFiniteNumber(content.pageCount, 'pageCount');
  if (
    !Number.isInteger(pageCount) ||
    pageCount < 1 ||
    Date.parse(validUntil) < Date.parse(validFrom)
  ) {
    throw new Error(`KaufDA brochure ${contentId} has invalid dates or pageCount.`);
  }
  return { contentId, publisherId, publisherName, title, validFrom, validUntil, pageCount };
}

export function parseKaufdaShelfPage(value: unknown, expectedPage: number): ParsedShelfPage {
  if (!isRecord(value) || !Array.isArray(value.contents) || !isRecord(value.page)) {
    throw new Error('KaufDA shelf response did not include contents and pagination.');
  }
  const page = value.page;
  const parsed = {
    number: requiredNonNegativeInteger(page.number, 'shelf page number'),
    size: requiredNonNegativeInteger(page.size, 'shelf page size'),
    totalElements: requiredNonNegativeInteger(page.totalElements, 'shelf totalElements'),
    totalPages: requiredNonNegativeInteger(page.totalPages, 'shelf totalPages'),
    itemCount: value.contents.length,
    brochures: value.contents
      .map(parseShelfBrochure)
      .filter((brochure): brochure is KaufdaBrochureMetadata => brochure !== null),
  };
  const expectedItems = Math.min(
    parsed.size,
    Math.max(0, parsed.totalElements - expectedPage * parsed.size),
  );
  if (
    parsed.number !== expectedPage ||
    parsed.size < 1 ||
    parsed.itemCount > parsed.size ||
    parsed.totalPages !== Math.ceil(parsed.totalElements / parsed.size) ||
    (parsed.totalPages > 0 && expectedPage >= parsed.totalPages) ||
    parsed.itemCount !== expectedItems
  ) {
    throw new Error('KaufDA shelf pagination is inconsistent.');
  }
  return parsed;
}

function bonialImageUrl(value: unknown, field: string): string {
  const source = requiredString(value, field);
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new Error(`KaufDA returned an invalid ${field} URL.`);
  }
  if (url.protocol !== 'https:' || url.hostname !== 'content-media.bonial.biz') {
    throw new Error(`KaufDA returned a ${field} URL outside the Bonial image host.`);
  }
  return url.toString();
}

function optionalBonialImageUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  try {
    return bonialImageUrl(value, 'hotspot image');
  } catch {
    return undefined;
  }
}

function parseBonialPages(value: unknown, expectedPageCount: number): BonialPageItem[] {
  if (!isRecord(value) || !Array.isArray(value.contents)) {
    throw new Error('KaufDA viewer response did not include page contents.');
  }
  if (value.contents.length !== expectedPageCount) {
    throw new Error(
      `KaufDA returned ${value.contents.length} pages; expected ${expectedPageCount}.`,
    );
  }

  return value.contents.map((item, index) => {
    if (!isRecord(item) || !Array.isArray(item.images) || !Array.isArray(item.offers)) {
      throw new Error(`KaufDA page ${index + 1} is missing image or offer data.`);
    }
    const images = item.images.flatMap((image) => {
      if (!isRecord(image) || typeof image.size !== 'string' || typeof image.url !== 'string') {
        return [];
      }
      try {
        return [{ size: image.size, url: bonialImageUrl(image.url, `page ${index + 1} image`) }];
      } catch {
        return [];
      }
    });
    if (images.length === 0) throw new Error(`KaufDA page ${index + 1} has no valid image URL.`);
    return { images, offers: item.offers };
  });
}

function selectImage(images: BonialPageItem['images'], preferred: RegExp[]): string {
  for (const size of preferred) {
    const image = images.find((candidate) => size.test(candidate.size));
    if (image) return image.url;
  }
  return images.at(-1)?.url ?? '';
}

function offerArea(value: unknown): { x: number; y: number; width: number; height: number } | null {
  if (!isRecord(value) || !isRecord(value.topLeft) || !isRecord(value.bottomRight)) return null;
  const left = value.topLeft.x;
  const top = value.topLeft.y;
  const right = value.bottomRight.x;
  const bottom = value.bottomRight.y;
  if (
    typeof left !== 'number' ||
    typeof top !== 'number' ||
    typeof right !== 'number' ||
    typeof bottom !== 'number' ||
    ![left, top, right, bottom].every(Number.isFinite) ||
    left < 0 ||
    top < 0 ||
    right > 1 ||
    bottom > 1 ||
    right <= left ||
    bottom <= top
  ) {
    return null;
  }
  return {
    x: roundPercent(left),
    y: roundPercent(top),
    width: roundPercent(right - left),
    height: roundPercent(bottom - top),
  };
}

function roundPercent(value: number): number {
  return Math.round(value * 10_000) / 100;
}

function formatDiscount(value: unknown, type: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const label = String(value).trim();
  if (!label) return undefined;
  if (label.includes('%') || label.includes('€'))
    return label.startsWith('-') ? label : `-${label}`;
  if (typeof type === 'string' && /percent/i.test(type)) return `-${label}%`;
  if (typeof type === 'string' && /(amount|price|currency)/i.test(type)) return `-${label} €`;
  return undefined;
}

function normalizeHotspots(value: unknown, pageNumber: number): ScrapedHotspot[] {
  if (!Array.isArray(value)) return [];
  const hotspots: ScrapedHotspot[] = [];
  for (const [index, offer] of value.entries()) {
    if (!isRecord(offer) || !isRecord(offer.content)) continue;
    const content = offer.content;
    const products = Array.isArray(content.products) ? content.products : [];
    const product = products.find(isRecord);
    const parentContent = content.parentContent;
    const parentPage = isRecord(parentContent) ? parentContent.page : undefined;
    const area = isRecord(parentPage) ? offerArea(parentPage.area) : null;
    if (!area) continue;

    const deals = Array.isArray(content.deals) ? content.deals : [];
    const deal = deals.find(isRecord);
    const priceValue = deal?.min ?? deal?.max;
    const currencyCode = deal?.currencyCode;
    const price =
      typeof priceValue === 'number' && Number.isFinite(priceValue) && currencyCode === 'EUR'
        ? priceValue
        : undefined;
    const rawDiscountLabel = content.discountLabel;
    const discountLabel = isRecord(rawDiscountLabel) ? rawDiscountLabel : undefined;
    const discount = discountLabel
      ? formatDiscount(discountLabel.value, discountLabel.type)
      : undefined;
    const description = Array.isArray(product?.description)
      ? product.description
          .flatMap((paragraph) =>
            isRecord(paragraph) && typeof paragraph.paragraph === 'string'
              ? [paragraph.paragraph.trim()]
              : [],
          )
          .filter(Boolean)
          .join(' ')
      : undefined;
    const productName =
      typeof product?.name === 'string' && product.name.trim() ? product.name.trim() : undefined;
    const title = productName ?? description;
    if (!title) continue;
    const imageUrl = optionalBonialImageUrl(content.image);
    const rawId = content.id;

    hotspots.push({
      kind: 'discount',
      id: typeof rawId === 'string' && rawId.trim() ? rawId : `offer-${pageNumber}-${index + 1}`,
      title,
      ...(description ? { description } : {}),
      ...(price === undefined
        ? {}
        : {
            priceCents: Math.round(price * 100),
            priceLabel: new Intl.NumberFormat('de-DE', {
              style: 'currency',
              currency: 'EUR',
            }).format(price),
          }),
      ...(discount ? { discount } : {}),
      ...area,
      ...(imageUrl ? { imageUrl } : {}),
    });
  }
  return hotspots;
}

function normalizePages(value: unknown, expectedPageCount: number): ScrapedPage[] {
  return parseBonialPages(value, expectedPageCount).map((page, index) => {
    const pageNumber = index + 1;
    const imageUrl = selectImage(page.images, [/2800/i, /1600/i, /768/i]);
    const thumbnailUrl = page.images.find((image) => /75x96/i.test(image.size))?.url;
    return {
      page_number: pageNumber,
      image_url: imageUrl,
      ...(thumbnailUrl ? { thumbnail_url: thumbnailUrl } : {}),
      hotspots: normalizeHotspots(page.offers, pageNumber),
    };
  });
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
    }
    const retryDate = Date.parse(retryAfter);
    if (Number.isFinite(retryDate)) {
      return Math.min(Math.max(0, retryDate - Date.now()), MAX_RETRY_DELAY_MS);
    }
  }
  return Math.min(500 * 2 ** attempt, MAX_RETRY_DELAY_MS);
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  fetcher: typeof fetch,
): Promise<Response> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetcher(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      if (attempt === MAX_ATTEMPTS - 1) throw error;
      await sleep(Math.min(500 * 2 ** attempt, MAX_RETRY_DELAY_MS));
      continue;
    }

    if (response.ok) return response;
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === MAX_ATTEMPTS - 1) {
      throw new Error(
        `KaufDA request failed with HTTP ${response.status} at ${new URL(url).pathname}.`,
      );
    }
    await sleep(retryDelay(response, attempt));
  }
  throw new Error('KaufDA request failed after all retry attempts.');
}

async function fetchKaufdaShelfPage(
  options: ScrapeOptions,
  page: number,
  fetcher: typeof fetch,
): Promise<unknown> {
  const url = new URL('/api/shelf', 'https://www.kaufda.de');
  url.search = new URLSearchParams({
    lat: String(options.latitude),
    lng: String(options.longitude),
    size: String(SHELF_PAGE_SIZE),
    page: String(page),
    sectorIds: '',
  }).toString();
  const response = await fetchWithRetry(
    url.toString(),
    {
      headers: {
        Accept: 'application/json',
        Cookie: locationCookie(options),
        Referer: 'https://www.kaufda.de/',
        'User-Agent': USER_AGENT,
      },
    },
    fetcher,
  );
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new Error(`KaufDA shelf returned invalid JSON for page ${page}.`);
  }
}

async function fetchViewerPages(
  brochure: KaufdaBrochureMetadata,
  options: ScrapeOptions,
  fetcher: typeof fetch,
): Promise<unknown> {
  const url = new URL(
    `/v1/brochures/${encodeURIComponent(brochure.contentId)}/pages`,
    'https://content-viewer-be.kaufda.de',
  );
  url.search = new URLSearchParams({
    partner: 'kaufda_web',
    brochureKey: '',
    lat: String(options.latitude),
    lng: String(options.longitude),
  }).toString();
  const response = await fetchWithRetry(
    url.toString(),
    {
      headers: {
        Accept: 'application/json',
        'bonial-api-consumer': 'web-content-viewer-fe',
        Referer: 'https://www.kaufda.de/',
        'User-Agent': USER_AGENT,
      },
    },
    fetcher,
  );
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new Error(`KaufDA viewer returned invalid JSON for ${brochure.contentId}.`);
  }
}

export async function scrapeKaufdaZip(options: ScrapeOptions): Promise<ScrapedBrochure[]> {
  if (!/^\d{5}$/.test(options.zipCode)) throw new Error('zipCode must contain five digits.');
  if (!options.city.trim()) throw new Error('city is required.');
  if (!Number.isFinite(options.latitude) || !Number.isFinite(options.longitude)) {
    throw new Error('latitude and longitude must be finite numbers.');
  }
  const fetcher = options.fetcher ?? fetch;
  const firstShelfPage = parseKaufdaShelfPage(await fetchKaufdaShelfPage(options, 0, fetcher), 0);
  if (firstShelfPage.size !== SHELF_PAGE_SIZE) {
    throw new Error(`KaufDA shelf page size changed from ${SHELF_PAGE_SIZE}.`);
  }
  if (firstShelfPage.totalPages > MAX_SHELF_PAGES) {
    throw new Error(`KaufDA shelf exceeds the ${MAX_SHELF_PAGES}-page safety limit.`);
  }

  const metadata = [...firstShelfPage.brochures];
  for (let pageNumber = 1; pageNumber < firstShelfPage.totalPages; pageNumber += 1) {
    const page = parseKaufdaShelfPage(
      await fetchKaufdaShelfPage(options, pageNumber, fetcher),
      pageNumber,
    );
    if (
      page.size !== firstShelfPage.size ||
      page.totalElements !== firstShelfPage.totalElements ||
      page.totalPages !== firstShelfPage.totalPages
    ) {
      throw new Error('KaufDA shelf pagination changed during the PLZ scan.');
    }
    metadata.push(...page.brochures);
  }

  const uniqueMetadata = new Map<string, KaufdaBrochureMetadata>();
  for (const brochure of metadata) {
    const identity = JSON.stringify([brochure.publisherId, brochure.contentId]);
    const existing = uniqueMetadata.get(identity);
    if (
      existing &&
      (existing.publisherName !== brochure.publisherName ||
        existing.title !== brochure.title ||
        existing.validFrom !== brochure.validFrom ||
        existing.validUntil !== brochure.validUntil ||
        existing.pageCount !== brochure.pageCount)
    ) {
      throw new Error(`KaufDA returned conflicting shelf metadata for ${brochure.contentId}.`);
    }
    uniqueMetadata.set(identity, existing ?? brochure);
  }

  const results: ScrapedBrochure[] = [];

  let viewerRequestCount = 0;
  for (const brochure of uniqueMetadata.values()) {
    try {
      if (viewerRequestCount > 0) await sleep(VIEWER_REQUEST_SPACING_MS);
      const rawPages = await fetchViewerPages(brochure, options, fetcher);
      viewerRequestCount += 1;
      const pages = normalizePages(rawPages, brochure.pageCount);
      if (pages.length === 0 || pages[0]?.image_url === '') {
        throw new Error('viewer response has no cover page.');
      }
      const storeId = `kaufda:${brochure.publisherId}`;
      results.push({
        id: `kaufda:${options.zipCode}:${storeId}:${brochure.contentId}`,
        content_id: brochure.contentId,
        source_zip_code: options.zipCode,
        store_id: storeId,
        store_name: brochure.publisherName,
        title: `${brochure.publisherName} - ${brochure.title}`,
        valid_from: brochure.validFrom,
        valid_until: brochure.validUntil,
        source_url: `https://www.kaufda.de/contentViewer/static/${encodeURIComponent(brochure.contentId)}?page=1`,
        cover_image_url: pages[0].image_url,
        page_count: pages.length,
        pages,
        available_zip_codes: [options.zipCode],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `${brochure.publisherName} (${brochure.publisherId}), ${brochure.contentId}: ${message}`,
        { cause: error },
      );
    }
  }
  return results;
}

function argumentValue(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function requiredArgument(args: readonly string[], name: string): string {
  const value = argumentValue(args, name);
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const zipCode = requiredArgument(args, '--zip');
  const city = requiredArgument(args, '--city');
  const latitude = Number(requiredArgument(args, '--lat'));
  const longitude = Number(requiredArgument(args, '--lng'));
  const outputPath = argumentValue(args, '--output');
  const brochures = await scrapeKaufdaZip({
    zipCode,
    city,
    latitude,
    longitude,
  });
  const output = `${JSON.stringify(brochures, null, 2)}\n`;
  if (outputPath) {
    const absolutePath = resolve(outputPath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, output, 'utf8');
  } else {
    process.stdout.write(output);
  }
  process.stderr.write(`PLZ ${zipCode}: ${brochures.length} brochures across all categories\n`);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `KaufDA scrape failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
