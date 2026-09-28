import { describe, expect, it } from 'bun:test';
import { compareOcrLines } from './compare.ts';
import { parseTesseractTsv } from './tsv.ts';

const TSV_HEADER =
  'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';

describe('receipt OCR TSV parser', () => {
  it('groups words into positioned lines and averages confidence', () => {
    const tsv = [
      TSV_HEADER,
      '5\t1\t1\t1\t1\t1\t10\t20\t40\t12\t90.0\tMilch',
      '5\t1\t1\t1\t1\t2\t60\t20\t30\t12\t80.0\t1,29',
      '5\t1\t1\t1\t2\t1\t10\t50\t30\t12\t70.0\tSUMME',
    ].join('\n');

    expect(parseTesseractTsv(tsv)).toEqual({
      text: 'Milch 1,29\nSUMME',
      lines: [
        {
          text: 'Milch 1,29',
          confidence: 85,
          boundingBox: { x: 10, y: 20, width: 80, height: 12 },
          words: [
            { text: 'Milch', confidence: 90, boundingBox: { x: 10, y: 20, width: 40, height: 12 } },
            { text: '1,29', confidence: 80, boundingBox: { x: 60, y: 20, width: 30, height: 12 } },
          ],
        },
        {
          text: 'SUMME',
          confidence: 70,
          boundingBox: { x: 10, y: 50, width: 30, height: 12 },
          words: [
            { text: 'SUMME', confidence: 70, boundingBox: { x: 10, y: 50, width: 30, height: 12 } },
          ],
        },
      ],
    });
  });

  it('compares receipt lines with price-sensitive token weighting', () => {
    const comparison = compareOcrLines(
      [{ text: 'Milch 1,29' }, { text: 'SUMME 1,29' }],
      [{ text: 'Milch 1,99' }, { text: 'SUMME 1,99' }],
    );

    expect(comparison.referenceLineCount).toBe(2);
    expect(comparison.actualLineCount).toBe(2);
    expect(comparison.tokenSimilarity).toBeLessThan(1);
    expect(comparison.missingTokens).toEqual(['1.29']);
    expect(comparison.addedTokens).toEqual(['1.99']);
  });
});
