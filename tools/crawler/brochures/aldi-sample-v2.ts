import { createHash } from 'node:crypto';
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
import { downloadOptimizedImage } from './r2-storage';
import { loadTargetLocations } from './locations';
import { LiveOfferBrochureSource } from './sources/live-offers';
import type { BrochureLocation, CrawlerBrochure } from './types';

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
};

type BrochureSighting = Omit<BrochureRecord, 'contentSignature' | 'locations'> & {
  location: string;
};

type Manifest = {
  version: 5;
  generatedAt: string;
  source: 'bring-de-live';
  storeFilters: string[];
  pagesPerBrochure: number | 'all';
  pageSelection:
    | 'first-pages-with-discount-hotspots'
    | 'all-pages-with-discount-hotspots';
  outputDir: string;
  sampleSize: number;
  locations: Array<{ label: string; zipCode: string; control?: AldiNordControl }>;
  brochures: BrochureRecord[];
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
    confirmedAldiNordControls: number;
    confirmedAldiNordControlHits: number;
  };
  errors: Array<{ location: string; message: string }>;
};

type Options = {
  outputDir: string;
  sampleSize: number;
  concurrency: number;
  pagesPerBrochure: number | 'all';
  stores: string[];
  locations: SampleLocation[];
};

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function chooseEvenly<T>(items: T[], count: number): T[] {
  if (count >= items.length) return [...items];
  return Array.from({ length: count }, (_, index) => items[Math.floor((index * items.length) / count)]!);
}

async function sampleLocations(count: number, includeAldiNordControls: boolean): Promise<SampleLocation[]> {
  const allLocations = await loadTargetLocations({ all: true });
  const locationsByZipCode = new Map(allLocations.map((location) => [location.zipCode, location]));
  const controlLocations = (includeAldiNordControls ? CONFIRMED_ALDI_NORD_CONTROLS : []).map((control) => {
    const location = locationsByZipCode.get(control.zipCode);
    if (!location) throw new Error(`Bestätigte ALDI-Nord-PLZ fehlt in GeoNames: ${control.zipCode}`);
    return {
      ...location,
      label: `${location.cityName || 'Unbekannt'} (${location.zipCode})`,
      control: {
        kind: 'confirmed-aldi-nord' as const,
        storeAddress: control.storeAddress,
        sourceUrl: control.sourceUrl,
      },
    };
  });
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
    .map((group) => group[Math.floor(group.length / 2)]!)
    .sort((a, b) => a.zipCode.localeCompare(b.zipCode));
  const regionalZipCodes = new Set(regional.map((location) => location.zipCode));
  const randomSampleSize = count - controlLocations.length;
  const selected = regional.length >= randomSampleSize
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

async function parseOptions(): Promise<Options> {
  const outputDir = argument('output-dir');
  if (!outputDir) {
    throw new Error(
      'Bitte --output-dir setzen, zum Beispiel --output-dir="/Volumes/Programme/FamCrawler/retailer-sample"',
    );
  }

  const stores = (argument('stores') ?? 'lidl,kaufland,netto,rewe')
    .split(',')
    .map((store) => store.trim().toLocaleLowerCase('de-DE'))
    .filter(Boolean);
  if (stores.length === 0) throw new Error('--stores muss mindestens einen Händler enthalten.');

  const includeAldiNordControls = stores.some((store) => store.includes('aldi'));
  const minimumSampleSize = includeAldiNordControls ? CONFIRMED_ALDI_NORD_CONTROLS.length : 1;
  const sampleSize = Number.parseInt(argument('sample-size') ?? '100', 10);
  if (
    !Number.isInteger(sampleSize) ||
    sampleSize < minimumSampleSize ||
    sampleSize > 1000
  ) {
    throw new Error(`--sample-size muss zwischen ${minimumSampleSize} und 1000 liegen.`);
  }

  const concurrency = Number.parseInt(argument('concurrency') ?? '8', 10);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) {
    throw new Error('--concurrency muss zwischen 1 und 16 liegen.');
  }

  const pagesArgument = argument('pages') ?? '6';
  const pagesPerBrochure = pagesArgument === 'all' ? 'all' : Number.parseInt(pagesArgument, 10);
  if (
    pagesPerBrochure !== 'all' &&
    (!Number.isInteger(pagesPerBrochure) || pagesPerBrochure < 3 || pagesPerBrochure > 6)
  ) {
    throw new Error('--pages muss zwischen 3 und 6 liegen oder "all" sein.');
  }

  return {
    outputDir: resolve(outputDir),
    sampleSize,
    concurrency,
    pagesPerBrochure,
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

async function storeAsset(outputDir: string, body: ArrayBuffer): Promise<PageReference> {
  const bytes = Buffer.from(body);
  const contentHash = createHash('sha256').update(bytes).digest('hex');
  const perceptualHash = await differenceHash(bytes);
  const assetPath = `assets/${contentHash}.jpg`;
  const absolutePath = join(outputDir, assetPath);

  if (!(await exists(absolutePath))) {
    await ensureDirectory(dirname(absolutePath));
    const temporaryPath = `${absolutePath}.${process.pid}.${Date.now()}.${Math.random()}.tmp`;
    await writeFile(temporaryPath, bytes);
    await rename(temporaryPath, absolutePath);
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
): Promise<PageReference> {
  let promise = cache.get(originalUrl);
  if (!promise) {
    promise = downloadOptimizedImage(originalUrl).then((body) => storeAsset(outputDir, body));
    cache.set(originalUrl, promise);
  }
  return { ...(await promise), pageNumber, originalUrl };
}

function matchesStoreFilter(brochure: CrawlerBrochure, stores: string[]): boolean {
  const storeId = brochure.storeId.toLocaleLowerCase('de-DE');
  return stores.some((store) => storeId.includes(store));
}

function offerPages(brochure: CrawlerBrochure, count: number | 'all') {
  const pages = [...brochure.pages]
    .sort((a, b) => a.number - b.number)
    .filter((page) => page.hotspots.some((hotspot) => hotspot.kind === 'discount'));
  return count === 'all' ? pages : pages.slice(0, count);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function saveManifest(outputDir: string, manifest: Manifest): Promise<void> {
  const path = join(outputDir, 'manifest.json');
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(manifest, null, 2), 'utf8');
  await rename(temporaryPath, path);
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
          page.perceptualHash &&
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

function buildManifest(
  options: Options,
  sightings: BrochureSighting[],
  successfulLocations: Set<string>,
  errors: Array<{ location: string; message: string }>,
): Manifest {
  const recordsByVariant = new Map<string, BrochureRecord>();
  for (const sighting of sightings) {
    const contentSignature = sighting.pages.map((page) => page.contentHash).join(':');
    const key = `${sighting.storeId}:${sighting.id}:${contentSignature}`;
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
    const group = contentGroups.get(signature) ?? [];
    group.push(sighting);
    contentGroups.set(signature, group);
  }
  const duplicateGroups = [...contentGroups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([contentSignature, group]) => ({
      contentSignature,
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
        storeSightings.map((sighting) =>
          sighting.pages.map((page) => page.contentHash).join(':'),
        ),
      ).size,
    }))
    .sort((a, b) => a.storeName.localeCompare(b.storeName));

  return {
    version: 5,
    generatedAt: new Date().toISOString(),
    source: 'bring-de-live',
    storeFilters: options.stores,
    pagesPerBrochure: options.pagesPerBrochure,
    pageSelection:
      options.pagesPerBrochure === 'all'
        ? 'all-pages-with-discount-hotspots'
        : 'first-pages-with-discount-hotspots',
    outputDir: options.outputDir,
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
      confirmedAldiNordControls: controlLocationLabels.size,
      confirmedAldiNordControlHits: aldiNordControlHits,
    },
    errors,
  };
}

async function main(): Promise<void> {
  const options = await parseOptions();
  await ensureDirectory(join(options.outputDir, 'assets'));

  const source = new LiveOfferBrochureSource({
    storeNameIncludes: options.stores,
    detailCacheByLocation: true,
  });
  const assetCache = await loadAssetCache(options.outputDir);
  const sightings: BrochureSighting[] = [];
  const successfulLocations = new Set<string>();
  const errors: Array<{ location: string; message: string }> = [];

  console.log('\n🛒 Händler-Prospekt-Sample V5');
  console.log(`📍 ${options.locations.length} geografisch verteilte PLZ`);
  console.log(`🏬 Händler: ${options.stores.join(', ')}`);
  console.log(
    options.pagesPerBrochure === 'all'
      ? '📄 Alle Seiten mit Produktangeboten pro Prospekt'
      : `📄 Die ersten ${options.pagesPerBrochure} Seiten mit Produktangeboten pro Prospekt`,
  );
  console.log(`💾 Ausgabe: ${options.outputDir}`);
  console.log(`⚡ Concurrency: ${options.concurrency}\n`);
  if (assetCache.size > 0) console.log(`♻️ Resume-Cache: ${assetCache.size} Seiten\n`);

  for (let index = 0; index < options.locations.length; index += options.concurrency) {
    const chunk = options.locations.slice(index, index + options.concurrency);
    await Promise.all(
      chunk.map(async (location) => {
        try {
          const results = await source.fetchBrochuresForLocation(location);
          let found = 0;
          for (const result of results) {
            for (const brochure of result.brochures.filter((brochure) =>
              matchesStoreFilter(brochure, options.stores),
            )) {
              const selectedOfferPages = offerPages(brochure, options.pagesPerBrochure);
              if (selectedOfferPages.length === 0) continue;
              const pages = await Promise.all(
                selectedOfferPages.map((page) =>
                  mirrorPage(options.outputDir, page.number, page.imageUrl, assetCache),
                ),
              );
              sightings.push({
                id: brochure.id,
                storeId: brochure.storeId,
                storeName: result.store.name,
                title: brochure.title,
                validFrom: brochure.validFrom,
                validUntil: brochure.validUntil,
                location: location.label,
                pages,
              });
              found++;
            }
          }
          successfulLocations.add(location.label);
          console.log(`✅ ${location.label}: ${found} passende Prospekte`);
        } catch (error) {
          errors.push({ location: location.label, message: errorMessage(error) });
          console.warn(`⚠️ ${location.label}: ${errorMessage(error)}`);
        }
      }),
    );
    await saveManifest(
      options.outputDir,
      buildManifest(options, sightings, successfulLocations, errors),
    );
  }

  const manifest = buildManifest(options, sightings, successfulLocations, errors);
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
  if (manifest.errors.length > 0) console.log(`⚠️ Fehler: ${manifest.errors.length}`);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

main().catch((error: unknown) => {
  console.error(`❌ ${errorMessage(error)}`);
  process.exitCode = 1;
});
