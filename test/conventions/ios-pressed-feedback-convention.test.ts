import fs from 'node:fs';
import path from 'node:path';

const affectedFiles = [
  'src/components/forms/date-wheel-field.tsx',
  'src/features/settings/settings-menu.tsx',
  'src/features/settings/settings-screen.tsx',
] as const;

describe('iOS pressed feedback convention', () => {
  it.each(affectedFiles)('%s does not use a device-unsafe Pressable style callback', (file) => {
    const source = fs.readFileSync(path.join(__dirname, '../../', file), 'utf8');

    expect(source).not.toMatch(/style=\{\(\{\s*pressed/u);
  });
});
