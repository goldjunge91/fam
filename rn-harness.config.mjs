import {
  androidPlatform,
  androidEmulator,
} from '@react-native-harness/platform-android';
import {
  applePlatform,
  appleSimulator,
} from '@react-native-harness/platform-apple';
import { webPlatform, chromium } from '@react-native-harness/platform-web';

const config = {
  // Expo Router owns the app entry point. Harness replaces this entry with
  // its runtime while keeping Expo's normal native bootstrap intact.
  entryPoint: 'expo-router/entry',
  appRegistryComponentName: 'main',

  runners: [
    androidPlatform({
      name: 'android',
      device: androidEmulator('Pixel_8_API_35', {
        apiLevel: 35,
        profile: 'pixel_6',
        diskSize: '1G',
        heapSize: '1G',
      }),
      bundleId: 'com.goldjunge91.fam',
    }),
    applePlatform({
      name: 'ios',
      device: appleSimulator('Iphone 17 Pro Max master', '26.5'),
      bundleId: 'com.goldjunge91.fam1',
    }),
    webPlatform({
      name: 'web',
      browser: chromium('http://localhost:8081/index.html'),
    }),
  ],

  defaultRunner: 'ios',
  platformReadyTimeout: 300000,
  bridgeTimeout: 120000,
  bundleStartTimeout: 120000,
  testTimeout: 30000,
  resetEnvironmentBetweenTestFiles: 'runtime',
  detectNativeCrashes: true,
  forwardClientLogs: true,
  disableViewFlattening: true,
};

export default config;
