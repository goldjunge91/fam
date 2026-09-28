import { tokenizeOcrText, type OcrLine } from './tsv.ts';

export type ReferenceLine = Pick<OcrLine, 'text'>;

export type OcrComparison = {
  referenceLineCount: number;
  actualLineCount: number;
  tokenSimilarity: number;
  missingTokens: readonly string[];
  addedTokens: readonly string[];
};

function counts(tokens: readonly string[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const token of tokens) result.set(token, (result.get(token) ?? 0) + 1);
  return result;
}

function tokenWeight(token: string): number {
  if (/^\d+(?:\.\d+)?(?:%|€)?$/.test(token)) return 3;
  if (/\d/.test(token)) return 2;
  return token.length >= 4 ? 1 : 0.5;
}

function weightedSimilarity(left: readonly string[], right: readonly string[]): number {
  if (left.length === 0 && right.length === 0) return 1;
  if (left.length === 0 || right.length === 0) return 0;

  const leftCounts = counts(left);
  const rightCounts = counts(right);
  const allTokens = new Set([...leftCounts.keys(), ...rightCounts.keys()]);
  let intersection = 0;
  let union = 0;

  for (const token of allTokens) {
    const weight = tokenWeight(token);
    intersection += Math.min(leftCounts.get(token) ?? 0, rightCounts.get(token) ?? 0) * weight;
    union += Math.max(leftCounts.get(token) ?? 0, rightCounts.get(token) ?? 0) * weight;
  }

  return union === 0 ? 1 : Number((intersection / union).toFixed(4));
}

function changedTokens(
  reference: readonly string[],
  actual: readonly string[],
): readonly string[] {
  const referenceCounts = counts(reference);
  const actualCounts = counts(actual);
  return [...new Set([...referenceCounts.keys(), ...actualCounts.keys()])]
    .filter((token) => (referenceCounts.get(token) ?? 0) !== (actualCounts.get(token) ?? 0))
    .sort(
      (left, right) =>
        tokenWeight(right) - tokenWeight(left) || left.localeCompare(right, 'de-DE'),
    );
}

export function compareOcrLines(
  referenceLines: readonly ReferenceLine[],
  actualLines: readonly ReferenceLine[],
): OcrComparison {
  const referenceTokens = tokenizeOcrText(referenceLines.map((line) => line.text).join('\n'));
  const actualTokens = tokenizeOcrText(actualLines.map((line) => line.text).join('\n'));
  const changed = changedTokens(referenceTokens, actualTokens);
  const referenceCounts = counts(referenceTokens);
  const actualCounts = counts(actualTokens);

  return {
    referenceLineCount: referenceLines.length,
    actualLineCount: actualLines.length,
    tokenSimilarity: weightedSimilarity(referenceTokens, actualTokens),
    missingTokens: changed.filter(
      (token) => (referenceCounts.get(token) ?? 0) > (actualCounts.get(token) ?? 0),
    ),
    addedTokens: changed.filter(
      (token) => (actualCounts.get(token) ?? 0) > (referenceCounts.get(token) ?? 0),
    ),
  };
}

export function referenceLinesFromJson(value: unknown): ReferenceLine[] {
  if (!value || typeof value !== 'object') {
    throw new Error('Die Referenz muss ein JSON-Objekt sein.');
  }

  const candidate = value as Record<string, unknown>;
  const lines = candidate.native_lines ?? candidate.lines;
  if (!Array.isArray(lines)) {
    throw new Error('Die Referenz benötigt ein Array unter "native_lines" oder "lines".');
  }

  return lines.map((line, index) => {
    if (
      !line ||
      typeof line !== 'object' ||
      typeof (line as Record<string, unknown>).text !== 'string'
    ) {
      throw new Error(`Ungültige Referenzzeile an Position ${index}.`);
    }
    return { text: (line as Record<string, string>).text };
  });
}
