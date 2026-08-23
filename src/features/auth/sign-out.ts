import type { QueryClient } from '@tanstack/react-query';

import { signOut } from '@/features/auth/api';
import { setStoredActiveHouseholdId } from '@/features/household/active-household-store';
import { deleteLocalDatabase } from '@/lib/db/client';

/** Meldet erst serverseitig ab und entfernt danach lokale Nutzerdaten. */
export async function signOutAndClearLocalData(queryClient: QueryClient): Promise<{
  error: Error | null;
}> {
  const { error } = await signOut();

  if (error) {
    return { error };
  }

  // `resetQueries` benachrichtigt gemountete Observer und verhindert Datenlecks zum Folgekonto.
  await queryClient.resetQueries();

  // Die Session ist bereits ungueltig; lokales Aufraeumen darf den Logout nicht umkehren.
  try {
    await deleteLocalDatabase();
  } catch (cleanupError) {
    console.warn('[auth] lokale Datenbank nicht geloescht:', (cleanupError as Error).message);
  }

  // Die Haushaltsauswahl muss auch nach einem fehlgeschlagenen DB-Cleanup verschwinden.
  try {
    await setStoredActiveHouseholdId(null);
  } catch (cleanupError) {
    console.warn('[auth] aktiver Haushalt nicht zurueckgesetzt:', (cleanupError as Error).message);
  }

  return { error: null };
}
