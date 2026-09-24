import * as ImagePicker from 'expo-image-picker';
import { pickAvatarImage, uploadAvatarImage } from '@/features/profile/avatar-uploader';

jest.mock('@/lib/config/env', () => ({ env: { supabaseUrl: 'https://example.supabase.co' } }));

const mockDelete = jest.fn();
const mockFetch = jest.fn();
const mockManipulateAsync = jest.fn();
const mockUpload = jest.fn();
const mockGetUser = jest.fn();
const mockGetPublicUrl = jest.fn();
const mockFrom = jest.fn(() => ({
  upload: mockUpload,
  getPublicUrl: mockGetPublicUrl,
}));

jest.mock('expo-file-system', () => ({
  File: jest.fn(() => ({ delete: mockDelete })),
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: mockManipulateAsync,
}));

jest.mock('@/lib/observability/debug-log', () => ({
  debugError: jest.fn(),
  debugLogEvent: jest.fn(),
}));

jest.mock('@/lib/backend/supabase/client', () => ({
  getSupabase: () => ({
    auth: { getUser: mockGetUser },
    storage: { from: mockFrom },
  }),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const mockRequestMediaLibraryPermissionsAsync = jest.mocked(
  ImagePicker.requestMediaLibraryPermissionsAsync,
);
const mockLaunchImageLibraryAsync = jest.mocked(ImagePicker.launchImageLibraryAsync);

describe('pickAvatarImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('meldet eine verweigerte Fotoberechtigung statt still abzubrechen', async () => {
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false } as never);

    await expect(pickAvatarImage()).rejects.toThrow(
      'Der Zugriff auf deine Fotos wurde verweigert.',
    );
    expect(mockLaunchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('liefert die lokale URI eines ausgewählten Bildes', async () => {
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as never);
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///local/avatar.jpg' }],
    } as never);

    await expect(pickAvatarImage()).resolves.toBe('file:///local/avatar.jpg');
    expect(mockLaunchImageLibraryAsync).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
  });

  it('behandelt Abbruch ohne Zugriff auf nicht vorhandene Assets', async () => {
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as never);
    mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null } as never);

    await expect(pickAvatarImage()).resolves.toBeNull();
  });
});

describe('uploadAvatarImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpload.mockReset();
    mockManipulateAsync.mockReset();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(3)),
    });
    jest.spyOn(globalThis, 'fetch').mockImplementation(mockFetch);
    mockManipulateAsync.mockResolvedValue({
      uri: 'file:///normalized/avatar.jpg',
      width: 1024,
      height: 1024,
    });
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  });

  afterEach(() => jest.restoreAllMocks());

  it('liefert nach erfolgreichem Upload einen stabilen privaten Bildverweis', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1234);
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: {
        publicUrl: 'https://example.supabase.co/storage/v1/object/public/avatars/user/avatar.jpg',
      },
    });

    await expect(uploadAvatarImage('file:///local/avatar.jpg')).resolves.toBe(
      'https://example.supabase.co/storage/v1/object/authenticated/avatars/user-1/avatar.jpg?v=1234',
    );
    expect(mockGetPublicUrl).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledWith('file:///normalized/avatar.jpg');
    expect(mockUpload).toHaveBeenCalledWith('user-1/avatar.jpg', expect.any(ArrayBuffer), {
      contentType: 'image/jpeg',
      upsert: true,
    });
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('lehnt normalisierte Bilder über dem Storage-Limit ab', async () => {
    mockFetch.mockResolvedValue({
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(5 * 1024 * 1024 + 1)),
    });

    await expect(uploadAvatarImage('file:///local/avatar.jpg')).rejects.toThrow(
      'Profilbild konnte nicht hochgeladen werden',
    );
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockManipulateAsync).toHaveBeenCalledTimes(4);
    expect(mockDelete).toHaveBeenCalledTimes(4);
  });

  it('lehnt einen Storage-Fehler ab statt die lokale Datei-URI zurückzugeben', async () => {
    mockUpload.mockResolvedValue({ error: new Error('Upload nicht erlaubt') });

    await expect(uploadAvatarImage('file:///local/avatar.jpg')).rejects.toThrow(
      'Profilbild konnte nicht hochgeladen werden',
    );
    expect(mockGetPublicUrl).not.toHaveBeenCalled();
  });

  it.each([null, new Error('Session abgelaufen')])(
    'verhindert Uploads ohne bestätigte Anmeldung (%s)',
    async (error) => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error });

      await expect(uploadAvatarImage('file:///local/avatar.jpg')).rejects.toThrow(
        'Profilbild konnte nicht hochgeladen werden',
      );
      expect(mockFetch).not.toHaveBeenCalled();
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
    mockManipulateAsync.mockReset();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(3)),
    });
    jest.spyOn(globalThis, 'fetch').mockImplementation(mockFetch);
    mockManipulateAsync.mockResolvedValue({
      uri: 'file:///normalized/avatar.jpg',
      width: 1024,
      height: 1024,
    });
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  });

  afterEach(() => jest.restoreAllMocks());

  it('wiederholt denselben ArrayBuffer nach einem nativen Response-Fehler', async () => {
    mockUpload
      .mockResolvedValueOnce({ error: transportError })
      .mockResolvedValueOnce({ error: null });

    await expect(uploadAvatarImage('file:///local/avatar.jpg')).resolves.toContain(
      '/authenticated/avatars/user-1/avatar.jpg',
    );
    expect(mockUpload).toHaveBeenCalledTimes(2);
    expect(mockUpload.mock.calls[1]).toEqual(mockUpload.mock.calls[0]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('stoppt nach drei fehlgeschlagenen Versuchen und erhält den Transportfehler', async () => {
    mockUpload.mockResolvedValue({ error: transportError });

    await expect(uploadAvatarImage('file:///local/avatar.jpg')).rejects.toMatchObject({
      cause: transportError,
    });
    expect(mockUpload).toHaveBeenCalledTimes(3);
  });

  it('wiederholt einen geworfenen Netzwerkfehler vor dem nächsten Versuch', async () => {
    mockUpload
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce({ error: null });

    await expect(uploadAvatarImage('file:///local/avatar.jpg')).resolves.toContain(
      '/authenticated/avatars/user-1/avatar.jpg?v=',
    );
    expect(mockUpload).toHaveBeenCalledTimes(2);
  });
});
