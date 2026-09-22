import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DOMAIN_DIR = path.join(REPO_ROOT, 'src', 'features', 'ocr', 'authority', 'domain');
const EXPECTED_DOMAIN_FILES = ['status.ts', 'types.ts'];

function matchesOf(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

function extractImportSources(source: string): string[] {
  return [
    ...matchesOf(source, /(?:^|\n)\s*(?:import|export)\s+.*?\s+from\s+['"]([^'"]+)['"]/gs),
    ...matchesOf(source, /(?:^|\n)\s*(?:import|export)\s+['"]([^'"]+)['"]/g),
    ...matchesOf(source, /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
    ...matchesOf(source, /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
  ];
}

const FORBIDDEN_IMPORT_RULES: Array<{ label: string; test: (source: string) => boolean }> = [
  {
    label: 'React',
    test: (source) => source === 'react' || source.startsWith('react/'),
  },
  {
    label: 'React Native',
    test: (source) =>
      source === 'react-native' ||
      source.startsWith('react-native/') ||
      source.startsWith('react-native-'),
  },
  {
    label: 'Expo',
    test: (source) => source === 'expo' || source.startsWith('expo-') || source.startsWith('expo/'),
  },
  {
    label: 'SQLite/Drizzle',
    test: (source) =>
      source === 'expo-sqlite' ||
      source.startsWith('expo-sqlite/') ||
      source === 'drizzle-orm' ||
      source.startsWith('drizzle-orm/') ||
      source.startsWith('@/lib/db/') ||
      source.startsWith('@/lib/db'),
  },
  {
    label: 'Supabase',
    test: (source) =>
      source === 'supabase' ||
      source.startsWith('supabase/') ||
      source === '@supabase' ||
      source.startsWith('@supabase/'),
  },
  {
    label: 'Storage/Sync',
    test: (source) =>
      source.startsWith('@/lib/storage') ||
      source.startsWith('@/lib/sync') ||
      source.startsWith('@/lib/database.types'),
  },
  {
    label: 'Hooks/UI',
    test: (source) =>
      source.startsWith('@/components') ||
      source.includes('/hooks/') ||
      source.includes('/screens/'),
  },
];

describe('Receipt Authority Domain Ownership Gate', () => {
  let productionFiles: string[];
  let sourcesByFile: Map<string, string[]>;

  beforeAll(() => {
    productionFiles = fs
      .readdirSync(DOMAIN_DIR)
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
      .sort();
    sourcesByFile = new Map(
      productionFiles.map((file) => {
        const source = fs.readFileSync(path.join(DOMAIN_DIR, file), 'utf8');
        return [file, extractImportSources(source)];
      }),
    );
  });

  it('contains exactly the planned pure domain owners', () => {
    expect(productionFiles).toEqual(EXPECTED_DOMAIN_FILES);
  });

  it('has readable, non-empty production files', () => {
    for (const file of productionFiles) {
      expect(fs.readFileSync(path.join(DOMAIN_DIR, file), 'utf8').length).toBeGreaterThan(0);
    }
  });

  for (const rule of FORBIDDEN_IMPORT_RULES) {
    it(`has zero ${rule.label} imports`, () => {
      const violations = [...sourcesByFile.entries()].flatMap(([file, sources]) =>
        sources.filter(rule.test).map((source) => `${file}: ${source}`),
      );
      expect(violations).toEqual([]);
    });
  }

  it('only imports relative pure-domain modules', () => {
    const unexpectedImports = [...sourcesByFile.entries()].flatMap(([file, sources]) =>
      sources.filter((source) => !source.startsWith('.')).map((source) => `${file}: ${source}`),
    );
    expect(unexpectedImports).toEqual([]);
  });
});
