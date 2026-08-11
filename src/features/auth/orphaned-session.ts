import type { QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { isOrphanedProfileError } from '@/features/auth/orphaned-profile-error';
import { signOutAndClearLocalData } from '@/features/auth/sign-out';

export { isOrphanedProfileError } from '@/features/auth/orphaned-profile-error';

/**
 * Meldet automatisch ab, sobald `useProfile()` eine verwaiste Session
 * erkennt — statt den Nutzer auf `/household/create` haengen zu lassen
 * (dorthin fuehrt bewusst kein "Zurueck", siehe `components/screen.tsx`), wo
 * `create_household()` an der fehlenden `profiles`-Zeile scheitert
 * (`households_created_by_fkey`).
 *
 * Kein manueller Redirect noetig: `signOutAndClearLocalData()` loest
 * `onAuthStateChange('SIGNED_OUT')` aus, `session` wird `null`, und
 * `resolveAppEntry()`s bestehende Session-Regel leitet ganz normal nach
 * `/onboarding` bzw. `/sign-in` um.
 *
 * `signOutAndClearLocalData()` selbst muss dafuer nicht angepasst werden:
 * `GoTrueClient._signOut()` ignoriert serverseitige 404/401/403-Antworten
 * bereits ("user might not exist anymore") und raeumt die lokale Session
 * trotzdem auf.
 */
export function useSignOutOnOrphanedProfile(profileError: unknown, queryClient: QueryClient): void {
  const handledRef = useRef(false);

  useEffect(() => {
    if (!isOrphanedProfileError(profileError) || handledRef.current) return;
    handledRef.current = true;
    void signOutAndClearLocalData(queryClient);
  }, [profileError, queryClient]);
}
