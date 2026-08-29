import { createHash } from 'node:crypto';
import { access, mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { downloadOptimizedImage } from './r2-storage';
import { LiveOfferBrochureSource } from './sources/live-offers';
import type { BrochureLocation, CrawlerBrochure } from './types';

type Capital = BrochureLocation & { name: string };

type AssetReference = {
  pageNumber: number;
  originalUrl: string;
  assetPath: string;
  contentHash: string;
  bytes: number;
};

type BrochureRecord = {
  id: string;
  storeId: string;
  storeName: string;
  title: string;
  validFrom: string;
  validUntil: string;
  capitals: string[];
  pages: AssetReference[];
};

type RunManifest = {
  version: 2;
  generatedAt: string;
  source: 'bring-de-live';
  pagesPerBrochure: 2;
  outputDir: string;
  capitals: Array<{ name: string; zipCode: string }>;
  brochures: BrochureRecord[];
  summary: {
    capitalCount: number;
    successfulCapitals: number;
    failedCapitals: number;
    brochureCount: number;
    pageReferences: number;
    uniqueAssets: number;
    uniqueBytes: number;
  };
  errors: Array<{ capital: string; message: string }>;
};

const GERMAN_STATE_CAPITALS: Capital[] = [
  { name: 'Berlin', zipCode: '10115', latitude: 52.5323, longitude: 13.3846 },
  { name: 'Bremen', zipCode: '28195', latitude: 53.0758, longitude: 8.8072 },
  { name: 'Dresden', zipCode: '01067', latitude: 51.0504, longitude: 13.7373 },
  { name: 'Düsseldorf', zipCode: '40213', latitude: 51.2277, longitude: 6.7735 },
  { name: 'Erfurt', zipCode: '99084', latitude: 50.9787, longitude: 11.0328 },
  { name: 'Hamburg', zipCode: '20095', latitude: 53.5511, longitude: 9.9937 },
  { name: 'Hannover', zipCode: '30159', latitude: 52.3759, longitude: 9.732 },
  { name: 'Kiel', zipCode: '24103', latitude: 54.3233, longitude: 10.1228 },
  { name: 'Magdeburg', zipCode: '39104', latitude: 52.1316, longitude: 11.6399 },
  { name: 'Mainz', zipCode: '55116', latitude: 50.0012, longitude: 8.2763 },
  { name: 'München', zipCode: '80331', latitude: 48.1374, longitude: 11.5755 },
  { name: 'Potsdam', zipCode: '14467', latitude: 52.4009, longitude: 13.0591 },
  { name: 'Saarbrücken', zipCode: '66111', latitude: 49.2344, longitude: 6.9969 },
  { name: 'Schwerin', zipCode: '19053', latitude: 53.6288, longitude: 11.4148 },
  { name: 'Stuttgart', zipCode: '70173', latitude: 48.7758, longitude: 9.1829 },
  { name: 'Wiesbaden', zipCode: '65183', latitude: 50.0826, longitude: 8.24 },
];

type Options = {
  outputDir: string;
  concurrency: number;
  capitals: Capital[];
};

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function parseOptions(): Options {
  const outputDir = argument('output-dir');
  if (!outputDir) {
    throw new Error(
      'Bitte --output-dir setzen, zum Beispiel --output-dir="/Volumes/Programme/FamCrawler/aldi-v2"',
    );
  }

  const concurrencyValue = argument('concurrency');
  const concurrency = concurrencyValue ? Number.parseInt(concurrencyValue, 10) : 4;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) {
    throw new Error('--concurrency muss zwischen 1 und 16 liegen.');
  }

  const selectedNames = argument('capitals')
    ?.split(',')
    .map((name) => name.trim().toLocaleLowerCase('de-DE'))
    .filter(Boolean);
  const capitals = selectedNames
    ? GERMAN_STATE_CAPITALS.filter((capital) => selectedNames.includes(capital.name.toLocaleLowerCase('de-DE')))
    : GERMAN_STATE_CAPITALS;
  if (capitals.length === 0) {
    throw new Error(`Keine gültige Hauptstadt in --capitals gefunden. Erlaubt: ${GERMAN_STATE_CAPITALS.map((capital) => capital.name).join(', ')}`);
  }

  return { outputDir: resolve(outputDir), concurrency, capitals };
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

async function writeAssetIfMissing(outputDir: string, body: ArrayBuffer): Promise<AssetReference> {
  const bytes = Buffer.from(body);
  const contentHash = createHash('sha256').update(bytes).digest('hex');
  const assetPath = `assets/${contentHash}.jpg`;
  const absolutePath = join(outputDir, assetPath);

  if (!(await exists(absolutePath))) {
    await ensureDirectory(dirname(absolutePath));
    const temporaryPath = `${absolutePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporaryPath, bytes);
    await rename(temporaryPath, absolutePath);
  }

  return { pageNumber: 0, originalUrl: '', assetPath, contentHash, bytes: bytes.byteLength };
}

async function mirrorPage(
  outputDir: string,
  originalUrl: string,
  pageNumber: number,
  cache: Map<string, Promise<AssetReference>>,
): Promise<AssetReference> {
  let assetPromise = cache.get(originalUrl);
  if (!assetPromise) {
    assetPromise = downloadOptimizedImage(originalUrl).then((body) => writeAssetIfMissing(outputDir, body));
    cache.set(originalUrl, assetPromise);
  }

  const asset = await assetPromise;
  return { ...asset, pageNumber, originalUrl };
}

function isAldiBrochure(brochure: CrawlerBrochure): boolean {
  return brochure.storeId.toLocaleLowerCase('de-DE').includes('aldi');
}

function firstTwoPages(brochure: CrawlerBrochure) {
  return [...brochure.pages].sort((a, b) => a.number - b.number).slice(0, 2);
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function saveManifest(outputDir: string, manifest: RunManifest): Promise<void> {
  const path = join(outputDir, 'manifest.json');
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(manifest, null, 2), 'utf8');
  await rename(temporaryPath, path);
}

function buildManifest(
  options: Options,
  brochures: Map<string, BrochureRecord>,
  errors: Array<{ capital: string; message: string }>,
  successfulCapitals: Set<string>,
): RunManifest {
  const records = [...brochures.values()].sort((a, b) => a.storeName.localeCompare(b.storeName) || a.id.localeCompare(b.id));
  const pageReferences = records.reduce((sum, brochure) => sum + brochure.pages.length, 0);
  const assets = new Map(records.flatMap((brochure) => brochure.pages).map((page) => [page.contentHash, page]));

  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    source: 'bring-de-live',
    pagesPerBrochure: 2,
    outputDir: options.outputDir,
    capitals: options.capitals.map(({ name, zipCode }) => ({ name, zipCode })),
    brochures: records,
    summary: {
      capitalCount: options.capitals.length,
      successfulCapitals: successfulCapitals.size,
      failedCapitals: errors.length,
      brochureCount: records.length,
      pageReferences,
      uniqueAssets: assets.size,
      uniqueBytes: [...assets.values()].reduce((sum, page) => sum + page.bytes, 0),
    },
    errors,
  };
}

async function main(): Promise<void> {
  const options = parseOptions();
  await ensureDirectory(options.outputDir);
  await ensureDirectory(join(options.outputDir, 'assets'));

  const source = new LiveOfferBrochureSource();
  const assetCache = new Map<string, Promise<AssetReference>>();
  const brochures = new Map<string, BrochureRecord>();
  const errors: Array<{ capital: string; message: string }> = [];
  const successfulCapitals = new Set<string>();

  console.log('\n🛒 Aldi Prospekt-Crawler V2');
  console.log(`📍 Hauptstädte: ${options.capitals.map((capital) => capital.name).join(', ')}`);
  console.log(`📄 Seiten pro Prospekt: 2`);
  console.log(`💾 Ausgabe: ${options.outputDir}`);
  console.log(`⚡ Concurrency: ${options.concurrency}\n`);

  for (let index = 0; index < options.capitals.length; index += options.concurrency) {
    const chunk = options.capitals.slice(index, index + options.concurrency);
    await Promise.all(
      chunk.map(async (capital) => {
        try {
          const results = await source.fetchBrochuresForLocation(capital);
          const aldiResults = results.filter((result) => result.brochures.some(isAldiBrochure));
          let downloadedPages = 0;

          for (const result of aldiResults) {
            for (const brochure of result.brochures.filter(isAldiBrochure)) {
              const recordKey = `${brochure.storeId}:${brochure.id}`;
              const pages = await Promise.all(
                firstTwoPages(brochure).map((page) =>
                  mirrorPage(options.outputDir, page.imageUrl, page.number, assetCache),
                ),
              );
              const existing = brochures.get(recordKey);
              if (existing) {
                if (!existing.capitals.includes(capital.name)) existing.capitals.push(capital.name);
                continue;
              }

              brochures.set(recordKey, {
                id: brochure.id,
                storeId: brochure.storeId,
                storeName: result.store.name,
                title: brochure.title,
                validFrom: brochure.validFrom,
                validUntil: brochure.validUntil,
                capitals: [capital.name],
                pages,
              });
              downloadedPages += pages.length;
            }
          }

          successfulCapitals.add(capital.name);
          console.log(`✅ ${capital.name}: ${aldiResults.reduce((sum, result) => sum + result.brochures.filter(isAldiBrochure).length, 0)} Aldi-Prospekte, ${downloadedPages} neue Seiten`);
        } catch (error) {
          errors.push({ capital: capital.name, message: messageFor(error) });
          console.warn(`⚠️ ${capital.name} fehlgeschlagen: ${messageFor(error)}`);
        }

        await saveManifest(options.outputDir, buildManifest(options, brochures, errors, successfulCapitals));
      }),
    );
  }

  const manifest = buildManifest(options, brochures, errors, successfulCapitals);
  await saveManifest(options.outputDir, manifest);
  console.log('\n✅ V2-Lauf abgeschlossen');
  console.log(`🏙️ Erfolgreiche Hauptstädte: ${manifest.summary.successfulCapitals}/${manifest.summary.capitalCount}`);
  console.log(`📑 Aldi-Prospekte: ${manifest.summary.brochureCount}`);
  console.log(`🖼️ Seitenreferenzen: ${manifest.summary.pageReferences}`);
  console.log(`💾 Einzigartige Dateien: ${manifest.summary.uniqueAssets} (${formatBytes(manifest.summary.uniqueBytes)})`);
  if (manifest.errors.length > 0) console.log(`⚠️ Fehler: ${manifest.errors.length}`);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

main().catch((error: unknown) => {
  console.error(`❌ ${messageFor(error)}`);
  process.exitCode = 1;
});
