import { Platform } from 'react-native';
import { FAM_KEYCHAIN_ACCESS_GROUP } from '@/lib/apple/shared-app-group';
import {
  requireSharedStoreWriter,
  type SharedStoreWriterLease,
  type SharedStoreWriterOwner,
  sharedStoreWriterOwner,
} from '@/lib/apple/shared-store-lifecycle';
import type { DatabaseFileOps } from '@/lib/db/database-files';
import {
  createSharedKeyFileStore,
  DATABASE_KEY_CLEANUP_MARKER_KEY,
  DATABASE_KEY_CLEANUP_MARKER_VALUE,
} from '@/lib/db/database-key-file-store';
import { addDiagnosticStep } from '@/lib/telemetry';

export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const DATABASE_KEY_STORAGE_KEY = 'fam.database.sqlcipher-key.v1';
const KEY_BYTES = 32;
const KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

const REBUILD_HINT =
  'Die nativen Module ExpoSecureStore oder ExpoCrypto fehlen im Development Build. ' +
  'Ein Metro-Reload reicht nicht; der Development Build muss neu erstellt werden.';

type DatabaseKeyDependencies = {
  storage: KeyValueStore;
  randomBytes(byteCount: number): Promise<Uint8Array>;
  /** Alte App-Group-Kopie für Einmalmigration und den wiederholbaren Cleanup-Marker. */
  mirror?: KeyValueStore;
};

let databaseKeyCleanupBlocked = false;

function getDatabaseKeyStores(
  dependencies: Pick<DatabaseKeyDependencies, 'storage' | 'mirror'>,
): KeyValueStore[] {
  return dependencies.mirror ? [dependencies.storage, dependencies.mirror] : [dependencies.storage];
}

async function runKeyStoreOperations(
  stores: KeyValueStore[],
  operation: (store: KeyValueStore) => Promise<void>,
  message: string,
): Promise<void> {
  const results = await Promise.allSettled(
    stores.map((store) => Promise.resolve().then(() => operation(store))),
  );
  const failure = results.find((result) => result.status === 'rejected');
  if (failure?.status === 'rejected') {
    throw new Error(message, { cause: failure.reason });
  }
}

async function retryPendingDatabaseKeyCleanup(
  dependencies: DatabaseKeyDependencies,
): Promise<void> {
  const stores = getDatabaseKeyStores(dependencies);
  const markers = await Promise.all(
    stores.map((store) => store.getItem(DATABASE_KEY_CLEANUP_MARKER_KEY)),
  );
  if (!markers.some((marker) => marker === DATABASE_KEY_CLEANUP_MARKER_VALUE)) {
    if (databaseKeyCleanupBlocked) {
      throw new Error(
        'SQLCipher-Key-Cleanup ist unvollständig und besitzt keinen lesbaren Marker.',
      );
    }
    return;
  }

  await runKeyStoreOperations(
    stores,
    (store) => store.removeItem(DATABASE_KEY_STORAGE_KEY),
    'Der vorherige SQLCipher-Key-Cleanup konnte nicht abgeschlossen werden.',
  );
  await runKeyStoreOperations(
    stores,
    (store) => store.removeItem(DATABASE_KEY_CLEANUP_MARKER_KEY),
    'Der SQLCipher-Key-Cleanup-Marker konnte nicht entfernt werden.',
  );
  databaseKeyCleanupBlocked = false;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createDatabaseKeyManager(dependencies: DatabaseKeyDependencies) {
  let loading: Promise<string> | null = null;

  return async function getOrCreateDatabaseKey(): Promise<string> {
    loading ??= (async () => {
      await retryPendingDatabaseKeyCleanup(dependencies);

      const stored = await dependencies.storage.getItem(DATABASE_KEY_STORAGE_KEY);
      if (stored !== null) {
        if (!KEY_HEX_PATTERN.test(stored)) {
          // Niemals still ersetzen: Ein neuer Schlüssel würde eine bereits
          // verschlüsselte Datei unwiederbringlich unlesbar machen.
          throw new Error('Der gespeicherte SQLCipher-Schlüssel ist ungültig.');
        }
        // Der gemeinsame Keychain-Eintrag ist dauerhaft; Klartextreste aus
        // älteren Versionen können jetzt entfernt werden.
        await dependencies.mirror?.removeItem(DATABASE_KEY_STORAGE_KEY);
        return stored;
      }

      // Vorhandenen Datei-Key zuerst sicher in die Keychain migrieren — sonst
      // würde die bestehende verschlüsselte Datei unlesbar. Danach wird die
      // Klartextkopie entfernt.
      const mirrored = await dependencies.mirror?.getItem(DATABASE_KEY_STORAGE_KEY);
      if (mirrored !== null && mirrored !== undefined) {
        if (!KEY_HEX_PATTERN.test(mirrored)) {
          throw new Error('Der gespiegelte SQLCipher-Schlüssel ist ungültig.');
        }
        await dependencies.storage.setItem(DATABASE_KEY_STORAGE_KEY, mirrored);
        await dependencies.mirror?.removeItem(DATABASE_KEY_STORAGE_KEY);
        return mirrored;
      }

      const bytes = await dependencies.randomBytes(KEY_BYTES);
      if (bytes.byteLength !== KEY_BYTES) {
        throw new Error(`Die Zufallsquelle lieferte nicht ${KEY_BYTES} Bytes.`);
      }

      const key = bytesToHex(bytes);
      await dependencies.storage.setItem(DATABASE_KEY_STORAGE_KEY, key);
      await dependencies.mirror?.removeItem(DATABASE_KEY_STORAGE_KEY);
      return key;
    })();

    try {
      return await loading;
    } finally {
      loading = null;
    }
  };
}

function loadNativeDependencies(
  writerOwner: SharedStoreWriterOwner = sharedStoreWriterOwner,
): DatabaseKeyDependencies {
  try {
    const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
    const Crypto = require('expo-crypto') as typeof import('expo-crypto');

    const sharedKeychainOptions: import('expo-secure-store').SecureStoreOptions =
      Platform.OS === 'ios'
        ? {
            // Siri runs after the first device unlock and needs the same key
            // as the main app. `keychain-access-groups` in app.config.ts puts
            // both processes into this access group — the App Group alone is
            // a separate entitlement and does not grant Keychain sharing.
            keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
            accessGroup: FAM_KEYCHAIN_ACCESS_GROUP,
          }
        : {};
    const legacyKeychainOptions: import('expo-secure-store').SecureStoreOptions =
      Platform.OS === 'ios'
        ? { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }
        : {};

    return {
      storage: {
        async getItem(key) {
          const sharedValue = await SecureStore.getItemAsync(key, sharedKeychainOptions);
          if (sharedValue !== null || Platform.OS !== 'ios') return sharedValue;

          // One-time migration for installs that still keep the key in the
          // app-only keychain item. The database itself is copied before its
          // first open in the shared container.
          const legacyValue = await SecureStore.getItemAsync(key, legacyKeychainOptions);
          if (legacyValue !== null && KEY_HEX_PATTERN.test(legacyValue)) {
            await SecureStore.setItemAsync(key, legacyValue, sharedKeychainOptions);
          }
          return legacyValue;
        },
        setItem: (key, value) => SecureStore.setItemAsync(key, value, sharedKeychainOptions),
        async removeItem(key) {
          const deletions = [
            Promise.resolve().then(() => SecureStore.deleteItemAsync(key, sharedKeychainOptions)),
          ];
          if (Platform.OS === 'ios') {
            deletions.push(
              Promise.resolve().then(() => SecureStore.deleteItemAsync(key, legacyKeychainOptions)),
            );
          }

          const results = await Promise.allSettled(deletions);
          const failure = results.find((result) => result.status === 'rejected');
          if (failure?.status === 'rejected') {
            throw new Error(
              'Mindestens ein SQLCipher-Keychain-Eintrag konnte nicht gelöscht werden.',
              {
                cause: failure.reason,
              },
            );
          }
        },
      },
      randomBytes: (byteCount) => Crypto.getRandomBytesAsync(byteCount),
      mirror: Platform.OS === 'ios' ? createSharedKeyFileStore(writerOwner) : undefined,
    };
  } catch {
    throw new Error(REBUILD_HINT);
  }
}

let nativeManager: ReturnType<typeof createDatabaseKeyManager> | null = null;
let nativeManagerOwner: SharedStoreWriterOwner | null = null;

/** Liefert den stabilen 256-Bit-Datenbankschlüssel, ohne ihn zu protokollieren. */
export function getOrCreateDatabaseEncryptionKey(
  writerOwner: SharedStoreWriterOwner = sharedStoreWriterOwner,
): Promise<string> {
  if (nativeManager === null || nativeManagerOwner !== writerOwner) {
    nativeManager = createDatabaseKeyManager(loadNativeDependencies(writerOwner));
    nativeManagerOwner = writerOwner;
  }
  return nativeManager();
}

/** Erst nach bestätigter Löschung aller verschlüsselten DB-Dateien aufrufen. */
export async function deleteDatabaseEncryptionKey(
  writerOwner: SharedStoreWriterOwner = sharedStoreWriterOwner,
): Promise<void> {
  databaseKeyCleanupBlocked = true;
  const { storage, mirror } = loadNativeDependencies(writerOwner);
  const stores = getDatabaseKeyStores({ storage, mirror });
  const markerResults = await Promise.allSettled(
    stores.map((store) =>
      Promise.resolve().then(() =>
        store.setItem(DATABASE_KEY_CLEANUP_MARKER_KEY, DATABASE_KEY_CLEANUP_MARKER_VALUE),
      ),
    ),
  );
  const markerFailure = markerResults.find((result) => result.status === 'rejected');
  if (markerFailure?.status === 'rejected') {
    nativeManager = null;
    nativeManagerOwner = null;
    throw new Error(
      'Der SQLCipher-Key-Cleanup-Marker konnte nicht in allen Stores gesichert werden.',
      { cause: markerFailure.reason },
    );
  }

  try {
    await runKeyStoreOperations(
      stores,
      (store) => store.removeItem(DATABASE_KEY_STORAGE_KEY),
      'Der SQLCipher-Schlüssel konnte nicht vollständig entfernt werden.',
    );
    await runKeyStoreOperations(
      stores,
      (store) => store.removeItem(DATABASE_KEY_CLEANUP_MARKER_KEY),
      'Der SQLCipher-Key-Cleanup-Marker konnte nicht entfernt werden.',
    );
    // Keep key access blocked until every stored copy and both markers are gone.
    databaseKeyCleanupBlocked = false;
  } finally {
    nativeManager = null;
    nativeManagerOwner = null;
  }
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
  /** Writer owner for App Group cutover statements and file operations. */
  writerOwner?: SharedStoreWriterOwner;
  /** Rejected synchronously when account ownership changes during cutover. */
  assertCurrent?: () => void;
  /** Closes a handle through the caller's lifecycle registry when provided. */
  closeDatabase?(database: TDatabase): Promise<void>;
  /** Registers a raw-close retry when an attached source cannot be released. */
  retainUnresolvedSourceCleanup?: (database: TDatabase, retry: () => Promise<void>) => void;
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

async function deleteSidecars(
  files: DatabaseFileOps,
  fileName: string,
  assertCurrent?: () => void,
): Promise<void> {
  for (const suffix of ['-wal', '-shm', '-journal']) {
    assertCurrent?.();
    await files.delete(`${fileName}${suffix}`);
  }
}

function createGuardedCutoverFileOps(
  files: DatabaseFileOps,
  assertCurrent?: () => void,
): DatabaseFileOps {
  if (!assertCurrent) return files;

  return {
    exists: (fileName) => files.exists(fileName),
    path: (fileName) => files.path(fileName),
    async delete(fileName) {
      assertCurrent();
      await files.delete(fileName);
      assertCurrent();
    },
    async move(fromFileName, toFileName) {
      assertCurrent();
      await files.move(fromFileName, toFileName);
      assertCurrent();
    },
  };
}

function assertCutoverCurrent(assertCurrent?: () => void): void {
  assertCurrent?.();
}

async function closeCutoverDatabase<TDatabase extends CipherDatabase>(
  dependencies: DatabaseEncryptionCutoverDependencies<TDatabase>,
  database: TDatabase,
): Promise<void> {
  if (dependencies.closeDatabase) {
    await dependencies.closeDatabase(database);
    return;
  }
  await database.closeAsync();
}

async function closeQuietly<TDatabase extends CipherDatabase>(
  dependencies: DatabaseEncryptionCutoverDependencies<TDatabase>,
  database: TDatabase | null,
): Promise<void> {
  if (!database) return;
  try {
    await closeCutoverDatabase(dependencies, database);
  } catch {
    // Der ursprüngliche Fehler ist aussagekräftiger als ein Folgefehler beim Schließen.
  }
}

function assertCutoverWriterLease(lease?: SharedStoreWriterLease): void {
  if (lease?.signal.aborted || lease?.ended) {
    throw new Error('Die native Schreibzusicherung ist abgelaufen.');
  }
}

async function runCutoverWriter<T>(
  lease: SharedStoreWriterLease | undefined,
  operation: () => Promise<T>,
  assertCurrent?: () => void,
): Promise<T> {
  assertCutoverCurrent(assertCurrent);
  assertCutoverWriterLease(lease);
  const result = await operation();
  assertCutoverWriterLease(lease);
  assertCutoverCurrent(assertCurrent);
  return result;
}

async function exportPlaintextToEncrypted(
  source: CipherDatabase,
  targetPath: string,
  key: string,
  sourceSnapshot: DatabaseSnapshot,
  writerLease?: SharedStoreWriterLease,
  assertCurrent?: () => void,
): Promise<DatabaseSnapshot> {
  const escapedTargetPath = escapeSqlPath(targetPath);
  let attached = false;
  let primaryError: unknown;

  try {
    await runCutoverWriter(
      writerLease,
      () =>
        source.execAsync(
          `ATTACH DATABASE '${escapedTargetPath}' AS encrypted KEY ${toSqlCipherRawKey(key)}`,
        ),
      assertCurrent,
    );
    attached = true;

    await assertCipherRuntime(source, 'encrypted');
    assertCutoverWriterLease(writerLease);
    assertCutoverCurrent(assertCurrent);

    await runCutoverWriter(
      writerLease,
      () => source.getFirstAsync("select sqlcipher_export('encrypted') as exported", []),
      assertCurrent,
    );
    // sqlcipher_export überträgt user_version laut SQLCipher-Dokumentation nicht.
    await runCutoverWriter(
      writerLease,
      () => source.execAsync(`PRAGMA encrypted.user_version = ${sourceSnapshot.schemaVersion}`),
      assertCurrent,
    );

    const targetSnapshot = await readSnapshot(source, 'encrypted');
    assertCutoverWriterLease(writerLease);
    assertCutoverCurrent(assertCurrent);
    assertSameSnapshot(sourceSnapshot, targetSnapshot);

    const integrity = await source.getFirstAsync<Record<string, unknown>>(
      'PRAGMA encrypted.quick_check',
      [],
    );
    assertCutoverWriterLease(writerLease);
    assertCutoverCurrent(assertCurrent);
    if (!integrity || !Object.values(integrity).includes('ok')) {
      throw new Error('Das temporäre SQLCipher-Ziel hat den Integritätscheck nicht bestanden.');
    }
  } catch (error) {
    primaryError = error;
  }

  if (attached) {
    try {
      // Cleanup uses the lease that admitted ATTACH. It must still run after
      // expiration and must never request a replacement writer assertion.
      await source.execAsync('DETACH DATABASE encrypted');
    } catch (detachError) {
      primaryError ??= detachError;
    }
  }

  if (primaryError !== undefined) throw primaryError;
  return sourceSnapshot;
}

async function restorePlaintextRecovery<TDatabase extends CipherDatabase>(
  dependencies: DatabaseEncryptionCutoverDependencies<TDatabase>,
): Promise<void> {
  const { files, mainFileName, plaintextRecoveryFileName } = dependencies;
  const assertCurrent = dependencies.assertCurrent;
  assertCutoverCurrent(assertCurrent);
  if (files.exists(mainFileName)) await files.delete(mainFileName);
  await deleteSidecars(files, mainFileName, assertCurrent);
  await files.move(plaintextRecoveryFileName, mainFileName);
}

async function cleanupCommittedCutover(
  files: DatabaseFileOps,
  encryptedNextFileName: string,
  plaintextRecoveryFileName: string,
  assertCurrent?: () => void,
): Promise<void> {
  // Ab hier ist die verschlüsselte main validiert und damit committed. Cleanup
  // darf diesen Zustand nie wieder zurückrollen. Übrig gebliebene Dateien
  // werden beim nächsten Start erneut best-effort bereinigt.
  try {
    assertCutoverCurrent(assertCurrent);
    await files.delete(plaintextRecoveryFileName);
  } catch {
    // Recovery enthält dieselben validierten Daten und darf bis zum Restart bleiben.
  }
  try {
    assertCutoverCurrent(assertCurrent);
    await files.delete(encryptedNextFileName);
    await deleteSidecars(files, encryptedNextFileName, assertCurrent);
  } catch {
    // Post-Commit-Cleanup ist nicht Teil der Swap-Transaktion.
  }
}

export async function migratePlaintextDatabase<TDatabase extends CipherDatabase>(
  dependencies: DatabaseEncryptionCutoverDependencies<TDatabase>,
  key: string,
): Promise<TDatabase> {
  const assertCurrent = dependencies.assertCurrent;
  const files = createGuardedCutoverFileOps(dependencies.files, assertCurrent);
  const {
    mainFileName,
    encryptedNextFileName,
    plaintextRecoveryFileName,
    openPlaintext,
    openEncrypted,
  } = dependencies;

  assertCutoverCurrent(assertCurrent);
  await files.delete(encryptedNextFileName);
  await deleteSidecars(files, encryptedNextFileName, assertCurrent);

  let source: TDatabase | null = null;
  let sourceWriterLease: SharedStoreWriterLease | undefined;
  let verifiedTarget: TDatabase | null = null;
  let sourceSnapshot: DatabaseSnapshot;

  try {
    assertCutoverCurrent(assertCurrent);
    source = await openPlaintext(mainFileName);
    assertCutoverCurrent(assertCurrent);
    // Read-only Formatnachweis MUSS vor WAL-Checkpoint, ATTACH oder jeder
    // anderen Mutation liegen. Eine verschlüsselte Datei mit falschem Key
    // scheitert hier und bleibt einschließlich ihrer Sidecars unangetastet.
    sourceSnapshot = await readSnapshot(source);
    assertCutoverCurrent(assertCurrent);
    addDiagnosticStep('db.cutover.plaintext_detected', {
      operation: 'db.cutover',
      outcome: 'detected',
      outbox_count: sourceSnapshot.outboxCount,
    });
    sourceWriterLease = dependencies.writerOwner
      ? requireSharedStoreWriter(dependencies.writerOwner, 'db.cutover.source')
      : undefined;
    // Alle WAL-Seiten müssen vor dem Dateitausch in der Hauptdatei liegen.
    await runCutoverWriter(
      sourceWriterLease,
      () => source?.execAsync('PRAGMA wal_checkpoint(TRUNCATE)') ?? Promise.resolve(),
      assertCurrent,
    );
    await exportPlaintextToEncrypted(
      source,
      files.path(encryptedNextFileName),
      key,
      sourceSnapshot,
      sourceWriterLease,
      assertCurrent,
    );
    assertCutoverWriterLease(sourceWriterLease);
    assertCutoverCurrent(assertCurrent);
    await closeCutoverDatabase(dependencies, source);
    source = null;
    sourceWriterLease?.end();
    sourceWriterLease = undefined;

    assertCutoverCurrent(assertCurrent);
    verifiedTarget = await openEncrypted(encryptedNextFileName, key);
    assertCutoverCurrent(assertCurrent);
    assertSameSnapshot(sourceSnapshot, await readSnapshot(verifiedTarget));
    assertCutoverCurrent(assertCurrent);
    await closeCutoverDatabase(dependencies, verifiedTarget);
    verifiedTarget = null;
  } catch (error) {
    await closeQuietly(dependencies, verifiedTarget);
    let sourceCloseFailed = false;
    if (source) {
      const sourceToClose = source;
      const leaseToEnd = sourceWriterLease;
      try {
        // Keep the ATTACH lease through raw close. If close also fails, the
        // lease intentionally remains live and native admission stays closed.
        await closeCutoverDatabase(dependencies, sourceToClose);
        source = null;
        leaseToEnd?.end();
        sourceWriterLease = undefined;
      } catch {
        sourceCloseFailed = true;
        let resolved = false;
        dependencies.retainUnresolvedSourceCleanup?.(sourceToClose, async () => {
          if (resolved) return;
          await sourceToClose.closeAsync();
          leaseToEnd?.end();
          resolved = true;
        });
      }
    } else if (sourceWriterLease && !sourceWriterLease.ended) {
      sourceWriterLease.end();
      sourceWriterLease = undefined;
    }

    if (!sourceCloseFailed) {
      try {
        assertCutoverCurrent(assertCurrent);
        await files.delete(encryptedNextFileName);
        await deleteSidecars(files, encryptedNextFileName, assertCurrent);
      } catch {
        // A stale account leaves the temporary file for the next safe recovery.
      }
    }
    throw error;
  }

  assertCutoverCurrent(assertCurrent);
  await deleteSidecars(files, mainFileName, assertCurrent);
  await files.delete(plaintextRecoveryFileName);
  await files.move(mainFileName, plaintextRecoveryFileName);

  try {
    assertCutoverCurrent(assertCurrent);
    await files.move(encryptedNextFileName, mainFileName);
  } catch (error) {
    if (files.exists(plaintextRecoveryFileName)) {
      try {
        await restorePlaintextRecovery({ ...dependencies, files });
      } catch {
        // Preserve the original activation error and leave recovery for restart.
      }
    }
    try {
      assertCutoverCurrent(assertCurrent);
      await files.delete(encryptedNextFileName);
      await deleteSidecars(files, encryptedNextFileName, assertCurrent);
    } catch {
      // A stale account leaves the temporary file for the next safe recovery.
    }
    throw error;
  }

  let active: TDatabase | null = null;
  try {
    assertCutoverCurrent(assertCurrent);
    active = await openEncrypted(mainFileName, key);
    assertCutoverCurrent(assertCurrent);
    assertSameSnapshot(sourceSnapshot, await readSnapshot(active));
    assertCutoverCurrent(assertCurrent);
  } catch (error) {
    await closeQuietly(dependencies, active);
    try {
      assertCutoverCurrent(assertCurrent);
      await restorePlaintextRecovery({ ...dependencies, files });
      await files.delete(encryptedNextFileName);
      await deleteSidecars(files, encryptedNextFileName, assertCurrent);
    } catch {
      // Preserve the original activation error and leave recovery for restart.
    }
    throw error;
  }

  await cleanupCommittedCutover(
    files,
    encryptedNextFileName,
    plaintextRecoveryFileName,
    assertCurrent,
  );
  if (!active) throw new Error('Verschlüsselte Datenbank konnte nicht aktiviert werden.');
  addDiagnosticStep('db.cutover.completed', {
    operation: 'db.cutover',
    outcome: 'completed',
    outbox_count: sourceSnapshot.outboxCount,
  });
  return active;
}

async function reconcileInterruptedCutover<TDatabase extends CipherDatabase>(
  dependencies: DatabaseEncryptionCutoverDependencies<TDatabase>,
  key: string,
): Promise<TDatabase | null> {
  const assertCurrent = dependencies.assertCurrent;
  const files = createGuardedCutoverFileOps(dependencies.files, assertCurrent);
  const {
    mainFileName,
    encryptedNextFileName,
    plaintextRecoveryFileName,
    openPlaintext,
    openEncrypted,
  } = dependencies;

  assertCutoverCurrent(assertCurrent);
  if (!files.exists(plaintextRecoveryFileName)) {
    await files.delete(encryptedNextFileName);
    await deleteSidecars(files, encryptedNextFileName, assertCurrent);
    return null;
  }

  assertCutoverCurrent(assertCurrent);
  if (!files.exists(mainFileName)) {
    await files.move(plaintextRecoveryFileName, mainFileName);
    await files.delete(encryptedNextFileName);
    await deleteSidecars(files, encryptedNextFileName, assertCurrent);
    return null;
  }

  let encrypted: TDatabase | null = null;
  try {
    assertCutoverCurrent(assertCurrent);
    encrypted = await openEncrypted(mainFileName, key);
    assertCutoverCurrent(assertCurrent);
  } catch (error) {
    await closeQuietly(dependencies, encrypted);
    let plaintext: TDatabase | null = null;
    try {
      // Ein fehlgeschlagenes Löschen einer älteren Recovery kann noch vor dem
      // eigentlichen Swap abbrechen. Dann ist `main` weiterhin die eindeutige
      // Klartextquelle. Ausschließlich read-only prüfen: kein Checkpoint, kein
      // ATTACH und keine Dateibewegung, solange das Format nicht bewiesen ist.
      assertCutoverCurrent(assertCurrent);
      plaintext = await openPlaintext(mainFileName);
      assertCutoverCurrent(assertCurrent);
      await readSnapshot(plaintext);
      assertCutoverCurrent(assertCurrent);
      const integrity = await plaintext.getFirstAsync<Record<string, unknown>>(
        'PRAGMA quick_check',
        [],
      );
      assertCutoverCurrent(assertCurrent);
      if (!integrity || !Object.values(integrity).includes('ok')) {
        throw new Error('Die Klartextquelle hat den Integritätscheck nicht bestanden.');
      }
      await closeCutoverDatabase(dependencies, plaintext);
      plaintext = null;

      // `main` bleibt autoritativ. Stale Hilfsdateien sind entbehrlich; ein
      // erneuter Cleanup-Fehler darf die Quelle aber weiterhin nicht berühren.
      try {
        assertCutoverCurrent(assertCurrent);
        await files.delete(plaintextRecoveryFileName);
      } catch {
        // Der folgende normale Cutover versucht die Löschung erneut.
      }
      try {
        assertCutoverCurrent(assertCurrent);
        await files.delete(encryptedNextFileName);
        await deleteSidecars(files, encryptedNextFileName, assertCurrent);
      } catch {
        // migratePlaintextDatabase bereinigt das Temp-Ziel vor dem Export erneut.
      }
      return null;
    } catch (plaintextError) {
      await closeQuietly(dependencies, plaintext);
      try {
        assertCutoverCurrent(assertCurrent);
      } catch {
        throw plaintextError;
      }
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
  await cleanupCommittedCutover(
    files,
    encryptedNextFileName,
    plaintextRecoveryFileName,
    assertCurrent,
  );
  return encrypted;
}

/** Öffnet eine verschlüsselte DB oder führt genau einmal den sicheren Klartext-Cutover aus. */
export async function openEncryptedDatabaseWithCutover<TDatabase extends CipherDatabase>(
  dependencies: DatabaseEncryptionCutoverDependencies<TDatabase>,
  key: string,
): Promise<TDatabase> {
  const assertCurrent = dependencies.assertCurrent;
  assertCutoverCurrent(assertCurrent);
  if (dependencies.files.exists(dependencies.plaintextRecoveryFileName)) {
    addDiagnosticStep('db.cutover.recovery_started', {
      operation: 'db.cutover.recovery',
      outcome: 'started',
    });
  }
  const recovered = await reconcileInterruptedCutover(dependencies, key);
  assertCutoverCurrent(assertCurrent);
  if (recovered) {
    addDiagnosticStep('db.cutover.recovery_completed', {
      operation: 'db.cutover.recovery',
      outcome: 'completed',
    });
    return recovered;
  }

  assertCutoverCurrent(assertCurrent);
  if (!dependencies.files.exists(dependencies.mainFileName)) {
    const opened = await dependencies.openEncrypted(dependencies.mainFileName, key);
    assertCutoverCurrent(assertCurrent);
    return opened;
  }

  try {
    assertCutoverCurrent(assertCurrent);
    const opened = await dependencies.openEncrypted(dependencies.mainFileName, key);
    assertCutoverCurrent(assertCurrent);
    return opened;
  } catch {
    // Entweder eine alte Klartextdatei oder eine verschlüsselte Datei mit
    // verlorenem/falschem Key. Nur ein erfolgreicher Klartext-Read darf den
    // Export starten; andernfalls bleiben Datei und Recovery unangetastet.
    assertCutoverCurrent(assertCurrent);
    return migratePlaintextDatabase(dependencies, key);
  }
}
