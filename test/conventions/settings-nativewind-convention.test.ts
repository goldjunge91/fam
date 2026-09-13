import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const SETTINGS_CONSUMERS = [
  'src/features/settings/dev/design-system/showcase-patterns.tsx',
  'src/features/settings/dev/dev-tools-screen.android.tsx',
  'src/features/settings/dev/dev-tools-screen.tsx',
  'src/features/settings/export-screen.tsx',
] as const;

describe('fam-978.42 settings consumers', () => {
  it('uses Unistyles without NativeWind or React Native StyleSheet imports', () => {
    for (const relativePath of SETTINGS_CONSUMERS) {
      const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');

      expect(source).toContain("from 'react-native-unistyles'");
      expect(source).toContain('StyleSheet.create(');
      expect(source).not.toMatch(/\b(?:className|contentContainerClassName)\b/u);
      expect(source).not.toMatch(/from ['"]nativewind(?:\/|['"])/u);
      expect(source).not.toMatch(
        /import\s+\{[^}]*\bStyleSheet\b[^}]*\}\s+from ['"]react-native['"]/u,
      );
    }
  });
});
