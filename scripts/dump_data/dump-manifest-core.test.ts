import { buildNextManifest, type DumpManifest, isNewBaselineDue } from './dump-manifest-core';

describe('isNewBaselineDue', () => {
  it('ist faellig, wenn es noch keine vorherige Baseline gibt (allererster Lauf)', () => {
    expect(isNewBaselineDue(null, '2026-08-15T00:00:00.000Z')).toBe(true);
  });

  it('ist nicht faellig innerhalb desselben Kalendermonats', () => {
    expect(isNewBaselineDue('2026-08-01T00:00:00.000Z', '2026-08-28T00:00:00.000Z')).toBe(false);
  });

  it('ist faellig, sobald ein neuer Kalendermonat erreicht ist', () => {
    expect(isNewBaselineDue('2026-08-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z')).toBe(true);
  });

  it('behandelt den Jahreswechsel korrekt', () => {
    expect(isNewBaselineDue('2026-12-15T00:00:00.000Z', '2027-01-02T00:00:00.000Z')).toBe(true);
  });
});

const asset = { url: 'https://example/x.db', size: 100, checksum: 'abc' };

describe('buildNextManifest', () => {
  it('erzeugt ein frisches Manifest für die allererste Baseline (kein Vorgänger)', () => {
    const manifest = buildNextManifest({
      previous: null,
      isNewBaseline: true,
      schemaVersion: 2,
      dataVersion: '2026-08-01',
      baselineAsset: asset,
      patchEntry: null,
    });

    expect(manifest).toEqual({
      schemaVersion: 2,
      latestVersion: '2026-08-01',
      baseline: { version: '2026-08-01', ...asset },
      patches: [],
    });
  });

  it('hängt einen Patch an eine bestehende Kette an, Baseline bleibt unverändert', () => {
    const previous: DumpManifest = {
      schemaVersion: 2,
      latestVersion: '2026-08-01',
      baseline: { version: '2026-08-01', ...asset },
      patches: [],
    };
    const patchEntry = {
      from: '2026-08-01',
      to: '2026-08-02',
      url: 'https://example/patch.db',
      size: 50,
      checksum: 'def',
      upserts: 3,
      deletes: 1,
    };

    const manifest = buildNextManifest({
      previous,
      isNewBaseline: false,
      schemaVersion: 2,
      dataVersion: '2026-08-02',
      baselineAsset: asset,
      patchEntry,
    });

    expect(manifest.baseline).toEqual(previous.baseline);
    expect(manifest.latestVersion).toBe('2026-08-02');
    expect(manifest.patches).toEqual([patchEntry]);
  });

  it('hängt einen weiteren Patch ans Ende einer bestehenden Kette an (N -> N+1 -> N+2)', () => {
    const firstPatch = {
      from: '2026-08-01',
      to: '2026-08-02',
      url: 'x',
      size: 1,
      checksum: 'a',
      upserts: 1,
      deletes: 0,
    };
    const previous: DumpManifest = {
      schemaVersion: 2,
      latestVersion: '2026-08-02',
      baseline: { version: '2026-08-01', ...asset },
      patches: [firstPatch],
    };
    const secondPatch = {
      from: '2026-08-02',
      to: '2026-08-03',
      url: 'y',
      size: 2,
      checksum: 'b',
      upserts: 2,
      deletes: 1,
    };

    const manifest = buildNextManifest({
      previous,
      isNewBaseline: false,
      schemaVersion: 2,
      dataVersion: '2026-08-03',
      baselineAsset: asset,
      patchEntry: secondPatch,
    });

    expect(manifest.patches).toEqual([firstPatch, secondPatch]);
  });

  it('verwirft die alte Patchkette, sobald eine neue Baseline geschnitten wird', () => {
    const previous: DumpManifest = {
      schemaVersion: 2,
      latestVersion: '2026-08-15',
      baseline: { version: '2026-08-01', ...asset },
      patches: [
        {
          from: '2026-08-01',
          to: '2026-08-15',
          url: 'x',
          size: 1,
          checksum: 'a',
          upserts: 1,
          deletes: 0,
        },
      ],
    };

    const manifest = buildNextManifest({
      previous,
      isNewBaseline: true,
      schemaVersion: 2,
      dataVersion: '2026-09-01',
      baselineAsset: { url: 'https://example/new-baseline.db', size: 200, checksum: 'new' },
      patchEntry: null,
    });

    expect(manifest.patches).toEqual([]);
    expect(manifest.baseline.version).toBe('2026-09-01');
    expect(manifest.latestVersion).toBe('2026-09-01');
  });

  it('wirft, wenn kein neuer Baseline-Lauf vorliegt, aber weder Vorgänger noch Patch-Eintrag da sind', () => {
    expect(() =>
      buildNextManifest({
        previous: null,
        isNewBaseline: false,
        schemaVersion: 2,
        dataVersion: '2026-08-02',
        baselineAsset: asset,
        patchEntry: null,
      }),
    ).toThrow();
  });
});
