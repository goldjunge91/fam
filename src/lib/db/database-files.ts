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

/** Kopiert eine bestehende lokale Datenbank einmalig in den App-Group-Container. */
export async function migrateExpoDatabaseFiles(
  sourceDirectory: string,
  targetDirectory: string,
): Promise<void> {
  const { Directory, File } = loadFileSystem();
  const source = new Directory(sourceDirectory);
  const target = new Directory(targetDirectory);
  target.create({ idempotent: true, intermediates: true });

  for (const fileName of DATABASE_FILES_TO_MIGRATE) {
    const sourceFile = new File(source, fileName);
    const targetFile = new File(target, fileName);
    if (targetFile.exists || !sourceFile.exists) continue;
    await sourceFile.copy(targetFile);
  }
}
