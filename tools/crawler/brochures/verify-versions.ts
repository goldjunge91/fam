import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
import {
  classifyAutomaticComparison,
  type AutomaticClassification,
} from './auto-classification';
import {
  changedOcrTokens,
  ocrTextSimilarity,
  runCachedOcr,
  type OcrRequest,
  type OcrResult,
} from './ocr';

type PageReference = {
  pageNumber: number;
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

type CrawlerManifest = {
  version: number;
  generatedAt: string;
  outputDir: string;
  brochures: BrochureRecord[];
};

export type ReviewDecision =
  | 'identical'
  | 'different'
  | 'wrong-ad-page'
  | 'regional-variant';

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
  ocr?: OcrSummary;
  automaticClassification: AutomaticClassification;
  decision?: StoredDecision;
};

type VerificationReport = {
  version: 2;
  generatedAt: string;
  manifestPath: string;
  decisionsPath: string;
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
  };
  candidates: ReviewCandidate[];
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

function candidateId(left: BrochureRecord, right: BrochureRecord): string {
  const keys = [
    `${left.storeId}:${left.id}:${left.contentSignature}`,
    `${right.storeId}:${right.id}:${right.contentSignature}`,
  ].sort();
  return createHash('sha256').update(keys.join('|')).digest('hex').slice(0, 24);
}

function previewPages(comparisons: PageComparison[]): PageComparison[] {
  const differing = comparisons.filter((comparison) => !comparison.exact);
  const selected = differing.length > 0 ? differing : comparisons;
  return selected
    .toSorted(
      (left, right) =>
        (left.ocr?.similarity ?? left.similarity) -
          (right.ocr?.similarity ?? right.similarity) ||
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
  const compared = comparisons.flatMap((comparison) =>
    comparison.ocr ? [comparison.ocr] : [],
  );
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
      : compared.reduce((sum, comparison) => sum + comparison.similarity, 0) /
        compared.length;
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
      compared.length === 0
        ? 0
        : Math.min(...compared.map((comparison) => comparison.similarity)),
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
      decisions:
        parsed.decisions && typeof parsed.decisions === 'object' ? parsed.decisions : {},
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
  const missingPerceptualHashes = manifest.brochures.some((brochure) =>
    brochure.pages.some((page) => !page.perceptualHash),
  );
  if (missingPerceptualHashes) {
    throw new Error('Manifest enthält keine perceptualHash-Werte. Crawler erneut mit V5 ausführen.');
  }

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
  const ocrPixelDifferenceThreshold = Number.parseFloat(
    argument('ocr-pixel-threshold') ?? '0.5',
  );
  if (!Number.isFinite(ocrPixelDifferenceThreshold) || ocrPixelDifferenceThreshold < 0) {
    throw new Error('--ocr-pixel-threshold muss mindestens 0 sein.');
  }
  const ocrTextSimilarityThreshold = Number.parseFloat(
    argument('ocr-text-threshold') ?? '0.985',
  );
  if (
    !Number.isFinite(ocrTextSimilarityThreshold) ||
    ocrTextSimilarityThreshold < 0 ||
    ocrTextSimilarityThreshold > 1
  ) {
    throw new Error('--ocr-text-threshold muss zwischen 0 und 1 liegen.');
  }

  const outputDir = dirname(manifestPath);
  const decisionsPath = join(outputDir, 'review-decisions.json');
  const reportPath = join(outputDir, 'verification-report.json');
  const decisions = await readDecisions(decisionsPath);
  const publicationGroups = Map.groupBy(manifest.brochures, publicationKey);
  const selectedEdges: ComparisonEdge[] = [];
  let comparisons = 0;
  let exactDuplicateRecords = 0;
  let uniqueExactVersions = 0;
  let spanningEdges = 0;
  let automaticallyDifferentPairs = 0;

  for (const group of publicationGroups.values()) {
    const exactGroups = Map.groupBy(group, (brochure) => brochure.contentSignature);
    exactDuplicateRecords += group.length - exactGroups.size;
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
      if (edge.similarity < threshold) {
        automaticallyDifferentPairs++;
        continue;
      }
      selectedEdges.push(edge);
    }
  }

  const requests = ocrEnabled
    ? await ocrRequests(
        selectedEdges,
        ocrDHashThreshold,
        ocrPixelDifferenceThreshold,
        outputDir,
      )
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
    const pageComparisons = enrichWithOcr(edge.pageComparisons, ocrResults);
    const id = candidateId(left, right);
    const ocr = summarizeOcr(
      edge,
      pageComparisons,
      ocrResults,
      ocrTextSimilarityThreshold,
    );
    const automaticClassification = classifyAutomaticComparison({
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
  const report: VerificationReport = {
    version: 2,
    generatedAt: new Date().toISOString(),
    manifestPath,
    decisionsPath,
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
    },
    candidates,
  };

  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
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
  if (ocrEnabled) {
    console.log(`🔤 OCR-Assets: ${report.summary.ocrAssets}`);
    console.log(`🔤 OCR-Seitenvergleiche: ${report.summary.ocrPageComparisons}`);
    console.log(`🔤 OCR-Textabweichungen: ${report.summary.ocrTextDifferentPages}`);
    console.log(`🤖 Automatisch identisch: ${report.summary.autoIdenticalPairs}`);
    console.log(`🗺️ Automatisch regional: ${report.summary.autoRegionalVariantPairs}`);
    console.log(`❓ Automatisch unklar: ${report.summary.autoUncertainPairs}`);
    console.log(
      `🧠 Konservative Auto-Gruppen: ${report.summary.automaticSemanticGroups}`,
    );
  }
  console.log(`💾 Bericht: ${reportPath}`);
}

main().catch((error: unknown) => {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
