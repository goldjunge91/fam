# Rezepte — Mockup v2

Vollständiges Mockup-Set für `src/features/recipes/`, im Verlauf-Look
(Violett → Magenta → Gold auf dunklem Grund, dazu Hellmodus über den Umschalter
oben). Akzentfarbe für Rezepte: **Basil** (`#705773` hell / `#B79CBA` dunkel).

- Datei: [`rezepte-mockup.html`](./rezepte-mockup.html)

## Prinzip

Der Verlauf ist **Chrome und Aktion** (Buttons, aktive Zustände, Ringe,
Fortschrittsbalken). Rezeptkarten verwenden die **5 SVG-Fallback-Paletten** aus
`recipe-preview-card.tsx` als Artwork-Hintergründe:

| Palette | Farben | Zuordnung |
|---|---|---|
| p1 | `#7A927C` → `#D2C89B` | Olive / Sage (Ofengemüse) |
| p2 | `#B77857` → `#EFD2A7` | Terracotta / Sand (Rührei) |
| p3 | `#977593` → `#E3C5BD` | Mauve / Rose |
| p4 | `#7E718F` → `#C8B9D8` | Lavender / Lilac (Thai-Curry) |
| p5 | `#89966E` → `#D6C99A` | Moss / Butter (Bananenbrot) |
| hero | `#D3A06F` → `#8A696C` → `#574458` | Hero-Artwork (Detail) |

## Durchgehender Datensatz

- **Hauptrezept:** „Ofengemüse mit Feta" — 35 Min, Mittel, 4 Portionen, 420 kcal
  - Gruppen: Gemüse (Zucchini 400g, Paprika 300g, Süßkartoffel 500g, Cherrytomaten 250g) + Topping (Feta 200g, Olivenöl 3 EL, Oregano 1 TL)
  - 4 Schritte mit @-Erwähnungen, 25-Min-Timer in Schritt 3
  - Tags: Vegetarisch, Glutenfrei · Typ: Abendessen
  - Bewertung: 8/10, Notiz: „Feta am Ende dazu, sonst verbrennt er."
- **Weitere:** Rührei mit Gouda, Thai-Curry, Bananenbrot, Griechischer Salat
- **Katalog:** Pasta Aglio e Olio (Community)
- **Favoriten:** Ofengemüse + Bananenbrot

## Abdeckung

| # | Mockup | Quelle im Code |
|---|---|---|
| 1 | Entdecken | `screens/recipes-screen.tsx` (view `discover`), `components/category-carousel.tsx`, `components/calorie-carousel.tsx` |
| 2 | Eigene Rezepte | ebd. (view `household`), `components/recipe-preview-card.tsx` |
| 3 | Meine Favoriten | ebd. (view `favorites`), `domain/recipe-favorites.ts` |
| 4 | Eigene Rezepte, leer | ebd., `EmptyPanel` |
| 5 | Kein Haushalt | ebd., Guard ohne `householdId` |
| 6 | Suche aktiv | ebd., Suchfeld aufgeklappt mit Live-Filter |
| 7 | Filter-Modal | `components/recipe-filter-modal.tsx` |
| 8 | Rezeptdetail — Details | `screens/recipe-detail-screen.tsx`, Tab 1 |
| 9 | Rezeptdetail — Bewertungen | ebd., Tab 2, `domain/recipe-ratings.ts` |
| 10 | Rezeptdetail — Aktionen | ebd., Manage-Overlay |
| 11 | Wizard — Basics | `wizard/recipe-wizard-step-basics.tsx` (mode `details`) |
| 12 | Wizard — Zutaten | ebd. (mode `ingredients`), `hooks/use-recipe-components.ts` |
| 13 | Wizard — Schritte | `wizard/recipe-wizard-step-steps.tsx`, `components/step-mention-text.tsx` |
| 14 | Wizard — Vorschau | `wizard/recipe-wizard-step-preview.tsx` |
| 15 | Kochmodus — Schritt | `screens/cooking-mode-screen.tsx`, `components/cooking-mode/cooking-mode-step.tsx` |
| 16 | Kochmodus — Timer | ebd., `components/cooking-mode/cooking-mode-timer.tsx`, `hooks/use-cooking-timer.ts` |
| 17 | Kochmodus — Abgeschlossen | ebd., `components/cooking-mode/cooking-mode-finished.tsx` |
| 18 | Bewertung-Sheet | `components/recipe-rating-sheet.tsx` |
| 19 | Einkaufs-Sheet | `components/recipe-shopping-sheet.tsx` |
| 20 | Rezept löschen | Detail-Screen, `Alert` bei Lösch-Aktion |
| 21 | Katalog-Detail | `catalog/recipe-catalog-detail-screen.tsx` |
| 22 | Ins Tagebuch eintragen | `screens/recipe-log-screen.tsx` (Log-Mode) |
| 23 | Zubereitete Gewichte | ebd. (Weigh-Mode) |
| 24 | Kochmodus — Ohne Schritte | `components/cooking-mode/cooking-mode-no-steps.tsx` |

## Noch offen

- `components/cooking-mode/free-cooking-mode.tsx` — Free-Tier-Fallback mit Paywall, bewusst ausgelassen (ist kein primärer UX-Flow).
- `ProductSearchDropdown` im Wizard — Aufgeklappter Zustand der Produktsuche mit Live-Ergebnissen, bisher nur als geschlossenes Feld dargestellt.
- `IngredientLedger` im Wizard Schritt 3 — Einklappbare Verbrauchsübersicht, welche Zutaten bereits in Schritten verwendet wurden.
