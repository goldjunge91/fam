import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { categoryFeedbackMetadata } from './feedback-metadata';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { nativeAppVersion: null, expoConfig: null },
}));

describe('categoryFeedbackMetadata', () => {
  const originalPlatform = Platform.OS;
  const originalBuildChannel = process.env.EXPO_PUBLIC_BUILD_CHANNEL;
  const originalDevDescriptor = Object.getOwnPropertyDescriptor(globalThis, '__DEV__');

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    if (originalBuildChannel === undefined) {
      delete process.env.EXPO_PUBLIC_BUILD_CHANNEL;
    } else {
      process.env.EXPO_PUBLIC_BUILD_CHANNEL = originalBuildChannel;
    }
    if (originalDevDescriptor) {
      Object.defineProperty(globalThis, '__DEV__', originalDevDescriptor);
    }
    Object.assign(Constants, { nativeAppVersion: null, expoConfig: null });
  });

  it('uses native version and trimmed environment channel on iOS', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    Object.assign(Constants, {
      nativeAppVersion: '1.2.3',
      expoConfig: { extra: { buildChannel: ' configured ' }, version: '2.0.0' },
    });
    process.env.EXPO_PUBLIC_BUILD_CHANNEL = ' beta ';

    expect(categoryFeedbackMetadata(new Date('2026-08-24T05:00:00.000Z'))).toEqual({
      platform: 'ios',
      appVersion: '1.2.3',
      buildChannel: 'beta',
      clientCreatedAt: '2026-08-24T05:00:00.000Z',
    });
  });

  it('uses configured version and channel on Android', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    Object.assign(Constants, {
      expoConfig: { extra: { buildChannel: ' configured ' }, version: '2.0.0' },
    });
    delete process.env.EXPO_PUBLIC_BUILD_CHANNEL;

    expect(categoryFeedbackMetadata(new Date('2026-08-24T05:00:00.000Z'))).toEqual({
      platform: 'android',
      appVersion: '2.0.0',
      buildChannel: 'configured',
      clientCreatedAt: '2026-08-24T05:00:00.000Z',
    });
  });

  it('falls back to development metadata for web and missing config', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    Object.assign(Constants, { expoConfig: { extra: { buildChannel: '  ' } } });
    delete process.env.EXPO_PUBLIC_BUILD_CHANNEL;

    expect(categoryFeedbackMetadata(new Date('2026-08-24T05:00:00.000Z'))).toEqual({
      platform: 'web',
      appVersion: 'development',
      buildChannel: 'development',
      clientCreatedAt: '2026-08-24T05:00:00.000Z',
    });
  });

  it('uses production when development mode is disabled', () => {
    Object.defineProperty(globalThis, '__DEV__', { configurable: true, value: false });
    delete process.env.EXPO_PUBLIC_BUILD_CHANNEL;

    expect(categoryFeedbackMetadata().buildChannel).toBe('production');
  });
});
