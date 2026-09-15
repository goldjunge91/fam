# Modul-Spec: migration-contract

Status: bereit für Implementierung
Beads: `fam-978.1` bis `fam-978.3`
Abhängigkeiten: keine

## Objective

Die aktiven Arbeits- und Design-System-Verträge beschreiben den bestätigten
Zielzustand: Unistyles v3 ist die einzige Styling-Laufzeit, NativeWind ist nur
noch historische Migrationsdokumentation und die drei bestehenden Owner bleiben
kanonisch.

## Scope und Dateien

- `AGENTS.md` und `CLAUDE.md` synchronisieren.
- `docs/design-system/contracts/README.md`, `01-theme-and-colors.md`,
  `02-typography.md`, `03-spacing-and-layout.md`,
  `05-unistyles-and-stylesheet.md`, `07-buttons-and-interaction.md` und
  `08-fields-and-selection.md` aktualisieren.
- `docs/adr/README.md` aktualisieren und
  `docs/adr/0007-nativewind-retirement-unistyles-v3.md` ergänzen.
- `docs/archive/nativewind-styling/` nicht als aktive Quelle behandeln. Die Dokumente bleiben als
  historische Quelle gekennzeichnet und sind nicht bindend.

## Vertrag

- `index.ts` besitzt Tokens, Paletten und die Unistyles-Konfiguration.
- `ThemeProvider.tsx` besitzt Präferenzauflösung, aktive Palette und Hooks.
- `ui.tsx` besitzt semantische Primitive und Zustandsrezepte.
- Feature- und Komponenten-Styles besitzen nur lokales Layout, berechnete
  Laufzeitwerte und native Integrationsgrenzen.
- Neue aktive Dokumentationsbeispiele verwenden keine NativeWind- oder
  `className`-API.
- Die Änderungen autorisieren noch keine Produktionscode-Migration. Foundation
  und Verbraucher folgen erst nach dieser Vertragsangleichung.

## Success Criteria

1. `AGENTS.md`, `CLAUDE.md` und die aktiven Contracts widersprechen dem
   Unistyles-Endzustand nicht.
2. Das neue ADR dokumentiert Entscheidung, Folgen, Risiken und die bewusste
   Beibehaltung des alten ADRs als Geschichte.
3. Die historischen NativeWind-Specs sind auffindbar, aber als nicht bindend
   markiert.
4. Die drei Owner und die bestehende visuelle Zielsetzung bleiben unverändert.

## Verification

- `rg`-Prüfung auf widersprüchliche aktive Regeln.
- `git diff --check`.
- Begründung und Nachweis im jeweiligen Beads-Task.
