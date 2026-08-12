import type { Database } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

/**
 * Vollstaendiger Datenexport (#97, DSGVO Art. 20).
 *
 * Nur eigene, private Daten des angemeldeten Accounts — keine geteilten
 * Haushaltsdaten anderer Mitglieder (Kuehlschrank-Bestand, Einkaufsliste
 * gehoeren dem Haushalt, nicht dem einzelnen Nutzer, siehe #96/docs/DATENSCHUTZ.md).
 * Haushaltsmitgliedschaften selbst (welchem Haushalt man angehoert, mit
 * welcher Rolle) sind Teil des Exports, weil sie zum eigenen Account gehoeren.
 */

const PAGE_SIZE = 1000;

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type UserGoalRow = Database['public']['Tables']['user_goals']['Row'];
type FoodEntryRow = Database['public']['Tables']['food_entries']['Row'];
type WeightEntryRow = Database['public']['Tables']['weight_entries']['Row'];
type ChildProfileRow = Database['public']['Tables']['child_profiles']['Row'];
type HouseholdMemberRow = Database['public']['Tables']['household_members']['Row'];

export type UserDataExport = {
  exportedAt: string;
  format: 'fam-user-export-v1';
  profile: ProfileRow | null;
  goals: UserGoalRow[];
  foodEntries: FoodEntryRow[];
  weightEntries: WeightEntryRow[];
  childProfiles: ChildProfileRow[];
  householdMemberships: HouseholdMemberRow[];
};

/** Liest alle Zeilen einer Tabelle fuer `userId`, seitenweise gegen `PAGE_SIZE`. */
async function fetchAllPages<T>(
  table: 'user_goals' | 'food_entries' | 'weight_entries',
  userId: string,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await getSupabase()
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

export async function buildUserDataExport(userId: string): Promise<UserDataExport> {
  const supabase = getSupabase();

  const [profileResult, childProfilesResult, membershipsResult, goals, foodEntries, weightEntries] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      // Kinderprofile gehoeren dem Haushalt, nicht dem einzelnen Elternteil —
      // trotzdem im Export, weil ein Nutzer sie angelegt/verwaltet hat und sie
      // sonst mit der Kontoloeschung (#98) sonst unauffindbar waeren.
      supabase.from('child_profiles').select('*').eq('managed_by', userId),
      supabase.from('household_members').select('*').eq('user_id', userId),
      fetchAllPages<UserGoalRow>('user_goals', userId),
      fetchAllPages<FoodEntryRow>('food_entries', userId),
      fetchAllPages<WeightEntryRow>('weight_entries', userId),
    ]);

  if (profileResult.error) throw profileResult.error;
  if (childProfilesResult.error) throw childProfilesResult.error;
  if (membershipsResult.error) throw membershipsResult.error;

  return {
    exportedAt: new Date().toISOString(),
    format: 'fam-user-export-v1',
    profile: profileResult.data,
    goals,
    foodEntries,
    weightEntries,
    childProfiles: childProfilesResult.data ?? [],
    householdMemberships: membershipsResult.data ?? [],
  };
}
