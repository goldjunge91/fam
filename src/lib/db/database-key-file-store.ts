import { Platform } from 'react-native';
import { FAM_APP_GROUP } from '@/lib/apple/shared-app-group';
import type { KeyValueStore } from '@/lib/db/local-database-encryption';

const DATABASE_KEY_FILE = 'fam.database.sqlcipher-key.v1';
export const DATABASE_KEY_CLEANUP_MARKER_KEY = 'fam.database.sqlcipher-key-cleanup-pending.v1';
export const DATABASE_KEY_CLEANUP_MARKER_VALUE = 'pending';
const DATABASE_KEY_CLEANUP_FILE = DATABASE_KEY_CLEANUP_MARKER_KEY;
const KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Kompatibilitätskopie des SQLCipher-Schlüssels im gemeinsamen App-Group-Container.
 *
 * Siri fragt zuerst die gemeinsame Keychain-Gruppe ab. Die Datei bleibt als
 * Rückweg für bestehende Installationen erhalten, bis der Zugriff durch die
 * tatsächlich signierte App und Siri nachgewiesen ist.
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

function writeSharedKey(file: SharedKeyFile, key: string): void {
  if (file.exists) file.delete();
  file.create({ overwrite: true });
  file.write(key);
}

/**
 * KeyValueStore auf den gemeinsamen Container. Die Haupt-App hält die Datei
 * vorerst für Altinstallationen vor; Siri verwendet sie nur als Rückweg, wenn
 * die gemeinsame Keychain-Gruppe noch keinen Schlüssel liefert.
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
      const file = getSharedKeyFile(key);
      if (!file) {
        if (Platform.OS === 'ios' && key === DATABASE_KEY_CLEANUP_MARKER_KEY) {
          throw new Error('Der App-Group-Cleanup-Marker ist nicht erreichbar.');
        }
        return;
      }
      try {
        if (key === DATABASE_KEY_CLEANUP_MARKER_KEY && file.exists) {
          const current = (await file.text()).trim();
          if (current === DATABASE_KEY_CLEANUP_MARKER_VALUE) return;
          throw new Error('Der SQLCipher-Key-Cleanup-Marker ist ungültig.');
        }
        writeSharedKey(file, value);
      } catch (error) {
        if (key === DATABASE_KEY_CLEANUP_MARKER_KEY) throw error;
        // Ohne Container bleibt die Keychain die alleinige Quelle.
      }
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
