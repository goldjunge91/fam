import { uploadAvatarImage } from '@/features/profile/avatar-uploader';
import { uploadAvatarImage as uploadAndroidAvatarImage } from './avatar-uploader.android';

jest.mock('@/lib/config/env', () => ({ env: { supabaseUrl: 'https://example.supabase.co' } }));

const mockBytes = jest.fn();
const mockUpload = jest.fn();
const mockGetUser = jest.fn();
const mockGetPublicUrl = jest.fn();
const mockFrom = jest.fn(() => ({
  upload: mockUpload,
  getPublicUrl: mockGetPublicUrl,
}));

jest.mock('expo-file-system', () => ({
  File: jest.fn(() => ({ bytes: mockBytes })),
}));

jest.mock('@/lib/observability/debug-log', () => ({
  debugError: jest.fn(),
}));

jest.mock('@/lib/backend/supabase/client', () => ({
  getSupabase: () => ({
    auth: { getUser: mockGetUser },
    storage: { from: mockFrom },
  }),
}));

describe.each([
  ['default', uploadAvatarImage, ''],
  ['android', uploadAndroidAvatarImage, '?t=1234'],
])('uploadAvatarImage (%s)', (_platform, upload, suffix) => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpload.mockReset();
    mockBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  });

  afterEach(() => jest.restoreAllMocks());

  it('liefert nach erfolgreichem Upload eine stabilen privaten Bildverweis ohne Signatur', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1234);
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: {
        publicUrl: 'https://example.supabase.co/storage/v1/object/public/avatars/user/avatar.jpg',
      },
    });

    await expect(upload('file:///local/avatar.jpg')).resolves.toBe(
      `https://example.supabase.co/storage/v1/object/authenticated/avatars/user-1/avatar.jpg${suffix}`,
    );
    expect(mockGetPublicUrl).not.toHaveBeenCalled();
    expect(mockUpload).toHaveBeenCalledWith('user-1/avatar.jpg', new Uint8Array([1, 2, 3]), {
      contentType: 'image/jpeg',
      upsert: true,
    });
  });

  it('lehnt einen Storage-Fehler ab statt die lokale Datei-URI zurückzugeben', async () => {
    mockUpload.mockResolvedValue({ error: new Error('Upload nicht erlaubt') });

    await expect(upload('file:///local/avatar.jpg')).rejects.toThrow(
      'Profilbild konnte nicht hochgeladen werden',
    );
    expect(mockGetPublicUrl).not.toHaveBeenCalled();
  });

  it.each([null, new Error('Session abgelaufen')])(
    'verhindert Uploads ohne bestätigte Anmeldung (%s)',
    async (error) => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error });

      await expect(upload('file:///local/avatar.jpg')).rejects.toThrow(
        'Profilbild konnte nicht hochgeladen werden',
      );
      expect(mockBytes).not.toHaveBeenCalled();
      expect(mockUpload).not.toHaveBeenCalled();
    },
  );
});

describe('iOS avatar upload transport recovery', () => {
  const transportError = Object.assign(
    new Error('fetch failed: UnexpectedException: Parsen der Antwort nicht möglich'),
    { name: 'StorageUnknownError' },
  );

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpload.mockReset();
    mockBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  });

  it('retries the same image after a native response failure and requires upload confirmation', async () => {
    mockUpload
      .mockResolvedValueOnce({ error: transportError })
      .mockResolvedValueOnce({ error: null });

    await expect(uploadAvatarImage('file:///local/avatar.jpg')).resolves.toContain(
      '/authenticated/avatars/user-1/avatar.jpg',
    );
    expect(mockUpload).toHaveBeenCalledTimes(2);
    expect(mockUpload.mock.calls[1]).toEqual(mockUpload.mock.calls[0]);
    expect(mockBytes).toHaveBeenCalledTimes(1);
  });

  it('stops after three failed attempts and preserves the transport error', async () => {
    mockUpload.mockResolvedValue({ error: transportError });

    await expect(uploadAvatarImage('file:///local/avatar.jpg')).rejects.toMatchObject({
      cause: transportError,
    });
    expect(mockUpload).toHaveBeenCalledTimes(3);
  });

  it('does not retry a rejected storage request', async () => {
    const error = Object.assign(new Error('Upload nicht erlaubt'), { name: 'StorageApiError' });
    mockUpload.mockResolvedValue({ error });

    await expect(uploadAvatarImage('file:///local/avatar.jpg')).rejects.toMatchObject({
      cause: error,
    });
    expect(mockUpload).toHaveBeenCalledTimes(1);
  });
});
