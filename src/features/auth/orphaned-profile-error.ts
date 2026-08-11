/**
 * Erkennt eine verwaiste Session: Das JWT ist noch signatur-gueltig, aber
 * `auth.users`/`profiles` fuer diese Nutzer-Id existieren serverseitig nicht
 * mehr (geloescht oder per `supabase db reset` entfernt).
 *
 * `PGRST116` ("Cannot coerce the result to a single JSON object") ist das
 * zuverlaessige Signal dafuer, weil `handle_new_user()`
 * (supabase/schemas/02_profiles.sql) als `AFTER INSERT ON auth.users`-
 * **Row**-Trigger synchron in derselben Transaktion laeuft: Es gibt keinen
 * Zeitraum, in dem ein gueltiger, frisch angemeldeter Nutzer (noch) kein
 * `profiles`-Row haette. 0 Treffer bedeuten also zwingend "Account weg",
 * nicht "kurzer Netz-Hickser" — ein echter Verbindungsfehler traegt einen
 * anderen Code (oder gar keinen).
 *
 * Eigene, dependency-freie Datei statt Teil von `orphaned-session.ts`: Diese
 * Pruefung wird auch von `api.ts` gebraucht (Retry-Option von `useProfile`),
 * und `orphaned-session.ts` importiert umgekehrt `signOutAndClearLocalData`
 * aus `sign-out.ts`, das wiederum `api.ts` importiert — ein Require-Cycle,
 * den diese Aufteilung vermeidet.
 */
export function isOrphanedProfileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'PGRST116'
  );
}
