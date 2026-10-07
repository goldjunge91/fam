import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { assertCrawlerEnvironment } from './config';
import { crawlAllLocations } from './engine';
import {
  ensureLocalStorageDirectory,
  type LocalStorageConfig,
  listLocalStorageAssets,
  loadLocalStorageConfig,
} from './local-storage';
import { type LocationFilterOptions, loadTargetLocations } from './locations';
import { defaultCrawlerBackupPath } from './paths';
import { imageKeyFor, listR2Objects, loadR2Config } from './r2-storage';
import { getSourcesByName } from './sources';
import {
  createRetentionReport,
  createStorageBudget,
  decimalGbToBytes as decimalGbToBytesPolicy,
  type RetentionBrochure,
  type StorageAsset,
  type StorageBudget,
} from './storage-policy';
import type {
  CompletenessReport,
  CrawlBackupArtifact,
  CrawlDiagnosticsArtifact,
  CrawlerBrochure,
  LocationDump,
} from './types';
import { createSupabaseUploaderClient, uploadDumpsInParallel, uploadSingleBatch } from './uploader';

function loadEnvFiles() {
  const files = [
    join(process.cwd(), 'tools', 'crawler', '.env'),
    join(process.cwd(), '.env'),
    join(process.cwd(), '.env.local'),
    join(process.cwd(), '.env.development.local'),
    join(process.cwd(), 'tokens_backup.env'),
  ];
  for (const file of files) {
    if (existsSync(file)) {
      try {
        const content = readFileSync(file, 'utf8');
        for (const line of content.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const match = trimmed.match(/^([^=]+)=(.*)$/);
          if (match) {
            const key = match[1].trim();
            const val = match[2].trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      } catch {
        // Ignore
      }
    }
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

function renderProgressBar(current: number, total: number, startTime: number, extra: string): void {
  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const barLength = 16;
  const filled = Math.round((percent / 100) * barLength);
  const empty = barLength - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
  const speed = (current / elapsedSec).toFixed(1);
  const remainingSec =
    current > 0 && total > current ? (total - current) / (current / elapsedSec) : 0;
  const etaStr = remainingSec > 0 ? formatDuration(remainingSec) : '0s';

  process.stdout.write(
    `\r⏳ [${bar}] ${percent}% | ${current}/${total} PLZ | ${speed} PLZ/s | ⏱️ ETA: ${etaStr} | ${extra}    `,
  );
}

export type CrawlerCliOptions = {
  filterOptions: LocationFilterOptions;
  concurrency: number;
  sourcesList?: string[];
  dryRun: boolean;
  fromBackup: boolean;
  localDir?: string;
  localPublicUrl?: string;
  storageBudgetGb?: number;
  retentionGraceDays: number;
  reportDir?: string;
};

export function decimalGbToBytes(value: number): number {
  return decimalGbToBytesPolicy(value);
}

function parseStorageBudget(value: string): number {
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) {
    throw new Error('--storage-budget-gb muss eine nichtnegative Dezimalzahl in GB sein.');
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('--storage-budget-gb muss eine nichtnegative Dezimalzahl in GB sein.');
  }
  decimalGbToBytes(parsed);
  return parsed;
}

function parseNonNegativeInteger(name: string, value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`--${name} muss eine nichtnegative ganze Zahl sein.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`--${name} muss eine nichtnegative ganze Zahl sein.`);
  }
  return parsed;
}

export function parseArgs(args = process.argv.slice(2)): CrawlerCliOptions {
  const filterOptions: LocationFilterOptions = {};
  let concurrency = 12;
  let sourcesList: string[] | undefined;
  let dryRun = false;
  let fromBackup = false;
  let localDir: string | undefined;
  let localPublicUrl: string | undefined;
  let storageBudgetGb: number | undefined;
  let retentionGraceDays = 0;
  let reportDir: string | undefined;

  for (const arg of args) {
    if (arg === '--all') {
      filterOptions.all = true;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--from-backup' || arg === '--retry-upload') {
      fromBackup = true;
    } else if (arg.startsWith('--zone=')) {
      filterOptions.zone = arg.slice('--zone='.length).trim();
    } else if (arg.startsWith('--prefix=')) {
      filterOptions.prefixes = arg
        .slice('--prefix='.length)
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
    } else if (arg.startsWith('--plz=')) {
      filterOptions.zipCodes = arg
        .slice('--plz='.length)
        .split(',')
        .map((z) => z.trim())
        .filter(Boolean);
    } else if (arg.startsWith('--range=')) {
      const parts = arg.slice('--range='.length).split('-');
      if (parts.length === 2) {
        filterOptions.range = { from: parts[0].trim(), to: parts[1].trim() };
      }
    } else if (arg.startsWith('--sample=')) {
      const sampleVal = arg.slice('--sample='.length).replace('%', '').trim();
      filterOptions.samplePercent = Number.parseInt(sampleVal, 10);
    } else if (arg.startsWith('--offset=')) {
      filterOptions.sampleOffset = Number.parseInt(arg.slice('--offset='.length), 10);
    } else if (arg.startsWith('--partition=')) {
      const partVal = arg.slice('--partition='.length).split('/')[0];
      const partNum = Number.parseInt(partVal, 10);
      filterOptions.sampleOffset = Math.max(0, partNum - 1);
    } else if (arg.startsWith('--limit=')) {
      filterOptions.limit = Number.parseInt(arg.slice('--limit='.length), 10);
    } else if (arg.startsWith('--concurrency=')) {
      concurrency = parseNonNegativeInteger(
        'concurrency',
        arg.slice('--concurrency='.length).trim(),
      );
      if (concurrency < 1) throw new Error('--concurrency muss mindestens 1 sein.');
    } else if (arg.startsWith('--local-dir=')) {
      localDir = arg.slice('--local-dir='.length).trim();
    } else if (arg.startsWith('--local-public-url=')) {
      localPublicUrl = arg.slice('--local-public-url='.length).trim();
    } else if (arg.startsWith('--sources=')) {
      sourcesList = arg
        .slice('--sources='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg.startsWith('--storage-budget-gb=')) {
      storageBudgetGb = parseStorageBudget(arg.slice('--storage-budget-gb='.length).trim());
    } else if (arg.startsWith('--retention-grace-days=')) {
      retentionGraceDays = parseNonNegativeInteger(
        'retention-grace-days',
        arg.slice('--retention-grace-days='.length).trim(),
      );
    } else if (arg.startsWith('--report-dir=')) {
      const value = arg.slice('--report-dir='.length).trim();
      if (!value) throw new Error('--report-dir benötigt ein Verzeichnis.');
      reportDir = resolve(value);
    }
  }

  if (fromBackup && localDir) {
    throw new Error(
      '--local-dir ist nur für einen neuen Crawl verfügbar, nicht für --from-backup.',
    );
  }
  if (localPublicUrl && !localDir) {
    throw new Error('--local-public-url benötigt zusätzlich --local-dir.');
  }
  if (localDir && !dryRun && !localPublicUrl) {
    throw new Error(
      '--local-dir ohne --dry-run würde lokale Dateien speichern, aber Supabase weiter mit Original-URLs veröffentlichen. Nutze --dry-run oder zusätzlich --local-public-url.',
    );
  }

  return {
    filterOptions,
    concurrency,
    sourcesList,
    dryRun,
    fromBackup,
    localDir,
    localPublicUrl,
    storageBudgetGb,
    retentionGraceDays,
    reportDir,
  };
}

type StorageReport = {
  generatedAt: string;
  target: 'local' | 'r2' | 'none';
  budgetGb?: number;
  budget: ReturnType<StorageBudget['snapshot']> | null;
  assets: StorageAsset[];
  inventoryError?: string;
};

async function writeJsonAtomically(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(value, null, 2), 'utf8');
  await rename(temporaryPath, path);
}

async function readJsonIfPresent<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLocationDump(value: unknown): value is LocationDump {
  if (!isRecord(value) || !Array.isArray(value.stores) || !Array.isArray(value.brochures)) {
    return false;
  }
  const location = value.location;
  return (
    isRecord(location) &&
    typeof location.zipCode === 'string' &&
    typeof location.latitude === 'number' &&
    typeof location.longitude === 'number'
  );
}

function isCompletenessReport(value: unknown): value is CompletenessReport {
  if (!isRecord(value) || !Array.isArray(value.diagnostics)) return false;
  const location = value.location;
  return (
    isRecord(location) &&
    typeof location.zipCode === 'string' &&
    (value.status === 'complete' ||
      value.status === 'incomplete' ||
      value.status === 'failed' ||
      value.status === 'not-found')
  );
}

function isCrawlBackupArtifact(value: unknown): value is CrawlBackupArtifact {
  return (
    isRecord(value) &&
    value.version === 1 &&
    typeof value.runId === 'string' &&
    value.runId.length > 0 &&
    typeof value.generatedAt === 'string' &&
    Array.isArray(value.dumps) &&
    value.dumps.every(isLocationDump)
  );
}

function isCrawlDiagnosticsArtifact(value: unknown): value is CrawlDiagnosticsArtifact {
  return (
    isRecord(value) &&
    value.version === 1 &&
    typeof value.runId === 'string' &&
    value.runId.length > 0 &&
    typeof value.generatedAt === 'string' &&
    Array.isArray(value.reports) &&
    value.reports.every(isCompletenessReport)
  );
}

export type VerifiedBackupSelection = {
  runId: string;
  dumps: LocationDump[];
  skippedLocations: string[];
};

/** Gibt nur Dumps mit passender, explizit vollständiger Diagnose für den Upload frei. */
export function selectPublishableBackupDumps(
  backupValue: unknown,
  diagnosticsValue: unknown,
): VerifiedBackupSelection {
  if (!isCrawlBackupArtifact(backupValue)) {
    throw new Error(
      'Backup ist kein aktuelles Crawl-Artefakt mit Lauf-ID. Alte Array-Backups werden nicht veröffentlicht.',
    );
  }
  if (!isCrawlDiagnosticsArtifact(diagnosticsValue)) {
    throw new Error(
      'Zum Backup fehlt ein aktueller Diagnosebestand. Ohne Diagnosen wird kein Standort veröffentlicht.',
    );
  }
  if (backupValue.runId !== diagnosticsValue.runId) {
    throw new Error(
      `Backup und Diagnosen gehören zu unterschiedlichen Läufen (${backupValue.runId} / ${diagnosticsValue.runId}).`,
    );
  }

  const reportByZipCode = new Map<string, CompletenessReport>();
  for (const report of diagnosticsValue.reports) {
    const zipCode = report.location.zipCode;
    if (reportByZipCode.has(zipCode)) {
      throw new Error(`Diagnosebestand enthält die PLZ ${zipCode} mehrfach.`);
    }
    reportByZipCode.set(zipCode, report);
  }

  const dumps: LocationDump[] = [];
  const skippedLocations: string[] = [];
  for (const dump of backupValue.dumps) {
    const zipCode = dump.location.zipCode;
    const report = reportByZipCode.get(zipCode);
    if (report?.status === 'complete' && Array.isArray(report.diagnostics)) {
      dumps.push(dump);
    } else {
      skippedLocations.push(zipCode);
    }
  }

  if (dumps.length === 0) {
    throw new Error(
      'Das Backup enthält keinen Standort mit passender vollständiger Diagnose. Es wurde nichts veröffentlicht.',
    );
  }

  return { runId: backupValue.runId, dumps, skippedLocations };
}

function brochureAssetKeys(brochure: CrawlerBrochure, publicUrl?: string): string[] {
  const urls = [brochure.coverImage, ...brochure.pages.map((page) => page.imageUrl)].filter(
    (url): url is string => Boolean(url),
  );
  const normalizedPublicUrl = publicUrl?.replace(/\/+$/, '');
  return urls.map((url) => {
    if (normalizedPublicUrl && url.startsWith(`${normalizedPublicUrl}/`)) {
      return url.slice(normalizedPublicUrl.length + 1).split('?')[0] ?? '';
    }
    return imageKeyFor(url);
  });
}

function retentionBrochures(
  dumps: readonly LocationDump[],
  publicUrl?: string,
): RetentionBrochure[] {
  return dumps.flatMap((dump) =>
    dump.brochures.map((brochure) => ({
      id: `${dump.location.zipCode}:${brochure.storeId}:${brochure.id}`,
      validUntil: brochure.validUntil,
      assetKeys: brochureAssetKeys(brochure, publicUrl),
    })),
  );
}

type ReportContext = {
  reportDir?: string;
  storageTarget: 'local' | 'r2' | 'none';
  storageBudgetGb?: number;
  storageBudget?: StorageBudget;
  initialAssets: StorageAsset[];
  localStorage?: LocalStorageConfig;
  r2Config: ReturnType<typeof loadR2Config>;
  retentionGraceDays: number;
  publicUrl?: string;
};

async function inventoryForReports(
  context: ReportContext,
  useFreshInventory: boolean,
): Promise<{ assets: StorageAsset[]; inventoryError?: string }> {
  if (!useFreshInventory) return { assets: context.initialAssets };
  try {
    if (context.localStorage) {
      return { assets: await listLocalStorageAssets(context.localStorage.directory) };
    }
    if (context.r2Config) {
      return { assets: await listR2Objects(context.r2Config) };
    }
  } catch (error) {
    return {
      assets: context.initialAssets,
      inventoryError: error instanceof Error ? error.message : String(error),
    };
  }
  return { assets: [] };
}

async function writeCrawlerReports(
  context: ReportContext,
  dumps: readonly LocationDump[],
  reports: readonly CompletenessReport[],
  runId: string,
  useFreshInventory: boolean,
): Promise<void> {
  if (!context.reportDir) return;

  const inventory = await inventoryForReports(context, useFreshInventory);
  const budget = context.storageBudget?.snapshot() ?? null;
  // Ein einzelner Lauf kann weder ältere Referenzen noch fremde Bucket-Assets
  // vollständig kennen. Eine Freigabe bleibt bis zu einer späteren, globalen
  // Bestandsprüfung grundsätzlich ausgeschlossen.
  const referenceBasisComplete = false;
  const retentionReport = createRetentionReport({
    assets: inventory.assets,
    brochures: retentionBrochures(dumps, context.publicUrl),
    retentionGraceDays: context.retentionGraceDays,
    referenceBasisComplete,
    candidateKeyPrefix: 'brochures/dumps/',
    budget: context.storageBudget,
    additionallyNeededBytes: budget?.reservedBytes ?? 0,
  });
  const generatedAt = new Date().toISOString();
  const storageReport: StorageReport = {
    generatedAt,
    target: context.storageTarget,
    ...(context.storageBudgetGb === undefined ? {} : { budgetGb: context.storageBudgetGb }),
    budget,
    assets: inventory.assets,
    ...(inventory.inventoryError ? { inventoryError: inventory.inventoryError } : {}),
  };

  await writeJsonAtomically(join(context.reportDir, 'storage-report.json'), storageReport);
  await writeJsonAtomically(join(context.reportDir, 'retention-report.json'), retentionReport);
  const completenessReport: CrawlDiagnosticsArtifact = {
    version: 1,
    runId,
    generatedAt,
    reports: [...reports],
  };
  await writeJsonAtomically(
    join(context.reportDir, 'completeness-report.json'),
    completenessReport,
  );
}

async function main() {
  const {
    filterOptions,
    concurrency,
    sourcesList,
    dryRun,
    fromBackup,
    localDir,
    localPublicUrl,
    storageBudgetGb,
    retentionGraceDays,
    reportDir,
  } = parseArgs();
  loadEnvFiles();

  console.log('\n🛒 ====================================================');
  console.log('   Fam Prospekte & Supermarkt-Crawler (Batch Engine)');
  console.log('====================================================\n');

  const supabaseUrl: string =
    process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const supabaseSecretKey: string =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  const runStartedAt = new Date().toISOString();
  const startTime = Date.now();

  if (fromBackup) {
    assertCrawlerEnvironment({ dryRun, fromBackup, sourceNames: [] });
    const backupPath = defaultCrawlerBackupPath();
    if (!existsSync(backupPath)) {
      throw new Error(`Backup-Datei nicht gefunden: ${backupPath}`);
    }
    const diagnosticsPath = reportDir
      ? join(reportDir, 'crawl-diagnostics.json')
      : `${backupPath}.diagnostics.json`;
    console.log(`📂 Lade Daten aus lokalem Backup: ${backupPath}`);
    const backupValue = JSON.parse(readFileSync(backupPath, 'utf8')) as unknown;
    const diagnosticsValue = JSON.parse(readFileSync(diagnosticsPath, 'utf8')) as unknown;
    const verified = selectPublishableBackupDumps(backupValue, diagnosticsValue);
    const dumps = verified.dumps;
    if (verified.skippedLocations.length > 0) {
      console.warn(
        `⚠️ Überspringe ${verified.skippedLocations.length} Standort(e) ohne vollständige Laufdiagnose: ${verified.skippedLocations.join(', ')}`,
      );
    }
    const uniqueBrochuresCount = new Set(dumps.flatMap((d) => d.brochures.map((b) => b.id))).size;
    console.log(
      `📦 ${dumps.length} Dumps (${uniqueBrochuresCount} Prospekte) bereit für Upload.\n`,
    );

    const result = await uploadDumpsInParallel(
      dumps,
      { supabaseUrl, supabaseSecretKey, dryRun },
      {
        concurrency: 4,
        onProgress: (uploaded, total, storesCount) => {
          renderProgressBar(
            uploaded,
            total,
            startTime,
            `☁️ ${uploaded} in DB | 🏪 ${storesCount} Märkte`,
          );
        },
      },
    );

    console.log('\n\n🎉 ====================================================');
    console.log(
      `  ✅ Upload aus Backup abgeschlossen in ${((Date.now() - startTime) / 1000).toFixed(1)}s`,
    );
    console.log(`  📦 Hochgeladene PLZ-Dumps: ${result.uploadedCount}`);
    console.log(`  📑 Eindeutige Prospekte: ${uniqueBrochuresCount}`);
    console.log(`  🏪 Aktualisierte Märkte: ${result.storesCount}`);
    console.log('====================================================\n');
    return;
  }

  const locations = await loadTargetLocations(filterOptions);
  if (locations.length === 0) {
    console.warn('⚠️ Keine passenden Standorte für die angegebenen Filter gefunden.');
    return;
  }

  const sources = getSourcesByName(sourcesList);
  if (sources.length === 0) {
    throw new Error('Keine gültige Prospektquelle ausgewählt.');
  }
  assertCrawlerEnvironment({
    dryRun,
    fromBackup,
    sourceNames: sources.map((source) => source.name),
  });
  const supabase = createSupabaseUploaderClient({ supabaseUrl, supabaseSecretKey, dryRun });
  const hasLiveTokens = Boolean(
    process.env.BRING_AUTH_TOKEN && process.env.BRING_API_KEY && process.env.BRING_USER_UUID,
  );
  const storageBudgetBytes =
    storageBudgetGb === undefined ? undefined : decimalGbToBytes(storageBudgetGb);
  let storageBudget =
    storageBudgetBytes === undefined
      ? undefined
      : createStorageBudget({ budgetBytes: storageBudgetBytes });
  let initialAssets: StorageAsset[] = [];
  let localStorage: LocalStorageConfig | undefined = localDir
    ? loadLocalStorageConfig(localDir, localPublicUrl)
    : undefined;
  if (localStorage) {
    await ensureLocalStorageDirectory(localStorage);
    if (storageBudgetBytes !== undefined || reportDir) {
      initialAssets = await listLocalStorageAssets(localStorage.directory);
    }
    if (storageBudgetBytes !== undefined) {
      storageBudget = createStorageBudget({
        budgetBytes: storageBudgetBytes,
        existingAssets: initialAssets,
      });
      localStorage = loadLocalStorageConfig(localStorage.directory, localStorage.publicUrl, {
        storageBudgetBytes,
        storageBudget,
      });
    }
  }
  let r2Config = loadR2Config({
    disabled: dryRun || Boolean(localStorage),
    storageBudgetBytes,
    storageBudget,
  });
  if (r2Config && (storageBudgetBytes !== undefined || reportDir)) {
    initialAssets = await listR2Objects(r2Config);
    if (storageBudgetBytes !== undefined) {
      storageBudget = createStorageBudget({
        budgetBytes: storageBudgetBytes,
        existingAssets: initialAssets,
      });
      r2Config = loadR2Config({
        storageBudgetBytes,
        storageBudget,
      });
    }
  }
  if (reportDir) await mkdir(reportDir, { recursive: true });

  const reportContext: ReportContext = {
    reportDir,
    storageTarget: localStorage ? 'local' : r2Config ? 'r2' : 'none',
    ...(storageBudgetGb === undefined ? {} : { storageBudgetGb }),
    storageBudget,
    initialAssets,
    localStorage,
    r2Config,
    retentionGraceDays,
    publicUrl: localStorage?.publicUrl ?? r2Config?.publicUrl,
  };
  const backupPath = defaultCrawlerBackupPath();
  const diagnosticsPath = reportDir ? join(reportDir, 'crawl-diagnostics.json') : null;
  const persistReports = async (
    dumps: readonly LocationDump[],
    reports: readonly CompletenessReport[],
    runId: string,
    freshInventory: boolean,
  ): Promise<void> => {
    try {
      await writeCrawlerReports(reportContext, dumps, reports, runId, freshInventory);
    } catch (error) {
      console.warn(
        `⚠️ Prüfberichte konnten nicht geschrieben werden: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
  await persistReports([], [], runStartedAt, false);

  console.log(`📌 Filter: ${JSON.stringify(filterOptions)}`);
  console.log(`📍 Ziel-Standorte: ${locations.length} PLZ`);
  console.log(`🏬 Aktive Quellen: ${sources.map((s) => s.name).join(', ')}`);
  console.log(`🔑 Live-Tokens aktiv: ${hasLiveTokens ? 'JA (echte Prospektdaten)' : 'NEIN'}`);
  console.log(
    `☁️ R2-Bild-Hosting: ${r2Config ? `JA (${r2Config.publicUrl})` : 'NEIN (lokal/Original-URLs)'}`,
  );
  if (localStorage) {
    console.log(
      `💾 Lokale Bildablage: JA (${localStorage.directory})${localStorage.publicUrl ? ` | ${localStorage.publicUrl}` : ' | Original-URLs im Payload'}`,
    );
  }
  console.log(
    `⚡ Concurrency: ${concurrency} | Streaming-Upload: ${supabase ? 'JA' : 'NEIN (Dry-Run)'}\n`,
  );

  let totalUploaded = 0;
  let totalStoresCount = 0;

  let result: Awaited<ReturnType<typeof crawlAllLocations>>;
  try {
    result = await crawlAllLocations(locations, {
      concurrency,
      runId: runStartedAt,
      sources,
      r2Config: r2Config || undefined,
      localStorage,
      backupPath,
      diagnosticsPath,
      onProgress: (processed, total, uniqueCount) => {
        renderProgressBar(
          processed,
          total,
          startTime,
          `☁️ ${totalUploaded} in DB | 📑 ${uniqueCount} Prospekte`,
        );
      },
      onChunkDone: async (chunkDumps) => {
        if (supabase) {
          const uploadRes = await uploadSingleBatch(supabase, chunkDumps, runStartedAt);
          totalUploaded += uploadRes.uploadedCount;
          totalStoresCount += uploadRes.storesCount;
        }
      },
    });
  } catch (error) {
    const backupValue = await readJsonIfPresent<unknown>(backupPath);
    const diagnosticsValue = diagnosticsPath
      ? await readJsonIfPresent<unknown>(diagnosticsPath)
      : undefined;
    const dumps =
      isCrawlBackupArtifact(backupValue) && backupValue.runId === runStartedAt
        ? backupValue.dumps
        : [];
    const reports =
      isCrawlDiagnosticsArtifact(diagnosticsValue) && diagnosticsValue.runId === runStartedAt
        ? diagnosticsValue.reports
        : [];
    await persistReports(dumps, reports, runStartedAt, true);
    throw error;
  }
  await persistReports(result.dumps, result.reports, result.runId, true);

  console.log('\n\n🎉 ====================================================');
  console.log(`  ✅ Abgeschlossen in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(
    `  📦 Verarbeitete & hochgeladene PLZ-Dumps: ${supabase ? totalUploaded : result.dumps.length}`,
  );
  console.log(`  📑 Eindeutige Prospekte: ${result.uniqueBrochuresCount}`);
  console.log(`  🏪 Aktualisierte Märkte: ${totalStoresCount}`);
  console.log('====================================================\n');
}

if (process.argv[1]?.match(/[\\/]index\.ts$/)) {
  main().catch((err) => {
    console.error('💥 Schwerwiegender Fehler beim Crawler-Lauf:', err);
    process.exit(1);
  });
}
