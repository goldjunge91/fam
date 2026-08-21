# Shopping-List — Dateien nach Verantwortungsschicht

Kurzreferenz für dieses Feature, gegliedert nach Verantwortungsschicht statt nach
Ordner — macht bei einer Änderung sofort klar, was mitgezogen werden muss (z. B.
Kategorie-Farbe ändern → nur `domain-logik/`, keine Hooks betroffen).

```
screens/ → sheets/ → forms/ → components/ui/ → hooks/ → domain-logik/
```

Jede Datei hat eine `*.test.ts(x)`-Schwesterdatei (1:1 gespiegelt) — nicht extra
gelistet.

## `screens/` (eigene Route/Vollbild)

| Datei | Zweck |
|---|---|
| `shopping-list-screen.tsx` | Hauptscreen. "Alle Listen"-Übersicht (Markt-Karten) + marktgefilterte Checkliste, steuert alle Modals/Sheets dieses Features. |
| `shopping-mode-screen.tsx` | Vollbild-Einkaufsmodus für den Laden — nur Abhaken, aufklappbare farbcodierte Kategorien, kein Bearbeiten. |
| `stores-screen.tsx` | Märkte verwalten (anlegen, umbenennen, Farbe, löschen) — eigene Route außerhalb der Einkaufsliste selbst. |

## `sheets/` & `modals/` (Overlays, von `shopping-list-screen.tsx` aus geöffnet)

| Datei | Zweck |
|---|---|
| `sheets/complete-run-sheet.tsx` | "In Vorrat übernehmen" — Lagerort, MHD, Menge pro Artikel beim Einkaufsabschluss. |
| `sheets/category-order-sheet.tsx` | Drag&Drop-Sortierung der Kategorie-Laufstrecke pro Markt. |
| `modals/add-item-modal.tsx` | Wrapper um `add-item-form.tsx` in der gemeinsamen Modal-Hülle. |
| `modals/edit-item-modal.tsx` | Wrapper um `forms/edit-item-form.tsx` in der gemeinsamen Modal-Hülle. |
| `modals/item-modal-shell.tsx` | Geteiltes Modal-Gerüst (Header, Scroll, Tastatur-Handling) für Add/Edit. |

## `forms/` (Formulare & Eingabe-Bausteine)

| Datei | Zweck |
|---|---|
| `add-item-form.tsx` | Artikel hinzufügen — Name, Menge, Markt, Barcode-Scan, Produktsuche. |
| `edit-item-form.tsx` | Bestehenden Artikel bearbeiten (gleiche Feldbasis wie Add). |
| `store-picker-field.tsx` | Markt-Auswahl-Chips + Inline-"+ Neuer Markt", geteilt zwischen Add/Edit. |
| `shopping-product-suggestions.tsx` | Aufklappbare Vorschlagsliste (zuletzt/häufig gekauft) beim Hinzufügen. |

## `components/ui/` (reines Rendering)

| Datei | Zweck |
|---|---|
| `shopping-item-row.tsx` | Eine Artikelzeile in der Marktliste — Checkbox, Produkt/Menge/Preis als drei Spalten, Bearbeiten-Icon. |
| `store-summary-card.tsx` | Markt-Karte in der "Alle Listen"-Übersicht (Fortschritt, Preis). |
| `total-estimate-card.tsx` | Gesamtsumme-Kachel unter den Markt-Karten. |
| `store-picker-menu.tsx` | Glas-Pillenbutton im Header, filtert zwischen Märkten. |
| `dashboard-card.tsx` | Widget für den App-Dashboard-Hub, registriert sich über `@/features/dashboard/registry`. |

## `hooks/` (React Query + SQLite)

| Datei | Zweck |
|---|---|
| `use-shopping-list.ts` | Liest Artikel aus SQLite, gruppiert nach Kategorie/Laufstrecke. |
| `use-shopping-list-mutations.ts` | Hinzufügen/Abhaken/Löschen von Artikeln (Outbox-Sync). |
| `use-complete-shopping-run.ts` | Transaktion: abgehakte Artikel → `fridge_items` + `shopping_history`, dann Soft-Delete. |
| `use-stores.ts` | Märkte lesen/anlegen/ändern/löschen, inkl. `category_order`-Persistenz. |
| `use-shopping-product-suggestions.ts` | Zuletzt/häufig gekaufte Produkte für die Vorschlagsliste. |

## `domain-logik/` (Domänen-Logik & Konfiguration, keine React-Komponenten)

| Datei | Zweck |
|---|---|
| `shopping-categories.ts` | Die 12 Kategorien: Sortierrang (Laufstrecke), Farbe, Lagerort-Default, Keyword-Erkennung (`guessCategory`). |
| `store-presets.ts` | Namens-Presets (REWE, Aldi, …) + Farbpalette für neue Märkte. |
