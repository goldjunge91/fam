# Einkaufsliste — Mockup v2

Vollständiges Mockup-Set für `src/features/shopping-list/`, im Verlauf-Look
(Violett → Magenta → Gold auf dunklem Grund, dazu Hellmodus über den Umschalter
oben).

- Datei: [`einkaufsliste-mockup.html`](./einkaufsliste-mockup.html)
- Artifact: <https://claude.ai/code/artifact/79c6d2bf-6576-4760-aad1-689fba0f8cba>

## Prinzip

Der Verlauf ist **Chrome und Aktion** (Buttons, aktive Zustände, Ringe,
Trennlinien). Markt- und Kategoriefarben sind **Daten** und werden deshalb
unverändert aus dem Code übernommen:

| Quelle | Beispiele |
|---|---|
| `domain-logik/store-presets.ts` | REWE `#B5623F`, dm `#8B6F72`, Edeka `#748C5B`, Aldi `#5C7396` |
| `classification/placement-taxonomy.ts` | Obst & Gemüse `#748C5B`, Brot & Backwaren `#C6A24A`, Milchprodukte & Eier `#5C7396`, Fleisch & Geflügel `#A6483D`, Öle/Essig/Gewürze `#B57B48` |

Ein durchgehender Datensatz über alle Screens: 17 Artikel, 6 abgehakt,
62,36 € geschätzt, verteilt auf REWE (9), dm (3), Edeka (2) und Ohne Markt (3).

## Abdeckung

| # | Mockup | Quelle im Code |
|---|---|---|
| 1 | Alle Listen | `screens/shopping-list-screen.tsx` (`isAllFilter`), `components/ui/store-summary-card.tsx`, `total-estimate-card.tsx` |
| 2 | Alle Listen, leer | ebd., `EmptyState` „Einkaufsliste ist leer“ |
| 3 | Kein Haushalt | ebd., Guard ohne `householdId` |
| 4 | Marktliste REWE | ebd. (`SectionList`), `components/ui/shopping-item-row.tsx` |
| 5 | Marktliste, leer | ebd., „Keine Artikel ohne Markt“ |
| 6 | Mehrfachauswahl | ebd., `selectionMode` mit „Alle/Keine“ und „Verschieben“ |
| 7 | Markt-Filter-Menü | `components/ui/store-picker-menu.tsx` |
| 8 | Artikel hinzufügen | `modals/add-item-modal.tsx`, `forms/add-item-form.tsx`, `modals/item-modal-shell.tsx` |
| 9 | Vorschläge aufgeklappt | `forms/shopping-product-suggestions.tsx`, `hooks/use-shopping-product-suggestions.ts` |
| 9b | Weitere Angaben | `forms/add-item-form.tsx`, Aufklappbereich mit Einheit, Kategorie, Packungsinhalt, Preis |
| 9c | Quelle & Filter | `src/components/ui/item-source-filter.tsx`, `inline-select.tsx` |
| 10 | Barcode-Scanner | `BarcodeScannerModal` aus dem Hauptscreen |
| 11 | Artikel bearbeiten | `modals/edit-item-modal.tsx`, `forms/edit-item-form.tsx` |
| 12 | Artikel verschieben | `modals/move-items-modal.tsx` |
| 13 | Reihenfolge bearbeiten | `sheets/category-order-sheet.tsx` |
| 14 | Einkaufsmodus | `screens/shopping-mode-screen.tsx` |
| 15 | Einkaufsmodus, eingeklappt | ebd., eingeklappte und abgeschlossene Kategorien |
| 16 | In Vorrat übernehmen | `sheets/complete-run-sheet.tsx`, `hooks/use-complete-shopping-run.ts` |
| 17 | Märkte verwalten | `screens/stores-screen.tsx` |
| 18 | Markt bearbeiten | ebd., Inline-Bearbeitung |
| 19 | Artikel löschen | Hauptscreen, `Alert` bei langem Druck |
| 20 | Markt löschen | `screens/stores-screen.tsx`, `Alert` |

## Korrekturen nach Screenshot-Abgleich

Das Hinzufügen-Modal war im ersten Wurf falsch. Nach dem echten Screenshot
korrigiert:

- Quelle und Vorschlagsfilter sind **zwei Auswahlfelder** (🥕 Lebensmittel,
  🔁 Zuletzt) aus `item-source-filter.tsx`, keine Chip-Reihe.
- Vorschläge sind **waagerechte Karten** zu dritt mit Name, Menge und
  „Zuletzt: Markt“, die gewählte Karte ist gefüllt (`selectable-selected`),
  nicht eine senkrechte Liste mit Plus-Knöpfen.
- Der Aufklappbereich heißt **„Weitere Angaben“**, nicht „Details“, und wird von
  `›` / `▾` geführt.
- Unten steht die **Produkt-Zusammenfassung** (`.product-summary`) mit Marke und
  EAN sowie Menge bzw. Packungsinhalt rechts.
- Das Suchfeld zeigt während der Produktsuche einen Spinner neben dem
  Barcode-Knopf.

## Noch offen

- `components/ui/dashboard-card.tsx` — Widget im Dashboard-Hub, gehört zum
  Übersichts-Mockup.
- `forms/store-picker-field.tsx` mit Inline-„+ Neuer Markt“ — im Hinzufügen-Modal
  bisher nur als Feld dargestellt, nicht im aufgeklappten Zustand.
- `forms/placement-zone-field.tsx` — Kategorie-Auswahl im aufgeklappten Zustand,
  bisher nur geschlossen als Feld.
- Werbe-Testbutton (`adsEnabled`) — Debug-Oberfläche, bewusst ausgelassen.
