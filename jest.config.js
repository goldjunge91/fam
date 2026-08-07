/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/test/setup.js'],

  // Spiegelt die Pfad-Aliase aus tsconfig.json. Die spezifischere
  // `@/assets/`-Regel muss vor `@/` stehen, sonst greift sie nie.
  moduleNameMapper: {
    // CSS ist fuer den Test-Runner kein JavaScript — siehe test/css-module.js.
    '\\.css$': '<rootDir>/test/css-module.js',
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  testMatch: ['**/*.test.ts', '**/*.test.tsx'],

  // Integrationstests sind bewusst ausgeschlossen: Sie brauchen eine laufende
  // lokale Supabase-Instanz. Ein Standard-Testlauf, der ohne externe Dienste
  // nicht durchlaeuft, wird irgendwann uebersprungen statt repariert.
  // Sie laufen ueber `bun run test:integration` (jest.integration.config.js).
  testPathIgnorePatterns: ['/node_modules/', '\\.integration\\.test\\.tsx?$'],

  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/components/ui/**',
    // Generiert aus dem DB-Schema, nicht von Hand gepflegt.
    '!src/lib/database.types.ts',
  ],
};
