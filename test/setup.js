jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// react-native-reanimated bringt ab v4 ein natives Worklets-Modul mit, das
// unter Jest (kein echtes Geraet/keine JSI) beim reinen `require` bricht
// (`Cannot read properties of undefined (reading 'loadUnpackers')`). Der
// offizielle Mock (`react-native-reanimated/mock`) ersetzt Shared
// Values/Worklets durch reine JS-Implementierungen — ausreichend fuer Render-
// und Interaktionstests, die keine echte UI-Thread-Animation pruefen (#129).
jest.mock('react-native-reanimated', () => {
  const reanimated = require('react-native-reanimated/mock');
  return {
    ...reanimated,
    useReducedMotion: jest.fn(() => false),
    useComposedEventHandler: jest.fn(() => jest.fn()),
  };
});

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notif-id-123'),
  cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(undefined),
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
  },
}));

jest.mock('react-native-reorderable-list', () => {
  const React = require('react');
  const { FlatList } = require('react-native');
  return {
    __esModule: true,
    default: FlatList,
    ReorderableList: FlatList,
    useReorderableDrag: () => jest.fn(),
    useIsActive: () => false,
    useReorderableDragStart: () => jest.fn(),
    useReorderableDragEnd: () => jest.fn(),
    reorderItems: (items) => items,
  };
});

jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {},
}));

jest.mock('react-native-nitro-image', () => ({
  NitroImage: 'NitroImage',
}));

jest.mock('@lokal-dev/react-native-bugbubble', () => ({
  BugBubble: () => null,
  BugBubbleLogger: {
    logAnalytics: jest.fn(),
    logNetwork: jest.fn(),
    logWebSocket: jest.fn(),
    logConsole: jest.fn(),
  },
}));

