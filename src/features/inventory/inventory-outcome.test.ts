import { buildInventoryOutcomeTelemetry } from './inventory-outcome';

describe('buildInventoryOutcomeTelemetry', () => {
  it('keeps a known quantity and its authoritative unit', () => {
    expect(buildInventoryOutcomeTelemetry(1, 'kg')).toEqual({
      quantity_known: true,
      quantity: 1,
      unit: 'kg',
    });
  });

  it('fails closed for unknown units and invalid quantities', () => {
    expect(buildInventoryOutcomeTelemetry(100, 'handful')).toEqual({ quantity_known: false });
    expect(buildInventoryOutcomeTelemetry(0, 'g')).toEqual({ quantity_known: false });
  });
});
