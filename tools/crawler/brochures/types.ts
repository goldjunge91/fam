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

export type CompletenessStatus = 'complete' | 'incomplete' | 'failed' | 'not-found';

export type DiagnosticSeverity = 'info' | 'warning' | 'error';

export type CompletenessIssueCode =
  | 'offers-list-succeeded'
  | 'offers-list-failed'
  | 'source-fetch-failed'
  | 'store-not-found'
  | 'brochure-found'
  | 'detail-fetch-failed'
  | 'detail-unprocessable'
  | 'missing-pages'
  | 'missing-image-url'
  | 'invalid-page-number'
  | 'duplicate-page-number'
  | 'page-number-gap'
  | 'missing-valid-from'
  | 'invalid-valid-from'
  | 'missing-valid-until'
  | 'invalid-valid-until'
  | 'valid-until-before-valid-from'
  | 'source-incomplete'
  | 'crawl-failed';

/**
 * Einzelne Diagnose aus einer Quelle oder der Standortverarbeitung.
 * `rawValue` und `details` sind absichtlich kein Teil des App-Payloads und
 * bewahren problematische Quellwerte für die spätere Prüfung.
 */
export type SourceDiagnostic = {
  code: CompletenessIssueCode;
  severity: DiagnosticSeverity;
  scope: 'location' | 'store' | 'brochure' | 'page';
  message: string;
  source?: string;
  zipCode?: string;
  storeId?: string;
  storeName?: string;
  brochureId?: string;
  pageNumber?: number;
  rawValue?: unknown;
  details?: Record<string, unknown>;
};

/** Kompakter Übergabepunkt zwischen Quelle, Engine und Stichproben-Crawler. */
export type SourceFetchReport = {
  source: string;
  status: CompletenessStatus;
  results: ScraperResult[];
  diagnostics: SourceDiagnostic[];
};

/** Prüfartefakt je Standort, getrennt vom veröffentlichbaren `LocationDump`. */
export type CompletenessReport = {
  location: BrochureLocation;
  status: CompletenessStatus;
  diagnostics: SourceDiagnostic[];
};

/** Atomarer Backup-Bestand eines einzelnen Crawls. */
export type CrawlBackupArtifact = {
  version: 1;
  runId: string;
  generatedAt: string;
  dumps: LocationDump[];
};

/** Diagnosenbestand desselben Crawls wie der zugehörige `CrawlBackupArtifact`. */
export type CrawlDiagnosticsArtifact = {
  version: 1;
  runId: string;
  generatedAt: string;
  reports: CompletenessReport[];
};

export interface BrochureSource {
  name: string;
  fetchBrochuresForLocation(location: BrochureLocation): Promise<ScraperResult[]>;
  fetchBrochuresForLocationWithDiagnostics?: (
    location: BrochureLocation,
  ) => Promise<SourceFetchReport>;
}
