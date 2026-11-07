import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const CHEF_KOCH_SURFACES = [
  'src/features/chef-koch/components/chef-koch-dashboard-card.tsx',
  'src/features/chef-koch/components/chef-koch-entry.tsx',
  'src/features/chef-koch/components/recipe-suggestion-detail.tsx',
  'src/features/chef-koch/components/recipe-suggestion-results.tsx',
  'src/features/chef-koch/screens/chef-koch-screen.tsx',
  'src/features/chef-koch/screens/chef-history-screen.tsx',
  'src/features/chef-koch/screens/chef-history-detail-screen.tsx',
] as const;

const HISTORY_LIST_SURFACES = [
  'src/features/chef-koch/screens/chef-history-screen.tsx',
  'src/features/chef-koch/screens/chef-history-detail-screen.tsx',
] as const;

const CHEF_KOCH_ROUTES = [
  'src/app/chef-koch.tsx',
  'src/app/chef-koch-history/index.tsx',
  'src/app/chef-koch-history/[id].tsx',
] as const;

function sourceOf(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

describe('Chef-Koch UI styling convention', () => {
  it('keeps feature surfaces on Unistyles and the shared UI boundary', () => {
    const violations = CHEF_KOCH_SURFACES.flatMap((relativePath) => {
      const source = sourceOf(relativePath);
      const invalidStyleImport =
        /import\s+\{[^}]*\bStyleSheet\b[^}]*\}\s+from\s+['"]react-native['"]/u.test(source);
      const invalidNativeWind =
        /\b(?:className|contentContainerClassName)\s*=|from ['"]nativewind(?:\/|['"])/u.test(
          source,
        );
      const missingUnistyles = !source.includes("from 'react-native-unistyles'");
      const missingSharedUi = !source.includes("from '@/constants/ui'");

      return invalidStyleImport || invalidNativeWind || missingUnistyles || missingSharedUi
        ? [relativePath]
        : [];
    });

    expect(violations).toEqual([]);
  });

  it('uses FlashList for History surfaces and never reintroduces FlatList', () => {
    for (const relativePath of HISTORY_LIST_SURFACES) {
      const source = sourceOf(relativePath);
      expect(source).toContain("from '@shopify/flash-list'");
      expect(source).not.toMatch(/\bFlatList\b/u);
    }
  });
});

describe('Chef-Koch route convention', () => {
  it('keeps route files thin and delegates rendering to feature screens', () => {
    for (const relativePath of CHEF_KOCH_ROUTES) {
      const source = sourceOf(relativePath);
      expect(source).not.toContain("from 'react-native'");
      expect(source).not.toContain("from 'react-native-unistyles'");
      expect(source).not.toMatch(/StyleSheet\.(create|configure)/u);
    }

    expect(sourceOf(CHEF_KOCH_ROUTES[0])).toContain('ChefKochScreen');
    expect(sourceOf(CHEF_KOCH_ROUTES[1])).toContain('ChefHistoryScreen');
    expect(sourceOf(CHEF_KOCH_ROUTES[2])).toContain('ChefHistoryDetailScreen');
  });
});
