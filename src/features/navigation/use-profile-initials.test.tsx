import { renderHook } from '@testing-library/react-native';

import { useProfileAvatar, useProfileInitials } from '@/features/navigation/use-profile-initials';

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({
    session: { user: { id: 'user-1', email: 'max.mustermann@fam.app' } },
  }),
}));

jest.mock('@/features/profile/api', () => ({
  useProfile: () => ({
    data: { display_name: 'Max Mustermann', avatar_url: 'https://example.com/avatar.jpg' },
  }),
}));

describe('useProfileInitials', () => {
  it('erzeugt Initialen aus dem Anzeigenamen', async () => {
    const { result } = await renderHook(() => useProfileInitials());

    expect(result.current).toBe('MM');
  });

  it('liefert Initialen und Profilbild für den Header', async () => {
    const { result } = await renderHook(() => useProfileAvatar());

    expect(result.current).toEqual({
      initials: 'MM',
      avatarUrl: 'https://example.com/avatar.jpg',
    });
  });
});
