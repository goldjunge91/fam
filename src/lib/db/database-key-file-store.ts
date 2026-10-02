import { Platform } from 'react-native';
import { FAM_APP_GROUP } from '@/lib/apple/shared-app-group';
import type { KeyValueStore } from '@/lib/db/local-database-encryption';

const DATABASE_KEY_FILE = 'fam.database.sqlcipher-key.v1';
const KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

type SharedKeyFile = import('expo-file-system').File;

function getSharedKeyFile(): SharedKeyFile | null {
  if (Platform.OS !== 'ios') return null;

  try {
    const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
    const sharedContainer = Paths.appleSharedContainers?.[FAM_APP_GROUP];
    return sharedContainer ? new File(sharedContainer, DATABASE_KEY_FILE) : null;
  } catch {
    return null;
  }
}

async function readSharedKey(file: SharedKeyFile): Promise<string | null> {
  if (!file.exists) return null;

  try {
    const value = (await file.text()).trim();
    return KEY_HEX_PATTERN.test(value) ? value : null;
  } catch {
    return null;
  }
}

function writeSharedKey(file: SharedKeyFile, key: string): void {
  if (file.exists) file.delete();
  file.create({ overwrite: true });
  file.write(key);
}

/** Stores the SQLCipher key in the iOS App Group for the Siri extension. */
export function createSharedKeyFileStore(): KeyValueStore {
  return {
    async getItem() {
      const file = getSharedKeyFile();
      return file ? readSharedKey(file) : null;
    },
    async setItem(_key, value) {
      const file = getSharedKeyFile();
      if (!file) return;

      try {
        writeSharedKey(file, value);
      } catch {
        // The Keychain remains authoritative if the App Group is unavailable.
      }
    },
    async removeItem() {
      const file = getSharedKeyFile();
      if (file?.exists) file.delete();
    },
  };
}
