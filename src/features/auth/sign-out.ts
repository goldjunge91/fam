import type { QueryClient } from '@tanstack/react-query';

import { signOut } from '@/features/auth/api';

/**
 * Meldet ab und raeumt alles auf, was auf dem Geraet zurueckbleibt (#58).
 *
 * Die Reihenfolge ist Absicht: erst der Server-Logout (der die Session
 * invalidiert), dann die lokalen Spuren. Andersherum bliebe bei einem
 * Netzwerkfehler eine geleerte App mit gueltiger Session zurueck.
 *
 * OFFEN bis Epic 2: Die lokale SQLite-Datenbank gibt es noch nicht. Sobald sie
 * existiert, MUSS sie hier mitgeloescht werden — sonst sieht ein zweiter Nutzer
 * auf demselben Geraet den Kuehlschrank des ersten. Bei lokaler Persistenz ist
 * das ein echtes Datenleck, kein Schoenheitsfehler.
 */
export async function signOutAndClearLocalData(queryClient: QueryClient): Promise<{
  error: Error | null;
}> {
  const { error } = await signOut();

  if (error) {
    return { error };
  }

  // supabase-js loescht die Session-Chunks aus SecureStore selbst; der
  // Storage-Adapter raeumt dabei alle Teilschluessel ab (siehe chunked-storage).
  //
  // Der Query-Cache dagegen bleibt ohne diesen Aufruf bestehen und wuerde dem
  // naechsten Nutzer die Daten des vorigen zeigen.
  queryClient.clear();

  return { error: null };
}
