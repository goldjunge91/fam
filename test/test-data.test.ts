import { createTestData, randomInteger } from './test-data';

describe('test data helpers', () => {
  it('merges per-test overrides into one shared data shape', () => {
    const base = {
      source_item_id: 'item-1',
      opened_item_id: 'opened-item-id',
      household_id: 'hh-1',
      expected_source_quantity: 3_000,
      open_quantity: 1_000,
    };

    expect(createTestData(base, { open_quantity: 2_000 })).toEqual({
      ...base,
      open_quantity: 2_000,
    });
  });

  it('returns the inclusive lower and upper bounds for injected random values', () => {
    expect(randomInteger({ min: 1_000, max: 5_000, random: () => 0 })).toBe(1_000);
    expect(randomInteger({ min: 1_000, max: 5_000, random: () => 0.999999 })).toBe(5_000);
  });

  it('rejects invalid ranges and random values', () => {
    expect(() => randomInteger({ min: 5, max: 4, random: () => 0.5 })).toThrow(
      'min muss kleiner oder gleich max sein',
    );
    expect(() => randomInteger({ min: 1, max: 2, random: () => 1 })).toThrow(
      'Zufallswert muss im Bereich [0, 1) liegen',
    );
  });
});