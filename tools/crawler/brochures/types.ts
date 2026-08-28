export type BrochureLocation = {
  zipCode: string;
  latitude: number;
  longitude: number;
  cityName?: string;
};

export type CrawlerStore = {
  id: string;
  name: string;
  logoUrl?: string | null;
};

export type CrawlerHotspot = {
  kind: 'discount' | 'linkout' | 'unknown';
  id: string;
  x: number; // 0..100 (%)
  y: number; // 0..100 (%)
  width: number; // 0..100 (%)
  height: number; // 0..100 (%)
  title: string;
  description?: string;
  discount?: string;
  priceLabel?: string;
  priceCents?: number;
  oldPriceCents?: number;
  currency?: string;
  imageUrl?: string;
  linkoutUrl?: string;
};

export type CrawlerPage = {
  number: number;
  imageUrl: string;
  hotspots: CrawlerHotspot[];
};

export type CrawlerBrochure = {
  id: string;
  storeId: string;
  title: string;
  validFrom: string; // ISO 8601
  validUntil: string; // ISO 8601
  coverImage: string; // URL
  pages: CrawlerPage[];
};

export type BrochurePayloadJson = {
  generatedAt: string;
  locationSource: string;
  stores: CrawlerStore[];
  brochures: CrawlerBrochure[];
};

export type LocationDump = {
  location: BrochureLocation;
  stores: CrawlerStore[];
  brochures: CrawlerBrochure[];
};

export type ScraperResult = {
  store: CrawlerStore;
  brochures: CrawlerBrochure[];
};

export interface BrochureSource {
  name: string;
  fetchBrochuresForLocation(location: BrochureLocation): Promise<ScraperResult[]>;
}
