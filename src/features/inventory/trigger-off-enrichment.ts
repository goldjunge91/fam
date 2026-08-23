import { getSupabase } from '@/lib/supabase';

/** Startet die serverseitige OFF-Anreicherung best effort nur mit der EAN. */
export function triggerOffEnrichment(barcode: string): void {
  try {
    // Der aeussere Block faengt auch synchrone Initialisierungsfehler ab.
    getSupabase()
      .functions.invoke('enrich-off-product', { body: { ean: barcode } })
      .catch(() => {});
  } catch {}
}
