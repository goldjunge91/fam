import type { CameraDevice } from 'react-native-vision-camera';
import { env } from './env';

export function debugLog(...args: unknown[]): void {
  if (!__DEV__ || !env.debugLogsEnabled) return;
  console.log(...args);
}

export function logDevices(devices: CameraDevice[]): void {
  for (const d of devices) {
    console.log(`${d.id}: ${d.type} ${d.position} ("${d.localizedName}")`);
  }
}
