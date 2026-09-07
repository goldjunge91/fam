import { createHash } from 'node:crypto';
import { access, mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import sharp from 'sharp';
import { loadTargetLocations } from './locations';
import { type PageSelection, type PageSelectionMode, selectBrochurePages } from './page-selection';
import { downloadOptimizedImage } from './r2-storage';
import { LiveOfferBrochureSource } from './sources/live-offers';
import {
  createRetentionReport,
  createStorageBudget,
  decimalGbToBytes,
  type RetentionBrochure,
  type StorageAsset,
  type StorageBudget,
  type StorageBudgetSnapshot,
} from './storage-policy';
import type { BrochureLocation, CrawlerBrochure, SourceDiagnostic } from './types';

type AldiNordControl = {
  kind: 'confirmed-aldi-nord';
  storeAddress: string;
  sourceUrl: string;
};

type SampleLocation = BrochureLocation & {
  label: string;
  control?: AldiNordControl;
};

const CONFIRMED_ALDI_NORD_CONTROLS = [
  {
    zipCode: '01307',
    storeAddress: 'Straßburger Platz 1, 01307 Dresden',
    sourceUrl:
      'https://www.aldi-nord.de/filialen-und-oeffnungszeiten/dresden/strassburger-platz-1/3180831.html',
  },
  {
    zipCode: '10117',
    storeAddress: 'Friedrichstraße 149, 10117 Berlin',
    sourceUrl:
      'https://www.aldi-nord.de/filialen-und-oeffnungszeiten/berlin/friedrichstrasse-149/3297740.html',
  },
  {
    zipCode: '21073',
    storeAddress: 'Seeveplatz 1, 21073 Hamburg',
    sourceUrl:
      'https://www.aldi-nord.de/filialen-und-oeffnungszeiten/hamburg/seeveplatz-1/3181908.html',
  },
  {
    zipCode: '25980',
    storeAddress: 'Keitumer Landstraße 21, 25980 Sylt',
    sourceUrl:
      'https://www.aldi-nord.de/filialen-und-oeffnungszeiten/sylt/keitumer-landstrasse-21/3180862.html',
  },
  {
    zipCode: '45139',
    storeAddress: 'Hubertstraße 20, 45139 Essen',
    sourceUrl:
      'https://www.aldi-nord.de/filialen-und-oeffnungszeiten/essen/hubertstrasse-20/3182227.html',
  },
] as const;

type PageReference = {
  pageNumber: number;
  originalUrl: string;
  assetPath: string;
  contentHash: string;
  perceptualHash: string;
  bytes: number;
};

export type PageFailure = {
  pageNumber: number;
  originalUrl: string;
  code: string;
  message: string;
  location?: string;
};

export type PageSelectionManifest = {
  mode: PageSelectionMode;
  deliveredPageNumbers: number[];
  selectedPageNumbers: number[];
  savedPageNumbers: number[];
  failedPages: PageFailure[];
  complete: boolean;
};

type DiagnosticRecord = {
  [key: string]: unknown;
  code?: string;
  message?: string;
  severity?: string;
};

function reportDiagnostic(diagnostic: SourceDiagnostic, location: string): DiagnosticRecord {
  return {
    ...diagnostic,
    location,
  };
}

type BrochureRecord = {
  id: string;
  storeId: string;
  storeName: string;
  title: string;
  validFrom: string;
  validUntil: string;
  contentSignature: string;
  locations: string[];
  pages: PageReference[];
  pageSelection: PageSelectionManifest;
};

type BrochureSighting = Omit<BrochureRecord, 'contentSignature' | 'locations'> & {
  location: string;
};

export type SampleManifest = {
  version: 6;
  status: 'complete' | 'partial' | 'failed';
  generatedAt: string;
  source: 'bring-de-live';
  storeFilters: string[];
  pagesPerBrochure: number | 'all';
  pageSelection: PageSelectionMode;
  selectionMode: PageSelectionMode;
  outputDir: string;
  reportDir: string;
  storageBudgetGb?: number;
  storageBudget?: StorageBudgetSnapshot;
  retentionGraceDays: number;
  sampleSize: number;
  locations: Array<{ label: string; zipCode: string; control?: AldiNordControl }>;
  brochures: BrochureRecord[];
  diagnostics: DiagnosticRecord[];
  storeSummaries: Array<{
    storeId: string;
    storeName: string;
    sightings: number;
    locations: number;
    uniqueBrochureIds: number;
    uniqueContentVersions: number;
  }>;
  duplicateGroups: Array<{
    contentSignature: string;
    sightingCount: number;
    brochureIds: string[];
    storeNames: string[];
    locations: string[];
  }>;
  summary: {
    locationsTotal: number;
    locationsSuccessful: number;
    locationsFailed: number;
    locationsWithTargetStores: number;
    brochureSightings: number;
    uniqueBrochureIds: number;
    uniqueIdAndContentVariants: number;
    uniqueContentVersions: number;
    repeatedSameContentSightings: number;
    pageReferences: number;
    duplicatePageReferences: number;
    uniqueAssets: number;
    observedBytes: number;
    uniqueBytes: number;
    duplicateBytes: number;
    deduplicationPercent: number;
    pagesDelivered: number;
    pagesSelected: number;
    pagesSaved: number;
    pagesFailed: number;
    incompleteBrochures: number;
    incompleteLocations: number;
    confirmedAldiNordControls: number;
    confirmedAldiNordControlHits: number;
  };
  errors: Array<{ location: string; message: string }>;
  pageFailures: PageFailure[];
  completeness: 'complete' | 'partial';
};

export type SampleOptions = {
  outputDir: string;
  reportDir: string;
  storageBudget?: StorageBudget;
  sampleSize: number;
  concurrency: number;
  pagesPerBrochure: number | 'all';
  storageBudgetGb?: number;
  retentionGraceDays: number;
  stores: string[];
  locations: SampleLocation[];
};

function argument(name: string, argv: readonly string[] = process.argv): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function parseNonNegativeInteger(raw: string | undefined, name: string, fallback: number): number {
  const value = raw === undefined ? String(fallback) : raw.trim();
  if (!/^\d+$/.test(value)) {
    throw new Error(`--${name} muss eine nichtnegative ganze Zahl sein.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`--${name} muss eine nichtnegative ganze Zahl sein.`);
  }
  return parsed;
}

function chooseEvenly<T>(items: T[], count: number): T[] {
  if (count >= items.length) return [...items];
  return Array.from({ length: count }, (_, index) => {
    const item = items[Math.floor((index * items.length) / count)];
    if (item === undefined) throw new Error('Die Auswahl enthält nicht genügend Standorte.');
    return item;
  });
}

async function sampleLocations(
  count: number,
  includeAldiNordControls: boolean,
): Promise<SampleLocation[]> {
  const allLocations = await loadTargetLocations({ all: true });
  const locationsByZipCode = new Map(allLocations.map((location) => [location.zipCode, location]));
  const controlLocations = (includeAldiNordControls ? CONFIRMED_ALDI_NORD_CONTROLS : []).map(
    (control) => {
      const location = locationsByZipCode.get(control.zipCode);
      if (!location)
        throw new Error(`Bestätigte ALDI-Nord-PLZ fehlt in GeoNames: ${control.zipCode}`);
      return {
        ...location,
        label: `${location.cityName || 'Unbekannt'} (${location.zipCode})`,
        control: {
          kind: 'confirmed-aldi-nord' as const,
          storeAddress: control.storeAddress,
          sourceUrl: control.sourceUrl,
        },
      };
    },
  );
  const controlZipCodes = new Set(controlLocations.map((location) => location.zipCode));
  const candidates = allLocations.filter((location) => !controlZipCodes.has(location.zipCode));
  const byPrefix = new Map<string, BrochureLocation[]>();
  for (const location of candidates) {
    const prefix = location.zipCode.slice(0, 2);
    const group = byPrefix.get(prefix) ?? [];
    group.push(location);
    byPrefix.set(prefix, group);
  }

  const regional = [...byPrefix.values()]
    .map((group) => group[Math.floor(group.length / 2)])
    .filter((location): location is BrochureLocation => location !== undefined)
    .sort((a, b) => a.zipCode.localeCompare(b.zipCode));
  const regionalZipCodes = new Set(regional.map((location) => location.zipCode));
  const randomSampleSize = count - controlLocations.length;
  const selected =
    regional.length >= randomSampleSize
      ? chooseEvenly(regional, randomSampleSize)
      : [
          ...regional,
          ...chooseEvenly(
            candidates.filter((location) => !regionalZipCodes.has(location.zipCode)),
            randomSampleSize - regional.length,
          ),
        ];

  const sampledLocations = selected
    .sort((a, b) => a.zipCode.localeCompare(b.zipCode))
    .slice(0, randomSampleSize)
    .map((location) => ({
      ...location,
      label: `${location.cityName || 'Unbekannt'} (${location.zipCode})`,
    }));

  return [...controlLocations, ...sampledLocations].sort((a, b) =>
    a.zipCode.localeCompare(b.zipCode),
  );
}

export function parseStorageBudgetGb(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const value = raw.trim();
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) {
    throw new Error('--storage-budget-gb muss eine nichtnegative Dezimalzahl in GB sein.');
  }
  const budgetGb = Number(value);
  if (!Number.isFinite(budgetGb) || budgetGb < 0) {
    throw new Error('--storage-budget-gb muss eine nichtnegative Dezimalzahl in GB sein.');
  }
  decimalGbToBytes(budgetGb);
  return budgetGb;
}

export function parseRetentionGraceDays(raw: string | undefined): number {
  const value = raw ?? '0';
  if (!/^\d+$/.test(value.trim())) {
    throw new Error('--retention-grace-days muss eine nichtnegative ganze Zahl sein.');
  }
  const days = Number(value);
  if (!Number.isSafeInteger(days) || days < 0) {
    throw new Error('--retention-grace-days muss eine nichtnegative ganze Zahl sein.');
  }
  return days;
}

export async function parseOptions(argv: readonly string[] = process.argv): Promise<SampleOptions> {
  const outputArgument = argument('output-dir', argv);
  const outputDir = outputArgument;
  if (!outputDir) {
    throw new Error(
      'Bitte --output-dir setzen, zum Beispiel --output-dir="/Volumes/Programme/FamCrawler/retailer-sample"',
    );
  }

  const stores = (argument('stores', argv) ?? 'lidl,kaufland,netto,rewe')
    .split(',')
    .map((store) => store.trim().toLocaleLowerCase('de-DE'))
    .filter(Boolean);
  if (stores.length === 0) throw new Error('--stores muss mindestens einen Händler enthalten.');

  const includeAldiNordControls = stores.some((store) => store.includes('aldi'));
  const minimumSampleSize = includeAldiNordControls ? CONFIRMED_ALDI_NORD_CONTROLS.length : 1;
  const sampleSize = parseNonNegativeInteger(argument('sample-size', argv), 'sample-size', 100);
  if (!Number.isInteger(sampleSize) || sampleSize < minimumSampleSize || sampleSize > 1000) {
    throw new Error(`--sample-size muss zwischen ${minimumSampleSize} und 1000 liegen.`);
  }

  const concurrency = parseNonNegativeInteger(argument('concurrency', argv), 'concurrency', 8);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) {
    throw new Error('--concurrency muss zwischen 1 und 16 liegen.');
  }

  const pagesArgument = argument('pages', argv) ?? '6';
  const pagesPerBrochure =
    pagesArgument === 'all' ? 'all' : parseNonNegativeInteger(pagesArgument, 'pages', 6);
  if (
    pagesPerBrochure !== 'all' &&
    (!Number.isInteger(pagesPerBrochure) || pagesPerBrochure < 3 || pagesPerBrochure > 6)
  ) {
    throw new Error('--pages muss zwischen 3 und 6 liegen oder "all" sein.');
  }

  const reportArgument = argument('report-dir', argv);
  const storageBudgetGb = parseStorageBudgetGb(argument('storage-budget-gb', argv));
  const retentionGraceDays = parseRetentionGraceDays(argument('retention-grace-days', argv));
  const reportDir = resolve(reportArgument ?? outputDir);

  return {
    outputDir: resolve(outputDir),
    reportDir,
    sampleSize,
    concurrency,
    pagesPerBrochure,
    ...(storageBudgetGb === undefined ? {} : { storageBudgetGb }),
    retentionGraceDays,
    stores,
    locations: await sampleLocations(sampleSize, includeAldiNordControls),
  };
}

async function ensureDirectory(path: string): Promise<void> {
  try {
    await mkdir(path, { recursive: true });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Ausgabeverzeichnis ist nicht beschreibbar: ${path} (${reason})`);
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function listLocalAssets(rootDir: string, currentDir = rootDir): Promise<StorageAsset[]> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const assets: StorageAsset[] = [];
  for (const entry of entries) {
    const absolutePath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      assets.push(...(await listLocalAssets(rootDir, absolutePath)));
      continue;
    }
    if (!entry.isFile() || entry.name.endsWith('.tmp')) continue;
    const fileStats = await stat(absolutePath);
    const key = relative(rootDir, absolutePath).replaceAll('\\', '/');
    assets.push({ key, bytes: fileStats.size });
  }
  return assets;
}

async function createSampleStorageBudget(
  outputDir: string,
  budgetGb: number | undefined,
): Promise<StorageBudget | undefined> {
  if (budgetGb === undefined) return undefined;
  const assetsDir = join(outputDir, 'assets');
  const existingAssets = (await exists(assetsDir))
    ? await listLocalAssets(outputDir, assetsDir)
    : [];
  return createStorageBudget({
    budgetBytes: decimalGbToBytes(budgetGb),
    existingAssets,
  });
}

const assetWritePromises = new Map<string, Promise<void>>();

async function storeAsset(
  outputDir: string,
  body: ArrayBuffer,
  storageBudget?: StorageBudget,
): Promise<PageReference> {
  const bytes = Buffer.from(body);
  const contentHash = createHash('sha256').update(bytes).digest('hex');
  const perceptualHash = await differenceHash(bytes);
  const assetPath = `assets/${contentHash}.jpg`;
  const absolutePath = join(outputDir, assetPath);

  let writePromise = assetWritePromises.get(absolutePath);
  if (!writePromise) {
    writePromise = (async () => {
      if (await exists(absolutePath)) return;

      const reservation = storageBudget?.reserve(assetPath, bytes.byteLength);
      await ensureDirectory(dirname(absolutePath));
      const temporaryPath = `${absolutePath}.${process.pid}.${Date.now()}.${Math.random()}.tmp`;
      // An unknown write outcome retains its reservation. The next report can
      // then show the reservation instead of accidentally freeing budget.
      await writeFile(temporaryPath, bytes);
      await rename(temporaryPath, absolutePath);
      reservation?.commit(bytes.byteLength);
    })();
    assetWritePromises.set(absolutePath, writePromise);
  }

  try {
    await writePromise;
  } finally {
    if (assetWritePromises.get(absolutePath) === writePromise) {
      assetWritePromises.delete(absolutePath);
    }
  }

  return {
    pageNumber: 0,
    originalUrl: '',
    assetPath,
    contentHash,
    perceptualHash,
    bytes: bytes.byteLength,
  };
}

async function differenceHash(bytes: Buffer): Promise<string> {
  const { data, info } = await sharp(bytes)
    .greyscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let hash = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = data[(y * info.width + x) * info.channels] ?? 0;
      const right = data[(y * info.width + x + 1) * info.channels] ?? 0;
      hash = (hash << 1n) | (left > right ? 1n : 0n);
    }
  }
  return hash.toString(16).padStart(16, '0');
}

async function mirrorPage(
  outputDir: string,
  pageNumber: number,
  originalUrl: string,
  cache: Map<string, Promise<PageReference>>,
  storageBudget?: StorageBudget,
): Promise<PageReference> {
  let promise = cache.get(originalUrl);
  if (!promise) {
    promise = downloadOptimizedImage(originalUrl).then((body) =>
      storeAsset(outputDir, body, storageBudget),
    );
    cache.set(originalUrl, promise);
  }
  return { ...(await promise), pageNumber, originalUrl };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function errorCode(error: unknown): string {
  if (isRecord(error) && typeof error.code === 'string' && error.code.trim()) {
    return error.code;
  }
  if (isRecord(error) && error.name === 'StorageBudgetExceededError') {
    return 'STORAGE_BUDGET_EXCEEDED';
  }
  if (error instanceof Error && /budget|speicherbudget/i.test(error.message)) {
    return 'STORAGE_BUDGET_EXCEEDED';
  }
  return 'PAGE_DOWNLOAD_FAILED';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function pageFailure(
  page: { number: number; imageUrl: string },
  error: unknown,
  location?: string,
): PageFailure {
  return {
    pageNumber: page.number,
    originalUrl: page.imageUrl,
    code: errorCode(error),
    message: errorMessage(error),
    ...(location ? { location } : {}),
  };
}

function pageNumbersMatch(left: number[], right: number[]): boolean {
  return (
    left.length === right.length && left.every((pageNumber, index) => pageNumber === right[index])
  );
}

export function selectionManifest(
  selection: PageSelection,
  savedPages: PageReference[],
  failedPages: PageFailure[],
): PageSelectionManifest {
  const savedPageNumbers = savedPages.map((page) => page.pageNumber);
  const selectedPageNumbersAreValid =
    selection.selectedPageNumbers.length > 0 &&
    selection.selectedPageNumbers.every(
      (pageNumber, index, pageNumbers) =>
        Number.isInteger(pageNumber) && pageNumber > 0 && pageNumbers.indexOf(pageNumber) === index,
    );
  const complete =
    selection.mode === 'all-pages' &&
    failedPages.length === 0 &&
    pageNumbersMatch(selection.deliveredPageNumbers, selection.selectedPageNumbers) &&
    selectedPageNumbersAreValid &&
    savedPageNumbers.length === selection.selectedPageNumbers.length &&
    savedPageNumbers.every(
      (pageNumber, index) => pageNumber === selection.selectedPageNumbers[index],
    );
  return {
    mode: selection.mode,
    deliveredPageNumbers: selection.deliveredPageNumbers,
    selectedPageNumbers: selection.selectedPageNumbers,
    savedPageNumbers,
    failedPages,
    complete,
  };
}

function diagnosticIsIncomplete(diagnostic: DiagnosticRecord): boolean {
  const severity = diagnostic.severity?.toLocaleLowerCase('de-DE');
  if (severity === 'error' || severity === 'incomplete' || severity === 'failed') return true;
  const status = typeof diagnostic.status === 'string' ? diagnostic.status.toLowerCase() : '';
  if (status === 'failed' || status === 'incomplete') return true;
  const code = typeof diagnostic.code === 'string' ? diagnostic.code.toLowerCase() : '';
  return /failed|missing|invalid|unprocess|incomplete|l[uü]cke|fehlt|ungültig/.test(code);
}

function diagnosticIsRuntimeFailure(diagnostic: DiagnosticRecord): boolean {
  const code = typeof diagnostic.code === 'string' ? diagnostic.code.toLowerCase() : '';
  const kind = typeof diagnostic.kind === 'string' ? diagnostic.kind.toLowerCase() : '';
  return /fetch|download|budget|offers[-_]list[-_]failed|detail[-_]fetch[-_]failed|location[-_]fetch[-_]failed|crawl[-_].*fail|fail.*crawl/.test(
    `${code} ${kind}`,
  );
}

export function deriveSampleRunStatus(
  completeness: SampleManifest['completeness'],
  errorCount: number,
  pageFailures: readonly PageFailure[],
  diagnostics: readonly DiagnosticRecord[],
): SampleManifest['status'] {
  return errorCount > 0 || pageFailures.length > 0 || diagnostics.some(diagnosticIsRuntimeFailure)
    ? 'failed'
    : completeness;
}

function matchesStoreFilter(brochure: CrawlerBrochure, stores: string[]): boolean {
  const storeId = brochure.storeId.toLocaleLowerCase('de-DE');
  return stores.some((store) => storeId.includes(store));
}

async function saveManifest(outputDir: string, manifest: SampleManifest): Promise<void> {
  const path = join(outputDir, 'manifest.json');
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(manifest, null, 2), 'utf8');
  await rename(temporaryPath, path);
}

async function writeJsonAtomically(path: string, value: unknown): Promise<void> {
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(value, null, 2), 'utf8');
  await rename(temporaryPath, path);
}

async function saveReport(
  reportDir: string,
  manifest: SampleManifest,
  storageBudget?: StorageBudget,
): Promise<void> {
  try {
    await ensureDirectory(reportDir);
  } catch (error) {
    console.warn(`⚠️ Prüfberichte konnten nicht vorbereitet werden: ${errorMessage(error)}`);
    return;
  }

  let assets: StorageAsset[] = [];
  let inventoryError: string | undefined;
  try {
    const assetsDir = join(manifest.outputDir, 'assets');
    if (await exists(assetsDir)) assets = await listLocalAssets(manifest.outputDir, assetsDir);
  } catch (error) {
    inventoryError = errorMessage(error);
    console.warn(`⚠️ Asset-Inventur für Prüfberichte fehlgeschlagen: ${inventoryError}`);
  }

  const budget = storageBudget?.snapshot() ?? manifest.storageBudget ?? null;
  const retentionBrochures: RetentionBrochure[] = manifest.brochures.map((brochure) => ({
    id: brochure.id,
    validUntil: brochure.validUntil,
    assetKeys: brochure.pages.map((page) => page.assetPath),
  }));
  const retentionReport = createRetentionReport({
    assets,
    brochures: retentionBrochures,
    retentionGraceDays: manifest.retentionGraceDays,
    // Auch ein vollständiger Sample-Lauf kennt keine älteren oder fremden
    // Referenzen. Eine Bereinigungsfreigabe braucht einen globalen Bestand.
    referenceBasisComplete: false,
    budget: storageBudget ?? manifest.storageBudget,
    additionallyNeededBytes: budget?.reservedBytes ?? 0,
  });
  const storageReport = {
    generatedAt: new Date().toISOString(),
    target: 'local' as const,
    ...(manifest.storageBudgetGb === undefined ? {} : { budgetGb: manifest.storageBudgetGb }),
    budget,
    assets,
    ...(inventoryError ? { inventoryError } : {}),
  };

  const reports = [
    ['sample-report.json', manifest],
    ['storage-report.json', storageReport],
    ['retention-report.json', retentionReport],
  ] as const;
  for (const [filename, value] of reports) {
    try {
      await writeJsonAtomically(join(reportDir, filename), value);
    } catch (error) {
      console.warn(`⚠️ ${filename} konnte nicht geschrieben werden: ${errorMessage(error)}`);
    }
  }
}

async function loadAssetCache(outputDir: string): Promise<Map<string, Promise<PageReference>>> {
  const cache = new Map<string, Promise<PageReference>>();
  try {
    const previous = JSON.parse(await readFile(join(outputDir, 'manifest.json'), 'utf8')) as {
      brochures?: Array<{ pages?: PageReference[] }>;
    };
    for (const brochure of previous.brochures ?? []) {
      for (const page of brochure.pages ?? []) {
        if (
          page.originalUrl &&
          page.assetPath &&
          page.contentHash &&
          page.perceptualHash &&
          page.bytes > 0 &&
          page.assetPath.endsWith(`${page.contentHash}.jpg`) &&
          (await exists(join(outputDir, page.assetPath)))
        ) {
          cache.set(page.originalUrl, Promise.resolve(page));
        }
      }
    }
  } catch {
    // Ein neuer oder unvollständiger Lauf startet mit leerem Cache.
  }
  return cache;
}

export function buildManifest(
  options: SampleOptions,
  sightings: BrochureSighting[],
  successfulLocations: Set<string>,
  errors: Array<{ location: string; message: string }>,
  diagnostics: DiagnosticRecord[],
): SampleManifest {
  const recordsByVariant = new Map<string, BrochureRecord>();
  for (const sighting of sightings) {
    const contentSignature = sighting.pages.map((page) => page.contentHash).join(':');
    const variantScope =
      sighting.pageSelection.complete && contentSignature
        ? contentSignature
        : `${sighting.location}:${sighting.pageSelection.mode}:${contentSignature}`;
    const key = `${sighting.storeId}:${sighting.id}:${variantScope}`;
    const existing = recordsByVariant.get(key);
    if (existing) {
      if (!existing.locations.includes(sighting.location)) {
        existing.locations.push(sighting.location);
      }
      continue;
    }
    recordsByVariant.set(key, {
      id: sighting.id,
      storeId: sighting.storeId,
      storeName: sighting.storeName,
      title: sighting.title,
      validFrom: sighting.validFrom,
      validUntil: sighting.validUntil,
      contentSignature,
      locations: [sighting.location],
      pages: sighting.pages,
      pageSelection: sighting.pageSelection,
    });
  }

  const records = [...recordsByVariant.values()].sort(
    (a, b) => a.storeName.localeCompare(b.storeName) || a.id.localeCompare(b.id),
  );
  const observedPages = sightings.flatMap((sighting) => sighting.pages);
  const uniqueAssets = new Map(observedPages.map((page) => [page.contentHash, page]));
  const observedBytes = observedPages.reduce((sum, page) => sum + page.bytes, 0);
  const uniqueBytes = [...uniqueAssets.values()].reduce((sum, page) => sum + page.bytes, 0);
  const duplicateBytes = observedBytes - uniqueBytes;
  const contentGroups = new Map<string, BrochureSighting[]>();
  for (const sighting of sightings) {
    const signature = sighting.pages.map((page) => page.contentHash).join(':');
    const groupKey =
      sighting.pageSelection.complete && signature
        ? signature
        : `${sighting.location}:${sighting.pageSelection.mode}:${signature}`;
    const group = contentGroups.get(groupKey) ?? [];
    group.push(sighting);
    contentGroups.set(groupKey, group);
  }
  const duplicateGroups = [...contentGroups.entries()]
    .filter(([, group]) => group.length > 1 && group[0]?.pageSelection.complete)
    .map(([groupKey, group]) => ({
      contentSignature: groupKey,
      sightingCount: group.length,
      brochureIds: [...new Set(group.map((sighting) => sighting.id))],
      storeNames: [...new Set(group.map((sighting) => sighting.storeName))],
      locations: [...new Set(group.map((sighting) => sighting.location))],
    }));
  const uniqueBrochureIds = new Set(
    sightings.map((sighting) => `${sighting.storeId}:${sighting.id}`),
  ).size;
  const controlLocationLabels = new Set(
    options.locations.filter((location) => location.control).map((location) => location.label),
  );
  const aldiNordControlHits = new Set(
    sightings
      .filter(
        (sighting) =>
          controlLocationLabels.has(sighting.location) &&
          sighting.storeName.toLocaleLowerCase('de-DE').includes('nord'),
      )
      .map((sighting) => sighting.location),
  ).size;
  const storeGroups = Map.groupBy(sightings, (sighting) => sighting.storeId);
  const storeSummaries = [...storeGroups.entries()]
    .map(([storeId, storeSightings]) => ({
      storeId,
      storeName: storeSightings[0]?.storeName ?? storeId,
      sightings: storeSightings.length,
      locations: new Set(storeSightings.map((sighting) => sighting.location)).size,
      uniqueBrochureIds: new Set(storeSightings.map((sighting) => sighting.id)).size,
      uniqueContentVersions: new Set(
        storeSightings.map((sighting) => sighting.pages.map((page) => page.contentHash).join(':')),
      ).size,
    }))
    .sort((a, b) => a.storeName.localeCompare(b.storeName));

  const pageFailures = sightings.flatMap((sighting) =>
    sighting.pageSelection.failedPages.map((failure) => ({
      ...failure,
      location: failure.location ?? sighting.location,
    })),
  );
  const incompleteLocationLabels = new Set([
    ...errors.map((error) => error.location),
    ...sightings
      .filter((sighting) => !sighting.pageSelection.complete)
      .map((sighting) => sighting.location),
    ...diagnostics
      .filter(diagnosticIsIncomplete)
      .flatMap((diagnostic) =>
        typeof diagnostic.location === 'string' ? [diagnostic.location] : [],
      ),
  ]);
  const pagesDelivered = sightings.reduce(
    (sum, sighting) => sum + sighting.pageSelection.deliveredPageNumbers.length,
    0,
  );
  const pagesSelected = sightings.reduce(
    (sum, sighting) => sum + sighting.pageSelection.selectedPageNumbers.length,
    0,
  );
  const pagesSaved = sightings.reduce(
    (sum, sighting) => sum + sighting.pageSelection.savedPageNumbers.length,
    0,
  );
  const completeness =
    options.pagesPerBrochure === 'all' &&
    successfulLocations.size === options.locations.length &&
    errors.length === 0 &&
    pageFailures.length === 0 &&
    !diagnostics.some(diagnosticIsIncomplete) &&
    sightings.every((sighting) => sighting.pageSelection.complete)
      ? 'complete'
      : 'partial';
  const status = deriveSampleRunStatus(completeness, errors.length, pageFailures, diagnostics);

  return {
    version: 6,
    status,
    generatedAt: new Date().toISOString(),
    source: 'bring-de-live',
    storeFilters: options.stores,
    pagesPerBrochure: options.pagesPerBrochure,
    pageSelection:
      options.pagesPerBrochure === 'all' ? 'all-pages' : 'first-pages-with-discount-hotspots',
    selectionMode:
      options.pagesPerBrochure === 'all' ? 'all-pages' : 'first-pages-with-discount-hotspots',
    outputDir: options.outputDir,
    reportDir: options.reportDir,
    ...(options.storageBudgetGb === undefined ? {} : { storageBudgetGb: options.storageBudgetGb }),
    ...(options.storageBudget ? { storageBudget: options.storageBudget.snapshot() } : {}),
    retentionGraceDays: options.retentionGraceDays,
    sampleSize: options.sampleSize,
    locations: options.locations.map(({ label, zipCode, control }) => ({
      label,
      zipCode,
      ...(control ? { control } : {}),
    })),
    brochures: records,
    storeSummaries,
    duplicateGroups,
    summary: {
      locationsTotal: options.locations.length,
      locationsSuccessful: successfulLocations.size,
      locationsFailed: errors.length,
      locationsWithTargetStores: new Set(sightings.map((sighting) => sighting.location)).size,
      brochureSightings: sightings.length,
      uniqueBrochureIds,
      uniqueIdAndContentVariants: records.length,
      uniqueContentVersions: contentGroups.size,
      repeatedSameContentSightings: sightings.length - records.length,
      pageReferences: observedPages.length,
      duplicatePageReferences: observedPages.length - uniqueAssets.size,
      uniqueAssets: uniqueAssets.size,
      observedBytes,
      uniqueBytes,
      duplicateBytes,
      deduplicationPercent: observedBytes === 0 ? 0 : (duplicateBytes / observedBytes) * 100,
      pagesDelivered,
      pagesSelected,
      pagesSaved,
      pagesFailed: pageFailures.length,
      incompleteBrochures: sightings.filter((sighting) => !sighting.pageSelection.complete).length,
      incompleteLocations: incompleteLocationLabels.size,
      confirmedAldiNordControls: controlLocationLabels.size,
      confirmedAldiNordControlHits: aldiNordControlHits,
    },
    errors,
    pageFailures,
    completeness,
    diagnostics,
  };
}

async function main(): Promise<void> {
  const options = await parseOptions();
  const sightings: BrochureSighting[] = [];
  const successfulLocations = new Set<string>();
  const errors: Array<{ location: string; message: string }> = [];
  const diagnostics: DiagnosticRecord[] = [];
  let storageBudget: StorageBudget | undefined;

  await ensureDirectory(join(options.outputDir, 'assets'));
  await ensureDirectory(options.reportDir);
  storageBudget = await createSampleStorageBudget(options.outputDir, options.storageBudgetGb);
  options.storageBudget = storageBudget;

  const source = new LiveOfferBrochureSource({
    storeNameIncludes: options.stores,
    detailCacheByLocation: true,
  });
  const assetCache = await loadAssetCache(options.outputDir);

  console.log('\n🛒 Händler-Prospekt-Sample V5');
  console.log(`📍 ${options.locations.length} geografisch verteilte PLZ`);
  console.log(`🏬 Händler: ${options.stores.join(', ')}`);
  console.log(
    options.pagesPerBrochure === 'all'
      ? '📄 Alle gelieferten Seiten pro Prospekt, auch ohne Hotspot'
      : `📄 Die ersten ${options.pagesPerBrochure} Seiten mit Produktangeboten pro Prospekt`,
  );
  console.log(`💾 Ausgabe: ${options.outputDir}`);
  console.log(`🧾 Prüfberichte: ${options.reportDir}`);
  if (options.storageBudgetGb !== undefined) {
    console.log(`💽 Speicherbudget: ${options.storageBudgetGb} GB (dezimal)`);
  }
  console.log(`🗓️ Aufbewahrungsnachfrist: ${options.retentionGraceDays} Tage`);
  console.log(`⚡ Concurrency: ${options.concurrency}\n`);
  if (assetCache.size > 0) console.log(`♻️ Resume-Cache: ${assetCache.size} Seiten\n`);

  for (let index = 0; index < options.locations.length; index += options.concurrency) {
    const chunk = options.locations.slice(index, index + options.concurrency);
    await Promise.all(
      chunk.map(async (location) => {
        try {
          const sourceReport = await source.fetchBrochuresForLocationWithDiagnostics(location);
          const locationDiagnostics = sourceReport.diagnostics.map((diagnostic) =>
            reportDiagnostic(diagnostic, location.label),
          );
          diagnostics.push(...locationDiagnostics);
          if (sourceReport.status === 'failed' && sourceReport.results.length === 0) {
            const message =
              sourceReport.diagnostics[0]?.message ??
              `Quelle für ${location.label} ist fehlgeschlagen.`;
            errors.push({ location: location.label, message });
            console.warn(`⚠️ ${location.label}: ${message}`);
            return;
          }
          if (
            sourceReport.status !== 'complete' ||
            locationDiagnostics.some(diagnosticIsIncomplete)
          ) {
            console.warn(`⚠️ ${location.label}: Quelle meldet unvollständige Daten`);
          }
          let found = 0;
          let locationPageFailures = 0;
          for (const result of sourceReport.results) {
            for (const brochure of result.brochures.filter((brochure) =>
              matchesStoreFilter(brochure, options.stores),
            )) {
              const selection = selectBrochurePages(brochure, options.pagesPerBrochure);
              const pages: PageReference[] = [];
              const failedPages: PageFailure[] = [];
              const pageResults = await Promise.allSettled(
                selection.selectedPages.map((page) =>
                  mirrorPage(
                    options.outputDir,
                    page.number,
                    page.imageUrl,
                    assetCache,
                    options.storageBudget,
                  ),
                ),
              );
              for (const [index, pageResult] of pageResults.entries()) {
                const page = selection.selectedPages[index];
                if (!page) continue;
                if (pageResult.status === 'fulfilled') {
                  pages.push(pageResult.value);
                } else {
                  const failure = pageFailure(page, pageResult.reason, location.label);
                  failedPages.push(failure);
                  diagnostics.push({
                    code: failure.code,
                    kind: 'page-download-failed',
                    location: location.label,
                    brochureId: brochure.id,
                    pageNumber: failure.pageNumber,
                    originalValue: failure.originalUrl,
                    message: failure.message,
                  });
                }
              }
              locationPageFailures += failedPages.length;
              const pageSelection = selectionManifest(selection, pages, failedPages);
              sightings.push({
                id: brochure.id,
                storeId: brochure.storeId,
                storeName: result.store.name,
                title: brochure.title,
                validFrom: brochure.validFrom,
                validUntil: brochure.validUntil,
                location: location.label,
                pages,
                pageSelection,
              });
              found++;
            }
          }
          const locationComplete =
            sourceReport.status === 'complete' &&
            !locationDiagnostics.some(diagnosticIsIncomplete) &&
            locationPageFailures === 0;
          if (locationComplete) successfulLocations.add(location.label);
          console.log(
            `${locationComplete ? '✅' : '⚠️'} ${location.label}: ${found} passende Prospekte${locationComplete ? '' : ' (unvollständig)'}`,
          );
        } catch (error) {
          errors.push({ location: location.label, message: errorMessage(error) });
          diagnostics.push({
            code: 'LOCATION_CRAWL_FAILED',
            kind: 'location-fetch-failed',
            location: location.label,
            message: errorMessage(error),
          });
          console.warn(`⚠️ ${location.label}: ${errorMessage(error)}`);
        }
      }),
    );
    const chunkManifest = buildManifest(
      options,
      sightings,
      successfulLocations,
      errors,
      diagnostics,
    );
    await saveReport(options.reportDir, chunkManifest, storageBudget);
    await saveManifest(options.outputDir, chunkManifest);
  }

  const manifest = buildManifest(options, sightings, successfulLocations, errors, diagnostics);
  await saveReport(options.reportDir, manifest, storageBudget);
  await saveManifest(options.outputDir, manifest);
  console.log('\n✅ Sample-Lauf abgeschlossen');
  console.log(
    `📍 Erfolgreiche PLZ: ${manifest.summary.locationsSuccessful}/${manifest.summary.locationsTotal}`,
  );
  console.log(`🏪 PLZ mit passenden Händlern: ${manifest.summary.locationsWithTargetStores}`);
  if (manifest.summary.confirmedAldiNordControls > 0) {
    console.log(
      `🧪 Bestätigte ALDI-Nord-Kontrollpunkte: ${manifest.summary.confirmedAldiNordControlHits}/${manifest.summary.confirmedAldiNordControls} von Bring erkannt`,
    );
  }
  console.log(`📑 Prospekt-Treffer: ${manifest.summary.brochureSightings}`);
  console.log(`🆔 Eindeutige Prospekt-IDs: ${manifest.summary.uniqueBrochureIds}`);
  console.log(`🧩 Eindeutige Inhaltsversionen: ${manifest.summary.uniqueContentVersions}`);
  console.log(`🖼️ Seitenreferenzen: ${manifest.summary.pageReferences}`);
  console.log(
    `💾 Ohne Deduplizierung: ${formatBytes(manifest.summary.observedBytes)} | Einzigartig: ${formatBytes(manifest.summary.uniqueBytes)}`,
  );
  console.log(
    `♻️ Duplikate vermieden: ${manifest.summary.duplicatePageReferences} Seiten / ${formatBytes(manifest.summary.duplicateBytes)} (${manifest.summary.deduplicationPercent.toFixed(2)}%)`,
  );
  console.log(`📊 Laufstatus: ${manifest.status}`);
  if (manifest.errors.length > 0) console.log(`⚠️ Fehler: ${manifest.errors.length}`);
  if (manifest.status === 'failed') {
    process.exitCode = 1;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

if (process.argv[1]?.match(/[\\/]aldi-sample-v2\.ts$/)) {
  main().catch((error: unknown) => {
    console.error(`❌ ${errorMessage(error)}`);
    process.exitCode = 1;
  });
}
