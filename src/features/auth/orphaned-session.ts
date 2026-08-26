import type { QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { isOrphanedProfileError } from '@/features/auth/orphaned-profile-error';
import { signOutAndClearLocalData } from '@/features/auth/sign-out';

export { isOrphanedProfileError } from '@/features/auth/orphaned-profile-error';

export function useSignOutOnOrphanedProfile(profileError: unknown, queryClient: QueryClient): void {
  const handledRef = useRef(false);

  useEffect(() => {
    if (!isOrphanedProfileError(profileError) || handledRef.current) return;
    handledRef.current = true;
    void signOutAndClearLocalData(queryClient);
  }, [profileError, queryClient]);
}
