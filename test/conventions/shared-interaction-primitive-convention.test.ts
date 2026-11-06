import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_ROOTS = ['src/app', 'src/components', 'src/features'];
const NATIVE_INTERACTION_EXCEPTIONS = {
  'src/components/ui/glass-card.tsx': {
    jsxCount: 2,
    importCount: 1,
    reason: 'Native interaction exception: keep Pressable at the GlassView boundary.',
  },
} as const;

function collectTypeScriptFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory()
      ? collectTypeScriptFiles(absolutePath)
      : absolutePath.endsWith('.tsx')
        ? [absolutePath]
        : [];
  });
}

describe('Shared interaction primitive', () => {
  it('routes product interactions through Press or a documented native boundary', () => {
    const files = SOURCE_ROOTS.flatMap((sourceRoot) =>
      collectTypeScriptFiles(path.join(REPO_ROOT, sourceRoot)),
    )
      .filter((filePath) => !/\.(?:test|spec)\.tsx$/u.test(filePath))
      .filter((filePath) => !filePath.includes(`${path.sep}settings${path.sep}dev${path.sep}`))
      // Press owns the single React Native Pressable implementation.
      .filter((filePath) => !filePath.endsWith(`${path.sep}constants${path.sep}ui.tsx`))
      .map((filePath) => ({
        filePath,
        relativePath: path.relative(REPO_ROOT, filePath),
        source: fs.readFileSync(filePath, 'utf8'),
      }));
    const violations = files.flatMap(({ relativePath, source }) => {
      const jsxCount = [...source.matchAll(/<\s*(?:Pressable|TouchableOpacity)\b/gu)].length;
      const importCount = [
        ...source.matchAll(
          /import\s*\{[^}]*\b(?:Pressable|TouchableOpacity)\b[^}]*\}\s*from\s*['"]react-native['"]/gu,
        ),
      ].length;
      if (jsxCount === 0 && importCount === 0) return [];

      const exception =
        NATIVE_INTERACTION_EXCEPTIONS[relativePath as keyof typeof NATIVE_INTERACTION_EXCEPTIONS];
      if (
        exception &&
        jsxCount === exception.jsxCount &&
        importCount === exception.importCount &&
        source.includes(exception.reason)
      ) {
        return [];
      }

      return [`${relativePath}: ${jsxCount} JSX controls, ${importCount} native imports`];
    });

    expect(violations).toEqual([]);
  });
});
