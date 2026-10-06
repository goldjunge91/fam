import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  type CoverageSummary,
  collectProductiveSourceFiles,
  evaluatePerFileCoverage,
} from '../../scripts/per-file-coverage';

const REPO_ROOT = process.cwd();

function writeFixture(root: string, file: string) {
  const filePath = join(root, file);
  mkdirSync(join(filePath, '..'), { recursive: true });
  writeFileSync(filePath, 'export {};\n');
}

function coverageEntry(percent: number) {
  return {
    statements: { pct: percent },
    branches: { pct: percent },
    functions: { pct: percent },
    lines: { pct: percent },
  };
}

describe('per-file coverage policy', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(REPO_ROOT, '.tmp-per-file-coverage-'));
  });

  afterEach(() => rmSync(tempDir, { recursive: true, force: true }));

  it('discovers every runtime source extension and platform variant, excluding tests and declarations', () => {
    for (const file of [
      'src/index.ts',
      'src/screen.tsx',
      'src/legacy.js',
      'src/widget.jsx',
      'src/native/screen.ios.tsx',
      'src/native/screen.android.tsx',
      'src/generated/runtime.ts',
      'src/helper.test.ts',
      'src/helper.spec.tsx',
      'src/types.d.ts',
    ]) {
      writeFixture(tempDir, file);
    }

    const sourceFiles = collectProductiveSourceFiles(join(tempDir, 'src'));
    const relativeFiles = sourceFiles.map((file) => relative(tempDir, file).replaceAll('\\', '/'));

    expect(relativeFiles).toEqual([
      'src/generated/runtime.ts',
      'src/index.ts',
      'src/legacy.js',
      'src/native/screen.android.tsx',
      'src/native/screen.ios.tsx',
      'src/screen.tsx',
      'src/widget.jsx',
    ]);
  });

  it('reports the source path and metric when one file is below the floor', () => {
    const sourceFiles = ['src/covered.ts', 'src/undercovered.ts'].map((file) =>
      join(tempDir, file),
    );
    const summary: CoverageSummary = {
      [sourceFiles[0]]: coverageEntry(100),
      [sourceFiles[1]]: {
        ...coverageEntry(100),
        branches: { pct: 69 },
      },
    };

    expect(evaluatePerFileCoverage(sourceFiles, summary, tempDir)).toEqual([
      {
        file: 'src/undercovered.ts',
        metric: 'branches',
        actual: 69,
        minimum: 70,
      },
    ]);
  });

  it('fails when a productive source file has no coverage summary entry', () => {
    const sourceFile = join(tempDir, 'src/unimported.ts');

    expect(evaluatePerFileCoverage([sourceFile], {}, tempDir)).toEqual([
      {
        file: 'src/unimported.ts',
        metric: 'scope',
        actual: null,
        minimum: 70,
      },
    ]);
  });
});
