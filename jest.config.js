/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/test/setup.js'],
  maxWorkers: '10%',

  // Verhindert native Worklets-Imports im Jest-Prozess.
  resolver: '<rootDir>/node_modules/react-native-worklets/jest/resolver.js',

  // Diese React-Native-/Expo-Abhaengigkeiten liefern unkompiliertes ESM aus.
  transformIgnorePatterns: [
    'node_modules/(?!(.bun|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/.*|native-base|react-native-svg|react-native-purchases-ui|@revenuecat/.*|standard-navigation))',
  ],

  // Deckt Suiten mit echten Timern unter paralleler Last ab.
  testTimeout: 15000,

  // Die spezifische Asset-Regel muss vor dem allgemeinen Alias stehen.
  moduleNameMapper: {
    '\\.css$': '<rootDir>/test/css-module.js',
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    // Offizielles Mock fuer das native Keyboard-Modul.
    '^react-native-keyboard-controller$':
      '<rootDir>/node_modules/react-native-keyboard-controller/jest',
  },

  testMatch: ['**/*.test.ts', '**/*.test.tsx'],

  // Integrationstests laufen separat gegen die lokale Supabase-Instanz.
  testPathIgnorePatterns: ['/node_modules/', '\\.integration\\.test\\.tsx?$'],

  // Coverage bleibt dem gezielten `test:coverage`-Lauf vorbehalten.
  collectCoverage: false,
};
