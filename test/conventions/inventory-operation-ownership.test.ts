/**
 * Architectural Ownership Gate — inventory-lifecycle.ts
 *
 * Enforces CONSTRAINTS.md §"Harte Grundsätze" and §I3 (pure planning, no side
 * effects): the lifecycle module must remain a pure-logic owner with zero
 * coupling to React, native modules, databases, network, sync or outbox layers.
 *
 * NOTE: biome.json currently only covers `src/**` and `scripts/**`, NOT
 * `test/conventions/**`. This file is therefore NOT lint-checked by the
 * standard `bun run check` invocation. This limitation is documented per
 * CONSTRAINTS.md §"Qualitätsgrenzen und Nachweise" and should be addressed
 * in a future increment that extends biome.json scope.
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LIFECYCLE_PATH = path.join(
  REPO_ROOT,
  'src',
  'features',
  'inventory',
  'inventory-lifecycle.ts',
);

/**
 * Extracts import sources from TypeScript source using regex.
 * Handles: import ... from 'module', import 'module', require('module'),
 * import('module'), export ... from 'module'.
 */
function matchesOf(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

function extractImportSources(source: string): string[] {
  return [
    // Static imports/exports: import ... from 'x' / export ... from 'x'
    ...matchesOf(source, /(?:^|\n)\s*(?:import|export)\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g),
    // Bare imports: import 'x'
    ...matchesOf(source, /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g),
    // Dynamic imports: import('x')
    ...matchesOf(source, /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
    // require('x')
    ...matchesOf(source, /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
  ];
}

/**
 * Forbidden import patterns for inventory-lifecycle.ts.
 *
 * Each entry has a label (for error messages) and a test function.
 * `@/lib/inventory-quantity` and the shared inventory lifecycle Zod module are
 * explicitly allowed for this owner per CONSTRAINTS.md.
 */
const FORBIDDEN_IMPORT_RULES: Array<{
  label: string;
  test: (source: string) => boolean;
}> = [
  {
    label: 'react',
    test: (s) => s === 'react' || s.startsWith('react/'),
  },
  {
    label: 'react-native',
    test: (s) =>
      s === 'react-native' || s.startsWith('react-native/') || s.startsWith('react-native-'),
  },
  {
    label: 'expo-sqlite',
    test: (s) => s === 'expo-sqlite' || s.startsWith('expo-sqlite/'),
  },
  {
    label: 'drizzle-orm',
    test: (s) => s === 'drizzle-orm' || s.startsWith('drizzle-orm/'),
  },
  {
    label: '@/lib/db/*',
    test: (s) => s.startsWith('@/lib/db/') || s.startsWith('@/lib/db'),
  },
  {
    label: '@supabase/*',
    test: (s) => s.startsWith('@supabase/') || s === '@supabase',
  },
  {
    label: 'supabase',
    test: (s) => s === 'supabase' || s.startsWith('supabase/'),
  },
  {
    label: '@/lib/sync/*',
    test: (s) => s.startsWith('@/lib/sync/') || s.startsWith('@/lib/sync'),
  },
  {
    label: '@/lib/db/outbox*',
    // Already covered by @/lib/db/* above, but made explicit for clarity.
    test: (s) => s.startsWith('@/lib/db/outbox'),
  },
];

/**
 * The single allowed exception: inventory-quantity is a pure-logic utility
 * that the lifecycle module legitimately depends on.
 */
function isAllowedImport(source: string): boolean {
  return (
    source === '@/lib/db/zod/inventory-lifecycle.zod' ||
    source === '@/lib/inventory-quantity' ||
    source.startsWith('@/lib/inventory-quantity/')
  );
}

describe('Inventory Operation Ownership Gate', () => {
  let source: string;
  let importSources: string[];

  beforeAll(() => {
    source = fs.readFileSync(LIFECYCLE_PATH, 'utf-8');
    importSources = extractImportSources(source);
  });

  it('source file exists and is non-empty', () => {
    expect(source.length).toBeGreaterThan(0);
  });

  it('has at least one import (sanity check for extraction)', () => {
    expect(importSources.length).toBeGreaterThan(0);
  });

  describe('forbidden imports', () => {
    for (const rule of FORBIDDEN_IMPORT_RULES) {
      it(`has ZERO imports from ${rule.label}`, () => {
        const violations = importSources.filter((s) => rule.test(s) && !isAllowedImport(s));
        expect(violations).toEqual([]);
      });
    }
  });

  it('only imports from allowed modules', () => {
    // Positive allowlist: only these module prefixes/patterns are permitted.
    // This catches any new forbidden dependency that slips past the explicit
    // deny-list above.
    const ALLOWED_MODULE_PATTERNS = [
      // Relative imports within the feature (e.g. ./opened-expiry)
      (s: string) => s.startsWith('.'),
      // The explicitly allowed shared validation and quantity imports
      (s: string) => isAllowedImport(s),
    ];

    const unexpectedImports = importSources.filter(
      (s) => !ALLOWED_MODULE_PATTERNS.some((check) => check(s)),
    );

    expect(unexpectedImports).toEqual([]);
  });

  describe('schema boundary', () => {
    it('uses the shared inventory lifecycle Zod module', () => {
      expect(importSources).toContain('@/lib/db/zod/inventory-lifecycle.zod');
    });

    it('does not define inline Zod schemas or inferred types', () => {
      expect(source).not.toMatch(/(?:^|\n)\s*import\s+.*from\s+['"]zod['"]/);
      expect(source).not.toMatch(/\bz\.(?:object|strictObject|union|discriminatedUnion|infer)\b/);
    });
  });

  describe('no unauthorized production structure', () => {
    it('no Command directory exists under src/features/inventory/', () => {
      const inventoryDir = path.join(REPO_ROOT, 'src', 'features', 'inventory');
      const entries = fs.readdirSync(inventoryDir, { withFileTypes: true });
      const commandDirs = entries.filter((e) => e.isDirectory() && /^command/i.test(e.name));
      expect(commandDirs.map((d) => d.name)).toEqual([]);
    });

    it('no Contract module pattern exists under src/features/inventory/', () => {
      const inventoryDir = path.join(REPO_ROOT, 'src', 'features', 'inventory');
      const entries = fs.readdirSync(inventoryDir, { withFileTypes: true });

      // A "Contract module" would be a separate file whose name suggests it
      // duplicates the lifecycle contract's responsibility.
      const contractFiles = entries.filter(
        (e) => !e.isDirectory() && /contract/i.test(e.name) && /\.(ts|tsx|js|jsx)$/.test(e.name),
      );
      expect(contractFiles.map((f) => f.name)).toEqual([]);
    });

    it('no new operation-* or command-* production files under src/features/inventory/', () => {
      const inventoryDir = path.join(REPO_ROOT, 'src', 'features', 'inventory');
      const entries = fs.readdirSync(inventoryDir, { withFileTypes: true });

      const operationFiles = entries.filter(
        (e) =>
          !e.isDirectory() &&
          /^(operation|command)-/i.test(e.name) &&
          /\.(ts|tsx|js|jsx)$/.test(e.name) &&
          !e.name.includes('.test.'),
      );
      expect(operationFiles.map((f) => f.name)).toEqual([]);
    });
  });
});
