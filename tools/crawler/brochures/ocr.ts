import { createHash } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const OCR_PROFILE = 'page-700px-psm4-tsv55-v2';

export type OcrResult = {
  engine: 'tesseract';
  profile: typeof OCR_PROFILE;
  language: string;
  text: string;
  normalizedText: string;
  textHash: string;
  tokens: string[];
  regionCode?: string;
};

type OcrCache = {
  version: 1;
  language: string;
  profile: typeof OCR_PROFILE;
  entries: Record<string, OcrResult>;
};

export type OcrRequest = {
  contentHash: string;
  assetPath: string;
};

type RunOcrOptions = {
  outputDir: string;
  requests: OcrRequest[];
  language: string;
  concurrency: number;
};

const REGION_MODULES = new Set([
  'BED',
  'BLB',
  'FF',
  'FSH',
  'LS',
  'MGA',
  'NF',
  'RC',
  'RN',
  'REW1',
]);

export function normalizeOcrText(text: string): string {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase('de-DE')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[^\p{L}\p{N}%€._-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeOcrText(text: string): string[] {
  return normalizeOcrText(text)
    .split(' ')
    .filter((token) => token.length > 1 || /^\d$/.test(token));
}

function tokenWeight(token: string): number {
  if (/^\d+(?:\.\d+)?(?:%|€)?$/.test(token)) return 3;
  if (/\d/.test(token)) return 2;
  return token.length >= 4 ? 1 : 0.5;
}

function tokenCounts(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

/** Weighted multiset Jaccard. Numbers and prices intentionally count more than prose. */
export function ocrTextSimilarity(leftTokens: string[], rightTokens: string[]): number {
  if (leftTokens.length === 0 && rightTokens.length === 0) return 1;
  if (leftTokens.length === 0 || rightTokens.length === 0) return 0;
  const left = tokenCounts(leftTokens);
  const right = tokenCounts(rightTokens);
  const tokens = new Set([...left.keys(), ...right.keys()]);
  let intersection = 0;
  let union = 0;
  for (const token of tokens) {
    const weight = tokenWeight(token);
    intersection += Math.min(left.get(token) ?? 0, right.get(token) ?? 0) * weight;
    union += Math.max(left.get(token) ?? 0, right.get(token) ?? 0) * weight;
  }
  return union === 0 ? 1 : intersection / union;
}

export function changedOcrTokens(
  leftTokens: string[],
  rightTokens: string[],
  limit = 16,
): string[] {
  const left = tokenCounts(leftTokens);
  const right = tokenCounts(rightTokens);
  return [...new Set([...left.keys(), ...right.keys()])]
    .filter((token) => left.get(token) !== right.get(token))
    .sort((a, b) => tokenWeight(b) - tokenWeight(a) || a.localeCompare(b, 'de-DE'))
    .slice(0, limit);
}

export function extractReweRegionCode(text: string): string | undefined {
  const candidates = text
    .split(/\r?\n/)
    .flatMap((line) =>
      line.match(/[A-Z]{1,3}(?:-[A-Za-z0-9]{1,6})+(?:_[A-Za-z0-9-]+)*/g) ?? [],
    )
    .filter((candidate) => {
      const modules = candidate.toUpperCase().split(/[-_]/);
      return modules.some((module) => REGION_MODULES.has(module));
    });
  return candidates.sort((a, b) => b.length - a.length)[0];
}

function buildOcrResult(text: string, language: string, regionText = text): OcrResult {
  const normalizedText = normalizeOcrText(text);
  const regionCode = extractReweRegionCode(regionText);
  return {
    engine: 'tesseract',
    profile: OCR_PROFILE,
    language,
    text,
    normalizedText,
    textHash: createHash('sha256').update(normalizedText).digest('hex'),
    tokens: tokenizeOcrText(text),
    ...(regionCode ? { regionCode } : {}),
  };
}

export function parseTesseractTsv(tsv: string, minimumConfidence = 55): {
  text: string;
  regionText: string;
} {
  const confidentLines = new Map<string, string[]>();
  const regionLines = new Map<string, string[]>();
  for (const row of tsv.split(/\r?\n/).slice(1)) {
    const columns = row.split('\t');
    if (columns.length < 12 || columns[0] !== '5') continue;
    const confidence = Number.parseFloat(columns[10] ?? '-1');
    const token = columns.slice(11).join('\t').trim();
    if (!token) continue;
    const lineKey = `${columns[2]}:${columns[3]}:${columns[4]}`;
    const regionLine = regionLines.get(lineKey) ?? [];
    regionLine.push(token);
    regionLines.set(lineKey, regionLine);
    if (confidence < minimumConfidence) continue;
    const confidentLine = confidentLines.get(lineKey) ?? [];
    confidentLine.push(token);
    confidentLines.set(lineKey, confidentLine);
  }
  return {
    text: [...confidentLines.values()].map((tokens) => tokens.join(' ')).join('\n'),
    regionText: [...regionLines.values()].map((tokens) => tokens.join(' ')).join('\n'),
  };
}

async function readCache(path: string, language: string): Promise<OcrCache> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as Partial<OcrCache>;
    if (
      parsed.version === 1 &&
      parsed.language === language &&
      parsed.profile === OCR_PROFILE &&
      parsed.entries
    ) {
      return { version: 1, language, profile: OCR_PROFILE, entries: parsed.entries };
    }
  } catch {
    // Ein neuer OCR-Lauf startet ohne Cache.
  }
  return { version: 1, language, profile: OCR_PROFILE, entries: {} };
}

async function writeCache(path: string, cache: OcrCache): Promise<void> {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(cache), 'utf8');
  await rename(temporaryPath, path);
}

async function recognize(path: string, language: string): Promise<OcrResult> {
  const input = await sharp(path)
    .resize({ width: 700, withoutEnlargement: true })
    .greyscale()
    .sharpen()
    .jpeg({ quality: 85 })
    .toBuffer();
  const process = Bun.spawn(
    ['tesseract', 'stdin', 'stdout', '-l', language, '--psm', '4', 'tsv'],
    { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' },
  );
  process.stdin.write(input);
  process.stdin.end();
  const [text, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`Tesseract fehlgeschlagen (${exitCode}): ${stderr.trim()}`);
  }
  const parsed = parseTesseractTsv(text);
  return buildOcrResult(parsed.text, language, parsed.regionText);
}

export async function runCachedOcr(options: RunOcrOptions): Promise<Map<string, OcrResult>> {
  const cachePath = join(options.outputDir, 'ocr-cache.json');
  const cache = await readCache(cachePath, options.language);
  const uniqueRequests = new Map(
    options.requests.map((request) => [request.contentHash, request]),
  );
  const pending = [...uniqueRequests.values()].filter(
    (request) => !cache.entries[request.contentHash],
  );
  let cursor = 0;
  let processed = 0;
  let nextCheckpoint = 25;
  let saveChain = Promise.resolve();

  console.log(
    `🔤 OCR: ${uniqueRequests.size - pending.length} aus Cache, ${pending.length} neu (${options.language})`,
  );

  const worker = async () => {
    while (cursor < pending.length) {
      const request = pending[cursor++]!;
      cache.entries[request.contentHash] = await recognize(
        join(options.outputDir, request.assetPath),
        options.language,
      );
      processed++;
      if (processed >= nextCheckpoint) {
        nextCheckpoint += 25;
        saveChain = saveChain.then(() => writeCache(cachePath, cache));
        await saveChain;
        console.log(`🔤 OCR-Fortschritt: ${processed}/${pending.length}`);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(options.concurrency, pending.length) }, () => worker()),
  );
  await saveChain;
  if (pending.length > 0) await writeCache(cachePath, cache);

  return new Map(
    [...uniqueRequests.keys()].flatMap((contentHash) => {
      const result = cache.entries[contentHash];
      return result ? [[contentHash, result] as const] : [];
    }),
  );
}
