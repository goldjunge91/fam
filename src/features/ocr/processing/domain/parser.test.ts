import receiptGold from '../../../../../testbilder/receipt-gold.json';
import { REWE_RECEIPT_LINES, REWE_RECEIPT_TEXT } from './fixtures/german-receipts';
import { parseGermanReceipt } from './parser';

function formatEuroCents(cents: number): string {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`;
}

type GoldArticleAnchor = {
  label: string;
  quantity?: number;
  unit_price_cents?: number;
  line_total_cents: number;
  tax_code: string;
};

function goldArticleLine(anchor: GoldArticleAnchor): string {
  const quantityPrefix =
    anchor.quantity !== undefined && anchor.unit_price_cents === undefined
      ? `${anchor.quantity}X `
      : '';
  const unitPrice =
    anchor.unit_price_cents === undefined
      ? ''
      : ` ${formatEuroCents(anchor.unit_price_cents)} € x ${anchor.quantity ?? 1}`;

  return `${quantityPrefix}${anchor.label}${unitPrice} ${formatEuroCents(anchor.line_total_cents)} ${anchor.tax_code}`;
}

describe('parseGermanReceipt', () => {
  it('extracts market, ISO date and EUR total with source evidence and confidence', () => {
    const draft = parseGermanReceipt(REWE_RECEIPT_LINES);

    expect(draft.market).toMatchObject({
      value: 'REWE',
      sourceLineIndex: 0,
      evidence: 'REWE',
      needsReview: false,
    });
    expect(draft.purchaseDate).toMatchObject({
      value: '2026-09-21',
      sourceLineIndex: 2,
      evidence: '21.09.2026 14:32',
      needsReview: false,
    });
    expect(draft.totalCents).toMatchObject({
      value: 496,
      sourceLineIndex: 11,
      evidence: 'GESAMT 4,96',
      needsReview: false,
    });
    expect(draft.market.confidence).toBeGreaterThan(0.9);
    expect(draft.purchaseDate.confidence).toBeGreaterThan(0.9);
    expect(draft.totalCents.confidence).toBeGreaterThan(0.9);
  });

  it('parses relevant items, German decimals and quantity-based observed prices', () => {
    const draft = parseGermanReceipt(REWE_RECEIPT_LINES);

    expect(draft.items).toHaveLength(3);
    expect(draft.items[0]).toMatchObject({
      name: 'Milch 1,5% 1L',
      quantity: null,
      lineTotalCents: { value: 129 },
      unitPriceCents: null,
      sourceLineIndex: 3,
    });
    expect(draft.items[1]).toMatchObject({
      name: 'Äpfel Gala',
      quantity: 2,
      lineTotalCents: { value: 298 },
      unitPriceCents: { value: 149 },
      sourceLineIndex: 4,
    });
    expect(draft.items[2]).toMatchObject({
      name: 'Joghurt Natur',
      lineTotalCents: { value: 69 },
      sourceLineIndex: 5,
    });
  });

  it('derives an integer quantity when OCR places the line total after the x marker', () => {
    const draft = parseGermanReceipt([
      { text: 'EDEKA', confidence: 0.9 },
      { text: 'Bio E.Landbr. 1,39 € x 2,78 A', confidence: 0.9 },
      { text: 'G&G Haferfloc 0,75 € x 1,50 A', confidence: 0.9 },
      { text: 'G&G Erdnuss.C 1,89 € x 2 3 ,78 A', confidence: 0.9 },
    ]);

    expect(
      draft.items.map(({ name, quantity, unitPriceCents, lineTotalCents }) => ({
        name,
        quantity,
        unitPriceCents: unitPriceCents?.value ?? null,
        lineTotalCents: lineTotalCents.value,
      })),
    ).toEqual([
      { name: 'Bio E.Landbr.', quantity: 2, unitPriceCents: 139, lineTotalCents: 278 },
      { name: 'G&G Haferfloc', quantity: 2, unitPriceCents: 75, lineTotalCents: 150 },
      { name: 'G&G Erdnuss.C', quantity: 2, unitPriceCents: 189, lineTotalCents: 378 },
    ]);
  });

  it('derives a quantity when OCR inserts a separator after the x marker', () => {
    const draft = parseGermanReceipt([
      { text: 'EDEKA', confidence: 0.9 },
      { text: 'G&G Haferfloc 0,75 € x / 1,50 A', confidence: 0.9 },
    ]);

    expect(draft.items[0]).toMatchObject({
      name: 'G&G Haferfloc',
      quantity: 2,
      unitPriceCents: { value: 75 },
      lineTotalCents: { value: 150 },
    });
  });

  it('marks a low-confidence OCR item for review without hiding the observed value', () => {
    const draft = parseGermanReceipt(REWE_RECEIPT_LINES);
    const uncertainItem = draft.items[2];

    expect(uncertainItem.confidence).toBeLessThan(0.8);
    expect(uncertainItem.needsReview).toBe(true);
    expect(uncertainItem.lineTotalCents.value).toBe(69);
  });

  it('classifies and excludes discounts, coupons, deposits, taxes and payments', () => {
    const draft = parseGermanReceipt(REWE_RECEIPT_LINES);

    expect(draft.excludedLines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'deposit', evidence: 'Pfand 0,25' }),
        expect.objectContaining({ reason: 'discount', evidence: 'Rabatt -0,20' }),
        expect.objectContaining({ reason: 'coupon', evidence: 'Coupon Aktionsrabatt -1,00' }),
        expect.objectContaining({ reason: 'tax', evidence: 'MwSt 19% 0,71' }),
        expect.objectContaining({ reason: 'loyalty', evidence: 'Treuekarte Punkte 100' }),
        expect.objectContaining({ reason: 'payment', evidence: 'EC-Karte 4,96' }),
      ]),
    );
    expect(draft.items.map((item) => item.name)).not.toEqual(
      expect.arrayContaining(['Pfand', 'Rabatt', 'Coupon Aktionsrabatt', 'MwSt', 'EC-Karte']),
    );
  });

  it('excludes the Rossmann savings summary from receipt items', () => {
    const draft = parseGermanReceipt([
      { text: 'ROSSMANN', confidence: 0.99 },
      { text: 'GESAMT 4,57', confidence: 0.86 },
      { text: 'Sie haben insgesamt 6,11', confidence: 0.86 },
    ]);

    expect(draft.totalCents.value).toBe(457);
    expect(draft.items).toHaveLength(0);
    expect(draft.excludedLines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: 'discount',
          evidence: 'Sie haben insgesamt 6,11',
        }),
      ]),
    );
  });

  it('accepts newline-separated OCR text and produces the same semantic values', () => {
    const draft = parseGermanReceipt(REWE_RECEIPT_TEXT);

    expect({
      market: draft.market.value,
      purchaseDate: draft.purchaseDate.value,
      totalCents: draft.totalCents.value,
      items: draft.items.map(({ name, lineTotalCents }) => ({
        name,
        lineTotalCents: lineTotalCents.value,
      })),
    }).toEqual({
      market: 'REWE',
      purchaseDate: '2026-09-21',
      totalCents: 496,
      items: [
        { name: 'Milch 1,5% 1L', lineTotalCents: 129 },
        { name: 'Äpfel Gala', lineTotalCents: 298 },
        { name: 'Joghurt Natur', lineTotalCents: 69 },
      ],
    });
  });

  it('parses thousands-separated EUR values and reports missing required fields', () => {
    const draft = parseGermanReceipt([
      { text: 'LIDL', confidence: 0.95 },
      { text: 'Butter 1.234,56', confidence: 0.95 },
    ]);

    expect(draft.totalCents.value).toBeNull();
    expect(draft.items[0].lineTotalCents.value).toBe(123456);
    expect(draft.warnings).toEqual(expect.arrayContaining(['missing_date', 'missing_total']));
  });

  it('splits a real Rossmann OCR line containing several barcode-prefixed articles', () => {
    const draft = parseGermanReceipt([
      { text: 'ROSSMANN', confidence: 0.99 },
      {
        text: 'Zwischensumme: 2X 4255719311534 MORE CHUNKY FLAVOI 4068134200129 EINKAUFSTASCHE 4068134176240 ISANA MILDE SEIFE 4068134148940 PROKUDENT PLAQUE I 4068134194732 ISANA SEIFE PEACH',
        confidence: 0.86,
      },
    ]);

    expect(
      draft.items.map(({ name, quantity, lineTotalCents }) => ({
        name,
        quantity,
        lineTotalCents: lineTotalCents.value,
      })),
    ).toEqual([
      { name: 'MORE CHUNKY FLAVOI', quantity: 2, lineTotalCents: null },
      { name: 'EINKAUFSTASCHE', quantity: null, lineTotalCents: null },
      { name: 'ISANA MILDE SEIFE', quantity: null, lineTotalCents: null },
      { name: 'PROKUDENT PLAQUE I', quantity: null, lineTotalCents: null },
      { name: 'ISANA SEIFE PEACH', quantity: null, lineTotalCents: null },
    ]);
  });

  it('parses complete Rossmann article rows with barcode, name and price', () => {
    const draft = parseGermanReceipt([
      { text: 'ROSSMANN', confidence: 0.99 },
      { text: '4068134200129 EINKAUFSTASCHE €1,99 A', confidence: 0.86 },
      { text: '2X 4255719311534 MORE CHUNKY FLAVOU €9,99 €19,98 B', confidence: 0.86 },
      { text: '4068134176240 ISANA MILDE SEIFE €0,65 A', confidence: 0.86 },
      { text: '4068134148940 PROKUDENT PLAQUE I €1,79 A', confidence: 0.86 },
      { text: '4068134194732 ISANA SEIFE PEACH €0,65 A', confidence: 0.86 },
      { text: 'Zwischensumme €25,06', confidence: 0.86 },
      { text: 'Summe €18,95', confidence: 0.86 },
    ]);

    expect(
      draft.items.map(({ name, quantity, lineTotalCents }) => ({
        name,
        quantity,
        lineTotalCents: lineTotalCents.value,
      })),
    ).toEqual([
      { name: 'EINKAUFSTASCHE', quantity: null, lineTotalCents: 199 },
      { name: 'MORE CHUNKY FLAVOU', quantity: 2, lineTotalCents: 1998 },
      { name: 'ISANA MILDE SEIFE', quantity: null, lineTotalCents: 65 },
      { name: 'PROKUDENT PLAQUE I', quantity: null, lineTotalCents: 179 },
      { name: 'ISANA SEIFE PEACH', quantity: null, lineTotalCents: 65 },
    ]);
  });

  it('strips customer and barcode prefixes from a reconstructed Rossmann article row', () => {
    const draft = parseGermanReceipt([
      { text: 'ROSSMANN', confidence: 0.9 },
      {
        text: '*********7196 4068134200129 EINKAUFSTASCHE 81,99 A',
        confidence: 0.9,
      },
    ]);

    expect(draft.items[0]).toMatchObject({
      name: 'EINKAUFSTASCHE',
      lineTotalCents: { value: 8199 },
    });
  });

  it('pairs a separate observed Rossmann price column with barcode-prefixed articles', () => {
    const draft = parseGermanReceipt([
      { text: 'ROSSMANN', confidence: 0.99 },
      {
        text: '2X 4255719311534 MORE CHUNKY FLAVOI 4068134200129 EINKAUFSTASCHE 4068134176240 ISANA MILDE SEIFE 4068134148940 PROKUDENT PLAQUE I 4068134194732 ISANA SEIFE PEACH',
        confidence: 0.86,
      },
      { text: '€1,99 A €19,98 B €0,65 A €1,79 A €0,65 A', confidence: 0.86 },
    ]);

    expect(
      draft.items.map(({ name, lineTotalCents }) => ({
        name,
        lineTotalCents: lineTotalCents.value,
      })),
    ).toEqual([
      { name: 'MORE CHUNKY FLAVOI', lineTotalCents: 1998 },
      { name: 'EINKAUFSTASCHE', lineTotalCents: 199 },
      { name: 'ISANA MILDE SEIFE', lineTotalCents: 65 },
      { name: 'PROKUDENT PLAQUE I', lineTotalCents: 179 },
      { name: 'ISANA SEIFE PEACH', lineTotalCents: 65 },
    ]);
  });

  it('selects the paid Rossmann total instead of the last tax-table amount', () => {
    const draft = parseGermanReceipt([
      { text: 'ROSSMANN', confidence: 0.99 },
      { text: 'Zwischensumme: €25,06', confidence: 0.86 },
      { text: 'Sie haben insgesamt €6,11 gespart!', confidence: 0.86 },
      {
        text: 'Summe €18,95 MWST Gruppe Netto MWST Brutto B 7% €13,44 €0,94 €14,38 A 19% €3,84 €0,73 €4,57',
        confidence: 0.86,
      },
    ]);

    expect(draft.totalCents.value).toBe(1895);
  });

  it('does not keep an article amount above the observed Rossmann subtotal', () => {
    const draft = parseGermanReceipt([
      { text: 'ROSSMANN', confidence: 0.99 },
      { text: 'ISANA SEIFE PEACH €60,65 A', confidence: 0.86 },
      { text: 'Zwischensumme €25,06', confidence: 0.86 },
      { text: 'Summe €18,95', confidence: 0.86 },
    ]);

    expect(draft.items[0]).toMatchObject({
      lineTotalCents: { value: null, needsReview: true },
    });
    expect(draft.totalCents.value).toBe(1895);
  });

  it('filters Rossmann tax and footer fragments from the article list', () => {
    const draft = parseGermanReceipt([
      { text: 'ROSSMANN', confidence: 0.99 },
      { text: 'EINKAUFSTASCHE', confidence: 0.86 },
      { text: 'MORE CHUNKY FLAVOU', confidence: 0.86 },
      { text: 'ISANA MILDE SEIFE', confidence: 0.86 },
      { text: 'PROKUDENT PLAQUE I', confidence: 0.86 },
      { text: 'ISANA SEIFE PEACH', confidence: 0.86 },
      { text: 'A €1,99', confidence: 0.86 },
      { text: 'B €19,98', confidence: 0.86 },
      { text: 'A €0,65', confidence: 0.86 },
      { text: 'A €1,79', confidence: 0.86 },
      { text: 'A €0,65', confidence: 0.86 },
      { text: 'B 7% €13,44 €0,94 €14,38', confidence: 0.86 },
      { text: 'A 19% €3,84 €0,73 €4,57', confidence: 0.86 },
      { text: 'Öffnungszeiten', confidence: 0.86 },
      { text: 'UMTAUSCH NUR MIT KASSENBON', confidence: 0.86 },
      { text: 'Rückzahlung NUR auf verwendetes Kartenkonto', confidence: 0.86 },
    ]);

    expect(draft.items.map(({ name }) => name)).toEqual([
      'EINKAUFSTASCHE',
      'MORE CHUNKY FLAVOU',
      'ISANA MILDE SEIFE',
      'PROKUDENT PLAQUE I',
      'ISANA SEIFE PEACH',
    ]);
  });

  it('does not treat EDEKA header/count lines or the tax-table NETTO label as receipt data', () => {
    const draft = parseGermanReceipt([
      { text: 'Frischecenter Meyer', confidence: 0.9 },
      { text: 'Duplikat', confidence: 0.9 },
      { text: 'EUR', confidence: 0.9 },
      { text: 'G&G Kaisergemüse 2,39 A', confidence: 0.9 },
      { text: 'Posten: 16', confidence: 0.9 },
      { text: 'SUMME €39,14', confidence: 0.9 },
      { text: 'EC-Cash 39,14', confidence: 0.9 },
      { text: 'MwSt NETTO MwSt UMSATZ', confidence: 0.9 },
      { text: 'NETTO', confidence: 0.9 },
    ]);

    expect(draft.market.value).toBeNull();
    expect(
      draft.items.map(({ name, lineTotalCents }) => ({
        name,
        lineTotalCents: lineTotalCents.value,
      })),
    ).toEqual([{ name: 'G&G Kaisergemüse', lineTotalCents: 239 }]);
  });

  it('recognizes a duplicated leading E in the native EDEKA merchant line', () => {
    const draft = parseGermanReceipt([
      { text: 'EEDEKA', confidence: 0.9 },
      { text: 'B.Heilbr.Huste. Tee 2,99 A', confidence: 0.9 },
      { text: 'SUMME €43,37', confidence: 0.9 },
    ]);

    expect(draft.market.value).toBe('EDEKA');
  });

  it('is deterministic for identical OCR input', () => {
    expect(parseGermanReceipt(REWE_RECEIPT_LINES)).toEqual(parseGermanReceipt(REWE_RECEIPT_LINES));
  });

  it.each(receiptGold.sources)(
    'keeps the manifest merchant, paid total and article anchors for $file',
    (source) => {
      const lines = [
        { text: source.merchant, confidence: 0.98 },
        ...(source.purchase_date === null
          ? []
          : [{ text: `Kaufdatum ${source.purchase_date} 14:22`, confidence: 0.96 }]),
        ...source.article_anchors.map((anchor) => ({
          text: goldArticleLine(anchor),
          confidence: 0.96,
        })),
        { text: `Zu zahlen ${formatEuroCents(source.total_cents)} EUR`, confidence: 0.98 },
      ];

      const draft = parseGermanReceipt(lines);

      expect(draft.market.value).toBe(source.merchant);
      expect(draft.totalCents.value).toBe(source.total_cents);
      expect(
        draft.items.map(({ name, quantity, lineTotalCents }) => ({
          name,
          quantity,
          lineTotalCents: lineTotalCents.value,
        })),
      ).toEqual(
        source.article_anchors.map((anchor) => ({
          name: anchor.label,
          quantity: anchor.quantity ?? null,
          lineTotalCents: anchor.line_total_cents,
        })),
      );

      if (source.purchase_date !== null) {
        expect(draft.purchaseDate.value).toBe(source.purchase_date);
      }
    },
  );

  it('does not turn manifest-declared non-item labels into items', () => {
    const source = receiptGold.sources.find(({ file }) => file === 'IMG_4219.HEIC');
    if (!source) throw new Error('Gold source IMG_4219.HEIC is missing.');

    const excludedLabels = source.excluded_lines.flatMap(({ labels }) => labels ?? []);
    const draft = parseGermanReceipt(excludedLabels.map((text) => ({ text, confidence: 0.99 })));

    expect(draft.items).toHaveLength(0);
    expect(draft.excludedLines.length).toBeGreaterThan(0);
  });

  it('keeps a missing native confidence visible instead of inventing certainty', () => {
    const source = receiptGold.sources[0];
    const draft = parseGermanReceipt([
      { text: source.merchant, confidence: null },
      { text: `Zu zahlen ${formatEuroCents(source.total_cents)}`, confidence: null },
      {
        text: `${source.article_anchors[0].label} ${formatEuroCents(source.article_anchors[0].line_total_cents)}`,
        confidence: null,
      },
    ]);

    expect(draft.market).toMatchObject({ value: source.merchant, needsReview: true });
    expect(draft.market.confidence).toBeNull();
    expect(draft.totalCents).toMatchObject({ value: source.total_cents, needsReview: true });
    expect(draft.totalCents.confidence).toBeNull();
    expect(draft.items[0]).toMatchObject({
      lineTotalCents: {
        value: source.article_anchors[0].line_total_cents,
        confidence: null,
        needsReview: true,
      },
      confidence: null,
      needsReview: true,
    });
  });

  it('strips a barcode prefix while preserving the manifest article', () => {
    const source = receiptGold.sources.find(({ file }) => file === 'IMG_4220.HEIC');
    if (!source) throw new Error('Gold source IMG_4220.HEIC is missing.');
    const anchor = source.article_anchors[0];

    const draft = parseGermanReceipt([
      {
        text: `1234567890123 ${anchor.label} ${formatEuroCents(anchor.line_total_cents)} ${anchor.tax_code}`,
        confidence: 0.97,
      },
    ]);

    expect(draft.items[0]).toMatchObject({
      name: anchor.label,
      lineTotalCents: { value: anchor.line_total_cents },
    });
  });

  it('keeps an x-quantity and observed unit price when no line total was observed', () => {
    const anchor = receiptGold.sources[0].article_anchors[1] as GoldArticleAnchor;
    if (anchor.quantity === undefined || anchor.unit_price_cents === undefined) {
      throw new Error('Gold quantity anchor is missing.');
    }

    const draft = parseGermanReceipt([
      {
        text: `${anchor.label} ${formatEuroCents(anchor.unit_price_cents)} € x ${anchor.quantity}`,
        confidence: 0.96,
      },
    ]);

    expect(draft.items[0]).toMatchObject({
      name: anchor.label,
      quantity: anchor.quantity,
      unitPriceCents: { value: anchor.unit_price_cents },
      lineTotalCents: { value: null, needsReview: true },
      needsReview: true,
    });
  });

  it('normalizes the manifest date through the German short-date form', () => {
    const source = receiptGold.sources.find(({ file }) => file === 'IMG_4220.HEIC');
    if (!source || source.purchase_date === null) {
      throw new Error('Gold source IMG_4220.HEIC has no purchase date.');
    }

    const [year, month, day] = source.purchase_date.split('-');
    const draft = parseGermanReceipt([
      { text: source.merchant, confidence: 0.98 },
      { text: `${day}.${month}.${year.slice(2)} 18:30`, confidence: 0.96 },
      { text: `Total ${formatEuroCents(source.total_cents)}`, confidence: 0.98 },
    ]);

    expect(draft.purchaseDate.value).toBe(source.purchase_date);
    expect(draft.totalCents.value).toBe(source.total_cents);
  });

  it('keeps a recognized manifest article when its price is missing', () => {
    const anchor = receiptGold.sources[0].article_anchors[0];
    const draft = parseGermanReceipt([{ text: anchor.label, confidence: 0.93 }]);

    expect(draft.items[0]).toMatchObject({
      name: anchor.label,
      lineTotalCents: { value: null, needsReview: true },
      unitPriceCents: null,
      needsReview: true,
    });
  });
});
