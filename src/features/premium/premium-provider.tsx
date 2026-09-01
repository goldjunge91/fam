import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Purchases, { type CustomerInfo } from 'react-native-purchases';

import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useForcePremiumOverrideStore } from '@/features/premium/force-premium-override';
import { env } from '@/lib/env';
import {
  initPurchases,
  isPurchasesConfigured,
  resetPurchasesIdentity,
  setPurchasesAttributes,
  setPurchasesEmail,
  syncPurchasesIdentity,
} from '@/lib/purchases';

type PremiumContextValue = {
  /** Serverautorisierter Plus-Status des aktiven Haushalts. */
  hasPlus: boolean;
  /** Serverautorisierter AI-Status des aktiven Haushalts, unabhaengig von Plus. */
  hasAI: boolean;
  /**
   * Ob `hasPlus` erzwungen ist statt aus RevenueCat/der DB zu kommen — entweder ueber
   * `EXPO_PUBLIC_FORCE_PREMIUM` (Build-Zeit) oder den Dev-Tools-Override (Laufzeit, siehe
   * `force-premium-override.ts`), z. B. um Plus in einem bereits kompilierten TestFlight-Build umzuschalten.
   */
  isForced: boolean;
  /** `null` ohne konfigurierten RevenueCat-API-Key oder vor dem ersten Laden. */
  customerInfo: CustomerInfo | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

type OwnedCustomerInfo = {
  info: CustomerInfo;
  userId: string;
};

const PremiumContext = createContext<PremiumContextValue | null>(null);

export function PremiumProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const { activeHouseholdId, activeHousehold } = useActiveHousehold();
  const [ownedCustomerInfo, setOwnedCustomerInfo] = useState<OwnedCustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const userId = session?.user.id;
  const userEmail = session?.user.email;
  const identitySyncGenerationRef = useRef(0);
  const currentUserIdRef = useRef(userId);
  const purchasesOperationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const listenerRefreshPendingRef = useRef(false);
  const mountedRef = useRef(true);

  // Commit-synchron invalidieren: damit existiert nach einem Account-Wechsel
  // kein Fenster vor dem passiven Identity-Effect, in dem ein alter Request
  // noch schreiben darf. Anders als eine Mutation waehrend des Renders bleibt
  // dieser Stand bei abgebrochenen Concurrent-Renders konsistent.
  useLayoutEffect(() => {
    if (currentUserIdRef.current !== userId) {
      currentUserIdRef.current = userId;
      identitySyncGenerationRef.current += 1;
    }
  }, [userId]);

  const enqueuePurchasesOperation = useCallback((operation: () => Promise<void>) => {
    const next = purchasesOperationQueueRef.current.then(operation, operation);
    purchasesOperationQueueRef.current = next.catch(() => undefined);
    return next;
  }, []);

  const refresh = useCallback(async () => {
    if (!isPurchasesConfigured()) {
      setLoading(false);
      return;
    }

    const generation = identitySyncGenerationRef.current;
    const expectedUserId = currentUserIdRef.current;
    const isCurrent = () =>
      mountedRef.current &&
      identitySyncGenerationRef.current === generation &&
      currentUserIdRef.current === expectedUserId;

    if (!expectedUserId) {
      if (isCurrent()) setLoading(false);
      return;
    }

    return enqueuePurchasesOperation(async () => {
      if (!isCurrent()) return;

      try {
        const revenueCatUserIdBefore = await Purchases.getAppUserID();
        if (!isCurrent() || revenueCatUserIdBefore !== expectedUserId) return;

        const info = await Purchases.getCustomerInfo();
        const revenueCatUserIdAfter = await Purchases.getAppUserID();
        if (isCurrent() && revenueCatUserIdAfter === expectedUserId) {
          setOwnedCustomerInfo({
            info,
            userId: expectedUserId,
          });
        }
      } catch (err) {
        console.warn('[Premium] CustomerInfo konnte nicht geladen werden:', err);
      } finally {
        if (isCurrent()) setLoading(false);
      }
    });
  }, [enqueuePurchasesOperation]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    initPurchases();

    if (!isPurchasesConfigured()) {
      setLoading(false);
      return;
    }

    const listener = () => {
      if (listenerRefreshPendingRef.current) return;
      listenerRefreshPendingRef.current = true;
      void refresh().finally(() => {
        listenerRefreshPendingRef.current = false;
      });
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [refresh]);

  // RevenueCat-Identität mit Supabase-User synchronisieren
  useEffect(() => {
    if (!isPurchasesConfigured()) {
      setLoading(false);
      return;
    }

    // Ein Generation-Zaehler markiert, welcher Aufruf der aktuelle ist: loest ein
    // aelterer Sync/Reset erst auf, nachdem ein neuerer bereits gestartet wurde
    // (Account-Wechsel waehrend eines laufenden Requests), darf sein Ergebnis
    // customerInfo nicht mehr setzen.
    identitySyncGenerationRef.current += 1;
    const generation = identitySyncGenerationRef.current;
    const expectedUserId = userId;
    const isCurrent = () =>
      mountedRef.current &&
      identitySyncGenerationRef.current === generation &&
      currentUserIdRef.current === expectedUserId;

    void enqueuePurchasesOperation(async () => {
      if (!isCurrent()) return;

      try {
        if (userId) {
          const info = await syncPurchasesIdentity(userId, {
            household_id: activeHouseholdId ?? null,
            $posthogUserId: userId,
          });
          if (!isCurrent()) return;
          if (info) {
            setOwnedCustomerInfo({
              info,
              userId,
            });
          }
          if (userEmail) {
            await setPurchasesEmail(userEmail);
          }
        } else {
          await resetPurchasesIdentity();
          if (!isCurrent()) return;
          setOwnedCustomerInfo(null);
        }
      } catch (err) {
        console.warn('[Premium] RevenueCat-Identitaet konnte nicht synchronisiert werden:', err);
      } finally {
        if (isCurrent()) setLoading(false);
      }
    });
  }, [userId, userEmail, activeHouseholdId, enqueuePurchasesOperation]);

  // Haushaltswechsel an RevenueCat Subscriber Attributes melden
  useEffect(() => {
    if (!isPurchasesConfigured() || !userId) return;

    const generation = identitySyncGenerationRef.current;
    const expectedUserId = userId;
    void enqueuePurchasesOperation(async () => {
      if (
        !mountedRef.current ||
        identitySyncGenerationRef.current !== generation ||
        currentUserIdRef.current !== expectedUserId
      ) {
        return;
      }
      try {
        await setPurchasesAttributes({
          household_id: activeHouseholdId ?? null,
          $posthogUserId: userId,
        });
      } catch (err) {
        console.warn('[Premium] RevenueCat-Attribute konnten nicht gesetzt werden:', err);
      }
    });
  }, [activeHouseholdId, userId, enqueuePurchasesOperation]);

  const forcePremiumOverride = useForcePremiumOverrideStore((state) => state.override);
  const isForced = forcePremiumOverride ?? env.forcePremium;
  const hasPlus = isForced || (activeHousehold?.plus_active ?? false);
  const hasAI = activeHousehold?.ai_active ?? false;
  const customerInfo =
    ownedCustomerInfo !== null && ownedCustomerInfo.userId === userId
      ? ownedCustomerInfo.info
      : null;

  const value = useMemo(
    () => ({ hasPlus, hasAI, isForced, customerInfo, loading, refresh }),
    [hasPlus, hasAI, isForced, customerInfo, loading, refresh],
  );

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

const DEFAULT_PREMIUM_CONTEXT: PremiumContextValue = {
  hasPlus: false,
  hasAI: false,
  isForced: false,
  customerInfo: null,
  loading: false,
  refresh: async () => {},
};

export function usePremium(): PremiumContextValue {
  const ctx = useContext(PremiumContext);
  return ctx ?? DEFAULT_PREMIUM_CONTEXT;
}
