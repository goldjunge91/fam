import { parseGermanReceipt } from './domain/parser';
import type { ReceiptOcrLine } from './native';
import {
  mergeReceiptOcrLines,
  projectSectionLines,
  receiptSections,
} from './receipt-page-sections';

function recognizedLine(y: number, height: number): ReceiptOcrLine {
  return {
    text: 'G&G Skyr pur 1,39 € x 3 4,17',
    confidence: 0.9,
    boundingBox: { x: 0.1, y, width: 0.8, height },
  };
}

describe('three OCR sections per receipt photo', () => {
  it('covers the whole photo with overlap around both section boundaries', () => {
    expect(receiptSections(2400)).toEqual([
      { start: 0, end: 860, coreStart: 0, coreEnd: 800 },
      { start: 740, end: 1660, coreStart: 800, coreEnd: 1600 },
      { start: 1540, end: 2400, coreStart: 1600, coreEnd: 2400 },
    ]);
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
    total.boundingBox.x = 0.82;
    total.boundingBox.width = 0.09;

    const merged = mergeReceiptOcrLines([item], [total]);

    expect(merged.map((line) => line.text)).toEqual([item.text, total.text]);
    expect(merged[1]?.confidence).toBeLessThan(0.8);
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
