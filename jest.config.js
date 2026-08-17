/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/test/setup.js'],

  // Ohne diesen Resolver landet `react-native-reanimated/mock` (ueber
  // `react-native-worklets`) trotzdem bei den `.native.ts`-Dateien und damit
  // beim echten nativen Worklets-Modul, das es unter Jest nicht gibt (#129,
  // erster Reanimated/Gesture-Handler-Import im Testcode). Der von
  // react-native-worklets mitgelieferte Resolver filtert `.native`-Varianten
  // ausschliesslich fuer dieses Paket heraus.
  resolver: '<rootDir>/node_modules/react-native-worklets/jest/resolver.js',

  // Preset default nur (jest-)?react-native|@react-native(-community)? —
  // deckt Expo-Pakete und react-native-svg nicht ab, die unkompiliertes
  // ESM ausliefern. `react-native-purchases-ui` zieht `@revenuecat/*` als
  // unkompiliertes ESM nach (Hybrid-Mappings fuer die Web-Zielplattform).
  // `standard-navigation` ist eine neue Transitiv-Abhaengigkeit von
  // `expo-router` (`useNavigation`-Export) — ohne sie in der Liste bricht
  // jeder Test, der `expo-router` nicht per `jest.mock()` ersetzt und
  // stattdessen (auch nur transitiv, z. B. ueber `AutoBackButton`) echtes
  // `useNavigation` importiert: "Cannot use import statement outside a module".
  transformIgnorePatterns: [
    'node_modules/(?!(.bun|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|react-native-purchases-ui|@revenuecat/.*|standard-navigation))',
  ],

  // Default (5000ms) ist zu knapp fuer Tests mit echten Timern/Intervallen
  // (z. B. PendingAuthBanner pollt alle 3s) sobald alle Suiten gemeinsam um
  // CPU konkurrieren statt einzeln zu laufen — beobachtet beim vollen
  // `bun run test` unter Last, nicht bei isolierten Laeufen.
  testTimeout: 15000,

  // Default (numCPUs - 1, hier 7) laesst Suiten mit echten Timern/Intervallen
  // (z. B. PendingAuthBanner) unter voller CPU-Konkurrenz an testTimeout
  // reissen. Weniger parallele Worker halten die Wall-Clock-Zeit pro Test
  // naeher an der isolierten Laufzeit, auf Kosten der Gesamtlaufzeit.
  maxWorkers: '50%',

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

  // Bewusst nicht standardmaessig an: Instrumentierung kostet auf jedem Lauf
  // Zeit (Default-`test`, Pre-Commit-Hook, CI-Checks-Job). Wer den Bericht
  // braucht, ruft `bun run test:coverage` auf.
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/components/ui/**',
    // Generiert aus dem DB-Schema, nicht von Hand gepflegt.
    '!src/lib/database.types.ts',
  ],
};
