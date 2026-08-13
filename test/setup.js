jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// react-native-reanimated bringt ab v4 ein natives Worklets-Modul mit, das
// unter Jest (kein echtes Geraet/keine JSI) beim reinen `require` bricht
// (`Cannot read properties of undefined (reading 'loadUnpackers')`). Der
// offizielle Mock (`react-native-reanimated/mock`) ersetzt Shared
// Values/Worklets durch reine JS-Implementierungen — ausreichend fuer Render-
// und Interaktionstests, die keine echte UI-Thread-Animation pruefen (#129).
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

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
