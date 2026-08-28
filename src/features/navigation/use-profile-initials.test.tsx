import { renderHook } from '@testing-library/react-native';

import { useProfileInitials } from '@/features/navigation/use-profile-initials';

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({
    session: { user: { id: 'user-1', email: 'max.mustermann@fam.app' } },
  }),
}));

jest.mock('@/features/profile/api', () => ({
  useProfile: () => ({
    data: { display_name: 'Max Mustermann' },
  }),
}));

describe('useProfileInitials', () => {
  it('erzeugt Initialen aus dem Anzeigenamen', async () => {
    const { result } = await renderHook(() => useProfileInitials());

    expect(result.current).toBe('MM');
  });
});
