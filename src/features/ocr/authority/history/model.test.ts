import { sortReceiptHistory } from './model';

describe('receipt history model', () => {
  it('sorts by purchase date, creation time, and stable id without using display strings', () => {
    const sorted = sortReceiptHistory([
      {
        id: 'receipt-b',
        purchase_date: '2026-09-20',
        created_at: '2026-09-21T08:00:00.000Z',
      },
      {
        id: 'receipt-c',
        purchase_date: '2026-09-21',
        created_at: '2026-09-20T08:00:00.000Z',
      },
      {
        id: 'receipt-a',
        purchase_date: '2026-09-21',
        created_at: '2026-09-21T08:00:00.000Z',
      },
      {
        id: 'receipt-0',
        purchase_date: '2026-09-21',
        created_at: '2026-09-21T08:00:00.000Z',
      },
    ]);

    expect(sorted.map((receipt) => receipt.id)).toEqual([
      'receipt-0',
      'receipt-a',
      'receipt-c',
      'receipt-b',
    ]);
  });
});
