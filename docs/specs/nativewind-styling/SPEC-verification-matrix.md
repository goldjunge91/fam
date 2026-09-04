# Spec: `verification-matrix`

## Ziel

Die Styling-Reparatur wird nicht nur durch einen erfolgreichen Typecheck bewertet. Die Matrix prüft Tokenauflösung, Component-Verträge, NativeWind-Grenzen und sichtbares Verhalten.

## Automatisierte Prüfungen

| Ebene | Prüfung | Kommando / Methode | Erfolg |
|---|---|---|---|
| Format/Lint | Biome und Projektchecks | `bun run check` | keine neuen Fehler |
| CSS-Syntax | Tailwind-Eingang | `bun run check:css` | CSS kompiliert |
| Types | Provider, Tokens, UI-Props | `bun run typecheck` | kein neuer TypeScript-Fehler; unvermeidbare bestehende Ausnahmen dokumentiert |
| Token | Light/Dark-Schlüssel und Mapping | gezielter Jest-Test | Parität und Fam-Werte |
| Components | Button/Card/Field/Surface-Zustände | gezielte RNTL-Tests | Props und Zustände korrekt |
| Migration | alte Imports und falsche Pfade | `rg`-Audit | null Treffer |
| Boundaries | `className` auf Spezialkomponenten | `rg`-Audit plus Ausnahmenliste | jede Ausnahme dokumentiert |

## Manuelle Referenzfälle

Für jede Plattform werden dieselben Fälle geprüft:

1. Light Mode: Screen-Hintergrund, Surface, Card, Primary Button.
2. Dark Mode: dieselben Elemente, kein weißer oder schwarzer Fremd-Fallback.
3. Button: primary, secondary, ghost, danger, accent.
4. Button: pressed, disabled, loading, icon, full width.
5. Text: display, title, headingSmall, body, bodySmall, label, caption, link.
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

## Abnahme

Die Initiative gilt erst als abgeschlossen, wenn:

- automatisierte Prüfungen der betroffenen Module grün sind,
- die statischen Audits keine alten Imports oder ungültigen Spezialfälle offenlassen,
- die zwei Screen-Mocks geprüft und die offenen visuellen Entscheidungen daraus dokumentiert wurden,
- keine Geräteprüfung als erledigt behauptet wird, da sie außerhalb des Scopes liegt,
- verbleibende Web-Abweichungen dokumentiert und nicht mit einer zweiten Styling-Lösung verdeckt werden.

## Migrationsaudit für die nächsten Slices

### Aktueller statischer Stand

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
  `bg-text-secondary` im Inventar-Tab ist ein registrierter Farbtoken für die
  beiden SVG-nahe Linien und daher keine ungültige Utility.
- Die alten Wrapper-Dateien wurden nach ausdrücklicher Maintainer-Freigabe
  entfernt.

Ausgangsaudit vor der Feature-Migration (Stand 2026-09-04) wurden die
vorhandenen Aufrufer per `rg` inventarisiert. Die folgenden Zahlen dokumentieren
den Ausgangszustand und sind keine aktuellen Resttreffer:

- 180 Dateien verwenden `ThemedText`.
- 22 Dateien verwenden `ThemedView`.
- 7 Dateien verwenden `className` direkt auf `Image` oder `ActivityIndicator`.
- Für `FlashList`, `BottomSheet`, `Svg` und `SymbolView` gibt es im aktuellen
  Trefferlauf keine direkte `className`-Verwendung.

Die Migration wird nach dem Foundation-Checkpoint in kleinen, rückrollbaren
Batches durchgeführt. Gemeinsame Dateien und ihre `.android.tsx`-Paare werden
immer zusammen behandelt:

| Batch | Bereich | `ThemedText`-Dateien mit Treffer | Vorgehen |
|---|---|---:|---|
| 0 | `src/components`, `src/app` | 30 | `Txt`/`Surface`-Adapter und Basiskomponenten zuerst stabilisieren |
| 1 | Auth, Feedback, Experimentalscreens | 14 | einfache Text- und Containerrollen migrieren |
| 2 | Dashboard, Inventory, Navigation | 24 | Card-/Row-Fälle mit Android-Paaren prüfen |
| 3 | Household, Shopping List | 29 | Formulare, Sheets und Listenrollen einzeln umstellen |
| 4 | Calorie Tracking, Meal Planner, Recipes | 38 | komplexe Modals und Spezialkomponenten nachziehen |
| 5 | Profile, Settings, Premium, GLP-1 | 45 | verbleibende semantische Rollen und Statusfarben migrieren |

Bekannte NativeWind-Boundary-Kandidaten für einen separaten kleinen Slice:

- `src/features/calorie-tracking/add-food-entry-screen.tsx`
- `src/features/calorie-tracking/food-search-dropdown.tsx`
- `src/features/inventory/product-search-dropdown.tsx`
- `src/features/meal-planner/missing-ingredients-screen.tsx`
- `src/features/meal-planner/missing-ingredients-screen.android.tsx`
- `src/features/recipes/components/recipe-shopping-sheet.tsx`

Diese Liste ist ein historisches Audit-Ergebnis. Die beiden alten Wrapper wurden
nach der ausdrücklichen Maintainer-Freigabe entfernt.
