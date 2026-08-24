#!/usr/bin/env bun

import { Database } from 'bun:sqlite';
import { closeSync, createReadStream, existsSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';
import { extractManifestImages, IMAGE_KINDS, type ImageKind } from './image-manifest';

const SOURCE_URL = 'https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz';
const DATA_DIR = process.env.OFF_IMAGE_DATA_DIR ?? process.env.DUMP_DATA_DIR ?? '/Volumes/Programme/off-dump-data';
const PRODUCTS_DB = process.env.OFF_PRODUCTS_DB ?? path.join(DATA_DIR, 'products_de.db');
const SOURCE_DUMP = process.env.OFF_SOURCE_DUMP ?? path.join(DATA_DIR, 'off_dump.jsonl.gz');
const IMAGE_DB = process.env.OFF_IMAGE_DB ?? path.join(DATA_DIR, 'product_images_de.db');
const IMAGE_ROOT = process.env.OFF_IMAGE_ROOT ?? path.join(DATA_DIR, 'product-images-de');
const IMAGE_OPERATION_LOCK = `${IMAGE_DB}.operation.lock`;
const USER_AGENT = 'NutriTrackCategoryLab/1.0 (local evaluation image dump)';
function requestedImageKind(): ImageKind {
  const value = process.env.OFF_IMAGE_KIND?.trim() || 'front';
  if (!(IMAGE_KINDS as readonly string[]).includes(value)) {
    throw new Error(`OFF_IMAGE_KIND ist ungültig: ${value}. Erlaubt: ${IMAGE_KINDS.join(', ')}.`);
  }
  return value as ImageKind;
}

function formatBytes(bytes: number): string {
  let value = bytes;
  for (const unit of ['B', 'KiB', 'MiB', 'GiB', 'TiB']) {
    if (value < 1024 || unit === 'TiB') return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
    value /= 1024;
  }
  return `${bytes} B`;
}

async function withImageOperationLock<T>(operation: string, action: () => Promise<T>): Promise<T> {
  let descriptor: number | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      descriptor = openSync(IMAGE_OPERATION_LOCK, 'wx');
      break;
    } catch (error) {
      const details = existsSync(IMAGE_OPERATION_LOCK) ? readFileSync(IMAGE_OPERATION_LOCK, 'utf8').trim() : '';
      const pid = /\bpid (\d+)\b/.exec(details)?.[1];
      let processIsRunning = true;
      if (pid) {
        try {
          process.kill(Number(pid), 0);
        } catch (processError) {
          processIsRunning = (processError as NodeJS.ErrnoException).code !== 'ESRCH';
        }
      }
      if (attempt === 0 && pid && !processIsRunning) {
        unlinkSync(IMAGE_OPERATION_LOCK);
        continue;
      }
      throw new Error(`Bildoperation läuft bereits${details ? ` (${details})` : ''}. Manifest und Download dürfen nicht parallel laufen.`, { cause: error });
    }
  }
  if (descriptor === null) throw new Error('Bildoperations-Lock konnte nicht erstellt werden.');
  writeFileSync(descriptor, `${operation}, pid ${process.pid}, ${new Date().toISOString()}`);
  closeSync(descriptor);
  try {
    return await action();
  } finally {
    if (existsSync(IMAGE_OPERATION_LOCK)) unlinkSync(IMAGE_OPERATION_LOCK);
  }
}

async function sourceMetadata(): Promise<{ size: number; etag: string | null }> {
  const response = await fetch(SOURCE_URL, { method: 'HEAD', redirect: 'follow' });
  if (!response.ok) throw new Error(`OFF-Dump HEAD fehlgeschlagen (${response.status}).`);
  const rawSize = response.headers.get('content-length');
  if (!rawSize) throw new Error('OFF-Dump liefert keine Content-Length.');
  return { size: Number(rawSize), etag: response.headers.get('etag') };
}

async function downloadSource(): Promise<void> {
  mkdirSync(DATA_DIR, { recursive: true });
  const metadata = await sourceMetadata();
  if (existsSync(SOURCE_DUMP) && statSync(SOURCE_DUMP).size === metadata.size) {
    console.log(`Produktdump bereits vollständig: ${SOURCE_DUMP} (${formatBytes(metadata.size)})`);
    return;
  }
  const partialPath = `${SOURCE_DUMP}.part`;
  console.log(`Lade vollständigen OFF-Produktdump (${formatBytes(metadata.size)}) nach ${partialPath}`);
  const process = Bun.spawn([
    'curl', '--fail', '--location', '--retry', '5', '--retry-delay', '5',
    '--continue-at', '-', '--output', partialPath, SOURCE_URL,
  ], { stdout: 'inherit', stderr: 'inherit' });
  const exitCode = await process.exited;
  if (exitCode !== 0) throw new Error(`curl wurde mit Exit-Code ${exitCode} beendet.`);
  const actualSize = statSync(partialPath).size;
  if (actualSize !== metadata.size) {
    throw new Error(`Download unvollständig: ${formatBytes(actualSize)} von ${formatBytes(metadata.size)}.`);
  }
  if (existsSync(SOURCE_DUMP)) {
    renameSync(SOURCE_DUMP, `${SOURCE_DUMP}.stale-${Date.now()}`);
  }
  renameSync(partialPath, SOURCE_DUMP);
  console.log(`Produktdump vollständig: ${SOURCE_DUMP}`);
}

function targetCodes(): Set<string> {
  if (!existsSync(PRODUCTS_DB)) throw new Error(`Produktdatenbank fehlt: ${PRODUCTS_DB}`);
  const db = new Database(PRODUCTS_DB, { readonly: true });
  const rows = db.query<{ code: string }, []>("select code from products where code glob '[0-9]*'").all();
  db.close();
  return new Set(rows.map((row) => row.code));
}

async function buildManifestUnlocked(): Promise<void> {
  if (!existsSync(SOURCE_DUMP)) throw new Error(`OFF-Quelldump fehlt: ${SOURCE_DUMP}`);
  const codes = targetCodes();
  const buildingPath = `${IMAGE_DB}.building`;
  if (existsSync(buildingPath)) renameSync(buildingPath, `${buildingPath}.stale-${Date.now()}`);
  const db = new Database(buildingPath, { create: true });
  db.exec(`
    pragma synchronous = off;
    pragma journal_mode = memory;
    create table image_files (
      local_path text primary key,
      aws_url text not null,
      status text not null default 'pending' check (status in ('pending', 'downloaded', 'failed')),
      byte_size integer,
      attempts integer not null default 0,
      error text,
      downloaded_at text
    );
    create table product_images (
      code text not null,
      kind text not null check (kind in ('front', 'ingredients', 'nutrition', 'packaging')),
      language text not null,
      imgid text not null,
      selected_url text not null,
      local_path text not null references image_files(local_path),
      primary key (code, kind)
    );
    create table image_dump_meta (
      source_dump text not null,
      source_size integer not null,
      target_product_count integer not null,
      matched_product_count integer not null,
      image_count integer not null,
      generated_at text not null
    );
  `);
  const insertFile = db.prepare(`
    insert or ignore into image_files (local_path, aws_url, status, byte_size, downloaded_at)
    values (?, ?, ?, ?, ?)
  `);
  const insertImage = db.prepare(`
    insert or replace into product_images (code, kind, language, imgid, selected_url, local_path)
    values (?, ?, ?, ?, ?, ?)
  `);
  const rawStream = createReadStream(SOURCE_DUMP);
  const lines = createInterface({ input: rawStream.pipe(createGunzip()), crlfDelay: Infinity });
  let lineCount = 0;
  let matchedProductCount = 0;
  let imageCount = 0;
  const startedAt = Date.now();

  db.exec('begin');
  try {
    for await (const line of lines) {
      lineCount++;
      if (lineCount % 50_000 === 0) {
        const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 1);
        console.log(`${lineCount.toLocaleString('de-DE')} Zeilen · ${matchedProductCount.toLocaleString('de-DE')} Produkte · ${imageCount.toLocaleString('de-DE')} Bilder · ${Math.round(lineCount / elapsedSeconds).toLocaleString('de-DE')} Zeilen/s`);
      }
      let raw: unknown;
      try {
        raw = JSON.parse(line);
      } catch (error) {
        throw new Error(`Ungültiges JSON in OFF-Zeile ${lineCount.toLocaleString('de-DE')}.`, { cause: error });
      }
      const manifest = extractManifestImages(raw);
      if (!manifest || !codes.has(manifest.code) || manifest.images.length === 0) continue;
      matchedProductCount++;
      for (const image of manifest.images) {
        const destination = path.join(IMAGE_ROOT, image.localPath);
        const downloaded = existsSync(destination) && statSync(destination).size > 0;
        const byteSize = downloaded ? statSync(destination).size : null;
        const downloadedAt = downloaded ? new Date(statSync(destination).mtimeMs).toISOString() : null;
        insertFile.run(image.localPath, image.awsUrl, downloaded ? 'downloaded' : 'pending', byteSize, downloadedAt);
        insertImage.run(manifest.code, image.kind, image.language, image.imgid, image.selectedUrl, image.localPath);
        imageCount++;
      }
    }
    db.exec('commit');
  } catch (error) {
    db.exec('rollback');
    db.close();
    throw error;
  }
  db.query(`
    insert into image_dump_meta (
      source_dump, source_size, target_product_count, matched_product_count, image_count, generated_at
    ) values (?, ?, ?, ?, ?, ?)
  `).run(SOURCE_DUMP, statSync(SOURCE_DUMP).size, codes.size, matchedProductCount, imageCount, new Date().toISOString());
  db.exec(`
    create index product_images_local_path_idx on product_images(local_path);
    create index product_images_kind_idx on product_images(kind, code);
    pragma optimize;
  `);
  const integrity = db.query<{ quick_check: string }, []>('pragma quick_check').get();
  db.close();
  if (integrity?.quick_check !== 'ok') throw new Error(`Bildmanifest quick_check fehlgeschlagen: ${integrity?.quick_check}`);
  if (existsSync(IMAGE_DB)) renameSync(IMAGE_DB, `${IMAGE_DB}.previous-${Date.now()}`);
  renameSync(buildingPath, IMAGE_DB);
  console.log(`Bildmanifest bereit: ${IMAGE_DB}`);
  console.log(`${matchedProductCount.toLocaleString('de-DE')} Produkte, ${imageCount.toLocaleString('de-DE')} Bildzuordnungen.`);
}

async function buildManifest(): Promise<void> {
  await withImageOperationLock('manifest', buildManifestUnlocked);
}

async function writeImage(response: Response, destination: string): Promise<number> {
  const partialPath = `${destination}.part`;
  mkdirSync(path.dirname(destination), { recursive: true });
  await Bun.write(partialPath, response);
  const size = statSync(partialPath).size;
  if (size === 0) throw new Error('Leere Bilddatei empfangen.');
  renameSync(partialPath, destination);
  return size;
}

function isSqliteBusy(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const sqliteError = error as { code?: unknown; errno?: unknown };
  return sqliteError.code === 'SQLITE_BUSY' || sqliteError.errno === 5;
}

async function retrySqliteWrite(write: () => void): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      write();
      return;
    } catch (error) {
      if (!isSqliteBusy(error) || attempt === 7) throw error;
      await Bun.sleep(Math.min(100 * 2 ** attempt, 2_000));
    }
  }
}

async function downloadImagesUnlocked(): Promise<void> {
  if (!existsSync(IMAGE_DB)) throw new Error(`Bildmanifest fehlt: ${IMAGE_DB}`);
  mkdirSync(IMAGE_ROOT, { recursive: true });
  const db = new Database(IMAGE_DB);
  db.exec('pragma busy_timeout = 30000; pragma journal_mode = wal; pragma synchronous = normal;');
  const kind = requestedImageKind();
  const selectBatch = db.query<{
    local_path: string;
    aws_url: string;
  }, [ImageKind]>(`
    select distinct f.local_path, f.aws_url
    from image_files f
    join product_images p on p.local_path = f.local_path
    where (f.status = 'pending' or (f.status = 'failed' and f.attempts < 3)) and p.kind = ?
    order by f.local_path
    limit 256
  `);
  const markDownloaded = db.prepare("update image_files set status = 'downloaded', byte_size = ?, attempts = attempts + 1, error = null, downloaded_at = ? where local_path = ?");
  const markFailed = db.prepare("update image_files set status = 'failed', attempts = attempts + 1, error = ? where local_path = ?");
  const concurrency = Number.parseInt(process.env.OFF_IMAGE_CONCURRENCY ?? '16', 10);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 128) {
    throw new Error('OFF_IMAGE_CONCURRENCY muss eine ganze Zahl zwischen 1 und 128 sein.');
  }
  let completed = 0;
  let downloadedBytes = 0;
  const startedAt = Date.now();

  while (true) {
    const batch = selectBatch.all(kind);
    if (batch.length === 0) break;
    let nextIndex = 0;
    const workers = Array.from({ length: Math.min(concurrency, batch.length) }, async () => {
      while (nextIndex < batch.length) {
        const row = batch[nextIndex++];
        if (!row) return;
        const destination = path.join(IMAGE_ROOT, row.local_path);
        let size: number | null = null;
        let downloadError: string | null = null;
        try {
          if (existsSync(destination) && statSync(destination).size > 0) {
            size = statSync(destination).size;
          } else {
            const response = await fetch(row.aws_url, { headers: { 'User-Agent': USER_AGENT } });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            size = await writeImage(response, destination);
          }
        } catch (error) {
          downloadError = error instanceof Error ? error.message : String(error);
        }
        if (downloadError) {
          await retrySqliteWrite(() => {
            markFailed.run(downloadError, row.local_path);
          });
        } else if (size !== null) {
          await retrySqliteWrite(() => {
            markDownloaded.run(size, new Date().toISOString(), row.local_path);
          });
          downloadedBytes += size;
        }
        completed++;
        if (completed % 500 === 0) {
          const seconds = Math.max((Date.now() - startedAt) / 1000, 1);
          console.log(`${completed.toLocaleString('de-DE')} Dateien geprüft · ${formatBytes(downloadedBytes)} · ${Math.round(completed / seconds)} Dateien/s`);
        }
      }
    });
    await Promise.all(workers);
  }
  db.close();
  console.log(`Bilddownload ${kind} abgeschlossen: ${completed.toLocaleString('de-DE')} Dateien, ${formatBytes(downloadedBytes)}.`);
}

async function downloadImages(): Promise<void> {
  await withImageOperationLock(`download:${requestedImageKind()}`, downloadImagesUnlocked);
}

function status(): void {
  console.log(`Datenordner: ${DATA_DIR}`);
  console.log(`Produkt-DB: ${PRODUCTS_DB} ${existsSync(PRODUCTS_DB) ? formatBytes(statSync(PRODUCTS_DB).size) : 'FEHLT'}`);
  console.log(`OFF-Quelldump: ${SOURCE_DUMP} ${existsSync(SOURCE_DUMP) ? formatBytes(statSync(SOURCE_DUMP).size) : 'FEHLT'}`);
  console.log(`Bildmanifest: ${IMAGE_DB} ${existsSync(IMAGE_DB) ? formatBytes(statSync(IMAGE_DB).size) : 'FEHLT'}`);
  if (!existsSync(IMAGE_DB)) return;
  const db = new Database(IMAGE_DB, { readonly: true });
  const rows = db.query<{ status: string; count: number; bytes: number }, []>(`
    select status, count(*) as count, coalesce(sum(byte_size), 0) as bytes
    from image_files group by status order by status
  `).all();
  for (const row of rows) console.log(`${row.status}: ${row.count.toLocaleString('de-DE')} Dateien, ${formatBytes(row.bytes)}`);
  const mappings = db.query<{ count: number }, []>('select count(*) as count from product_images').get()?.count ?? 0;
  console.log(`Produkt-Bildzuordnungen: ${mappings.toLocaleString('de-DE')}`);
  const kinds = db.query<{ kind: string; count: number; downloaded: number }, []>(`
    select p.kind, count(*) as count,
      sum(case when f.status = 'downloaded' then 1 else 0 end) as downloaded
    from product_images p
    join image_files f on f.local_path = p.local_path
    group by p.kind order by p.kind
  `).all();
  for (const row of kinds) {
    console.log(`${row.kind}: ${row.downloaded.toLocaleString('de-DE')} / ${row.count.toLocaleString('de-DE')} lokal`);
  }
  db.close();
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'status';
  switch (command) {
    case 'source':
      await downloadSource();
      break;
    case 'manifest':
      await buildManifest();
      break;
    case 'download':
      await downloadImages();
      break;
    case 'all':
      await downloadSource();
      await buildManifest();
      await downloadImages();
      break;
    case 'status':
      status();
      break;
    default:
      throw new Error(`Unbekannter Befehl: ${command}. Erlaubt: source, manifest, download, all, status.`);
  }
}

if (import.meta.main) await main();
