import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { hashOrderedPageSet } from './full-brochure-signature';

const ZIP_CODE = '22043';
const BRN_PREFIX = 'brn:bring-de:offersbrochure:';
const DATA_DIR = path.join('tools', 'crawler', 'data', 'listing-only');
const SAMPLE_DIR = path.join(DATA_DIR, 'review-sample-22043');
const PROGRESS_PATH = path.join(DATA_DIR, '.canonical-page-verification-pilot-progress.json');
const OUTPUT_DIR = DATA_DIR;
const DEFAULT_OUTPUT = path.join(OUTPUT_DIR, 'review-sample-22043-audit.json');
const DEFAULT_OCR_OUTPUT = path.join(OUTPUT_DIR, 'review-sample-22043-ocr-audit.json');
const DEFAULT_PIXEL_OUTPUT = path.join(OUTPUT_DIR, 'review-sample-22043-pixel-audit.json');
const DEFAULT_CONTENT_OUTPUT = path.join(OUTPUT_DIR, 'review-sample-content-comparison.json');

type JsonRecord = Record<string, unknown>;

type ManifestPage = {
  pageNumber: number;
  sha256: string;
  path: string;
};

type ManifestBrochure = {
  storeName: string;
  validFrom: string;
  validUntil: string;
  canonicalBrn: string;
  brns: string[];
  listedAtZipCode: string;
  availableZipCodes: string[];
  pageCount: number;
  coverSha256: string;
  brochureSha256: string;
  pages: ManifestPage[];
};

type VerificationBrn = {
  pageUrls: string[];
  pageHashes: Array<{ pageNumber: number; sha256: string }>;
  brochureSha256: string;
};

type Issue = {
  code: string;
  message: string;
  path?: string;
  brn?: string;
};

type PageResult = {
  path: string;
  pageNumber: number;
  sha256: string;
  width: number;
  height: number;
  channels: number;
};

type VectorResult = {
  brn: string;
  title: string;
  pageCount: number;
  pageHashes: string[];
  brochureSha256: string;
};

type TesseractWord = {
  text: string;
  confidence: number;
  lineKey: string;
};

type OcrLine = {
  text: string;
  words: TesseractWord[];
};

type OcrFieldStatus =
  | 'match'
  | 'partial_match'
  | 'mismatch'
  | 'not_detected'
  | 'detected_unverified'
  | 'unavailable';

type OcrField = {
  expected: unknown;
  extracted: unknown;
  status: OcrFieldStatus;
  confidence: number | null;
  confidenceMeaning: 'mean-tesseract-word-confidence-0-to-100' | null;
  evidence?: string[];
  note?: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): JsonRecord {
  if (!isRecord(value)) throw new Error(`${label} must be a JSON object.`);
  return value;
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be a JSON array.`);
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0)
    throw new Error(`${label} must be a non-empty string.`);
  return value;
}

function requireInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer.`);
  }
  return value;
}

function readManifestBrochure(value: unknown, index: number): ManifestBrochure {
  const row = requireRecord(value, `manifest.brochures[${index}]`);
  const brns = requireArray(row.brns, `manifest.brochures[${index}].brns`).map((brn, brnIndex) =>
    requireString(brn, `manifest.brochures[${index}].brns[${brnIndex}]`),
  );
  const availableZipCodes = requireArray(
    row.availableZipCodes,
    `manifest.brochures[${index}].availableZipCodes`,
  ).map((zip, zipIndex) =>
    requireString(zip, `manifest.brochures[${index}].availableZipCodes[${zipIndex}]`),
  );
  const pages = requireArray(row.pages, `manifest.brochures[${index}].pages`).map(
    (page, pageIndex) => {
      const entry = requireRecord(page, `manifest.brochures[${index}].pages[${pageIndex}]`);
      return {
        pageNumber: requireInteger(
          entry.pageNumber,
          `manifest.brochures[${index}].pages[${pageIndex}].pageNumber`,
        ),
        sha256: requireString(
          entry.sha256,
          `manifest.brochures[${index}].pages[${pageIndex}].sha256`,
        ),
        path: requireString(entry.path, `manifest.brochures[${index}].pages[${pageIndex}].path`),
      };
    },
  );

  return {
    storeName: requireString(row.storeName, `manifest.brochures[${index}].storeName`),
    validFrom: requireString(row.validFrom, `manifest.brochures[${index}].validFrom`),
    validUntil: requireString(row.validUntil, `manifest.brochures[${index}].validUntil`),
    canonicalBrn: requireString(row.canonicalBrn, `manifest.brochures[${index}].canonicalBrn`),
    brns,
    listedAtZipCode: requireString(
      row.listedAtZipCode,
      `manifest.brochures[${index}].listedAtZipCode`,
    ),
    availableZipCodes,
    pageCount: requireInteger(row.pageCount, `manifest.brochures[${index}].pageCount`),
    coverSha256: requireString(row.coverSha256, `manifest.brochures[${index}].coverSha256`),
    brochureSha256: requireString(
      row.brochureSha256,
      `manifest.brochures[${index}].brochureSha256`,
    ),
    pages,
  };
}

function readVerificationBrn(value: unknown, brn: string): VerificationBrn {
  const row = requireRecord(value, `verification.byBrn[${brn}]`);
  const pageUrls = requireArray(row.pageUrls, `verification.byBrn[${brn}].pageUrls`).map(
    (url, index) => requireString(url, `verification.byBrn[${brn}].pageUrls[${index}]`),
  );
  const pageHashes = requireArray(row.pageHashes, `verification.byBrn[${brn}].pageHashes`).map(
    (page, index) => {
      const entry = requireRecord(page, `verification.byBrn[${brn}].pageHashes[${index}]`);
      return {
        pageNumber: requireInteger(
          entry.pageNumber,
          `verification.byBrn[${brn}].pageHashes[${index}].pageNumber`,
        ),
        sha256: requireString(
          entry.sha256,
          `verification.byBrn[${brn}].pageHashes[${index}].sha256`,
        ),
      };
    },
  );
  return {
    pageUrls,
    pageHashes,
    brochureSha256: requireString(row.brochureSha256, `verification.byBrn[${brn}].brochureSha256`),
  };
}

function addIssue(
  issues: Issue[],
  code: string,
  message: string,
  details: Partial<Issue> = {},
): void {
  issues.push({ code, message, ...details });
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function normalizeStoreName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');
}

function pageNumberFromUrl(url: string): number | undefined {
  const basename = url.slice(url.lastIndexOf('/') + 1);
  const match = basename.match(/^(?:page-)?(\d+)[_-]/i);
  return match ? Number(match[1]) : undefined;
}

async function readJson(root: string, relativePath: string): Promise<unknown> {
  const bytes = await readFile(path.join(root, relativePath));
  return JSON.parse(bytes.toString('utf8')) as unknown;
}

async function listFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(fullPath);
      else if (entry.isFile()) files.push(path.relative(root, fullPath).split(path.sep).join('/'));
      else throw new Error(`Unsupported non-regular entry in sample assets: ${fullPath}`);
    }
  };
  await visit(root);
  return files;
}

function parseArguments(args: string[]): {
  output: string;
  comparePixels: boolean;
  compareContent: boolean;
  ocrCovers: boolean;
} {
  const outputArg = args.find((arg) => arg.startsWith('--out='));
  const unknown = args.filter(
    (arg) =>
      arg !== '--help' &&
      arg !== '--compare-pixels' &&
      arg !== '--compare-content' &&
      arg !== '--ocr-covers' &&
      !arg.startsWith('--out='),
  );
  if (unknown.length > 0) throw new Error(`Unknown argument: ${unknown[0]}`);
  const diagnosticModes = ['--compare-pixels', '--compare-content', '--ocr-covers'].filter((mode) =>
    args.includes(mode),
  );
  if (diagnosticModes.length > 1) {
    throw new Error(
      `${diagnosticModes.join(' and ')} write separate reports; run them separately.`,
    );
  }
  if (args.includes('--help')) {
    console.log(
      'Usage: bun tools/crawler/brochures/listing-only/audit-review-sample.ts [--compare-pixels | --compare-content | --ocr-covers] [--out=<path>]',
    );
    console.log(
      'Reads only existing local manifests, reports, and downloaded assets. It never fetches or uploads data.',
    );
    console.log(
      '--compare-pixels runs a separate Sharp RGB comparison on page 2 for BRNs 218756 and 218757.',
    );
    console.log(
      '--compare-content compares every local page for BRNs 218756/218757 and 224249/224754; differing pages get pixel and advisory OCR diagnostics.',
    );
    console.log('--ocr-covers runs advisory Tesseract OCR on only the 25 local cover images.');
    process.exit(0);
  }
  const comparePixels = args.includes('--compare-pixels');
  const compareContent = args.includes('--compare-content');
  const ocrCovers = args.includes('--ocr-covers');
  const defaultOutput = compareContent
    ? DEFAULT_CONTENT_OUTPUT
    : comparePixels
      ? DEFAULT_PIXEL_OUTPUT
      : ocrCovers
        ? DEFAULT_OCR_OUTPUT
        : DEFAULT_OUTPUT;
  return {
    output: outputArg?.slice('--out='.length) ?? defaultOutput,
    comparePixels,
    compareContent,
    ocrCovers,
  };
}

function buildVector(
  brn: string,
  title: string,
  rawEntry: unknown,
  pageHashesByUrl: JsonRecord,
  detailPages: JsonRecord,
): VectorResult {
  const entry = requireRecord(rawEntry, `progress.byBrn[${brn}]`);
  const pageUrls = requireArray(entry.pageUrls, `progress.byBrn[${brn}].pageUrls`).map(
    (url, index) => requireString(url, `progress.byBrn[${brn}].pageUrls[${index}]`),
  );
  const expectedCount = requireInteger(detailPages[brn], `detail-pages[${brn}]`);
  if (pageUrls.length !== expectedCount) {
    throw new Error(
      `${brn} has ${pageUrls.length} page URLs; detail-pages.json says ${expectedCount}.`,
    );
  }
  const pages = pageUrls.map((url, index) => {
    if (pageNumberFromUrl(url) !== index + 1) {
      throw new Error(`${brn} page URL order is invalid at index ${index}: ${url}`);
    }
    const hash = requireString(pageHashesByUrl[url], `progress.pageHashesByUrl[${url}]`);
    return { pageNumber: index + 1, sha256: hash };
  });
  return {
    brn,
    title,
    pageCount: expectedCount,
    pageHashes: pages.map((page) => page.sha256),
    brochureSha256: hashOrderedPageSet(pages, expectedCount),
  };
}

async function verifyPilotAssets(
  root: string,
  vectors: VectorResult[],
  issues: Issue[],
): Promise<{ uniqueAssetCount: number; checkedPageReferenceCount: number }> {
  const hashes = new Set(vectors.flatMap((vector) => vector.pageHashes));
  for (const hash of hashes) {
    const relativePath = path.join(DATA_DIR, 'page-assets-pilot', `${hash}.bin`);
    try {
      const bytes = await readFile(path.join(root, relativePath));
      const actualHash = sha256(bytes);
      if (actualHash !== hash)
        addIssue(
          issues,
          'pilot_asset_hash_mismatch',
          `Downloaded pilot asset hash differs from its filename.`,
          { path: relativePath },
        );
    } catch {
      addIssue(issues, 'pilot_asset_missing', `Downloaded comparison asset is missing.`, {
        path: relativePath,
      });
    }
  }
  return {
    uniqueAssetCount: hashes.size,
    checkedPageReferenceCount: vectors.reduce((sum, vector) => sum + vector.pageCount, 0),
  };
}

async function decodeRgb(bytes: Uint8Array): Promise<{
  data: Buffer;
  width: number;
  height: number;
}> {
  const decoded = await sharp(bytes)
    .toColourspace('srgb')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: decoded.data, width: decoded.info.width, height: decoded.info.height };
}

function comparePixels(
  left: Buffer,
  right: Buffer,
): {
  exactChannelMatchPercent: number;
  meanAbsoluteChannelDifference: number;
  maxChannelDifference: number;
} {
  if (left.length !== right.length) throw new Error('Pixel buffers have different sizes.');
  let equalChannels = 0;
  let totalDifference = 0;
  let maxDifference = 0;
  for (let index = 0; index < left.length; index += 1) {
    const difference = Math.abs(left[index]! - right[index]!);
    if (difference === 0) equalChannels += 1;
    totalDifference += difference;
    maxDifference = Math.max(maxDifference, difference);
  }
  return {
    exactChannelMatchPercent: Number(((equalChannels / left.length) * 100).toFixed(4)),
    meanAbsoluteChannelDifference: Number((totalDifference / left.length).toFixed(6)),
    maxChannelDifference: maxDifference,
  };
}

function averageConfidence(words: TesseractWord[]): number | null {
  if (words.length === 0) return null;
  const value = words.reduce((sum, word) => sum + word.confidence, 0) / words.length;
  return Number(value.toFixed(2));
}

function unavailableField(expected: unknown, note: string): OcrField {
  return {
    expected,
    extracted: null,
    status: 'unavailable',
    confidence: null,
    confidenceMeaning: null,
    note,
  };
}

function parseTesseractTsv(tsv: string): { rawText: string; lines: OcrLine[]; words: TesseractWord[] } {
  const lineMap = new Map<string, OcrLine>();
  for (const row of tsv.split(/\r?\n/).slice(1)) {
    const columns = row.split('\t');
    if (columns[0] !== '5') continue;
    const confidence = Number(columns[10]);
    const text = columns.slice(11).join('\t').trim();
    if (!text || !Number.isFinite(confidence) || confidence < 0) continue;
    const lineKey = columns.slice(2, 5).join(':');
    const word = { text, confidence, lineKey };
    const line = lineMap.get(lineKey) ?? { text: '', words: [] };
    line.words.push(word);
    line.text = line.words.map((entry) => entry.text).join(' ');
    lineMap.set(lineKey, line);
  }
  const lines = [...lineMap.values()];
  const words = lines.flatMap((line) => line.words);
  return { rawText: lines.map((line) => line.text).join('\n'), lines, words };
}

function runTesseractVersion(): { available: boolean; version?: string; reason?: string } {
  const result = spawnSync('tesseract', ['--version'], {
    encoding: 'utf8',
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  });
  if (result.error) return { available: false, reason: result.error.message };
  if (result.status !== 0) {
    return { available: false, reason: result.stderr.trim() || `Tesseract exited with ${result.status}.` };
  }
  return { available: true, version: result.stdout.split(/\r?\n/, 1)[0] };
}

function runTesseractOnBytes(bytes: Uint8Array):
  | { available: true; parsed: ReturnType<typeof parseTesseractTsv> }
  | { available: false; reason: string } {
  const result = spawnSync('tesseract', ['stdin', 'stdout', '-l', 'deu+eng', '--psm', '6', 'tsv'], {
    input: Buffer.from(bytes),
    encoding: 'utf8',
    timeout: 20_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) return { available: false, reason: result.error.message };
  if (result.status !== 0) {
    return {
      available: false,
      reason: result.stderr.trim() || `Tesseract exited with ${result.status}.`,
    };
  }
  return { available: true, parsed: parseTesseractTsv(result.stdout) };
}

async function comparePilotPage(
  root: string,
  pageNumber: number,
  leftHash: string,
  rightHash: string,
): Promise<JsonRecord> {
  const assetDirectory = path.join(root, DATA_DIR, 'page-assets-pilot');
  const [leftBytes, rightBytes] = await Promise.all([
    readFile(path.join(assetDirectory, `${leftHash}.bin`)),
    readFile(path.join(assetDirectory, `${rightHash}.bin`)),
  ]);
  if (sha256(leftBytes) !== leftHash || sha256(rightBytes) !== rightHash) {
    throw new Error(`Pilot page ${pageNumber} failed its local SHA-256 check.`);
  }

  const [leftPixels, rightPixels] = await Promise.all([
    decodeRgb(leftBytes),
    decodeRgb(rightBytes),
  ]);
  const dimensionsMatch =
    leftPixels.width === rightPixels.width && leftPixels.height === rightPixels.height;
  let pixelDeltaAssessment: string = 'dimensions_differ';
  let pixelComparison: JsonRecord;
  if (dimensionsMatch) {
    const metrics = comparePixels(leftPixels.data, rightPixels.data);
    pixelDeltaAssessment =
      metrics.exactChannelMatchPercent >= 99 && metrics.meanAbsoluteChannelDifference <= 1
        ? 'minor_pixel_delta_candidate'
        : 'material_pixel_difference';
    pixelComparison = {
      dimensionsMatch: true,
      width: leftPixels.width,
      height: leftPixels.height,
      normalizedPixelsEqual: leftPixels.data.equals(rightPixels.data),
      ...metrics,
    };
  } else {
    pixelComparison = {
      dimensionsMatch: false,
      left: { width: leftPixels.width, height: leftPixels.height },
      right: { width: rightPixels.width, height: rightPixels.height },
    };
  }
  const leftOcr = runTesseractOnBytes(leftBytes);
  const rightOcr = runTesseractOnBytes(rightBytes);
  const ocr =
    leftOcr.available && rightOcr.available
      ? {
          available: true,
          leftWordCount: leftOcr.parsed.words.length,
          rightWordCount: rightOcr.parsed.words.length,
          leftMeanWordConfidence: averageConfidence(leftOcr.parsed.words),
          rightMeanWordConfidence: averageConfidence(rightOcr.parsed.words),
          normalizedTextEqual:
            normalizeComparableText(leftOcr.parsed.rawText) ===
            normalizeComparableText(rightOcr.parsed.rawText),
          leftText: leftOcr.parsed.rawText.slice(0, 6000),
          rightText: rightOcr.parsed.rawText.slice(0, 6000),
          note: 'OCR text is diagnostic evidence only; Tesseract confidence is not field accuracy.',
        }
      : {
          available: false,
          leftReason: leftOcr.available ? null : leftOcr.reason,
          rightReason: rightOcr.available ? null : rightOcr.reason,
        };

  return {
    pageNumber,
    byteIdentical: false,
    pixelDeltaAssessment,
    leftSha256: leftHash,
    rightSha256: rightHash,
    pixelComparison,
    ocr,
  };
}

async function comparePilotBrochures(
  root: string,
  left: VectorResult,
  right: VectorResult,
): Promise<JsonRecord> {
  const pageCountMatches = left.pageCount === right.pageCount;
  const changedPages = pageCountMatches
    ? left.pageHashes.flatMap((leftHash, index) => {
        const rightHash = right.pageHashes[index];
        return rightHash && leftHash !== rightHash ? [{ index, leftHash, rightHash }] : [];
      })
    : [];
  const pageComparisons = await Promise.all(
    changedPages.map(({ index, leftHash, rightHash }) =>
      comparePilotPage(root, index + 1, leftHash, rightHash),
    ),
  );
  const byteIdentical = pageCountMatches && changedPages.length === 0;
  const ocrTextMatches =
    pageComparisons.length > 0 &&
    pageComparisons.every((page) => {
      const ocr = page.ocr;
      return isRecord(ocr) && ocr.available === true && ocr.normalizedTextEqual === true;
    });
  const visualAssessments = pageComparisons.map((page) => String(page.pixelDeltaAssessment));
  const visualDifference = byteIdentical
    ? 'none'
    : visualAssessments.includes('dimensions_differ')
      ? 'unknown_dimensions'
      : visualAssessments.includes('material_pixel_difference')
        ? visualAssessments.includes('minor_pixel_delta_candidate')
          ? 'mixed_minor_and_material_pages'
          : 'material_page_differences'
        : 'minor_pixel_differences_only';

  return {
    brns: [left.brn, right.brn],
    titles: [left.title, right.title],
    pageCounts: [left.pageCount, right.pageCount],
    pageCountMatches,
    byteIdenticalPages: pageCountMatches ? left.pageCount - changedPages.length : null,
    byteDifferentPages: changedPages.length,
    changedPageNumbers: changedPages.map(({ index }) => index + 1),
    visualDifference,
    classification: byteIdentical
      ? 'byte_identical'
      : ocrTextMatches
        ? 'same_ocr_text_candidate_manual_review'
        : 'uncertain_manual_review',
    byteIdentityProven: byteIdentical,
    semanticOfferIdentity: byteIdentical ? 'same_page_bytes' : 'unverified',
    semanticOfferIdentityProven: byteIdentical,
    automaticMergeAllowed: false,
    manualReviewRequired: !byteIdentical,
    pageComparisons,
    interpretation:
      'SHA-256 establishes byte equality only. OCR equality is only a review hint; pixel similarity and OCR cannot prove that offers, prices, and validity match.',
  };
}

async function writePilotComparisonSheet(
  root: string,
  left: VectorResult,
  right: VectorResult,
): Promise<string> {
  const changedPages = left.pageHashes.flatMap((leftHash, index) => {
    const rightHash = right.pageHashes[index];
    return rightHash && leftHash !== rightHash ? [{ index, leftHash, rightHash }] : [];
  });
  if (changedPages.length === 0) {
    throw new Error('The selected pilot brochures have no changed pages for a review sheet.');
  }
  const columnWidth = 600;
  const imageHeight = 820;
  const headerHeight = 42;
  const rowHeight = headerHeight + imageHeight;
  const layers: Array<{ input: Buffer; left: number; top: number }> = [];
  const assetDirectory = path.join(root, DATA_DIR, 'page-assets-pilot');

  for (const [rowIndex, page] of changedPages.entries()) {
    const [leftBytes, rightBytes] = await Promise.all([
      readFile(path.join(assetDirectory, `${page.leftHash}.bin`)),
      readFile(path.join(assetDirectory, `${page.rightHash}.bin`)),
    ]);
    const [leftImage, rightImage] = await Promise.all([
      sharp(leftBytes)
        .resize(columnWidth, imageHeight, { fit: 'contain', background: '#ffffff' })
        .jpeg({ quality: 82 })
        .toBuffer(),
      sharp(rightBytes)
        .resize(columnWidth, imageHeight, { fit: 'contain', background: '#ffffff' })
        .jpeg({ quality: 82 })
        .toBuffer(),
    ]);
    const label = Buffer.from(
      `<svg width="${columnWidth * 2}" height="${headerHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#242424"/><text x="12" y="28" fill="white" font-family="sans-serif" font-size="20">Seite ${page.index + 1} · BRN 218756</text><text x="${columnWidth + 12}" y="28" fill="white" font-family="sans-serif" font-size="20">Seite ${page.index + 1} · BRN 218757</text></svg>`,
    );
    const top = rowIndex * rowHeight;
    layers.push(
      { input: label, left: 0, top },
      { input: leftImage, left: 0, top: top + headerHeight },
      { input: rightImage, left: columnWidth, top: top + headerHeight },
    );
  }

  const outputPath = path.join(root, DATA_DIR, 'review-content-comparison-218756-218757.jpg');
  await sharp({
    create: {
      width: columnWidth * 2,
      height: rowHeight * changedPages.length,
      channels: 3,
      background: '#242424',
    },
  })
    .composite(layers)
    .jpeg({ quality: 82 })
    .toFile(outputPath);
  return path.relative(root, outputPath);
}

function normalizeComparableText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleUpperCase('de-DE')
    .replace(/[^A-Z0-9]+/g, '');
}

function localDate(isoDate: string): { text: string; year: number; month: number; day: number } | null {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(parsed);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const day = Number(values.day);
  const month = Number(values.month);
  const year = Number(values.year);
  if (!day || !month || !year) return null;
  return { text: `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`, year, month, day };
}

function isoWeek(date: { year: number; month: number; day: number }): { week: number; year: number } {
  const dayMs = 24 * 60 * 60 * 1000;
  const utcDate = Date.UTC(date.year, date.month - 1, date.day);
  const weekday = (new Date(utcDate).getUTCDay() + 6) % 7;
  const thursday = utcDate + (3 - weekday) * dayMs;
  const weekYear = new Date(thursday).getUTCFullYear();
  const januaryFourth = Date.UTC(weekYear, 0, 4);
  const januaryFourthWeekday = (new Date(januaryFourth).getUTCDay() + 6) % 7;
  const firstThursday = januaryFourth + (3 - januaryFourthWeekday) * dayMs;
  return { week: 1 + Math.round((thursday - firstThursday) / (7 * dayMs)), year: weekYear };
}

function extractDateTokens(words: TesseractWord[]): Array<{ value: string; confidence: number }> {
  const dates: Array<{ value: string; confidence: number }> = [];
  for (const word of words) {
    for (const match of word.text.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/g)) {
      const day = Number(match[1]);
      const month = Number(match[2]);
      let year = Number(match[3]);
      if (year < 100) year += year < 50 ? 2000 : 1900;
      const value = `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
      dates.push({ value, confidence: word.confidence });
    }
  }
  return dates;
}

function recognizedWeekLines(lines: OcrLine[]): Array<{ week: number; year?: number; text: string; confidence: number | null }> {
  const recognized: Array<{ week: number; year?: number; text: string; confidence: number | null }> = [];
  for (const line of lines) {
    const match = line.text.match(/\b(\d{1,2})\s*\.?\s*(?:woche|wo\.?|kw)\b|\b(?:kw|woche)\s*(\d{1,2})\b/i);
    if (!match) continue;
    const year = line.text.match(/\b(20\d{2})\b/);
    recognized.push({
      week: Number(match[1] ?? match[2]),
      ...(year ? { year: Number(year[1]) } : {}),
      text: line.text,
      confidence: averageConfidence(line.words),
    });
  }
  return recognized;
}

function coverOcrFields(
  brochure: ManifestBrochure,
  parsed: ReturnType<typeof parseTesseractTsv>,
): Record<'retailer' | 'date' | 'week' | 'flyerCode', OcrField> {
  const comparableOcr = normalizeComparableText(parsed.rawText);
  const expectedRetailer = brochure.storeName.trim();
  const normalizedRetailer = normalizeComparableText(expectedRetailer);
  const retailerLines = parsed.lines.filter((line) =>
    normalizeComparableText(line.text).includes(normalizedRetailer),
  );
  const retailer: OcrField = {
    expected: expectedRetailer,
    extracted: retailerLines.map((line) => line.text),
    status: retailerLines.length > 0 ? 'match' : 'not_detected',
    confidence: averageConfidence(retailerLines.flatMap((line) => line.words)),
    confidenceMeaning: 'mean-tesseract-word-confidence-0-to-100',
    ...(retailerLines.length === 0 ? { note: 'No exact normalized retailer name appeared in OCR text.' } : {}),
  };
  if (!normalizedRetailer || !comparableOcr) retailer.status = 'not_detected';

  const expectedFrom = localDate(brochure.validFrom);
  const expectedUntil = localDate(brochure.validUntil);
  const expectedDates = [expectedFrom?.text, expectedUntil?.text].filter((value): value is string => Boolean(value));
  const detectedDates = extractDateTokens(parsed.words);
  const matchingDates = detectedDates.filter((date) => expectedDates.includes(date.value));
  const distinctExpectedDates = [...new Set(expectedDates)];
  const matchedExpectedDates = new Set(matchingDates.map((date) => date.value));
  const dateStatus: OcrFieldStatus =
    distinctExpectedDates.length === 0
      ? 'unavailable'
      : matchedExpectedDates.size === distinctExpectedDates.length
        ? 'match'
        : matchedExpectedDates.size > 0
          ? 'partial_match'
          : 'not_detected';
  const date: OcrField = {
    expected: { validFrom: expectedFrom?.text ?? null, validUntil: expectedUntil?.text ?? null },
    extracted: detectedDates.map((entry) => entry.value),
    status: dateStatus,
    confidence: averageConfidence(matchingDates.map((entry) => ({ text: entry.value, confidence: entry.confidence, lineKey: '' }))),
    confidenceMeaning: matchingDates.length > 0 ? 'mean-tesseract-word-confidence-0-to-100' : null,
    ...(matchingDates.length === 0 ? { note: 'No expected validity date was found; other printed dates may be unrelated.' } : {}),
  };

  const expectedWeeks = [expectedFrom, expectedUntil]
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .map(isoWeek);
  const weeks = recognizedWeekLines(parsed.lines);
  const weekMatches = weeks.filter((found) =>
    expectedWeeks.some((expected) => expected.week === found.week && (!found.year || expected.year === found.year)),
  );
  const weekStatus: OcrFieldStatus = expectedWeeks.length === 0
    ? 'unavailable'
    : weekMatches.length > 0
      ? 'match'
      : weeks.length > 0
        ? 'mismatch'
        : 'not_detected';
  const week: OcrField = {
    expected: expectedWeeks.map((value) => ({ week: value.week, year: value.year })),
    extracted: weeks.map(({ week: number, year, text }) => ({ week: number, year: year ?? null, text })),
    status: weekStatus,
    confidence: averageConfidence(weekMatches.flatMap((entry) =>
      parsed.lines.find((line) => line.text === entry.text)?.words ?? [],
    )),
    confidenceMeaning: weekMatches.length > 0 ? 'mean-tesseract-word-confidence-0-to-100' : null,
  };

  const codePattern = /^(?=[A-Z0-9_-]{14,}$)(?=.*[A-Z])(?=.*\d)(?=.*[-_])[A-Z0-9]+(?:[-_][A-Z0-9]+){2,}$/i;
  const codes = parsed.words.filter((word) => codePattern.test(word.text));
  const flyerCode: OcrField = {
    expected: null,
    extracted: codes.map(({ text, confidence }) => ({ text, confidence })),
    status: codes.length > 0 ? 'detected_unverified' : 'unavailable',
    confidence: averageConfidence(codes),
    confidenceMeaning: codes.length > 0 ? 'mean-tesseract-word-confidence-0-to-100' : null,
    note: 'The local listing and manifest contain no expected printed flyer-code value.',
  };

  return { retailer, date, week, flyerCode };
}

async function auditCoverOcr(
  root: string,
  brochures: ManifestBrochure[],
  baseAuditPassed: boolean,
): Promise<JsonRecord> {
  const tesseract = runTesseractVersion();
  const results: JsonRecord[] = [];
  for (const brochure of brochures) {
    const cover = brochure.pages[0];
    if (!cover) {
      results.push({
        brn: brochure.canonicalBrn,
        retailer: brochure.storeName,
        available: false,
        reason: 'No cover page is present in the validated manifest.',
      });
      continue;
    }
    if (!baseAuditPassed) {
      results.push({
        brn: brochure.canonicalBrn,
        retailer: brochure.storeName,
        coverPath: cover.path,
        available: false,
        reason: 'Base file/hash validation failed; OCR was skipped.',
      });
      continue;
    }
    if (!tesseract.available) {
      results.push({
        brn: brochure.canonicalBrn,
        retailer: brochure.storeName,
        coverPath: cover.path,
        available: false,
        reason: tesseract.reason,
        fields: {
          retailer: unavailableField(brochure.storeName, tesseract.reason ?? 'Tesseract is unavailable.'),
          date: unavailableField(null, tesseract.reason ?? 'Tesseract is unavailable.'),
          week: unavailableField(null, tesseract.reason ?? 'Tesseract is unavailable.'),
          flyerCode: unavailableField(null, tesseract.reason ?? 'Tesseract is unavailable.'),
        },
      });
      continue;
    }

    try {
      const coverBytes = await readFile(path.join(root, SAMPLE_DIR, cover.path));
      const ocr = runTesseractOnBytes(coverBytes);
      if (!ocr.available) {
        results.push({
          brn: brochure.canonicalBrn,
          retailer: brochure.storeName,
          coverPath: cover.path,
          available: false,
          reason: ocr.reason,
          fields: {
            retailer: unavailableField(brochure.storeName, ocr.reason),
            date: unavailableField(null, ocr.reason),
            week: unavailableField(null, ocr.reason),
            flyerCode: unavailableField(null, ocr.reason),
          },
        });
        continue;
      }
      results.push({
        brn: brochure.canonicalBrn,
        retailer: brochure.storeName,
        coverPath: cover.path,
        coverSha256: cover.sha256,
        available: true,
        rawText: ocr.parsed.rawText,
        meanWordConfidence: averageConfidence(ocr.parsed.words),
        fields: coverOcrFields(brochure, ocr.parsed),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      results.push({
        brn: brochure.canonicalBrn,
        retailer: brochure.storeName,
        coverPath: cover.path,
        available: false,
        reason,
        fields: {
          retailer: unavailableField(brochure.storeName, reason),
          date: unavailableField(null, reason),
          week: unavailableField(null, reason),
          flyerCode: unavailableField(null, reason),
        },
      });
    }
  }

  const fields = ['retailer', 'date', 'week', 'flyerCode'] as const;
  const coverage = Object.fromEntries(fields.map((field) => {
    const counts: Record<string, number> = {};
    for (const result of results) {
      const fieldResult = isRecord(result.fields) ? result.fields[field] : undefined;
      const status = isRecord(fieldResult) && typeof fieldResult.status === 'string' ? fieldResult.status : 'unavailable';
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return [field, counts];
  }));
  return {
    engine: tesseract.available ? { name: 'Tesseract', version: tesseract.version, languages: 'deu+eng', pageSegmentationMode: 6 } : null,
    engineUnavailableReason: tesseract.available ? null : tesseract.reason,
    coverPagesExpected: brochures.length,
    coverPagesProcessed: results.filter((result) => result.available === true).length,
    coverageByField: coverage,
    confidenceNote: 'Tesseract word confidence is a recognition confidence score, not a calibrated probability of a correct retailer/date field.',
    fieldRules: {
      retailer: 'Exact normalized match against local manifest storeName; absent OCR text is not treated as a confirmed mismatch.',
      date: 'Compares extracted DD.MM.YYYY tokens with validFrom/validUntil converted to Europe/Berlin; unrecognized dates stay not_detected.',
      week: 'Compares a printed Woche/KW number with the ISO week of the local validity dates.',
      flyerCode: 'Reported as detected_unverified because no expected printed code exists in local metadata.',
      identity: 'OCR is advisory only and cannot alter SHA-256 page hashes, ordered vectors, or any merge decision.',
    },
    prior64Percent: {
      value: '64.0979%',
      interpretation: 'average OCR token-text similarity, not field detection and not a maximum',
      source: path.join(DATA_DIR, 'analysis-report.json'),
      method: 'weighted Jaccard similarity on OCR tokens across dHash candidate pairs',
      comparisonPairsWithUsableText: 927770,
      note: 'The earlier figure is the averageTextSimilarity metric in method3LocalOcr. This cover audit uses separate field detection statuses and Tesseract word confidence; the metrics are not directly comparable.',
    },
    results,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArguments(args);
  const root = process.cwd();
  const outputPath = path.resolve(root, options.output);
  const outputDirectory = path.resolve(root, OUTPUT_DIR);
  if (!outputPath.startsWith(`${outputDirectory}${path.sep}`)) {
    throw new Error(`Report output must stay inside ${OUTPUT_DIR}.`);
  }
  const protectedInputs = [
    path.join(root, SAMPLE_DIR, 'manifest.json'),
    path.join(root, path.join(DATA_DIR, 'canonical-page-verification-22043.json')),
    path.join(root, path.join(DATA_DIR, 'all-stores-full.json')),
    path.join(root, path.join(DATA_DIR, 'detail-pages.json')),
    path.join(root, PROGRESS_PATH),
  ];
  if (protectedInputs.includes(outputPath))
    throw new Error('Output path cannot replace an audit input.');
  if (
    options.compareContent &&
    [DEFAULT_OUTPUT, DEFAULT_OCR_OUTPUT, DEFAULT_PIXEL_OUTPUT].some(
      (output) => outputPath === path.resolve(root, output),
    )
  ) {
    throw new Error('The content comparison must use a separate output report.');
  }
  if (
    options.ocrCovers &&
    [DEFAULT_OUTPUT, DEFAULT_PIXEL_OUTPUT, DEFAULT_CONTENT_OUTPUT].some(
      (output) => outputPath === path.resolve(root, output),
    )
  ) {
    throw new Error('The OCR report must use a separate output path from the base and pixel reports.');
  }

  const [manifestValue, verificationValue, fullScanValue, detailPagesValue, progressValue] =
    await Promise.all([
      readJson(root, path.join(SAMPLE_DIR, 'manifest.json')),
      readJson(root, path.join(DATA_DIR, 'canonical-page-verification-22043.json')),
      readJson(root, path.join(DATA_DIR, 'all-stores-full.json')),
      readJson(root, path.join(DATA_DIR, 'detail-pages.json')),
      readJson(root, PROGRESS_PATH),
    ]);

  const issues: Issue[] = [];
  const manifest = requireRecord(manifestValue, 'manifest');
  const verification = requireRecord(verificationValue, 'zip verification report');
  const fullScan = requireRecord(fullScanValue, 'full listing scan');
  const detailPages = requireRecord(detailPagesValue, 'detail-pages.json');
  const progress = requireRecord(progressValue, 'pilot progress');
  const manifestScope = requireRecord(manifest.scope, 'manifest.scope');
  const manifestSummary = requireRecord(manifest.summary, 'manifest.summary');
  const verificationScope = requireRecord(verification.scope, 'zip verification report.scope');
  const verificationSummary = requireRecord(
    verification.summary,
    'zip verification report.summary',
  );
  const reportByBrn = requireRecord(verification.byBrn, 'zip verification report.byBrn');
  const progressByBrn = requireRecord(progress.byBrn, 'pilot progress.byBrn');
  const pageHashesByUrl = requireRecord(progress.pageHashesByUrl, 'pilot progress.pageHashesByUrl');
  const zipRows = requireArray(
    requireRecord(fullScan.byZipCode, 'full listing scan.byZipCode')[ZIP_CODE],
    `byZipCode[${ZIP_CODE}]`,
  ).map((row, index) => requireRecord(row, `byZipCode[${ZIP_CODE}][${index}]`));
  const brochures = requireArray(manifest.brochures, 'manifest.brochures').map(
    readManifestBrochure,
  );
  if (options.ocrCovers && brochures.length !== 25) {
    addIssue(issues, 'ocr_cover_count_mismatch', `OCR mode requires exactly 25 sample cover pages; found ${brochures.length}.`);
  }

  if (manifestScope.mode !== 'zip-sample' || manifestScope.zipCode !== ZIP_CODE) {
    addIssue(issues, 'sample_scope_mismatch', `Manifest must describe ZIP ${ZIP_CODE}.`);
  }
  if (verificationScope.mode !== 'zip-sample' || verificationScope.zipCode !== ZIP_CODE) {
    addIssue(
      issues,
      'verification_scope_mismatch',
      `Verification report must describe ZIP ${ZIP_CODE}.`,
    );
  }

  const listingByBrn = new Map<string, JsonRecord[]>();
  for (const row of zipRows) {
    const brn = requireString(row.brn, 'full listing BRN');
    const entries = listingByBrn.get(brn) ?? [];
    entries.push(row);
    listingByBrn.set(brn, entries);
  }
  const manifestByBrn = new Map<string, ManifestBrochure>();
  const expectedFiles = new Set<string>();
  const pageResults: PageResult[] = [];
  const dimensionCounts = new Map<string, number>();

  for (const brochure of brochures) {
    if (brochure.listedAtZipCode !== ZIP_CODE) {
      addIssue(issues, 'wrong_listed_zip', `Brochure lists a different ZIP code.`, {
        brn: brochure.canonicalBrn,
      });
    }
    if (!brochure.availableZipCodes.includes(ZIP_CODE)) {
      addIssue(
        issues,
        'zip_missing_from_availability',
        `Brochure is missing ZIP ${ZIP_CODE} from availableZipCodes.`,
        { brn: brochure.canonicalBrn },
      );
    }
    if (!brochure.brns.includes(brochure.canonicalBrn)) {
      addIssue(issues, 'canonical_brn_missing', `canonicalBrn is not included in its BRN list.`, {
        brn: brochure.canonicalBrn,
      });
    }
    if (brochure.pages.length !== brochure.pageCount) {
      addIssue(
        issues,
        'manifest_page_count_mismatch',
        `Manifest pageCount does not match its page array.`,
        { brn: brochure.canonicalBrn },
      );
    }

    const vectorPages = brochure.pages.map((page) => ({
      pageNumber: page.pageNumber,
      sha256: page.sha256,
    }));
    for (const brn of brochure.brns) {
      if (manifestByBrn.has(brn))
        addIssue(
          issues,
          'duplicate_manifest_brn',
          `BRN appears more than once in the sample manifest.`,
          { brn },
        );
      manifestByBrn.set(brn, brochure);
      const listings = listingByBrn.get(brn) ?? [];
      if (listings.length === 0)
        addIssue(issues, 'brn_not_listed_at_zip', `BRN is missing from the local ZIP listing.`, {
          brn,
        });
      for (const listing of listings) {
        if (
          normalizeStoreName(requireString(listing.storeName, `listing.storeName for ${brn}`)) !==
          normalizeStoreName(brochure.storeName)
        ) {
          addIssue(
            issues,
            'store_name_mismatch',
            `Local listing store name differs from the sample manifest.`,
            { brn },
          );
        }
        if (
          listing.validFrom !== brochure.validFrom ||
          listing.validUntil !== brochure.validUntil
        ) {
          addIssue(
            issues,
            'validity_mismatch',
            `Local listing validity differs from the sample manifest.`,
            { brn },
          );
        }
      }

      const detailCount = requireInteger(detailPages[brn], `detail-pages[${brn}]`);
      if (detailCount !== brochure.pageCount) {
        addIssue(
          issues,
          'detail_page_count_mismatch',
          `Manifest page count differs from detail-pages.json (${detailCount}).`,
          { brn },
        );
      }
      const verified = readVerificationBrn(reportByBrn[brn], brn);
      if (verified.pageUrls.length !== detailCount || verified.pageHashes.length !== detailCount) {
        addIssue(
          issues,
          'verified_page_count_mismatch',
          `Verification page count differs from detail-pages.json (${detailCount}).`,
          { brn },
        );
      }
      if (verified.brochureSha256 !== brochure.brochureSha256) {
        addIssue(
          issues,
          'brochure_vector_mismatch',
          `Manifest and full verification report disagree on the ordered page vector.`,
          { brn },
        );
      }
      for (const [index, page] of brochure.pages.entries()) {
        const hash = verified.pageHashes[index];
        const pageNumber = index + 1;
        if (page.pageNumber !== pageNumber) {
          addIssue(
            issues,
            'manifest_page_order',
            `Manifest page order skips or repeats page ${pageNumber}.`,
            { brn },
          );
        }
        if (hash && (hash.pageNumber !== pageNumber || hash.sha256 !== page.sha256)) {
          addIssue(
            issues,
            'page_hash_vector_mismatch',
            `Manifest page hash differs from the full verification report at page ${pageNumber}.`,
            { brn },
          );
        }
        const urlPageNumber = pageNumberFromUrl(verified.pageUrls[index] ?? '');
        if (urlPageNumber !== pageNumber) {
          addIssue(
            issues,
            'verified_page_order',
            `Page URL order differs from page ${pageNumber}.`,
            { brn },
          );
        }
      }
    }

    let computedVector = '';
    try {
      computedVector = hashOrderedPageSet(vectorPages, brochure.pageCount);
    } catch (error) {
      addIssue(
        issues,
        'ordered_vector_invalid',
        error instanceof Error ? error.message : String(error),
        {
          brn: brochure.canonicalBrn,
        },
      );
    }
    if (computedVector !== brochure.brochureSha256) {
      addIssue(
        issues,
        'manifest_vector_digest_mismatch',
        `Ordered page hashes do not match brochureSha256.`,
        { brn: brochure.canonicalBrn },
      );
    }

    for (const page of brochure.pages) {
      const normalizedPath = page.path.split(path.sep).join('/');
      const fullPath = path.resolve(root, SAMPLE_DIR, page.path);
      const sampleRoot = path.resolve(root, SAMPLE_DIR);
      if (!fullPath.startsWith(`${sampleRoot}${path.sep}`)) {
        addIssue(issues, 'asset_path_escape', `Sample image path escapes the sample directory.`, {
          path: page.path,
        });
        continue;
      }
      expectedFiles.add(normalizedPath);
      try {
        const bytes = await readFile(fullPath);
        const actualHash = sha256(bytes);
        if (actualHash !== page.sha256) {
          addIssue(
            issues,
            'sample_page_hash_mismatch',
            `Image bytes do not match the manifest SHA-256.`,
            {
              path: page.path,
              brn: brochure.brns[0],
            },
          );
        }
        const decoded = await decodeRgb(bytes);
        const dimensions = `${decoded.width}x${decoded.height}`;
        dimensionCounts.set(dimensions, (dimensionCounts.get(dimensions) ?? 0) + 1);
        pageResults.push({
          path: page.path,
          pageNumber: page.pageNumber,
          sha256: actualHash,
          width: decoded.width,
          height: decoded.height,
          channels: 3,
        });
      } catch (error) {
        addIssue(
          issues,
          'sample_page_decode_or_read_failed',
          error instanceof Error ? error.message : String(error),
          {
            path: page.path,
            brn: brochure.brns[0],
          },
        );
      }
    }

    if (brochure.pages[0]?.sha256 !== brochure.coverSha256) {
      addIssue(issues, 'cover_sha256_mismatch', `coverSha256 differs from page 1.`, {
        brn: brochure.canonicalBrn,
      });
    }
  }

  const listingBrns = [...listingByBrn.keys()].sort();
  const sampleBrns = [...manifestByBrn.keys()].sort();
  const vectorGroups = new Map<string, string[]>();
  for (const brochure of brochures) {
    const brns = vectorGroups.get(brochure.brochureSha256) ?? [];
    brns.push(...brochure.brns);
    vectorGroups.set(brochure.brochureSha256, brns);
  }
  const duplicateVectorGroups = [...vectorGroups.values()].filter((brns) => brns.length > 1);
  if (duplicateVectorGroups.length > 0) {
    addIssue(
      issues,
      'duplicate_sample_full_vectors',
      `Sample contains repeated complete ordered page vectors.`,
    );
  }
  const missingBrns = listingBrns.filter((brn) => !manifestByBrn.has(brn));
  const extraBrns = sampleBrns.filter((brn) => !listingByBrn.has(brn));
  for (const brn of missingBrns)
    addIssue(issues, 'listing_brochure_missing', `Listed BRN has no sample brochure.`, { brn });
  for (const brn of extraBrns)
    addIssue(
      issues,
      'sample_bron_not_in_listing',
      `Sample BRN is not listed for ZIP ${ZIP_CODE}.`,
      { brn },
    );

  const sampleFiles = await listFiles(path.join(root, SAMPLE_DIR, 'images'));
  const orphanFiles = sampleFiles.filter((file) => !expectedFiles.has(`images/${file}`));
  const missingFiles = [...expectedFiles].filter(
    (file) => !sampleFiles.includes(file.replace(/^images\//, '')),
  );
  for (const file of orphanFiles)
    addIssue(issues, 'orphan_sample_asset', `Image file is not referenced by the manifest.`, {
      path: file,
    });
  for (const file of missingFiles)
    addIssue(issues, 'missing_sample_asset', `Manifest image file is missing.`, { path: file });

  const verifiedBrnCount = Object.keys(reportByBrn).length;
  const totalManifestPageCount = brochures.reduce(
    (sum, brochure) => sum + brochure.pages.length,
    0,
  );
  if (
    requireInteger(manifestSummary.uniqueBrnCount, 'manifest.summary.uniqueBrnCount') !==
    sampleBrns.length
  ) {
    addIssue(
      issues,
      'manifest_bron_summary_mismatch',
      `Manifest unique BRN count differs from its records.`,
    );
  }
  if (
    requireInteger(
      manifestSummary.brochureVariantCount,
      'manifest.summary.brochureVariantCount',
    ) !== brochures.length
  ) {
    addIssue(
      issues,
      'manifest_brochure_summary_mismatch',
      `Manifest brochure variant count differs from its records.`,
    );
  }
  if (
    requireInteger(manifestSummary.pageReferenceCount, 'manifest.summary.pageReferenceCount') !==
    totalManifestPageCount
  ) {
    addIssue(
      issues,
      'manifest_page_summary_mismatch',
      `Manifest page reference count differs from its records.`,
    );
  }
  if (
    requireInteger(verificationSummary.uniqueBrnCount, 'verification.summary.uniqueBrnCount') !==
    sampleBrns.length
  ) {
    addIssue(
      issues,
      'report_bron_summary_mismatch',
      `Verification BRN count differs from the sample.`,
    );
  }
  if (
    requireInteger(verificationScope.verifiedBrnCount, 'verification.scope.verifiedBrnCount') !==
    sampleBrns.length
  ) {
    addIssue(
      issues,
      'report_bron_scope_mismatch',
      `Verification scope BRN count differs from the sample.`,
    );
  }
  if (verifiedBrnCount !== sampleBrns.length) {
    addIssue(
      issues,
      'report_bron_coverage_mismatch',
      `Verification byBrn entries differ from the sample.`,
    );
  }
  if (
    requireInteger(
      verificationSummary.pageReferenceCount,
      'verification.summary.pageReferenceCount',
    ) !== totalManifestPageCount
  ) {
    addIssue(
      issues,
      'report_page_summary_mismatch',
      `Verification page count differs from the manifest.`,
    );
  }

  const identicalPair = [`${BRN_PREFIX}224249`, `${BRN_PREFIX}224754`];
  const sameCoverPair = [`${BRN_PREFIX}218756`, `${BRN_PREFIX}218757`];
  const makeVector = (brn: string): VectorResult => {
    const entry = requireRecord(progressByBrn[brn], `progress.byBrn[${brn}]`);
    return buildVector(
      brn,
      requireString(entry.title, `progress.byBrn[${brn}].title`),
      entry,
      pageHashesByUrl,
      detailPages,
    );
  };
  const identicalVectors = identicalPair.map(makeVector);
  const differentVectors = sameCoverPair.map(makeVector);
  const pilotAssets = await verifyPilotAssets(
    root,
    [...identicalVectors, ...differentVectors],
    issues,
  );
  const identicalVectorEqual =
    identicalVectors[0]?.brochureSha256 === identicalVectors[1]?.brochureSha256;
  if (!identicalVectorEqual)
    addIssue(
      issues,
      'expected_identical_vector_not_found',
      `Selected identical-vector comparison pair is no longer byte-identical.`,
    );
  const identicalPairAssets = {
    ...pilotAssets,
    uniqueAssetCount: new Set(identicalVectors.flatMap((vector) => vector.pageHashes)).size,
    checkedPageReferenceCount: identicalVectors.reduce((sum, vector) => sum + vector.pageCount, 0),
  };

  const coverByteIdentical =
    differentVectors[0]?.pageHashes[0] === differentVectors[1]?.pageHashes[0];
  const fullVectorsDifferent =
    differentVectors[0]?.brochureSha256 !== differentVectors[1]?.brochureSha256;
  const firstDifferingPage = differentVectors[0]?.pageHashes.findIndex(
    (hash, index) => hash !== differentVectors[1]?.pageHashes[index],
  );
  if (!coverByteIdentical || !fullVectorsDifferent) {
    addIssue(
      issues,
      'expected_same_cover_different_vector_not_found',
      `Selected byte-different comparison pair no longer has an identical cover and distinct full vectors.`,
    );
  }

  let contentComparison: JsonRecord | null = null;
  if (options.compareContent) {
    const [exactLeft, exactRight] = identicalVectors;
    const [variantLeft, variantRight] = differentVectors;
    if (!exactLeft || !exactRight || !variantLeft || !variantRight) {
      throw new Error('The configured local comparison pair is incomplete.');
    }
    const tesseract = runTesseractVersion();
    const reviewSheet = await writePilotComparisonSheet(root, variantLeft, variantRight);
    contentComparison = {
      version: 1,
      generatedAt: new Date().toISOString(),
      operation: 'offline-content-review-diagnostic',
      networkAccess: false,
      uploadAccess: false,
      inputs: {
        pilotProgress: PROGRESS_PATH,
        pilotAssets: path.join(DATA_DIR, 'page-assets-pilot'),
      },
      outputs: { sideBySideReviewSheet: reviewSheet },
      engine: tesseract.available
        ? {
            name: 'Tesseract',
            version: tesseract.version,
            languages: 'deu+eng',
            pageSegmentationMode: 6,
          }
        : { name: 'Tesseract', unavailableReason: tesseract.reason },
      comparisons: {
        exactVectorControl: await comparePilotBrochures(root, exactLeft, exactRight),
        sameCoverDifferentBytes: await comparePilotBrochures(root, variantLeft, variantRight),
      },
      rules: {
        byteEquality: 'Equal ordered SHA-256 page vectors prove that all page bytes match.',
        pixelDeltaAssessment:
          'minor_pixel_delta_candidate requires at least 99% exact channel matches and mean absolute difference at most 1; this visual threshold does not establish content identity.',
        semanticEquality:
          'Pixel similarity and OCR text are diagnostic hints only; they cannot prove equal offers, prices, and validity.',
        automaticMergeAllowed: false,
        manualReviewRequired: true,
      },
    };
  }

  const differentPageIndex =
    firstDifferingPage === undefined || firstDifferingPage < 0 ? 1 : firstDifferingPage;
  const comparisonHashPair = differentVectors.map(
    (vector) => vector.pageHashes[differentPageIndex],
  );
  let pageRenderComparison: JsonRecord = {
    run: false,
    reason: 'Pass --compare-pixels to run this separate rendered-pixel diagnostic.',
  };
  if (options.comparePixels && comparisonHashPair[0] && comparisonHashPair[1]) {
    const comparisonBytes = await Promise.all(
      comparisonHashPair.map((hash) =>
        readFile(path.join(root, DATA_DIR, 'page-assets-pilot', `${hash}.bin`)),
      ),
    );
    try {
      const [left, right] = await Promise.all(comparisonBytes.map(decodeRgb));
      if (left.width !== right.width || left.height !== right.height) {
        pageRenderComparison = {
          run: true,
          method: 'Sharp decoded both JPEG files to sRGB RGB pixels without resizing.',
          dimensionsMatch: false,
          left: { width: left.width, height: left.height, decodedPixelSha256: sha256(left.data) },
          right: {
            width: right.width,
            height: right.height,
            decodedPixelSha256: sha256(right.data),
          },
          normalizedPixelsEqual: false,
        };
      } else {
        const metrics = comparePixels(left.data, right.data);
        pageRenderComparison = {
          run: true,
          method: 'Sharp decoded both JPEG files to sRGB RGB pixels without resizing.',
          dimensionsMatch: true,
          width: left.width,
          height: left.height,
          normalizedPixelsEqual: left.data.equals(right.data),
          leftDecodedPixelSha256: sha256(left.data),
          rightDecodedPixelSha256: sha256(right.data),
          ...metrics,
          interpretation:
            'Pixel metrics describe decoded bytes only; they do not decide brochure identity or visual equivalence.',
        };
      }
    } catch (error) {
      pageRenderComparison = {
        run: true,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    operation: 'offline-local-audit',
    networkAccess: false,
    uploadAccess: false,
    inputs: {
      sampleManifest: path.join(SAMPLE_DIR, 'manifest.json'),
      sampleImages: path.join(SAMPLE_DIR, 'images'),
      zipVerificationReport: path.join(DATA_DIR, 'canonical-page-verification-22043.json'),
      fullListingScan: path.join(DATA_DIR, 'all-stores-full.json'),
      detailPageCounts: path.join(DATA_DIR, 'detail-pages.json'),
      pilotProgress: PROGRESS_PATH,
      pilotAssets: path.join(DATA_DIR, 'page-assets-pilot'),
    },
    sample: {
      zipCode: ZIP_CODE,
      listingBrnCount: listingBrns.length,
      manifestBrnCount: sampleBrns.length,
      intersectingBrnCount: sampleBrns.filter((brn) => listingByBrn.has(brn)).length,
      brochureCount: brochures.length,
      pageCount: totalManifestPageCount,
      uniqueOrderedVectorCount: vectorGroups.size,
      duplicateOrderedVectorGroups: duplicateVectorGroups,
      detailPageCountBrnCount: sampleBrns.filter(
        (brn) => detailPages[brn] === manifestByBrn.get(brn)?.pageCount,
      ).length,
      decodedImageCount: pageResults.length,
      dimensionCounts: Object.fromEntries(
        [...dimensionCounts.entries()].sort(([left], [right]) => left.localeCompare(right)),
      ),
      missingBrns,
      extraBrns,
      missingFiles,
      orphanFiles,
      checks: {
        listingBrnsMatchManifest: missingBrns.length === 0 && extraBrns.length === 0,
        zipAssignmentAndMetadata: !issues.some((issue) =>
          [
            'sample_scope_mismatch',
            'verification_scope_mismatch',
            'wrong_listed_zip',
            'zip_missing_from_availability',
            'brn_not_listed_at_zip',
            'store_name_mismatch',
            'validity_mismatch',
          ].includes(issue.code),
        ),
        exactDetailPageCounts: !issues.some((issue) => issue.code === 'detail_page_count_mismatch'),
        orderedPageHashesAndVectors: !issues.some(
          (issue) => issue.code.includes('vector') || issue.code.includes('order'),
        ),
        allBrochuresHaveDistinctFullVectors: duplicateVectorGroups.length === 0,
        everyImageSha256Matches: !issues.some(
          (issue) => issue.code === 'sample_page_hash_mismatch',
        ),
        everyJpegDecoded: pageResults.length === totalManifestPageCount,
        noMissingOrOrphanAssets: missingFiles.length === 0 && orphanFiles.length === 0,
      },
    },
    comparisons: {
      exactSameVector: {
        brns: identicalPair,
        titles: identicalVectors.map((vector) => vector.title),
        pageCounts: identicalVectors.map((vector) => vector.pageCount),
        brochureSha256: identicalVectors.map((vector) => vector.brochureSha256),
        orderedVectorsByteIdentical: identicalVectorEqual,
        localAssets: identicalPairAssets,
        source: 'Existing pilot progress and page-assets-pilot files only.',
      },
      sameCoverDifferentBytes: {
        brns: sameCoverPair,
        titles: differentVectors.map((vector) => vector.title),
        pageCounts: differentVectors.map((vector) => vector.pageCount),
        coverSha256: differentVectors.map((vector) => vector.pageHashes[0]),
        fullBrochureSha256: differentVectors.map((vector) => vector.brochureSha256),
        coverBytesIdentical: coverByteIdentical,
        fullOrderedVectorsByteDifferent: fullVectorsDifferent,
        firstDifferingPage: differentPageIndex + 1,
        firstDifferingPageSha256: comparisonHashPair,
        decodedPageComparison: pageRenderComparison,
        ocr: {
          run: false,
          reason:
            'OCR is outside this deterministic byte-integrity audit and does not decide identity.',
        },
        source: 'Existing pilot progress and page-assets-pilot files only.',
        interpretation:
          'This is a byte-level difference case. Pixel and OCR diagnostics are advisory and do not prove visual or semantic difference.',
      },
    },
    issues,
    passed: issues.length === 0,
  };

  if (options.compareContent && contentComparison) {
    await writeFile(outputPath, `${JSON.stringify(contentComparison, null, 2)}\n`, 'utf8');
    const comparisons = requireRecord(contentComparison.comparisons, 'content comparisons');
    const variant = requireRecord(
      comparisons.sameCoverDifferentBytes,
      'same-cover comparison result',
    );
    console.log(`Local content comparison: ${path.relative(root, outputPath)}`);
    console.log(
      `Same-cover pair: ${String(variant.byteDifferentPages)} pages have different bytes; classification=${String(variant.classification)}; automatic merge=false.`,
    );
  } else if (options.ocrCovers) {
    const ocr = await auditCoverOcr(root, brochures, report.passed);
    const ocrReport = {
      version: 1,
      generatedAt: new Date().toISOString(),
      operation: 'offline-cover-ocr-diagnostic',
      networkAccess: false,
      uploadAccess: false,
      baseAuditReference: DEFAULT_OUTPUT,
      baseValidation: {
        passed: report.passed,
        issueCount: report.issues.length,
        sample: report.sample,
      },
      ocr,
      identityDecision: 'OCR results do not alter file hashes, page vectors, or merge decisions.',
    };
    await writeFile(outputPath, `${JSON.stringify(ocrReport, null, 2)}\n`, 'utf8');
    console.log(`Local OCR report: ${path.relative(root, outputPath)}`);
    console.log(
      `OCR covers: ${ocr.coverPagesProcessed}/${ocr.coverPagesExpected}; Tesseract ${ocr.engine ? 'available' : 'unavailable'}; base issues=${report.issues.length}.`,
    );
  } else {
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`Local audit report: ${path.relative(root, outputPath)}`);
  }
  console.log(
    `22043 sample: ${sampleBrns.length} BRNs, ${brochures.length} brochures, ${totalManifestPageCount} pages, ${pageResults.length} JPEGs decoded.`,
  );
  console.log(
    `Comparisons: exact full-vector match=${identicalVectorEqual}; same cover/different full vector=${coverByteIdentical && fullVectorsDifferent}; issues=${issues.length}.`,
  );
  if (issues.length > 0) {
    for (const issue of issues.slice(0, 20))
      console.error(`${issue.code}: ${issue.message}${issue.path ? ` (${issue.path})` : ''}`);
    if (issues.length > 20) console.error(`... and ${issues.length - 20} more issues.`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
