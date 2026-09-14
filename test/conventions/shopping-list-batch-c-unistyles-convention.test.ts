import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const SHOPPING_MODAL_CONSUMERS = [
  'src/features/shopping-list/modals/add-item-modal.tsx',
  'src/features/shopping-list/modals/edit-item-modal.tsx',
  'src/features/shopping-list/modals/item-modal-shell.tsx',
  'src/features/shopping-list/modals/move-items-modal.tsx',
] as const;

describe('fam-978.61 shopping list modals', () => {
  it('uses Unistyles without active NativeWind APIs or device-unsafe Pressable styles', () => {
    const violations = SHOPPING_MODAL_CONSUMERS.flatMap((relativePath) => {
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

  it('keeps modal actions on the shared UI owners', () => {
    const moveModalSource = fs.readFileSync(
      path.join(REPO_ROOT, 'src/features/shopping-list/modals/move-items-modal.tsx'),
      'utf8',
    );

    expect(moveModalSource).toContain("from '@/constants/ui'");
    expect(moveModalSource).toMatch(/\bCloseButton\b/u);
    expect(moveModalSource).toMatch(/\bPress\b/u);
    expect(moveModalSource).toMatch(/\bSurface\b/u);

    for (const relativePath of SHOPPING_MODAL_CONSUMERS) {
      const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
      expect(source).toContain("from 'react-native-unistyles'");
      expect(source).toMatch(/StyleSheet\.create\(\s*\(theme\)/u);
    }
  });
});
