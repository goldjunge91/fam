/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/test/setup.js'],
  maxWorkers: '10%',

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
  // `@sentry/.*` statt nur `@sentry/react-native`: das SDK zieht `@sentry/core`
  // (und weitere `@sentry/*`-Pakete) als unkompiliertes ESM nach, ein zu enges
  // Muster bricht jeden Test, der (auch nur transitiv, z. B. ueber
  // `lib/sentry.ts`) `@sentry/react-native` importiert.
  transformIgnorePatterns: [
    'node_modules/(?!(.bun|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/.*|native-base|react-native-svg|react-native-purchases-ui|@revenuecat/.*|standard-navigation|@aptabase/.*))',
  ],

  // Default (5000ms) ist zu knapp fuer Tests mit echten Timern/Intervallen
  // (z. B. PendingAuthBanner pollt alle 3s) sobald alle Suiten gemeinsam um
  // CPU konkurrieren statt einzeln zu laufen — beobachtet beim vollen
  // `bun run test` unter Last, nicht bei isolierten Laeufen.
  testTimeout: 15000,
  
  // Spiegelt die Pfad-Aliase aus tsconfig.json. Die spezifischere
  // `@/assets/`-Regel muss vor `@/` stehen, sonst greift sie nie.
  moduleNameMapper: {
    // CSS ist fuer den Test-Runner kein JavaScript — siehe test/css-module.js.
    '\\.css$': '<rootDir>/test/css-module.js',
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    // Offizielles Jest-Mock des Pakets — ohne das schlaegt jeder Test fehl,
    // der (auch nur transitiv) react-native-keyboard-controller importiert,
    // mit "doesn't seem to be linked" (das native Modul existiert unter Jest
    // nicht).
    '^react-native-keyboard-controller$':
      '<rootDir>/node_modules/react-native-keyboard-controller/jest',
  },

  testMatch: ['**/*.test.ts', '**/*.test.tsx'],

  // Integrationstests sind bewusst ausgeschlossen: Sie brauchen eine laufende
  // lokale Supabase-Instanz. Ein Standard-Testlauf, der ohne externe Dienste
  // nicht durchlaeuft, wird irgendwann uebersprungen statt repariert.
  // Sie laufen ueber `bun run test:integration` (jest.integration.config.js).
  //
  // `.bun.test.ts` ebenfalls ausgeschlossen: Jest laeuft unter Node, `import
  // 'bun:sqlite'` schlaegt dort mit "Cannot find module" fehl — das Modul
  // existiert nur im echten Bun-Runtime-Prozess. Betroffene Dateien
  // (scripts/dump_data/*.bun.test.ts) laufen stattdessen ueber
  // `bun run test:dump-pipeline` (Buns eigener Testrunner, siehe
  // scripts/dump_data/README.md).
  // Das eigenstaendige Category Lab ist eine Vite/Vitest-Anwendung mit
  // eigenem `bun run test`. Jest Expo darf seine ESM/Vitest-Suiten nicht als
  // React-Native-Tests einsammeln.
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tools/category-debugger/',
    '\\.integration\\.test\\.tsx?$',
    '\\.bun\\.test\\.ts$',
  ],

  // Bewusst nicht standardmaessig an: Instrumentierung kostet auf jedem Lauf
  // ~2x Laufzeit. Fuer gezielte Coverage-Reports gibt es `bun run test:coverage`.
  collectCoverage: false,
};
