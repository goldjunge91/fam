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
|---|---|---|---|---:|---:|---|
| Expo-Navigation und Bottom Tabs | `mobile/src/app/_layout.tsx`, `mobile/src/app/(tabs)/_layout.tsx` | `src/app/`, bestehendes Expo Router | UX-Muster | niedrig | niedrig | Navigation nicht kopieren. Gute Tab-Hierarchie und Modal-Präsentationen als Referenz nutzen. |
| Screen-Grundgerüst | `mobile/src/components/Screen.tsx` | `src/components/`, Safe-Area- und Screen-Patterns | adaptieren | niedrig | niedrig | Safe Area, Keyboard Insets, Pull-to-Refresh und begrenzte Inhaltsbreite selektiv übernehmen. |
| Bottom Sheet | `mobile/src/components/Sheet.tsx` | vorhandene Sheets/Modals in `src/features/*` | adaptieren | niedrig | mittel | Nur UX und Zustandsregeln übernehmen. Fam behält bestehende Sheet-/Gesture-Konventionen. |
| Mobile UI-Primitives | `mobile/src/components/ui.tsx` | `src/components/ui/`, Theme-Tokens | nur Idee | niedrig | mittel | Button-, Empty-State-, Pill- und Section-Patterns prüfen. Datei nicht kopieren: mehrere `any` und andere visuelle Sprache. |
| Guided Cooking | `mobile/src/app/cook/[id].tsx`, `src/lib/tts/`, `mobile/src/lib/tts.ts` | `src/app/recipe/cook.tsx`, `use-cooking-timer.ts` | adaptieren | mittel | niedrig | Hoher Nutzen. Bestehenden Fam-Cooking-Flow um Schritt-Fokus, Timer, TTS, Safety-Cues und Fortschritt erweitern. |
| Haptik | `mobile/src/lib/haptics.ts` | `expo-haptics`, Fam-Interaction-Patterns | adaptieren | niedrig | niedrig | Intent-basierte Haptik übernehmen: Auswahl, Erfolg, Warnung, Fehler. Präferenz in Fam-Storage anbinden. |
| TTS-Fallback | `mobile/src/lib/tts.ts` | `src/lib/tts/` | adaptieren | mittel | mittel | OS-TTS als Fallback übernehmen. Provider-Key niemals in Expo Public Config oder Client Storage legen. |
| Rezeptstruktur | `src/lib/types.ts`, `src/data/recipes.ts` | `src/lib/db/schemas/recipes.ts`, Rezept-Domain | selektiv | mittel | mittel | Zubereitungsmethode, Sicherheit, Lagerung und Varianten prüfen. Nicht das Fam-Rezeptmodell ersetzen. |
| Rezeptkatalog | `src/data/recipes.ts`, `src/data/*Recipes.ts` | Fam-Rezeptkatalog und Produktmodell | Rohdaten prüfen | hoch | hoch | Nicht pauschal importieren. Lizenzen, Duplikate, IDs, Einheiten, EU-Verfügbarkeit und Ernährungsqualität prüfen. |
| Europa-Eignung | `docs/catalog/all-recipes.csv` | Fam-Markt Deutschland/EU | Datenbereinigung | hoch | hoch | 7.214 Rezepte insgesamt, 1.467 explizit europäisch kategorisiert. Nicht EU-ready: USD/US-Regionen und teils US-zentrierte Zutaten/Einheiten. |
| Nährwertberechnung | `src/lib/nutritionEngine.ts` | `src/features/recipes/domain/nutrition.ts` | nicht kopieren | mittel | hoch | Fam ist mit grammbasierter Komponenten-/Produktberechnung robuster. Nur Confidence-/Missing-Data-Audit als Idee übernehmen. |
| Kostenberechnung | `src/lib/pricing/pricingEngine.ts`, `src/lib/pricing/regions.ts` | Fam-Produkte und Einkaufslogik | nicht kopieren | mittel | hoch | US-Dollar, US-Regionen und Multiplikatoren passen nicht zu Fam. |
| Pantry-Matching | `src/lib/recipeScoring.ts`, `mobile/src/lib/catalog.ts` | `src/features/inventory/`, `src/features/meal-planner/` | Domänenidee | mittel | mittel | UX übernehmen. Berechnung auf Fam-Bestand, Mengen, Einheiten, Lagerorte und Komponentenbedarf aufbauen. |
| Smart Buy | `recommendSmartBuys()` in `src/lib/recipeScoring.ts` | `src/features/meal-planner/shopping-needs.ts` | Domänenidee | mittel | mittel | Artikel vorschlagen, der viele Rezepte freischaltet. Fam zusätzlich mit Gramm-Mengen und realem Bestand berechnen. |
| Smart Search | `src/lib/search/` | Produkt-/Rezeptsuche in Fam | selektiv | mittel | niedrig | Normalisierung, Aliase und Suchgründe sind nützlich. US-Taxonomie nicht übernehmen. |
| AI-Chef-Worker | `worker/src/index.ts`, `src/lib/workerClient.ts` | `supabase/functions/ai-gateway/` | Architekturidee | mittel | hoch | Endpoint-Trennung, Timeouts und Fallbacks übernehmen. Auth, Zod, Rate Limits und RLS über Fam lösen. |
| Anonymer KV-Sync | `shared/src/sync/*`, Worker `/sync/*` | `src/lib/sync/`, SQLite-Outbox, Supabase Realtime | ablehnen | niedrig | kritisch | Nicht übernehmen. Der Code allein ist die Berechtigung auf komplette Haushalts- und Trackingdaten. |
| KV-Fassade über AsyncStorage | `shared/src/platform/kv.ts`, `mobile/src/lib/kvMobile.ts` | `src/lib/db/`, `src/lib/storage/` | ablehnen | mittel | hoch | Rückschritt gegenüber SQLite, Transaktionen, Outbox und verschlüsseltem Account-Storage. |
| Lokale Bildablage | `mobile/src/lib/imageStore.ts` | `expo-file-system`, Fam-Medien-/Cache-Patterns | adaptieren | niedrig | mittel | Große Binärdaten lokal halten. Metadaten und Ownership bleiben account-/haushaltsbezogen. |
| Settings-Versionierung | `src/lib/settings/storage.ts` | `src/lib/storage/account-preferences.ts` | adaptieren | niedrig | niedrig | Merge-forward und versionierte Defaults als Muster übernehmen. |
| Datenqualitäts-Audits | `scripts/validateCatalog.ts`, `auditRecipePricing.ts`, `auditRecipeNutrition.ts` | `bun run check`, Jest, DB-/Schema-Tests | Prozess | niedrig | niedrig | Rezept-/Produkt-Invarianten in die bestehende Fam-Teststruktur einbauen. |
| Screenshot-/Tour-QA | `mobile/src/components/ScreenshotDriver.tsx`, `scripts/selftest-mobile.ts` | Maestro, `screenshots/`, Test-Suite | Prozess | mittel | niedrig | Reproduzierbare Demo-Daten und Tour-Modus als QA-Idee prüfen. |
| Foto-/Voice-Zutaten-Erkennung | `src/lib/anthropic.ts`, Pantry-Scan-Komponenten | `src/features/inventory/`, AI Gateway | adaptieren | hoch | hoch | Review-Schritt, Offline-Verhalten und RLS-/Account-Konzept zwingend. |
| Rezeptbilder/Attribution | `RecipeImage`, `src/data/recipeImages.ts` | Fam-Rezept-/Produktmedien | selektiv | mittel | mittel | Lizenz, Quelle, Attribution und Verifikationsstatus als Metadaten übernehmen. |

## Empfohlene Reihenfolge

1. Guided Cooking und mobile UI gegen Fam vergleichen.
2. Rezept-Metadaten mit unserem deklarativen Schema abgleichen.
3. Einen kleinen europäischen Rezept-Datensatz als Import-Pilot auswählen.
4. Pantry-Matching mit `computeIngredientNeeds()` und echtem Bestand modellieren.
5. Erst danach entscheiden, ob ui-Daten oder nur ui-UX dauerhaft einfließen.

## Nicht tun

- Waivys Sync-Code übernehmen.
- Waivys `localStorage`-/AsyncStorage-Architektur als Fam-Datenquelle verwenden.
- Waivys US-Preislogik oder USD-Rezeptpreise für Europa verwenden.
- Den gesamten Rezeptkatalog ungeprüft importieren.
- Provider-Keys in Client-Bundles oder synchronisierten Daten speichern.
