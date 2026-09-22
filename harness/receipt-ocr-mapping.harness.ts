import { Asset } from 'expo-asset';
import { describe, expect, it } from 'react-native-harness';

import { createExpoFileSystemAdapter } from '@/features/ocr/capture/api';
import {
  RECEIPT_IMAGE_NORMALIZATION_QUALITY,
  RECEIPT_MAX_ASSET_BYTES,
  RECEIPT_MAX_IMAGE_LONG_EDGE,
} from '@/features/ocr/capture/capture/constants';
import { reconstructReceiptLines } from '@/features/ocr/processing/domain/layout';
import { parseGermanReceipt } from '@/features/ocr/processing/domain/parser';
import type { ReceiptOcrLine } from '@/features/ocr/processing/domain/types';
import { recognizeReceiptOcr } from '@/features/ocr/processing/native';
import expectedReceipts from '../testbilder/receipt-ocr-expected.json';

const REAL_RECEIPT_ASSETS = [
  {
    file: 'IMG_4218.HEIC',
    assetFile: 'IMG_4218.png',
    moduleId: require('../testbilder/IMG_4218.png') as number,
  },
  {
    file: 'IMG_4219.HEIC',
    assetFile: 'IMG_4219.png',
    moduleId: require('../testbilder/IMG_4219.png') as number,
  },
  {
    file: 'IMG_4220.HEIC',
    assetFile: 'IMG_4220.png',
    moduleId: require('../testbilder/IMG_4220.png') as number,
  },
] as const;

type ExpectedReceipt = (typeof expectedReceipts.sources)[number];
type ExpectedItem = ExpectedReceipt['items'][number];
type PriceMismatch = {
  index: number;
  name: string;
  expectedUnitPriceCents: number | null;
  actualUnitPriceCents: number | null;
  expectedLineTotalCents: number;
  actualLineTotalCents: number | null;
};

function comparableName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .toLocaleLowerCase('de-DE');
}

function hasAtMostOneEdit(left: string, right: string): boolean {
  if (Math.abs(left.length - right.length) > 1) return false;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1];
    let rowMinimum = current[0];

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex] === right[rightIndex] ? 0 : 1;
      const value = Math.min(
        (previous[rightIndex + 1] ?? Number.POSITIVE_INFINITY) + 1,
        (current[rightIndex] ?? Number.POSITIVE_INFINITY) + 1,
        (previous[rightIndex] ?? Number.POSITIVE_INFINITY) + substitutionCost,
      );
      current.push(value);
      rowMinimum = Math.min(rowMinimum, value);
    }

    if (rowMinimum > 1) return false;
    previous.splice(0, previous.length, ...current);
  }

  return (previous.at(-1) ?? Number.POSITIVE_INFINITY) <= 1;
}

function matchesExpectedName(actual: string, expected: string): boolean {
  const actualName = comparableName(actual);
  const expectedName = comparableName(expected);
  return (
    actualName === expectedName ||
    actualName.includes(expectedName) ||
    expectedName.includes(actualName) ||
    (Math.min(actualName.length, expectedName.length) >= 8 &&
      hasAtMostOneEdit(actualName, expectedName))
  );
}

function redactOcrText(text: string): string {
  if (/(?:payback|kartenkonto|kundenkarte|girocard|ec[- ]?cash|visa|mastercard)/iu.test(text)) {
    return '[REDACTED_PAYMENT_OR_LOYALTY_LINE]';
  }

  return text
    .replace(/\b\d{8,14}\b/gu, '[REDACTED_BARCODE]')
    .replace(/\*{2,}\d{2,}/gu, '[REDACTED_REFERENCE]');
}

function redactedLine(line: ReceiptOcrLine): ReceiptOcrLine {
  return { ...line, text: redactOcrText(line.text) };
}

function reportFor(
  file: string,
  assetFile: string,
  nativeLines: readonly ReceiptOcrLine[],
  reconstructedLines: readonly ReceiptOcrLine[],
  draft: ReturnType<typeof parseGermanReceipt>,
  priceMismatches: readonly PriceMismatch[],
  normalized: { width: number; height: number; byteSize: number },
) {
  return {
    version: 1,
    file,
    asset_file: assetFile,
    normalized_image: normalized,
    native_lines: nativeLines.map(redactedLine),
    reconstructed_lines: reconstructedLines.map(redactedLine),
    parsed: {
      market: draft.market.value,
      total_cents: draft.totalCents.value,
      items: draft.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit_price_cents: item.unitPriceCents?.value ?? null,
        line_total_cents: item.lineTotalCents.value,
      })),
      excluded_line_count: draft.excludedLines.length,
      warning_count: draft.warnings.length,
      price_mismatches: priceMismatches,
    },
  };
}

function priceMismatchFor(
  actual: ReturnType<typeof parseGermanReceipt>['items'][number],
  expected: ExpectedItem,
  index: number,
): PriceMismatch | null {
  const expectedUnitPrice =
    'unit_price_cents' in expected ? (expected.unit_price_cents ?? null) : null;
  const actualUnitPrice = actual.unitPriceCents?.value ?? null;
  const actualLineTotal = actual.lineTotalCents.value;
  if (actualUnitPrice === expectedUnitPrice && actualLineTotal === expected.line_total_cents) {
    return null;
  }

  return {
    index,
    name: actual.name,
    expectedUnitPriceCents: expectedUnitPrice,
    actualUnitPriceCents: actualUnitPrice,
    expectedLineTotalCents: expected.line_total_cents,
    actualLineTotalCents: actualLineTotal,
  };
}

async function transferAsset(moduleId: number): Promise<string> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  if (asset.localUri === null) {
    throw new Error('The real receipt asset was not transferred to the native test runtime.');
  }
  return asset.localUri;
}

async function runReceipt(file: string, assetFile: string, moduleId: number) {
  const expected = expectedReceipts.sources.find((source) => source.file === file);
  if (!expected) throw new Error(`Missing real-receipt mapping for ${file}.`);

  const fileSystem = createExpoFileSystemAdapter();
  const sourceUri = await transferAsset(moduleId);
  const normalized = await fileSystem.normalizeToPersistentStorage({
    sourceUri,
    captureId: `native-ocr-mapping-${file}`,
    pageIndex: 0,
    localAssetId: assetFile.replace(/\.(?:heic|heif|jpe?g|png)$/iu, ''),
    mimeType: assetFile.endsWith('.png') ? 'image/png' : 'image/jpeg',
    maxBytes: RECEIPT_MAX_ASSET_BYTES,
    maxLongEdge: RECEIPT_MAX_IMAGE_LONG_EDGE,
    jpegQuality: RECEIPT_IMAGE_NORMALIZATION_QUALITY,
  });

  try {
    const nativeResult = await recognizeReceiptOcr(normalized.localUri, { languages: ['de-DE'] });
    const nativeLines = nativeResult.lines.map((line) => ({ ...line, pageIndex: 0 }));
    const reconstructedLines = reconstructReceiptLines(nativeLines);
    const draft = parseGermanReceipt(nativeLines);
    const priceMismatches: PriceMismatch[] = [];
    for (const [index, expectedItem] of expected.items.entries()) {
      const actualItem = draft.items[index];
      if (actualItem) {
        const mismatch = priceMismatchFor(actualItem, expectedItem, index);
        if (mismatch) priceMismatches.push(mismatch);
      }
    }
    const report = reportFor(
      file,
      assetFile,
      nativeLines,
      reconstructedLines,
      draft,
      priceMismatches,
      {
        width: normalized.width,
        height: normalized.height,
        byteSize: normalized.byteSize,
      },
    );

    console.log(`RECEIPT_OCR_JSON_BEGIN ${file}`);
    console.log(JSON.stringify(report, null, 2));
    console.log(`RECEIPT_OCR_JSON_END ${file}`);

    try {
      expect(draft.market.value).toBe(expected.market);
      expect(draft.totalCents.value).toBe(expected.total_cents);
      expect(draft.items).toHaveLength(expected.items.length);

      for (const [index, expectedItem] of expected.items.entries()) {
        const actualItem = draft.items[index];
        if (!actualItem) throw new Error(`Missing parsed item ${index + 1} for ${file}.`);
        expect(matchesExpectedName(actualItem.name, expectedItem.name)).toBe(true);
        expect(actualItem.quantity).toBe(expectedItem.quantity ?? null);
      }
      if (priceMismatches.length > 0) {
        console.warn(`RECEIPT_OCR_PRICE_MISMATCH ${file} ${JSON.stringify(priceMismatches)}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `${message}\nRECEIPT_OCR_JSON_BEGIN ${file}\n${JSON.stringify(report, null, 2)}\nRECEIPT_OCR_JSON_END ${file}`,
      );
    }
  } finally {
    await fileSystem.deleteLocalFile(normalized.localUri);
  }
}

describe('real native receipt OCR to expected item mapping', () => {
  for (const receipt of REAL_RECEIPT_ASSETS) {
    it(`emits a redacted JSON report and preserves article/quantity mapping for ${receipt.file}`, async () => {
      await runReceipt(receipt.file, receipt.assetFile, receipt.moduleId);
    });
  }
});
