import type { QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { signOutAndClearLocalData } from '@/features/auth/sign-out';
import { isOrphanedProfileError } from '@/features/profile/orphaned-profile-error';
import { reportError } from '@/lib/telemetry';

export function useSignOutOnOrphanedProfile(profileError: unknown, queryClient: QueryClient): void {
  const handledRef = useRef(false);

  useEffect(() => {
    if (!isOrphanedProfileError(profileError) || handledRef.current) return;
    handledRef.current = true;
    // Nur ein kuratierter Fehlercode wird erfasst. Die PostgREST-Fehlermeldung
    // kann Query-/Accountdetails enthalten und gehoert nicht in Telemetrie.
    reportError(new Error('Profil nicht vorhanden'), {
      operation: 'profile.orphaned',
      error_code: 'profile_missing',
    });

    const reportCleanupFailure = (): void => {
      reportError(new Error('Profil-Abmeldung konnte nicht abgeschlossen werden'), {
        operation: 'profile.orphaned.cleanup',
        error_code: 'profile_orphan_cleanup_failed',
      });
    };

    const cleanupOrphanedProfile = async (): Promise<void> => {
      try {
        const { error } = await signOutAndClearLocalData(queryClient);
        if (!error) return;
        handledRef.current = false;
        reportCleanupFailure();
      } catch {
        handledRef.current = false;
        reportCleanupFailure();
      }
    };

    void cleanupOrphanedProfile();
  }, [profileError, queryClient]);
}
