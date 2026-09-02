import { useSession } from '@/features/auth/session-provider';
import { useProfile } from '@/features/profile/api';
import { getInitials } from '@/lib/initials';

type ProfileAvatar = {
  initials: string;
  avatarUrl: string | null;
};

/** Avatar-Infos fuer den Profilbutton im Haupt-Header. */
export function useProfileAvatar(): ProfileAvatar {
  const { session } = useSession();
  const { data: profile } = useProfile(session?.user.id);
  return {
    initials: getInitials(profile?.display_name || session?.user.email),
    avatarUrl: profile?.avatar_url ?? null,
  };
}

/** Kuerzel fuer den Avatar-Kreis im Hub-Screen-Header (#150). */
export function useProfileInitials(): string {
  return useProfileAvatar().initials;
}
