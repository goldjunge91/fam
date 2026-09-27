import * as ExpoImagePicker from 'expo-image-picker';
import type { ReceiptImagePickerOptions } from './contracts';
import { createExpoImagePickerAdapter } from './native-adapters';

jest.mock('expo-image-picker', () => ({
  UIImagePickerPreferredAssetRepresentationMode: {
    Compatible: 'compatible',
  },
  getPendingResultAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

describe('Expo image picker adapter', () => {
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
});
