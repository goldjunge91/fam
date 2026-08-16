/**
 * Parst eine SQLite-Textspalte, die eine Postgres-`text[]`-Spalte spiegelt
 * (Server-Array kommt lokal als JSON-Text an) zurueck in ein Array.
 *
 * Fehlertolerant per Design: `null`/`undefined`, kaputtes JSON oder ein
 * JSON-Wert, der kein Array ist, ergeben alle `[]` statt eines Wurfs — eine
 * fehlerhafte Zeile aus Sync oder Merge soll nicht den gesamten Read-Pfad
 * zum Absturz bringen.
 */
export function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}
