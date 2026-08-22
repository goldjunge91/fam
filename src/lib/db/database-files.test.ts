import { DATABASE_FILE_NAMES } from '@/lib/db/database-files';

describe('SQLite-Baseline-Dateien fuer Issue #223', () => {
  it('oeffnet weder die alte Hauptdatenbank noch den alten OFF-Dump', () => {
    expect(DATABASE_FILE_NAMES).toEqual({
      main: 'fam-v2.db',
      offDump: 'off-dump-v2.db',
    });
  });
});
