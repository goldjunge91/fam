import { resolve, type SyncSide } from '@/lib/sync/resolve';

/**
 * Die Faelle aus #49, eins zu eins.
 *
 * Ohne Datenbank, ohne Netz, ohne Uhr — `resolve` ist rein, deshalb braucht
 * keiner dieser Tests ein Testdouble.
 */

const CEILING = 10_000;

const side = (updatedAt: number, deletedAt: number | null = null, id = 'row-1'): SyncSide => ({
  id,
  updatedAt,
  deletedAt,
});

describe('resolve — Last-Write-Wins', () => {
  it('laesst remote gewinnen, wenn remote neuer ist', () => {
    expect(resolve(side(1_000), side(2_000), { clockCeiling: CEILING })).toBe('remote');
  });

  it('laesst local gewinnen, wenn local neuer ist', () => {
    expect(resolve(side(2_000), side(1_000), { clockCeiling: CEILING })).toBe('local');
  });
});

describe('resolve — Tombstone schlaegt Update', () => {
  it('laesst einen Remote-Tombstone gegen ein neueres lokales Update gewinnen', () => {
    // Ohne diese Regel taeuchte ein geloeschter Artikel wieder auf, sobald ihn
    // jemand gleichzeitig bearbeitet hat.
    const local = side(9_000);
    const remote = side(1_000, 1_000);

    expect(resolve(local, remote, { clockCeiling: CEILING })).toBe('remote');
  });

  it('laesst einen lokalen Tombstone gegen ein neueres Remote-Update gewinnen', () => {
    const local = side(1_000, 1_000);
    const remote = side(9_000);

    expect(resolve(local, remote, { clockCeiling: CEILING })).toBe('local');
  });

  it('entscheidet zwischen zwei Tombstones wieder ueber den Zeitstempel', () => {
    const local = side(1_000, 1_000);
    const remote = side(2_000, 2_000);

    expect(resolve(local, remote, { clockCeiling: CEILING })).toBe('remote');
  });
});

describe('resolve — Tiebreak bei identischem Zeitstempel', () => {
  it('ist deterministisch und liefert fuer dieselbe Zeile den Server', () => {
    // local.id === remote.id, weil es dieselbe logische Zeile ist. Der
    // id-Vergleich degeneriert damit zu "Server gewinnt" — die einzige
    // Antwort, bei der beide Geraete im selben Zustand landen.
    const local = side(5_000, null, 'row-1');
    const remote = side(5_000, null, 'row-1');

    expect(resolve(local, remote, { clockCeiling: CEILING })).toBe('remote');
  });

  it('ist symmetrisch: beide Geraete kommen zum selben Ergebnis', () => {
    // Was auf Geraet A "local" ist, ist auf Geraet B "remote". Wuerde die
    // Funktion in beiden Faellen die jeweils eigene Seite bevorzugen, liefen
    // die Geraete auseinander — genau das darf nicht passieren.
    const a = side(5_000, null, 'row-1');
    const b = side(5_000, null, 'row-1');

    const onDeviceA = resolve(a, b, { clockCeiling: CEILING });
    const onDeviceB = resolve(b, a, { clockCeiling: CEILING });

    expect(onDeviceA).toBe('remote');
    expect(onDeviceB).toBe('remote');
  });

  it('bleibt fuer verschiedene ids total und deterministisch', () => {
    const lower = side(5_000, null, 'aaa');
    const higher = side(5_000, null, 'zzz');

    expect(resolve(lower, higher, { clockCeiling: CEILING })).toBe('remote');
    expect(resolve(higher, lower, { clockCeiling: CEILING })).toBe('local');
  });
});

describe('resolve — falsch gestellte Geraeteuhr', () => {
  it('laesst eine lokale Zeile aus der Zukunft nicht dauerhaft gewinnen', () => {
    // Kern des Deadlock-Falls aus #49: Ohne Klemmung gewaenne eine Zeile mit
    // Zeitstempel im Jahr 2099 siebzig Jahre lang jeden Vergleich.
    const local = side(4_102_444_800_000); // 2100-01-01
    const remoteAfterCeiling = side(CEILING + 1);

    expect(resolve(local, remoteAfterCeiling, { clockCeiling: CEILING })).toBe('remote');
  });

  it('laesst die lokale Aenderung aber gegen aeltere Serverstaende gelten', () => {
    // Die Bearbeitung des Nutzers ist echt und wartet in der Outbox. Sie soll
    // nur nicht die Zukunft blockieren, nicht sofort verworfen werden.
    const local = side(4_102_444_800_000);
    const olderRemote = side(CEILING - 1);

    expect(resolve(local, olderRemote, { clockCeiling: CEILING })).toBe('local');
  });

  it('klemmt nur local, nie remote — der Server ist die Autoritaet', () => {
    // Ein Remote-Zeitstempel jenseits der Decke bleibt ungeklemmt und gewinnt.
    const local = side(CEILING);
    const remote = side(CEILING + 5_000);

    expect(resolve(local, remote, { clockCeiling: CEILING })).toBe('remote');
  });

  it('behandelt eine Tombstone-Entscheidung unabhaengig von der Uhr', () => {
    // Regel 1 greift vor der Klemmung: Auch mit absurdem lokalem Zeitstempel
    // gewinnt der Remote-Tombstone.
    const local = side(4_102_444_800_000);
    const remote = side(1, 1);

    expect(resolve(local, remote, { clockCeiling: CEILING })).toBe('remote');
  });
});
