import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SHOPPING_LIST_ROOT = path.join(REPO_ROOT, 'src', 'features', 'shopping-list');
const BETA_DIRECTORY = 'natuerliches-hinzufuegen-von-einkaufsartikeln-beta';
const ALLOWED_INTEGRATION_FILE = path.join(
  SHOPPING_LIST_ROOT,
  'screens',
  'shopping-list-screen.tsx',
);

function collectProductionFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectProductionFiles(entryPath);
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\.[^.]+$/.test(entry.name)) return [];
    return [entryPath];
  });
}

function extractImportSources(source: string): string[] {
  return [
    ...[...source.matchAll(/(?:^|\n)\s*(?:import|export)\s+.*?\s+from\s+['"]([^'"]+)['"]/g)].map(
      (match) => match[1],
    ),
    ...[...source.matchAll(/(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g)].map((match) => match[1]),
    ...[...source.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map((match) => match[1]),
    ...[...source.matchAll(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map((match) => match[1]),
  ];
}

describe('Natural-language addition beta isolation', () => {
  it('keeps the normal shopping-list production graph free of beta imports', () => {
    const productionFiles = collectProductionFiles(SHOPPING_LIST_ROOT).filter(
      (filePath) =>
        !filePath.split(path.sep).includes(BETA_DIRECTORY) && filePath !== ALLOWED_INTEGRATION_FILE,
    );
    const violations = productionFiles.flatMap((filePath) =>
      extractImportSources(fs.readFileSync(filePath, 'utf8'))
        .filter((source) => source.includes(BETA_DIRECTORY))
        .map((source) => `${path.relative(REPO_ROOT, filePath)} -> ${source}`),
    );

    expect(violations).toEqual([]);
  });
});
