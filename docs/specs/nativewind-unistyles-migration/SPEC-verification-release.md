# Modul-Spec: verification-release

Status: Abgeschlossen · iOS nachgewiesen, Android übersprungen
Beads: `fam-978.68`
Abhängigkeiten: `nativewind-retirement`

## Objective

Die vollständige Ablösung wird gegen Code, Tests, native Builds und reale
Interaktion abgenommen. Der Nachweis muss zeigen, dass die Entfernung nicht nur
im Jest-Baum, sondern auf iOS wirksam ist. Android ist für diesen Release
ausgenommen.

## Gates

- `bun run check`
- `bun run typecheck`
- fokussierte Tests für Theme, UI, Shared Components und alle geänderten
  Feature-Slices
- `bun run test test/conventions/nativewind-removal.test.ts`
- `bun run native:status -- --diff`

## Runtime-Nachweise

- iOS-Dev-Client: Light-/Dark-Mode, lange Labels, Fokus, Loading, Disabled,
  Auswahl und Pressed-Feedback.
- Android-Dev-Client: für diesen Release übersprungen; Android-Plattform-
  varianten, Edge-to-Edge und native Sheets/Keyboard sind kein Abschluss-Gate.
- Pressable-Flächen werden als reale statische Face-Geometrie geprüft; ein
  grüner Jest-Test allein gilt nicht als Gerätebeleg.
- Native Fingerprint und erforderlicher Rebuild werden nachgewiesen. Eine neue
  Baseline wird nur nach geprüfter, gewollter Native-Änderung gesetzt.

## Success Criteria

1. Alle Code- und Architektur-Gates sind grün.
2. iOS zeigt die bestehenden visuellen und interaktiven Verträge; Android ist
   explizit ausgenommen.
3. Keine Datenbank-, Sync- oder RLS-Regression wird eingeführt.
4. Die Nachweise und die fünf Reviewachsen sind im Beads-Initiativenticket
   festgehalten.
