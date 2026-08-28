const { withNativeWind } = require("nativewind/metro");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { getPostHogExpoConfig } = require("posthog-react-native/metro");

// const config = getPostHogExpoConfig(__dirname, {
//   getDefaultConfig: (projectRoot, options = {}) => {
//     const { getDefaultConfig: _ignored, ...metroOptions } = options;
//     return getSentryExpoConfig(projectRoot, {
//       ...metroOptions,
//       includeWebReplay: false,
//     });
//   },
// });
const config = getPostHogExpoConfig(__dirname, {
  getDefaultConfig: (projectRoot, options = {}) => {
    const { getDefaultConfig: _ignored, ...metroOptions } = options;

    return getSentryExpoConfig(projectRoot, {
      ...metroOptions,
      includeWebReplay: false,
    });
  },
});

// Disable Watchman
config.useWatchman = false;

config.resolver.sourceExts.push("sql");

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: true,
  },
});

module.exports = withNativeWind(config, { input: "./src/global.css" });
