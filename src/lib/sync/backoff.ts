/**
 * Wiederholstrategie der Push-Schleife (#47).
 *
 * Rein: keine Uhr, kein Zufall. Der Verzicht auf Jitter ist Absicht — er waere
 * ohne einen injizierten Zufallsgenerator nicht testbar, und das Problem, das
 * Jitter loest (viele Clients treffen gleichzeitig ein), stellt sich bei einer
 * Familien-App nicht.
 */

/** Nach so vielen Versuchen gilt ein Eintrag als dauerhaft gescheitert. */
export const MAX_ATTEMPTS = 5;

const DELAYS_MS = [1_000, 5_000, 15_000, 60_000, 300_000] as const;

/**
 * Wartezeit vor dem naechsten Versuch, in Millisekunden.
 *
 * `attempts` ist die Zahl der bisher **gescheiterten** Versuche. Der Wert
 * waechst monoton und ist bei fuenf Minuten gedeckelt: Ohne Deckel wuerde ein
 * Eintrag nach genuegend Fehlschlaegen praktisch nie wieder versucht, und der
 * Nutzer saehe seine Aenderung nie ankommen.
 */
export function backoffDelayMs(attempts: number): number {
  const index = Math.min(Math.max(attempts, 0), DELAYS_MS.length - 1);
  return DELAYS_MS[index];
}

export type ErrorKind = 'transient' | 'permanent';

/**
 * Ein Fehler ist entweder voruebergehend oder dauerhaft — und die Einordnung
 * entscheidet ueber das Verhalten der ganzen Queue.
 *
 * Voruebergehend heisst: erneut versuchen, aber den Lauf abbrechen. Ist das
 * Netz weg, scheitert auch der naechste Eintrag; abbrechen erhaelt zudem die
 * Erstellungsreihenfolge, an der die Fremdschluessel haengen.
 *
 * Dauerhaft heisst: diesen Eintrag aufgeben und mit dem naechsten weitermachen.
 * Eine vergiftete Zeile darf die Queue nicht dauerhaft blockieren.
 *
 * **RLS-Verstoesse muessen dauerhaft sein.** Eine Zeile, deren household_id dem
 * Nutzer nicht gehoert, wird nie durchgehen; als voruebergehend behandelt
 * entstuende eine Endlosschleife im Hintergrund, mit wachsendem Zaehler und
 * ohne sichtbare Ursache.
 */
export function classifyError(status: number | null): ErrorKind {
  // Kein HTTP-Status: Die Anfrage hat den Server nicht erreicht (Flugmodus,
  // DNS, abgebrochene Verbindung). Immer voruebergehend.
  if (status === null) return 'transient';

  if (status === 408 || status === 429) return 'transient';
  if (status >= 500) return 'transient';

  return 'permanent';
}
