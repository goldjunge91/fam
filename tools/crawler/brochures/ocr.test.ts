import { describe, expect, it } from '@jest/globals';
import {
  changedOcrTokens,
  extractReweRegionCode,
  normalizeOcrText,
  ocrTextSimilarity,
  parseTesseractTsv,
  tokenizeOcrText,
} from './ocr';

describe('Prospekt-OCR', () => {
  it('normalisiert deutsche Preise und Layout-Leerzeichen', () => {
    expect(normalizeOcrText('  Fruchtzwerge\n1,99 €  ')).toBe('fruchtzwerge 1.99 €');
  });

  it('gewichtet abweichende Preise stärker als Fließtext', () => {
    const same = tokenizeOcrText('Persil Waschmittel 17,99 €');
    const changedPrice = tokenizeOcrText('Persil Waschmittel 12,99 €');
    const changedDescription = tokenizeOcrText('Persil Waschpulver 17,99 €');

    expect(ocrTextSimilarity(same, changedPrice)).toBeLessThan(
      ocrTextSimilarity(same, changedDescription),
    );
    expect(changedOcrTokens(same, changedPrice)).toEqual(
      expect.arrayContaining(['12.99', '17.99']),
    );
  });

  it('erkennt REWE-Regions- und Modulcodes', () => {
    expect(
      extractReweRegionCode(
        '35. Woche 2026. Gültig ab 24.08.2026\nRN-SW-SW_FF-BED-BLB-NF\nJetzt sparen',
      ),
    ).toBe('RN-SW-SW_FF-BED-BLB-NF');
    expect(extractReweRegionCode('35. Woche\nNF-LS-rEW1\nJetzt sparen')).toBe(
      'NF-LS-rEW1',
    );
  });

  it('verwirft unsichere Tesseract-Tokens, behält sie aber für Regionscodes', () => {
    const tsv = [
      'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
      '5\t1\t1\t1\t1\t1\t0\t0\t10\t10\t92.0\tPersil',
      '5\t1\t1\t1\t1\t2\t0\t0\t10\t10\t21.0\tZeichensalat',
      '5\t1\t2\t1\t1\t1\t0\t0\t10\t10\t40.0\tRN-SW-SW_FF-BED-NF',
    ].join('\n');

    expect(parseTesseractTsv(tsv)).toEqual({
      text: 'Persil',
      regionText: 'Persil Zeichensalat\nRN-SW-SW_FF-BED-NF',
    });
  });
});
