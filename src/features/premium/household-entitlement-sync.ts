import type { QueryClient } from '@tanstack/react-query';
import { getDatabase } from '@/lib/db/client';
import { queryClient as defaultQueryClient } from '@/lib/query-client';
import { triggerHouseholdsPull } from '@/lib/sync/household-bootstrap-sync';
import type { PaywallTier } from './types';

export interface PollHouseholdEntitlementOptions {
  tier: PaywallTier;
  userId: string;
  activeHouseholdId?: string | null;
  queryClient?: QueryClient;
  maxWaitMs?: number;
  initialDelayMs?: number;
  pollIntervalMs?: number;
}

/**
 * Pollt den Haushalts-Sync kurzzeitig nach einem Kauf oder Restore,
 * bis der serverseitige Webhook die Projektion (plus_active / ai_active)
 * auf den Zielhaushalt in Supabase angewendet und in die lokale SQLite-DB
 * gespiegelt hat.
 */
export async function pollHouseholdUntilEntitlementActive({
  tier,
  userId,
  activeHouseholdId,
  queryClient = defaultQueryClient,
  maxWaitMs = 8000,
  initialDelayMs = 600,
  pollIntervalMs = 1200,
}: PollHouseholdEntitlementOptions): Promise<boolean> {
  if (!userId) return false;

  const startTime = Date.now();

  if (initialDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, initialDelayMs));
  }

  while (Date.now() - startTime < maxWaitMs) {
    await triggerHouseholdsPull(userId, queryClient);

    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<{ id: string; plus_active: number; ai_active: number }>(
        `select id, plus_active, ai_active from households`,
      );
      const match = rows.find((r) => (activeHouseholdId ? r.id === activeHouseholdId : true));
      if (match) {
        if (tier === 'plus' && match.plus_active === 1) return true;
        if (tier === 'ai' && match.ai_active === 1) return true;
      }
    } catch (err) {
      console.warn(
        '[pollHouseholdUntilEntitlementActive] Fehler beim Prüfen der Haushaltszeile:',
        err,
      );
    }

    if (Date.now() - startTime + pollIntervalMs >= maxWaitMs) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return false;
}
