import * as ImagePicker from 'expo-image-picker';
import { pickRecipeImage } from './recipe-image-picker';
import { pickRecipeImage as pickAndroidRecipeImage } from './recipe-image-picker.android';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const mockRequestPermissions = jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync);
const mockLaunchPicker = jest.mocked(ImagePicker.launchImageLibraryAsync);

describe('pickRecipeImage', () => {
  const pickers = [
    ['iOS', pickRecipeImage],
    ['Android', pickAndroidRecipeImage],
  ] as const;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestPermissions.mockResolvedValue({ granted: true } as never);
    mockLaunchPicker.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///local/recipe.jpg' }],
    } as never);
  });

  it('keeps the 4:3 crop on iOS', async () => {
    await expect(pickRecipeImage()).resolves.toBe('file:///local/recipe.jpg');
    expect(mockLaunchPicker).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
  });

  it('skips native crop on Android', async () => {
    await expect(pickAndroidRecipeImage()).resolves.toBe('file:///local/recipe.jpg');
    expect(mockLaunchPicker).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
  });

  it.each(pickers)(
    'returns no image on %s when library permission is denied',
    async (_platform, pick) => {
      mockRequestPermissions.mockResolvedValue({ granted: false } as never);

      await expect(pick()).resolves.toBeNull();
      expect(mockLaunchPicker).not.toHaveBeenCalled();
    },
  );

  it.each(pickers)(
    'returns no image on %s when the picker is canceled',
    async (_platform, pick) => {
      mockLaunchPicker.mockResolvedValue({ canceled: true, assets: [] } as never);

      await expect(pick()).resolves.toBeNull();
    },
  );

  it.each(pickers)(
    'returns no image on %s when the picker has no assets',
    async (_platform, pick) => {
      mockLaunchPicker.mockResolvedValue({ canceled: false, assets: [] } as never);

      await expect(pick()).resolves.toBeNull();
    },
  );
});
