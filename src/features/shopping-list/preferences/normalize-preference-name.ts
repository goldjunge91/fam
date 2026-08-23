/**
 * Stabilisiert Freitext fuer die Praeferenz-Identitaet. Anders als der
 * Klassifikator entfernt sie weder Diakritika noch Bindestriche.
 */
export function normalizePreferenceName(rawName: string): string {
  return rawName.trim().toLowerCase().replace(/\s+/g, ' ');
}
