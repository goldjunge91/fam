export type ReceiptFixtureLine = {
  text: string;
  confidence: number;
};

export const REWE_RECEIPT_LINES: readonly ReceiptFixtureLine[] = [
  { text: 'REWE', confidence: 0.99 },
  { text: 'Musterstraße 12', confidence: 0.98 },
  { text: '21.09.2026 14:32', confidence: 0.98 },
  { text: 'Milch 1,5% 1L 1,29', confidence: 0.97 },
  { text: '2 x Äpfel Gala 1,49 2,98', confidence: 0.96 },
  { text: 'Joghurt Natur 0,69', confidence: 0.42 },
  { text: 'Pfand 0,25', confidence: 0.99 },
  { text: 'Rabatt -0,20', confidence: 0.99 },
  { text: 'Coupon Aktionsrabatt -1,00', confidence: 0.99 },
  { text: 'MwSt 19% 0,71', confidence: 0.99 },
  { text: 'Treuekarte Punkte 100', confidence: 0.99 },
  { text: 'GESAMT 4,96', confidence: 0.98 },
  { text: 'EC-Karte 4,96', confidence: 0.99 },
];

export const REWE_RECEIPT_TEXT = REWE_RECEIPT_LINES.map(({ text }) => text).join('\n');
