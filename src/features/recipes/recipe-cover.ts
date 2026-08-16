import * as ImagePicker from 'expo-image-picker';

import { uploadImageToBucket, useSignedImageUrl } from './recipe-image-storage';

const BUCKET = 'recipe-covers';

/**
 * Oeffnet die native Foto-Auswahl mit eingebautem Zuschneiden
 * (`allowsEditing`) — kein eigener Crop-Screen noetig, iOS/Android bringen
 * ihn schon mit.
 */
export async function pickRecipeCoverImage(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
  });

  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0].uri;
}

/**
 * Laedt ein lokal ausgewaehltes Bild in den `recipe-covers`-Bucket hoch.
 * Pfadkonvention `<household_id>/<recipe_id>.jpg` traegt die RLS in
 * `12_recipe_storage.sql`.
 */
export function uploadRecipeCoverImage(
  localUri: string,
  householdId: string,
  recipeId: string,
): Promise<string> {
  return uploadImageToBucket(BUCKET, `${householdId}/${recipeId}.jpg`, localUri);
}

/** Signierte URL fuer die Anzeige — der Bucket ist privat (households-scoped). */
export function useRecipeCoverUrl(path: string | null | undefined) {
  return useSignedImageUrl(BUCKET, 'RecipeCover', path);
}
