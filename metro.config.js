const { withNativeWind } = require("nativewind/metro");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { getPostHogExpoConfig } = require("posthog-react-native/metro");
const { withRozenite } = require('@rozenite/metro');

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

config.resolver.sourceExts.push("sql");
// Plattformdateien in `.android.tsx` müssen vor der gemeinsamen `.ts`-Datei
// aufgelöst werden, damit Android die native Variante verwendet.
config.resolver.sourceExts = [
  ...new Set([
    "tsx",
    ...config.resolver.sourceExts.filter((extension) => extension !== "tsx"),
  ]),
];

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: true,
  },
});

module.exports = withRozenite(
  withNativeWind(config, { input: "./src/global.css" }),
  {
    enabled: process.env.WITH_ROZENITE === 'true',
  });
