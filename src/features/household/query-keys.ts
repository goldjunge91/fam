/**
 * Praefix aller Haushaltslisten — eine Liste je Nutzer.
 *
 * Eigenes Modul statt in `api.ts`: `api.ts` importiert `triggerHouseholdsPull`
 * aus `lib/sync/household-bootstrap-sync.ts`, das umgekehrt diesen Schluessel
 * braucht — beides in `api.ts` zu halten erzeugte einen Require-Cycle
 * zwischen den beiden Dateien (Metro warnt zurecht: "uninitialized values").
 *
 * Bewusst mit dem Zwischenstueck `by-user` statt schlicht `['households', userId]`:
 * An derselben Position steht in `['households', householdId, 'members']` eine
 * Haushalts-Id. Technisch kollidiert das nicht (eine Nutzer-Id ist nie eine
 * Haushalts-Id), aber der Slot haette zwei Bedeutungen, und ein vertauschtes
 * Argument wuerde still denselben Cache-Eintrag teilen statt aufzufallen.
 */
export const HOUSEHOLDS_QUERY_KEY = ['households', 'by-user'] as const;

export function householdsQueryKey(userId: string | undefined) {
  return [...HOUSEHOLDS_QUERY_KEY, userId] as const;
}
