import { resolve } from 'node:path';
import { describe, expect, it } from '@jest/globals';
import { decimalGbToBytes, parseArgs, selectPublishableBackupDumps } from './index';
import type { CrawlBackupArtifact, CrawlDiagnosticsArtifact, LocationDump } from './types';

function dump(zipCode: string): LocationDump {
  return {
    location: { zipCode, latitude: 50, longitude: 10 },
    stores: [],
    brochures: [],
  };
}

describe('Hauptcrawler-Optionen', () => {
  it('teilt Budget, Nachfrist und Berichtspfad vor dem Lauf auf', () => {
    const options = parseArgs([
      '--dry-run',
      '--storage-budget-gb=0.25',
      '--retention-grace-days=7',
      '--report-dir=reports',
    ]);

    expect(options.storageBudgetGb).toBe(0.25);
    expect(options.retentionGraceDays).toBe(7);
    expect(options.reportDir).toBe(resolve('reports'));
    expect(decimalGbToBytes(options.storageBudgetGb ?? 0)).toBe(250_000_000);
  });

  it('weist ungültige Werte und widersprüchliche Zieloptionen ohne Netzwerkzugriff zurück', () => {
    expect(() => parseArgs(['--storage-budget-gb=1e2'])).toThrow();
    expect(() => parseArgs(['--retention-grace-days=1.5'])).toThrow();
    expect(() => parseArgs(['--from-backup', '--local-dir=out'])).toThrow();
    expect(() => parseArgs(['--local-dir=out'])).toThrow();
    expect(() => parseArgs(['--local-public-url=http://localhost'])).toThrow();
    expect(() => parseArgs(['--concurrency=0'])).toThrow();
  });

  it('gibt aus einem Backup nur Standorte mit gleicher vollständiger Diagnose frei', () => {
    const backup: CrawlBackupArtifact = {
      version: 1,
      runId: 'run-1',
      generatedAt: '2026-09-07T00:00:00Z',
      dumps: [dump('10115'), dump('20095')],
    };
    const diagnostics: CrawlDiagnosticsArtifact = {
      version: 1,
      runId: 'run-1',
      generatedAt: '2026-09-07T00:00:00Z',
      reports: [
        {
          location: backup.dumps[0].location,
          status: 'complete',
          diagnostics: [],
        },
        {
          location: backup.dumps[1].location,
          status: 'incomplete',
          diagnostics: [],
        },
      ],
    };

    const result = selectPublishableBackupDumps(backup, diagnostics);

    expect(result.dumps.map(({ location }) => location.zipCode)).toEqual(['10115']);
    expect(result.skippedLocations).toEqual(['20095']);
  });

  it('verweigert alte, verwaiste oder zu einem anderen Lauf gehörende Diagnosen', () => {
    const backup: CrawlBackupArtifact = {
      version: 1,
      runId: 'run-1',
      generatedAt: '2026-09-07T00:00:00Z',
      dumps: [dump('10115')],
    };

    expect(() => selectPublishableBackupDumps(backup, [])).toThrow(/Diagnosebestand/);
    expect(() =>
      selectPublishableBackupDumps(backup, {
        version: 1,
        runId: 'run-2',
        generatedAt: '2026-09-07T00:00:00Z',
        reports: [],
      }),
    ).toThrow(/unterschiedlichen Läufen/);
    expect(() => selectPublishableBackupDumps([], [])).toThrow(/Array-Backups/);
  });
});
