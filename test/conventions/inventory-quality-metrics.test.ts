import { spawnSync } from 'node:child_process';

type MetricsReport = {
  effectiveLoc: Array<{ file: string; lines: number }>;
  totalEffectiveLoc: number;
};

describe('inventory quality metrics', () => {
  it('reports deterministic effective LOC for an explicit source file', () => {
    const result = spawnSync(
      'bun',
      [
        'scripts/analyze-inventory-duplicates.ts',
        'src/features/inventory/api.ts',
        '--json',
        '--quiet',
        '--top=1',
      ],
      { encoding: 'utf8' },
    );

    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout) as MetricsReport;
    expect(report.effectiveLoc).toEqual([{ file: 'src/features/inventory/api.ts', lines: 1 }]);
    expect(report.totalEffectiveLoc).toBe(1);
  });
});
