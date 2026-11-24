# Abschnitt 03 Review-Nachweis

Die Assistant-Prüfung bestätigt den vorhandenen Stand. Der Befund zum Sprachwechsel ist im aktuellen Quelltext behoben.

## Prüfgegenstand

- Worktree: `/Volumes/Programme/github/family_app/fam/.worktrees/i18n-complete`
- Branch: `i18n-complete`
- Geprüfter Code-HEAD: `01c167fec8ee59a624d6b128e8b073a2514d12f8`
- `/Volumes/Programme/github/fam` wurde nicht gelesen oder geändert.
- Der vorhandene Zwischenstand späterer Abschnitte blieb unangetastet.
- Der vorhandene Gate-Befund aus einem anderen Pfad wurde nicht als Nachweis verwendet.

## Review-Befund S3-006

Der Befund betraf den Dev-Sprachwechsel im Assistant. Der Thread-Ladevorgang durfte bei einer neuen `t`-Referenz nicht erneut laufen.

Die Prüfung bestätigt diese Reparatur:

- `assistant-screen.tsx` hält `t` in `tRef` aktuell.
- Der Effekt zum Laden gespeicherter Threads hängt nur von `userId` ab.
- Der Ladefehler nutzt weiterhin die Sprache des aktuellen Renderings.
- Der Regressionstest wählt einen älteren Thread und rendert danach mit einer neuen Sprache.
- Der ältere Thread bleibt aktiv.

Der Befund ist damit geschlossen. Es war in diesem Pass keine zusätzliche Produktionsänderung nötig.

## Parität und Migration

- `ai-assistant.de.json` und `ai-assistant.en.json` enthalten jeweils 170 Blatt-Schlüssel.
- Die Blatt-Schlüssel und Platzhalter der beiden Assistant-Dateien sind gleich.
- Die statischen Assistant-Referenzen verwenden `aiAssistant.*`.
- Der Scanner findet 186 statische Assistant-Referenzen und 0 fehlende Schlüssel.
- Der Scanner findet 0 dynamische Assistant-Referenzen und 0 untestbare Assistant-Referenzen.
- Der Scanner findet 0 reportbare Assistant-Hardcodes.
- Antworten, Namen, Begründungen, Anhänge und unbekannte externe Fehlermeldungen bleiben Laufzeitdaten.
- `src/i18n/index.ts` unterstützt nur `de` und `en`.
- Deutsch bleibt der Laufzeit-Fallback.
- Der Sprach-Override bleibt in den Dev-Einstellungen.
- Eine Sprachauswahl in normalen Produktionseinstellungen wurde nicht ergänzt.
- Incoming Share blieb außerhalb des Umfangs.

## Fokussierte Nachweise

```text
bun run test -- --runInBand --no-watchman src/features/ai-assistant/screens/assistant-screen.test.tsx src/features/ai-assistant/data src/features/ai-assistant/types.test.ts
```

Ergebnis: 9 Suiten und 140 Tests grün. Der alte Wert von 136 Tests wurde nicht übernommen.

```text
bunx biome check src/features/ai-assistant/screens/assistant-screen.tsx src/features/ai-assistant/screens/assistant-screen.test.tsx
```

Ergebnis: 2 Dateien geprüft, Biome grün.

```text
bun run typecheck
```

Ergebnis: grün.

```text
bun run test -- --runInBand --no-watchman test/conventions/i18n-convention.test.ts
```

Ergebnis: 14 von 18 Tests grün. Die vier roten Prüfungen betreffen spätere Slices.
Der Assistant erzeugt keinen eigenen Paritäts-, Schlüssel-, dynamischen oder Hardcode-Befund.

## Projektweiter Biome-Befund

```text
bun run check
```

Ergebnis: 57 Fehler und 5 Warnungen bei 1591 geprüften Dateien. Keine Diagnose betrifft den Assistant.
Die Befunde liegen in späteren, uncommitted Slices. Diese Dateien wurden nicht geändert.

Betroffene Pfade:

- `src/features/calorie-tracking/add-food-entry-screen.tsx`
- `src/features/calorie-tracking/food-search-dropdown.tsx`
- `src/features/calorie-tracking/food-search-screen.tsx`
- `src/features/calorie-tracking/hooks/use-food-entry-form.ts`
- `src/features/calorie-tracking/weight-tracking-screen.tsx`
- `src/features/inventory/add-item-screen.tsx`
- `src/features/inventory/add-product-screen.tsx`
- `src/features/inventory/barcode-scanner-modal.tsx`
- `src/features/inventory/components/inventory-history-sheet.tsx`
- `src/features/inventory/components/inventory-item-actions-sheet.tsx`
- `src/features/inventory/components/inventory-item-row.ios.tsx`
- `src/features/inventory/components/inventory-item-row.tsx`
- `src/features/inventory/inventory-search-field.tsx`
- `src/features/inventory/product-search-dropdown.tsx`
- `src/features/inventory/storage-locations-screen.tsx`
- `src/features/inventory/use-inventory-transactions.ts`
- `src/features/meal-planner/components/entry-form-modal.tsx`
- `src/features/meal-planner/week.ts`
- `src/features/profile/components/biometrics-summary.android.tsx`
- `src/features/profile/components/biometrics-summary.tsx`
- `src/features/profile/domain/biometrics.android.ts`
- `src/features/profile/domain/biometrics.ts`
- `src/features/profile/sheets/food-rule-selection-sheet.android.tsx`
- `src/features/profile/sheets/food-rule-selection-sheet.tsx`
- `src/features/settings/dev/analytics-controls.ts`
- `src/features/settings/dev/design-system/showcase-foundations.tsx`
- `src/features/settings/dev/design-system/showcase-patterns.tsx`
- `src/features/settings/dev/design-system/showcase-reanimated.tsx`
- `src/features/settings/dev/dev-data-screen.tsx`
- `src/features/settings/dev/dev-environment-screen.tsx`
- `src/features/settings/dev/dev-lifecycle-screen.tsx`
- `src/features/settings/dev/dev-overrides-screen.tsx`
- `src/features/settings/dev/dev-telemetry-screen.tsx`
- `src/features/settings/dev/dev-tools-screen.tsx`
- `src/features/settings/dev/drax-demo-screen.android.tsx`
- `src/features/settings/dev/drax-demo-screen.tsx`
- `src/features/settings/dev/executorch-speech-to-text-screen.tsx`
- `src/features/settings/dev/feature-flag-controls.tsx`
- `src/features/settings/dev/ocr/ocr-inspector-manual-labels.tsx`
- `src/features/settings/dev/ocr/ocr-inspector-screen.tsx`
- `src/features/settings/dev/tracking-method-controls.tsx`
- `src/features/shopping-list/forms/add-item-form.tsx`
- `src/i18n/features/premium.de.json`
- `src/i18n/features/premium.en.json`
- `src/i18n/features/profile.de.json`
- `src/i18n/features/profile.en.json`

Die projektweite Prüfung bleibt wegen dieser späteren Dateien rot. Der Abschnitt lässt diesen späteren Befund sichtbar.

## Vier Messzahlen

Die Zahlen stammen aus `test/conventions/i18n-convention-support.ts` im aktuellen gemischten Worktree.

| Messgröße | Ergebnis |
| --- | ---: |
| de/en-Dateien und Blatt-Schlüssel | 23 Paare, de 3453 / en 3457, 6 Paritätsfehler |
| Statische Produktionsreferenzen | 2941 Referenzen, 58 fehlende Schlüssel |
| Dynamische Produktionsreferenzen | 91 Referenzen, 89 prüfbar / 2 untestbar, 48 fehlende Schlüssel |
| Reportbare UI-Hardcodes | 651 Funde in 52 Dateien |

Die offenen Gesamtbefunde liegen außerhalb dieses Assistant-Abschnitts.

## Produktprüfung

Der festgelegte Produktpass wurde ausgeführt:

```text
I'm going over the product once more before the final check run, looking for anything a strict evaluator would catch.
```

Dabei wurde kein weiterer Assistant- oder Sprachwechsel-Befund gefunden.

## Einschränkungen

- Keine vollständige unscoped `bun run test`-Suite.
- Keine Allowlist, keine Scanner-Unterdrückung, keine abgeschwächten Assertions und keine Skips.
- Kein Build, kein Deployment und kein Push.
- Keine Änderung an fremden Slices.
