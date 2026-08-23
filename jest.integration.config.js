/** Integrationstests mit Node-Fetch gegen die lokale Supabase-Instanz. @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',

  // `babel-preset-expo` wuerde den unnoetigen Node-inompatiblen `expo/virtual/env` importieren.
  transform: {
    '^.+\\.[jt]sx?$': [
      'babel-jest',
      {
        presets: [['@babel/preset-typescript', { isTSX: true, allExtensions: true }]],
        // Jest laedt die transformierten Dateien als CommonJS.
        plugins: ['@babel/plugin-transform-modules-commonjs'],
      },
    ],
  },

  moduleNameMapper: {
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  transformIgnorePatterns: [
    'node_modules/(?!(.bun|expo|@expo)/)',
  ],

  testMatch: ['**/*.integration.test.ts', '**/*.integration.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/'],
  setupFiles: ['<rootDir>/test/setup-integration.js'],

  // Lokales Docker und Passwort-Hashing brauchen mehr als Jests Standardtimeout.
  testTimeout: 30_000,

  // Alle Suiten teilen sich einen Postgres- und Realtime-Stack.
  maxWorkers: 2,
};
