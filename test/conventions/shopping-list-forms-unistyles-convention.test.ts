import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const SHOPPING_FORM_CONSUMERS = [
  'src/features/shopping-list/forms/edit-item-form.tsx',
  'src/features/shopping-list/forms/placement-zone-field.tsx',
  'src/features/shopping-list/forms/shopping-product-suggestions.tsx',
  'src/features/shopping-list/forms/store-picker-field.tsx',
] as const;

describe('fam-978.46 shopping list forms', () => {
  it('uses Unistyles and the canonical Press boundary without NativeWind', () => {
    for (const relativePath of SHOPPING_FORM_CONSUMERS) {
      const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');

      expect(source).not.toMatch(/\b(?:className|contentContainerClassName)\b/u);
      expect(source).not.toMatch(/from ['"]nativewind(?:\/|['"])/u);
      expect(source).not.toMatch(
        /import\s+\{[^}]*\bStyleSheet\b[^}]*\}\s+from ['"]react-native['"]/u,
      );
      expect(source).not.toMatch(
        /import\s+\{[^}]*\bPressable\b[^}]*\}\s+from ['"]react-native['"]/u,
      );
      expect(source).toMatch(/from ['"]@\/constants\/ui['"]/u);
      expect(source).toMatch(/\bPress\b/u);
      expect(source).not.toMatch(/style=\{\(\{\s*pressed/u);
    }

    const sharedStyles = fs.readFileSync(
      path.join(REPO_ROOT, 'src/features/shopping-list/components/ui/shopping-list-styles.ts'),
      'utf8',
    );
    expect(sharedStyles).toContain("from 'react-native-unistyles'");
  });
});
