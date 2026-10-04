import * as ImagePicker from 'expo-image-picker';

export async function pickRecipeImage(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.8,
  });

  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0].uri;
}
