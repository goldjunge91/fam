/**
 * Integrationstests gegen die echte lokale Supabase-Instanz.
 *
 * Bewusst **ohne** das `jest-expo`-Preset — und das ist der Kern dieser Datei:
 * Dessen Setup ersetzt `fetch` durch einen React-Native-Stub, dessen Antworten
 * kein `status` und keinen Body haben. supabase-js meldet daraufhin
 * `AuthUnknownError: "undefined" is not valid JSON` — eine Meldung, die auf die
 * eigentliche Ursache nicht im Entferntesten hindeutet.
 *
 * Diese Suite rendert keine Komponenten. Sie spricht ueber HTTP mit Postgres und
 * braucht deshalb nur Node mit dessen nativem fetch, plus den Babel-Transform
 * fuer TypeScript.
 *
 * Getrennt von `jest.config.js` auch deshalb, weil sie `supabase start`
 * voraussetzt und nicht in den Standard-Lauf gehoert.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  testEnvironment: 'node',

  // Nur TypeScript-Typen entfernen, sonst nichts. `babel-preset-expo` waere hier
  // falsch: Es spritzt einen Import auf `expo/virtual/env` ein, den Node als
  // ESM nicht laden kann — und der Test braucht von Expo ohnehin nichts.
  transform: {
    '^.+\\.[jt]sx?$': [
      'babel-jest',
      {
        presets: [['@babel/preset-typescript', { isTSX: true, allExtensions: true }]],
        // Der TypeScript-Preset entfernt nur Typen. Jest laedt die Dateien als
        // CommonJS, deshalb muessen die ESM-Importe zusaetzlich umgeschrieben
        // werden — sonst: "Cannot use import statement outside a module".
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

  // Netzwerk gegen einen lokalen Docker-Stack ist langsamer als reine Logik;
  // der Default von 5 s reicht fuer signUp mit Passwort-Hashing nicht.
  testTimeout: 30_000,

  // Alle Suiten teilen sich dieselbe lokale Supabase-Instanz (ein Postgres,
  // ein Realtime-Container). Jests Default (CPU-Kerne minus 1) laesst zu viele
  // Testdateien gleichzeitig gegen diese eine Instanz laufen — auf schwaecher
  // dimensionierten CI-Runnern reicht das, um `realtime.integration.test.ts`s
  // Timing-Test unter Kontention in den Timeout laufen zu lassen (beobachtet,
  // nicht vermutet: reproduzierbar sowohl lokal im Vollstest als auch im
  // ersten CI-Lauf dieser Datei, isoliert lief derselbe Test durchgehend in
  // unter 2s durch). 2 haelt echte Parallelitaet fuer den Laufzeitgewinn,
  // begrenzt aber die Anzahl gleichzeitiger Verbindungen gegen die eine
  // geteilte Instanz.
  maxWorkers: 2,
};
