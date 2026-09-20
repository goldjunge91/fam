const path = require('node:path');

const setupFiles = [
  '<rootDir>/test/setup.js',
  // Unistyles v3 stubs — muss vor der App-Konfiguration stehen,
  // damit StyleSheet.configure in theme/index.ts auf den Mock trifft.
  'react-native-unistyles/mocks',
  '<rootDir>/src/components/theme/index.ts',
];

const sourceSetupFiles = setupFiles
  .filter((file) => file.startsWith('<rootDir>/src/'))
  .map((file) => path.join(__dirname, file.replace('<rootDir>/', '')));

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles,
  setupFilesAfterEnv: ['<rootDir>/test/setup-after-env.js'],
  // React-Native/Babel-Worker sind speicherintensiv. Vier parallele Worker
  // erzeugen im Gesamtlauf GC-/CPU-Konkurrenz und dadurch falsche 15s-Timeouts.
  maxWorkers: 2,

  // Watchman kann in der Codex-Ausfuehrungsumgebung seinen State-Ordner nicht
  // per fchmod auf 2700 setzen. Metro/Expo darf Watchman weiterhin verwenden.
  watchman: false,

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
    'node_modules/(?!(.bun|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/.*|native-base|react-native-svg|react-native-purchases-ui|@revenuecat/.*|standard-navigation|@aptabase/.*|react-native-google-mobile-ads|react-native-unistyles|react-native-nitro-modules))',
  ],

  // Default (5000ms) ist zu knapp fuer Tests mit echten Timern/Intervallen
  // (z. B. der E-Mail-Verifizierungs-Flow pollt alle 3s) sobald alle Suiten gemeinsam um
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
    '^react-native-google-mobile-ads$': '<rootDir>/test/admob-mock.js',
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
  // Die eigenstaendigen Tools sind eigene Node-/Vite-Anwendungen mit jeweils
  // eigenem Test-Runner. Jest Expo darf ihre Suiten nicht als
  // React-Native-Tests einsammeln.
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tools/',
    '\\.integration\\.test\\.tsx?$',
    '\\.bun\\.test\\.ts$',
    // Die UI-freien Native-Speech-Runner sind Jest-Suiten und werden bewusst
    // über denselben fokussierten `bun run test <datei>`-Pfad verifiziert.
    // Andere eigenständige Host-/Bun-Tools bleiben aus der Expo-Suite heraus.
    '/scripts/(?!speech-native-[^/]+\\.test\\.ts$)',
  ],

  // Eigenstaendige Tools und lokale Agent-Skills koennen eigene
  // package.json-Dateien mit demselben Namen enthalten. Sie gehoeren nicht
  // zum App-Modulgraphen und duerfen deshalb auch nicht in Jest Haste landen.
  modulePathIgnorePatterns: ['<rootDir>/(?:tools|\\.agents|\\.claude)/'],

  // Bewusst nicht standardmaessig an: Instrumentierung kostet auf jedem Lauf
  // ~2x Laufzeit. Fuer gezielte Coverage-Reports gibt es `bun run test:coverage`.
  collectCoverage: false,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx,js,jsx}',
    '!src/**/*.{test,spec}.{ts,tsx,js,jsx}',
    '!src/**/*.{test,spec}.*.{ts,tsx,js,jsx}',
    '!src/**/*.d.ts',
  ],
  // Jest excludes setupFiles from instrumentation even when they match
  // collectCoverageFrom. The theme setup is productive app code and must
  // remain visible to the per-file gate.
  forceCoverageMatch: sourceSetupFiles,

  // Der Coverage-Lauf wird separat im CI-Unit-Scope ausgefuehrt. Die Schwellen
  // starten bewusst unter der verifizierten Baseline und werden nach weiteren
  // Sync-Test-Slices schrittweise angehoben.
  coverageReporters: ['text-summary', 'json-summary'],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      functions: 65,
      lines: 72,
    },
  },
};
