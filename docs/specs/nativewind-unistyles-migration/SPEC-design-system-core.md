# Modul-Spec: design-system-core

Status: bereit für Implementierung
Beads: `fam-978.7` und `fam-978.8`
Abhängigkeiten: `unistyles-foundation`

## Objective

Die drei zentralen Design-System-Owner arbeiten auf dem Unistyles-Theme-Raum,
ohne ihre öffentliche Verantwortung oder die bestehende visuelle und
semantische Sprache zu verändern.

## Owner-Verträge

### `src/components/theme/index.ts`

Die Datei bleibt die Quelle für Light-/Dark-Paletten, Tokens, gemeinsame Maße
und die Unistyles-Konfiguration. Das typed Theme wird aus den bestehenden
Tokens abgeleitet. Semantische Rollen werden nicht in einer zweiten Objektform
dupliziert.

### `src/components/theme/ThemeProvider.tsx`

Die Datei bleibt die Quelle für persistierte Präferenz, Auflösung von
`system | light | dark`, aktive Palette, `useTheme()` und
`useThemedStyles()`. Die App-Präferenz hat Vorrang vor dem Systemtheme. Hooks
bleiben kompatibel und transportieren keine neue parallele Farbquelle.

### `src/constants/ui.tsx`

Die Datei bleibt die Quelle für `Txt`, `Surface`, `Button`, `TextField`,
`SegmentedControl`, `Press` und gemeinsame semantische Rezepte. Die Primitive
verwenden typed Unistyles-/native Styles. `className`-Props und die bisherige
NativeWind-Weitergabe entfallen nach der Consumer-Migration.

## Verhaltensvertrag

- Farben, Typografie, Konturen, Schatten, Radien und Zustände bleiben in
  Bedeutung und Priorität erhalten.
- pressed-, focused-, selected-, disabled- und loading-Zustände bleiben
  sichtbar, zugänglich und auf dem Gerät wirksam.
- Essenzielle Pressable-Geometrie liegt im statischen Style des interaktiven
  Elements. Dynamisches Feedback darf die Fläche nicht ersetzen.
- Öffentliche Primitive-Props, Refs, Accessibility-Props und Plattformgrenzen
  bleiben erhalten, sofern keine ausdrücklich begründete Contract-Korrektur
  erfolgt.

## Success Criteria

1. Die drei Owner importieren und verwenden Unistyles korrekt.
2. Es gibt keine zweite Palette, `vars()`-Bridge oder semantische lokale
   Primitive-Reimplementierung.
3. Bestehende fokussierte Theme-/UI-Tests prüfen beobachtbares Verhalten und
   Fehlerfälle.
4. `className` ist aus der Core-API entfernt, nachdem alle Aufrufer migriert
   oder im selben Slice angepasst wurden.

## Verification

- `bun run test src/components/theme/index.test.ts src/constants/theme.test.ts`
- `bun run test src/constants/ui.test.tsx`
- `bun run check`
- `bun run typecheck`
- Light-/Dark- und Zustandsprüfung im Design-System-Showcase.
