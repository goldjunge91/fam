import type { DumpManifest } from './manifest';
import { planUpdate } from './update-planner';

const BASE_MANIFEST: DumpManifest = {
  schemaVersion: 2,
  latestVersion: '2026-08-03T00:00:00.000Z',
  baseline: {
    version: '2026-08-01T00:00:00.000Z',
    url: 'https://example/baseline.db',
    size: 1000,
    checksum: 'baseline-hash',
  },
  patches: [
    {
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-02T00:00:00.000Z',
      url: 'https://example/patch-1.db',
      size: 50,
      checksum: 'patch-1-hash',
      upserts: 10,
      deletes: 2,
    },
    {
      from: '2026-08-02T00:00:00.000Z',
      to: '2026-08-03T00:00:00.000Z',
      url: 'https://example/patch-2.db',
      size: 50,
      checksum: 'patch-2-hash',
      upserts: 5,
      deletes: 1,
    },
  ],
};

describe('planUpdate', () => {
  it('verlangt eine neue Baseline, wenn noch kein lokaler Dump existiert', () => {
    const plan = planUpdate(
      { schemaVersion: null, dataVersion: null, integrityOk: true },
      BASE_MANIFEST,
    );
    expect(plan).toEqual({ kind: 'baseline', reason: 'no_local_dump' });
  });

  it('verlangt eine neue Baseline bei abweichender Schemaversion', () => {
    const plan = planUpdate(
      { schemaVersion: 1, dataVersion: '2026-08-01T00:00:00.000Z', integrityOk: true },
      BASE_MANIFEST,
    );
    expect(plan).toEqual({ kind: 'baseline', reason: 'schema_mismatch' });
  });

  it('verlangt eine neue Baseline, wenn die lokale Datei beschädigt ist', () => {
    const plan = planUpdate(
      { schemaVersion: 2, dataVersion: '2026-08-01T00:00:00.000Z', integrityOk: false },
      BASE_MANIFEST,
    );
    expect(plan).toEqual({ kind: 'baseline', reason: 'corrupted' });
  });

  it('meldet "up-to-date", wenn die lokale Version bereits die neueste ist', () => {
    const plan = planUpdate(
      { schemaVersion: 2, dataVersion: '2026-08-03T00:00:00.000Z', integrityOk: true },
      BASE_MANIFEST,
    );
    expect(plan).toEqual({ kind: 'up-to-date' });
  });

  it('verlangt eine neue Baseline, wenn die lokale Version älter als die unterstützte Baseline ist', () => {
    const plan = planUpdate(
      { schemaVersion: 2, dataVersion: '2026-07-01T00:00:00.000Z', integrityOk: true },
      BASE_MANIFEST,
    );
    expect(plan).toEqual({ kind: 'baseline', reason: 'local_version_too_old' });
  });

  it('liefert die vollständige Patchkette ab der Baseline-Version', () => {
    const plan = planUpdate(
      { schemaVersion: 2, dataVersion: '2026-08-01T00:00:00.000Z', integrityOk: true },
      BASE_MANIFEST,
    );
    expect(plan).toEqual({ kind: 'patch', patches: BASE_MANIFEST.patches });
  });

  it('liefert nur den restlichen Teil der Kette, wenn schon ein Patch angewendet wurde', () => {
    const plan = planUpdate(
      { schemaVersion: 2, dataVersion: '2026-08-02T00:00:00.000Z', integrityOk: true },
      BASE_MANIFEST,
    );
    expect(plan).toEqual({ kind: 'patch', patches: [BASE_MANIFEST.patches[1]] });
  });

  it('verlangt eine neue Baseline, wenn die Patchkette lückenhaft ist (fehlender Zwischenschritt)', () => {
    const brokenManifest: DumpManifest = {
      ...BASE_MANIFEST,
      patches: [BASE_MANIFEST.patches[1]], // Patch 1 (08-01 -> 08-02) fehlt
    };
    const plan = planUpdate(
      { schemaVersion: 2, dataVersion: '2026-08-01T00:00:00.000Z', integrityOk: true },
      brokenManifest,
    );
    expect(plan).toEqual({ kind: 'baseline', reason: 'incomplete_patch_chain' });
  });

  it('verlangt eine neue Baseline, wenn die Gesamt-Patchgröße die Schwelle (Default 70% der Baseline) überschreitet', () => {
    const bigPatchManifest: DumpManifest = {
      ...BASE_MANIFEST,
      patches: [
        { ...BASE_MANIFEST.patches[0], size: 400 },
        { ...BASE_MANIFEST.patches[1], size: 400 }, // 800 / 1000 = 80% > 70%
      ],
    };
    const plan = planUpdate(
      { schemaVersion: 2, dataVersion: '2026-08-01T00:00:00.000Z', integrityOk: true },
      bigPatchManifest,
    );
    expect(plan).toEqual({ kind: 'baseline', reason: 'patch_size_exceeds_threshold' });
  });

  it('erlaubt eine benutzerdefinierte Schwelle für die Patch-vs-Baseline-Entscheidung', () => {
    const plan = planUpdate(
      { schemaVersion: 2, dataVersion: '2026-08-01T00:00:00.000Z', integrityOk: true },
      BASE_MANIFEST,
      { patchSizeThreshold: 0.05 }, // 100/1000 = 10% > 5%
    );
    expect(plan).toEqual({ kind: 'baseline', reason: 'patch_size_exceeds_threshold' });
  });

  it('behandelt eine frische Baseline ohne Patches korrekt (lokale Version == Baseline-Version == latestVersion)', () => {
    const freshManifest: DumpManifest = {
      ...BASE_MANIFEST,
      latestVersion: BASE_MANIFEST.baseline.version,
      patches: [],
    };
    const plan = planUpdate(
      { schemaVersion: 2, dataVersion: freshManifest.baseline.version, integrityOk: true },
      freshManifest,
    );
    expect(plan).toEqual({ kind: 'up-to-date' });
  });
});
