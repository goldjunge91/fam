import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_ROOT = path.join(REPO_ROOT, 'src');
const DEBUG_LOG_OWNER = path.join(SOURCE_ROOT, 'lib', 'debug-log.ts');

function getSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return getSourceFiles(filePath);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)
      ? [filePath]
      : [];
  });
}

describe('Dev-Console-Konvention', () => {
  it('hält app-eigene Terminalausgaben am Dev-Log-Owner', () => {
    const violations = getSourceFiles(SOURCE_ROOT).flatMap((filePath) => {
      if (filePath === DEBUG_LOG_OWNER) return [];

      const source = fs.readFileSync(filePath, 'utf8');
      const consoleCalls = source.match(/console\.(?:log|info|warn|error|debug)\s*\(/gu) ?? [];

      return consoleCalls.map(() => path.relative(REPO_ROOT, filePath));
    });

    expect(violations).toEqual([]);
  });
});
