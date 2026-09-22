import { Asset } from 'expo-asset';
import { describe, expect, it } from 'react-native-harness';

import { createExpoFileSystemAdapter } from '@/features/ocr/capture/api';
import {
  RECEIPT_IMAGE_NORMALIZATION_QUALITY,
  RECEIPT_MAX_ASSET_BYTES,
  RECEIPT_MAX_IMAGE_LONG_EDGE,
} from '@/features/ocr/capture/capture/constants';
import {
  isReceiptOcrAvailable,
  recognizeReceiptOcr,
} from '@/features/ocr/processing/native';
import receiptGold from '../testbilder/receipt-gold.json';

const REAL_RECEIPT_ASSETS = [
  { file: 'IMG_4218.HEIC', moduleId: require('../testbilder/IMG_4218.HEIC') as number },
  { file: 'IMG_4219.HEIC', moduleId: require('../testbilder/IMG_4219.HEIC') as number },
  { file: 'IMG_4220.HEIC', moduleId: require('../testbilder/IMG_4220.HEIC') as number },
] as const;

type LocalReceiptAsset = {
  localUri: string;
  type: string;
};

async function transferAssetToSimulator(moduleId: number): Promise<LocalReceiptAsset> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();

  if (asset.localUri === null) {
    throw new Error('The real receipt asset was not transferred to the simulator sandbox.');
  }

  return { localUri: asset.localUri, type: asset.type };
}

function compactSearchText(value: string): string {
  return value.normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '').toLocaleUpperCase('de-DE');
}

function expectedTotalDigits(totalCents: number): string {
  return String(totalCents).padStart(3, '0');
}

describe('receipt OCR native integration on iOS Simulator', () => {
  for (const receipt of REAL_RECEIPT_ASSETS) {
    it(`normalizes and recognizes the original HEIC receipt ${receipt.file}`, async () => {
      expect(isReceiptOcrAvailable()).toBe(true);

      const gold = receiptGold.sources.find(({ file }) => file === receipt.file);
      if (!gold) throw new Error(`Gold values for ${receipt.file} are missing.`);

      const sourceAsset = await transferAssetToSimulator(receipt.moduleId);
      expect(sourceAsset.type.toLocaleLowerCase()).toBe('heic');
      expect(sourceAsset.localUri).toMatch(/^file:\/\//);

      const fileSystem = createExpoFileSystemAdapter();
      let normalizedUri: string | null = null;

      try {
        const normalized = await fileSystem.normalizeToPersistentStorage({
          sourceUri: sourceAsset.localUri,
          captureId: `ios-receipt-ocr-harness-${receipt.file}`,
          pageIndex: 0,
          localAssetId: receipt.file.replace(/\.HEIC$/u, ''),
          mimeType: 'image/heic',
          maxBytes: RECEIPT_MAX_ASSET_BYTES,
          maxLongEdge: RECEIPT_MAX_IMAGE_LONG_EDGE,
          jpegQuality: RECEIPT_IMAGE_NORMALIZATION_QUALITY,
        });
        normalizedUri = normalized.localUri;

        expect(normalized.mimeType).toBe('image/jpeg');
        expect(normalized.localUri).toMatch(/^file:\/\/.*\.jpg$/i);
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
        expect(result.lines.length).toBeGreaterThan(0);
        expect(result.lines.some((line) => line.text.trim().length > 0)).toBe(true);

        const merchant = compactSearchText(gold.merchant);
        expect(result.lines.some((line) => compactSearchText(line.text).includes(merchant))).toBe(
          true,
        );

        const totalDigits = expectedTotalDigits(gold.total_cents);
        expect(
          result.lines.some((line) => line.text.replace(/\D/gu, '').includes(totalDigits)),
        ).toBe(true);
      } finally {
        if (normalizedUri) await fileSystem.deleteLocalFile(normalizedUri);
      }
    });
  }
});
