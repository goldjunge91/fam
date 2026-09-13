import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

describe('Unistyles Expo entry convention', () => {
  it('imports the Unistyles configuration before Expo Router', () => {
    const source = fs.readFileSync(path.join(REPO_ROOT, 'index.ts'), 'utf8');
    const configImport = source.indexOf("import './src/components/theme/index';");
    const routerImport = source.indexOf("import 'expo-router/entry';");

    expect(configImport).toBeGreaterThanOrEqual(0);
    expect(routerImport).toBeGreaterThan(configImport);
  });
});
