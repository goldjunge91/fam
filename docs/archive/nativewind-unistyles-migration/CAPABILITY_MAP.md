# Capability Map: NativeWind zu Unistyles v3

Status: Entwurf zur Abnahme
Datum: 2026-09-13
Beads: `fam-978`

## Bestätigte Entscheidung

Die App wird vollständig von NativeWind auf `react-native-unistyles` v3
umgestellt. NativeWind, Tailwind, die zugehörige Babel-/Metro-Integration und
die `className`-APIs werden nach der Migration aus dem aktiven Produktions-
und Konfigurationspfad entfernt.

Die bestehenden drei Design-System-Owner bleiben erhalten:

1. `src/components/theme/index.ts` besitzt Tokens, Paletten und die
   Unistyles-Konfiguration.
2. `src/components/theme/ThemeProvider.tsx` besitzt Präferenzauflösung,
   aktive Palette sowie `useTheme()` und `useThemedStyles()`.
3. `src/constants/ui.tsx` besitzt semantische UI-Primitiven und gemeinsame
   Darstellungsverträge.

Historische NativeWind-Dokumente bleiben als Entstehungsgeschichte erhalten.
Aktive Regeln und Verträge werden durch diese Migration ersetzt bzw. in einem
neuen ADR ausdrücklich supersediert.

## Fähigkeiten und Abhängigkeiten

| ID | Fähigkeit | Benannter Owner | Ergebnis | Abhängigkeit |
| --- | --- | --- | --- | --- |
| `migration-contract` | Aktive Verträge und Arbeitsregeln auf vollständige Entfernung ausrichten | `docs/design-system/contracts/`, `AGENTS.md`, `CLAUDE.md`, neues ADR | Eindeutiger Operationsvertrag ohne NativeWind-Endzustand; historische Spezifikation bleibt markiert | — |
| `unistyles-foundation` | Unistyles v3 technisch integrieren | `src/components/theme/index.ts`, `babel.config.js`, `package.json`, native Konfiguration | Verifizierte Version, Babel-Plugin, `StyleSheet.configure`, notwendige Peer-/Native-Konfiguration | `migration-contract` |
| `design-system-core` | Zentrale Theme- und UI-Owner migrieren | `src/components/theme/index.ts`, `ThemeProvider.tsx`, `src/constants/ui.tsx` | Token-, Palette-, Zustands- und Primitive-Verträge laufen über Unistyles | `unistyles-foundation` |
| `shared-ui-migration` | Geteilte Komponenten und native Integrationsgrenzen migrieren | `src/components/`, gemeinsame Hooks und Tests | Gemeinsame UI nutzt typed Unistyles-Styles ohne `className` | `design-system-core` |
| `feature-migration` | Screens, Routen, Feature-Komponenten und Plattformvarianten migrieren | jeweiliger Feature-Owner unter `src/features/` und `src/app/` | Alle aktiven Verbraucher sind auf Unistyles oder begründete native Style-Grenzen umgestellt | `shared-ui-migration` |
| `nativewind-retirement` | NativeWind vollständig aus dem aktiven System entfernen | Root-Konfiguration, Abhängigkeiten, globale Styles, aktive Doku und Gates | Keine NativeWind-/Tailwind-Laufzeit, Pakete oder Styling-APIs verbleiben | `feature-migration` |
| `verification-release` | Migration gegen Verhalten und Plattformen abnehmen | fokussierte Tests, statische Gates, iOS-/Android-Dev-Client | Typecheck, Biome, fokussierte Tests, statische Resteverifikation, Laufzeit- und Fingerprint-Nachweise | `nativewind-retirement` |

## Verbindliche Reihenfolge

```text
migration-contract
        ↓
unistyles-foundation
        ↓
design-system-core
        ↓
shared-ui-migration
        ↓
feature-migration
        ↓
nativewind-retirement
        ↓
verification-release
```

Nach `shared-ui-migration` dürfen unabhängige Feature-Domänen parallelisiert
werden. Jeder Slice muss seine fokussierten Nachweise bestehen, bevor der
nächste abhängige Slice beginnt.

## Scope-Grenzen

### In Scope

- React-Native- und Expo-Komponenten in `src/` und `src/app/`.
- Theme-Tokens, Light-/Dark-Paletten, Typografie, Abstände, Zustände,
  Plattformvarianten und native Integrationsgrenzen.
- Babel-/Metro-/Tailwind-Bestandskonfiguration, Abhängigkeiten und globale
  Styling-Dateien.
- Aktive Design-System-Verträge, `AGENTS.md`, `CLAUDE.md` und ein
  supersedierendes ADR.
- Fokussierte Tests und ein statischer Architektur-Gate für die vollständige
  Entfernung.

### Out of Scope

- Visuelles Redesign, neue Farbrollen oder fachliche UI-Verhaltensänderungen.
- Änderungen an Supabase-Schema, RLS, SQLite, Outbox oder Sync.
- Eine zusätzliche Theme-/Token-Schicht neben den drei bestehenden Ownern.
- Eine Web-Vorschau oder ein neuer Browser-Workflow; Web-Verhalten wird nur
  soweit geprüft, wie es der bestehende Projektvertrag verlangt.
- Das Löschen historischer NativeWind-Spezifikationen oder des alten ADRs.

## Abnahme je Fähigkeit

Jede Fähigkeit liefert einen kleinen Diff, einen benannten Owner und passende
Nachweise. Der endgültige Abschluss ist erst zulässig, wenn der statische
Scan keine aktiven `nativewind`, `tailwind`, `className` oder
`contentContainerClassName`-Reste findet und iOS sowie Android mit dem
aktualisierten nativen Artefakt geprüft wurden.
