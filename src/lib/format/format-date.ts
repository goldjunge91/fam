/**
 * ISO-Datums- und Zeitformatierung an einer Stelle.
 *
 * Bisher lagen acht fast gleichlautende Helfer modulprivat in
 * `components/forms/date-wheel-field(.android).tsx` und
 * `time-wheel-field(.android).tsx` sowie in den Feature-Dateien für
 * Kalorien-Tagebuch, Essensplan-Dashboard, Rezept-Tagebuch und
 * Einkaufsabschluss. Sie werden hier gebündelt, damit Datum und Uhrzeit an
 * genau einer Stelle formatiert werden.
 *
 * Die Formatierung nutzt bewusst lokale Datumsmethoden: Ein Tag hat keine
 * Uhrzeit, und `toISOString()` würde über UTC verschieben. Wer ein Datum aus
 * einer Zeichenkette parst, muss `new Date(year, month - 1, day)` bauen —
 * `new Date('2026-01-01')` interpretiert JavaScript als UTC und liefert in
 * westlichen Zonen den 31.12. des Vorjahres. `parseIsoDate` macht das korrekt.
 */

/** `Date` → `YYYY-MM-DD` in lokaler Zeit. */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** `YYYY-MM-DD` → `DD.MM.YYYY` für die Anzeige. */
export function formatIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year}`;
}

/** `YYYY-MM-DD` → lokales `Date` mit Mitternacht. */
export function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** `Date` → `HH:MM` in lokaler Zeit. */
export function toTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * `HH:MM` → lokales `Date` auf den heutigen Tag. Eine leere oder unparsbare
 * Eingabe ergibt `00:00` statt `NaN`, damit der Picker einen gültigen Wert zeigt.
 */
export function fromTime(value: string): Date {
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return date;
}
