import { Platform } from 'react-native';
import { FAM_APP_GROUP } from '@/lib/apple/shared-app-group';
import type { KeyValueStore } from '@/lib/db/local-database-encryption';

const DATABASE_KEY_FILE = 'fam.database.sqlcipher-key.v1';
const KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Der SQLCipher-Schluessel im gemeinsamen App-Group-Container.
 *
 * Warum eine Datei statt der Keychain: Apple entfernt beim Signieren jedes
 * `keychain-access-groups`-Entitlement, das das Provisioning-Profil nicht
 * abdeckt. Das Projekt-Profil erlaubt nur `SW8RP7PA3W.*`, also laesst sich
 * eine eigene Access-Group nicht aktivieren — die Siri-Extension konnte den
 * Key daher nicht lesen und scheiterte beim Entschlüsseln mit SQLITE_NOTADB
 * ("SQLite prepare"). Die App Group selbst ist freigeschaltet und traegt.
 *
 * Das hier ist dieselbe Schluesseldatei, die bereits neben der Datenbank
 * im Container liegt: ohne sie waere die verschluesselte Datei wertlos, mit
 * ihr haengt die Sicherheit an der Schluesselgrenze des Geräets. Die
 * Keychain bleibt als primaere Quelle erhalten und wird hier nur gespiegelt.
 */

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

/**
 * KeyValueStore auf den gemeinsamen Container. Wird von der Haupt-App als
 * Spiegel der Keychain benutzt; die Extension liest denselben Pfad direkt
 * aus dem Container, ohne JavaScript.
 */
export function createSharedKeyFileStore(): KeyValueStore {
  return {
    async getItem() {
      const file = getSharedKeyFile();
      return file ? readSharedKey(file) : null;
    },
    setItem: async (_key, value) => {
      const file = getSharedKeyFile();
      if (!file) return;
      try {
        writeSharedKey(file, value);
      } catch {
        // Ohne Container bleibt die Keychain die alleinige Quelle.
      }
    },
    async removeItem() {
      const file = getSharedKeyFile();
      if (file?.exists) file.delete();
    },
  };
}
