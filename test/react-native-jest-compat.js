// Jest 29 loads setup files as CommonJS, while React Native 0.86's upstream
// setup file uses ESM and Flow syntax. Keep the small runtime globals that RN
// expects available before transformed RN modules are imported.
global.__DEV__ = true;
global.nativeFabricUIManager = {};
global.IS_REACT_ACT_ENVIRONMENT = true;
global.ErrorUtils = {
  setGlobalHandler: () => undefined,
  getGlobalHandler: () => (error) => {
    throw error;
  },
  reportError: (error) => {
    throw error;
  },
  reportFatalError: (error) => {
    throw error;
  },
  applyWithGuard: (fn, context, args) => fn.apply(context, args),
  applyWithGuardIfNeeded: (fn, context, args) => fn.apply(context, args),
  inGuard: () => false,
  guard: (fn) => (...args) => fn(...args),
};

const mockNativeModules = new Proxy(
  {
    NativeUnimoduleProxy: { viewManagersMetadata: {} },
    UIManager: { getConstants: () => ({}) },
    NativePerformanceCxx: {
      now: () => Date.now(),
      reportMark: () => undefined,
      reportMeasure: () => undefined,
      getMarkTime: () => null,
      clearMarks: () => undefined,
      clearMeasures: () => undefined,
      getEntries: () => [],
      getEntriesByName: () => [],
      getEntriesByType: () => [],
      getEventCounts: () => [],
      getSimpleMemoryInfo: () => ({}),
      getReactNativeStartupTiming: () => ({}),
    },
    SettingsManager: {
      getConstants: () => ({ settings: {} }),
      setValues: () => undefined,
    },
    Appearance: {
      getColorScheme: () => 'light',
      addListener: () => ({ remove: () => undefined }),
      removeListeners: () => undefined,
    },
    AppState: {
      getConstants: () => ({ initialAppState: 'active' }),
      getCurrentAppState: (callback) => callback({ app_state: 'active' }),
      addListener: () => ({ remove: () => undefined }),
      removeListeners: () => undefined,
    },
    Timing: {
      createTimer: () => undefined,
      deleteTimer: () => undefined,
      setSendIdleEvents: () => undefined,
    },
    PlatformConstants: {
      getConstants: () => ({
        isTesting: true,
        forceTouchAvailable: false,
        osVersion: 'test',
        systemName: 'iOS',
        interfaceIdiom: 'phone',
        reactNativeVersion: { major: 0, minor: 86, patch: 3, prerelease: null },
      }),
    },
    DeviceInfo: {
      getConstants: () => ({ Dimensions: { window: { width: 320, height: 640, scale: 1, fontScale: 1 }, screen: { width: 320, height: 640, scale: 1, fontScale: 1 } } }),
    },
  },
  {
    get: (target, property) => {
      if (!(property in target)) {
        target[property] = {};
      }
      return target[property];
    },
  },
);

jest.mock('react-native/Libraries/BatchedBridge/NativeModules', () => ({
  default: mockNativeModules,
}));
jest.mock('react-native/Libraries/Core/setUpReactDevTools', () => ({}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: {}, manifest: {}, executionEnvironment: 'standalone' },
}));
