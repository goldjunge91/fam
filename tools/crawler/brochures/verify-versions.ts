import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
import { classifyAutomaticComparison, type AutomaticClassification } from './auto-classification';
import {
  changedOcrTokens,
  ocrTextSimilarity,
  runCachedOcr,
  type OcrRequest,
  type OcrResult,
} from './ocr';
import type { PageSelectionMode } from './page-selection';

type PageReference = {
  pageNumber: number;
  assetPath: string;
  contentHash: string;
  perceptualHash: string;
  bytes: number;
};

type FailedPage = {
  pageNumber?: number;
  code?: string;
  message?: string;
  [key: string]: unknown;
};

export type PageSelectionManifest = {
  mode: PageSelectionMode;
  deliveredPageNumbers: number[];
  selectedPageNumbers: number[];
  savedPageNumbers: number[];
  failedPages: FailedPage[];
  complete: boolean;
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
  pageSelection?: PageSelectionManifest;
};

type ManifestDiagnostic = {
  code?: unknown;
  severity?: unknown;
  brochureId?: unknown;
  location?: unknown;
};

type CrawlerManifest = {
  version: number;
  generatedAt: string;
  outputDir: string;
  pageSelection?: PageSelectionMode;
  selectionMode?: PageSelectionMode;
  brochures: BrochureRecord[];
  diagnostics?: ManifestDiagnostic[];
};

export type RecordCoverage = {
  status: 'complete' | 'partial';
  mode: PageSelectionMode | 'unknown';
  reason: string;
  deliveredPageNumbers: number[];
  selectedPageNumbers: number[];
  savedPageNumbers: number[];
  failedPages: FailedPage[];
};

export type ReviewDecision = 'identical' | 'different' | 'wrong-ad-page' | 'regional-variant';

type StoredDecision = {
  decision: ReviewDecision;
  decidedAt: string;
  note?: string;
};

type DecisionsFile = {
  version: 1;
  decisions: Record<string, StoredDecision>;
};

type PageComparison = {
  index: number;
  left?: PageReference;
  right?: PageReference;
  exact: boolean;
  hammingDistance: number;
  similarity: number;
  ocr?: {
    similarity: number;
    textHashMatch: boolean;
    leftTokenCount: number;
    rightTokenCount: number;
    changedTokens: string[];
  };
};

type OcrSummary = {
  comparedPages: number;
  textEquivalentPages: number;
  textDifferentPages: number;
  averageTextSimilarity: number;
  lowestTextSimilarity: number;
  leftRegionCode?: string;
  rightRegionCode?: string;
  regionCodeMatch?: boolean;
};

export type ReviewCandidate = {
  id: string;
  storeId: string;
  storeName: string;
  validFrom: string;
  validUntil: string;
  similarity: number;
  left: BrochureRecord;
  right: BrochureRecord;
  previewPages: PageComparison[];
  coverage: {
    left: RecordCoverage;
    right: RecordCoverage;
  };
  ocr?: OcrSummary;
  automaticClassification: AutomaticClassification;
  decision?: StoredDecision;
};

export type VerificationReport = {
  version: 3;
  generatedAt: string;
  manifestPath: string;
  decisionsPath: string;
  reportDir: string;
  selectionMode: PageSelectionMode | 'unknown';
  similarityThreshold: number;
  ocr: {
    enabled: boolean;
    language: string;
    dHashThreshold: number;
    pixelDifferenceThreshold: number;
    textSimilarityThreshold: number;
  };
  summary: {
    publicationGroups: number;
    versionRecords: number;
    uniqueExactVersions: number;
    comparisons: number;
    exactDuplicateRecords: number;
    spanningEdges: number;
    automaticallyDifferentPairs: number;
    reviewCandidates: number;
    reviewed: number;
    unreviewed: number;
    ocrAssets: number;
    ocrPageComparisons: number;
    ocrTextDifferentPages: number;
    autoIdenticalPairs: number;
    autoRegionalVariantPairs: number;
    autoDifferentPairs: number;
    autoUncertainPairs: number;
    automaticSemanticGroups: number;
    completeProspects: number;
    partialProspects: number;
    failedDownloadProspects: number;
    failedDownloadPages: number;
    budgetSkippedPages: number;
    invalidRecords: number;
  };
  candidates: ReviewCandidate[];
  issues: string[];
};

type ComparisonEdge = {
  leftIndex: number;
  rightIndex: number;
  left: BrochureRecord;
  right: BrochureRecord;
  similarity: number;
  pageComparisons: PageComparison[];
};

class DisjointSet {
  private readonly parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
  }

  private find(value: number): number {
    const parent = this.parent[value]!;
    if (parent === value) return value;
    const root = this.find(parent);
    this.parent[value] = root;
    return root;
  }

  union(left: number, right: number): boolean {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot === rightRoot) return false;
    this.parent[rightRoot] = leftRoot;
    return true;
  }
}

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`) || argument(name) === 'true';
}

export function manifestSelectionMode(
  manifest: Pick<CrawlerManifest, 'selectionMode' | 'pageSelection'>,
): PageSelectionMode | 'unknown' {
  const mode = manifest.selectionMode ?? manifest.pageSelection;
  return mode === 'all-pages' ||
    mode === 'first-pages-with-discount-hotspots' ||
    mode === 'all-pages-with-discount-hotspots'
    ? mode
    : 'unknown';
}

function pageNumbersMatch(left: number[], right: number[]): boolean {
  return (
    left.length === right.length && left.every((pageNumber, index) => pageNumber === right[index])
  );
}

function failedPageList(value: PageSelectionManifest | undefined): FailedPage[] {
  return (
    value?.failedPages?.filter(
      (failure): failure is FailedPage => typeof failure === 'object' && failure !== null,
    ) ?? []
  );
}

function diagnosticIsBlocking(diagnostic: ManifestDiagnostic): boolean {
  const code = typeof diagnostic.code === 'string' ? diagnostic.code.toLowerCase() : '';
  const severity = typeof diagnostic.severity === 'string' ? diagnostic.severity.toLowerCase() : '';
  if (code === 'offers-list-succeeded' || code === 'brochure-found' || code === 'store-not-found') {
    return false;
  }
  return (
    severity === 'error' ||
    /failed|missing|invalid|gap|unprocessable|incomplete|lücke|fehlt|ungültig/.test(code)
  );
}

function diagnosticAppliesToRecord(
  diagnostic: ManifestDiagnostic,
  record: BrochureRecord,
): boolean {
  if (!diagnosticIsBlocking(diagnostic)) return false;
  if (diagnostic.brochureId !== undefined) return diagnostic.brochureId === record.id;
  return typeof diagnostic.location === 'string' && record.locations.includes(diagnostic.location);
}

export function classifyRecordCoverage(
  record: BrochureRecord,
  selectionMode: PageSelectionMode | 'unknown',
  diagnostics: readonly ManifestDiagnostic[] = [],
): RecordCoverage {
  const selection = record.pageSelection;
  const mode = selection?.mode ?? selectionMode;
  const deliveredPageNumbers = selection?.deliveredPageNumbers ?? [];
  const selectedPageNumbers =
    selection?.selectedPageNumbers ?? record.pages.map((page) => page.pageNumber);
  const savedPageNumbers =
    selection?.savedPageNumbers ?? record.pages.map((page) => page.pageNumber);
  const failedPages = failedPageList(selection);

  if (diagnostics.some((diagnostic) => diagnosticAppliesToRecord(diagnostic, record))) {
    return {
      status: 'partial',
      mode:
        mode === 'all-pages' ||
        mode === 'all-pages-with-discount-hotspots' ||
        mode === 'first-pages-with-discount-hotspots'
          ? mode
          : 'unknown',
      reason:
        'Das Manifest enthält eine blockierende Quellen- oder Seitendiagnose für diesen Prospekt.',
      deliveredPageNumbers,
      selectedPageNumbers,
      savedPageNumbers,
      failedPages,
    };
  }

  if (
    selectionMode === 'all-pages-with-discount-hotspots' ||
    mode === 'all-pages-with-discount-hotspots'
  ) {
    return {
      status: 'partial',
      mode: 'all-pages-with-discount-hotspots',
      reason: 'Altes Manifest mit Discount-Hotspot-Teilansicht.',
      deliveredPageNumbers,
      selectedPageNumbers,
      savedPageNumbers,
      failedPages,
    };
  }
  if (!selection || mode !== 'all-pages') {
    return {
      status: 'partial',
      mode: mode === 'first-pages-with-discount-hotspots' ? mode : 'unknown',
      reason: 'Der Datensatz enthält nur eine begrenzte oder nicht ausgewiesene Seitenauswahl.',
      deliveredPageNumbers,
      selectedPageNumbers,
      savedPageNumbers,
      failedPages,
    };
  }
  if (record.pages.length === 0 || deliveredPageNumbers.length === 0) {
    return {
      status: 'partial',
      mode,
      reason: 'Eine leere Seitenfolge beweist keinen vollständigen Prospekt.',
      deliveredPageNumbers,
      selectedPageNumbers,
      savedPageNumbers,
      failedPages,
    };
  }
  if (
    !selection.complete ||
    failedPages.length > 0 ||
    !pageNumbersMatch(deliveredPageNumbers, selectedPageNumbers) ||
    !pageNumbersMatch(selectedPageNumbers, savedPageNumbers)
  ) {
    return {
      status: 'partial',
      mode,
      reason:
        failedPages.length > 0
          ? 'Mindestens ein Seitendownload ist fehlgeschlagen.'
          : 'Nicht jede gelieferte Seite wurde erfolgreich gespeichert.',
      deliveredPageNumbers,
      selectedPageNumbers,
      savedPageNumbers,
      failedPages,
    };
  }
  return {
    status: 'complete',
    mode,
    reason: 'Alle gelieferten Seiten wurden ausgewählt und gespeichert.',
    deliveredPageNumbers,
    selectedPageNumbers,
    savedPageNumbers,
    failedPages,
  };
}

function comparableRecord(record: BrochureRecord): boolean {
  return record.pages.every(
    (page) => page.contentHash.length > 0 && page.perceptualHash.length > 0,
  );
}

function coverageIdentity(record: BrochureRecord, coverage: RecordCoverage): string {
  // Keep IDs from pre-v6 manifests stable so existing manual decisions remain
  // readable. New manifests always carry pageSelection and therefore get an
  // identity that prevents decisions from a different selection mode leaking in.
  return record.pageSelection ? `${coverage.mode}:${coverage.status}` : '';
}

function failedPageCode(failure: FailedPage): string {
  return typeof failure.code === 'string' ? failure.code.toUpperCase() : '';
}

function hammingDistance(left: string, right: string): number {
  let difference = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
  let count = 0;
  while (difference !== 0n) {
    difference &= difference - 1n;
    count++;
  }
  return count;
}

function comparePages(left: BrochureRecord, right: BrochureRecord): PageComparison[] {
  const maxPages = Math.max(left.pages.length, right.pages.length);
  return Array.from({ length: maxPages }, (_, index) => {
    const leftPage = left.pages[index];
    const rightPage = right.pages[index];
    if (!leftPage || !rightPage) {
      return {
        index,
        left: leftPage,
        right: rightPage,
        exact: false,
        hammingDistance: 64,
        similarity: 0,
      };
    }
    const distance = hammingDistance(leftPage.perceptualHash, rightPage.perceptualHash);
    return {
      index,
      left: leftPage,
      right: rightPage,
      exact: leftPage.contentHash === rightPage.contentHash,
      hammingDistance: distance,
      similarity: 1 - distance / 64,
    };
  });
}

function sequenceSimilarity(pages: PageComparison[]): number {
  if (pages.length === 0) return 0;
  return pages.reduce((sum, page) => sum + page.similarity, 0) / pages.length;
}

function candidateId(
  left: BrochureRecord,
  right: BrochureRecord,
  leftCoverage: RecordCoverage,
  rightCoverage: RecordCoverage,
): string {
  const keys = [
    `${left.storeId}:${left.id}:${left.contentSignature}:${coverageIdentity(left, leftCoverage)}`,
    `${right.storeId}:${right.id}:${right.contentSignature}:${coverageIdentity(right, rightCoverage)}`,
  ].sort();
  return createHash('sha256').update(keys.join('|')).digest('hex').slice(0, 24);
}

function previewPages(comparisons: PageComparison[]): PageComparison[] {
  const differing = comparisons.filter((comparison) => !comparison.exact);
  const selected = differing.length > 0 ? differing : comparisons;
  return selected
    .toSorted(
      (left, right) =>
        (left.ocr?.similarity ?? left.similarity) - (right.ocr?.similarity ?? right.similarity) ||
        left.index - right.index,
    )
    .slice(0, 6);
}

async function ocrRequests(
  edges: ComparisonEdge[],
  dHashThreshold: number,
  pixelDifferenceThreshold: number,
  outputDir: string,
): Promise<OcrRequest[]> {
  const requests = new Map<string, OcrRequest>();
  const exactDHashPairs: Array<{ left: PageReference; right: PageReference }> = [];
  for (const edge of edges) {
    for (const comparison of edge.pageComparisons) {
      if (
        comparison.exact ||
        comparison.similarity < dHashThreshold ||
        !comparison.left ||
        !comparison.right
      ) {
        continue;
      }
      if (comparison.hammingDistance > 0) {
        requests.set(comparison.left.contentHash, comparison.left);
        requests.set(comparison.right.contentHash, comparison.right);
      } else {
        exactDHashPairs.push({ left: comparison.left, right: comparison.right });
      }
    }
    if (edge.left.storeId === 'rewe') {
      const leftFirstPage = edge.left.pages[0];
      const rightFirstPage = edge.right.pages[0];
      if (leftFirstPage) requests.set(leftFirstPage.contentHash, leftFirstPage);
      if (rightFirstPage) requests.set(rightFirstPage.contentHash, rightFirstPage);
    }
  }

  const pages = new Map<string, PageReference>();
  for (const pair of exactDHashPairs) {
    pages.set(pair.left.contentHash, pair.left);
    pages.set(pair.right.contentHash, pair.right);
  }
  const thumbnails = new Map<string, Buffer>();
  const pending = [...pages.values()];
  let cursor = 0;
  const worker = async () => {
    while (cursor < pending.length) {
      const page = pending[cursor++]!;
      thumbnails.set(
        page.contentHash,
        await sharp(join(outputDir, page.assetPath))
          .greyscale()
          .resize(128, 192, { fit: 'fill' })
          .raw()
          .toBuffer(),
      );
    }
  };
  await Promise.all(Array.from({ length: Math.min(16, pending.length) }, () => worker()));

  let skippedReencodings = 0;
  for (const pair of exactDHashPairs) {
    const left = thumbnails.get(pair.left.contentHash);
    const right = thumbnails.get(pair.right.contentHash);
    if (!left || !right || left.length !== right.length) continue;
    let difference = 0;
    for (let index = 0; index < left.length; index++) {
      difference += Math.abs(left[index]! - right[index]!);
    }
    if (difference / left.length < pixelDifferenceThreshold) {
      skippedReencodings++;
      continue;
    }
    requests.set(pair.left.contentHash, pair.left);
    requests.set(pair.right.contentHash, pair.right);
  }
  console.log(
    `🧮 OCR-Vorfilter: ${skippedReencodings} dHash-identische Seitenpaare als reine Neukomprimierung übersprungen`,
  );
  return [...requests.values()];
}

function enrichWithOcr(
  comparisons: PageComparison[],
  results: Map<string, OcrResult>,
): PageComparison[] {
  return comparisons.map((comparison) => {
    if (!comparison.left || !comparison.right) return comparison;
    const left = results.get(comparison.left.contentHash);
    const right = results.get(comparison.right.contentHash);
    if (!left || !right || (left.tokens.length === 0 && right.tokens.length === 0)) {
      return comparison;
    }
    return {
      ...comparison,
      ocr: {
        similarity: ocrTextSimilarity(left.tokens, right.tokens),
        textHashMatch: left.textHash === right.textHash,
        leftTokenCount: left.tokens.length,
        rightTokenCount: right.tokens.length,
        changedTokens: changedOcrTokens(left.tokens, right.tokens),
      },
    };
  });
}

function summarizeOcr(
  edge: ComparisonEdge,
  comparisons: PageComparison[],
  results: Map<string, OcrResult>,
  textSimilarityThreshold: number,
): OcrSummary | undefined {
  const compared = comparisons.flatMap((comparison) => (comparison.ocr ? [comparison.ocr] : []));
  const leftRegionCode = edge.left.pages[0]
    ? results.get(edge.left.pages[0].contentHash)?.regionCode
    : undefined;
  const rightRegionCode = edge.right.pages[0]
    ? results.get(edge.right.pages[0].contentHash)?.regionCode
    : undefined;
  if (compared.length === 0 && !leftRegionCode && !rightRegionCode) return undefined;
  const averageTextSimilarity =
    compared.length === 0
      ? 0
      : compared.reduce((sum, comparison) => sum + comparison.similarity, 0) / compared.length;
  return {
    comparedPages: compared.length,
    textEquivalentPages: compared.filter(
      (comparison) => comparison.similarity >= textSimilarityThreshold,
    ).length,
    textDifferentPages: compared.filter(
      (comparison) => comparison.similarity < textSimilarityThreshold,
    ).length,
    averageTextSimilarity,
    lowestTextSimilarity:
      compared.length === 0 ? 0 : Math.min(...compared.map((comparison) => comparison.similarity)),
    ...(leftRegionCode ? { leftRegionCode } : {}),
    ...(rightRegionCode ? { rightRegionCode } : {}),
    ...(leftRegionCode && rightRegionCode
      ? { regionCodeMatch: leftRegionCode === rightRegionCode }
      : {}),
  };
}

async function readDecisions(path: string): Promise<DecisionsFile> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as Partial<DecisionsFile>;
    return {
      version: 1,
      decisions: parsed.decisions && typeof parsed.decisions === 'object' ? parsed.decisions : {},
    };
  } catch {
    return { version: 1, decisions: {} };
  }
}

function publicationKey(brochure: BrochureRecord): string {
  return `${brochure.storeId}|${brochure.validFrom}|${brochure.validUntil}`;
}

async function main(): Promise<void> {
  const manifestArgument = argument('manifest');
  if (!manifestArgument) throw new Error('Bitte --manifest=/pfad/manifest.json setzen.');
  const manifestPath = resolve(manifestArgument);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as CrawlerManifest;
  const selectionMode = manifestSelectionMode(manifest);
  const invalidRecords = manifest.brochures.filter((brochure) => !comparableRecord(brochure));
  const issues = invalidRecords.map(
    (brochure) =>
      `Prospekt ${brochure.id} kann nicht verglichen werden: mindestens eine Seite enthält keinen perceptualHash oder contentHash.`,
  );

  const threshold = Number.parseFloat(argument('threshold') ?? '0.82');
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new Error('--threshold muss zwischen 0 und 1 liegen.');
  }

  const ocrEnabled = flag('ocr');
  const ocrLanguage = argument('ocr-language') ?? 'deu';
  const ocrConcurrency = Number.parseInt(argument('ocr-concurrency') ?? '6', 10);
  if (!Number.isInteger(ocrConcurrency) || ocrConcurrency < 1 || ocrConcurrency > 16) {
    throw new Error('--ocr-concurrency muss zwischen 1 und 16 liegen.');
  }
  const ocrDHashThreshold = Number.parseFloat(argument('ocr-dhash-threshold') ?? '0.95');
  if (!Number.isFinite(ocrDHashThreshold) || ocrDHashThreshold < 0 || ocrDHashThreshold > 1) {
    throw new Error('--ocr-dhash-threshold muss zwischen 0 und 1 liegen.');
  }
  const ocrPixelDifferenceThreshold = Number.parseFloat(argument('ocr-pixel-threshold') ?? '0.5');
  if (!Number.isFinite(ocrPixelDifferenceThreshold) || ocrPixelDifferenceThreshold < 0) {
    throw new Error('--ocr-pixel-threshold muss mindestens 0 sein.');
  }
  const ocrTextSimilarityThreshold = Number.parseFloat(argument('ocr-text-threshold') ?? '0.985');
  if (
    !Number.isFinite(ocrTextSimilarityThreshold) ||
    ocrTextSimilarityThreshold < 0 ||
    ocrTextSimilarityThreshold > 1
  ) {
    throw new Error('--ocr-text-threshold muss zwischen 0 und 1 liegen.');
  }

  const outputDir = dirname(manifestPath);
  const decisionsPath = join(outputDir, 'review-decisions.json');
  const reportDirArgument = argument('report-dir');
  const reportDir = resolve(reportDirArgument ?? outputDir);
  await mkdir(reportDir, { recursive: true });
  const reportPath = join(reportDir, 'verification-report.json');
  const decisions = await readDecisions(decisionsPath);
  const comparableRecords = manifest.brochures.filter(comparableRecord);
  const publicationGroups = Map.groupBy(comparableRecords, publicationKey);
  const selectedEdges: ComparisonEdge[] = [];
  let comparisons = 0;
  let exactDuplicateRecords = 0;
  let uniqueExactVersions = 0;
  let spanningEdges = 0;
  let automaticallyDifferentPairs = 0;

  for (const group of publicationGroups.values()) {
    const exactGroups = Map.groupBy(group, (brochure) => {
      const coverage = classifyRecordCoverage(brochure, selectionMode, manifest.diagnostics ?? []);
      if (coverage.status === 'complete' && brochure.contentSignature) {
        return `complete:${brochure.contentSignature}`;
      }
      return `partial:${brochure.storeId}:${brochure.id}:${brochure.locations.join(',')}:${brochure.contentSignature}`;
    });
    for (const records of exactGroups.values()) {
      const coverage = classifyRecordCoverage(
        records[0]!,
        selectionMode,
        manifest.diagnostics ?? [],
      );
      if (coverage.status === 'complete') {
        exactDuplicateRecords += records.length - 1;
      }
    }
    uniqueExactVersions += exactGroups.size;
    const representatives = [...exactGroups.values()].map((records) => ({
      ...records[0]!,
      locations: [...new Set(records.flatMap((record) => record.locations))],
    }));
    const edges: ComparisonEdge[] = [];
    for (let leftIndex = 0; leftIndex < representatives.length; leftIndex++) {
      for (let rightIndex = leftIndex + 1; rightIndex < representatives.length; rightIndex++) {
        const left = representatives[leftIndex]!;
        const right = representatives[rightIndex]!;
        comparisons++;
        const pageComparisons = comparePages(left, right);
        const similarity = sequenceSimilarity(pageComparisons);
        edges.push({ leftIndex, rightIndex, left, right, similarity, pageComparisons });
      }
    }

    edges.sort((a, b) => b.similarity - a.similarity);
    const disjointSet = new DisjointSet(representatives.length);
    for (const edge of edges) {
      if (!disjointSet.union(edge.leftIndex, edge.rightIndex)) continue;
      spanningEdges++;
      const leftCoverage = classifyRecordCoverage(
        edge.left,
        selectionMode,
        manifest.diagnostics ?? [],
      );
      const rightCoverage = classifyRecordCoverage(
        edge.right,
        selectionMode,
        manifest.diagnostics ?? [],
      );
      if (
        edge.similarity < threshold &&
        leftCoverage.status === 'complete' &&
        rightCoverage.status === 'complete'
      ) {
        automaticallyDifferentPairs++;
        continue;
      }
      selectedEdges.push(edge);
    }
  }

  const requests = ocrEnabled
    ? await ocrRequests(selectedEdges, ocrDHashThreshold, ocrPixelDifferenceThreshold, outputDir)
    : [];
  const ocrResults = ocrEnabled
    ? await runCachedOcr({
        outputDir,
        requests,
        language: ocrLanguage,
        concurrency: ocrConcurrency,
      })
    : new Map<string, OcrResult>();
  const candidates = selectedEdges.map((edge): ReviewCandidate => {
    const { left, right, similarity } = edge;
    const leftCoverage = classifyRecordCoverage(left, selectionMode, manifest.diagnostics ?? []);
    const rightCoverage = classifyRecordCoverage(right, selectionMode, manifest.diagnostics ?? []);
    const pageComparisons = enrichWithOcr(edge.pageComparisons, ocrResults);
    const id = candidateId(left, right, leftCoverage, rightCoverage);
    const ocr = summarizeOcr(edge, pageComparisons, ocrResults, ocrTextSimilarityThreshold);
    const automaticClassification =
      leftCoverage.status !== 'complete' || rightCoverage.status !== 'complete'
        ? {
            decision: 'uncertain' as const,
            confidence: 'low' as const,
            reason:
              'Mindestens ein Prospekt ist nur eine Teilansicht oder enthält fehlgeschlagene Downloads.',
          }
        : classifyAutomaticComparison({
            overallSimilarity: similarity,
            minimumPageSimilarity:
              pageComparisons.length === 0
                ? 0
                : Math.min(...pageComparisons.map((comparison) => comparison.similarity)),
            samePageCount: left.pages.length === right.pages.length,
            ocrTextDifferentPages: ocrEnabled ? (ocr?.textDifferentPages ?? 0) : 1,
            regionCodeMatch: ocr?.regionCodeMatch,
            automaticDifferenceThreshold: threshold,
          });
    return {
      id,
      storeId: left.storeId,
      storeName: left.storeName,
      validFrom: left.validFrom,
      validUntil: left.validUntil,
      similarity,
      left,
      right,
      previewPages: previewPages(pageComparisons),
      coverage: { left: leftCoverage, right: rightCoverage },
      ...(ocr ? { ocr } : {}),
      automaticClassification,
      decision: decisions.decisions[id],
    };
  });

  candidates.sort((a, b) => b.similarity - a.similarity || a.storeName.localeCompare(b.storeName));
  const reviewed = candidates.filter((candidate) => candidate.decision).length;
  const ocrPageComparisons = candidates.reduce(
    (sum, candidate) => sum + (candidate.ocr?.comparedPages ?? 0),
    0,
  );
  const ocrTextDifferentPages = candidates.reduce(
    (sum, candidate) => sum + (candidate.ocr?.textDifferentPages ?? 0),
    0,
  );
  const autoIdenticalPairs = candidates.filter(
    (candidate) => candidate.automaticClassification.decision === 'identical',
  ).length;
  const autoRegionalVariantPairs = candidates.filter(
    (candidate) => candidate.automaticClassification.decision === 'regional-variant',
  ).length;
  const autoUncertainPairs = candidates.filter(
    (candidate) => candidate.automaticClassification.decision === 'uncertain',
  ).length;
  const coverages = manifest.brochures.map((brochure) =>
    classifyRecordCoverage(brochure, selectionMode, manifest.diagnostics ?? []),
  );
  const failedDownloadProspects = coverages.filter((coverage) => coverage.failedPages.length > 0);
  const failedDownloadPages = coverages.reduce(
    (sum, coverage) => sum + coverage.failedPages.length,
    0,
  );
  const budgetSkippedPages = coverages.reduce(
    (sum, coverage) =>
      sum +
      coverage.failedPages.filter((failure) => failedPageCode(failure).includes('BUDGET')).length,
    0,
  );
  const report: VerificationReport = {
    version: 3,
    generatedAt: new Date().toISOString(),
    manifestPath,
    decisionsPath,
    reportDir,
    selectionMode,
    similarityThreshold: threshold,
    ocr: {
      enabled: ocrEnabled,
      language: ocrLanguage,
      dHashThreshold: ocrDHashThreshold,
      pixelDifferenceThreshold: ocrPixelDifferenceThreshold,
      textSimilarityThreshold: ocrTextSimilarityThreshold,
    },
    summary: {
      publicationGroups: publicationGroups.size,
      versionRecords: manifest.brochures.length,
      uniqueExactVersions,
      comparisons,
      exactDuplicateRecords,
      spanningEdges,
      automaticallyDifferentPairs,
      reviewCandidates: candidates.length,
      reviewed,
      unreviewed: candidates.length - reviewed,
      ocrAssets: ocrResults.size,
      ocrPageComparisons,
      ocrTextDifferentPages,
      autoIdenticalPairs,
      autoRegionalVariantPairs,
      autoDifferentPairs: automaticallyDifferentPairs,
      autoUncertainPairs,
      automaticSemanticGroups: uniqueExactVersions - autoIdenticalPairs,
      completeProspects: coverages.filter((coverage) => coverage.status === 'complete').length,
      partialProspects: coverages.filter((coverage) => coverage.status === 'partial').length,
      failedDownloadProspects: failedDownloadProspects.length,
      failedDownloadPages,
      budgetSkippedPages,
      invalidRecords: invalidRecords.length,
    },
    candidates,
    issues,
  };

  const temporaryReportPath = `${reportPath}.${process.pid}.tmp`;
  await writeFile(temporaryReportPath, JSON.stringify(report, null, 2), 'utf8');
  await rename(temporaryReportPath, reportPath);
  if (Object.keys(decisions.decisions).length === 0) {
    await writeFile(decisionsPath, JSON.stringify(decisions, null, 2), 'utf8');
  }

  console.log('\n🔎 Prospekt-Verifikation');
  console.log(`📚 Publikationsgruppen: ${report.summary.publicationGroups}`);
  console.log(`🧩 Versionsdatensätze: ${report.summary.versionRecords}`);
  console.log(`🔐 Exakte Inhaltsversionen: ${report.summary.uniqueExactVersions}`);
  console.log(`✅ Exakt zusammengelegt: ${report.summary.exactDuplicateRecords}`);
  console.log(`🔁 Ähnlichkeitsberechnungen: ${report.summary.comparisons}`);
  console.log(`🌲 Relevante Verbindungen: ${report.summary.spanningEdges}`);
  console.log(`↔️ Automatisch verschieden: ${report.summary.automaticallyDifferentPairs}`);
  console.log(`👤 Review-Kandidaten: ${report.summary.reviewCandidates}`);
  console.log(`⏳ Ungeprüft: ${report.summary.unreviewed}`);
  console.log(
    `📄 Vollständig: ${report.summary.completeProspects} | Teilansichten: ${report.summary.partialProspects}`,
  );
  console.log(
    `⚠️ Fehlgeschlagene Downloads: ${report.summary.failedDownloadPages} Seiten in ${report.summary.failedDownloadProspects} Prospekten`,
  );
  if (report.summary.budgetSkippedPages > 0) {
    console.log(`💽 Budgetbedingt ausgelassen: ${report.summary.budgetSkippedPages} Seiten`);
  }
  if (ocrEnabled) {
    console.log(`🔤 OCR-Assets: ${report.summary.ocrAssets}`);
    console.log(`🔤 OCR-Seitenvergleiche: ${report.summary.ocrPageComparisons}`);
    console.log(`🔤 OCR-Textabweichungen: ${report.summary.ocrTextDifferentPages}`);
    console.log(`🤖 Automatisch identisch: ${report.summary.autoIdenticalPairs}`);
    console.log(`🗺️ Automatisch regional: ${report.summary.autoRegionalVariantPairs}`);
    console.log(`❓ Automatisch unklar: ${report.summary.autoUncertainPairs}`);
    console.log(`🧠 Konservative Auto-Gruppen: ${report.summary.automaticSemanticGroups}`);
  }
  console.log(`💾 Bericht: ${reportPath}`);
}

if (process.argv[1]?.match(/[\\/]verify-versions\.ts$/)) {
  main().catch((error: unknown) => {
    console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
