import { formatReceiptDate, formatReceiptMoney, formatReceiptNumber } from './formatting';

describe('receipt history formatting', () => {
  test('formats valid dates and leaves invalid values visible', () => {
    expect(formatReceiptDate('2026-01-01', 'en-US')).toBe('Jan 1, 2026');
    expect(formatReceiptDate('not-a-date', 'en-US')).toBe('not-a-date');
  });

  test('formats receipt money and quantities using the requested locale', () => {
    expect(formatReceiptMoney(1234, 'USD', 'en-US')).toBe('$12.34');
    expect(formatReceiptNumber(1234.5678, 'de-DE')).toBe('1.234,568');
  });
});
