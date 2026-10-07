import { parseGermanReceipt } from './domain/parser';
import type { ReceiptOcrLine } from './native';
import * as receiptNative from './native';
import {
  confirmByAgreement,
  mergeReceiptOcrLines,
  projectSectionLines,
  receiptSections,
  recognizeReceiptPageSections,
  sectionUpscale,
} from './receipt-page-sections';

function recognizedLine(y: number, height: number): ReceiptOcrLine {
  return {
    text: 'G&G Skyr pur 1,39 € x 3 4,17',
    confidence: 0.9,
    boundingBox: { x: 0.1, y, width: 0.8, height },
  };
}

describe('three OCR sections per receipt photo', () => {
  it('forwards the selected provider to receipt OCR', async () => {
    const recognize = jest.spyOn(receiptNative, 'recognizeReceiptOcr').mockResolvedValue({
      imageSize: { width: 100, height: 200 },
      lines: [recognizedLine(0.2, 0.04)],
    });

    await recognizeReceiptPageSections('file:///tmp/receipt.jpg', { provider: 'google-mlkit' });

    expect(recognize).toHaveBeenCalledWith('file:///tmp/receipt.jpg', {
      provider: 'google-mlkit',
      languages: ['de-DE'],
    });
    recognize.mockRestore();
  });

  it('covers the whole photo with overlap around both section boundaries', () => {
    expect(receiptSections(2400)).toEqual([
      { start: 0, end: 860, coreStart: 0, coreEnd: 800 },
      { start: 740, end: 1660, coreStart: 800, coreEnd: 1600 },
      { start: 1540, end: 2400, coreStart: 1600, coreEnd: 2400 },
    ]);
  });

  it('upscales sections from the median printed line height within safe limits', () => {
    const whole = {
      imageSize: { width: 1200, height: 2000 },
      lines: [recognizedLine(0.1, 0.006), recognizedLine(0.2, 0.01)],
    };
    const smallLines = {
      imageSize: { width: 1200, height: 2000 },
      lines: [recognizedLine(0.1, 0.004)],
    };
    const largeLines = {
      imageSize: { width: 1200, height: 2000 },
      lines: [recognizedLine(0.1, 0.02)],
    };

    expect(sectionUpscale(whole, 1200, 800)).toBeCloseTo(1.6);
    expect(sectionUpscale(smallLines, 3000, 800)).toBeCloseTo(4096 / 3000);
    expect(sectionUpscale(smallLines, 1200, 800)).toBe(2);
    expect(sectionUpscale(largeLines, 1200, 800)).toBe(1);
  });

  it('does not upscale when the whole-image pass or measured lines are unavailable', () => {
    expect(sectionUpscale(null, 1200, 800)).toBe(1);
    expect(sectionUpscale({ imageSize: { width: 1200, height: 2000 }, lines: [] }, 1200, 800)).toBe(
      1,
    );
  });

  it('keeps an overlapping article once and restores its full-photo position', () => {
    const [first, second] = receiptSections(2400);
    if (!first || !second) throw new Error('Missing OCR sections');
    const articleY = 800;
    const articleHeight = 20;
    const fromFirst = recognizedLine(
      (articleY - first.start) / (first.end - first.start),
      articleHeight / (first.end - first.start),
    );
    const fromSecond = recognizedLine(
      (articleY - second.start) / (second.end - second.start),
      articleHeight / (second.end - second.start),
    );

    const projected = [
      ...projectSectionLines([fromFirst], first, 2400),
      ...projectSectionLines([fromSecond], second, 2400),
    ];

    expect(projected).toHaveLength(1);
    expect(projected[0]?.boundingBox.y).toBeCloseTo(articleY / 2400);
    expect(projected[0]?.boundingBox.height).toBeCloseTo(articleHeight / 2400);
    expect(projected[0]?.boundingBox.x).toBe(0.1);
  });

  it('confirms an unknown provider confidence when both passes read the same line', () => {
    const whole = recognizedLine(0.32, 0.02);
    whole.text = 'Milch 1,29 €';
    whole.confidence = null;
    const section = { ...whole, text: ' milch\u00a0 1,29   € ' };

    const confirmed = confirmByAgreement([whole], [section]);

    expect(confirmed[0]?.confidence).toBe(0.9);
    expect(parseGermanReceipt(confirmed).items[0]?.needsReview).toBe(false);
  });

  it('leaves unconfirmed and provider-scored lines at their original confidence', () => {
    const unknown = recognizedLine(0.32, 0.02);
    unknown.confidence = null;
    const scored = recognizedLine(0.52, 0.02);
    scored.confidence = 0.63;
    const mismatched = { ...unknown, text: 'Haferdrink' };

    const confirmed = confirmByAgreement([unknown, scored], [mismatched]);

    expect(confirmed.map((line) => line.confidence)).toEqual([null, 0.63]);
    expect(parseGermanReceipt(confirmed).items[0]?.needsReview).toBe(true);
  });

  it('keeps the whole-photo item and replaces only fragmented missing prices for review', () => {
    const name = recognizedLine(0.32, 0.015);
    name.text = 'G&G Haferfloc 0,69 € x';
    name.boundingBox.x = 0.15;
    name.boundingBox.width = 0.34;
    const fragmentLeft = recognizedLine(0.32, 0.015);
    fragmentLeft.text = '1,';
    fragmentLeft.boundingBox.x = 0.61;
    fragmentLeft.boundingBox.width = 0.03;
    const fragmentRight = recognizedLine(0.32, 0.015);
    fragmentRight.text = '38';
    fragmentRight.boundingBox.x = 0.64;
    fragmentRight.boundingBox.width = 0.03;
    const supplement = recognizedLine(0.32, 0.015);
    supplement.text = '1,38';
    supplement.boundingBox.x = 0.61;
    supplement.boundingBox.width = 0.06;

    const merged = mergeReceiptOcrLines([name, fragmentLeft, fragmentRight], [supplement, name]);

    expect(merged.map((line) => line.text)).toEqual(['G&G Haferfloc 0,69 € x', '1,38']);
    expect(merged[1]?.confidence).toBeLessThan(0.8);
  });

  it('adds the Skyr total even when the overlapping item already contains its unit price', () => {
    const item = recognizedLine(0.51, 0.015);
    item.text = 'G&G Skyr pur 1,39 € x 3 4, 1';
    item.boundingBox.x = 0.12;
    item.boundingBox.width = 0.76;
    const total = recognizedLine(0.51, 0.015);
    total.text = '4,17 A';
    total.confidence = null;
    total.boundingBox.x = 0.82;
    total.boundingBox.width = 0.09;

    const merged = mergeReceiptOcrLines([item], [total]);

    expect(merged.map((line) => line.text)).toEqual([item.text, total.text]);
    expect(merged[1]?.confidence).toBe(0.79);
  });

  it('marks a conflicting whole-photo price for review when provider confidence is unavailable', () => {
    const whole = recognizedLine(0.51, 0.02);
    whole.text = 'Milch 1,29';
    whole.confidence = null;
    const supplement = recognizedLine(0.51, 0.02);
    supplement.text = '7,29';
    supplement.confidence = null;
    supplement.boundingBox.x = 0.82;
    supplement.boundingBox.width = 0.09;

    const merged = mergeReceiptOcrLines([whole], [supplement]);
    const draft = parseGermanReceipt(merged);

    expect(merged[0]?.confidence).toBe(0.79);
    expect(draft.items[0]?.needsReview).toBe(true);
  });

  it.each([
    {
      wholeLines: [
        { text: 'Milch', x: 0.15, width: 0.3 },
        { text: '1,29', x: 0.82, width: 0.09 },
      ],
      expectedLines: ['Milch', '1,29'],
    },
    {
      wholeLines: [{ text: 'Milch 1,29*B', x: 0.1, width: 0.8 }],
      expectedLines: ['Milch 1,29*B'],
    },
  ])(
    'keeps a complete whole-photo price when a supplementary price conflicts',
    ({ wholeLines, expectedLines }) => {
      const whole = wholeLines.map(({ text, x, width }) => {
        const line = recognizedLine(0.51, 0.015);
        line.text = text;
        line.boundingBox.x = x;
        line.boundingBox.width = width;
        return line;
      });
      const supplement = recognizedLine(0.51, 0.015);
      supplement.text = '7,29';
      supplement.boundingBox.x = 0.82;
      supplement.boundingBox.width = 0.09;

      const merged = mergeReceiptOcrLines(whole, [supplement]);
      const draft = parseGermanReceipt(merged);

      expect(merged.map((line) => line.text)).toEqual(expectedLines);
      expect(merged.find((line) => line.text.includes('1,29'))?.confidence).toBeLessThan(0.8);
      expect(draft.items[0]).toMatchObject({
        name: 'Milch',
        lineTotalCents: { value: 129 },
        needsReview: true,
      });
    },
  );

  it('adds a supplement when an earlier amount is a product volume', () => {
    const whole = recognizedLine(0.3, 0.02);
    whole.text = 'Mineralwasser 0,75 L';
    whole.boundingBox.x = 0.1;
    whole.boundingBox.width = 0.8;
    const supplement = recognizedLine(0.3, 0.02);
    supplement.text = '0,99';
    supplement.boundingBox.x = 0.8;
    supplement.boundingBox.width = 0.1;

    const merged = mergeReceiptOcrLines([whole], [supplement]);
    const draft = parseGermanReceipt(merged);

    expect(merged.map((line) => line.text)).toEqual(['Mineralwasser 0,75 L', '0,99']);
    expect(draft.items[0]).toMatchObject({
      lineTotalCents: { value: 99 },
      needsReview: true,
    });
  });

  it('replaces the truncated Skyr unit-price fragment from the higher-resolution section', () => {
    const line = (text: string, x: number, y: number, width: number): ReceiptOcrLine => ({
      text,
      confidence: 0.93,
      boundingBox: { x, y, width, height: 0.022 },
    });
    const whole = [
      line('G&G Skyr pur', 0.149, 0.544, 0.175),
      line(',39 € x', 0.376, 0.546, 0.132),
      line('3', 0.523, 0.546, 0.016),
      line('4, 1', 0.606, 0.537, 0.058),
    ];
    const section = [line('1,39 € x', 0.376, 0.546, 0.132)];

    const merged = mergeReceiptOcrLines(whole, section);
    const draft = parseGermanReceipt(merged);

    expect(merged.map(({ text }) => text)).toContain('1,39 € x');
    expect(merged.map(({ text }) => text)).not.toContain(',39 € x');
    expect(draft.items[0]).toMatchObject({
      name: 'G&G Skyr pur',
      quantity: 3,
      unitPriceCents: { value: 139 },
      lineTotalCents: { value: null, needsReview: true },
      needsReview: true,
    });
  });

  it('combines the observed IMG_4231 total with the clean section unit price', () => {
    const line = (text: string, x: number, y: number, width: number): ReceiptOcrLine => ({
      text,
      confidence: 1,
      boundingBox: { x, y, width, height: 0.022 },
    });
    const whole = [
      line('4,17', 0.610926, 0.544119, 0.062677),
      line('G&G Skyr pur', 0.148692, 0.545589, 0.18982),
      line('139 € x', 0.377176, 0.54632, 0.131528),
      line('1', 0.359768, 0.546512, 0.021277),
      line('3', 0.522244, 0.546512, 0.017408),
    ];
    const section = [line('1,39 € x', 0.364826, 0.5409, 0.12064)];

    const merged = mergeReceiptOcrLines(whole, section);
    const item = parseGermanReceipt(merged).items[0];

    expect(merged.map(({ text }) => text)).not.toContain('139 € x');
    expect(merged.map(({ text }) => text)).not.toContain('1');
    expect(item).toMatchObject({
      name: 'G&G Skyr pur',
      quantity: 3,
      unitPriceCents: { value: 139 },
      lineTotalCents: { value: 417 },
    });
  });
});
