import receiptGold from '../../../../../testbilder/receipt-gold.json';
import { reconstructReceiptLines } from './layout';
import type { ReceiptOcrPage } from './types';

type GoldArticleAnchor = {
  label: string;
  quantity?: number;
  unit_price_cents?: number;
  line_total_cents: number;
  tax_code: string;
};

function formatEuroCents(cents: number): string {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`;
}

describe('reconstructReceiptLines', () => {
  it('reconstructs left and right columns with one separator and preserves page order', () => {
    const source = receiptGold.sources[0];
    const anchor = source.article_anchors[1] as GoldArticleAnchor;
    const pages: readonly ReceiptOcrPage[] = [
      {
        pageIndex: 0,
        width: 1000,
        height: 2000,
        lines: [
          {
            text: source.merchant,
            confidence: 0.99,
            boundingBox: { x: 100, y: 100, width: 200, height: 30 },
          },
          {
            text: anchor.label,
            confidence: 0.96,
            boundingBox: { x: 100, y: 400, width: 260, height: 28 },
          },
          {
            text: `${formatEuroCents(anchor.unit_price_cents ?? anchor.line_total_cents)} € x ${anchor.quantity ?? 1}`,
            confidence: 0.96,
            boundingBox: { x: 620, y: 402, width: 180, height: 26 },
          },
        ],
      },
      {
        pageIndex: 1,
        width: 1000,
        height: 2000,
        lines: [
          {
            text: 'Zu zahlen',
            confidence: 0.98,
            boundingBox: { x: 100, y: 80, width: 180, height: 28 },
          },
          {
            text: formatEuroCents(source.total_cents),
            confidence: 0.98,
            boundingBox: { x: 700, y: 82, width: 100, height: 26 },
          },
        ],
      },
    ];

    expect(
      reconstructReceiptLines(pages).map(({ text, pageIndex }) => ({ text, pageIndex })),
    ).toEqual([
      { text: source.merchant, pageIndex: 0 },
      {
        text: `${anchor.label} ${formatEuroCents(anchor.unit_price_cents ?? anchor.line_total_cents)} € x ${anchor.quantity ?? 1}`,
        pageIndex: 0,
      },
      { text: `Zu zahlen ${formatEuroCents(source.total_cents)}`, pageIndex: 1 },
    ]);
  });

  it('uses vertical overlap instead of provider order for fragments in one row', () => {
    const source = receiptGold.sources[0];
    const anchor = source.article_anchors[0] as GoldArticleAnchor;
    const lines = reconstructReceiptLines([
      {
        text: formatEuroCents(anchor.line_total_cents),
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 800, y: 510, width: 80, height: 24 },
      },
      {
        text: anchor.label,
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 100, y: 512, width: 300, height: 24 },
      },
      {
        text: 'Andere Zeile',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 100, y: 620, width: 200, height: 24 },
      },
    ]);

    expect(lines.map(({ text }) => text)).toEqual([
      `${anchor.label} ${formatEuroCents(anchor.line_total_cents)}`,
      'Andere Zeile',
    ]);
  });

  it('keeps null confidence when any fragment has no native confidence', () => {
    const lines = reconstructReceiptLines([
      {
        text: 'EDEKA',
        confidence: null,
        pageIndex: 0,
        boundingBox: { x: 10, y: 10, width: 100, height: 20 },
      },
      {
        text: '39,14',
        confidence: 0.99,
        pageIndex: 0,
        boundingBox: { x: 500, y: 10, width: 80, height: 20 },
      },
    ]);

    expect(lines[0]).toMatchObject({ text: 'EDEKA 39,14', confidence: null });
  });

  it('does not merge separate OCR lines when a provider returns zero-size geometry', () => {
    const lines = reconstructReceiptLines([
      {
        text: 'EINKAUFSTASCHE',
        confidence: 0.9,
        boundingBox: { x: 1, y: 1, width: 0, height: 0 },
      },
      {
        text: 'MORE CHUNKY FLAVOI',
        confidence: 0.9,
        boundingBox: { x: 1, y: 1, width: 0, height: 0 },
      },
    ]);

    expect(lines.map(({ text }) => text)).toEqual(['EINKAUFSTASCHE', 'MORE CHUNKY FLAVOI']);
  });

  it('does not let a tall OCR fragment swallow the next receipt row', () => {
    const lines = reconstructReceiptLines([
      {
        text: 'Artikel eins',
        confidence: 0.9,
        boundingBox: { x: 100, y: 100, width: 300, height: 50 },
      },
      {
        text: '1,99',
        confidence: 0.9,
        boundingBox: { x: 700, y: 108, width: 80, height: 30 },
      },
      {
        text: 'Artikel zwei',
        confidence: 0.9,
        boundingBox: { x: 100, y: 141, width: 300, height: 30 },
      },
      {
        text: '2,99',
        confidence: 0.9,
        boundingBox: { x: 700, y: 149, width: 80, height: 30 },
      },
    ]);

    expect(lines.map(({ text }) => text)).toEqual(['Artikel eins 1,99', 'Artikel zwei 2,99']);
  });

  it('reconstructs complete Rossmann article rows from vertically drifted fragments', () => {
    const lines = reconstructReceiptLines([
      {
        text: '4068134200129',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 100, y: 100, width: 180, height: 12 },
      },
      {
        text: 'EINKAUFSTASCHE',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 300, y: 108, width: 260, height: 12 },
      },
      {
        text: '€1,99 A',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 700, y: 109, width: 90, height: 8 },
      },
      {
        text: '2X 4255719311534',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 100, y: 130, width: 180, height: 12 },
      },
      {
        text: 'MORE CHUNKY FLAVOU',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 300, y: 138, width: 300, height: 12 },
      },
      {
        text: '€19,98 B',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 700, y: 139, width: 90, height: 8 },
      },
    ]);

    expect(lines.map(({ text }) => text)).toEqual([
      '4068134200129 EINKAUFSTASCHE €1,99 A',
      '2X 4255719311534 MORE CHUNKY FLAVOU €19,98 B',
    ]);
  });

  it('reconstructs EDEKA rows when the right price column is vertically lower', () => {
    const lines = reconstructReceiptLines([
      {
        text: 'G&G Kaisergemüse',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 100, y: 300, width: 320, height: 12 },
      },
      {
        text: '2,39 A',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 720, y: 314, width: 90, height: 6 },
      },
      {
        text: 'Laugenecke',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 100, y: 340, width: 220, height: 12 },
      },
      {
        text: '0,99 € x 2',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 500, y: 348, width: 130, height: 6 },
      },
      {
        text: '1,98 A',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 720, y: 356, width: 90, height: 6 },
      },
      {
        text: 'Tawa Red',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 100, y: 380, width: 220, height: 12 },
      },
      {
        text: '7,80 € x 2',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 500, y: 388, width: 130, height: 6 },
      },
      {
        text: '15,60*B',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 720, y: 396, width: 100, height: 6 },
      },
    ]);

    expect(lines.map(({ text }) => text)).toEqual([
      'G&G Kaisergemüse 2,39 A',
      'Laugenecke 0,99 € x 2 1,98 A',
      'Tawa Red 7,80 € x 2 15,60*B',
    ]);
  });

  it('keeps native EDEKA price fragments on their own article row', () => {
    const lines = reconstructReceiptLines([
      {
        text: 'EUR',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.612403, y: 0.382267, width: 0.040698, height: 0.018895 },
      },
      {
        text: 'G&G Kaisergemüse',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.189922, y: 0.396802, width: 0.215116, height: 0.023256 },
      },
      {
        text: '2,39',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.600775, y: 0.405523, width: 0.052326, height: 0.021802 },
      },
      {
        text: 'Laugenecke',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.187926, y: 0.418394, width: 0.137715, height: 0.022225 },
      },
      {
        text: '0,99 € x 2',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.385524, y: 0.425319, width: 0.155309, height: 0.022908 },
      },
      {
        text: '1,98',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.602713, y: 0.427326, width: 0.052326, height: 0.023256 },
      },
      {
        text: 'A',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.664729, y: 0.430233, width: 0.013566, height: 0.017442 },
      },
      {
        text: 'G&G Speisequark',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.187984, y: 0.44329, width: 0.203488, height: 0.023377 },
      },
      {
        text: '1,25',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.602713, y: 0.450581, width: 0.054264, height: 0.021802 },
      },
    ]);

    expect(lines.map(({ text }) => text)).toEqual([
      'EUR',
      'G&G Kaisergemüse 2,39',
      'Laugenecke 0,99 € x 2 1,98 A',
      'G&G Speisequark 1,25',
    ]);
  });

  it('keeps a standalone customer-number label out of the first article row', () => {
    const lines = reconstructReceiptLines([
      {
        text: 'KdNr:',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.195736, y: 0.194767, width: 0.044574, height: 0.017442 },
      },
      {
        text: 'EINKAUFSTASCHE',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.241443, y: 0.19946, width: 0.269396, height: 0.044919 },
      },
      {
        text: '€1,99 A',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.653101, y: 0.212121, width: 0.060078, height: 0.016076 },
      },
      {
        text: '2X MORE CHUNKY FLAVOI',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.216396, y: 0.211896, width: 0.336736, height: 0.050939 },
      },
      {
        text: '€19,98 B',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.645349, y: 0.223837, width: 0.054296, height: 0.016076 },
      },
    ]);

    expect(lines.map(({ text }) => text)).toEqual([
      'KdNr:',
      'EINKAUFSTASCHE €1,99 A',
      '2X MORE CHUNKY FLAVOI €19,98 B',
    ]);
  });

  it('assigns adjacent short price fragments to the following article row', () => {
    const lines = reconstructReceiptLines([
      {
        text: '1,89',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.598837, y: 0.684593, width: 0.046512, height: 0.018895 },
      },
      {
        text: 'G&G Salami',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.220873, y: 0.693133, width: 0.122207, height: 0.022165 },
      },
      {
        text: '4,99',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.598837, y: 0.702035, width: 0.04845, height: 0.021802 },
      },
      {
        text: 'B',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.656977, y: 0.703488, width: 0.011628, height: 0.013081 },
      },
      {
        text: 'Pri',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.96124, y: 0.712209, width: 0.036822, height: 0.018895 },
      },
      {
        text: 'G&G Toil.papier',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.22087, y: 0.714831, width: 0.182291, height: 0.022374 },
      },
    ]);

    expect(lines.map(({ text }) => text)).toEqual([
      'G&G Salami 1,89',
      'G&G Toil.papier 4,99 B Pri',
    ]);
  });

  it('keeps Rossmann customer metadata separate while preserving the native price sequence', () => {
    const lines = reconstructReceiptLines([
      {
        text: '*********7196',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.238697, y: 0.180103, width: 0.133301, height: 0.025242 },
      },
      {
        text: 'KdNr:',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.195736, y: 0.194767, width: 0.044574, height: 0.017442 },
      },
      {
        text: '4068134200129 EINKAUFSTASCHE',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.241443, y: 0.19946, width: 0.269396, height: 0.044919 },
      },
      {
        text: '2X 4255719311534 MORE CHUNKY FLAVOI',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.216396, y: 0.211896, width: 0.336736, height: 0.050939 },
      },
      {
        text: '81,99 A',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.653101, y: 0.212121, width: 0.060078, height: 0.016076 },
      },
      {
        text: '€9,99',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.565891, y: 0.21657, width: 0.046512, height: 0.017442 },
      },
      {
        text: '€19',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.645349, y: 0.223837, width: 0.02907, height: 0.014535 },
      },
      {
        text: '3,98',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.670543, y: 0.228198, width: 0.02907, height: 0.013081 },
      },
      {
        text: '4068134176240 ISANA MILDE SEIFE',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.245965, y: 0.23019, width: 0.295339, height: 0.045174 },
      },
      {
        text: 'E0,65',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.654858, y: 0.237321, width: 0.054296, height: 0.020058 },
      },
    ]);

    expect(lines.map(({ text }) => text)).toEqual([
      '*********7196',
      'KdNr:',
      '4068134200129 EINKAUFSTASCHE 81,99 A',
      '2X 4255719311534 MORE CHUNKY FLAVOI €9,99 €19 3,98',
      '4068134176240 ISANA MILDE SEIFE E0,65',
    ]);
  });

  it('does not let a preceding right-column fragment steal the next article price', () => {
    const lines = reconstructReceiptLines([
      {
        text: 'G&G SK-Sch.Holl.',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.217823, y: 0.665961, width: 0.197796, height: 0.034368 },
      },
      {
        text: '1,59 A',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.598837, y: 0.662771, width: 0.069767, height: 0.021802 },
      },
      {
        text: '2F',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.965116, y: 0.668605, width: 0.02907, height: 0.019 },
      },
      {
        text: 'A',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.656977, y: 0.68314, width: 0.011628, height: 0.013081 },
      },
      {
        text: '1,89',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.598837, y: 0.684593, width: 0.046512, height: 0.018895 },
      },
      {
        text: 'Ser',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.963178, y: 0.690407, width: 0.034884, height: 0.020349 },
      },
      {
        text: 'G&G Salami',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.220873, y: 0.693133, width: 0.122207, height: 0.022165 },
      },
      {
        text: '4,99',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.598837, y: 0.702035, width: 0.04845, height: 0.021802 },
      },
      {
        text: 'B',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.656977, y: 0.703488, width: 0.011628, height: 0.013081 },
      },
      {
        text: 'Pri',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.96124, y: 0.712209, width: 0.036822, height: 0.018895 },
      },
      {
        text: 'G&G Toil.papier',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 0.22087, y: 0.714831, width: 0.182291, height: 0.022374 },
      },
    ]);

    expect(lines.map(({ text }) => text)).toEqual([
      'G&G SK-Sch.Holl. 1,59 A 2F',
      'G&G Salami 1,89 A Ser',
      'G&G Toil.papier 4,99 B Pri',
    ]);
  });

  it('assigns a close price fragment to the nearest article row', () => {
    const lines = reconstructReceiptLines([
      {
        text: 'EINKAUFSTASCHE',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 100, y: 90, width: 300, height: 20 },
      },
      {
        text: '€1,99 A',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 700, y: 90, width: 90, height: 20 },
      },
      {
        text: 'MORE CHUNKY FLAVOU',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 100, y: 115, width: 300, height: 20 },
      },
      {
        text: '€9,99 B',
        confidence: 0.9,
        pageIndex: 0,
        boundingBox: { x: 700, y: 110, width: 90, height: 20 },
      },
    ]);

    expect(lines.map(({ text }) => text)).toEqual([
      'EINKAUFSTASCHE €1,99 A',
      'MORE CHUNKY FLAVOU €9,99 B',
    ]);
  });

  it('orders pages by pageIndex while keeping each page deterministic', () => {
    const source = receiptGold.sources[0];
    const lines = reconstructReceiptLines([
      {
        pageIndex: 1,
        width: 1000,
        height: 2000,
        lines: [
          {
            text: formatEuroCents(source.total_cents),
            confidence: 0.98,
            boundingBox: { x: 700, y: 80, width: 100, height: 26 },
          },
        ],
      },
      {
        pageIndex: 0,
        width: 1000,
        height: 2000,
        lines: [
          {
            text: source.merchant,
            confidence: 0.98,
            boundingBox: { x: 100, y: 80, width: 180, height: 26 },
          },
        ],
      },
    ]);

    expect(lines.map(({ text, pageIndex }) => ({ text, pageIndex }))).toEqual([
      { text: source.merchant, pageIndex: 0 },
      { text: formatEuroCents(source.total_cents), pageIndex: 1 },
    ]);
  });
});
