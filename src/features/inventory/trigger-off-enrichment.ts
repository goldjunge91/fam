import { getSupabase } from '@/lib/supabase';

/**
 * Stößt die vertrauenswürdige serverseitige OFF-Anreicherung an (#223 Paket
 * 10, siehe `supabase/functions/enrich-off-product`) — fire-and-forget,
 * blockiert den Aufrufer nie und wirft nie. Der Client schickt
 * ausschließlich die EAN, nie eigene Tags: der Server lädt die
 * Kategorie-Taxonomie selbst von der externen Produktdatenbank (OFF, siehe
 * Glossar in AGENTS.md) und entscheidet selbst (Rate-Limit, "nur wenn
 * neuer"), ob und was er speichert.
 */
export function triggerOffEnrichment(barcode: string): void {
  try {
    // `getSupabase()` wirft SYNCHRON (z.B. fehlende Env-Variable in Tests,
    // siehe MissingEnvError in env.ts) — das faengt ein blosses `.catch()`
    // auf der Promise-Kette nicht ab, deshalb der komplette try/catch.
    getSupabase()
      .functions.invoke('enrich-off-product', { body: { ean: barcode } })
      .catch(() => {
        // Best effort — ein Fehlschlag hier darf das eigentliche Speichern
        // des Produkts nie beeinflussen oder dem Nutzer angezeigt werden.
      });
  } catch {
    // Siehe oben.
  }
}
