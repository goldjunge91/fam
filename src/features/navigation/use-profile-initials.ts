import { useSession } from '@/features/auth/session-provider';
import { useProfile } from '@/features/profile/api';
import { getInitials } from '@/lib/initials';

/** Kuerzel fuer den Avatar-Kreis im Hub-Screen-Header (#150). */
export function useProfileInitials(): string {
  const { session } = useSession();
  const { data: profile } = useProfile(session?.user.id);
  return getInitials(profile?.display_name || session?.user.email);
}
