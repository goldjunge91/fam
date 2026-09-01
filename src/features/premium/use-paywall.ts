import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PurchasesPackage } from 'react-native-purchases';

import { usePremium } from '@/features/premium/premium-provider';
import { trackAnalyticsEvent } from '@/lib/analytics';
import {
  buyPackage,
  ENTITLEMENT_IDS,
  isPurchasesConfigured,
  type PurchaseOutcome,
  packagesForEntitlement,
  restorePurchases,
} from '@/lib/purchases';
import { type ExtractedPaywallPlans, extractPaywallPlans, type PlanPeriod } from './paywall-plans';
import type { PaywallTier } from './types';

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
 * fuer ein einzelnes Tier (Plus oder AI), mit integriertem Analytics-Funnel-Tracking
 * (Aptabase & PostHog).
 */
export function usePaywall(tier: PaywallTier): UsePaywallResult {
  const { refresh } = usePremium();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<PlanPeriod>('yearly');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const entitlementId = tier === 'plus' ? ENTITLEMENT_IDS.PLUS : ENTITLEMENT_IDS.AI;

  const fetchPackages = useCallback(async () => {
    if (!isPurchasesConfigured()) {
      setIsLoadingPackages(false);
      return;
    }
    setIsLoadingPackages(true);
    try {
      const pkgs = await packagesForEntitlement(entitlementId);
      setPackages(pkgs);
    } catch (err) {
      console.warn('[usePaywall] Packages konnten nicht geladen werden:', err);
    } finally {
      setIsLoadingPackages(false);
    }
  }, [entitlementId]);

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
    trackAnalyticsEvent('purchase.checkout.started', {
      package_id: targetPkg.identifier,
      period: selectedPeriod,
      tier,
      price: targetPkg.product?.price,
      currency: targetPkg.product?.currencyCode,
    });

    try {
      const outcome = await buyPackage(targetPkg);
      if (outcome.kind === 'purchased') {
        trackAnalyticsEvent('purchase.checkout.completed', {
          package_id: targetPkg.identifier,
          period: selectedPeriod,
          tier,
        });
        await refresh();
      } else if (outcome.kind === 'cancelled') {
        trackAnalyticsEvent('purchase.checkout.cancelled', {
          package_id: targetPkg.identifier,
          tier,
        });
      } else if (outcome.kind === 'failed') {
        trackAnalyticsEvent('purchase.checkout.failed', {
          package_id: targetPkg.identifier,
          tier,
          error_code: String(outcome.error.code),
          error_message: outcome.error.message,
        });
      }
      return outcome;
    } finally {
      setIsPurchasing(false);
    }
  }, [isPurchasing, selectedPackage, selectedPeriod, refresh, tier]);

  const restore = useCallback(async (): Promise<{ ok: boolean; error?: unknown }> => {
    if (isRestoring) return { ok: false };
    setIsRestoring(true);
    trackAnalyticsEvent('purchase.restore.started');

    try {
      const result = await restorePurchases();
      if (result.ok) {
        trackAnalyticsEvent('purchase.restore.completed');
        await refresh();
      } else {
        const error = result.error;
        trackAnalyticsEvent('purchase.restore.failed', {
          error_code: error instanceof Error ? error.name : 'restore_failed',
          error_message:
            error instanceof Error ? error.message : 'Kaufwiederherstellung fehlgeschlagen',
        });
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
