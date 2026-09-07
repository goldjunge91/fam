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

// Bun/Deno package-store leftovers are not application sources. Excluding them
// prevents Metro from watching stale native package copies and registering the
// same React Native view twice.
config.resolver.blockList = /[\\/]node_modules[\\/](?:\.deno|\.old-[^\\/]+)(?:[\\/]|$)/;

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

module.exports = withNativeWind(config, { input: "./src/global.css" });
