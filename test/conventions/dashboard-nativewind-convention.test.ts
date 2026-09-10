import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const DASHBOARD_SURFACE_PATHS = [
  'src/features/dashboard',
  'src/app/(app)/_layout.tsx',
  'src/app/(app)/index.tsx',
  'src/components/layout/app-shell.tsx',
  'src/components/layout/screen.tsx',
  'src/components/layout/screen.android.tsx',
  'src/components/ui/buttons/profile-button.tsx',
  'src/components/ui/buttons/profile-button.android.tsx',
  'src/components/ui/buttons/floating-action-button.tsx',
  'src/features/navigation/navigation-drawer.tsx',
  'src/features/navigation/navigation-drawer.android.tsx',
  'src/features/navigation/speed-dial-menu.tsx',
];

function getSourceFiles(relativePath: string): string[] {
  const absolutePath = path.join(REPO_ROOT, relativePath);
  const stat = fs.statSync(absolutePath);

  if (stat.isFile()) return [absolutePath];

  return fs
    .readdirSync(absolutePath, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? getSourceFiles(path.join(relativePath, entry.name))
        : /\.(ts|tsx)$/.test(entry.name)
          ? [path.join(absolutePath, entry.name)]
          : [],
    );
}

describe('Dashboard-Styling-Konvention', () => {
  it('verwendet im Dashboard-Renderpfad kein NativeWind-Markup', () => {
    const violations = DASHBOARD_SURFACE_PATHS.flatMap((relativePath) =>
      getSourceFiles(relativePath).flatMap((filePath) => {
        const source = fs.readFileSync(filePath, 'utf8');
        return /\b(?:className|contentContainerClassName)\s*=|(?:from|import) ['"]nativewind(?:\/|['"])/.test(
          source,
        )
          ? [path.relative(REPO_ROOT, filePath)]
          : [];
      }),
    );

    expect(violations).toEqual([]);
  });
});
