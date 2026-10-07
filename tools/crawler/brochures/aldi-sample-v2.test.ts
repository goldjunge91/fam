import { describe, expect, it } from '@jest/globals';
import {
  deriveSampleRunStatus,
  parseOptions,
  parseRetentionGraceDays,
  parseStorageBudgetGb,
} from './aldi-sample-v2';

describe('Sample-Crawler-Optionen', () => {
  it('akzeptiert positive dezimale GB und nichtnegative ganze Nachfrist-Tage', () => {
    expect(parseStorageBudgetGb('1.25')).toBe(1.25);
    expect(parseStorageBudgetGb('0')).toBe(0);
    expect(parseRetentionGraceDays('0')).toBe(0);
    expect(parseRetentionGraceDays('14')).toBe(14);
  });

  it('weist ungültige oder negative Werte vor dem Crawl zurück', () => {
    expect(() => parseStorageBudgetGb('1e2')).toThrow();
    expect(() => parseRetentionGraceDays('-1')).toThrow();
    expect(() => parseRetentionGraceDays('1.5')).toThrow();
  });

  it('akzeptiert keine teilweise geparsten Zahlenoptionen', async () => {
    expect(() => parseStorageBudgetGb('1.5x')).toThrow();
    await expect(
      parseOptions(['node', 'aldi-sample-v2.ts', '--output-dir=out', '--sample-size=2x']),
    ).rejects.toThrow('--sample-size');
    await expect(
      parseOptions(['node', 'aldi-sample-v2.ts', '--output-dir=out', '--concurrency=2x']),
    ).rejects.toThrow('--concurrency');
    await expect(
      parseOptions(['node', 'aldi-sample-v2.ts', '--output-dir=out', '--pages=6x']),
    ).rejects.toThrow('--pages');
  });

  it('meldet begrenzte Auswahl als partial, aber Budget- und Abruffehler als failed', () => {
    expect(deriveSampleRunStatus('partial', 0, [], [])).toBe('partial');
    expect(deriveSampleRunStatus('partial', 0, [], [{ code: 'detail-fetch-failed' }])).toBe(
      'failed',
    );
    expect(deriveSampleRunStatus('partial', 0, [], [{ code: 'offers-list-failed' }])).toBe(
      'failed',
    );
    expect(
      deriveSampleRunStatus(
        'complete',
        0,
        [{ pageNumber: 1, originalUrl: '', code: 'STORAGE_BUDGET_EXCEEDED', message: 'budget' }],
        [],
      ),
    ).toBe('failed');
  });
});
