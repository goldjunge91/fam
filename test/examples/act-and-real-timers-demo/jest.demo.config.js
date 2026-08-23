// Manuelle Referenz-Demos ausserhalb des regulaeren Testlaufs.
const base = require('../../../jest.config.js');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  rootDir: '../../..',
  testMatch: ['<rootDir>/test/examples/**/*.demo.tsx'],
  testPathIgnorePatterns: ['/node_modules/'],
};
