import { Platform } from 'react-native';
import { FAM_APP_GROUP } from '@/lib/apple/shared-app-group';
import type { KeyValueStore } from '@/lib/db/local-database-encryption';

const DATABASE_KEY_FILE = 'fam.database.sqlcipher-key.v1';
export const DATABASE_KEY_CLEANUP_MARKER_KEY = 'fam.database.sqlcipher-key-cleanup-pending.v1';
export const DATABASE_KEY_CLEANUP_MARKER_VALUE = 'pending';
const DATABASE_KEY_CLEANUP_FILE = DATABASE_KEY_CLEANUP_MARKER_KEY;
const KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Liest alte Schlüsseldateien für die Einmalmigration und hält den Cleanup-Marker
 * über App- und Siri-Lebenszyklen hinweg verfügbar. Neue Schlüssel werden hier
 * nicht mehr gespeichert.
 */

type SharedKeyFile = import('expo-file-system').File;

function getSharedKeyFile(key: string): SharedKeyFile | null {
  if (Platform.OS !== 'ios') return null;

  try {
    const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
    const sharedContainer = Paths.appleSharedContainers?.[FAM_APP_GROUP];
    const fileName =
      key === DATABASE_KEY_CLEANUP_MARKER_KEY ? DATABASE_KEY_CLEANUP_FILE : DATABASE_KEY_FILE;
    return sharedContainer ? new File(sharedContainer, fileName) : null;
  } catch {
    return null;
  }
}

async function readSharedValue(file: SharedKeyFile, key: string): Promise<string | null> {
  if (!file.exists) return null;

  if (key === DATABASE_KEY_CLEANUP_MARKER_KEY) {
    const value = (await file.text()).trim();
    if (value === DATABASE_KEY_CLEANUP_MARKER_VALUE) return value;
    throw new Error('Der SQLCipher-Key-Cleanup-Marker ist ungültig.');
  }

  try {
    const value = (await file.text()).trim();
    return KEY_HEX_PATTERN.test(value) ? value : null;
  } catch {
    return null;
  }
}

function writeCleanupMarker(file: SharedKeyFile, value: string): void {
  if (file.exists) file.delete();
  file.create({ overwrite: true });
  file.write(value);
}

/**
 * KeyValueStore für alte Schlüsseldateien und den wiederholbaren Cleanup-Marker.
 */
export function createSharedKeyFileStore(): KeyValueStore {
  return {
    async getItem(key) {
      const file = getSharedKeyFile(key);
      if (!file && Platform.OS === 'ios' && key === DATABASE_KEY_CLEANUP_MARKER_KEY) {
        throw new Error('Der App-Group-Cleanup-Marker ist nicht erreichbar.');
      }
      return file ? readSharedValue(file, key) : null;
    },
    setItem: async (key, value) => {
      if (key !== DATABASE_KEY_CLEANUP_MARKER_KEY) return;

      const file = getSharedKeyFile(key);
      if (!file) {
        if (Platform.OS === 'ios') {
          throw new Error('Der App-Group-Cleanup-Marker ist nicht erreichbar.');
        }
        return;
      }
      if (file.exists) {
        const current = (await file.text()).trim();
        if (current === DATABASE_KEY_CLEANUP_MARKER_VALUE) return;
        throw new Error('Der SQLCipher-Key-Cleanup-Marker ist ungültig.');
      }
      writeCleanupMarker(file, value);
    },
    async removeItem(key) {
      const file = getSharedKeyFile(key);
      if (!file) {
        if (
          Platform.OS === 'ios' &&
          (key === DATABASE_KEY_FILE || key === DATABASE_KEY_CLEANUP_MARKER_KEY)
        ) {
          throw new Error('Der App-Group-Schlüssel oder Cleanup-Marker ist nicht erreichbar.');
        }
        return;
      }
      if (file.exists) file.delete();
    },
  };
}
