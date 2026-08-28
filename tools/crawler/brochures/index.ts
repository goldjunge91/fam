import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { crawlAllLocations } from './engine';
import { type LocationFilterOptions, loadTargetLocations } from './locations';
import { loadR2Config } from './r2-storage';
import { getSourcesByName } from './sources';
import type { LocationDump } from './types';
import {
  createSupabaseUploaderClient,
  uploadDumpsInParallel,
  uploadSingleBatch,
} from './uploader';

function loadEnvFiles() {
  const files = [
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

function renderProgressBar(
  current: number,
  total: number,
  startTime: number,
  extra: string,
): void {
  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const barLength = 16;
  const filled = Math.round((percent / 100) * barLength);
  const empty = barLength - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
  const speed = (current / elapsedSec).toFixed(1);
  const remainingSec = current > 0 && total > current ? (total - current) / (current / elapsedSec) : 0;
  const etaStr = remainingSec > 0 ? formatDuration(remainingSec) : '0s';

  process.stdout.write(
    `\r⏳ [${bar}] ${percent}% | ${current}/${total} PLZ | ${speed} PLZ/s | ⏱️ ETA: ${etaStr} | ${extra}    `,
  );
}

function parseArgs(): {
  filterOptions: LocationFilterOptions;
  concurrency: number;
  sourcesList?: string[];
  dryRun: boolean;
  fromBackup: boolean;
} {
  const args = process.argv.slice(2);
  const filterOptions: LocationFilterOptions = {};
  let concurrency = 12;
  let sourcesList: string[] | undefined;
  let dryRun = false;
  let fromBackup = false;

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
      concurrency = Number.parseInt(arg.slice('--concurrency='.length), 10) || 12;
    } else if (arg.startsWith('--sources=')) {
      sourcesList = arg
        .slice('--sources='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  return { filterOptions, concurrency, sourcesList, dryRun, fromBackup };
}

async function main() {
  loadEnvFiles();
  const { filterOptions, concurrency, sourcesList, dryRun, fromBackup } = parseArgs();

  console.log('\n🛒 ====================================================');
  console.log('   Fam Prospekte & Supermarkt-Crawler (Batch Engine)');
  console.log('====================================================\n');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const runStartedAt = new Date().toISOString();
  const startTime = Date.now();

  const supabase = createSupabaseUploaderClient({
    supabaseUrl,
    supabaseSecretKey,
    dryRun: dryRun || !supabaseUrl || !supabaseSecretKey,
  });

  if (fromBackup) {
    const backupPath = join(process.cwd(), 'tools', 'crawler', 'data', 'last_crawl_backup.json');
    if (!existsSync(backupPath)) {
      throw new Error(`Backup-Datei nicht gefunden: ${backupPath}`);
    }
    console.log(`📂 Lade Daten aus lokalem Backup: ${backupPath}`);
    const dumps = JSON.parse(readFileSync(backupPath, 'utf8')) as LocationDump[];
    const uniqueBrochuresCount = new Set(
      dumps.flatMap((d) => d.brochures.map((b) => b.id)),
    ).size;
    console.log(`📦 ${dumps.length} Dumps (${uniqueBrochuresCount} Prospekte) bereit für Upload.\n`);

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
    console.log(`  ✅ Upload aus Backup abgeschlossen in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
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
  const hasLiveTokens = Boolean(process.env.BRING_AUTH_TOKEN && process.env.BRING_API_KEY);
  const r2Config = loadR2Config();

  console.log(`📌 Filter: ${JSON.stringify(filterOptions)}`);
  console.log(`📍 Ziel-Standorte: ${locations.length} PLZ`);
  console.log(`🏬 Aktive Quellen: ${sources.map((s) => s.name).join(', ')}`);
  console.log(`🔑 Live-Tokens aktiv: ${hasLiveTokens ? 'JA (echte Prospektdaten)' : 'NEIN'}`);
  console.log(`☁️ R2-Bild-Hosting: ${r2Config ? `JA (${r2Config.publicUrl})` : 'NEIN (Original-URLs)'}`);
  console.log(`⚡ Concurrency: ${concurrency} | Streaming-Upload: ${supabase ? 'JA' : 'NEIN (Dry-Run)'}\n`);

  let totalUploaded = 0;
  let totalStoresCount = 0;

  const result = await crawlAllLocations(locations, {
    concurrency,
    sources,
    r2Config: r2Config || undefined,
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

  console.log('\n\n🎉 ====================================================');
  console.log(`  ✅ Abgeschlossen in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`  📦 Verarbeitete & hochgeladene PLZ-Dumps: ${supabase ? totalUploaded : result.dumps.length}`);
  console.log(`  📑 Eindeutige Prospekte: ${result.uniqueBrochuresCount}`);
  console.log(`  🏪 Aktualisierte Märkte: ${totalStoresCount}`);
  console.log('====================================================\n');
}

main().catch((err) => {
  console.error('💥 Schwerwiegender Fehler beim Crawler-Lauf:', err);
  process.exit(1);
});
