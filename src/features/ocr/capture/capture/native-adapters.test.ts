import * as ExpoImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import type { ReceiptImagePickerOptions } from './contracts';
import { createExpoImagePickerAdapter } from './native-adapters';

jest.mock('expo-image-picker', () => ({
  UIImagePickerPreferredAssetRepresentationMode: {
    Compatible: 'compatible',
  },
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
  getPendingResultAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

describe('Expo image picker adapter', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    jest.clearAllMocks();
  });

  it('forwards the compatible representation mode to Expo ImagePicker', async () => {
    const launchImageLibraryAsync = jest.mocked(ExpoImagePicker.launchImageLibraryAsync);
    launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });

    const options: ReceiptImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: false,
      allowsMultipleSelection: true,
      quality: 1,
      base64: false,
      exif: true,
      orderedSelection: true,
      preferredAssetRepresentationMode: 'compatible',
    };

    await createExpoImagePickerAdapter().launchImageLibraryAsync(options);

    expect(launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredAssetRepresentationMode:
          ExpoImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      }),
    );
  });

  it('maps recovered Android assets into the receipt picker shape', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    jest.mocked(ExpoImagePicker.getPendingResultAsync).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///pending.jpg',
          mimeType: 'image/jpeg',
          fileSize: 456,
          width: 800,
          height: 1200,
          exif: { orientation: 1 },
          type: 'image',
        },
      ],
    });

    await expect(createExpoImagePickerAdapter().getPendingResultAsync()).resolves.toEqual({
      canceled: false,
      assets: [
        expect.objectContaining({
          uri: 'file:///pending.jpg',
          mimeType: 'image/jpeg',
          fileSize: 456,
          width: 800,
          height: 1200,
          exif: { orientation: 1 },
          type: 'image',
        }),
      ],
    });
  });

  it('preserves picker errors and avoids Android recovery on iOS', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    jest.mocked(ExpoImagePicker.getPendingResultAsync).mockResolvedValue({
      code: 'E_PICKER_CANCELLED',
      message: 'Picker closed before returning assets',
    });
    await expect(createExpoImagePickerAdapter().getPendingResultAsync()).resolves.toEqual({
      code: 'E_PICKER_CANCELLED',
      message: 'Picker closed before returning assets',
    });

    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    await expect(createExpoImagePickerAdapter().getPendingResultAsync()).resolves.toBeNull();
    expect(ExpoImagePicker.getPendingResultAsync).toHaveBeenCalledTimes(1);
  });

  it('requests camera and library permissions through their matching Expo APIs', async () => {
    const requestCameraPermissionsAsync = jest.mocked(
      ExpoImagePicker.requestCameraPermissionsAsync,
    );
    const requestMediaLibraryPermissionsAsync = jest.mocked(
      ExpoImagePicker.requestMediaLibraryPermissionsAsync,
    );
    const grantedPermissions = {
      status: ExpoImagePicker.PermissionStatus.GRANTED,
      expires: 'never' as const,
      granted: true,
      canAskAgain: true,
    };
    requestCameraPermissionsAsync.mockResolvedValue(grantedPermissions);
    requestMediaLibraryPermissionsAsync.mockResolvedValue(grantedPermissions);
    const adapter = createExpoImagePickerAdapter();

    await expect(adapter.requestCameraPermissionsAsync()).resolves.toMatchObject({ granted: true });
    await expect(adapter.requestMediaLibraryPermissionsAsync()).resolves.toMatchObject({
      granted: true,
    });

    expect(requestCameraPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(requestMediaLibraryPermissionsAsync).toHaveBeenCalledWith(false);
  });
});
