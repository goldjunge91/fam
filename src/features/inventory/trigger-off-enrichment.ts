import { getSupabase } from '@/lib/supabase';

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
