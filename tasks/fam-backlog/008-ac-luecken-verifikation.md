# 008: AC-Lücken aus der Verifikation vom 2026-08-11

**Status**: pending
**Created**: 2026-08-11
**Priority**: medium (hoch für #78/#80, siehe Reihenfolge unten)

## Description

Am 2026-08-11 wurden 32 als "fertig" geführte GitHub-Issues einzeln gegen
ihre tatsächlichen Akzeptanzkriterien im Code geprüft (nicht nur gegen
Commit-Messages oder Doku-Stand). 17 waren wirklich fertig und wurden
daraufhin auf GitHub geschlossen. **Die folgenden 15 Issues bleiben offen**,
weil bei jedem ein konkretes, benanntes AC fehlt — kein GitHub-Hygiene-Problem,
sondern eine echte Codelücke. Diese Datei ist als eigenständiger Prompt
gedacht: Jeder Abschnitt hat Befund, betroffene Dateien und Fertig-Kriterium.

Vollständiger Kontext zur Verifikation: `docs/projekt_status.md` (Epic-Tabellen
mit 🟡/🔴-Markierungen), `docs/ROADMAP.md`.

## Reihenfolge

**Zuerst #78, dann #80** — beide sind Fundament für #74/#75/#76, die zwar
selbst auch Lücken haben, aber ohne #78/#80 gar nicht sauber weitergebaut
werden können. Danach #88 (Architekturlücke, kein UI-Kleinkram). Der Rest
(#65, #69, #71, #73, #83, #84, #85, #86, #93) ist unabhängig voneinander und
kann in beliebiger Reihenfolge oder parallel erledigt werden.

## Action Items

### Fundament — Lebensmittel-DB

- [ ] `#78` Einheiten-Umrechnung als reine Funktion — **nicht implementiert
      wie spezifiziert**. `src/lib/units.ts` enthält nur Label-Normalisierung
      (`normalizeUnit()`), keine echte Umrechnungsmathematik. Die tatsächliche
      (unvollständige) Logik ist eine unexportierte Inline-Funktion in
      `src/features/calorie-tracking/add-food-entry-screen.tsx`, die nur
      kg→g und l→ml abdeckt und bei anderen Einheiten stillschweigend
      durchfällt (kein explizites "nicht umrechenbar"-Signal, kein
      Stück↔Gramm mit Portionsgewicht).
      **Fertig, wenn:** `units.ts` exportierte, reine Funktionen für
      g↔kg, ml↔l und Stück↔g (mit Portionsgewicht als Parameter) hat, die bei
      nicht umrechenbaren Kombinationen explizit `null`/ein Ergebnis-Objekt
      mit `convertible: false` zurückgeben statt still durchzufallen; Tests
      nach Vorbild `src/lib/units.test.ts`; `add-food-entry-screen.tsx` nutzt
      diese Funktion statt der eigenen Inline-Kopie.

- [ ] `#80` Produkt manuell anlegen — **nicht implementiert**. Kein Code-Pfad
      im gesamten `src`-Baum fügt eine Zeile in `products` ein (grep nach
      `.from('products')` und `source='manual'` = leer).
      `src/features/inventory/add-item-screen.tsx` legt nur `fridge_items`
      an, keinen wiederverwendbaren Produkt-Datensatz.
      **Fertig, wenn:** ein Formular (Name, Marke optional, Nährwerte pro
      100g, Einheit) einen `products`-Datensatz mit `source='manual'`
      anlegt, der danach über die normale Produktsuche wieder auffindbar ist.

- [ ] `#74` Open-Food-Facts-Client + Mapping — **PARTIAL**. Client
      (`src/lib/open-food-facts.ts`) mit Plausibilitätsprüfungen,
      User-Agent, Timeout/Error-Handling und 17 Tests ist solide. Fehlendes
      AC: "Ergebnis wird in `products` gespeichert" — OFF-Treffer werden nur
      zum Vorbefüllen eines Formularfelds benutzt, nie persistiert.
      **Fertig, wenn:** ein OFF-Treffer (z.B. beim ersten Hinzufügen zum
      Bestand) als `products`-Zeile mit `source='off'` angelegt oder
      aktualisiert wird, damit er danach lokal auffindbar ist (baut auf #78
      für saubere Einheiten auf).

- [ ] `#75` Produktsuche mit Debounce — **PARTIAL**. 300ms-Debounce
      korrekt umgesetzt (`product-search-dropdown.tsx:37-43`). Fehlendes AC:
      lokales SQLite→`products`→OFF-Tiering mit Offline-Fallback — Code ruft
      `searchOpenFoodFacts()` direkt auf, keine lokale Vorstufe, kein
      Offline-Pfad.
      **Fertig, wenn:** die Suche zuerst gegen lokal gesyncte `products`
      matcht und erst bei zu wenig Treffern OFF anfragt; offline liefert sie
      nur lokale Treffer statt eines Fehlers (baut auf #74 auf, damit es
      überhaupt lokale Treffer gibt).

- [ ] `#76` Barcode-Scanner — **PARTIAL**. `barcode-scanner-modal.tsx` mit
      Kamera, Permission-Denied-Fallback und Debounce ist fertig. Fehlendes
      AC: haptisches Feedback beim erfolgreichen Scan — kein
      `expo-haptics`-Import in der Datei.
      **Fertig, wenn:** `Haptics.notificationAsync(...)` (oder
      `impactAsync`) bei erfolgreichem Scan-Treffer ausgelöst wird.

### Architektur — Offline-Tagebuch

- [ ] `#88` Datumsnavigation im Tagebuch — **PARTIAL**. Pfeil-Navigation und
      Zukunfts-Sperre funktionieren. Fehlendes AC: "Vergangene Tage
      funktionieren offline aus dem lokalen Cache" — architektonisch nicht
      erfüllt. `food_entries` läuft bewusst am SQLite-Sync-Engine vorbei
      (siehe Architekturentscheidung in
      `tasks/fam-backlog/001-welle-6-kalorien-tagebuch.md`), und es gibt kein
      `persistQueryClient`/`AsyncStoragePersister` im Repo — der React-Query-
      Cache ist rein in-memory und geht beim Neustart offline verloren.
      **Fertig, wenn:** entweder React-Query-Cache persistiert wird (z.B.
      `@tanstack/query-async-storage-persister`) oder ein alternativer
      Offline-Lesepfad für bereits geladene Tage existiert, der einen
      Neustart übersteht. Architekturentscheidung dokumentieren, falls sie
      von der ursprünglichen "streng privat, kein SQLite-Sync"-Prämisse
      abweicht.

### Kinder-Profile-Integration

- [ ] `#65` Kinder-Profile anlegen — **PARTIAL**. CRUD
      (`child-profiles-screen.tsx` + Mutations) vollständig. Fehlendes AC:
      beim Loggen einer Mahlzeit ist kein Kinder-Profil als Ziel wählbar —
      kein `child`-Bezug irgendwo in `calorie-tracking/`.
      **Fertig, wenn:** `add-food-entry-screen.tsx` eine Profil-Auswahl
      (aktiver Erwachsener oder Kind) anbietet und `food_entries` entsprechend
      mit dem passenden `child_profile_id` schreibt (hängt mit #85 zusammen —
      am besten zusammen umsetzen).

- [ ] `#85` Tagebuch-Screen nach Mahlzeiten — **PARTIAL**. Mahlzeiten-
      Gruppierung funktioniert. Fehlendes AC: Kinder-Profil-Kontext.
      `child_profile_id` existiert bereits im Schema
      (`supabase/schemas/09_tracking.sql`), wird aber in `api.ts` und
      `diary-screen.tsx` nirgends referenziert — das Tagebuch zeigt immer nur
      Einträge des eingeloggten Erwachsenen.
      **Fertig, wenn:** das Tagebuch nach aktivem Profil filtert/umschalten
      kann (Erwachsener oder eines der Kinder-Profile des Haushalts).

### Ziel- und Makro-Feinschliff

- [ ] `#83` Makro-Verteilung mit Presets — **PARTIAL**. Drei Presets in
      `src/features/calorie-tracking/macros.ts` vorhanden, aber
      `low_carb` ist im Code 30/20/50, während das Issue 40/20/40
      spezifiziert — Diskrepanz klären (Issue-Text vs. ernährungswissen-
      schaftliche Praxis) und angleichen. Zusätzlich fehlendes AC: freies
      Anpassen der Makro-Prozente fehlt komplett, nur die drei Presets sind
      wählbar.
      **Fertig, wenn:** Preset-Wert korrigiert (oder Abweichung bewusst
      dokumentiert) UND eine UI zum manuellen Anpassen der drei Prozentwerte
      vor dem Speichern existiert (mit Summen-Validierung = 100%).

- [ ] `#84` Ziel-Setup-Screen — **PARTIAL**. Live-Vorschau (BMR→TDEE→
      Zielkalorien→Makros) und Kappungs-Erklärung funktionieren. Fehlendes
      AC: manuelles Überschreiben des berechneten Ziels ist nicht möglich,
      nur der berechnete Wert lässt sich speichern.
      **Fertig, wenn:** `goal-setup-screen.tsx` ein editierbares Feld für die
      Zielkalorien (und optional Makros) anbietet, das den berechneten Wert
      vorbefüllt aber überschreibbar macht — die Sicherheitskappung (Ziel nie
      unter Grundumsatz) muss dabei weiterhin greifen.

- [ ] `#86` Eintrag hinzufügen, bearbeiten, löschen — **PARTIAL**. Soft-
      Delete (`deleted_at`) funktioniert. Fehlendes AC: "Löschen mit Undo"
      ist tatsächlich ein Confirm-Dialog *vor* dem Löschen, kein Undo danach.
      **Fertig, wenn:** Löschen sofort ausführt und eine Snackbar/Toast mit
      "Rückgängig"-Aktion für ein paar Sekunden zeigt (Konsistenz mit #69,
      das dieselbe Lücke im Kühlschrank hat — gleiches Muster verwenden).

### Kühlschrank-Politur

- [ ] `#69` Artikel bearbeiten, verbrauchen, entfernen — **PARTIAL**. Menge
      ±, Soft-Delete funktionieren (`use-fridge-mutations.ts`). Fehlendes
      AC: kein Undo direkt nach dem Entfernen (`grep -rn Undo
      src/features/fridge` = leer).
      **Fertig, wenn:** Entfernen sofort ausführt und eine Snackbar mit
      "Rückgängig" zeigt — gleiches Muster wie bei #86.

- [ ] `#71` Ablauf-Ampel und Sortierung nach MHD — **PARTIAL**. Die reine
      Ampel-Funktion (`expiry.ts`, deterministisch, gut getestet) und die
      Gruppierung nach Lagerort sind fertig. Fehlendes AC: kein
      Sortier-Toggle nach MHD — Artikel sind aktuell nur gruppiert, nicht
      nach Ablaufdatum sortierbar.
      **Fertig, wenn:** `fridge-screen.tsx` einen Sortier-Control anbietet,
      der (innerhalb der Gruppen oder global) nach MHD sortiert.

- [ ] `#73` Dashboard-Widget 'läuft bald ab' — **PARTIAL**. Zeigt die
      nächsten ablaufenden Artikel sortiert an. Zwei fehlende ACs: (1) die
      Karte bleibt bei 0 ablaufenden Artikeln sichtbar (zeigt einen
      `EmptyState` statt sich auszublenden); (2) kein Tap-Through zur
      gefilterten Bestandsliste — es gibt nur `handleConsume`/
      `handleAddToShoppingList`-Aktionen, keine Navigation.
      **Fertig, wenn:** die Karte bei 0 Artikeln komplett ausgeblendet wird
      UND ein Tap auf die Karte zur Bestandsliste navigiert, gefiltert auf
      ablaufende Artikel.

### Dashboard-Politur

- [ ] `#93` Dashboard-Tagesübersicht — **PARTIAL**. Ring + Makros +
      Ablauf-Widget sind auf einer Seite vereint, `EmptyState` und
      Loading-Handling vorhanden. Fehlendes AC: Pull-to-Refresh — kein
      `RefreshControl` im gesamten Repo (`grep -rl RefreshControl src` =
      leer).
      **Fertig, wenn:** die Dashboard-Scroll-Ansicht einen `RefreshControl`
      hat, der einen Sync anstößt (`useSyncEngine`-Trigger, analog zum
      bestehenden Pull-Mechanismus aus der Sync-Engine).

## Notes

Jeder Befund oben stammt aus direkter Code-/Grep-Verifikation am
2026-08-11, nicht aus der (zu diesem Zeitpunkt bereits als unzuverlässig
erkannten) Projekt-Doku. Beim Abarbeiten jedes Punktes: Issue nach Fix mit
kurzem Beleg-Kommentar auf GitHub schließen (Stil siehe die 17 bereits
geschlossenen Issues aus dieser Verifikationsrunde), Doku-Tabellen in
`docs/projekt_status.md` und `docs/ROADMAP.md` von 🟡/🔴 auf ✅ aktualisieren.
