import { describe, expect, it } from 'bun:test';
import { compareOcrToGold } from './gold.ts';

describe('receipt gold comparison', () => {
  it('matches the input source, total and visible item names', () => {
    const result = compareOcrToGold(
      {
        sources: [
          {
            file: 'IMG_4218.png',
            total_cents: 3914,
            items: [
              { name: 'G&G Kaisergemüse', line_total_cents: 239 },
              { name: 'Laugenecke', line_total_cents: 198 },
            ],
          },
        ],
      },
      'IMG_4218.jpeg',
      ['G&G Kaisergemüse 2,39 A', 'Laugenecke 1,98 A', 'SUMME € 39,14'].map((text) => ({
        text,
        confidence: 90,
        boundingBox: { x: 0, y: 0, width: 1, height: 1 },
        words: [],
      })),
    );

    expect(result).toMatchObject({
      sourceFile: 'IMG_4218.png',
      expectedTotalCents: 3914,
      detectedTotalsCents: [3914],
      totalMatch: true,
      expectedItemCount: 2,
      matchedItemCount: 2,
      itemRecall: 1,
      missingItems: [],
    });
  });
});
