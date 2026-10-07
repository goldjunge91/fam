import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/backend/supabase/remote-client';
import { getDatabase } from '@/lib/db/local-client';
import { debugLog } from '@/lib/observability/debug-log';
import { reportError } from '@/lib/telemetry';
import {
  type BrochureDump,
  type CanonicalAvailabilityQueryClient,
  mapCanonicalAvailabilityRows,
  writeBrochureDump,
} from '../brochure-sync';

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
        const catalogClient = supabase as unknown as CanonicalAvailabilityQueryClient;
        const { data: rows, error } = await catalogClient
          .from('brochure_availability')
          .select(
            'zip_code,brochure:canonical_brochures!inner(id,canonical_brn,store_id,title,valid_from,valid_until,page_count,cover_image,pages,verified_sha256,store:brochure_stores!inner(id,name,logo_url))',
          )
          .eq('zip_code', currentZip);

        debugLog('[brochures] canonical catalog query', {
          zipCode: currentZip,
          error,
          rowCount: Array.isArray(rows) ? rows.length : 0,
        });
        if (error) throw error;
        if (!isMounted) return;

        // Convert the normalized rows back to the existing local SQLite shape.
        const db = await getDatabase();
        const catalogDump = mapCanonicalAvailabilityRows(rows ?? [], currentZip);
        const now = Date.now();
        const brochures = (catalogDump.brochures ?? []).filter(
          (brochure) => Date.parse(brochure.validUntil) >= now,
        );
        const activeStoreIds = new Set(brochures.map((brochure) => brochure.storeId));
        const payload: BrochureDump = {
          stores: (catalogDump.stores ?? []).filter((store) => activeStoreIds.has(store.id)),
          brochures,
        };
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
