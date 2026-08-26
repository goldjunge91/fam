import { DATABASE_FILE_NAMES } from '@/lib/db/database-files';

describe('SQLite-Dateien', () => {
  it('benennt aktive Dateien und die beiden SQLCipher-Cutover-Stufen eindeutig', () => {
    expect(DATABASE_FILE_NAMES).toEqual({
      main: 'fam-v2.db',
      encryptedNext: 'fam-v2.encrypted.next.db',
      plaintextRecovery: 'fam-v2.plaintext.recovery.db',
      offDump: 'off-dump-v2.db',
    });
  });
});
