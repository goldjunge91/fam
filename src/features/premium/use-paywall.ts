import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PurchasesPackage } from 'react-native-purchases';

import { usePremium } from '@/features/premium/premium-provider';
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
 * Hook zur Kapselung von Package-Laden, Plan-Auswahl und Kauf-/Wiederherstellen-Aktionen.
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
    try {
      const outcome = await buyPackage(targetPkg);
      if (outcome.kind === 'purchased') {
        await refresh();
      }
      return outcome;
    } finally {
      setIsPurchasing(false);
    }
  }, [isPurchasing, selectedPackage, refresh]);

  const restore = useCallback(async (): Promise<{ ok: boolean; error?: unknown }> => {
    if (isRestoring) return { ok: false };
    setIsRestoring(true);
    try {
      const result = await restorePurchases();
      if (result.ok) {
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
