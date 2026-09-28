import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { referenceLinesFromJson } from './src/compare.ts';
import { runOcrReport } from './src/service.ts';
import type { NormalizedReceiptImage } from './src/image.ts';

const ROOT = import.meta.dir;
const PORT = Number(process.env.RECEIPT_OCR_PORT ?? 8787);
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 12;
const RUNTIME_DIRECTORY = join(ROOT, '.runtime');

const staticFiles: Record<string, { file: string; contentType: string }> = {
  '/': { file: 'index.html', contentType: 'text/html; charset=utf-8' },
  '/index.html': { file: 'index.html', contentType: 'text/html; charset=utf-8' },
  '/styles.css': { file: 'styles.css', contentType: 'text/css; charset=utf-8' },
  '/app.js': { file: 'app.js', contentType: 'text/javascript; charset=utf-8' },
};

function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function field(form: FormData, name: string, fallback = ''): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : fallback;
}

function parsePsm(value: string): number {
  const psm = Number(value);
  if (!Number.isInteger(psm) || psm < 0 || psm > 13) {
    throw new Error('PSM muss eine ganze Zahl zwischen 0 und 13 sein.');
  }
  return psm;
}

function parseLanguage(value: string): string {
  if (!/^[a-z0-9_+-]+$/iu.test(value)) throw new Error('Ungültiger Tesseract-Sprachcode.');
  return value;
}

function parsePreprocessing(value: string): NormalizedReceiptImage['preprocessing'] {
  if (value === 'none') return 'none';
  if (value === 'receipt') return 'rotate-grayscale-normalize-threshold-160';
  throw new Error('Bildaufbereitung muss receipt oder none sein.');
}

function safeFilename(name: string): string {
  const filename = basename(name).replace(/[^a-z0-9._-]+/giu, '_');
  return filename || 'upload-image';
}

function parseJsonField(form: FormData, name: string): unknown | undefined {
  const value = field(form, name).trim();
  if (!value) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`${name} ist kein gültiges JSON.`);
  }
}

async function processUpload(request: Request): Promise<Response> {
  const form = await request.formData();
  const values = form.getAll('images');
  const files = values.filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length === 0) return json({ error: 'Bitte mindestens ein Bild auswählen.' }, 400);
  if (files.length > MAX_FILES) {
    return json({ error: `Maximal ${MAX_FILES} Bilder pro Lauf sind erlaubt.` }, 400);
  }

  const language = parseLanguage(field(form, 'language', 'deu'));
  const psm = parsePsm(field(form, 'psm', '6'));
  const preprocessing = parsePreprocessing(field(form, 'preprocess', 'receipt'));
  const reference = parseJsonField(form, 'reference');
  const gold = parseJsonField(form, 'gold');
  const referenceLines = reference === undefined ? null : referenceLinesFromJson(reference);
  await mkdir(RUNTIME_DIRECTORY, { recursive: true });
  const reports = [];

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return json({ error: `${file.name} ist größer als 20 MB.` }, 400);
    }
    if (!file.type.startsWith('image/')) {
      return json({ error: `${file.name} ist kein Bild.` }, 400);
    }

    const uploadPath = join(RUNTIME_DIRECTORY, `upload-${randomUUID()}-${safeFilename(file.name)}`);
    await Bun.write(uploadPath, await file.arrayBuffer());
    try {
      reports.push(
        await runOcrReport(uploadPath, {
          language,
          psm,
          preprocessing,
          inputName: file.name,
          runtimeDirectory: RUNTIME_DIRECTORY,
          referenceLines,
          gold,
          includePreview: true,
        }),
      );
    } finally {
      await rm(uploadPath, { force: true });
    }
  }

  return json({ reports });
}

const server = Bun.serve({
  hostname: '127.0.0.1',
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/api/ocr' && request.method === 'POST') {
      try {
        return await processUpload(request);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) }, 400);
      }
    }

    if (request.method === 'GET' && staticFiles[url.pathname]) {
      const asset = staticFiles[url.pathname];
      const body = await readFile(join(ROOT, asset.file));
      return new Response(body, {
        headers: {
          'content-type': asset.contentType,
          'cache-control': 'no-store',
        },
      });
    }

    return new Response('Nicht gefunden', { status: 404 });
  },
});

console.log(`Receipt OCR Lab: http://localhost:${server.port}`);
