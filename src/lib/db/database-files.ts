export const DATABASE_FILE_NAMES = {
  main: 'fam-v2.db',
  encryptedNext: 'fam-v2.encrypted.next.db',
  plaintextRecovery: 'fam-v2.plaintext.recovery.db',
  offDump: 'off-dump-v2.db',
} as const;

export type DatabaseFileOps = {
  exists(fileName: string): boolean;
  delete(fileName: string): Promise<void>;
  move(fromFileName: string, toFileName: string): Promise<void>;
  path(fileName: string): string;
};

function loadFileSystem(): typeof import('expo-file-system') {
  try {
    return require('expo-file-system') as typeof import('expo-file-system');
  } catch {
    throw new Error(
      'expo-file-system fehlt im Development Build. Der Development Build muss neu erstellt werden.',
    );
  }
}

/** Dateioperationen im nativen SQLite-Verzeichnis, nicht im Dokumentenverzeichnis. */
export function createExpoDatabaseFileOps(databaseDirectory: string): DatabaseFileOps {
  const { File } = loadFileSystem();
  const file = (fileName: string) => new File(databaseDirectory, fileName);

  return {
    exists: (fileName) => file(fileName).exists,
    async delete(fileName) {
      const target = file(fileName);
      if (target.exists) target.delete();
    },
    async move(fromFileName, toFileName) {
      await file(fromFileName).move(file(toFileName));
    },
    path: (fileName) => {
      const uri = file(fileName).uri;
      return uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
    },
  };
}

const DATABASE_FILES_TO_MIGRATE = [
  ...Object.values(DATABASE_FILE_NAMES),
  ...Object.values(DATABASE_FILE_NAMES).flatMap((fileName) => [
    `${fileName}-wal`,
    `${fileName}-shm`,
    `${fileName}-journal`,
  ]),
] as const;

const APP_GROUP_MIGRATION_MARKER = '.fam-v2-private-db-migration-v1';

/** Rückmigration aus dem App-Group-Container, bevor die private DB geöffnet wird. */
export async function migrateAppGroupDatabaseToPrivate(
  appGroupDirectory: string,
  privateDirectory: string,
): Promise<void> {
  const { Directory, File } = loadFileSystem();
  const source = new Directory(appGroupDirectory);
  const target = new Directory(privateDirectory);
  target.create({ idempotent: true, intermediates: true });

  const marker = new File(target, APP_GROUP_MIGRATION_MARKER);
  if (marker.exists && marker.textSync() === 'complete') return;

  const sourceHasDatabase = Object.values(DATABASE_FILE_NAMES)
    .filter((fileName) => fileName !== DATABASE_FILE_NAMES.offDump)
    .some((fileName) => new File(source, fileName).exists);

  if (sourceHasDatabase) {
    for (const fileName of DATABASE_FILES_TO_MIGRATE) {
      const sourceFile = new File(source, fileName);
      const targetFile = new File(target, fileName);
      if (sourceFile.exists) {
        await sourceFile.copy(targetFile, { overwrite: true });
      } else if (targetFile.exists) {
        targetFile.delete();
      }
    }
  }

  // Erst nach allen Daten- und WAL-Dateien markieren. Nach einem unterbrochenen
  // Kopieren wird beim nächsten Start erneut aus der bisherigen Quelle kopiert.
  if (!marker.exists) marker.create({ intermediates: true });
  marker.write('complete');
}
