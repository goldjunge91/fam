import { receiptCaptureAssetId } from './ids';

describe('receiptCaptureAssetId', () => {
  test('returns a stable UUID-shaped version 5 id for each page', () => {
    const first = receiptCaptureAssetId('capture-a', 0);

    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(receiptCaptureAssetId('capture-a', 0)).toBe(first);
    expect(receiptCaptureAssetId('capture-a', 1)).not.toBe(first);
  });

  test('rejects blank capture ids and invalid page indexes', () => {
    expect(() => receiptCaptureAssetId('  ', 0)).toThrow('Capture ID is required.');
    expect(() => receiptCaptureAssetId('capture-a', -1)).toThrow(
      'Page index must be a non-negative safe integer.',
    );
    expect(() => receiptCaptureAssetId('capture-a', 1.5)).toThrow(
      'Page index must be a non-negative safe integer.',
    );
    expect(() => receiptCaptureAssetId('capture-a', Number.MAX_SAFE_INTEGER + 1)).toThrow(
      'Page index must be a non-negative safe integer.',
    );
  });
});
