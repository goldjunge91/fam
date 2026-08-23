jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Der offizielle Mock ersetzt das unter Jest nicht verfuegbare native Worklets-Modul.
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
