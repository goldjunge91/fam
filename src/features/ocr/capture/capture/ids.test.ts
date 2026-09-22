import { receiptCaptureAssetId } from './ids';

describe('receipt capture asset IDs', () => {
  it('derives a stable UUID-shaped ID from capture and page order', () => {
    const first = receiptCaptureAssetId('capture-1', 0);
    const second = receiptCaptureAssetId('capture-1', 1);

    expect(first).toBe(receiptCaptureAssetId('capture-1', 0));
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(second).not.toBe(first);
  });
});
