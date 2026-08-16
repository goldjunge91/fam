import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { getSupabase } from '@/lib/supabase';

/** Lang genug fuer eine Sitzung, kurz genug, um ein geloeschtes Bild nicht ewig zwischenzuspeichern. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

const COVER_BUCKET = 'recipe-covers';
const STEP_BUCKET = 'recipe-step-images';

/**
 * Oeffnet die native Foto-Auswahl mit eingebautem Zuschneiden
 * (`allowsEditing`) — kein eigener Crop-Screen noetig, iOS/Android bringen
 * ihn schon mit. Wird sowohl fuer Rezept-Cover als auch fuer Schritt-Bilder
 * verwendet, der Auswahl-Ablauf ist identisch.
 */
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

/**
 * Laedt ein lokal ausgewaehltes Bild in den angegebenen Bucket hoch. Ein
 * neuer Upload ueberschreibt das alte Bild (`upsert: true`), es entsteht
 * kein verwaister Storage-Muell.
 */
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

/**
 * Laedt ein lokal ausgewaehltes Bild in den `recipe-step-images`-Bucket hoch.
 * Pfadkonvention `<household_id>/<step_id>.jpg` traegt die RLS in
 * `13_recipe_step_storage.sql`.
 */
export function uploadRecipeStepImage(
  localUri: string,
  householdId: string,
  stepId: string,
): Promise<string> {
  return uploadImageToBucket(STEP_BUCKET, `${householdId}/${stepId}.jpg`, localUri);
}

/**
 * Signierte URL fuer die Anzeige aus einem privaten Bucket. Wirft bei einem
 * Storage-Fehler (statt still `null` zurueckzugeben), damit ein defektes
 * Bild ueber `isError`/React-Query-Retry sichtbar bleibt statt lautlos zu
 * verschwinden; im Dev-Build zusaetzlich mit Auth-Kontext geloggt.
 */
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

/** Signierte URL fuer die Anzeige eines Rezept-Covers — der Bucket ist privat (households-scoped). */
export function useRecipeCoverUrl(path: string | null | undefined) {
  return useSignedImageUrl(COVER_BUCKET, 'RecipeCover', path);
}

/** Signierte URL fuer die Anzeige eines Schritt-Bilds — der Bucket ist privat (households-scoped). */
export function useRecipeStepImageUrl(path: string | null | undefined) {
  return useSignedImageUrl(STEP_BUCKET, 'RecipeStepImage', path);
}
