import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { getDatabase } from '@/lib/db/client';
import { Sentry } from '@/lib/sentry';
import { getSupabase } from '@/lib/supabase';

/**
 * Synchronisiert Prospekte nach SQLite und entfernt abgelaufene Einträge.
 */
export function useBrochureSync(zipCode: string | null) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasSynced, setHasSynced] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!zipCode) return;
    const currentZip = zipCode;

    let isMounted = true;

    async function syncBrochures() {
      setHasSynced(false);
      setIsSyncing(true);
      try {
        const supabase = getSupabase();
        // Aktuellen gültigen Dump laden.
        const { data: dump, error } = await supabase
          .from('brochure_dumps')
          .select('payload_json')
          .eq('zip_code', currentZip)
          .gte('valid_until', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (!dump || !isMounted) return;

        // Daten transaktional in die lokalen Tabellen schreiben.
        const db = await getDatabase();
        const payload = dump.payload_json as unknown as {
          stores?: Array<{ id: string; name: string; logoUrl?: string }>;
          brochures?: Array<{
            id: string;
            storeId: string;
            title: string;
            validFrom: string;
            validUntil: string;
            coverImage: string;
            pages?: Array<{
              number: number;
              imageUrl: string;
              hotspots?: unknown[];
            }>;
          }>;
        };

        await db.execAsync('BEGIN TRANSACTION;');
        try {
          await db.execAsync('DELETE FROM local_brochure_pages');
          await db.execAsync('DELETE FROM local_brochures');
          await db.execAsync('DELETE FROM local_brochure_stores');

          if (payload.stores && Array.isArray(payload.stores)) {
            for (const store of payload.stores) {
              await db.runAsync(
                'INSERT INTO local_brochure_stores (id, name, logo_url, active) VALUES (?, ?, ?, 1)',
                [store.id, store.name, store.logoUrl || null],
              );
            }
          }

          if (payload.brochures && Array.isArray(payload.brochures)) {
            for (const brochure of payload.brochures) {
              await db.runAsync(
                'INSERT INTO local_brochures (id, store_id, title, valid_from, valid_until, cover_image) VALUES (?, ?, ?, ?, ?, ?)',
                [
                  brochure.id,
                  brochure.storeId,
                  brochure.title,
                  brochure.validFrom,
                  brochure.validUntil,
                  brochure.coverImage,
                ],
              );

              if (brochure.pages && Array.isArray(brochure.pages)) {
                for (const page of brochure.pages) {
                  await db.runAsync(
                    'INSERT INTO local_brochure_pages (id, brochure_id, page_number, image_url, hotspots_json) VALUES (?, ?, ?, ?, ?)',
                    [
                      `${brochure.id}_${page.number}`,
                      brochure.id,
                      page.number,
                      page.imageUrl,
                      JSON.stringify(page.hotspots || []),
                    ],
                  );
                }
              }
            }
          }
          await db.runAsync(
            `INSERT INTO local_brochure_cache (id, zip_code, updated_at)
             VALUES (1, ?, ?)
             ON CONFLICT(id) DO UPDATE SET zip_code = excluded.zip_code, updated_at = excluded.updated_at`,
            [currentZip, Date.now()],
          );
          await db.execAsync('COMMIT;');
        } catch (txnError) {
          await db.execAsync('ROLLBACK;');
          throw txnError;
        }
        await queryClient.invalidateQueries({ queryKey: ['brochures'] });
      } catch (e) {
        Sentry.captureException(e);
        console.error('Brochure sync failed', e);
      } finally {
        if (isMounted) {
          setIsSyncing(false);
          setHasSynced(true);
        }
      }
    }

    syncBrochures();

    return () => {
      isMounted = false;
    };
  }, [queryClient, zipCode]);

  return { isSyncing, hasSynced };
}
