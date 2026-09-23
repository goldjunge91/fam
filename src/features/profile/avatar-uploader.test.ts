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
