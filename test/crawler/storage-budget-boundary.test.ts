import { describe, expect, it } from '@jest/globals';
import {
  createStorageBudget,
  decimalGbToBytes,
  StorageBudgetExceededError,
} from '../../tools/crawler/brochures/storage-policy';

describe('Prospekt-Speicherbudget', () => {
  it.each([
    { label: '1 Byte', budgetBytes: 1 },
    { label: '1 MB', budgetBytes: 1_000_000 },
    { label: '1 GB', budgetBytes: decimalGbToBytes(1) },
    { label: '7 GB', budgetBytes: decimalGbToBytes(7) },
    { label: '10 GB', budgetBytes: decimalGbToBytes(10) },
  ])('erlaubt exakt $label und lehnt Überschreitungen ab', ({ budgetBytes }) => {
    const budget = createStorageBudget({
      budgetBytes,
      existingAssets: [{ key: 'existing', bytes: budgetBytes - 1 }],
    });

    expect(() => budget.reserve('too-large', 2)).toThrow(StorageBudgetExceededError);

    const lastByte = budget.reserve('last-byte', 1);
    expect(budget.snapshot()).toMatchObject({
      budgetBytes,
      occupiedBytes: budgetBytes - 1,
      reservedBytes: 1,
      requiredBytes: budgetBytes,
      remainingBudgetBytes: 0,
    });

    lastByte.commit();
    expect(() => budget.reserve('over-limit', 1)).toThrow(StorageBudgetExceededError);
  });
});
