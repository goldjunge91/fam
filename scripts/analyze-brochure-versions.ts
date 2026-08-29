import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { imageKeyFor } from '../tools/crawler/brochures/r2-storage';
import type { CrawlerBrochure, CrawlerStore, LocationDump } from '../tools/crawler/brochures/types';

type Options = {
  inputDir: string;
  backupPath: string;
  outputPath: string;
  cachePath: string;
  ai: boolean;
  limit?: number;
};

type BrochureCandidate = {
  brochure: CrawlerBrochure;
  store: CrawlerStore;
  pagePaths: string[];
  pageHashes: string[];
  missingPages: number;
};

type HashCacheEntry = {
  mtimeMs: number;
  size: number;
  hash: string;
};

type AnalysisReport = {
  generatedAt: string;
  inputDir: string;
  backupPath: string;
  brochureIds: number;
  exactVersionGroups: number;
  missingPageReferences: number;
  duplicateImageBytes: {
    files: number;
    uniqueContent: number;
    duplicateFiles: number;
    totalBytes: number;
    uniqueBytes: number;
  };
  stores: Array<{
    storeId: string;
    storeName: string;
    brochureIds: string[];
    exactVersions: number;
    versionGroups: string[][];
  }>;
  versionGroups: Array<{
    versionId: string;
    storeIds: string[];
    storeNames: string[];
    brochureIds: string[];
    titles: string[];
    validFrom: string[];
    validUntil: string[];
    pageCount: number;
    pageHashes: string[];
  }>;
  ai?: {
    model: string;
    annotations: Array<{
      versionId: string;
      storeBrand: string;
      title: string;
      validFrom: string | null;
      validUntil: string | null;
      confidence: number;
      notes: string;
    }>;
  };
};

const DEFAULT_BACKUP = 'tools/crawler/data/last_crawl_backup.json';
const DEFAULT_OUTPUT = 'tools/crawler/data/brochure-version-analysis.json';
const DEFAULT_CACHE = 'tools/crawler/data/.brochure-version-hashes.json';

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseOptions(): Options {
  const inputDir = argument('input-dir');
  if (!inputDir) {
    throw new Error(
      'Bitte --input-dir setzen, zum Beispiel --input-dir="/Volumes/Programme/FamCrawler/brochures"',
    );
  }

  const limitValue = argument('limit');
  const limit = limitValue ? Number.parseInt(limitValue, 10) : undefined;
  if (limitValue && (!Number.isInteger(limit) || limit <= 0)) {
    throw new Error('--limit muss eine positive ganze Zahl sein.');
  }

  return {
    inputDir: resolve(inputDir),
    backupPath: resolve(argument('backup') ?? DEFAULT_BACKUP),
    outputPath: resolve(argument('output') ?? DEFAULT_OUTPUT),
    cachePath: resolve(argument('cache') ?? DEFAULT_CACHE),
    ai: hasFlag('ai'),
    limit,
  };
}

function filePathForUrl(inputDir: string, url: string): string {
  return join(inputDir, imageKeyFor(url));
}

async function* jqLines(path: string): AsyncGenerator<string> {
  const child = Bun.spawn(['jq', '-c', '.[]', path], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const decoder = new TextDecoder();
  let pending = '';

  for await (const chunk of child.stdout) {
    pending += decoder.decode(chunk, { stream: true });
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim()) yield line;
    }
  }

  pending += decoder.decode();
  if (pending.trim()) yield pending;

  const exitCode = await child.exited;
  if (exitCode !== 0) {
    const error = await new Response(child.stderr).text();
    throw new Error(`jq konnte das Backup nicht lesen (${exitCode}): ${error.trim()}`);
  }
}

async function collectCandidates(options: Options): Promise<Map<string, BrochureCandidate>> {
  const candidates = new Map<string, BrochureCandidate>();

  for await (const line of jqLines(options.backupPath)) {
    const dump = JSON.parse(line) as LocationDump;
    const stores = new Map(dump.stores.map((store) => [store.id, store]));

    for (const brochure of dump.brochures) {
      if (candidates.has(brochure.id)) continue;

      const store = stores.get(brochure.storeId) ?? {
        id: brochure.storeId,
        name: brochure.storeId,
      };
      candidates.set(brochure.id, {
        brochure,
        store,
        pagePaths: brochure.pages.map((page) => filePathForUrl(options.inputDir, page.imageUrl)),
        pageHashes: [],
        missingPages: 0,
      });

      if (options.limit && candidates.size >= options.limit) return candidates;
    }
  }

  return candidates;
}

async function fileHash(path: string): Promise<{ hash: string; size: number; mtimeMs: number }> {
  const file = Bun.file(path);
  const bytes = Buffer.from(await file.arrayBuffer());
  const stat = await Bun.file(path).stat();
  return {
    hash: createHash('sha256').update(bytes).digest('hex'),
    size: bytes.byteLength,
    mtimeMs: stat.mtimeMs,
  };
}

async function loadHashCache(path: string): Promise<Record<string, HashCacheEntry>> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Record<string, HashCacheEntry>;
  } catch {
    return {};
  }
}

async function hashImages(
  candidates: Map<string, BrochureCandidate>,
  cachePath: string,
): Promise<{
  fileHashes: Map<string, HashCacheEntry>;
  totalBytes: number;
  uniqueBytes: number;
}> {
  const cache = await loadHashCache(cachePath);
  const filePaths = [
    ...new Set([...candidates.values()].flatMap((candidate) => candidate.pagePaths)),
  ];
  const fileHashes = new Map<string, HashCacheEntry>();
  let totalBytes = 0;
  let processed = 0;

  for (let index = 0; index < filePaths.length; index += 16) {
    const chunk = filePaths.slice(index, index + 16);
    await Promise.all(
      chunk.map(async (path) => {
        try {
          const stat = await Bun.file(path).stat();
          const cached = cache[path];
          const entry =
            cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs
              ? cached
              : await fileHash(path);
          fileHashes.set(path, entry);
          cache[path] = entry;
          totalBytes += entry.size;
        } catch {
          fileHashes.set(path, { hash: '', size: 0, mtimeMs: 0 });
        }
        processed += 1;
      }),
    );

    if (processed % 256 === 0 || processed === filePaths.length) {
      console.log(`🔎 Bild-Hashes: ${processed}/${filePaths.length}`);
    }
  }

  const uniqueBytes = [
    ...new Map(
      [...fileHashes.values()].filter((entry) => entry.hash).map((entry) => [entry.hash, entry]),
    ).values(),
  ].reduce((sum, entry) => sum + entry.size, 0);
  await mkdir(join(cachePath, '..'), { recursive: true });
  await writeFile(cachePath, JSON.stringify(cache));

  for (const candidate of candidates.values()) {
    candidate.pageHashes = candidate.pagePaths.map((path) => fileHashes.get(path)?.hash ?? '');
    candidate.missingPages = candidate.pageHashes.filter((hash) => !hash).length;
  }

  return { fileHashes, totalBytes, uniqueBytes };
}

function versionSignature(candidate: BrochureCandidate): string {
  return candidate.pageHashes.join('|');
}

function buildReport(
  options: Options,
  candidates: Map<string, BrochureCandidate>,
  fileHashes: Map<string, HashCacheEntry>,
  totalBytes: number,
  uniqueBytes: number,
): AnalysisReport {
  const groups = new Map<string, BrochureCandidate[]>();
  for (const candidate of candidates.values()) {
    const signature = versionSignature(candidate);
    const group = groups.get(signature) ?? [];
    group.push(candidate);
    groups.set(signature, group);
  }

  const versionGroups = [...groups.entries()].map(([signature, group], index) => ({
    versionId: `version-${String(index + 1).padStart(4, '0')}`,
    storeIds: [...new Set(group.map((candidate) => candidate.store.id))],
    storeNames: [...new Set(group.map((candidate) => candidate.store.name))],
    brochureIds: group.map((candidate) => candidate.brochure.id),
    titles: [...new Set(group.map((candidate) => candidate.brochure.title))],
    validFrom: [...new Set(group.map((candidate) => candidate.brochure.validFrom))],
    validUntil: [...new Set(group.map((candidate) => candidate.brochure.validUntil))],
    pageCount: group[0]?.pageHashes.length ?? 0,
    pageHashes: signature ? signature.split('|') : [],
  }));

  const stores = new Map<string, BrochureCandidate[]>();
  for (const candidate of candidates.values()) {
    const list = stores.get(candidate.store.id) ?? [];
    list.push(candidate);
    stores.set(candidate.store.id, list);
  }

  return {
    generatedAt: new Date().toISOString(),
    inputDir: options.inputDir,
    backupPath: options.backupPath,
    brochureIds: candidates.size,
    exactVersionGroups: versionGroups.length,
    missingPageReferences: [...candidates.values()].reduce(
      (sum, candidate) => sum + candidate.missingPages,
      0,
    ),
    duplicateImageBytes: {
      files: fileHashes.size,
      uniqueContent: new Set([...fileHashes.values()].map((entry) => entry.hash).filter(Boolean))
        .size,
      duplicateFiles:
        fileHashes.size -
        new Set([...fileHashes.values()].map((entry) => entry.hash).filter(Boolean)).size,
      totalBytes,
      uniqueBytes,
    },
    stores: [...stores.entries()].map(([storeId, storeCandidates]) => {
      const storeGroups = new Map<string, string[]>();
      for (const candidate of storeCandidates) {
        const signature = versionSignature(candidate);
        const ids = storeGroups.get(signature) ?? [];
        ids.push(candidate.brochure.id);
        storeGroups.set(signature, ids);
      }
      return {
        storeId,
        storeName: storeCandidates[0]?.store.name ?? storeId,
        brochureIds: storeCandidates.map((candidate) => candidate.brochure.id),
        exactVersions: storeGroups.size,
        versionGroups: [...storeGroups.values()],
      };
    }),
    versionGroups,
  };
}

async function createContactSheet(candidate: BrochureCandidate): Promise<string | null> {
  const paths = candidate.pagePaths.slice(0, 4);
  const images = await Promise.all(
    paths.map(async (path) => {
      try {
        return await sharp(path)
          .resize({ width: 480, height: 640, fit: 'inside' })
          .jpeg({ quality: 78 })
          .toBuffer();
      } catch {
        return null;
      }
    }),
  );
  const validImages = images.filter((image): image is Buffer => image !== null);
  if (validImages.length === 0) return null;

  const canvasWidth = 960;
  const canvasHeight = 1280;
  const composites = validImages.map((image, index) => ({
    input: image,
    left: (index % 2) * 480,
    top: Math.floor(index / 2) * 640,
  }));
  const sheet = await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 3,
      background: '#ffffff',
    },
  })
    .composite(composites)
    .jpeg({ quality: 78 })
    .toBuffer();

  return `data:image/jpeg;base64,${sheet.toString('base64')}`;
}

function chatResponseText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const response = value as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = response.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content : '';
}

async function annotateWithAi(
  report: AnalysisReport,
  candidates: Map<string, BrochureCandidate>,
): Promise<NonNullable<AnalysisReport['ai']>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('Für --ai fehlt OPENROUTER_API_KEY.');
  const model = process.env.OPENROUTER_MODEL ?? 'z-ai/glm-5.3-flash';
  const baseUrl = (process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1').replace(
    /\/$/,
    '',
  );
  const reasoningEffort = process.env.OPENROUTER_REASONING_EFFORT ?? 'low';
  const annotations: NonNullable<AnalysisReport['ai']>['annotations'] = [];

  for (const group of report.versionGroups) {
    const candidate = candidates.get(group.brochureIds[0] ?? '');
    if (!candidate) continue;
    const image = await createContactSheet(candidate);
    if (!image) continue;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        ...(process.env.OPENROUTER_SITE_URL
          ? { 'http-referer': process.env.OPENROUTER_SITE_URL }
          : {}),
        ...(process.env.OPENROUTER_SITE_NAME
          ? { 'x-openrouter-title': process.env.OPENROUTER_SITE_NAME }
          : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analysiere diesen Prospekt-Kontaktbogen. Liefere ausschließlich JSON mit den Feldern storeBrand, title, validFrom, validUntil, confidence und notes. Erkenne den Händler, den Prospekttitel und die sichtbaren Gültigkeitsdaten. Wenn ein Wert nicht sicher lesbar ist, setze null beziehungsweise eine niedrige confidence. Antworte auf Deutsch.',
              },
              { type: 'image_url', image_url: { url: image, detail: 'low' } },
            ],
          },
        ],
        max_tokens: 300,
        reasoning: {
          effort: reasoningEffort,
          exclude: true,
        },
        response_format: {
          type: 'json_object',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Vision-API antwortet mit ${response.status}: ${(await response.text()).slice(0, 500)}`,
      );
    }
    const parsed = JSON.parse(chatResponseText(await response.json())) as {
      storeBrand: string;
      title: string;
      validFrom: string | null;
      validUntil: string | null;
      confidence: number;
      notes: string;
    };
    annotations.push({ versionId: group.versionId, ...parsed });
    console.log(`🤖 KI: ${group.versionId} (${annotations.length}/${report.versionGroups.length})`);
  }

  return { model, annotations };
}

async function main(): Promise<void> {
  const options = parseOptions();
  await access(options.inputDir);
  await access(options.backupPath);

  console.log(`📁 Eingabe: ${options.inputDir}`);
  console.log(`📄 Backup: ${options.backupPath}`);
  console.log('📚 Prospekt-IDs werden aus dem Backup gestreamt ...');
  const candidates = await collectCandidates(options);
  console.log(`📚 ${candidates.size} eindeutige Prospekt-IDs gefunden.`);

  const { fileHashes, totalBytes, uniqueBytes } = await hashImages(candidates, options.cachePath);
  const report = buildReport(options, candidates, fileHashes, totalBytes, uniqueBytes);
  if (options.ai) report.ai = await annotateWithAi(report, candidates);

  await mkdir(resolve(options.outputPath, '..'), { recursive: true });
  await writeFile(options.outputPath, JSON.stringify(report, null, 2));
  console.log(`✅ Analyse gespeichert: ${options.outputPath}`);
  console.log(
    `🧾 ${report.brochureIds} Prospekt-IDs → ${report.exactVersionGroups} exakt verschiedene Seitenfolgen`,
  );
  console.log(
    `💾 ${formatBytes(uniqueBytes)} einzigartige Bilddaten von ${formatBytes(totalBytes)} referenzierten Bilddaten`,
  );
  console.log(`🖼️ ${report.duplicateImageBytes.duplicateFiles} Bilddateien sind Inhaltsduplikate.`);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
