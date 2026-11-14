import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

import { useSession } from '@/features/auth/session-provider';
import { useOptionalActiveHousehold } from '@/features/household/active-household-provider';
import { usePremium } from '@/features/premium/premium-provider';
import { trackAnalyticsEvent } from '@/lib/analytics';
import {
  buyPackage,
  ENTITLEMENT_IDS,
  type PurchaseOutcome,
  packagesForEntitlement,
  restorePurchases,
} from '@/lib/backend/revenuecat';
import { debugWarn } from '@/lib/observability/debug-log';
import { pollHouseholdUntilEntitlementActive } from './household-entitlement-sync';
import { type ExtractedPaywallPlans, extractPaywallPlans, type PlanPeriod } from './paywall-plans';
import { syncRevenueCatAiEntitlement } from './revenuecat-entitlement-sync';
import type { PaywallTier } from './types';

export interface PaywallActivationStatus {
  aiEntitlementSynced: boolean | null;
  householdEntitlementActive: boolean;
  confirmed: boolean;
}

type PaywallPurchaseOutcome =
  | (Extract<PurchaseOutcome, { kind: 'purchased' }> & {
      activation: PaywallActivationStatus;
    })
  | Exclude<PurchaseOutcome, { kind: 'purchased' }>
  | { kind: 'unavailable' };

type PaywallRestoreOutcome =
  | {
      ok: true;
      customerInfo: CustomerInfo;
      activation: PaywallActivationStatus;
    }
  | { ok: false; error?: unknown };

export interface UsePaywallResult {
  packages: PurchasesPackage[];
  plans: ExtractedPaywallPlans;
  selectedPeriod: PlanPeriod;
  setSelectedPeriod: (period: PlanPeriod) => void;
  selectedPackage: PurchasesPackage | null;
  isLoadingPackages: boolean;
  isPurchasing: boolean;
  isRestoring: boolean;
  buySelectedPlan: () => Promise<PaywallPurchaseOutcome>;
  restore: () => Promise<PaywallRestoreOutcome>;
}

/**
 * Hook zur Kapselung von Package-Laden, Plan-Auswahl und Kauf-/Wiederherstellen-Aktionen
 * fuer ein einzelnes Tier (Plus oder AI), mit integriertem Analytics-Funnel-Tracking
 * (Aptabase & PostHog).
 */
export function usePaywall(tier: PaywallTier): UsePaywallResult {
  const { refresh } = usePremium();
  const { session } = useSession();
  const activeHouseholdContext = useOptionalActiveHousehold();
  const activeHouseholdId = activeHouseholdContext?.activeHouseholdId ?? null;
  const userId = session?.user.id;

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<PlanPeriod>('yearly');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const entitlementId = tier === 'plus' ? ENTITLEMENT_IDS.PLUS : ENTITLEMENT_IDS.AI;

  const fetchPackages = useCallback(async () => {
    setIsLoadingPackages(true);
    setPackages([]);
    try {
      const pkgs = await packagesForEntitlement(entitlementId);
      setPackages(pkgs);
    } catch (err) {
      debugWarn('[usePaywall] Packages konnten nicht geladen werden:', err);
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

  const synchronizeActivation = useCallback(
    async (customerInfo: CustomerInfo): Promise<PaywallActivationStatus> => {
      let aiEntitlementSynced: boolean | null = null;
      let householdEntitlementActive = false;

      if (userId) {
        if (tier === 'ai') {
          aiEntitlementSynced = await syncRevenueCatAiEntitlement(activeHouseholdId, customerInfo);
        }
        householdEntitlementActive = await pollHouseholdUntilEntitlementActive({
          tier,
          userId,
          activeHouseholdId,
        });
      }

      return {
        aiEntitlementSynced,
        householdEntitlementActive,
        confirmed:
          Boolean(userId) &&
          householdEntitlementActive &&
          (tier === 'plus' || aiEntitlementSynced === true),
      };
    },
    [activeHouseholdId, tier, userId],
  );

  const buySelectedPlan = useCallback(async (): Promise<PaywallPurchaseOutcome> => {
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
        const activation = await synchronizeActivation(outcome.customerInfo);
        return { ...outcome, activation };
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
  }, [isPurchasing, selectedPackage, selectedPeriod, refresh, tier, synchronizeActivation]);

  const restore = useCallback(async (): Promise<PaywallRestoreOutcome> => {
    if (isRestoring) return { ok: false };
    setIsRestoring(true);
    trackAnalyticsEvent('purchase.restore.started');

    try {
      const result = await restorePurchases();
      if (result.ok) {
        trackAnalyticsEvent('purchase.restore.completed');
        await refresh();
        const activation = await synchronizeActivation(result.customerInfo);
        return { ...result, activation };
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
  }, [isRestoring, refresh, synchronizeActivation]);

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
