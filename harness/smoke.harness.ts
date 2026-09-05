import { describe, expect, it } from 'react-native-harness';
import { NativeModules, Platform } from 'react-native';

describe('fam React Native Harness', () => {
  it('boots the app runtime on the selected platform', () => {
    expect(['android', 'ios', 'web']).toContain(Platform.OS);
    expect(Platform.Version).toBeDefined();
  });

  it('exposes React Native native modules to the test runtime', () => {
    expect(NativeModules).toBeDefined();
    expect(typeof NativeModules).toBe('object');
  });

  it('supports asynchronous Jest-style tests', async () => {
    await expect(Promise.resolve('harness')).resolves.toBe('harness');
  });
});
