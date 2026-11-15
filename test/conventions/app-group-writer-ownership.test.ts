import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(__dirname, '..', '..');

function readProjectFile(relativePath: string): string {
  return readFileSync(resolve(projectRoot, relativePath), 'utf8');
}

const databaseFilesSource = readProjectFile('src/lib/db/database-files.ts');
const encryptionSource = readProjectFile('src/lib/db/local-database-encryption.ts');
const keyStoreSource = readProjectFile('src/lib/db/database-key-file-store.ts');
const householdSource = readProjectFile('src/features/household/active-household-store.ts');
const watchPublisherSource = readProjectFile(
  'src/features/shopping-list/watch/watch-snapshot-publisher.ios.ts',
);
const appRuntimeSource = readProjectFile('src/features/app-shell/initialize-app-runtime.ts');
const watchTargetSource = readProjectFile('targets/watch/shopping-model.swift');

describe('App-Group writer ownership', () => {
  it('protects database file moves/deletes and keeps one lease through cutover cleanup', () => {
    expect(databaseFilesSource).toContain('withSharedStoreWriter');
    expect(databaseFilesSource).toContain('db-file.delete');
    expect(databaseFilesSource).toContain('db-file.move');
    expect(encryptionSource).toContain('writerOwner?: SharedStoreWriterOwner');
    expect(encryptionSource).toContain("'db.cutover.source'");
    expect(encryptionSource).toContain('ATTACH DATABASE');
    expect(encryptionSource).toContain('DETACH DATABASE encrypted');
  });

  it('protects active-household and cleanup-marker shared files without wrapping private stores', () => {
    expect(householdSource).toContain('withSharedStoreWriterSync');
    expect(householdSource).toContain('active-household.context');
    expect(householdSource).toContain('temporary.moveSync(file, { overwrite: true })');
    expect(householdSource).not.toContain('file.write(');
    expect(keyStoreSource).toContain('database-key.cleanup-marker.write');
    expect(keyStoreSource).toContain('database-key.file.delete');
    expect(householdSource).toContain('AsyncStorage');
  });

  it('ends the Watch file lease before framework connectivity IPC', () => {
    expect(watchPublisherSource).toContain('withSharedStoreWriterSync');
    const leaseScope = watchPublisherSource.indexOf('withSharedStoreWriterSync');
    const connectivityPublish = watchPublisherSource.indexOf('publishSnapshot');
    expect(leaseScope).toBeGreaterThanOrEqual(0);
    expect(connectivityPublish).toBeGreaterThan(leaseScope);
  });

  it('keeps WidgetKit timeline handoff and extension-owned Watch storage outside the main-app owner', () => {
    expect(appRuntimeSource).toContain('updateSnapshot');
    expect(appRuntimeSource).not.toMatch(
      /SharedStoreWriter|beginForegroundWriter|withSharedStoreWriter/,
    );
    expect(watchTargetSource).toContain('UserDefaults(suiteName: Self.appGroup)');
    expect(watchTargetSource).toContain('defaults.set(json, forKey: snapshotKey)');
    expect(watchTargetSource).not.toContain('FamSharedStoreLifecycle');
  });
});
