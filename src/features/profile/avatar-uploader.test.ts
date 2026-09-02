import { uploadAvatarImage } from '@/features/profile/avatar-uploader';

const mockBytes = jest.fn();
const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();
const mockFrom = jest.fn(() => ({
  upload: mockUpload,
  getPublicUrl: mockGetPublicUrl,
}));

jest.mock('expo-file-system', () => ({
  File: jest.fn(() => ({ bytes: mockBytes })),
}));

jest.mock('@/lib/debug-log', () => ({
  debugLogEvent: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    storage: { from: mockFrom },
  }),
}));

describe('uploadAvatarImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));
  });

  it('liefert nach erfolgreichem Upload eine cache-sichere öffentliche URL', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1234);
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: {
        publicUrl: 'https://example.supabase.co/storage/v1/object/public/avatars/user/avatar.jpg',
      },
    });

    await expect(uploadAvatarImage('user-1', 'file:///local/avatar.jpg')).resolves.toBe(
      'https://example.supabase.co/storage/v1/object/public/avatars/user/avatar.jpg?t=1234',
    );
    expect(mockUpload).toHaveBeenCalledWith('user-1/avatar.jpg', new Uint8Array([1, 2, 3]), {
      contentType: 'image/jpeg',
      upsert: true,
    });
  });

  it('lehnt einen Storage-Fehler ab statt die lokale Datei-URI zurückzugeben', async () => {
    mockUpload.mockResolvedValue({ error: new Error('Upload nicht erlaubt') });

    await expect(uploadAvatarImage('user-1', 'file:///local/avatar.jpg')).rejects.toThrow(
      'Profilbild konnte nicht hochgeladen werden',
    );
    expect(mockGetPublicUrl).not.toHaveBeenCalled();
  });
});
