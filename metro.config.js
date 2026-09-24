const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { getPostHogExpoConfig } = require("posthog-react-native/metro");
const {
  wrapWithReanimatedMetroConfig,
} = require("react-native-reanimated/metro-config");
const { withRozenite } = require('@rozenite/metro');

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

// expo-sqlite's web implementation loads wa-sqlite as a WebAssembly asset.
config.resolver.assetExts = [...new Set([...config.resolver.assetExts, "wasm"])];

// SharedArrayBuffer is required by wa-sqlite in the browser.
const existingEnhanceMiddleware = config.server?.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const enhancedMiddleware = existingEnhanceMiddleware
      ? existingEnhanceMiddleware(middleware, server)
      : middleware;

    return (req, res, next) => {
      res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      return enhancedMiddleware(req, res, next);
    };
  },
};

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: true,
    inlineRequires: false,
  },
});

module.exports = withRozenite(wrapWithReanimatedMetroConfig(config), {
  enabled: process.env.WITH_ROZENITE === 'true',
});
