/**
 * Integrationstests gegen die echte lokale Supabase-Instanz.
 * @type {import('jest').Config}
 */
module.exports = {
  testEnvironment: "node",
  maxWorkers: 1,
  // Integrationstests leben ausschliesslich im echten Projekt-Quellbaum.
  // Ohne diese Grenze sammelt Jest lokal auch Tests aus Codex-/Claude-
  // Worktrees ein und fuehrt dieselbe Suite mehrfach gegen dieselbe DB aus.
  roots: ["<rootDir>/src"],

  // Nur TypeScript-Typen entfernen, sonst nichts. `babel-preset-expo` waere hier
  // falsch: Es spritzt einen Import auf `expo/virtual/env` ein, den Node als
  // ESM nicht laden kann — und der Test braucht von Expo ohnehin nichts.
  transform: {
    "^.+\\.[jt]sx?$": [
      "babel-jest",
      {
        presets: [
          ["@babel/preset-typescript", { isTSX: true, allExtensions: true }],
        ],
        // Der TypeScript-Preset entfernt nur Typen. Jest laedt die Dateien als
        // CommonJS, deshalb muessen die ESM-Importe zusaetzlich umgeschrieben
        // werden — sonst: "Cannot use import statement outside a module".
        plugins: ["@babel/plugin-transform-modules-commonjs"],
      },
    ],
  },

  moduleNameMapper: {
    "^@/assets/(.*)$": "<rootDir>/assets/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
  },

  transformIgnorePatterns: ["node_modules/(?!(.bun|expo|@expo)/)"],

  testMatch: ["**/*.integration.test.ts", "**/*.integration.test.tsx"],
  testPathIgnorePatterns: ["/node_modules/"],
  setupFiles: ["<rootDir>/test/setup-integration.js"],

  // Netzwerk gegen einen lokalen Docker-Stack ist langsamer als reine Logik;
  // der Default von 5 s reicht fuer signUp mit Passwort-Hashing nicht.
  testTimeout: 30_000,

  maxWorkers: 2,
};
