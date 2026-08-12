import { useQuery } from '@tanstack/react-query';

import { getSupabase } from '@/lib/supabase';

export { pickRecipeCoverImage as pickRecipeStepImage } from './recipe-cover';

const BUCKET = 'recipe-step-images';
/** Lang genug fuer eine Sitzung, kurz genug, um ein geloeschtes Bild nicht ewig zwischenzuspeichern. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Laedt ein lokal ausgewaehltes Bild in den `recipe-step-images`-Bucket hoch.
 * Pfadkonvention `<household_id>/<step_id>.jpg` traegt die RLS in
 * `13_recipe_step_storage.sql` — ein neuer Upload ueberschreibt das alte Bild
 * (`upsert: true`), es entsteht kein verwaister Storage-Muell. Struktur 1:1
 * gespiegelt von `uploadRecipeCoverImage` in `recipe-cover.ts`.
 */
export async function uploadRecipeStepImage(
  localUri: string,
  householdId: string,
  stepId: string,
): Promise<string> {
  const path = `${householdId}/${stepId}.jpg`;
  const { File } = require('expo-file-system') as typeof import('expo-file-system');
  const bytes = await new File(localUri).bytes();

  const { error } = await getSupabase()
    .storage.from(BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });

  if (error) throw new Error(error.message);
  return path;
}

/** Signierte URL fuer die Anzeige — der Bucket ist privat (households-scoped). */
export function useRecipeStepImageUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['recipe-step-image-url', path],
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
