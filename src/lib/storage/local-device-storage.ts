import type { MMKV } from 'react-native-mmkv';

const DEVICE_STORAGE_ID = 'fam-device-v1';

let deviceStorage: MMKV | null = null;

function loadMMKV() {
  try {
    return require('react-native-mmkv') as typeof import('react-native-mmkv');
  } catch (error) {
    throw new Error(
      'Das native Modul react-native-mmkv fehlt im installierten Development Build. Erstelle den Dev Client neu.',
      { cause: error },
    );
  }
}

/**
 * Unverschlüsselter Gerätespeicher ausschließlich für nicht sensible UI-Werte.
 * Accountdaten dürfen diese Instanz nicht verwenden.
 */
export function getDeviceStorage(): MMKV {
  deviceStorage ??= loadMMKV().createMMKV({
    id: DEVICE_STORAGE_ID,
    mode: 'single-process',
  });
  return deviceStorage;
}
