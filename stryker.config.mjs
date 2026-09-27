/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  testRunner: 'jest',
  plugins: ['@stryker-mutator/jest-runner'],
  coverageAnalysis: 'perTest',
  concurrency: 1,
  disableTypeChecks: false,
  timeoutMS: 30_000,
  ignorePatterns: [
    '**/.DS_Store',
    '.DS_Store',
    '.*/**',
    'android/**',
    'coverage/**',
    'docs/**',
    '.agents/**',
    '.claude/**',
    '.codex/**',
    '.gemini/**',
    'ios/**',
    'reports/**',
    'temp/**',
    'tools/**',
  ],
  // Zeilen 1543-1691 des Classifiers, nicht die ganze Datei: die Bereiche
  // 27-1542 sind Objekt- und Array-Literale mit knapp 1600 Zeilen
  // deklarierter Regeln. Dort steht kein einziges if, also entstuenden keine
  // Mutanten -- nur Laufzeit. Die Range enthaelt alle sechs if-Aussagen der
  // Datei und die dazugehoerigen Funktionen.
  mutate: [
    'src/lib/sync/backoff.ts:7-8',
    'src/features/auth/domain/auth-error-message.ts:20-25',
    'src/features/shopping-list/classification/placement-classifier.ts:1543-1691',
  ],
  testFiles: [
    'src/lib/sync/backoff.test.ts',
    'src/features/auth/domain/auth-error-message.test.ts',
    'src/features/shopping-list/classification/placement-classifier.test.ts',
  ],
  jest: {
    projectType: 'custom',
    configFile: 'jest.config.js',
    enableFindRelatedTests: true,
  },
  reporters: ['clear-text', 'json'],
  cleanTempDir: 'always',
  jsonReporter: {
    fileName: 'reports/mutation/mutation.json',
  },
  tempDirName: 'temp/stryker-mutation-pilot',
};

export default config;
