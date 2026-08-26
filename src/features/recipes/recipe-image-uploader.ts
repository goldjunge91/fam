import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { getSupabase } from '@/lib/supabase';

/** Cache-Dauer: eine Sitzung, ohne gelöschte Bilder dauerhaft zu behalten. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

const COVER_BUCKET = 'recipe-covers';
const STEP_BUCKET = 'recipe-step-images';

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
  return uploadImageToBucket(COVER_BUCKET, `${householdId}/${recipeId}.jpg`, localUri);
}

export function uploadRecipeStepImage(
  localUri: string,
  householdId: string,
  stepId: string,
): Promise<string> {
  return uploadImageToBucket(STEP_BUCKET, `${householdId}/${stepId}.jpg`, localUri);
}

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

/** Signierte URL für ein privates, haushaltsbezogenes Rezept-Cover. */
export function useRecipeCoverUrl(path: string | null | undefined) {
  return useSignedImageUrl(COVER_BUCKET, 'RecipeCover', path);
}

/** Signierte URL für ein privates, haushaltsbezogenes Schritt-Bild. */
export function useRecipeStepImageUrl(path: string | null | undefined) {
  return useSignedImageUrl(STEP_BUCKET, 'RecipeStepImage', path);
}
