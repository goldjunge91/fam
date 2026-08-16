import { useQuery } from '@tanstack/react-query';

import { getSupabase } from '@/lib/supabase';

/** Lang genug fuer eine Sitzung, kurz genug, um ein geloeschtes Bild nicht ewig zwischenzuspeichern. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Gemeinsame Upload-/Signed-URL-Logik fuer die privaten, households-scoped
 * Rezeptbild-Buckets (`recipe-covers`, `recipe-step-images`, siehe
 * `recipe-cover.ts` / `recipe-step-image.ts`). Beide Buckets teilen sich
 * Pfadkonvention (`<household_id>/<entity_id>.jpg`), Upload- und
 * Signed-URL-Ablauf — nur der Bucket-Name unterscheidet sich.
 */

/**
 * Laedt ein lokal ausgewaehltes Bild in den angegebenen Bucket hoch. Ein
 * neuer Upload ueberschreibt das alte Bild (`upsert: true`), es entsteht
 * kein verwaister Storage-Muell.
 */
export async function uploadImageToBucket(
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
 * Signierte URL fuer die Anzeige aus einem privaten Bucket. Wirft bei einem
 * Storage-Fehler (statt still `null` zurueckzugeben), damit ein defektes
 * Bild ueber `isError`/React-Query-Retry sichtbar bleibt statt lautlos zu
 * verschwinden; im Dev-Build zusaetzlich mit Auth-Kontext geloggt.
 */
export function useSignedImageUrl(
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
