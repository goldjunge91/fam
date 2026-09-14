import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

describe('Theme-Owner-Farben Gate', () => {
  it('keeps SpeedDial UI colors out of the feature registry', () => {
    const source = readRepoFile('src/constants/feature-registry.ts');

    expect(source).not.toMatch(/backgroundColor\s*:\s*['"]#[0-9a-f]{6}['"]/iu);
    expect(source).toMatch(/background(?:Token|Key|Role)/u);
  });

  it('keeps domain palette ownership explicit and out of the global theme', () => {
    const ownerSources = [
      {
        path: 'src/features/shopping-list/domain-logik/store-presets.ts',
        marker: /Domain-Owner:\s*Store-Presets/iu,
      },
      {
        path: 'src/features/shopping-list/classification/placement-taxonomy.ts',
        marker: /Domain-Owner:\s*Placement-Taxonomie/iu,
      },
    ] as const;
    const themeSource = readRepoFile('src/components/theme/index.ts');

    for (const owner of ownerSources) {
      expect(readRepoFile(owner.path)).toMatch(owner.marker);
    }
    expect(themeSource).not.toMatch(/STORE_(?:PRESETS|COLOR_PALETTE)|PLACEMENT_ZONE_DEFINITIONS/iu);
  });

  it('documents the ownership boundary for SpeedDial and domain palettes', () => {
    const themeContract = readRepoFile('docs/design-system/contracts/01-theme-and-colors.md');
    const stylesheetContract = readRepoFile(
      'docs/design-system/contracts/05-unistyles-and-stylesheet.md',
    );

    expect(themeContract).toMatch(/SpeedDial/iu);
    expect(stylesheetContract).toMatch(/store-presets\.ts/iu);
    expect(stylesheetContract).toMatch(/placement-taxonomy\.ts/iu);
    expect(stylesheetContract).toMatch(/Domain-?Palett/iu);
  });
});
