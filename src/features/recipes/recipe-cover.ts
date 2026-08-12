import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { getSupabase } from '@/lib/supabase';

const BUCKET = 'recipe-covers';
/** Lang genug fuer eine Sitzung, kurz genug, um ein geloeschtes Bild nicht ewig zwischenzuspeichern. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

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
 * `12_recipe_storage.sql` — ein neuer Upload ueberschreibt das alte Bild
 * (`upsert: true`), es entsteht kein verwaister Storage-Muell.
 */
export async function uploadRecipeCoverImage(
  localUri: string,
  householdId: string,
  recipeId: string,
): Promise<string> {
  const path = `${householdId}/${recipeId}.jpg`;
  const { File } = require('expo-file-system') as typeof import('expo-file-system');
  const bytes = await new File(localUri).bytes();

  const { error } = await getSupabase()
    .storage.from(BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });

  if (error) throw new Error(error.message);
  return path;
}

/** Signierte URL fuer die Anzeige — der Bucket ist privat (households-scoped). */
export function useRecipeCoverUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['recipe-cover-url', path],
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await getSupabase()
        .storage.from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (error) return null;
      return data.signedUrl;
    },
    enabled: !!path,
    staleTime: (SIGNED_URL_TTL_SECONDS - 60) * 1000,
  });
}
