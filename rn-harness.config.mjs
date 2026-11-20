import {
  androidPlatform,
  androidEmulator,
} from '@react-native-harness/platform-android';
import {
  applePlatform,
  appleSimulator,
} from '@react-native-harness/platform-apple';
import { webPlatform, chromium } from '@react-native-harness/platform-web';

import {
  IOS_TARGET_NAME,
  IOS_TARGET_SYSTEM_VERSION,
  IOS_TARGET_UDID,
} from './harness/ios-target.mjs';

const iosRunner = applePlatform({
  name: 'ios',
  device: appleSimulator(IOS_TARGET_NAME, IOS_TARGET_SYSTEM_VERSION),
  bundleId: 'com.goldjunge91.fam1',
  appLaunchOptions: {
    arguments: ['--initialUrl', 'http://localhost:8081'],
  },
});
iosRunner.config.targetUdid = IOS_TARGET_UDID;
iosRunner.runner = new URL('./harness/ios-target-runner.mjs', import.meta.url).href;

const config = {
  // Expo Router owns the app entry point. Harness replaces this entry with
  // its runtime while keeping Expo's normal native bootstrap intact.
  entryPoint: 'expo-router/entry',
  appRegistryComponentName: 'main',
  // The development client otherwise relaunches its last project URL instead
  // of requesting the Harness bundle.
  metroPort: 8081,

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
    iosRunner,
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
