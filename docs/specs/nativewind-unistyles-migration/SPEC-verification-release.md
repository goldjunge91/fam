# Modul-Spec: verification-release

Status: bereit für Implementierung
Beads: `fam-978.68`
Abhängigkeiten: `nativewind-retirement`

## Objective

Die vollständige Ablösung wird gegen Code, Tests, native Builds und reale
Interaktion abgenommen. Der Nachweis muss zeigen, dass die Entfernung nicht nur
im Jest-Baum, sondern auf iOS und Android wirksam ist.

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
- Android-Dev-Client: dieselben Zustände plus Android-Plattformvarianten,
  Edge-to-Edge und native Sheets/Keyboard.
- Pressable-Flächen werden als reale statische Face-Geometrie geprüft; ein
  grüner Jest-Test allein gilt nicht als Gerätebeleg.
- Native Fingerprint und erforderlicher Rebuild werden nachgewiesen. Eine neue
  Baseline wird nur nach geprüfter, gewollter Native-Änderung gesetzt.

## Success Criteria

1. Alle Code- und Architektur-Gates sind grün.
2. iOS und Android zeigen die bestehenden visuellen und interaktiven Verträge.
3. Keine Datenbank-, Sync- oder RLS-Regression wird eingeführt.
4. Die Nachweise und die fünf Reviewachsen sind im Beads-Initiativenticket
   festgehalten.
