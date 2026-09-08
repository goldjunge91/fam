// Formatierungsregeln uebernehmen 1:1 die bisherigen Werte aus biome.json
// ("javascript.formatter"), damit die Umstellung keinen Massen-Reformat-Diff
// erzeugt. Biomes eigener Formatter ist in biome.json deaktiviert; Biome
// bleibt ausschliesslich Linter.
/** @type {import('prettier').Config} */
module.exports = {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  singleQuote: true,
  jsxSingleQuote: false,
  semi: true,
  bracketSameLine: true,
  trailingComma: 'all',
  plugins: ['prettier-plugin-tailwindcss'],
};
