import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { getDatabase } from '@/lib/db/client';
import { debugLog } from '@/lib/debug-log';
import { getSupabase } from '@/lib/supabase';
import { reportError } from '@/lib/telemetry';
import { type BrochureDump, writeBrochureDump } from '../brochure-sync';

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

        debugLog('[brochures] supabase dump query', {
          zipCode: currentZip,
          error,
          hasDump: !!dump,
        });
        if (error) throw error;
        if (!dump || !isMounted) return;

        // Daten transaktional in die lokalen Tabellen schreiben.
        const db = await getDatabase();
        const payload = dump.payload_json as unknown as BrochureDump;
        const brochures = Array.isArray(payload.brochures) ? payload.brochures : [];
        const firstBrochure = brochures[0];
        const pageCount = brochures.reduce(
          (total, brochure) => total + (Array.isArray(brochure.pages) ? brochure.pages.length : 0),
          0,
        );
        const hotspotCount = brochures.reduce(
          (total, brochure) =>
            total +
            (Array.isArray(brochure.pages)
              ? brochure.pages.reduce(
                  (pageTotal, page) =>
                    pageTotal + (Array.isArray(page.hotspots) ? page.hotspots.length : 0),
                  0,
                )
              : 0),
          0,
        );
        debugLog('[brochures] dump payload', {
          zipCode: currentZip,
          storeCount: payload.stores?.length ?? 0,
          brochureCount: brochures.length,
          pageCount,
          hotspotCount,
          firstBrochure: firstBrochure
            ? {
                id: firstBrochure.id,
                pageCount: firstBrochure.pages?.length ?? 0,
                hotspotCount:
                  firstBrochure.pages?.reduce(
                    (total, page) =>
                      total + (Array.isArray(page.hotspots) ? page.hotspots.length : 0),
                    0,
                  ) ?? 0,
              }
            : null,
        });

        await writeBrochureDump(db, currentZip, payload);
        await queryClient.invalidateQueries({ queryKey: ['brochures'] });
        debugLog('[brochures] local sync complete', {
          zipCode: currentZip,
          brochureCount: brochures.length,
          pageCount,
          hotspotCount,
        });
      } catch (e) {
        debugLog('[brochures] sync failed', e);
        reportError(e, { operation: 'brochure.sync', error_code: 'brochure_sync_failed' });
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
