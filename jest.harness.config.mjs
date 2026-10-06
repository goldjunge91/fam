export default {
  preset: 'react-native-harness',
  testMatch: ['<rootDir>/**/*.harness.[jt]s?(x)'],
  // Harness tests live here; narrowing Jest's crawl also avoids stale package
  // snapshots under generated build/cache dependencies.
  roots: ['<rootDir>/harness'],
};
