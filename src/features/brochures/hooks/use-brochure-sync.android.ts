import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/backend/supabase/remote-client';
import { getDatabase } from '@/lib/db/local-client';
import { debugLog } from '@/lib/observability/debug-log';
import { reportError } from '@/lib/telemetry';
import {
  type BrochureDump,
  type BrochureZipScanStatus,
  brochureZipScanIsPending,
  mapRegionalAvailabilityRows,
  writeBrochureDump,
} from '../brochure-sync';

const SCAN_STATUS_POLL_INTERVAL_MS = 30_000;
const SCAN_STATUS_POLL_TIMEOUT_MS = 20 * 60_000;

/**
 * Synchronisiert Prospekte nach SQLite und entfernt abgelaufene Einträge.
 */
export function useBrochureSync(zipCode: string | null) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasSynced, setHasSynced] = useState(false);
  const [isScanPending, setIsScanPending] = useState(false);
  const [hasScanError, setHasScanError] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!zipCode) return;
    const currentZip = zipCode;

    let isMounted = true;

    async function syncCatalogSnapshot(supabase: ReturnType<typeof getSupabase>) {
      const { data: rows, error } = await supabase
        .from('brochure_availability')
        .select(
          'zip_code,brochure:brochures!inner(id,source_content_id,source_zip_code,store_id,title,valid_from,valid_until,page_count,cover_image,pages:brochure_pages(id,page_number,image_url,hotspots),store:brochure_stores!inner(id,name,logo_url))',
        )
        .eq('zip_code', currentZip);

      debugLog('[brochures] regional catalog query', {
        zipCode: currentZip,
        error,
        rowCount: Array.isArray(rows) ? rows.length : 0,
      });
      if (error) throw error;
      if (!isMounted) return;

      const db = await getDatabase();
      if (!isMounted) return;
      const catalogDump = mapRegionalAvailabilityRows(rows, currentZip);
      const now = Date.now();
      const brochures = (catalogDump.brochures ?? []).filter(
        (brochure) => Date.parse(brochure.validUntil) >= now,
      );
      const activeStoreIds = new Set(brochures.map((brochure) => brochure.storeId));
      const payload: BrochureDump = {
        stores: (catalogDump.stores ?? []).filter((store) => activeStoreIds.has(store.id)),
        brochures,
      };

      await writeBrochureDump(db, currentZip, payload);
      await queryClient.invalidateQueries({ queryKey: ['brochures'] });
      debugLog('[brochures] local sync complete', {
        zipCode: currentZip,
        brochureCount: brochures.length,
        pageCount: brochures.reduce((total, brochure) => total + (brochure.pages?.length ?? 0), 0),
      });
    }

    async function monitorRequestedScan(
      supabase: ReturnType<typeof getSupabase>,
      requestedAt: string,
    ) {
      const deadline = Date.now() + SCAN_STATUS_POLL_TIMEOUT_MS;
      try {
        while (isMounted && Date.now() < deadline) {
          const { data, error } = await supabase.rpc('get_brochure_zip_scan_status', {
            p_zip_code: currentZip,
          });
          if (error) throw error;
          const status = data?.[0] as BrochureZipScanStatus | undefined;
          if (status?.last_error) {
            setIsScanPending(false);
            setHasScanError(true);
            return;
          }
          if (status && !brochureZipScanIsPending(status)) {
            if (
              status.last_successful_at &&
              Date.parse(status.last_successful_at) >= Date.parse(requestedAt)
            ) {
              await syncCatalogSnapshot(supabase);
            }
            if (isMounted) {
              setIsScanPending(false);
              setHasScanError(false);
            }
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, SCAN_STATUS_POLL_INTERVAL_MS));
        }

        if (isMounted) {
          setIsScanPending(false);
          setHasScanError(true);
        }
      } catch (error) {
        debugLog('[brochures] scan status polling failed', error);
        reportError(error, { operation: 'brochure.sync', error_code: 'brochure_sync_failed' });
        if (isMounted) {
          setIsScanPending(false);
          setHasScanError(true);
        }
      }
    }

    async function syncBrochures() {
      setHasSynced(false);
      setIsSyncing(true);
      setIsScanPending(false);
      setHasScanError(false);
      try {
        const supabase = getSupabase();
        const { data: scanRows, error: scanError } = await supabase.rpc(
          'request_brochure_zip_scan',
          { p_zip_code: currentZip },
        );
        if (scanError) {
          setHasScanError(true);
          reportError(scanError, {
            operation: 'brochure.sync',
            error_code: 'brochure_scan_request_failed',
          });
        }
        const scanStatus = (scanRows?.[0] ?? null) as BrochureZipScanStatus | null;
        await syncCatalogSnapshot(supabase);
        if (!isMounted) return;

        if (scanStatus?.last_error) {
          setHasScanError(true);
        } else if (scanStatus && brochureZipScanIsPending(scanStatus)) {
          setIsScanPending(true);
          void monitorRequestedScan(supabase, scanStatus.requested_at);
        }
      } catch (e) {
        debugLog('[brochures] sync failed', e);
        reportError(e, { operation: 'brochure.sync', error_code: 'brochure_sync_failed' });
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

  return { isSyncing, hasSynced, isScanPending, hasScanError };
}
