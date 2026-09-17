import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const SETTINGS_CONSUMERS = [
  'src/features/settings/dev/design-system/showcase-patterns.tsx',
  'src/features/settings/dev/design-system/showcase-reanimated.tsx',
  'src/features/settings/dev/design-system/showcase-modals.tsx',
  'src/features/settings/dev/design-system/showcase-modal-content.tsx',
  'src/features/settings/dev/design-system/showcase-modal-swift-ui.tsx',
  'src/features/settings/dev/design-system/showcase-modal-swift-ui.ios.tsx',
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

describe('design-system showcase categories', () => {
  it('registers the Reanimated lab', () => {
    const source = fs.readFileSync(
      path.join(REPO_ROOT, 'src/features/settings/dev/design-system/design-system-screen.tsx'),
      'utf8',
    );

    expect(source).toContain("{ value: 'reanimated', label: 'Reanimated' }");
    expect(source).toContain("{ value: 'modal-comparison', label: 'Modale' }");
    expect(source).toContain('<ReanimatedShowcase />');
    expect(source).toContain('<ModalsShowcase />');
  });
});

describe('Reanimated showcase motion profiles', () => {
  it('keeps Spring, Timing and Sequence visibly distinct', () => {
    const source = fs.readFileSync(
      path.join(REPO_ROOT, 'src/features/settings/dev/design-system/showcase-reanimated.tsx'),
      'utf8',
    );

    expect(source).toContain('withSpring(1.18');
    expect(source).toContain('withTiming(0.78, { duration: 180 })');
    expect(source).toContain('withTiming(1.2, { duration: 90 })');
    expect(source).toContain('scale.value = 1;');
  });
});
