import { StorageApiError } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Image } from 'expo-image';
import { AvatarImage, avatarStoragePath } from './avatar-image';

const mockSign = jest.fn();
const mockGetCachePathAsync = jest.fn();
let mockUserId: string | undefined = 'viewer';
jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: mockUserId ? { user: { id: mockUserId } } : null }),
}));
jest.mock('@/lib/config/env', () => ({ env: { supabaseUrl: 'https://example.supabase.co' } }));
jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: () => ({ storage: { from: () => ({ createSignedUrl: mockSign }) } }),
}));
const reference =
  'https://example.supabase.co/storage/v1/object/public/avatars/owner/avatar.jpg?t=123';

describe('private avatar display', () => {
  beforeEach(() => {
    mockUserId = 'viewer';
    mockSign.mockReset();
    mockGetCachePathAsync.mockReset().mockResolvedValue(null);
    Object.defineProperty(Image, 'getCachePathAsync', {
      configurable: true,
      value: mockGetCachePathAsync,
    });
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
          expect.objectContaining({
            uri: 'https://example.supabase.co/signed',
            cacheKey: `avatar:viewer:${reference}`,
          }),
        ]),
      ),
    );
    expect(screen.getByLabelText('Avatar')).toHaveProp('cachePolicy', 'disk');
    mockUserId = undefined;
    await view.rerender(tree());
    expect(screen.getByLabelText('Avatar')).toHaveProp('source', []);
    await view.unmount();
    client.clear();
  });
  it('does not use a cached image when Storage denies access', async () => {
    mockGetCachePathAsync.mockResolvedValue('/cache/avatar.jpg');
    mockSign.mockResolvedValue({ data: null, error: new StorageApiError('denied', 403, '403') });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = await render(
      <QueryClientProvider client={client}>
        <AvatarImage reference={reference} accessibilityLabel="Avatar" />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(mockSign).toHaveBeenCalled());
    await waitFor(() => expect(mockGetCachePathAsync).toHaveBeenCalled());
    expect(screen.getByLabelText('Avatar')).toHaveProp('source', []);
    await view.unmount();
    client.clear();
  });
  it('shows the locally cached private image if creating a signed URL fails', async () => {
    mockGetCachePathAsync.mockResolvedValue('/cache/avatar.jpg');
    const offlineError = new Error('offline');
    offlineError.name = 'StorageUnknownError';
    mockSign.mockResolvedValue({ data: null, error: offlineError });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await render(
      <QueryClientProvider client={client}>
        <AvatarImage reference={reference} accessibilityLabel="Avatar" />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Avatar')).toHaveProp(
        'source',
        expect.arrayContaining([expect.objectContaining({ uri: '/cache/avatar.jpg' })]),
      ),
    );
    expect(mockGetCachePathAsync).toHaveBeenCalledWith(`avatar:viewer:${reference}`);
    client.clear();
  });
  it('does not reuse a cached avatar after the reference changes', async () => {
    mockGetCachePathAsync.mockResolvedValueOnce('/cache/old-avatar.jpg').mockResolvedValue(null);
    const offlineError = new Error('offline');
    offlineError.name = 'StorageUnknownError';
    mockSign.mockResolvedValue({ data: null, error: offlineError });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const renderTree = (avatarReference: string) => (
      <QueryClientProvider client={client}>
        <AvatarImage reference={avatarReference} accessibilityLabel="Avatar" />
      </QueryClientProvider>
    );
    const view = await render(renderTree(reference));
    await waitFor(() =>
      expect(screen.getByLabelText('Avatar')).toHaveProp(
        'source',
        expect.arrayContaining([expect.objectContaining({ uri: '/cache/old-avatar.jpg' })]),
      ),
    );

    const updatedReference = reference.replace('t=123', 't=456');
    await view.rerender(renderTree(updatedReference));

    await waitFor(() =>
      expect(mockGetCachePathAsync).toHaveBeenCalledWith(`avatar:viewer:${updatedReference}`),
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
