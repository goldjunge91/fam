const includeHarnessUI = process.env.FAM_HARNESS_UI === '1';

// HarnessUI contains debug-only native touch inspection APIs. Keep it out of
// release native projects so App Store binaries never contain those selectors.
module.exports = includeHarnessUI
  ? {}
  : {
      dependencies: {
        '@react-native-harness/ui': {
          platforms: {
            ios: null,
            android: null,
          },
        },
      },
    };
