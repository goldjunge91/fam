# Produktkatalog local-first und UI sauber trennen

## Zusammenfassung

Die Beobachtung stimmt teilweise:

- `open-food-facts.ts` ist kein Modal, sondern ein gemischtes Modul aus API-Client, OFF-Mapping, Produktmodell und Route-Parametern.
- Der Offline-Dump wird aktuell in den Suchpfaden verwendet.
- Der Barcode-Scanner ruft jedoch direkt die API auf.
- Das Produktdetail-Modal ruft ebenfalls direkt die API auf.
- `ProductSearchDropdown` enthält derzeit selbst SQLite-Abfragen, Dump/API-Orchestrierung, Ranking, Pagination und UI-State.
- `initOffDump()` läuft nach dem Login asynchron. Eine Suche kann deshalb vor dem Attach des Dumps starten und fällt dann still auf die API zurück.

Der gewählte Scope ist: gemeinsame Local-first-Logik für Suche und Barcode-Scanner. Das Produktdetail-Modal bleibt zunächst außerhalb dieses Refactors.

## Architekturänderungen

### 1. Neutrales Produktmodell

`OpenFoodFactsProduct` wird zu einem neutralen Katalogmodell wie `CatalogProduct` umgebaut. Dump-, lokale Spiegel- und API-Treffer werden damit gleich behandelt.

Das Modell enthält weiterhin:

- Identität, Barcode, Name und Marke
- Mengen- und Nährwertdaten
- Bild, Nutri-Score, Allergene und Kategorie-Tags
- OFF-Metadaten, sofern vorhanden

`open-food-facts.ts` bleibt nicht länger die zentrale Typquelle für alle Produktflüsse.

### 2. Datenquellen auslagern

Die Datenzugriffe werden in getrennte Adapter verschoben:

- `local-product-source`: eigener lokaler Produktspiegel
- `off-dump-product-source`: Suche und Barcode-Lookup im angehängten Dump
- `off-api-source`: HTTP, Rate-Limit, Retry, Cache und OFF-Payload-Mapping

Der bestehende Dump-Lifecycle mit Baseline, Patch, Attach und Recovery bleibt in `src/lib/off-dump` erhalten. Nur die Produktabfragen werden aus dem Lifecycle-Modul herausgelöst.

`open-food-facts.ts` wird anschließend entweder entfernt oder auf den reinen OFF-API-Adapter reduziert. Die UI importiert dieses Modul nicht mehr direkt.

### 3. Gemeinsamer `ProductCatalog`

Ein gemeinsamer Service unter `src/features/product-search` bündelt die Quellen:

```ts
type ProductSearchResult = {
  products: CatalogProduct[];
  hasMore: boolean;
  failed: boolean;
};

interface ProductCatalog {
  search(
    query: string,
    options?: {
        cursor?: string; // Base64-codierter Composite-Cursor
      limit?: number;
      signal?: AbortSignal;
    },
  ): Promise<ProductSearchResult & { nextCursor?: string }>;

  findByBarcode(
    barcode: string,
    signal?: AbortSignal,
  ): Promise<CatalogProduct | null>;
}
```

Verhalten:

- Textsuche: lokaler Produktspiegel und Offline-Dump zuerst
- API nur bei fehlenden lokalen Treffern und bestehender Verbindung
- Barcode: lokaler Produktspiegel, danach Dump, danach API-Fallback
- Offline: lokale Ergebnisse funktionieren weiter, fehlende Produkte liefern keinen Netzfehler
- Deduplizierung & Priorität: Es wird streng nach der Reihenfolge Local -> Dump -> API vorgegangen. Ein Treffer in einer höheren Ebene "gewinnt" komplett (kein Deep-Merge von Eigenschaften zwischen Dump und API).
- Pagination über Composite Cursor: Die Pagination wird über einen undurchsichtigen Cursor intern gesteuert, damit die UI keine Dump-Offsets und API-Seiten mehr kennen muss. Der String ist ein Base64-codiertes JSON (z. B. { localOffset: 15, dumpOffset: 40, apiPage: 2 }), wodurch der Service zustandslos bleibt, aber exakt weiß, wo in welcher Quelle weitergesucht werden muss.
- Der Quelltyp bleibt für die Nutzeroberfläche unsichtbar. Interne Telemetrie darf ihn weiterhin protokollieren.

Pagination über Composite Cursor: Die Pagination wird über einen undurchsichtigen Cursor intern gesteuert, damit die UI keine Dump-Offsets und API-Seiten mehr kennen muss. Der String ist ein Base64-codiertes JSON (z. B. { localOffset: 15, dumpOffset: 40, apiPage: 2 }), wodurch der Service zustandslos bleibt, aber exakt weiß, wo in welcher Quelle weitergesucht werden muss.

### 4. Hooks statt Datenlogik in UI-Komponenten

Neu beziehungsweise refaktoriert:

- `useProductSearch`: Debounce, Abbruch veralteter Suchen, Pagination und UI-nahe Ladezustände.
- `useProductBarcodeLookup`: Lookup, Fehlerzustand und Verarbeitung eines gescannten Barcodes

`ProductSearchDropdown` rendert anschließend nur:

- Eingabefeld
- Offline-freundliche UI: Da OFF-Bilder trotz lokalem Dump HTTP-Links sind, sorgt die UI für saubere callback-Platzhalter, falls das Gerät offline ist und die Bilder nicht im Cache liegen.
- Lade-/Leer-/Fehlerzustände
- Trefferliste
- Auswahl-Callback

`FoodSearchDropdown` nutzt denselben Such-Hook und ergänzt ausschließlich den privaten Lebensmittelverlauf.

Die bisherige eigene SQL-Suche in `ProductSearchDropdown` wird in den lokalen Produkt-Adapter verschoben.

### 5. Barcode-Scanner wird präsentational

`BarcodeScannerModal` importiert künftig keine Produktdatenquelle mehr.

Es rendert nur:

- Kamera und Berechtigungszustand
- Scan-Status
- Fehlertext
- Schließen-Aktion

Statt eines fertigen Produkts meldet es den rohen Barcode:

```ts
onBarcodeDetected(barcode: string): void;
```

Der aufrufende Feature-Hook übernimmt anschließend den gemeinsamen local-first Lookup. Dadurch verwenden Inventar, Einkaufslisten, Kalorientracking und Debug-Scanner automatisch denselben Barcode-Pfad.

### 6. Route-Parameter aus dem Produktmodul entfernen

`productToRouteParams()` und `productFromRouteParams()` gehören nicht in den Produktdatenadapter. Sie werden in einen kalorietracking-spezifischen Route-Adapter verschoben.

Damit bleiben:

- OFF-Datenmodell bei den Produktdaten
- Navigation und Deep-Link-Kompatibilität beim Calorie-Tracking

bestehen, ohne die Domänen zu vermischen.

## Tests und Abnahmekriterien

Gezielte Tests für den neuen Katalog:

- Dump-Treffer verhindern einen API-Aufruf.
- Dump-Barcodes funktionieren offline.
- Dump-Miss verwendet online den API-Fallback.
- Fehlender oder nicht angehängter Dump führt nicht zum UI-Crash.
- Lokale Spiegelprodukte werden korrekt dedupliziert.
- API- und Dump-Treffer mit gleicher EAN erscheinen nur einmal.
- Pagination lädt weitere lokale und entfernte Treffer korrekt.
- Abgebrochene Suchanfragen überschreiben keine neuere Suche.
- API-Fehler zeigen lokale Treffer weiterhin an.
- Barcode-Lookup verwendet dieselbe Reihenfolge wie die Textsuche.

UI-Tests werden auf Rendering und Callbacks reduziert:

- `ProductSearchDropdown` ruft nur den Hook auf und rendert dessen Ergebnis.
- `FoodSearchDropdown` behält Verlauf und Auswahlverhalten.
- `BarcodeScannerModal` meldet nur den erkannten Barcode und führt selbst keinen API-Aufruf aus.

Erfolgreich ist der Refactor, wenn kein UI-Modul mehr direkt `fetchProductByBarcode`, `searchOpenFoodFacts`, `searchOffDump` oder `getDatabase` für Produktsuche verwendet und derselbe Barcode offline über den Dump gefunden wird.

## Annahmen

- Der Produktdetail-Modal bleibt bewusst unverändert und darf weiterhin online anreichern.
- Kein Data-Merging: Wenn ein lokaler oder Dump-Treffer gefunden wird, wird nicht zusätzlich die API aufgerufen, um
- potenziell neuere Felder (z. B. ein neueres Bild) anzureichern. Die erste erfolgreiche Quelle liefert das finale Produkt für die Liste.
- Bilder aus dem Offline-Dump setzen voraus, dass der Nutzer entweder online ist oder das Bild gecacht wurde. Der Dump selbst speichert keine Binärdaten für Bilder.
- Es werden keine Supabase-Schemas, Migrationen oder Dump-Pipeline-Dateien geändert.
- Das bisherige Verhalten mit API-Fallback bleibt erhalten.
- Der fehlende Dump wird nicht als sichtbarer Fehler dargestellt, sondern nur intern diagnostiziert.
- Bestehende Route-Parameter bleiben rückwärtskompatibel.