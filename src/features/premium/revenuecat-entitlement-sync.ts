import type { CustomerInfo } from 'react-native-purchases';

import { hasAIEntitlement } from '@/lib/backend/revenuecat';
import { getSupabase } from '@/lib/backend/supabase/remote-client';
import { debugWarn } from '@/lib/observability/debug-log';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Reconciles CustomerInfo locally and the authenticated RevenueCat account in production. */
export async function syncRevenueCatAiEntitlement(
  householdId: string | null,
  customerInfo: CustomerInfo,
): Promise<boolean> {
  try {
    const activeEntitlement = hasAIEntitlement(customerInfo)
      ? customerInfo.entitlements.active.AI
      : null;
    const { data, error } = await getSupabase().functions.invoke('revenuecat-entitlement-sync', {
      body: {
        householdId,
        localEntitlement: {
          active: activeEntitlement !== null,
          expiresAt: activeEntitlement?.expirationDate ?? null,
        },
      },
    });

    if (error) {
      debugWarn('[Premium] RevenueCat-AI-Status konnte nicht synchronisiert werden:', error);
      return false;
    }
    return isRecord(data) && data.active === true;
  } catch (error) {
    debugWarn('[Premium] RevenueCat-AI-Status konnte nicht synchronisiert werden:', error);
    return false;
  }
}
