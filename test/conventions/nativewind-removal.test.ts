import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_ROOT = path.join(REPO_ROOT, 'src');
const SOURCE_FILE = /\.(?:ts|tsx)$/u;
const FORBIDDEN_MARKUP = /\b(?:className|contentContainerClassName)\s*=/u;
const FORBIDDEN_IMPORT = /\b(?:from|import|require)\s*\(?\s*['"]nativewind(?:\/|['"])/u;

function getSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return getSourceFiles(filePath);
    return SOURCE_FILE.test(entry.name) ? [filePath] : [];
  });
}

describe('NativeWind-Removal-Gate', () => {
  it('findet keine aktiven NativeWind-Props oder -Imports im src-Baum', () => {
    const violations = getSourceFiles(SOURCE_ROOT).flatMap((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');
      return source
        .split('\n')
        .flatMap((line, index) =>
          FORBIDDEN_MARKUP.test(line) || FORBIDDEN_IMPORT.test(line)
            ? [`${path.relative(REPO_ROOT, filePath)}:${index + 1}`]
            : [],
        );
    });

    expect(violations).toEqual([]);
  });
});
