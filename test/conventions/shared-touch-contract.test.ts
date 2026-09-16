import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SHARED_TOUCH_PATHS = [
  'src/components/ui/quantity-stepper.tsx',
  'src/components/ui/filter-chip-bar.tsx',
  'src/components/ui/inline-select.tsx',
  'src/constants/ui.tsx',
  'src/components/ui/header-icon-button.tsx',
];

describe('Shared-Touch-Vertrag', () => {
  it('verwendet keine geräteunsichere dynamische Pressed-Fläche', () => {
    const violations = SHARED_TOUCH_PATHS.flatMap((relativePath) => {
      const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
      return /style=\{\(\{\s*pressed/u.test(source) ? [relativePath] : [];
    });

    expect(violations).toEqual([]);
  });

  it('verwendet für FilterChipBar native Accessibility-Properties', () => {
    const source = fs.readFileSync(
      path.join(REPO_ROOT, 'src/components/ui/filter-chip-bar.tsx'),
      'utf8',
    );

    expect(source).not.toMatch(/\b(?:role|aria-label|aria-pressed)\s*=/u);
    expect(source).toMatch(/accessibilityRole="button"/u);
    expect(source).toMatch(/accessibilityState=\{\{\s*selected:/u);
  });
});
