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
  mutate: [
    'src/lib/sync/backoff.ts:7-8',
    'src/features/auth/domain/auth-error-message.ts:20-25',
  ],
  testFiles: [
    'src/lib/sync/backoff.test.ts',
    'src/features/auth/domain/auth-error-message.test.ts',
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
