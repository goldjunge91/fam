// Nur zum manuellen Ausfuehren dieser Referenz-Demos gedacht (siehe
// README.md in diesem Ordner). Nicht Teil von `bun run test`/CI: Der
// Standard-`testMatch` in jest.config.js greift nur `*.test.ts(x)`, diese
// Dateien heissen bewusst `*.demo.tsx`.
const base = require('../../../jest.config.js');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  rootDir: '../../..',
  testMatch: ['<rootDir>/test/examples/**/*.demo.tsx'],
  testPathIgnorePatterns: ['/node_modules/'],
};
