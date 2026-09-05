# Spec: `verification-matrix`

## Status

Abgeschlossen und historisch. Diese Matrix dokumentiert die damalige
Migrationsabnahme. Sie ist keine aktuelle Freigabe für neue Tests, Builds oder
Geräteprüfungen.

## Historisches Ziel

Die Styling-Reparatur wurde nicht nur durch einen erfolgreichen Typecheck
bewertet. Die Matrix prüfte Tokenauflösung, Komponentenverträge,
NativeWind-Grenzen und sichtbares Verhalten innerhalb des damaligen Scopes.

## Historisch ausgeführte automatisierte Prüfungen

| Ebene | Prüfung | Kommando / Methode | Erfolg |
|---|---|---|---|
| Format/Lint | Biome und Projektchecks | `bun run check` | keine neuen Fehler |
| CSS-Syntax | Tailwind-Eingang | `bun run check:css` | CSS kompiliert |
| Types | Provider, Tokens, UI-Props | `bun run typecheck` | kein neuer TypeScript-Fehler; unvermeidbare bestehende Ausnahmen dokumentiert |
| Token | Light/Dark-Schlüssel und Mapping | gezielter Jest-Test | Parität und Fam-Werte |
| Components | Button/Card/Field/Surface-Zustände und aktive Drawer-Route | gezielte RNTL-Tests | Props, Zustände und aktuelle Bereichsmarkierung korrekt |
| Migration | alte Imports und falsche Pfade | `rg`-Audit | null Treffer |
| Boundaries | `className` auf Spezialkomponenten | `rg`-Audit plus Ausnahmenliste | jede Ausnahme dokumentiert |

## Historische Referenzfälle

Die folgenden Fälle wurden über die vorgesehenen fokussierten Prüfungen und
statischen Referenzen beurteilt. Eine Geräteabnahme war ausdrücklich nicht Teil
des Scopes:

1. Light Mode: Screen-Hintergrund, Surface, Card, Primary Button.
2. Dark Mode: dieselben Elemente, kein weißer oder schwarzer Fremd-Fallback.
3. Button: primary, secondary, ghost, danger, accent.
4. Button: pressed, disabled, loading, icon, full width.
5. Text: display, title, heading, subheading, body, label, caption.
6. Text: primary, secondary, accent, danger, onAccent.
7. Field: Label, Placeholder, Eingabetext, Fokus und Fehlerdarstellung.
8. Komponenten mit `expo-image`, FlashList, Bottom Sheet und SVG-Icon.
9. Haptics aktiviert und deaktiviert.
10. Zwei statische Screen-Mocks für Dashboard und Essensplaner als gemeinsame visuelle Entscheidungsgrundlage.

## Regression-Fokus

- Kein Button verliert seinen Hintergrund, weil eine Tailwind-Klasse nicht registriert ist.
- Kein Text fällt auf eine falsche Größe zurück, weil ein Rollenname fehlt.
- Kein `ThemedView` ignoriert weiterhin eine Farbprop.
- Kein StyleSheet hält veraltete Light-/Dark-Farben fest, nachdem der Theme-Modus gewechselt wurde.
- Kein Press-Handler löst bei `disabled` oder `loading` die Aktion oder Haptics aus.
- Der geöffnete Drawer markiert genau den aktuellen Bereich, auch auf Unterseiten und unter `/(app)`-Route-Gruppen.

## Historische Abnahmebedingungen

Die Initiative galt als abgeschlossen, nachdem:

- die automatisierten Prüfungen der betroffenen Module grün waren,
- die statischen Audits keine alten Imports oder ungültigen Spezialfälle
  offenließen,
- die zwei Screen-Mocks geprüft und die damaligen visuellen Entscheidungen
  dokumentiert waren,
- keine Geräteprüfung als erledigt behauptet wurde, da sie außerhalb des Scopes
  lag,
- verbleibende Web-Abweichungen dokumentiert und nicht mit einer zweiten
  Styling-Lösung verdeckt wurden.

## Historischer Migrationsaudit

### Statischer Stand zum Abschluss

Stand 2026-09-04 sind die für diese Initiative relevanten statischen Audits
aktualisiert:

- Keine Production-Importe von `ThemedText`, `ThemedView`, `themed-text` oder
  `themed-view` verbleiben. Die Übergangstests wurden auf die neuen Primitive
  migriert.
- Keine `lightColor`-/`darkColor`-Props werden im Production-Code verwendet.
- Keine geprüfte `expo-image`, `ActivityIndicator`, FlashList, Bottom-Sheet-,
  SVG- oder SymbolView-Nutzung übergibt ein unwirksames `className`.
- Die frühere Suche nach `bg-card`, `bg-surface`, `text-small` und ähnlichen
  nicht registrierten semantischen Utilities liefert keine solchen Utilities.
  `bg-text-secondary` im Inventar-Tab war eine registrierte historische
  Migrationsexzeption für zwei SVG-nahe Linien und ist kein Vorbild für neue
  semantische NativeWind-Klassen.
- Die alten Wrapper-Dateien wurden nach ausdrücklicher Maintainer-Freigabe
  entfernt.

Im Ausgangsaudit vor der Feature-Migration (Stand 2026-09-04) wurden die
vorhandenen Aufrufer per `rg` inventarisiert. Die folgenden Zahlen dokumentieren
den Ausgangszustand und sind keine aktuellen Resttreffer:

- 180 Dateien verwenden `ThemedText`.
- 22 Dateien verwenden `ThemedView`.
- 7 Dateien verwenden `className` direkt auf `Image` oder `ActivityIndicator`.
- Für `FlashList`, `BottomSheet`, `Svg` und `SymbolView` gibt es im aktuellen
  Trefferlauf keine direkte `className`-Verwendung.

Die Migration wurde nach dem Foundation-Checkpoint in kleinen, rückrollbaren
Batches durchgeführt. Gemeinsame Dateien und ihre `.android.tsx`-Paare wurden
zusammen behandelt:

| Batch | Bereich | `ThemedText`-Dateien mit Treffer | Vorgehen |
|---|---|---:|---|
| 0 | `src/components`, `src/app` | 30 | `Txt`/`Surface`-Adapter und Basiskomponenten zuerst stabilisieren |
| 1 | Auth, Feedback, Experimentalscreens | 14 | einfache Text- und Containerrollen migrieren |
| 2 | Dashboard, Inventory, Navigation | 24 | Card-/Row-Fälle mit Android-Paaren prüfen |
| 3 | Household, Shopping List | 29 | Formulare, Sheets und Listenrollen einzeln umstellen |
| 4 | Calorie Tracking, Meal Planner, Recipes | 38 | komplexe Modals und Spezialkomponenten nachziehen |
| 5 | Profile, Settings, Premium, GLP-1 | 45 | verbleibende semantische Rollen und Statusfarben migrieren |

Historische NativeWind-Boundary-Kandidaten des Ausgangsaudits:

- `src/features/calorie-tracking/add-food-entry-screen.tsx`
- `src/features/calorie-tracking/food-search-dropdown.tsx`
- `src/features/inventory/product-search-dropdown.tsx`
- `src/features/meal-planner/missing-ingredients-screen.tsx`
- `src/features/meal-planner/missing-ingredients-screen.android.tsx`
- `src/features/recipes/components/recipe-shopping-sheet.tsx`

Diese Liste ist ein historisches Audit-Ergebnis. Die beiden alten Wrapper wurden
nach der ausdrücklichen Maintainer-Freigabe entfernt.
