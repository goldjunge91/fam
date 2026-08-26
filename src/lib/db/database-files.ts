/**
 * Aktive Dateien und die beiden kurzlebigen Cutover-Stufen.
 *
 * Eine vorhandene Klartext-`fam-v2.db` wird nicht verworfen: Sie wird zuerst
 * vollständig nach `encryptedNext` exportiert, während `plaintextRecovery`
 * den atomaren Dateitausch absichert. Der OFF-Dump bleibt ein unabhängiger,
 * öffentlicher Klartextkatalog.
 */
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
