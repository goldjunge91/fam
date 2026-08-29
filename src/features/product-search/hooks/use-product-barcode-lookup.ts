import { useCallback, useRef, useState } from 'react';

import type { ProductCatalog } from '@/features/product-search/product-catalog';
import { productCatalog } from '@/features/product-search/product-catalog-instance';
import type { CatalogProduct } from '@/features/product-search/types';
import { trackAnalyticsEvent } from '@/lib/analytics';

export type UseProductBarcodeLookupOptions = {
  /** Test-Seam: ein anderer Katalog (z. B. ein Fake) statt der App-Instanz. */
  catalog?: ProductCatalog;
  onFound?: (product: CatalogProduct) => void;
  onNotFound?: (barcode: string) => void;
};

export type UseProductBarcodeLookupResult = {
  lookup: (barcode: string) => Promise<CatalogProduct | null>;
  product: CatalogProduct | null;
  looking: boolean;
  /** Nutzerlesbarer Text, kein technischer Netzfehler. */
  errorMessage: string | null;
  reset: () => void;
};

/**
 * Barcode-Lookup ueber den Product Catalog: local-first, offline brauchbar,
 * und mit einem Guard gegen den mehrfach erkannten Code. Jeder
 * Barcode-Konsument haengt sich hier an, statt die Reihenfolge erneut zu
 * implementieren.
 */
export function useProductBarcodeLookup(
  options: UseProductBarcodeLookupOptions = {},
): UseProductBarcodeLookupResult {
  const { catalog = productCatalog, onFound, onNotFound } = options;
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [looking, setLooking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Synchroner Guard: die Kamera meldet Codes pro Frame, oft mehrfach und bei
  // zwei Codes im Bild auch verschiedene, bevor ein State-Update sichtbar
  // wird. Bewusst "ein Lookup zur Zeit" statt "ein Lookup pro Code" — sonst
  // laufen zwei Lookups parallel und `onFound` navigiert zweimal (gestapelte
  // Modals).
  const inFlightRef = useRef<string | null>(null);

  const lookup = useCallback(
    async (barcode: string): Promise<CatalogProduct | null> => {
      const trimmed = barcode.trim();
      if (!trimmed || inFlightRef.current !== null) return null;
      inFlightRef.current = trimmed;
      setLooking(true);
      setErrorMessage(null);

      try {
        const found = await catalog.findByBarcode(trimmed);
        trackAnalyticsEvent('product.barcode_scan.completed', { found: found !== null });
        setProduct(found);
        if (found) {
          onFound?.(found);
        } else {
          setErrorMessage(`Kein Produkt für Barcode ${trimmed} gefunden.`);
          onNotFound?.(trimmed);
        }
        return found;
      } catch {
        trackAnalyticsEvent('product.barcode_scan.failed');
        setErrorMessage('Fehler beim Abrufen der Produktdaten.');
        return null;
      } finally {
        inFlightRef.current = null;
        setLooking(false);
      }
    },
    [catalog, onFound, onNotFound],
  );

  const reset = useCallback(() => {
    inFlightRef.current = null;
    setProduct(null);
    setErrorMessage(null);
  }, []);

  return { lookup, product, looking, errorMessage, reset };
}
