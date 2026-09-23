import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { AvatarImage, avatarStoragePath } from './avatar-image';

const mockSign = jest.fn();
let mockUserId: string | undefined = 'viewer';
jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: mockUserId ? { user: { id: mockUserId } } : null }),
}));
jest.mock('@/lib/config/env', () => ({ env: { supabaseUrl: 'https://example.supabase.co' } }));
jest.mock('@/lib/backend/supabase/client', () => ({
  getSupabase: () => ({ storage: { from: () => ({ createSignedUrl: mockSign }) } }),
}));
const reference =
  'https://example.supabase.co/storage/v1/object/public/avatars/owner/avatar.jpg?t=123';

describe('private avatar display', () => {
  beforeEach(() => {
    mockUserId = 'viewer';
    mockSign.mockReset();
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  it('accepts existing public locators but rejects other hosts and buckets', () => {
    expect(avatarStoragePath(reference, 'https://example.supabase.co')).toBe('owner/avatar.jpg');
    expect(
      avatarStoragePath(
        reference.replace('example.supabase.co', 'evil.test'),
        'https://example.supabase.co',
      ),
    ).toBeNull();
    expect(
      avatarStoragePath(
        reference.replace('/avatars/', '/receipt-images/'),
        'https://example.supabase.co',
      ),
    ).toBeNull();
  });
  it('shows only a signed URL and clears it on sign-out', async () => {
    mockSign.mockResolvedValue({
      data: { signedUrl: 'https://example.supabase.co/signed' },
      error: null,
    });
    const client = new QueryClient();
    const tree = () => (
      <QueryClientProvider client={client}>
        <AvatarImage reference={reference} accessibilityLabel="Avatar" />
      </QueryClientProvider>
    );
    const view = await render(tree());
    expect(mockSign).toHaveBeenCalledWith('owner/avatar.jpg', 300);
    await waitFor(() =>
      expect(screen.getByLabelText('Avatar')).toHaveProp(
        'source',
        expect.arrayContaining([
          expect.objectContaining({ uri: 'https://example.supabase.co/signed' }),
        ]),
      ),
    );
    mockUserId = undefined;
    await view.rerender(tree());
    expect(screen.getByLabelText('Avatar')).toHaveProp('source', []);
    await view.unmount();
    client.clear();
  });
  it('does not fall back to a public URL on access denial', async () => {
    mockSign.mockResolvedValue({ data: null, error: new Error('denied') });
    const client = new QueryClient();
    const view = await render(
      <QueryClientProvider client={client}>
        <AvatarImage reference={reference} accessibilityLabel="Avatar" />
      </QueryClientProvider>,
    );
    expect(screen.getByLabelText('Avatar')).toHaveProp('source', []);
    await view.unmount();
    client.clear();
  });
  it('hides an expired URL even while renewal is pending', async () => {
    jest.useFakeTimers();
    mockSign
      .mockResolvedValueOnce({
        data: { signedUrl: 'https://example.supabase.co/signed' },
        error: null,
      })
      .mockImplementation(() => new Promise(() => {}));
    const client = new QueryClient();
    const view = await render(
      <QueryClientProvider client={client}>
        <AvatarImage reference={reference} accessibilityLabel="Avatar" />
      </QueryClientProvider>,
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(300_001);
    });
    expect(screen.getByLabelText('Avatar')).toHaveProp('source', []);
    await view.unmount();
    client.clear();
  });
});
