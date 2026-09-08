// https://docs.expo.dev/guides/using-eslint/
// Scope bewusst deckungsgleich mit biome.json gehalten: dieselben
// eingeschlossenen und ausgeschlossenen Pfade, damit Biome (Linter, kein
// Formatter mehr) und ESLint dieselbe Code-Flaeche pruefen. Prettier
// uebernimmt die Formatierung; eslintPluginPrettierRecommended meldet
// Formatierungsabweichungen als Lint-Fehler und schaltet ESLints eigene
// Stilregeln ab, damit beide Tools sich nicht widersprechen.
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  globalIgnores([
    'dist/*',
    '.expo/**',
    '.harness/**',
    'coverage/**',
    '.agents/**',
    'node_modules/**',
    'android/**',
    'ios/**',
  ]),
  {
    files: ['src/**/*.{js,jsx,ts,tsx}', 'scripts/**/*.{js,ts}', 'test/conventions/**/*.{ts,tsx}'],
    ignores: [
      'src/lib/database.types.ts',
      'scripts/dump_data/category-calibration-report.*',
      '.claude/**',
      '.codex/**',
      'temp/**',
    ],
    extends: [expoConfig, eslintPluginPrettierRecommended],
  },
]);
