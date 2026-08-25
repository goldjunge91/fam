import type { CameraDevice } from 'react-native-vision-camera';
import { env } from './env';

/**
 * `console.log`, aber nur in `__DEV__` und solange `EXPO_PUBLIC_DEBUG_LOGS`
 * nicht explizit auf `false`/`0` steht. Fuer Ad-hoc-Diagnose-Ausgaben, die
 * beim Nachvollziehen eines Flows temporär eingebaut werden und sich per
 * `.env` stumm schalten lassen sollen, ohne den Aufruf im Code zu entfernen.
 */
export function debugLog(...args: unknown[]): void {
  if (!__DEV__ || !env.debugLogsEnabled) return;
  console.log(...args);
}

export function logDevices(devices: CameraDevice[]): void {
  for (const d of devices) {
    console.log(`${d.id}: ${d.type} ${d.position} ("${d.localizedName}")`);
  }
}
