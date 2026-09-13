import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const SETTINGS_SYNC_CONSUMERS = [
  'src/features/settings/privacy-screen.tsx',
  'src/features/settings/sync-debug-screen.tsx',
  'src/features/settings/sync-settings-screen.tsx',
] as const;

describe('fam-978.44 settings consumers', () => {
  it('uses Unistyles without NativeWind or React Native StyleSheet imports', () => {
    for (const relativePath of SETTINGS_SYNC_CONSUMERS) {
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
