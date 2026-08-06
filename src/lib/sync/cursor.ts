/**
 * Zeitstempel-Parsing der Sync-Engine (#47).
 *
 * Rein: kein Netzwerk, keine Datenbank. `Date.parse` ist auf PostgRESTs rohem
 * `timestamptz`-Text nicht vertrauenswuerdig — der Text variiert zwischen `Z`
 * und `+00:00` als Offset und zwischen 0 und 6 Nachkommastellen, und Engines
 * behandeln mehr als drei Nachkommastellen unterschiedlich.
 */

/** Cursor fuer den allerersten Pull einer Entity — vor jedem echten Zeitstempel. */
export const EPOCH_START = '1970-01-01T00:00:00Z';

const TIMESTAMP_PATTERN =
  /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(\.\d+)?(Z|[+-]\d{2}(:?\d{2})?)?$/;

/**
 * Wandelt einen PostgREST-`timestamptz`-String in epoch ms.
 *
 * Kuerzt Nachkommastellen auf drei (die Aufloesungsgrenze von JS `Date`) und
 * normalisiert das Offset-Format, bevor `Date.parse` laeuft. Wirft mit dem
 * Original-String in der Meldung bei Nicht-Match — Schema-Drift soll laut
 * fehlschlagen statt still `NaN` zu produzieren, das spaeter eine
 * `integer not null`-Spalte verletzt.
 *
 * Praezisionsverlust auf Millisekunden ist sicher: Der tatsaechliche
 * Pull-Filter nutzt immer den rohen, unveraenderten String aus
 * `sync_state.last_synced_at` — diese Funktion wirkt nur auf lokale Sortierung
 * und `resolve()`s Vergleich, und beide Seiten dieses Vergleichs durchlaufen
 * dieselbe Kuerzung.
 */
export function toEpochMs(pgTimestamp: string): number {
  const match = TIMESTAMP_PATTERN.exec(pgTimestamp);

  if (!match) {
    throw new Error(`Kein gueltiger Postgres-Zeitstempel: ${JSON.stringify(pgTimestamp)}`);
  }

  const [, datePart, timePart, fraction, offset] = match;

  const millis = fraction ? fraction.slice(1, 4).padEnd(3, '0') : '000';

  let normalizedOffset = 'Z';
  if (offset && offset !== 'Z') {
    // +02, +02:00, +0200 -> +02:00
    const sign = offset[0];
    const digits = offset.slice(1).replace(':', '');
    const hours = digits.slice(0, 2);
    const minutes = digits.length >= 4 ? digits.slice(2, 4) : '00';
    normalizedOffset = `${sign}${hours}:${minutes}`;
  }

  const canonical = `${datePart}T${timePart}.${millis}${normalizedOffset}`;
  const ms = Date.parse(canonical);

  if (Number.isNaN(ms)) {
    throw new Error(`Kein gueltiger Postgres-Zeitstempel: ${JSON.stringify(pgTimestamp)}`);
  }

  return ms;
}
