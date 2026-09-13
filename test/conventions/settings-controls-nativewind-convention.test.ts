import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const SETTINGS_CONTROLS = [
  'src/features/settings/meal-planner-settings-screen.tsx',
  'src/features/settings/module-settings-screen.tsx',
  'src/features/settings/notification-settings-card.tsx',
  'src/features/settings/permission-card.tsx',
  'src/features/settings/permissions-screen.tsx',
] as const;

describe('fam-978.43 settings controls', () => {
  it('uses Unistyles without NativeWind or React Native StyleSheet imports', () => {
    for (const relativePath of SETTINGS_CONTROLS) {
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
