export type BrochureLocation = {
  zipCode: string;
  latitude: number;
  longitude: number;
};

export type BrochureStoreDump = {
  id: string;
  name: string;
  logoUrl: string | null;
};

export type BrochureHotspotDump = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  description?: string;
  discount?: string;
  priceCents?: number;
  oldPriceCents?: number;
  currency?: string;
  imageUrl?: string;
};

export type BrochurePageDump = {
  number: number;
  imageUrl: string;
  hotspots: BrochureHotspotDump[];
};

export type BrochureDump = {
  id: string;
  storeId: string;
  title: string;
  validFrom: string;
  validUntil: string;
  coverImage: string;
  pages: BrochurePageDump[];
};

export type TransformedBrochure = {
  store: BrochureStoreDump;
  brochure: BrochureDump;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const stringValue = asString(value);
    if (stringValue) return stringValue;
  }
  return null;
}

function imageUrl(value: unknown): string | null {
  const direct = asString(value);
  if (direct) return direct;

  const image = asRecord(value);
  return image ? firstString(image.imageUrl, image.url) : null;
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
): BrochureHotspotDump | null {
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
  const percentageWidth = percentage(width);
  const percentageHeight = percentage(height);
  if (x < 0 || y < 0 || percentageWidth <= 0 || percentageHeight <= 0 || x >= 100 || y >= 100) {
    return null;
  }

  const title = firstString(discount.name, discount.title, discount.description) ?? 'Angebot';
  const providerId = firstString(discount.providerDiscountId, discount.id);
  const hotspot: BrochureHotspotDump = {
    id: providerId ?? `${brochureId}-${pageNumber}-${index}`,
    x,
    y,
    width: Math.min(percentageWidth, 100 - x),
    height: Math.min(percentageHeight, 100 - y),
    title,
  };

  const description = asString(discount.description);
  const discountLabel = asString(discount.discount);
  const priceCents = asNumber(discount.price);
  const oldPriceCents = asNumber(discount.oldPrice);
  const currency = asString(discount.currency);
  const productImageUrl = imageUrl(discount.imageUrl ?? discount.image);

  if (description && description !== title) hotspot.description = description;
  if (discountLabel) hotspot.discount = discountLabel;
  if (priceCents !== null) hotspot.priceCents = priceCents;
  if (oldPriceCents !== null) hotspot.oldPriceCents = oldPriceCents;
  if (currency) hotspot.currency = currency;
  if (productImageUrl) hotspot.imageUrl = productImageUrl;

  return hotspot;
}

function transformPage(value: unknown, brochureId: string, index: number): BrochurePageDump | null {
  const page = asRecord(value);
  if (!page) return null;

  const number = asNumber(page.page) ?? asNumber(page.number) ?? index + 1;
  const pageImageUrl = imageUrl(page.image ?? page.originalImage ?? page.original_image);
  if (!pageImageUrl) return null;

  const hotspots = asArray(page.discounts)
    .map((discount, discountIndex) => transformHotspot(discount, brochureId, number, discountIndex))
    .filter((hotspot): hotspot is BrochureHotspotDump => hotspot !== null);

  return { number, imageUrl: pageImageUrl, hotspots };
}

export function transformBrochure(
  offerValue: unknown,
  detailValue: unknown,
): TransformedBrochure | null {
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
    .map((page, index) => transformPage(page, brochureId, index))
    .filter((page): page is BrochurePageDump => page !== null);
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

export function parseBrochureLocations(value: string | undefined): BrochureLocation[] {
  if (!value?.trim()) {
    throw new Error('BROCHURE_LOCATIONS_JSON oder BROCHURE_LOCATIONS_FILE fehlt.');
  }

  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('BROCHURE_LOCATIONS_JSON muss ein nicht-leeres JSON-Array sein.');
  }

  return parsed.map((entry, index) => {
    const location = asRecord(entry);
    const zipCode = asString(location?.zipCode);
    const latitude = asNumber(location?.latitude);
    const longitude = asNumber(location?.longitude);
    if (!zipCode || !/^\d{5}$/.test(zipCode) || latitude === null || longitude === null) {
      throw new Error(`Ungueltiger Ort an Position ${index} in BROCHURE_LOCATIONS_JSON.`);
    }
    return { zipCode, latitude, longitude };
  });
}

/**
 * GeoNames-DE enthaelt mehrere Orte und teils Grosskunden pro PLZ. Fuer Bring
 * reicht ein stabiler Mittelpunkt je PLZ; deshalb werden alle Koordinaten
 * derselben fuenfstelligen PLZ gemittelt und anschliessend numerisch sortiert.
 */
export function parseGeoNamesPostalCodes(value: string): BrochureLocation[] {
  const aggregates = new Map<
    string,
    { latitudeSum: number; longitudeSum: number; count: number }
  >();

  for (const line of value.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const columns = line.split('\t');
    const zipCode = columns[1]?.trim();
    const latitude = Number(columns[9]);
    const longitude = Number(columns[10]);
    if (
      columns[0] !== 'DE' ||
      !zipCode ||
      !/^\d{5}$/.test(zipCode) ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      continue;
    }

    const current = aggregates.get(zipCode) ?? { latitudeSum: 0, longitudeSum: 0, count: 0 };
    current.latitudeSum += latitude;
    current.longitudeSum += longitude;
    current.count += 1;
    aggregates.set(zipCode, current);
  }

  const locations = [...aggregates].map(([zipCode, aggregate]) => ({
    zipCode,
    latitude: aggregate.latitudeSum / aggregate.count,
    longitude: aggregate.longitudeSum / aggregate.count,
  }));
  locations.sort((left, right) => left.zipCode.localeCompare(right.zipCode));
  if (locations.length === 0) throw new Error('Die GeoNames-Datei enthaelt keine deutsche PLZ.');
  return locations;
}
