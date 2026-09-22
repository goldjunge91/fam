import type {
  ReceiptConfidence,
  ReceiptOcrBoundingBox,
  ReceiptOcrLine,
  ReceiptOcrPage,
} from './types';

type LayoutInput = readonly ReceiptOcrLine[] | readonly ReceiptOcrPage[];

type PageEntry = {
  inputIndex: number;
  line: ReceiptOcrLine;
  pageIndex: number;
  boundingBox: ReceiptOcrBoundingBox | null;
};

type LineGroup = {
  entries: PageEntry[];
  anchorBoxes: ReceiptOcrBoundingBox[];
  top: number | null;
  bottom: number | null;
  left: number | null;
  right: number | null;
  anchorCenter: number | null;
  anchorHeight: number | null;
  primaryRight: number | null;
};

const LAYOUT_MONEY_PATTERN =
  /(?:€|EUR)?\s*[-−+]?(?:(?:\d{1,3}(?:\.\d{3})+,\d{2})|(?:\d+[,.]\d{2}))/iu;

function isReceiptOcrPage(value: ReceiptOcrLine | ReceiptOcrPage): value is ReceiptOcrPage {
  return 'lines' in value;
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeBoundingBox(
  box: ReceiptOcrBoundingBox,
  page: Pick<ReceiptOcrPage, 'width' | 'height'>,
): ReceiptOcrBoundingBox {
  const pageWidth = finiteOr(page.width, 0);
  const pageHeight = finiteOr(page.height, 0);
  const rawX = Math.max(0, finiteOr(box.x, 0));
  const rawY = Math.max(0, finiteOr(box.y, 0));
  const rawRight = rawX + Math.max(0, finiteOr(box.width, 0));
  const rawBottom = rawY + Math.max(0, finiteOr(box.height, 0));
  const right = pageWidth > 0 ? Math.min(pageWidth, rawRight) : rawRight;
  const bottom = pageHeight > 0 ? Math.min(pageHeight, rawBottom) : rawBottom;
  const x = pageWidth > 0 ? Math.min(pageWidth, rawX) : rawX;
  const y = pageHeight > 0 ? Math.min(pageHeight, rawY) : rawY;

  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  };
}

function normalizedText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isColumnHeaderText(text: string): boolean {
  return /^EUR$/iu.test(normalizedText(text));
}

function isStandaloneReceiptMetadata(text: string): boolean {
  return /^(?:\s*(?:kd\s*nr|kunden(?:nummer|nr))\s*:?\s*|\s*\*+\d{2,}\s*)$/iu.test(
    normalizedText(text),
  );
}

function isPrimaryRowEntry(entry: PageEntry, maxRight: number): boolean {
  const text = normalizedText(entry.line.text);
  if (text.length === 0 || isColumnHeaderText(text) || isStandaloneReceiptMetadata(text)) {
    return false;
  }

  const moneyIndex = text.search(LAYOUT_MONEY_PATTERN);
  const textBeforeMoney = moneyIndex >= 0 ? text.slice(0, moneyIndex) : text;
  if (!/\p{L}{2,}/u.test(textBeforeMoney)) return false;

  const box = entry.boundingBox;
  return box === null || maxRight <= 0 || box.x / maxRight <= 0.5;
}

function confidenceFor(entries: readonly PageEntry[]): ReceiptConfidence {
  if (entries.some(({ line }) => line.confidence === null)) {
    return null;
  }

  const confidences = entries
    .map(({ line }) => line.confidence)
    .filter(
      (confidence): confidence is number => confidence !== null && Number.isFinite(confidence),
    );

  return confidences.length === entries.length ? Math.min(...confidences) : null;
}

function groupGeometry(group: LineGroup): {
  top: number;
  bottom: number;
  left: number;
  right: number;
  center: number;
  height: number;
} | null {
  if (group.top === null || group.bottom === null || group.left === null || group.right === null) {
    return null;
  }

  return {
    top: group.top,
    bottom: group.bottom,
    left: group.left,
    right: group.right,
    center: (group.top + group.bottom) / 2,
    height: Math.max(0, group.bottom - group.top),
  };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const lower = sorted[middle - 1];
  const upper = sorted[middle];
  return sorted.length % 2 === 0 && lower !== undefined && upper !== undefined
    ? (lower + upper) / 2
    : (upper ?? lower ?? 0);
}

function rowDistance(group: LineGroup, entry: PageEntry): number | null {
  const box = entry.boundingBox;
  if (group.anchorCenter === null || group.anchorHeight === null || !box) {
    return null;
  }
  if (group.anchorHeight <= 0 || box.height <= 0) {
    return null;
  }

  const boxCenter = box.y + box.height / 2;
  return Math.abs(group.anchorCenter - boxCenter);
}

function sharesHorizontalColumn(
  left: ReceiptOcrBoundingBox,
  right: ReceiptOcrBoundingBox,
): boolean {
  const leftRight = left.x + left.width;
  const rightRight = right.x + right.width;
  const overlap = Math.min(leftRight, rightRight) - Math.max(left.x, right.x);
  const smallerWidth = Math.min(left.width, right.width);
  return smallerWidth > 0 && overlap >= smallerWidth * 0.5;
}

function hasHorizontalColumnConflict(group: LineGroup, entry: PageEntry): boolean {
  const entryBox = entry.boundingBox;
  if (!entryBox || entryBox.width <= 0) return false;

  return group.entries.some(({ boundingBox }) => {
    return boundingBox !== null && sharesHorizontalColumn(boundingBox, entryBox);
  });
}

function belongsToSameRow(group: LineGroup, entry: PageEntry): boolean {
  const distance = rowDistance(group, entry);
  const box = entry.boundingBox;
  if (distance === null || !box || group.anchorHeight === null) {
    return false;
  }
  if (hasHorizontalColumnConflict(group, entry)) {
    return false;
  }

  // OCR providers can report a shorter price box whose baseline is lower than
  // the product-name box. Use the larger observed row height for the tolerance
  // while keeping it below the distance to the next normal receipt row.
  const centerTolerance = Math.max(group.anchorHeight, box.height) * 1.25;
  return distance <= centerTolerance;
}

function addToGroup(group: LineGroup, entry: PageEntry, isPrimaryEntry = false): void {
  group.entries.push(entry);
  const box = entry.boundingBox;
  if (!box) return;

  if (isPrimaryEntry && box.height > 0) {
    group.anchorBoxes.push(box);
    group.anchorCenter = median(
      group.anchorBoxes.map((entryBox) => entryBox.y + entryBox.height / 2),
    );
    group.anchorHeight = median(group.anchorBoxes.map((entryBox) => entryBox.height));
    const primaryRight = box.x + box.width;
    group.primaryRight =
      group.primaryRight === null ? primaryRight : Math.max(group.primaryRight, primaryRight);
  }

  const right = box.x + box.width;
  const bottom = box.y + box.height;
  group.top = group.top === null ? box.y : Math.min(group.top, box.y);
  group.bottom = group.bottom === null ? bottom : Math.max(group.bottom, bottom);
  group.left = group.left === null ? box.x : Math.min(group.left, box.x);
  group.right = group.right === null ? right : Math.max(group.right, right);
}

function createGroup(entry: PageEntry, isPrimaryEntry = false): LineGroup {
  const group: LineGroup = {
    entries: [],
    anchorBoxes: [],
    top: null,
    bottom: null,
    left: null,
    right: null,
    anchorCenter: null,
    anchorHeight: null,
    primaryRight: null,
  };
  addToGroup(group, entry, isPrimaryEntry);
  return group;
}

function belongsToPrimaryRow(group: LineGroup, entry: PageEntry): boolean {
  const distance = rowDistance(group, entry);
  const box = entry.boundingBox;
  if (distance === null || !box || group.anchorHeight === null) return false;

  const centerTolerance = Math.max(group.anchorHeight, box.height) * 1.25;
  return distance <= centerTolerance;
}

function hasQuantityMarker(group: LineGroup): boolean {
  return group.entries.some(({ line }) => {
    const text = normalizedText(line.text);
    return (
      /^(?:\d+(?:[.,]\d+)?)\s*[x×]\b/iu.test(text) ||
      /(?:€|EUR)?\s*[x×]\s*\d+(?:[.,]\d+)?\b/iu.test(text)
    );
  });
}

function isLeadingCurrencyFragment(entry: PageEntry): boolean {
  return /^\s*(?:€|EUR)\s*\d/iu.test(normalizedText(entry.line.text));
}

function hasTrailingTaxCode(entry: PageEntry): boolean {
  return /(?:^|\s)(?:A|B|AW|BW)\s*$/iu.test(normalizedText(entry.line.text));
}

function isStandaloneTaxCode(text: string): boolean {
  return /^(?:A|B|AW|BW)$/iu.test(normalizedText(text));
}

function horizontalDistance(group: LineGroup, entry: PageEntry): number {
  const box = entry.boundingBox;
  if (group.primaryRight === null || !box) return Number.POSITIVE_INFINITY;
  return Math.abs(box.x - group.primaryRight);
}

function sharesPriceColumn(left: ReceiptOcrBoundingBox, right: ReceiptOcrBoundingBox): boolean {
  const leftCenter = left.x + left.width / 2;
  const rightCenter = right.x + right.width / 2;
  return Math.abs(leftCenter - rightCenter) <= Math.max(left.width, right.width) * 1.5;
}

function verticalOverlapRatio(left: ReceiptOcrBoundingBox, right: ReceiptOcrBoundingBox): number {
  const leftBottom = left.y + left.height;
  const rightBottom = right.y + right.height;
  const overlap = Math.max(0, Math.min(leftBottom, rightBottom) - Math.max(left.y, right.y));
  const smallerHeight = Math.min(left.height, right.height);
  return smallerHeight > 0 ? overlap / smallerHeight : 0;
}

function nextRowAfter(
  candidates: readonly LineGroup[],
  previousGroup: LineGroup,
  entry: PageEntry,
): LineGroup | undefined {
  const previousCenter = previousGroup.anchorCenter;
  if (previousCenter === null || !entry.boundingBox) return undefined;

  return [...candidates]
    .filter(
      (candidate) =>
        candidate !== previousGroup &&
        candidate.anchorCenter !== null &&
        candidate.anchorCenter > previousCenter,
    )
    .sort(
      (left, right) =>
        (rowDistance(left, entry) ?? Number.POSITIVE_INFINITY) -
        (rowDistance(right, entry) ?? Number.POSITIVE_INFINITY),
    )[0];
}

function closestSecondaryRow(
  entry: PageEntry,
  candidates: readonly LineGroup[],
  previousPriceEntry?: PageEntry,
  previousPriceGroup?: LineGroup,
): LineGroup | undefined {
  const ordered = [...candidates].sort(
    (left, right) =>
      (rowDistance(left, entry) ?? Number.POSITIVE_INFINITY) -
      (rowDistance(right, entry) ?? Number.POSITIVE_INFINITY),
  );
  const nearest = ordered[0];
  if (!nearest || candidates.length < 2) {
    return nearest;
  }

  const previousPriceBox = previousPriceEntry?.boundingBox;
  const currentPriceBox = entry.boundingBox;
  if (
    previousPriceBox &&
    currentPriceBox &&
    previousPriceGroup &&
    sharesPriceColumn(previousPriceBox, currentPriceBox) &&
    verticalOverlapRatio(previousPriceBox, currentPriceBox) < 0.5
  ) {
    const nextRow = nextRowAfter(candidates, previousPriceGroup, entry);
    if (nextRow) return nextRow;
  }

  if (!isLeadingCurrencyFragment(entry) || hasTrailingTaxCode(entry)) {
    return nearest;
  }

  const quantityRow = [...candidates]
    .filter((candidate) => hasQuantityMarker(candidate))
    .sort((left, right) => horizontalDistance(left, entry) - horizontalDistance(right, entry))[0];
  if (quantityRow && horizontalDistance(quantityRow, entry) < horizontalDistance(nearest, entry)) {
    return quantityRow;
  }
  return nearest;
}

function reconstructPage(entries: readonly PageEntry[]): ReceiptOcrLine[] {
  const groups: LineGroup[] = [];
  const maxRight = entries.reduce(
    (currentMax, { boundingBox }) =>
      boundingBox === null ? currentMax : Math.max(currentMax, boundingBox.x + boundingBox.width),
    0,
  );
  const primaryEntries = entries.filter((entry) => isPrimaryRowEntry(entry, maxRight));
  const secondaryEntries = entries.filter((entry) => !isPrimaryRowEntry(entry, maxRight));

  for (const entry of primaryEntries) {
    const group =
      entry.boundingBox === null
        ? undefined
        : groups
            .filter((candidate) => belongsToSameRow(candidate, entry))
            .sort(
              (left, right) =>
                (rowDistance(left, entry) ?? Number.POSITIVE_INFINITY) -
                (rowDistance(right, entry) ?? Number.POSITIVE_INFINITY),
            )[0];

    if (group) {
      addToGroup(group, entry, true);
      continue;
    }

    groups.push(createGroup(entry, true));
  }

  let previousSecondaryEntry: PageEntry | undefined;
  let previousSecondaryGroup: LineGroup | undefined;
  let previousPriceEntry: PageEntry | undefined;
  let previousPriceGroup: LineGroup | undefined;

  for (const [secondaryIndex, entry] of secondaryEntries.entries()) {
    if (isColumnHeaderText(entry.line.text) || isStandaloneReceiptMetadata(entry.line.text)) {
      groups.push(createGroup(entry));
      previousSecondaryEntry = undefined;
      previousSecondaryGroup = undefined;
      previousPriceEntry = undefined;
      previousPriceGroup = undefined;
      continue;
    }

    const candidates = groups.filter((candidate) => belongsToPrimaryRow(candidate, entry));
    const nextEntry = secondaryEntries[secondaryIndex + 1];
    const nextEntryHasMoney =
      nextEntry !== undefined && LAYOUT_MONEY_PATTERN.test(normalizedText(nextEntry.line.text));
    const previousSecondaryDistance = previousSecondaryGroup
      ? rowDistance(previousSecondaryGroup, entry)
      : null;
    const continuation =
      isStandaloneTaxCode(entry.line.text) &&
      previousSecondaryEntry &&
      previousSecondaryGroup &&
      LAYOUT_MONEY_PATTERN.test(normalizedText(previousSecondaryEntry.line.text)) &&
      previousSecondaryDistance !== null &&
      previousSecondaryDistance <=
        Math.max(previousSecondaryGroup.anchorHeight ?? 0, entry.boundingBox?.height ?? 0) * 1.5;
    const lookaheadCandidates = nextEntryHasMoney
      ? groups.filter((candidate) => belongsToPrimaryRow(candidate, nextEntry))
      : [];
    const group = continuation
      ? previousSecondaryGroup
      : isStandaloneTaxCode(entry.line.text) && nextEntryHasMoney
        ? closestSecondaryRow(
            nextEntry,
            lookaheadCandidates,
            previousPriceEntry,
            previousPriceGroup,
          )
        : closestSecondaryRow(entry, candidates, previousPriceEntry, previousPriceGroup);

    if (group) {
      addToGroup(group, entry);
      previousSecondaryEntry = entry;
      previousSecondaryGroup = group;
      if (LAYOUT_MONEY_PATTERN.test(normalizedText(entry.line.text))) {
        previousPriceEntry = entry;
        previousPriceGroup = group;
      }
    } else {
      groups.push(createGroup(entry));
      previousSecondaryEntry = undefined;
      previousSecondaryGroup = undefined;
      if (LAYOUT_MONEY_PATTERN.test(normalizedText(entry.line.text))) {
        previousPriceEntry = entry;
        previousPriceGroup = groups.at(-1);
      }
    }
  }

  return groups
    .sort((left, right) => {
      const leftGeometry = groupGeometry(left);
      const rightGeometry = groupGeometry(right);
      if (leftGeometry && rightGeometry) {
        return leftGeometry.top - rightGeometry.top || leftGeometry.left - rightGeometry.left;
      }
      if (leftGeometry) return -1;
      if (rightGeometry) return 1;
      return left.entries[0].inputIndex - right.entries[0].inputIndex;
    })
    .map((group) => {
      const entriesInReadingOrder = [...group.entries].sort((left, right) => {
        if (left.boundingBox && right.boundingBox) {
          return left.boundingBox.x - right.boundingBox.x || left.inputIndex - right.inputIndex;
        }
        return left.inputIndex - right.inputIndex;
      });
      const text = entriesInReadingOrder
        .map(({ line }) => normalizedText(line.text))
        .filter((value) => value.length > 0)
        .join(' ');
      const geometry = groupGeometry(group);
      const firstLine = entriesInReadingOrder[0].line;

      return {
        text,
        confidence: confidenceFor(entriesInReadingOrder),
        pageIndex: entriesInReadingOrder[0].pageIndex,
        ...(geometry
          ? {
              boundingBox: {
                x: geometry.left,
                y: geometry.top,
                width: geometry.right - geometry.left,
                height: geometry.bottom - geometry.top,
              },
            }
          : { boundingBox: firstLine.boundingBox }),
      } satisfies ReceiptOcrLine;
    })
    .filter(({ text }) => text.length > 0);
}

function pageEntries(
  input: LayoutInput,
): Array<{ page: ReceiptOcrPage; entries: PageEntry[]; order: number }> {
  if (input.length === 0) return [];

  if (isReceiptOcrPage(input[0])) {
    const pages = input as readonly ReceiptOcrPage[];
    return pages.map((page, order) => ({
      page,
      order,
      entries: page.lines.map((line, inputIndex) => ({
        inputIndex,
        line,
        pageIndex: line.pageIndex ?? page.pageIndex ?? order,
        boundingBox: line.boundingBox ? normalizeBoundingBox(line.boundingBox, page) : null,
      })),
    }));
  }

  const lines = input as readonly ReceiptOcrLine[];
  const byPage = new Map<number, { page: ReceiptOcrPage; entries: PageEntry[]; order: number }>();
  lines.forEach((line, inputIndex) => {
    const pageIndex = line.pageIndex ?? 0;
    const existing = byPage.get(pageIndex);
    const page = existing ?? {
      page: { pageIndex, width: 0, height: 0, lines: [] },
      entries: [],
      order: byPage.size,
    };
    page.entries.push({
      inputIndex,
      line,
      pageIndex,
      boundingBox: line.boundingBox ? normalizeBoundingBox(line.boundingBox, page.page) : null,
    });
    byPage.set(pageIndex, page);
  });

  return [...byPage.values()];
}

/**
 * Rebuilds OCR fragments into deterministic, page-ordered receipt lines.
 * Only observed text is joined; no words or amounts are inferred.
 */
export function reconstructReceiptLines(input: LayoutInput): readonly ReceiptOcrLine[] {
  return pageEntries(input)
    .sort((left, right) => {
      const leftPageIndex = left.page.pageIndex ?? left.entries[0]?.pageIndex ?? left.order;
      const rightPageIndex = right.page.pageIndex ?? right.entries[0]?.pageIndex ?? right.order;
      return leftPageIndex - rightPageIndex || left.order - right.order;
    })
    .flatMap(({ entries }) => reconstructPage(entries));
}
