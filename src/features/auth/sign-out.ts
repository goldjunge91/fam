import type { QueryClient } from '@tanstack/react-query';

import { signOut } from '@/features/auth/api';
import { deleteLocalDatabase } from '@/lib/db/client';

/**
 * Meldet ab und raeumt alles auf, was auf dem Geraet zurueckbleibt (#58).
 *
 * Die Reihenfolge ist Absicht: erst der Server-Logout (der die Session
 * invalidiert), dann die lokalen Spuren. Andersherum bliebe bei einem
 * Netzwerkfehler eine geleerte App mit gueltiger Session zurueck.
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

  // Seit Epic 2 liegen Kuehlschrank und Einkaufsliste lokal in SQLite. Bleibt
  // die Datei stehen, sieht der naechste Nutzer auf demselben Geraet die Daten
  // des vorigen — ein Datenleck, kein Schoenheitsfehler.
  //
  // Ein Fehler hier darf den Logout nicht scheitern lassen: Die Session ist zu
  // diesem Zeitpunkt bereits ungueltig, und ein "Abmelden fehlgeschlagen" waere
  // irrefuehrend. `ensureDatabaseBelongsTo()` faengt den Rest beim naechsten
  // Anmelden ab, indem es bei fremder user_id alles verwirft.
  try {
    await deleteLocalDatabase();
  } catch (cleanupError) {
    console.warn('[auth] lokale Datenbank nicht geloescht:', (cleanupError as Error).message);
  }

  return { error: null };
}
