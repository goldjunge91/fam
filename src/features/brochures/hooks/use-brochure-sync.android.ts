import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
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

const SCAN_STATUS_FALLBACK_INTERVAL_MS = 30_000;
const SCAN_STATUS_TIMEOUT_MS = 20 * 60_000;

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
    let isScanPendingLocally = false;
    let isRealtimeConnected = false;
    let isAppActive = !['background', 'inactive', 'extension'].includes(AppState.currentState);
    let requestedAt: string | null = null;
    let fallbackTimeout: ReturnType<typeof setTimeout> | undefined;
    let scanTimeout: ReturnType<typeof setTimeout> | undefined;
    let isCheckingStatus = false;
    let checkStatusAgain = false;
    let removeRealtimeChannel: (() => void) | undefined;

    function clearFallbackTimeout() {
      if (fallbackTimeout === undefined) return;
      clearTimeout(fallbackTimeout);
      fallbackTimeout = undefined;
    }

    function finishScan(hasError: boolean) {
      isScanPendingLocally = false;
      clearFallbackTimeout();
      if (scanTimeout !== undefined) {
        clearTimeout(scanTimeout);
        scanTimeout = undefined;
      }
      if (!isMounted) return;
      setIsScanPending(false);
      setHasScanError(hasError);
    }

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

    async function reconcileScanStatus(supabase: ReturnType<typeof getSupabase>) {
      if (!isMounted || !isScanPendingLocally || !requestedAt) return;
      if (isCheckingStatus) {
        checkStatusAgain = true;
        return;
      }

      isCheckingStatus = true;
      try {
        do {
          checkStatusAgain = false;
          const { data, error } = await supabase.rpc('get_brochure_zip_scan_status', {
            p_zip_code: currentZip,
          });
          if (error) throw error;
          const status = data?.[0] as BrochureZipScanStatus | undefined;

          if (status?.last_error) {
            finishScan(true);
            return;
          }

          if (status && !brochureZipScanIsPending(status)) {
            const scanSucceeded =
              status.last_successful_at !== null &&
              Date.parse(status.last_successful_at) >= Date.parse(requestedAt);
            if (scanSucceeded) {
              await syncCatalogSnapshot(supabase);
            }
            finishScan(!scanSucceeded);
            return;
          }
        } while (isMounted && isScanPendingLocally && checkStatusAgain);
      } catch (error) {
        debugLog('[brochures] scan status reconciliation failed', error);
        reportError(error, { operation: 'brochure.sync', error_code: 'brochure_sync_failed' });
        finishScan(true);
      } finally {
        isCheckingStatus = false;
      }
    }

    function scheduleFallback(supabase: ReturnType<typeof getSupabase>) {
      if (
        fallbackTimeout !== undefined ||
        !isMounted ||
        !isScanPendingLocally ||
        isRealtimeConnected ||
        !isAppActive
      ) {
        return;
      }

      fallbackTimeout = setTimeout(() => {
        fallbackTimeout = undefined;
        void reconcileScanStatus(supabase).then(() => {
          if (isScanPendingLocally) scheduleFallback(supabase);
        });
      }, SCAN_STATUS_FALLBACK_INTERVAL_MS);
    }

    function subscribeToScanCompletion(supabase: ReturnType<typeof getSupabase>) {
      const channel = supabase.channel(`brochure-scan:${currentZip}`, {
        config: { private: true },
      });

      channel.on('broadcast', { event: 'scan-finished' }, ({ payload }) => {
        if (
          payload.zip_code !== currentZip ||
          (payload.result !== 'succeeded' && payload.result !== 'failed')
        ) {
          return;
        }
        if (isScanPendingLocally && isAppActive) void reconcileScanStatus(supabase);
      });

      channel.subscribe((status) => {
        if (!isMounted) return;
        isRealtimeConnected = status === 'SUBSCRIBED';
        if (isRealtimeConnected) {
          clearFallbackTimeout();
          if (isScanPendingLocally && isAppActive) void reconcileScanStatus(supabase);
        } else {
          scheduleFallback(supabase);
        }
      });

      return () => {
        void supabase.removeChannel(channel);
      };
    }

    async function syncBrochures() {
      setHasSynced(false);
      setIsSyncing(true);
      setIsScanPending(false);
      setHasScanError(false);
      try {
        const supabase = getSupabase();
        try {
          removeRealtimeChannel = subscribeToScanCompletion(supabase);
        } catch (error) {
          debugLog('[brochures] realtime subscription could not start', error);
        }

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
          requestedAt = scanStatus.requested_at;
          isScanPendingLocally = true;
          setIsScanPending(true);
          scanTimeout = setTimeout(() => finishScan(true), SCAN_STATUS_TIMEOUT_MS);
          void reconcileScanStatus(supabase);
          scheduleFallback(supabase);
        }
      } catch (error) {
        debugLog('[brochures] sync failed', error);
        reportError(error, { operation: 'brochure.sync', error_code: 'brochure_sync_failed' });
        if (isMounted) setHasScanError(true);
      } finally {
        if (isMounted) {
          setIsSyncing(false);
          setHasSynced(true);
        }
      }
    }

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      isAppActive = state === 'active';
      if (!isAppActive) {
        clearFallbackTimeout();
      } else if (isScanPendingLocally) {
        const supabase = getSupabase();
        void reconcileScanStatus(supabase);
        scheduleFallback(supabase);
      }
    });

    void syncBrochures();

    return () => {
      isMounted = false;
      clearFallbackTimeout();
      if (scanTimeout !== undefined) clearTimeout(scanTimeout);
      appStateSubscription.remove();
      removeRealtimeChannel?.();
    };
  }, [queryClient, zipCode]);

  return { isSyncing, hasSynced, isScanPending, hasScanError };
}
