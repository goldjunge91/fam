export default {
  preset: 'react-native-harness',
  testMatch: ['<rootDir>/**/*.harness.[jt]s?(x)'],
  // `temp/` enthaelt Wegwerf-Sandboxes (z. B. aus dem Stryker-Mutationspilot
  // mit Kopien des Harness und verwaisten require-Pfaden). testMatch greift
  // rekursiv, also wuerden diese Kopien mitgetestet und scheitern.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/temp/'],
};
