export const EPOCH_START = '1970-01-01T00:00:00Z';

const TIMESTAMP_PATTERN =
  /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(\.\d+)?(Z|[+-]\d{2}(:?\d{2})?)?$/;

/** Normalisiert PostgREST-Zeitstempel auf die Millisekundenaufloesung von JS. */
export function toEpochMs(pgTimestamp: string): number {
  const match = TIMESTAMP_PATTERN.exec(pgTimestamp);

  if (!match) {
    throw new Error(`Kein gueltiger Postgres-Zeitstempel: ${JSON.stringify(pgTimestamp)}`);
  }

  const [, datePart, timePart, fraction, offset] = match;

  const millis = fraction ? fraction.slice(1, 4).padEnd(3, '0') : '000';

  let normalizedOffset = 'Z';
  if (offset && offset !== 'Z') {
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
