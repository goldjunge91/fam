import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';

import { colorsLight } from '@/components/theme';
import { ProfileButton } from './profile-button';

const mockSignAvatarUrl = jest.fn();

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'viewer' } } }),
}));
jest.mock('@/lib/config/env', () => ({ env: { supabaseUrl: 'https://example.supabase.co' } }));
jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: () => ({ storage: { from: () => ({ createSignedUrl: mockSignAvatarUrl }) } }),
}));

const avatarReference =
  'https://example.supabase.co/storage/v1/object/public/avatars/owner/avatar.jpg?t=123';

describe('ProfileButton', () => {
  it('zeigt die Avatar-URL anstelle der Initialen', async () => {
    mockSignAvatarUrl.mockResolvedValue({
      data: {
        signedUrl: 'https://example.supabase.co/storage/v1/object/sign/avatars/owner/avatar.jpg',
      },
      error: null,
    });
    const queryClient = new QueryClient();
    await render(
      <QueryClientProvider client={queryClient}>
        <ProfileButton initials="MM" avatarUrl={avatarReference} onPress={jest.fn()} />
      </QueryClientProvider>,
    );

    expect(screen.queryByText('MM')).not.toBeOnTheScreen();
    expect(screen.getByLabelText('Profilbild')).toHaveProp('accessible', false);
    await waitFor(() => expect(mockSignAvatarUrl).toHaveBeenCalledWith('owner/avatar.jpg', 300));

    const button = screen.getByRole('button', { name: 'Profil öffnen' });
    expect(button.props.className).toBeUndefined();
    expect(typeof button.props.style).not.toBe('function');
    expect(button).toHaveStyle({
      width: 58,
      height: 58,
      backgroundColor: colorsLight.accent,
    });
    queryClient.clear();
  });
});
