import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const SHOPPING_CONSUMERS = [
  'src/features/shopping-list/components/ui/row-store-picker.tsx',
  'src/features/shopping-list/components/ui/store-picker-menu.tsx',
  'src/features/shopping-list/components/ui/store-summary-card.tsx',
  'src/features/shopping-list/components/ui/total-estimate-card.tsx',
  'src/features/shopping-list/forms/add-item-form.tsx',
] as const;

const UNISTYLES_CONSUMERS = SHOPPING_CONSUMERS.slice(0, 4);

describe('fam-978.45 shopping list consumers', () => {
  it('contains no active NativeWind or device-unsafe Pressable styling', () => {
    const violations = SHOPPING_CONSUMERS.flatMap((relativePath) => {
      const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
      const reasons = [
        /\b(?:className|contentContainerClassName)\b/u.test(source) ? 'NativeWind prop' : null,
        /from ['"]nativewind(?:\/|['"])/u.test(source) ? 'NativeWind import' : null,
        /style=\{\(\{\s*pressed/u.test(source) ? 'Pressable style callback' : null,
        /import\s+\{[^}]*\bStyleSheet\b[^}]*\}\s+from ['"]react-native['"]/u.test(source)
          ? 'React Native StyleSheet'
          : null,
      ].filter((reason): reason is string => reason !== null);

      return reasons.map((reason) => `${relativePath}: ${reason}`);
    });

    expect(violations).toEqual([]);
  });

  it('keeps local style owners on the Unistyles v3 path', () => {
    for (const relativePath of UNISTYLES_CONSUMERS) {
      const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');

      expect(source).toContain("from 'react-native-unistyles'");
      expect(source).toMatch(/StyleSheet\.create\(\s*\(theme\)/u);
    }

    const formSource = fs.readFileSync(
      path.join(REPO_ROOT, 'src/features/shopping-list/forms/add-item-form.tsx'),
      'utf8',
    );
    expect(formSource).toContain('useThemedStyles(makeShoppingListStyles)');
  });
});
