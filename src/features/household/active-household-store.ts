import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { FAM_APP_GROUP, FAM_SIRI_CONTEXT_FILE } from '@/lib/apple/shared-app-group';
import {
  sharedStoreWriterOwner,
  withSharedStoreWriterSync,
} from '@/lib/apple/shared-store-lifecycle';

const STORAGE_KEY = '@fam/active_household_id';
let sharedContextWriteSequence = 0;

type SharedContextFile = import('expo-file-system').File;

function getSharedContextFile(): SharedContextFile | null {
  if (Platform.OS !== 'ios') return null;

  try {
    const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
    const sharedContainer = Paths.appleSharedContainers?.[FAM_APP_GROUP];
    return sharedContainer ? new File(sharedContainer, FAM_SIRI_CONTEXT_FILE) : null;
  } catch {
    return null;
  }
}

async function readSharedHouseholdId(file: SharedContextFile): Promise<string | null> {
  if (!file.exists) return null;

  try {
    const parsed: unknown = JSON.parse(await file.text());
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const value = (parsed as { activeHouseholdId?: unknown }).activeHouseholdId;
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeSharedHouseholdId(file: SharedContextFile, id: string | null): void {
  withSharedStoreWriterSync(sharedStoreWriterOwner, 'active-household.context', () => {
    if (id === null) {
      if (file.exists) file.delete();
      return;
    }

    sharedContextWriteSequence += 1;
    const { File } = require('expo-file-system') as typeof import('expo-file-system');
    const temporary = new File(
      file.parentDirectory,
      `.${file.name}.${sharedContextWriteSequence}.tmp`,
    );
    try {
      temporary.create({ overwrite: true });
      temporary.write(JSON.stringify({ activeHouseholdId: id }));
      // The temporary file and target share the App Group directory. The
      // native same-container move publishes one complete JSON document.
      temporary.moveSync(file, { overwrite: true });
    } catch (error) {
      if (temporary.exists && temporary.uri !== file.uri) temporary.delete();
      throw error;
    }
  });
}

export async function getStoredActiveHouseholdId(): Promise<string | null> {
  const sharedFile = getSharedContextFile();
  if (sharedFile?.exists) return readSharedHouseholdId(sharedFile);

  try {
    const legacyValue = await AsyncStorage.getItem(STORAGE_KEY);
    if (sharedFile && legacyValue) {
      try {
        writeSharedHouseholdId(sharedFile, legacyValue);
      } catch {
        // Die private Quelle bleibt verfügbar, auch wenn der Shared-Write wartet.
      }
    }
    return legacyValue;
  } catch {
    return null;
  }
}

export async function setStoredActiveHouseholdId(id: string | null): Promise<void> {
  const sharedFile = getSharedContextFile();
  if (sharedFile) {
    try {
      writeSharedHouseholdId(sharedFile, id);
    } catch {
      // AsyncStorage bleibt der Fallback für Builds ohne funktionierende App Group.
    }
  }

  try {
    if (id) {
      await AsyncStorage.setItem(STORAGE_KEY, id);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Error handling silent fallback
  }
}
