import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PurchasesPackage } from 'react-native-purchases';

import { usePremium } from '@/features/premium/premium-provider';
import { trackAnalyticsEvent } from '@/lib/analytics';
import {
  buyPackage,
  currentPackages,
  isPurchasesConfigured,
  type PurchaseOutcome,
  restorePurchases,
} from '@/lib/purchases';
import { type ExtractedPaywallPlans, extractPaywallPlans, type PlanPeriod } from './paywall-plans';

export interface UsePaywallResult {
  packages: PurchasesPackage[];
  plans: ExtractedPaywallPlans;
  selectedPeriod: PlanPeriod;
  setSelectedPeriod: (period: PlanPeriod) => void;
  selectedPackage: PurchasesPackage | null;
  isLoadingPackages: boolean;
  isPurchasing: boolean;
  isRestoring: boolean;
  buySelectedPlan: () => Promise<PurchaseOutcome | { kind: 'unavailable' }>;
  restore: () => Promise<{ ok: boolean; error?: unknown }>;
}

/**
 * Hook zur Kapselung von Package-Laden, Plan-Auswahl und Kauf-/Wiederherstellen-Aktionen
 * mit integriertem Analytics-Funnel-Tracking (Aptabase & PostHog).
 */
export function usePaywall(): UsePaywallResult {
  const { refresh } = usePremium();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<PlanPeriod>('yearly');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const fetchPackages = useCallback(async () => {
    if (!isPurchasesConfigured()) {
      setIsLoadingPackages(false);
      return;
    }
    try {
      const pkgs = await currentPackages();
      setPackages(pkgs);
    } catch (err) {
      console.warn('[usePaywall] Packages konnten nicht geladen werden:', err);
    } finally {
      setIsLoadingPackages(false);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const plans = useMemo(() => extractPaywallPlans(packages), [packages]);

  const selectedPackage = useMemo(() => {
    return selectedPeriod === 'yearly' ? plans.yearly.package : plans.monthly.package;
  }, [selectedPeriod, plans]);

  const buySelectedPlan = useCallback(async (): Promise<
    PurchaseOutcome | { kind: 'unavailable' }
  > => {
    if (isPurchasing) return { kind: 'cancelled' };

    const targetPkg = selectedPackage;
    if (!targetPkg) {
      // Wenn noch keine echten Store-Packages konfiguriert sind (z.B. reiner Mock/Web)
      return { kind: 'unavailable' };
    }

    setIsPurchasing(true);
    trackAnalyticsEvent('purchase_started', {
      package_id: targetPkg.identifier,
      period: selectedPeriod,
      price: targetPkg.product?.price,
      currency: targetPkg.product?.currencyCode,
    });

    try {
      const outcome = await buyPackage(targetPkg);
      if (outcome.kind === 'purchased') {
        trackAnalyticsEvent('purchase_completed', {
          package_id: targetPkg.identifier,
          period: selectedPeriod,
        });
        await refresh();
      } else if (outcome.kind === 'cancelled') {
        trackAnalyticsEvent('purchase_cancelled', {
          package_id: targetPkg.identifier,
        });
      } else if (outcome.kind === 'failed') {
        trackAnalyticsEvent('purchase_failed', {
          package_id: targetPkg.identifier,
          error_code: String(outcome.error.code),
          error_message: outcome.error.message,
        });
      }
      return outcome;
    } finally {
      setIsPurchasing(false);
    }
  }, [isPurchasing, selectedPackage, selectedPeriod, refresh]);

  const restore = useCallback(async (): Promise<{ ok: boolean; error?: unknown }> => {
    if (isRestoring) return { ok: false };
    setIsRestoring(true);
    trackAnalyticsEvent('restore_purchases_clicked');

    try {
      const result = await restorePurchases();
      if (result.ok) {
        trackAnalyticsEvent('purchase_restored');
        await refresh();
      }
      return result;
    } finally {
      setIsRestoring(false);
    }
  }, [isRestoring, refresh]);

  return {
    packages,
    plans,
    selectedPeriod,
    setSelectedPeriod,
    selectedPackage,
    isLoadingPackages,
    isPurchasing,
    isRestoring,
    buySelectedPlan,
    restore,
  };
}
