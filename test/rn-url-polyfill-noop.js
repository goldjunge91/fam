// `react-native-url-polyfill/auto` ist ein reiner Side-Effect-Import (polyfillt
// `URL`/`URLSearchParams` fuer die RN-Engine) und selbst ESM — die minimale
// Node-Transform der Integrationstests (jest.integration.config.js) laedt kein
// RN-/Expo-Preset und kann dieses ESM-Modul deshalb nicht parsen. Node hat
// `URL`/`URLSearchParams` bereits nativ; der Polyfill hat unter Node keine
// Wirkung zu ersetzen.
module.exports = {};
