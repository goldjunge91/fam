import { Asset } from 'expo-asset';
import { describe, expect, it } from 'react-native-harness';

import { createExpoFileSystemAdapter } from '@/features/ocr/capture/api';
import {
  RECEIPT_IMAGE_NORMALIZATION_QUALITY,
  RECEIPT_MAX_ASSET_BYTES,
  RECEIPT_MAX_IMAGE_LONG_EDGE,
} from '@/features/ocr/capture/capture/constants';
import {
  getReceiptOcrAvailability,
  isReceiptOcrAvailable,
  prepareReceiptOcr,
  ReceiptOcrError,
  recognizeReceiptOcr,
} from '@/features/ocr/processing/native';

type ReceiptGoldSource = {
  file: string;
  merchant: string;
  total_cents: number;
};

type ReceiptGold = {
  sources: readonly ReceiptGoldSource[];
};

const receiptGold = require('../testbilder/receipt-gold.json') as ReceiptGold;

const REAL_RECEIPT_ASSETS = [
  { file: 'IMG_4218.png', module: require('../testbilder/IMG_4218.png') },
  { file: 'IMG_4218.jpeg', module: require('../testbilder/IMG_4218.jpeg') },
  { file: 'IMG_4219.png', module: require('../testbilder/IMG_4219.png') },
  { file: 'IMG_4219.jpeg', module: require('../testbilder/IMG_4219.jpeg') },
  { file: 'IMG_4220.png', module: require('../testbilder/IMG_4220.png') },
  { file: 'IMG_4220.jpeg', module: require('../testbilder/IMG_4220.jpeg') },
] as const;

async function transferOriginalReceiptToAndroid(moduleId: number): Promise<string> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();

  if (asset.localUri === null) {
    throw new Error('The local PNG receipt was not transferred to the Android sandbox.');
  }

  return asset.localUri;
}

function expectedSource(file: string): ReceiptGoldSource {
  const goldFile = file.replace(/\.jpe?g$/iu, '.png');
  const source = receiptGold.sources.find((candidate) => candidate.file === goldFile);
  if (!source) throw new Error(`Receipt gold values are missing for ${file}.`);
  return source;
}

function euroAmount(totalCents: number): string {
  const euros = Math.floor(totalCents / 100);
  const cents = String(totalCents % 100).padStart(2, '0');
  return `${euros},${cents}`;
}

async function prepareAndroidVisionWithRetry(): Promise<void> {
  expect(isReceiptOcrAvailable()).toBe(true);

  const availability = await getReceiptOcrAvailability();
  if (availability.status === 'available') return;
  if (availability.status === 'unavailable') {
    throw new Error(`Android receipt OCR is unavailable: ${availability.reason}.`);
  }

  try {
    const prepared = await prepareReceiptOcr({ languages: ['de-DE'] });
    expect(prepared.status).toBe('available');
  } catch (error: unknown) {
    if (!(error instanceof ReceiptOcrError) || !error.retryable) throw error;

    const retried = await prepareReceiptOcr({ languages: ['de-DE'] });
    expect(retried.status).toBe('available');
  }
}

describe('receipt OCR native integration on Android', () => {
  it('prepares the real ML Kit model and exposes an available readiness state', async () => {
    await prepareAndroidVisionWithRetry();
    await expect(getReceiptOcrAvailability()).resolves.toEqual({ status: 'available' });
  });

  it('normalizes every local PNG and JPEG and recognizes the gold merchant and total', async () => {
    await prepareAndroidVisionWithRetry();
    const fileSystem = createExpoFileSystemAdapter();

    for (const receipt of REAL_RECEIPT_ASSETS) {
      const sourceUri = await transferOriginalReceiptToAndroid(receipt.module);
      expect(sourceUri).toMatch(/^file:\/\//);

      const normalized = await fileSystem.normalizeToPersistentStorage({
        sourceUri,
        captureId: `android-harness-${receipt.file}`,
        pageIndex: 0,
        localAssetId: receipt.file.replace(/\.(?:jpe?g|png)$/iu, ''),
        mimeType: receipt.file.endsWith('.png') ? 'image/png' : 'image/jpeg',
        maxBytes: RECEIPT_MAX_ASSET_BYTES,
        maxLongEdge: RECEIPT_MAX_IMAGE_LONG_EDGE,
        jpegQuality: RECEIPT_IMAGE_NORMALIZATION_QUALITY,
      });

      try {
        expect(normalized.localUri).toMatch(/^file:\/\//);
        expect(normalized.mimeType).toBe('image/jpeg');
        expect(normalized.byteSize).toBeGreaterThan(0);
        expect(normalized.byteSize).toBeLessThanOrEqual(RECEIPT_MAX_ASSET_BYTES);
        expect(Math.max(normalized.width, normalized.height)).toBe(RECEIPT_MAX_IMAGE_LONG_EDGE);

        const result = await recognizeReceiptOcr(normalized.localUri, {
          languages: ['de-DE'],
        });
        expect(result.imageSize).toEqual({
          width: normalized.width,
          height: normalized.height,
        });

        const gold = expectedSource(receipt.file);
        const searchableText = result.lines
          .map(({ text }) => text)
          .join('\n')
          .toLocaleUpperCase('de-DE');
        const compactText = searchableText.replace(/\s+/gu, '').replaceAll('.', ',');

        expect(searchableText).toContain(gold.merchant);
        expect(compactText).toContain(euroAmount(gold.total_cents));
      } finally {
        await fileSystem.deleteLocalFile(normalized.localUri);
      }
    }
  });
});
