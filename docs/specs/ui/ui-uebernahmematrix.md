# ui → Fam: Übernahmematrix

Stand: 2026-09-02  
Quelle: `C:\GIT\ai-mobileapp\ui`  
Ziel: Konkrete Entscheidungen darüber, welche Ideen oder Dateien für Fam sinnvoll sind.

## Kurzentscheidung

ui ist vor allem als UX- und Produktideen-Quelle interessant. Die technische Kernarchitektur wird nicht übernommen, weil Fam bereits ein strengeres Modell besitzt: Supabase Auth/RLS, deklaratives Postgres-Schema, lokale SQLite-Spiegel, Drizzle und Outbox-Sync.

Die wertvollsten Übernahmen sind:

1. Guided-Cooking-Flow mit Timer, TTS, Haptik und großen Interaktionsflächen.
2. Pantry-to-Recipe-UX mit „sofort machbar“, „ein Einkauf entfernt“ und fehlenden Zutaten.
3. Rezeptdaten-Qualitätsprüfungen und deterministische Berechnung als Entwicklungsprozess.
4. Mobile Screen-/Sheet-Grundmuster und Screenshot-basierte QA.
5. Strukturierte Rezeptmetadaten wie Zubereitungsmethode, Sicherheitshinweise, Lagerung und Varianten.

## Entscheidungsmatrix

| ui-Baustein | Konkrete Quelle | Fam-Gegenstück | Übernahmestufe | Aufwand | Risiko | Entscheidung |
| --- | --- | --- | --- | ---: | ---: | --- |
| Expo-Navigation und Bottom Tabs | `mobile/src/app/_layout.tsx`, `mobile/src/app/(tabs)/_layout.tsx` | `src/app/`, bestehendes Expo Router | UX-Muster | niedrig | niedrig | Navigation nicht kopieren. Gute Tab-Hierarchie und Modal-Präsentationen als Referenz nutzen. |
| Screen-Grundgerüst | `mobile/src/components/Screen.tsx` | `src/components/`, Safe-Area- und Screen-Patterns | adaptieren | niedrig | niedrig | Safe Area, Keyboard Insets, Pull-to-Refresh und begrenzte Inhaltsbreite prüfen und selektiv übernehmen. |
| Bottom Sheet | `mobile/src/components/Sheet.tsx` | vorhandene Sheets/Modals in `src/features/*` | adaptieren | niedrig | mittel | Nur UX und Zustandsregeln übernehmen. Fam soll bestehende Sheet-/Gesture-Konventionen behalten. |
| Mobile UI-Primitives | `mobile/src/components/ui.tsx` | `src/components/ui/`, Theme-Tokens | nur Idee | niedrig | mittel | Button-, Empty-State-, Pill- und Section-Patterns prüfen. Datei nicht kopieren: sie nutzt mehrfach `any` und eine andere visuelle Sprache. |
| Guided Cooking | `mobile/src/app/cook/[id].tsx`, `src/lib/tts/`, `mobile/src/lib/tts.ts` | `src/app/recipe/cook.tsx`, `src/features/recipes/hooks/use-cooking-timer.ts` | adaptieren | mittel | niedrig | Hoher Nutzen. Bestehenden Fam-Cooking-Flow um Schritt-Fokus, Timer, TTS, Safety-Cues und Fortschritt erweitern. |
| Haptik | `mobile/src/lib/haptics.ts` | `expo-haptics`, bestehende Fam-Animations-/Interaction-Patterns | adaptieren | niedrig | niedrig | Intent-basierte Haptik übernehmen: Auswahl, Erfolg, Warnung, Fehler. Einstellungspräferenz an Fam-Account-/Device-Storage anbinden. |
| TTS-Fallback | `mobile/src/lib/tts.ts` | `src/lib/tts/` | adaptieren | mittel | mittel | OS-TTS als zuverlässiger Fallback übernehmen. Provider-Key niemals in Expo Public Config oder Client Storage legen. |
| Rezeptstruktur | `src/lib/types.ts`, `src/data/recipes.ts` | `src/lib/db/schemas/recipes.ts`, Rezept-Domain | selektiv übernehmen | mittel | mittel | `primaryCookingMethod`, `safetyNote`, `storageInstructions`, `reheatingInstructions`, `variantGroup` als mögliche Produktfelder prüfen. Nicht das Rezeptmodell ersetzen. |
| Rezeptkatalog | `src/data/recipes.ts`, `src/data/*Recipes.ts` | Fam-Rezeptkatalog und Produktmodell | Rohdaten prüfen | hoch | hoch | Nicht pauschal importieren. Lizenzen, Duplikate, Zutaten-IDs, Einheiten, europäische Verfügbarkeit und Ernährungsqualität zuerst prüfen. |
| Europa-Eignung des Katalogs | `docs/catalog/all-recipes.csv` | Fam-Markt Deutschland/EU | Datenbereinigung | hoch | hoch | 7.214 Rezepte insgesamt, davon 1.467 explizit europäisch kategorisiert. Der Katalog ist nicht EU-ready: Preise sind USD/US-Regionen, Zutaten und Einheiten teils US-zentriert. |
| Nährwertberechnung | `src/lib/nutritionEngine.ts` | `src/features/recipes/domain/nutrition.ts`, Produktnährwerte pro 100 g | nicht kopieren | mittel | hoch | Fam ist mit grammbasierter Komponenten-/Produktberechnung fachlich robuster. Nur Ideen wie Confidence und Missing-Data-Audit übernehmen. |
| Kostenberechnung | `src/lib/pricing/pricingEngine.ts`, `src/lib/pricing/regions.ts` | Fam-Produkte, Preisfelder und Einkaufslogik | nicht kopieren | mittel | hoch | US-Dollar, US-Regionen und pauschale Multiplikatoren passen nicht. Fam braucht EU-/Haushalts-/Store-Kontext. |
| Pantry-Matching | `src/lib/recipeScoring.ts`, `mobile/src/lib/catalog.ts` | `src/features/inventory/`, `src/features/meal-planner/` | Domänenidee | mittel | mittel | Die UX übernehmen. Die Berechnung auf Fam-Bestand, Mengen, Einheiten, Lagerorte und Komponentenbedarf aufbauen. |
| Smart Buy | `recommendSmartBuys()` in `src/lib/recipeScoring.ts` | `src/features/meal-planner/shopping-needs.ts` | Domänenidee | mittel | mittel | ui schlägt den Artikel vor, der die meisten Rezepte freischaltet. Fam sollte zusätzlich reale Gramm-Mengen, vorhandenen Bestand und Haushaltslisten berücksichtigen. |
| Smart Search | `src/lib/search/` | Produkt-/Rezeptsuche in Fam | selektiv übernehmen | mittel | niedrig | Normalisierung, Alias-Behandlung und Suchgründe sind nützlich. Nicht die US-Zutaten-Taxonomie übernehmen. |
| AI-Chef-Worker | `worker/src/index.ts`, `src/lib/workerClient.ts` | `supabase/functions/ai-gateway/` | Architekturidee | mittel | hoch | Endpoint-Trennung, Timeouts, Fallbacks und Modellkonfiguration übernehmen. Auth, Zod-Validierung, Rate Limits und RLS über Fam/Supabase lösen. |
| Anonymer KV-Sync | `shared/src/sync/*`, `worker/src/index.ts` `/sync/*` | `src/lib/sync/`, SQLite-Outbox, Supabase Realtime | ablehnen | niedrig | kritisch | Nicht übernehmen. Sync-Code als alleinige Berechtigung kann fremde Haushalts- und Trackingdaten les-/überschreibbar machen. |
| KV-Fassade über AsyncStorage | `shared/src/platform/kv.ts`, `mobile/src/lib/kvMobile.ts` | `src/lib/db/`, `src/lib/storage/` | ablehnen | mittel | hoch | Für Fam wäre das ein Rückschritt gegenüber SQLite, Transaktionen, Outbox und verschlüsseltem Account-Storage. Nur das Reactive-Subscription-Muster ist interessant. |
| Lokale Bildablage | `mobile/src/lib/imageStore.ts` | `expo-file-system`, bestehende Fam-Medien-/Cache-Patterns | adaptieren | niedrig | mittel | Große Binärdaten lokal aus SQLite/Sync heraushalten. Metadaten und Ownership müssen bei Fam aber account-/haushaltsbezogen bleiben. |
| Settings-Versionierung | `src/lib/settings/storage.ts` | `src/lib/storage/account-preferences.ts` | adaptieren | niedrig | niedrig | Merge-forward und versionierte Defaults als Muster übernehmen, aber Account-Storage und private Datenregeln von Fam verwenden. |
| Datenqualitäts-Audits | `scripts/validateCatalog.ts`, `auditRecipePricing.ts`, `auditRecipeNutrition.ts` | `bun run check`, Jest, DB-/Schema-Tests | Prozess übernehmen | niedrig | niedrig | Für Fam gezielte Rezept-/Produkt-Invarianten ergänzen: fehlende Produktreferenzen, Einheiten, Nährwertgrenzen, Mengen und doppelte IDs. |
| Screenshot-/Tour-QA | `mobile/src/components/ScreenshotDriver.tsx`, `scripts/selftest-mobile.ts` | Maestro, `screenshots/`, Test-Suite | Prozess übernehmen | mittel | niedrig | Tour-Modus und reproduzierbare Demo-Daten als QA-Idee prüfen. Bestehende Maestro-/Agent-Device-Infrastruktur bleibt maßgeblich. |
| Foto-/Voice-Zutaten-Erkennung | `src/lib/anthropic.ts`, Pantry-Scan-Komponenten | `src/features/inventory/`, AI Gateway | adaptieren | hoch | hoch | Produktidee ist relevant. Ergebnisse müssen vor Speicherung normalisiert, bestätigt und über Fam-Autorisierung/Offline-Workflow verarbeitet werden. |
| Rezeptbilder und Attribution | `src/lib/types.ts` `RecipeImage`, `src/data/recipeImages.ts` | Fam-Rezept-/Produktmedien | selektiv übernehmen | mittel | mittel | Lizenz, Quelle, Attribution, Verifikationsstatus und Fallback-Asset als Metadatenmodell übernehmen. |

## Was daraus konkret für Fam folgt

### Sofort sinnvoll

- Guided Cooking gegen unseren bestehenden Rezept-Cook-Screen vergleichen.
- Safe-Area-/Keyboard-/Sheet-Muster aus dem ui-Mobile-Port als UX-Referenz verwenden.
- Rezept-Metadaten um Zubereitungsmethode, Sicherheit, Lagerung und Wiederaufwärmen prüfen.
- Einen gezielten Rezeptdaten-Quality-Gate in unsere bestehende Teststruktur einbauen.

### Erst nach Produktentscheidung

- Europäischer Rezeptimport. Dafür brauchen wir zuerst Zielmärkte, Einheiten, Preislogik, Quellen-/Lizenzregeln und Zutaten-Mapping.
- Pantry-Matching als sichtbare Fam-Funktion. Die Nutzerlogik ist attraktiv, aber Mengen- und Komponentenlogik müssen aus unserem Bestandsmodell kommen.
- AI-Zutaten-Scan. Erst mit bestätigtem Review-Schritt, Offline-Verhalten und sauberem RLS-/Account-Konzept.

### Nicht tun

- Waivys Sync-Code übernehmen.
- Waivys `localStorage`-/AsyncStorage-Architektur als Fam-Datenquelle verwenden.
- Waivys US-Preislogik oder USD-Rezeptpreise für Europa verwenden.
- Den gesamten Rezeptkatalog ungeprüft importieren.
- Provider-Keys in Client-Bundles oder synchronisierten Daten speichern.

## Empfohlene Reihenfolge

1. Guided Cooking und mobile UI vergleichen.
2. Rezept-Metadaten gegen unser deklaratives Schema abgleichen.
3. Einen kleinen europäischen Rezept-Datensatz als Import-Pilot auswählen.
4. Pantry-Matching mit `computeIngredientNeeds()` und echtem Bestand modellieren.
5. Erst danach entscheiden, ob ui-Daten oder nur ui-UX dauerhaft einfließen.
