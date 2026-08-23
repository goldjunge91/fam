import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { getSupabase } from '@/lib/supabase';

const SIGNED_URL_TTL_SECONDS = 60 * 60;

const COVER_BUCKET = 'recipe-covers';
const STEP_BUCKET = 'recipe-step-images';

/** Oeffnet die native Bildauswahl mit Zuschnitt. */
export async function pickRecipeImage(): Promise<string | null> {
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

/** Ueberschreibt das Bild am stabilen Storage-Pfad. */
async function uploadImageToBucket(
  bucket: string,
  path: string,
  localUri: string,
): Promise<string> {
  const { File } = require('expo-file-system') as typeof import('expo-file-system');
  const bytes = await new File(localUri).bytes();

  const { error } = await getSupabase()
    .storage.from(bucket)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });

  if (error) throw new Error(error.message);
  return path;
}

/** Der haushaltsgebundene Pfad entspricht der Storage-RLS. */
export function uploadRecipeCoverImage(
  localUri: string,
  householdId: string,
  recipeId: string,
): Promise<string> {
  return uploadImageToBucket(COVER_BUCKET, `${householdId}/${recipeId}.jpg`, localUri);
}

/** Der haushaltsgebundene Pfad entspricht der Storage-RLS. */
export function uploadRecipeStepImage(
  localUri: string,
  householdId: string,
  stepId: string,
): Promise<string> {
  return uploadImageToBucket(STEP_BUCKET, `${householdId}/${stepId}.jpg`, localUri);
}

/** Laedt eine signierte URL und macht Storage-Fehler fuer React Query sichtbar. */
function useSignedImageUrl(
  bucket: string,
  queryKeyPrefix: string,
  path: string | null | undefined,
) {
  return useQuery({
    queryKey: [queryKeyPrefix, path],
    queryFn: async () => {
      if (!path) return null;
      if (__DEV__) console.log(`[${queryKeyPrefix}] signed-url:start`, { path });

      const supabase = getSupabase();
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

      if (error) {
        if (__DEV__) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          console.log(`[${queryKeyPrefix}] signed-url:error`, {
            path,
            authenticated: session !== null,
            message: error.message,
          });
        }
        throw new Error(error.message);
      }

      if (__DEV__) console.log(`[${queryKeyPrefix}] signed-url:success`, { path });
      return data.signedUrl;
    },
    enabled: !!path,
    staleTime: (SIGNED_URL_TTL_SECONDS - 60) * 1000,
  });
}

export function useRecipeCoverUrl(path: string | null | undefined) {
  return useSignedImageUrl(COVER_BUCKET, 'RecipeCover', path);
}

export function useRecipeStepImageUrl(path: string | null | undefined) {
  return useSignedImageUrl(STEP_BUCKET, 'RecipeStepImage', path);
}
