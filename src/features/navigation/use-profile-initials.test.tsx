import { renderHook } from '@testing-library/react-native';
import { useSession } from '@/features/auth/session-provider';
import { useProfile } from '@/features/profile/api';

import * as sharedProfileInitials from './use-profile-initials';
import * as androidProfileInitials from './use-profile-initials.android';

const implementations: readonly (readonly [string, typeof sharedProfileInitials])[] = [
  ['shared', sharedProfileInitials],
  ['Android', androidProfileInitials],
];

jest.mock('@/features/auth/session-provider', () => ({
  useSession: jest.fn(),
}));

jest.mock('@/features/profile/api', () => ({
  useProfile: jest.fn(),
}));

const mockUseSession = jest.mocked(useSession);
const mockUseProfile = jest.mocked(useProfile);

for (const [platform, profileInitials] of implementations) {
  describe(`useProfileInitials (${platform})`, () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        session: { user: { id: 'user-1', email: 'max.mustermann@fam.app' } },
      } as never);
      mockUseProfile.mockReturnValue({
        data: { display_name: 'Max Mustermann', avatar_url: 'https://example.com/avatar.jpg' },
      } as never);
    });

    it('erzeugt Initialen aus dem Anzeigenamen', async () => {
      const { result } = await renderHook(() => profileInitials.useProfileInitials());

      expect(result.current).toBe('MM');
    });

    it('liefert Initialen und Profilbild für den Header', async () => {
      const { result } = await renderHook(() => profileInitials.useProfileAvatar());

      expect(result.current).toEqual({
        initials: 'MM',
        avatarUrl: 'https://example.com/avatar.jpg',
      });
    });

    it('fällt auf die Mailadresse zurück, wenn kein Profil geladen ist', async () => {
      mockUseProfile.mockReturnValue({ data: undefined } as never);

      const { result } = await renderHook(() => profileInitials.useProfileAvatar());

      expect(result.current).toEqual({ initials: 'MA', avatarUrl: null });
    });
  });
}
