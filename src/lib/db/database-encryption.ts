import type { KeyValueStore } from '@/lib/chunked-storage';
import type { DatabaseFileOps } from '@/lib/db/database-files';

const DATABASE_KEY_STORAGE_KEY = 'fam.database.sqlcipher-key.v1';
const KEY_BYTES = 32;
const KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

const REBUILD_HINT =
  'Die nativen Module ExpoSecureStore oder ExpoCrypto fehlen im Development Build. ' +
  'Ein Metro-Reload reicht nicht; der Development Build muss neu erstellt werden.';

type DatabaseKeyDependencies = {
  storage: KeyValueStore;
  randomBytes(byteCount: number): Promise<Uint8Array>;
};

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createDatabaseKeyManager(dependencies: DatabaseKeyDependencies) {
  let loading: Promise<string> | null = null;

  return async function getOrCreateDatabaseKey(): Promise<string> {
    loading ??= (async () => {
      const stored = await dependencies.storage.getItem(DATABASE_KEY_STORAGE_KEY);
      if (stored !== null) {
        if (!KEY_HEX_PATTERN.test(stored)) {
          // Niemals still ersetzen: Ein neuer Schlüssel würde eine bereits
          // verschlüsselte Datei unwiederbringlich unlesbar machen.
          throw new Error('Der gespeicherte SQLCipher-Schlüssel ist ungültig.');
        }
        return stored;
      }

      const bytes = await dependencies.randomBytes(KEY_BYTES);
      if (bytes.byteLength !== KEY_BYTES) {
        throw new Error(`Die Zufallsquelle lieferte nicht ${KEY_BYTES} Bytes.`);
      }

      const key = bytesToHex(bytes);
      await dependencies.storage.setItem(DATABASE_KEY_STORAGE_KEY, key);
      return key;
    })();

    try {
      return await loading;
    } finally {
      loading = null;
    }
  };
}

function loadNativeDependencies(): DatabaseKeyDependencies {
  try {
    const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
    const Crypto = require('expo-crypto') as typeof import('expo-crypto');

    return {
      storage: {
        getItem: (key) => SecureStore.getItemAsync(key),
        setItem: (key, value) =>
          SecureStore.setItemAsync(key, value, {
            keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
          }),
        removeItem: (key) => SecureStore.deleteItemAsync(key),
      },
      randomBytes: (byteCount) => Crypto.getRandomBytesAsync(byteCount),
    };
  } catch {
    throw new Error(REBUILD_HINT);
  }
}

let nativeManager: ReturnType<typeof createDatabaseKeyManager> | null = null;

/** Liefert den stabilen 256-Bit-Datenbankschlüssel, ohne ihn zu protokollieren. */
export function getOrCreateDatabaseEncryptionKey(): Promise<string> {
  nativeManager ??= createDatabaseKeyManager(loadNativeDependencies());
  return nativeManager();
}

/** Erst nach bestätigter Löschung aller verschlüsselten DB-Dateien aufrufen. */
export async function deleteDatabaseEncryptionKey(): Promise<void> {
  await loadNativeDependencies().storage.removeItem(DATABASE_KEY_STORAGE_KEY);
  nativeManager = null;
}

/** SQLCipher-Raw-Key-Syntax; akzeptiert ausschließlich intern erzeugte 256-Bit-Schlüssel. */
export function toSqlCipherKeyPragma(key: string): string {
  if (!KEY_HEX_PATTERN.test(key)) throw new Error('Ungültiger SQLCipher-Schlüssel.');
  return `PRAGMA key = "x'${key}'"`;
}

function toSqlCipherRawKey(key: string): string {
  if (!KEY_HEX_PATTERN.test(key)) throw new Error('Ungültiger SQLCipher-Schlüssel.');
  return `"x'${key}'"`;
}

export type CipherDatabase = {
  execAsync(source: string): Promise<void>;
  getFirstAsync<T>(source: string, params: (string | number | null)[]): Promise<T | null>;
  closeAsync(): Promise<void>;
};

type DatabaseSnapshot = {
  schemaVersion: number;
  ownerUserId: string | null;
  outboxCount: number;
};

export type DatabaseEncryptionCutoverDependencies<
  TDatabase extends CipherDatabase = CipherDatabase,
> = {
  files: DatabaseFileOps;
  mainFileName: string;
  encryptedNextFileName: string;
  plaintextRecoveryFileName: string;
  openPlaintext(fileName: string): Promise<TDatabase>;
  /** Muss den Schlüssel direkt nach dem nativen Open setzen und verifizieren. */
  openEncrypted(fileName: string, key: string): Promise<TDatabase>;
};

function scalarNumber(row: Record<string, unknown> | null): number | null {
  if (!row) return null;
  const value = Object.values(row)[0];
  return typeof value === 'number' ? value : null;
}

function scalarString(row: Record<string, unknown> | null): string | null {
  if (!row) return null;
  const value = Object.values(row)[0];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

async function assertCipherRuntime(
  db: CipherDatabase,
  schema: 'main' | 'encrypted' = 'main',
): Promise<void> {
  const prefix = schema === 'main' ? '' : `${schema}.`;
  const cipherStatus = scalarNumber(
    await db.getFirstAsync<Record<string, unknown>>(`PRAGMA ${prefix}cipher_status`, []),
  );
  if (cipherStatus === 1) return;
  if (cipherStatus === 0) {
    throw new Error('SQLCipher ist für diesen Datenbank-Handle nicht aktiv.');
  }

  // Expo SDK 57 vendort SQLCipher 4.7.0; cipher_status kam erst mit 4.12.
  // In diesem klar erkennbaren Legacy-Fall beweist cipher_version zumindest,
  // dass nicht versehentlich gegen normales SQLite gebaut wurde. Der direkt
  // folgende Header-Read beweist anschließend den konkreten Key.
  let cipherVersion = scalarString(
    await db.getFirstAsync<Record<string, unknown>>(`PRAGMA ${prefix}cipher_version`, []),
  );
  if (!cipherVersion && schema !== 'main') {
    // 4.7 kann das Schema-Präfix für dieses Custom-PRAGMA ignorieren. Das
    // unabhängige Keyed-Reopen des Attachments prüft weiter unten die Datei.
    cipherVersion = scalarString(
      await db.getFirstAsync<Record<string, unknown>>('PRAGMA cipher_version', []),
    );
  }
  if (!cipherVersion) {
    throw new Error('SQLCipher ist in diesem nativen Build nicht aktiv.');
  }
}

/**
 * Setzt den Raw-Key als allererstes Statement und bricht ab, wenn der Build
 * SQLCipher nicht wirklich enthält oder die Datei mit diesem Key unlesbar ist.
 */
export async function keyAndVerifyDatabase(db: CipherDatabase, key: string): Promise<void> {
  await db.execAsync(toSqlCipherKeyPragma(key));
  await assertCipherRuntime(db);

  // cipher_status bestätigt den Handle, nicht den Schlüssel für eine schon
  // existierende Datei. Erst der Header-Read beweist, dass der Key stimmt.
  await db.getFirstAsync('select count(*) as count from sqlite_master', []);
}

async function tableExists(db: CipherDatabase, schema: 'main' | 'encrypted', table: string) {
  const row = await db.getFirstAsync<{ present: number }>(
    `select 1 as present from ${schema}.sqlite_master where type = 'table' and name = ?`,
    [table],
  );
  return row?.present === 1;
}

async function readSnapshot(
  db: CipherDatabase,
  schema: 'main' | 'encrypted' = 'main',
): Promise<DatabaseSnapshot> {
  const schemaVersion = scalarNumber(
    await db.getFirstAsync<Record<string, unknown>>(`PRAGMA ${schema}.user_version`, []),
  );
  if (schemaVersion === null || !Number.isSafeInteger(schemaVersion) || schemaVersion < 0) {
    throw new Error('SQLite-Schemaversion konnte nicht gelesen werden.');
  }

  const hasAppMeta = await tableExists(db, schema, 'app_meta');
  const owner = hasAppMeta
    ? await db.getFirstAsync<{ value: string | null }>(
        `select value from ${schema}.app_meta where key = ?`,
        ['user_id'],
      )
    : null;

  const hasOutbox = await tableExists(db, schema, 'outbox');
  const outbox = hasOutbox
    ? await db.getFirstAsync<{ count: number }>(
        `select count(*) as count from ${schema}.outbox`,
        [],
      )
    : null;

  return {
    schemaVersion,
    ownerUserId: owner?.value ?? null,
    outboxCount: outbox?.count ?? 0,
  };
}

function assertSameSnapshot(source: DatabaseSnapshot, target: DatabaseSnapshot): void {
  if (
    source.schemaVersion !== target.schemaVersion ||
    source.ownerUserId !== target.ownerUserId ||
    source.outboxCount !== target.outboxCount
  ) {
    throw new Error(
      'SQLCipher-Export hat Schema, Ownership oder Outbox nicht vollständig erhalten.',
    );
  }
}

function escapeSqlPath(path: string): string {
  return path.replace(/'/g, "''");
}

async function deleteSidecars(files: DatabaseFileOps, fileName: string): Promise<void> {
  for (const suffix of ['-wal', '-shm', '-journal']) {
    await files.delete(`${fileName}${suffix}`);
  }
}

async function closeQuietly(db: CipherDatabase | null): Promise<void> {
  if (!db) return;
  try {
    await db.closeAsync();
  } catch {
    // Der ursprüngliche Fehler ist aussagekräftiger als ein Folgefehler beim Schließen.
  }
}

async function exportPlaintextToEncrypted(
  source: CipherDatabase,
  targetPath: string,
  key: string,
  sourceSnapshot: DatabaseSnapshot,
): Promise<DatabaseSnapshot> {
  const escapedTargetPath = escapeSqlPath(targetPath);
  let attached = false;

  try {
    await source.execAsync(
      `ATTACH DATABASE '${escapedTargetPath}' AS encrypted KEY ${toSqlCipherRawKey(key)}`,
    );
    attached = true;

    await assertCipherRuntime(source, 'encrypted');

    await source.getFirstAsync("select sqlcipher_export('encrypted') as exported", []);
    // sqlcipher_export überträgt user_version laut SQLCipher-Dokumentation nicht.
    await source.execAsync(`PRAGMA encrypted.user_version = ${sourceSnapshot.schemaVersion}`);

    const targetSnapshot = await readSnapshot(source, 'encrypted');
    assertSameSnapshot(sourceSnapshot, targetSnapshot);

    const integrity = await source.getFirstAsync<Record<string, unknown>>(
      'PRAGMA encrypted.quick_check',
      [],
    );
    if (!integrity || !Object.values(integrity).includes('ok')) {
      throw new Error('Das temporäre SQLCipher-Ziel hat den Integritätscheck nicht bestanden.');
    }

    return sourceSnapshot;
  } finally {
    if (attached) {
      try {
        await source.execAsync('DETACH DATABASE encrypted');
      } catch {
        // Ein Exportfehler bleibt die primäre Ursache. Die Temp-Datei wird verworfen.
      }
    }
  }
}

async function restorePlaintextRecovery(
  dependencies: DatabaseEncryptionCutoverDependencies,
): Promise<void> {
  const { files, mainFileName, plaintextRecoveryFileName } = dependencies;
  if (files.exists(mainFileName)) await files.delete(mainFileName);
  await deleteSidecars(files, mainFileName);
  await files.move(plaintextRecoveryFileName, mainFileName);
}

async function cleanupCommittedCutover(
  files: DatabaseFileOps,
  encryptedNextFileName: string,
  plaintextRecoveryFileName: string,
): Promise<void> {
  // Ab hier ist die verschlüsselte main validiert und damit committed. Cleanup
  // darf diesen Zustand nie wieder zurückrollen. Übrig gebliebene Dateien
  // werden beim nächsten Start erneut best-effort bereinigt.
  try {
    await files.delete(plaintextRecoveryFileName);
  } catch {
    // Recovery enthält dieselben validierten Daten und darf bis zum Restart bleiben.
  }
  try {
    await files.delete(encryptedNextFileName);
    await deleteSidecars(files, encryptedNextFileName);
  } catch {
    // Post-Commit-Cleanup ist nicht Teil der Swap-Transaktion.
  }
}

/**
 * Konvertiert eine bestehende Klartextdatei mit sqlcipher_export und ersetzt
 * sie erst, nachdem Snapshot, quick_check und ein unabhängiges Keyed-Open
 * erfolgreich waren. Jeder Fehler vor dem Swap lässt die Quelle am Platz;
 * jeder Fehler während des Swaps stellt das Klartext-Recovery wieder her.
 */
export async function migratePlaintextDatabase<TDatabase extends CipherDatabase>(
  dependencies: DatabaseEncryptionCutoverDependencies<TDatabase>,
  key: string,
): Promise<TDatabase> {
  const {
    files,
    mainFileName,
    encryptedNextFileName,
    plaintextRecoveryFileName,
    openPlaintext,
    openEncrypted,
  } = dependencies;

  await files.delete(encryptedNextFileName);
  await deleteSidecars(files, encryptedNextFileName);

  let source: TDatabase | null = null;
  let verifiedTarget: TDatabase | null = null;
  let sourceSnapshot: DatabaseSnapshot;

  try {
    source = await openPlaintext(mainFileName);
    // Read-only Formatnachweis MUSS vor WAL-Checkpoint, ATTACH oder jeder
    // anderen Mutation liegen. Eine verschlüsselte Datei mit falschem Key
    // scheitert hier und bleibt einschließlich ihrer Sidecars unangetastet.
    sourceSnapshot = await readSnapshot(source);
    // Alle WAL-Seiten müssen vor dem Dateitausch in der Hauptdatei liegen.
    await source.execAsync('PRAGMA wal_checkpoint(TRUNCATE)');
    await exportPlaintextToEncrypted(
      source,
      files.path(encryptedNextFileName),
      key,
      sourceSnapshot,
    );
    await source.closeAsync();
    source = null;

    verifiedTarget = await openEncrypted(encryptedNextFileName, key);
    assertSameSnapshot(sourceSnapshot, await readSnapshot(verifiedTarget));
    await verifiedTarget.closeAsync();
    verifiedTarget = null;
  } catch (error) {
    await closeQuietly(verifiedTarget);
    await closeQuietly(source);
    await files.delete(encryptedNextFileName);
    await deleteSidecars(files, encryptedNextFileName);
    throw error;
  }

  await deleteSidecars(files, mainFileName);
  await files.delete(plaintextRecoveryFileName);
  await files.move(mainFileName, plaintextRecoveryFileName);

  try {
    await files.move(encryptedNextFileName, mainFileName);
  } catch (error) {
    if (files.exists(plaintextRecoveryFileName)) {
      await restorePlaintextRecovery(dependencies);
    }
    await files.delete(encryptedNextFileName);
    await deleteSidecars(files, encryptedNextFileName);
    throw error;
  }

  let active: TDatabase | null = null;
  try {
    active = await openEncrypted(mainFileName, key);
    assertSameSnapshot(sourceSnapshot, await readSnapshot(active));
  } catch (error) {
    await closeQuietly(active);
    await restorePlaintextRecovery(dependencies);
    await files.delete(encryptedNextFileName);
    await deleteSidecars(files, encryptedNextFileName);
    throw error;
  }

  await cleanupCommittedCutover(files, encryptedNextFileName, plaintextRecoveryFileName);
  if (!active) throw new Error('Verschlüsselte Datenbank konnte nicht aktiviert werden.');
  return active;
}

async function reconcileInterruptedCutover<TDatabase extends CipherDatabase>(
  dependencies: DatabaseEncryptionCutoverDependencies<TDatabase>,
  key: string,
): Promise<TDatabase | null> {
  const {
    files,
    mainFileName,
    encryptedNextFileName,
    plaintextRecoveryFileName,
    openPlaintext,
    openEncrypted,
  } = dependencies;

  if (!files.exists(plaintextRecoveryFileName)) {
    await files.delete(encryptedNextFileName);
    await deleteSidecars(files, encryptedNextFileName);
    return null;
  }

  if (!files.exists(mainFileName)) {
    await files.move(plaintextRecoveryFileName, mainFileName);
    await files.delete(encryptedNextFileName);
    await deleteSidecars(files, encryptedNextFileName);
    return null;
  }

  let encrypted: TDatabase | null = null;
  try {
    encrypted = await openEncrypted(mainFileName, key);
  } catch (error) {
    await closeQuietly(encrypted);
    let plaintext: TDatabase | null = null;
    try {
      // Ein fehlgeschlagenes Löschen einer älteren Recovery kann noch vor dem
      // eigentlichen Swap abbrechen. Dann ist `main` weiterhin die eindeutige
      // Klartextquelle. Ausschließlich read-only prüfen: kein Checkpoint, kein
      // ATTACH und keine Dateibewegung, solange das Format nicht bewiesen ist.
      plaintext = await openPlaintext(mainFileName);
      await readSnapshot(plaintext);
      const integrity = await plaintext.getFirstAsync<Record<string, unknown>>(
        'PRAGMA quick_check',
        [],
      );
      if (!integrity || !Object.values(integrity).includes('ok')) {
        throw new Error('Die Klartextquelle hat den Integritätscheck nicht bestanden.');
      }
      await plaintext.closeAsync();
      plaintext = null;

      // `main` bleibt autoritativ. Stale Hilfsdateien sind entbehrlich; ein
      // erneuter Cleanup-Fehler darf die Quelle aber weiterhin nicht berühren.
      try {
        await files.delete(plaintextRecoveryFileName);
      } catch {
        // Der folgende normale Cutover versucht die Löschung erneut.
      }
      try {
        await files.delete(encryptedNextFileName);
        await deleteSidecars(files, encryptedNextFileName);
      } catch {
        // migratePlaintextDatabase bereinigt das Temp-Ziel vor dem Export erneut.
      }
      return null;
    } catch (plaintextError) {
      await closeQuietly(plaintext);
      // Weder keyed noch als Klartext eindeutig lesbar. In diesem Zustand ist
      // kein Sieger beweisbar; beide Dateien bleiben unverändert erhalten.
      throw new Error(
        'SQLCipher-Cutover-Zustand ist mehrdeutig; main und Recovery bleiben erhalten.',
        { cause: new AggregateError([error, plaintextError]) },
      );
    }
  }

  // Eine keyed lesbare main ist bereits das vor dem atomaren Swap unabhängig
  // validierte Ziel und damit committed. Recovery darf inzwischen veraltet
  // sein, weil die App main nach einem fehlgeschlagenen Cleanup weiter nutzt.
  await cleanupCommittedCutover(files, encryptedNextFileName, plaintextRecoveryFileName);
  return encrypted;
}

/** Öffnet eine verschlüsselte DB oder führt genau einmal den sicheren Klartext-Cutover aus. */
export async function openEncryptedDatabaseWithCutover<TDatabase extends CipherDatabase>(
  dependencies: DatabaseEncryptionCutoverDependencies<TDatabase>,
  key: string,
): Promise<TDatabase> {
  const recovered = await reconcileInterruptedCutover(dependencies, key);
  if (recovered) return recovered;

  if (!dependencies.files.exists(dependencies.mainFileName)) {
    return dependencies.openEncrypted(dependencies.mainFileName, key);
  }

  try {
    return await dependencies.openEncrypted(dependencies.mainFileName, key);
  } catch {
    // Entweder eine alte Klartextdatei oder eine verschlüsselte Datei mit
    // verlorenem/falschem Key. Nur ein erfolgreicher Klartext-Read darf den
    // Export starten; andernfalls bleiben Datei und Recovery unangetastet.
    return migratePlaintextDatabase(dependencies, key);
  }
}
