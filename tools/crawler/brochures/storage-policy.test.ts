import { describe, expect, it } from '@jest/globals';
import {
  createRetentionReport,
  createStorageBudget,
  decimalGbToBytes,
  StorageBudgetExceededError,
} from './storage-policy';

describe('Storage-Budget und Aufbewahrung', () => {
  it('wandelt dezimale GB exakt in Bytes um', () => {
    expect(decimalGbToBytes(0.001)).toBe(1_000_000);
  });

  it('reserviert parallele neue Assets gemeinsam und zählt Bestand nur einmal', () => {
    const budget = createStorageBudget({
      budgetBytes: 10,
      existingAssets: [
        { key: 'existing', bytes: 4 },
        { key: 'existing', bytes: 4 },
      ],
    });

    const first = budget.reserve('new-a', 6);
    expect(() => budget.reserve('new-b', 1)).toThrow(StorageBudgetExceededError);
    expect(budget.snapshot()).toMatchObject({
      occupiedBytes: 4,
      reservedBytes: 6,
      requiredBytes: 10,
      remainingBudgetBytes: 0,
    });

    first.commit();
    expect(budget.snapshot()).toMatchObject({ occupiedBytes: 10, reservedBytes: 0 });
  });

  it('behält eine Reservation bei einem unklaren Write-Ergebnis', () => {
    const budget = createStorageBudget({ budgetBytes: 10 });
    budget.reserve('uncertain', 7);

    expect(budget.snapshot()).toMatchObject({
      occupiedBytes: 0,
      reservedBytes: 7,
      remainingBudgetBytes: 3,
    });
  });

  it('meldet gemeinsame Referenzen und gibt bei vollständiger Basis nur echte Kandidaten an', () => {
    const report = createRetentionReport({
      now: new Date('2026-09-07T00:00:00Z'),
      retentionGraceDays: 2,
      referenceBasisComplete: true,
      assets: [
        { key: 'shared', bytes: 100 },
        { key: 'old', bytes: 200 },
      ],
      brochures: [
        { id: 'active', validUntil: '2026-09-10T00:00:00Z', assetKeys: ['shared'] },
        { id: 'expired', validUntil: '2026-09-01T00:00:00Z', assetKeys: ['shared', 'old'] },
        { id: 'invalid', validUntil: 'not-a-date', assetKeys: ['old'] },
      ],
    });

    expect(report.expiredBrochures.map((brochure) => brochure.id)).toEqual(['expired']);
    expect(report.referencedAssets).toEqual([
      { key: 'old', bytes: 200, brochureIds: ['invalid'] },
      { key: 'shared', bytes: 100, brochureIds: ['active'] },
    ]);
    expect(report.cleanupCandidates).toEqual([]);
    expect(report.potentiallyReleasableBytes).toBe(0);
    expect(report.cleanupApplied).toBe(false);
  });

  it('markiert Kandidaten bei unvollständiger Referenzbasis nur als unsicher', () => {
    const report = createRetentionReport({
      now: new Date('2026-09-07T00:00:00Z'),
      retentionGraceDays: 0,
      referenceBasisComplete: false,
      assets: [{ key: 'old', bytes: 200 }],
      brochures: [{ id: 'expired', validUntil: '2026-09-01T00:00:00Z', assetKeys: ['old'] }],
    });

    expect(report.cleanupCandidates).toEqual([
      {
        key: 'old',
        bytes: 200,
        eligibleForCleanup: false,
        reason: 'reference-basis-incomplete',
      },
    ]);
    expect(report.potentiallyReleasableBytes).toBe(0);
  });

  it('verwendet einen Prospektpräfix nur für mögliche Bereinigungskandidaten', () => {
    const report = createRetentionReport({
      now: new Date('2026-09-07T00:00:00Z'),
      retentionGraceDays: 0,
      referenceBasisComplete: true,
      candidateKeyPrefix: 'brochures/dumps/',
      assets: [
        { key: 'other/config.json', bytes: 50 },
        { key: 'brochures/dumps/orphan.jpg', bytes: 100 },
      ],
      brochures: [],
    });

    expect(report.cleanupCandidates.map(({ key }) => key)).toEqual(['brochures/dumps/orphan.jpg']);
    expect(report.occupiedBytes).toBe(150);
  });
});
