import type { SqlDatabase } from '@/lib/db/types';
import { attachPlaintextDatabase, plaintextAttachSql } from './plaintext-attachment';

function createDatabase() {
  const executed: string[] = [];
  const db: SqlDatabase = {
    async execAsync(source) {
      executed.push(source);
    },
    async runAsync() {
      return { changes: 0, lastInsertRowId: 0 };
    },
    async getAllAsync<T>() {
      return [] as T[];
    },
    async getFirstAsync<T>() {
      return null as T | null;
    },
    async withExclusiveTransactionAsync(task) {
      await task(db);
    },
  };
  return { db, executed };
}

describe('OFF-Klartext-Attachments', () => {
  it('setzt auf einer SQLCipher-Connection ausdrücklich einen leeren Key', async () => {
    const { db, executed } = createDatabase();

    await attachPlaintextDatabase(db, "/data/off's.db", 'off_dump', 'sqlcipher');

    expect(executed).toEqual(["ATTACH DATABASE '/data/off''s.db' AS off_dump KEY ''"]);
  });

  it('bleibt mit dem node:sqlite-Testadapter ohne SQLCipher kompatibel', async () => {
    const { db, executed } = createDatabase();

    await attachPlaintextDatabase(db, '/data/off.db', 'off_patch', 'sqlite');

    expect(executed).toEqual(["ATTACH DATABASE '/data/off.db' AS off_patch"]);
  });

  it('akzeptiert keine injizierbaren Aliasnamen', () => {
    expect(() => plaintextAttachSql('/data/off.db', 'off_dump; drop table x', 'sqlcipher')).toThrow(
      /Alias/,
    );
  });
});
