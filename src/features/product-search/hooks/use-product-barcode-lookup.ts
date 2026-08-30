import { useCallback, useEffect, useRef, useState } from 'react';

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
  const requestIdRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      requestIdRef.current += 1;
      controllerRef.current?.abort();
    },
    [],
  );

  const lookup = useCallback(
    async (barcode: string): Promise<CatalogProduct | null> => {
      const trimmed = barcode.trim();
      if (!trimmed || inFlightRef.current !== null) return null;
      const requestId = ++requestIdRef.current;
      const controller = new AbortController();
      inFlightRef.current = trimmed;
      controllerRef.current = controller;
      setLooking(true);
      setErrorMessage(null);

      try {
        const found = await catalog.findByBarcode(trimmed, controller.signal);
        if (controller.signal.aborted || requestId !== requestIdRef.current) return null;
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
        if (controller.signal.aborted || requestId !== requestIdRef.current) return null;
        trackAnalyticsEvent('product.barcode_scan.failed');
        setErrorMessage('Fehler beim Abrufen der Produktdaten.');
        return null;
      } finally {
        if (requestId === requestIdRef.current) {
          inFlightRef.current = null;
          if (controllerRef.current === controller) controllerRef.current = null;
          setLooking(false);
        }
      }
    },
    [catalog, onFound, onNotFound],
  );

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    inFlightRef.current = null;
    setLooking(false);
    setProduct(null);
    setErrorMessage(null);
  }, []);

  return { lookup, product, looking, errorMessage, reset };
}
