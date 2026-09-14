import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

describe('Unistyles Expo entry convention', () => {
  it('imports the Unistyles configuration before Expo Router', () => {
    const source = fs.readFileSync(path.join(REPO_ROOT, 'src/index.ts'), 'utf8');
    const configImport = source.indexOf("import './components/theme/index';");
    const routerImport = source.indexOf("import 'expo-router/entry';");

    expect(configImport).toBeGreaterThanOrEqual(0);
    expect(routerImport).toBeGreaterThan(configImport);
  });

  it('loads the Unistyles Jest mock before the app configuration', () => {
    const source = fs.readFileSync(path.join(REPO_ROOT, 'jest.config.js'), 'utf8');
    const mocksEntry = source.indexOf("'react-native-unistyles/mocks'");
    const configEntry = source.indexOf("'<rootDir>/src/components/theme/index.ts'");

    expect(mocksEntry).toBeGreaterThanOrEqual(0);
    expect(configEntry).toBeGreaterThan(mocksEntry);
  });

  it('enables Unistyles debug through Babel development mode', () => {
    const source = fs.readFileSync(path.join(REPO_ROOT, 'babel.config.js'), 'utf8');

    expect(source).toContain("const isDevelopment = api.env('development');");
    expect(source).toContain('debug: isDevelopment');
  });
});
