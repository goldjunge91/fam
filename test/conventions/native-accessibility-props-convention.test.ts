import fs from 'node:fs';
import path from 'node:path';

const sourceRoots = ['src/components', 'src/features'] as const;

function collectProductComponents(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (filePath.split(path.sep).includes('dev')) return [];
      return collectProductComponents(filePath);
    }

    return entry.isFile() && entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')
      ? [filePath]
      : [];
  });
}

describe('native accessibility prop convention', () => {
  it('product components use React Native accessibility props', () => {
    const files = sourceRoots.flatMap((root) =>
      collectProductComponents(path.join(__dirname, '../../', root)),
    );
    const violations = files.flatMap((file) => {
      const source = fs.readFileSync(file, 'utf8');
      return /\s(?:role|aria-[\w-]+)(?:\s*=|\s|>)/u.test(source)
        ? [path.relative(path.join(__dirname, '../../'), file)]
        : [];
    });

    expect(violations).toEqual([]);
  });
});
