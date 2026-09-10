import type { QueryClient } from '@tanstack/react-query';
import Purchases from 'react-native-purchases';
import { householdsQueryKey } from '@/features/household/query-keys';
import {
  useForceAiOverrideStore,
  useForcePremiumOverrideStore,
} from '@/features/premium/force-premium-override';
import { getDatabase } from '@/lib/db/client';
import { getSupabase } from '@/lib/supabase';

export interface DevResetHouseholdPremiumOptions {
  householdId: string;
  userId?: string | null;
  queryClient: QueryClient;
}

/**
 * Entwickler-Aktion: Setzt den Plus- und KI-Status eines Haushalts sowohl in Supabase
 * als auch in der lokalen SQLite-Datenbank zurück, bereinigt Overrides und invalidiert
 * den Cache, sodass der Haushalt wieder als Free-User agiert.
 */
export async function devResetHouseholdPremium({
  householdId,
  userId,
  queryClient,
}: DevResetHouseholdPremiumOptions): Promise<void> {
  // 1. Overrides im lokalen Store zurücksetzen
  useForcePremiumOverrideStore.getState().setOverride(null);
  useForceAiOverrideStore.getState().setOverride(null);

  // 2. Supabase-Status aktualisieren (Best Effort)
  try {
    const supabase = getSupabase();
    await supabase
      .from('households')
      .update({
        plus_active: false,
        plus_expires_at: null,
        plus_updated_at: new Date().toISOString(),
        ai_active: false,
        ai_expires_at: null,
        ai_updated_at: new Date().toISOString(),
        ai_subscriber_id: null,
      })
      .eq('id', householdId);
  } catch (err) {
    console.warn('[devResetHouseholdPremium] Supabase-Aktualisierung fehlgeschlagen:', err);
  }

  // 3. Lokale SQLite-Datenbank aktualisieren
  try {
    const db = await getDatabase();
    await db.runAsync(
      `update households
       set plus_active = 0,
           plus_expires_at = null,
           plus_updated_at = datetime('now'),
           ai_active = 0,
           ai_expires_at = null,
           ai_updated_at = datetime('now'),
           ai_subscriber_id = null
       where id = ?`,
      [householdId],
    );
  } catch (err) {
    console.warn('[devResetHouseholdPremium] SQLite-Aktualisierung fehlgeschlagen:', err);
  }

  // 4. RevenueCat CustomerInfo Cache invalidieren
  try {
    await Purchases.invalidateCustomerInfoCache();
  } catch (err) {
    console.warn('[devResetHouseholdPremium] RevenueCat Cache-Invalidierung fehlgeschlagen:', err);
  }

  // 5. Query Cache invalidieren
  if (userId) {
    queryClient.invalidateQueries({ queryKey: householdsQueryKey(userId) });
  }
}
