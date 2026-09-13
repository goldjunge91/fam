import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SHARED_BUTTON_PATHS = [
  'src/components/ui/buttons/back-button.tsx',
  'src/components/ui/buttons/compact-action-button.tsx',
  'src/components/ui/buttons/floating-action-button.tsx',
  'src/components/ui/buttons/header-icon-button.tsx',
  'src/components/ui/buttons/profile-button.tsx',
  'src/components/ui/buttons/profile-button.android.tsx',
  'src/components/ui/buttons/menu-button.tsx',
];

describe('Shared-Button-Gerätegrenzen', () => {
  it('verwendet keine geräteunsicheren NativeWind- oder Pressable-Style-Grenzen', () => {
    const violations = SHARED_BUTTON_PATHS.flatMap((relativePath) => {
      const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
      const reasons = [
        /\b(?:className|contentContainerClassName)\s*=/u.test(source) ? 'NativeWind prop' : null,
        /style=\{\(\{\s*pressed/u.test(source) ? 'Pressable style callback' : null,
        /import\s+\{[^}]*\bStyleSheet\b[^}]*\}\s+from ['"]react-native['"]/u.test(source)
          ? 'React Native StyleSheet'
          : null,
      ].filter((reason): reason is string => reason !== null);

      return reasons.map((reason) => `${relativePath}: ${reason}`);
    });

    expect(violations).toEqual([]);
  });
});
