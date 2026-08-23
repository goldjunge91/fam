/**
 * End-to-End-Tests der CI-Delta-Pipeline (#223 Paket 5) über die tatsächlichen
 * CLI-Einstiegspunkte `build-canonical-update.ts` und `reconstruct-canonical.ts`
 * — bislang nur manuell gegen echte CI-Läufe geprüft, nie automatisiert lokal.
 *
 * Beide Skripte rufen `main()` unbedingt beim Modul-Import auf (kein
 * `import.meta.main`-Guard), sind also nicht direkt als Funktionen testbar —
 * daher hier als echte Subprozesse über `bun run`, genau wie
 * `.github/workflows/update_dump.yml` sie aufruft. Reine Datei-I/O, kein
 * GitHub-/Netzwerkzugriff (das übernimmt `gh` im Workflow, nicht diese
 * Skripte), daher ohne externe Dienste lauffähig.
 */

import { Database } from 'bun:sqlite';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { PRODUCT_COLUMNS, productColumnDefsSql } from './dump-sqlite-io';

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const BUILD_SCRIPT = path.join(SCRIPT_DIR, 'build-canonical-update.ts');
const RECONSTRUCT_SCRIPT = path.join(SCRIPT_DIR, 'reconstruct-canonical.ts');
const BASE_URL = 'https://example.com/off-dump-current';

type TestProduct = { code: string; name: string; energyKcal: number };

function writeExtractDb(filePath: string, products: TestProduct[], dataVersion: string): void {
  const db = new Database(filePath, { create: true });
  try {
    db.exec(`create table products (${productColumnDefsSql()});`);
    db.exec(
      'create table dump_meta (schema_version integer not null, data_version text not null, generated_at text not null, source_cursor text);',
    );
    const insert = db.query(
      `insert into products (${PRODUCT_COLUMNS.join(', ')}) values (${PRODUCT_COLUMNS.map(() => '?').join(', ')})`,
    );
    for (const p of products) {
      insert.run(p.code, p.name, null, null, null, null, '[]', dataVersion, p.energyKcal, 0, 0, 0, 0, 0, 0);
    }
    db.query(
      'insert into dump_meta (schema_version, data_version, generated_at, source_cursor) values (2, ?, ?, NULL)',
    ).run(dataVersion, dataVersion);
  } finally {
    db.close();
  }
}

function readProductRows(filePath: string): { code: string; product_name: string; energy_kcal: number }[] {
  const db = new Database(filePath, { readonly: true });
  try {
    return db.query('select code, product_name, energy_kcal from products order by code').all() as {
      code: string;
      product_name: string;
      energy_kcal: number;
    }[];
  } finally {
    db.close();
  }
}

function runScript(scriptPath: string, args: string[]): string {
  return execFileSync('bun', ['run', scriptPath, ...args], { encoding: 'utf-8' });
}

function readManifest(outDir: string) {
  return JSON.parse(readFileSync(path.join(outDir, 'manifest.json'), 'utf-8'));
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'dump-pipeline-cli-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('build-canonical-update.ts', () => {
  it('schneidet beim allerersten Lauf (kein --old-canonical) eine neue Baseline', () => {
    const extract = path.join(dir, 'v1.db');
    writeExtractDb(extract, [{ code: '1', name: 'Apfelsaft', energyKcal: 45 }], '2026-08-01T00-00-00Z');
    const outDir = path.join(dir, 'out1');

    const stdout = runScript(BUILD_SCRIPT, [
      '--new-extract', extract,
      '--out-dir', outDir,
      '--base-url', BASE_URL,
    ]);

    expect(stdout).toContain('Neue Baseline geschnitten.');
    expect(existsSync(path.join(outDir, 'canonical.db'))).toBe(true);
    expect(existsSync(path.join(outDir, 'baseline-2026-08-01T00-00-00Z.db'))).toBe(true);

    const manifest = readManifest(outDir);
    expect(manifest.baseline.version).toBe('2026-08-01T00-00-00Z');
    expect(manifest.patches).toEqual([]);
  });

  it('erzeugt im selben Monat einen Patch mit den exakt erwarteten Upserts/Deletes', () => {
    const v1 = path.join(dir, 'v1.db');
    writeExtractDb(
      v1,
      [
        { code: '1', name: 'Apfelsaft', energyKcal: 45 },
        { code: '2', name: 'Wird gelöscht', energyKcal: 10 },
      ],
      '2026-08-01T00-00-00Z',
    );
    const out1 = path.join(dir, 'out1');
    runScript(BUILD_SCRIPT, ['--new-extract', v1, '--out-dir', out1, '--base-url', BASE_URL]);

    const v2 = path.join(dir, 'v2.db');
    writeExtractDb(
      v2,
      [
        { code: '1', name: 'Apfelsaft', energyKcal: 45 }, // unverändert -> kein Upsert
        { code: '3', name: 'Neu', energyKcal: 5 },
      ],
      '2026-08-15T00-00-00Z',
    );
    const out2 = path.join(dir, 'out2');
    const stdout = runScript(BUILD_SCRIPT, [
      '--new-extract', v2,
      '--out-dir', out2,
      '--base-url', BASE_URL,
      '--old-canonical', path.join(out1, 'canonical.db'),
      '--previous-manifest', path.join(out1, 'manifest.json'),
    ]);

    expect(stdout).toContain('Patch erzeugt.');
    expect(stdout).toContain('Upserts: 1, Deletes: 1');

    const manifest = readManifest(out2);
    expect(manifest.patches).toHaveLength(1);
    expect(manifest.patches[0]).toMatchObject({ from: '2026-08-01T00-00-00Z', to: '2026-08-15T00-00-00Z', upserts: 1, deletes: 1 });
    expect(manifest.baseline.version).toBe('2026-08-01T00-00-00Z'); // Baseline bleibt bei einem Patch-Lauf unverändert
  });

  it('schneidet bei Monatswechsel eine neue Baseline statt eines Patches', () => {
    const v1 = path.join(dir, 'v1.db');
    writeExtractDb(v1, [{ code: '1', name: 'Apfelsaft', energyKcal: 45 }], '2026-08-01T00-00-00Z');
    const out1 = path.join(dir, 'out1');
    runScript(BUILD_SCRIPT, ['--new-extract', v1, '--out-dir', out1, '--base-url', BASE_URL]);

    const v2 = path.join(dir, 'v2.db');
    writeExtractDb(v2, [{ code: '1', name: 'Apfelsaft', energyKcal: 45 }], '2026-09-01T00-00-00Z');
    const out2 = path.join(dir, 'out2');
    const stdout = runScript(BUILD_SCRIPT, [
      '--new-extract', v2,
      '--out-dir', out2,
      '--base-url', BASE_URL,
      '--old-canonical', path.join(out1, 'canonical.db'),
      '--previous-manifest', path.join(out1, 'manifest.json'),
    ]);

    expect(stdout).toContain('Neue Baseline geschnitten.');
    expect(existsSync(path.join(out2, 'baseline-2026-09-01T00-00-00Z.db'))).toBe(true);
    expect(readManifest(out2).baseline.version).toBe('2026-09-01T00-00-00Z');
  });
});

describe('reconstruct-canonical.ts', () => {
  it('baut aus Baseline + Patch exakt denselben Produktinhalt wie die real veröffentlichte kanonische DB', () => {
    const v1 = path.join(dir, 'v1.db');
    writeExtractDb(
      v1,
      [
        { code: '1', name: 'Apfelsaft', energyKcal: 45 },
        { code: '2', name: 'Wird gelöscht', energyKcal: 10 },
      ],
      '2026-08-01T00-00-00Z',
    );
    const out1 = path.join(dir, 'out1');
    runScript(BUILD_SCRIPT, ['--new-extract', v1, '--out-dir', out1, '--base-url', BASE_URL]);

    const v2 = path.join(dir, 'v2.db');
    writeExtractDb(
      v2,
      [
        { code: '1', name: 'Apfelsaft', energyKcal: 45 },
        { code: '3', name: 'Neu', energyKcal: 5 },
      ],
      '2026-08-15T00-00-00Z',
    );
    const out2 = path.join(dir, 'out2');
    runScript(BUILD_SCRIPT, [
      '--new-extract', v2,
      '--out-dir', out2,
      '--base-url', BASE_URL,
      '--old-canonical', path.join(out1, 'canonical.db'),
      '--previous-manifest', path.join(out1, 'manifest.json'),
    ]);

    const reconstructed = path.join(dir, 'reconstructed.db');
    const stdout = runScript(RECONSTRUCT_SCRIPT, [
      '--baseline', path.join(out1, 'baseline-2026-08-01T00-00-00Z.db'),
      '--patches', path.join(out2, 'patch-2026-08-01T00-00-00Z-2026-08-15T00-00-00Z.db'),
      '--out', reconstructed,
      '--expect-data-version', '2026-08-15T00-00-00Z',
    ]);

    expect(stdout).toContain('quick_check: ok.');
    // Regressionstest: vor dem text/real-Fix wichen die rekonstruierten
    // Nährwerte in ihrer SQLite-Typaffinität von der echten canonical.db ab.
    expect(readProductRows(reconstructed)).toEqual(readProductRows(path.join(out2, 'canonical.db')));
  });

  it('bricht bei einer unterbrochenen Patchkette mit einem Fehler ab, statt eine falsche DB zu schreiben', () => {
    const baseline = path.join(dir, 'baseline.db');
    writeExtractDb(baseline, [{ code: '1', name: 'Apfelsaft', energyKcal: 45 }], '2026-08-01T00-00-00Z');

    // Patch, dessen from-Version nicht an die Baseline anschließt.
    const v1 = path.join(dir, 'v-unrelated.db');
    writeExtractDb(v1, [{ code: '1', name: 'X', energyKcal: 1 }], '2099-01-01T00-00-00Z');
    const outUnrelated = path.join(dir, 'out-unrelated');
    runScript(BUILD_SCRIPT, ['--new-extract', v1, '--out-dir', outUnrelated, '--base-url', BASE_URL]);
    const v2 = path.join(dir, 'v-unrelated-2.db');
    writeExtractDb(v2, [{ code: '1', name: 'X', energyKcal: 2 }], '2099-02-01T00-00-00Z');
    const outUnrelatedPatch = path.join(dir, 'out-unrelated-patch');
    runScript(BUILD_SCRIPT, [
      '--new-extract', v2,
      '--out-dir', outUnrelatedPatch,
      '--base-url', BASE_URL,
      '--old-canonical', path.join(outUnrelated, 'canonical.db'),
      '--previous-manifest', path.join(outUnrelated, 'manifest.json'),
    ]);
    const unrelatedPatch = path.join(outUnrelatedPatch, 'patch-2099-01-01T00-00-00Z-2099-02-01T00-00-00Z.db');

    expect(() =>
      runScript(RECONSTRUCT_SCRIPT, [
        '--baseline', baseline,
        '--patches', unrelatedPatch,
        '--out', path.join(dir, 'out.db'),
      ]),
    ).toThrow();
  });
});
