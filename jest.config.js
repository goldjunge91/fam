/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',

  // Spiegelt die Pfad-Aliase aus tsconfig.json. Die spezifischere
  // `@/assets/`-Regel muss vor `@/` stehen, sonst greift sie nie.
  moduleNameMapper: {
    // CSS ist fuer den Test-Runner kein JavaScript — siehe test/css-module.js.
    '\\.css$': '<rootDir>/test/css-module.js',
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  testMatch: ['**/*.test.ts', '**/*.test.tsx'],

  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}', '!src/components/ui/**'],
};
