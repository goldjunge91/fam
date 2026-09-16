import packageJson from '../../package.json';

const expoBundledNativeModules = require('expo/bundledNativeModules.json') as Record<
  string,
  string
>;

describe('Reanimated-/Worklets-Kompatibilität', () => {
  it('hält Reanimated und Worklets auf der Expo-SDK-57-Kombination', () => {
    const reanimatedVersion = packageJson.dependencies['react-native-reanimated'];
    const workletsVersion = packageJson.dependencies['react-native-worklets'];

    expect(reanimatedVersion).toBe(expoBundledNativeModules['react-native-reanimated']);
    expect(workletsVersion).toBe(expoBundledNativeModules['react-native-worklets']);
    expect(packageJson.resolutions['react-native-worklets']).toBe(workletsVersion);
  });
});
