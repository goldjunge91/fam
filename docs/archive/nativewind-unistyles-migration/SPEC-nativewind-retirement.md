# Modul-Spec: nativewind-retirement

Status: bereit für Implementierung
Beads: `fam-978.65` bis `fam-978.67`
Abhängigkeiten: `feature-migration`

## Objective

Nach dem letzten Consumer-Slice werden NativeWind und Tailwind vollständig aus
dem aktiven Repositorypfad entfernt. Die Entfernung umfasst Runtime,
Dependencies, Babel-/Metro-Integration, globale Tailwind-Dateien, Scripts und
aktive Dokumentationsverweise.

## Retirement-Regeln

- Erst den repo-weiten Scan ausführen, dann entfernen.
- `package.json`, `bun.lock`, Babel, Metro, `tailwind.config.js` und
  `src/global.css` gemeinsam gegen alle Verbraucher prüfen.
- `prettier-plugin-tailwindcss` oder weitere Tailwind-only Pakete nur entfernen,
  wenn `rg` keinen unabhängigen Verbraucher belegt.
- Historische Docs unter `docs/archive/nativewind-styling/` und ADR 0006 bleiben
  erhalten und tragen einen klaren Verweis auf den neuen Endzustand.
- Der neue Architekturtest erkennt verbotene Imports und APIs, nicht nur
  Dateinamen.

## Success Criteria

1. Keine NativeWind-/Tailwind-Pakete oder aktiven Konfigurationspfade bleiben.
2. Keine aktiven `className`-/`contentContainerClassName`-Verwendungen bleiben.
3. Historische Dokumentation ist nicht bindende Geschichte, keine aktive Quelle.
4. Ein fokussierter Test verhindert die Wiedereinführung.

## Verification

- `bun run test test/conventions/nativewind-removal.test.ts`.
- `bun run check` und `bun run typecheck`.
- `rg` über aktive Quellen, Konfiguration und Dokumentation mit expliziten
  historischen Ausschlüssen.
- Metro-/Typecheck-Nachweis nach Entfernung des Legacy-Pfads.
