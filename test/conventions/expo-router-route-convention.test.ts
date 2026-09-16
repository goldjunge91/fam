import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const APP_ROOT = path.join(REPO_ROOT, 'src', 'app');
const ROUTE_SOURCE = /\.(?:ts|tsx|js|jsx|mts|cts|mjs|cjs)$/u;
const TEST_ONLY_SOURCE = /\.(?:test|spec)\.(?:ts|tsx|js|jsx|mts|cts|mjs|cjs)$/u;

function getFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return getFiles(filePath);
    return ROUTE_SOURCE.test(entry.name) ? [filePath] : [];
  });
}

describe('Expo-Router-Routenbaum-Konvention', () => {
  it('hält Testdateien außerhalb von src/app', () => {
    const testOnlyRoutes = getFiles(APP_ROOT)
      .filter((filePath) => TEST_ONLY_SOURCE.test(filePath))
      .map((filePath) => path.relative(REPO_ROOT, filePath));

    expect(testOnlyRoutes).toEqual([]);
  });

  it('importiert keine Testing-Library in produktiven Routen', () => {
    const violations = getFiles(APP_ROOT).flatMap((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');
      return /@testing-library\/(?:react-native|jest-native)/u.test(source)
        ? [path.relative(REPO_ROOT, filePath)]
        : [];
    });

    expect(violations).toEqual([]);
  });
});
