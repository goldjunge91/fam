import type { SqlDatabase } from '@/lib/db/types';
import type { DumpManifest } from './manifest';
import { checkForUpdate, reconcileOnStart } from './repository';

const MANIFEST: DumpManifest = {
  schemaVersion: 2,
  latestVersion: '2026-08-03T00:00:00.000Z',
  baseline: {
    version: '2026-08-01T00:00:00.000Z',
    url: 'https://x/baseline.db',
    size: 1000,
    checksum: 'b',
  },
  patches: [
    {
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-02T00:00:00.000Z',
      url: 'https://x/patch-1.db',
      size: 10,
      checksum: 'p1',
      upserts: 1,
      deletes: 0,
    },
    {
      from: '2026-08-02T00:00:00.000Z',
      to: '2026-08-03T00:00:00.000Z',
      url: 'https://x/patch-2.db',
      size: 10,
      checksum: 'p2',
      upserts: 1,
      deletes: 0,
    },
  ],
};

function fakeDb(): SqlDatabase {
  return {
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: 0 }),
    getAllAsync: jest.fn().mockResolvedValue([]),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    withExclusiveTransactionAsync: jest.fn(async (task) => task(fakeDb())),
  };
}

describe('checkForUpdate', () => {
  const paths = { activePath: '/a', nextPath: '/n', recoveryPath: '/r' };

  it('tut nichts, wenn der lokale Stand bereits aktuell ist', async () => {
    const fetchManifest = jest.fn().mockResolvedValue(MANIFEST);
    const inspectDump = jest.fn().mockResolvedValue({
      schemaVersion: 2,
      dataVersion: MANIFEST.latestVersion,
      integrityOk: true,
    });
    const installBaseline = jest.fn();
    const applyPatch = jest.fn();

    const result = await checkForUpdate({
      db: fakeDb(),
      fileOps: { inspectDump } as never,
      manifestUrl: 'https://x/manifest.json',
      paths,
      fetchManifest,
      installBaseline,
      applyPatch,
    });

    expect(result).toEqual({ kind: 'up-to-date' });
    expect(installBaseline).not.toHaveBeenCalled();
    expect(applyPatch).not.toHaveBeenCalled();
  });

  it('wendet die volle Patchkette der Reihe nach an, wenn der Plan "patch" ist', async () => {
    const fetchManifest = jest.fn().mockResolvedValue(MANIFEST);
    const inspectDump = jest.fn().mockResolvedValue({
      schemaVersion: 2,
      dataVersion: '2026-08-01T00:00:00.000Z',
      integrityOk: true,
    });
    const download = jest.fn().mockResolvedValue(undefined);
    const deleteFile = jest.fn().mockResolvedValue(undefined);
    const installBaseline = jest.fn();
    const applyPatch = jest.fn().mockResolvedValue({ ok: true });

    const result = await checkForUpdate({
      db: fakeDb(),
      fileOps: { inspectDump, download, delete: deleteFile } as never,
      manifestUrl: 'https://x/manifest.json',
      paths,
      fetchManifest,
      installBaseline,
      applyPatch,
    });

    expect(result).toEqual({ kind: 'patched', dataVersion: MANIFEST.latestVersion });
    expect(applyPatch).toHaveBeenCalledTimes(2);
    expect(applyPatch).toHaveBeenNthCalledWith(1, expect.anything(), {
      patchDbPath: expect.any(String),
      expectedFromVersion: '2026-08-01T00:00:00.000Z',
      expectedSchemaVersion: 2,
      toVersion: '2026-08-02T00:00:00.000Z',
      attachmentMode: 'sqlcipher',
    });
    expect(applyPatch).toHaveBeenNthCalledWith(2, expect.anything(), {
      patchDbPath: expect.any(String),
      expectedFromVersion: '2026-08-02T00:00:00.000Z',
      expectedSchemaVersion: 2,
      toVersion: '2026-08-03T00:00:00.000Z',
      attachmentMode: 'sqlcipher',
    });
    // Jede temporaere Patch-Datei wird nach Anwendung wieder geloescht.
    expect(deleteFile).toHaveBeenCalledTimes(2);
    expect(installBaseline).not.toHaveBeenCalled();
  });

  it('installiert eine Baseline, wenn der Plan "baseline" ist', async () => {
    const fetchManifest = jest.fn().mockResolvedValue(MANIFEST);
    const inspectDump = jest.fn().mockResolvedValue(null); // kein lokaler Dump
    const installBaseline = jest
      .fn()
      .mockResolvedValue({ ok: true, dataVersion: MANIFEST.baseline.version });
    const applyPatch = jest.fn();

    const result = await checkForUpdate({
      db: fakeDb(),
      fileOps: { inspectDump } as never,
      manifestUrl: 'https://x/manifest.json',
      paths,
      fetchManifest,
      installBaseline,
      applyPatch,
    });

    expect(result).toEqual({ kind: 'baseline-installed', dataVersion: MANIFEST.baseline.version });
    expect(installBaseline).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      downloadUrl: MANIFEST.baseline.url,
      expectedChecksum: MANIFEST.baseline.checksum,
      expectedSchemaVersion: MANIFEST.schemaVersion,
      activePath: paths.activePath,
      nextPath: paths.nextPath,
      recoveryPath: paths.recoveryPath,
      attachmentMode: 'sqlcipher',
    });
    expect(applyPatch).not.toHaveBeenCalled();
  });

  it('fällt auf eine Baseline zurück, wenn ein Patch in der Kette abgelehnt wird', async () => {
    const fetchManifest = jest.fn().mockResolvedValue(MANIFEST);
    const inspectDump = jest.fn().mockResolvedValue({
      schemaVersion: 2,
      dataVersion: '2026-08-01T00:00:00.000Z',
      integrityOk: true,
    });
    const download = jest.fn().mockResolvedValue(undefined);
    const deleteFile = jest.fn().mockResolvedValue(undefined);
    const installBaseline = jest
      .fn()
      .mockResolvedValue({ ok: true, dataVersion: MANIFEST.baseline.version });
    // Erster Patch scheitert (z.B. weil der Stand sich zwischen Planung und
    // Anwendung doch geaendert hat) -> Fallback auf Baseline statt in einem
    // halb angewendeten Zustand steckenzubleiben.
    const applyPatch = jest.fn().mockResolvedValue({ ok: false, reason: 'from_version_mismatch' });

    const result = await checkForUpdate({
      db: fakeDb(),
      fileOps: { inspectDump, download, delete: deleteFile } as never,
      manifestUrl: 'https://x/manifest.json',
      paths,
      fetchManifest,
      installBaseline,
      applyPatch,
    });

    expect(applyPatch).toHaveBeenCalledTimes(1);
    expect(installBaseline).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ kind: 'baseline-installed', dataVersion: MANIFEST.baseline.version });
  });

  it('liefert "manifest-unavailable", wenn das Manifest nicht geladen werden kann — kein Fehler', async () => {
    const fetchManifest = jest.fn().mockResolvedValue(null);
    const installBaseline = jest.fn();
    const applyPatch = jest.fn();

    const result = await checkForUpdate({
      db: fakeDb(),
      fileOps: {} as never,
      manifestUrl: 'https://x/manifest.json',
      paths,
      fetchManifest,
      installBaseline,
      applyPatch,
    });

    expect(result).toEqual({ kind: 'manifest-unavailable' });
    expect(installBaseline).not.toHaveBeenCalled();
    expect(applyPatch).not.toHaveBeenCalled();
  });
});

describe('reconcileOnStart', () => {
  it('führt keine Aktion aus, wenn nur die aktive Datei existiert', async () => {
    const move = jest.fn();
    const deleteFile = jest.fn();
    const exists = jest.fn().mockImplementation(async (path: string) => path === '/a');

    await reconcileOnStart({ exists, move, delete: deleteFile } as never, {
      activePath: '/a',
      nextPath: '/n',
      recoveryPath: '/r',
    });

    expect(move).not.toHaveBeenCalled();
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it('führt den Swap zu Ende, wenn recovery+next ohne active vorliegen', async () => {
    const move = jest.fn().mockResolvedValue(undefined);
    const deleteFile = jest.fn().mockResolvedValue(undefined);
    const exists = jest
      .fn()
      .mockImplementation(async (path: string) => path === '/n' || path === '/r');

    await reconcileOnStart({ exists, move, delete: deleteFile } as never, {
      activePath: '/a',
      nextPath: '/n',
      recoveryPath: '/r',
    });

    expect(move).toHaveBeenCalledWith('/n', '/a');
    expect(deleteFile).toHaveBeenCalledWith('/r');
  });
});
