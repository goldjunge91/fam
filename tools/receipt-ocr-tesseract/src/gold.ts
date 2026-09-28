import { basename } from 'node:path';
import { normalizeOcrText, tokenizeOcrText, type OcrLine } from './tsv.ts';

type GoldItem = {
  name: string;
  line_total_cents?: number;
};

type GoldSource = {
  file: string;
  total_cents?: number;
  items?: readonly GoldItem[];
};

export type GoldComparison = {
  sourceFile: string | null;
  expectedTotalCents: number | null;
  detectedTotalsCents: readonly number[];
  totalMatch: boolean | null;
  expectedItemCount: number;
  matchedItemCount: number;
  itemRecall: number | null;
  missingItems: readonly string[];
  matchedItems: readonly string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function sourceForInput(value: unknown, inputName: string): GoldSource | null {
  if (!isRecord(value)) return null;
  const candidateSources = value.sources;
  const sources = Array.isArray(candidateSources) ? candidateSources : [value];
  const inputBase = basename(inputName).replace(/\.[^.]+$/u, '').toLocaleLowerCase('de-DE');
  const source = sources.find((entry) => {
    if (!isRecord(entry) || typeof entry.file !== 'string') return false;
    return entry.file.replace(/\.[^.]+$/u, '').toLocaleLowerCase('de-DE') === inputBase;
  });
  if (!isRecord(source) || typeof source.file !== 'string') return null;

  const items = Array.isArray(source.items)
    ? source.items.filter(
        (item): item is Record<string, unknown> =>
          isRecord(item) && typeof item.name === 'string',
      )
    : [];
  return {
    file: source.file,
    total_cents: typeof source.total_cents === 'number' ? source.total_cents : undefined,
    items: items.map((item) => ({
      name: item.name as string,
      line_total_cents:
        typeof item.line_total_cents === 'number' ? item.line_total_cents : undefined,
    })),
  };
}

function centsFromText(value: string): number | null {
  const normalized = value.replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

function totalsFromLines(lines: readonly OcrLine[]): number[] {
  const totals: number[] = [];
  for (const line of lines) {
    const normalized = normalizeOcrText(line.text);
    if (!/(?:summe|gesamt|total|zu zahlen)/iu.test(normalized)) continue;
    const match = normalized.match(/(\d{1,4}\.\d{2})(?:\s*€)?(?:\s|$)/u);
    const cents = match?.[1] ? centsFromText(match[1]) : null;
    if (cents !== null) totals.push(cents);
  }
  return totals;
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1];
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      current.push(
        Math.min(
          (previous[rightIndex + 1] ?? Number.POSITIVE_INFINITY) + 1,
          (current[rightIndex] ?? Number.POSITIVE_INFINITY) + 1,
          (previous[rightIndex] ?? Number.POSITIVE_INFINITY) +
            (left[leftIndex] === right[rightIndex] ? 0 : 1),
        ),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous.at(-1) ?? Number.POSITIVE_INFINITY;
}

function itemMatchScore(expectedName: string, lines: readonly OcrLine[]): number {
  const expectedTokens = tokenizeOcrText(expectedName).filter((token) => !/^\d/.test(token));
  if (expectedTokens.length === 0) return 0;

  return Math.max(
    ...lines.map((line) => {
      const actualTokens = tokenizeOcrText(line.text);
      const matched = expectedTokens.filter((expectedToken) =>
        actualTokens.some(
          (actualToken) =>
            actualToken.includes(expectedToken) ||
            expectedToken.includes(actualToken) ||
            (expectedToken.length >= 6 && editDistance(expectedToken, actualToken) <= 1),
        ),
      ).length;
      return matched / expectedTokens.length;
    }),
    0,
  );
}

export function compareOcrToGold(
  gold: unknown,
  inputName: string,
  lines: readonly OcrLine[],
): GoldComparison | null {
  const source = sourceForInput(gold, inputName);
  if (!source) return null;

  const detectedTotalsCents = totalsFromLines(lines);
  const items = source.items ?? [];
  const matchedItems = items
    .filter((item) => itemMatchScore(item.name, lines) >= 0.5)
    .map((item) => item.name);
  const missingItems = items
    .filter((item) => !matchedItems.includes(item.name))
    .map((item) => item.name);

  return {
    sourceFile: source.file,
    expectedTotalCents: source.total_cents ?? null,
    detectedTotalsCents,
    totalMatch:
      source.total_cents === undefined
        ? null
        : detectedTotalsCents.includes(source.total_cents),
    expectedItemCount: items.length,
    matchedItemCount: matchedItems.length,
    itemRecall: items.length === 0 ? null : matchedItems.length / items.length,
    missingItems,
    matchedItems,
  };
}
