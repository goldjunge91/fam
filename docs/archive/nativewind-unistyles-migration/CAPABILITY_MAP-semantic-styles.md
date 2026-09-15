# Capability Map: Semantische Styles

Status: Entwurf zur Abnahme  
Datum: 2026-09-14  
Bezug: `fam-7xer`, `SPEC-theme-and-semantic-repair.md`

## Ziel

Die verbleibenden semantischen Styles werden vollständig den drei bestehenden
Design-System-Ownern zugeordnet. Gemeinsame Rezepte liegen in
`src/constants/ui.tsx`; Theme-Tokens und Paletten bleiben in
`src/components/theme/index.ts`; Präferenz und Runtime-Auflösung bleiben in
`src/components/theme/ThemeProvider.tsx`.

Android und Web sind ausgenommen. Fachliches Verhalten, native Integrations-
grenzen, nutzergewählte Farben und externe Produktfarben bleiben unverändert.

## Fähigkeiten und Abhängigkeiten

| Modul-ID | Verantwortung | Ergebnis | Abhängigkeit |
| --- | --- | --- | --- |
| `semantic-core-callbacks` | Themeabhängige Varianten im zentralen UI-Owner auf Unistyles-Callbacks und Varianten abbilden | `Button`, `IconButton`, `Badge`, `Pill` und verwandte zentrale Rezepte besitzen keine themeabhängigen Inline-Styleobjekte | — |
| `shared-semantic-primitives` | Gemeinsame Komponenten aus `src/components/ui/` an zentrale semantische Rezepte anschließen | Auswahl-, Status-, Modal- und Produktdarstellung nutzt `ui.tsx`; Verbraucher behalten nur Verhalten und lokales Layout | `semantic-core-callbacks` |
| `feature-semantic-consumers` | Feature-Dateien einzeln klassifizieren und zulässige Ausnahmen dokumentieren | Semantische Themefarben außerhalb der Owner sind entfernt oder als Laufzeit-, Medien-, Nutzer- oder native Werte begründet | `shared-semantic-primitives` |
| `semantic-style-verification` | Architektur-Gates, Spec, Plan und fokussierte Nachweise aktualisieren | Statischer Scan erkennt neue semantische Styles außerhalb der Owner; beide Paletten und bestehendes Verhalten bleiben abgedeckt | `feature-semantic-consumers` |

## Build-Reihenfolge

```text
semantic-core-callbacks
        ↓
shared-semantic-primitives
        ↓
feature-semantic-consumers
        ↓
semantic-style-verification
```

## Scope-Grenzen

### In Scope

- Gemeinsame iOS-/Shared-Komponenten und deren semantische Farb-, Typografie-,
  Flächen-, Kontur-, Schatten- und Zustandsrezepte.
- Themeabhängige Styles in `src/constants/ui.tsx` und wiederverwendbaren
  Komponenten.
- Feature-Verbraucher, sofern sie eine gemeinsame semantische Entscheidung
  duplizieren.
- Fokussierte Architekturtests, `bun run check` und `bun run typecheck`.

### Out of Scope

- Android- und Web-spezifische Dateien.
- Neue Farbrollen, visuelles Redesign oder fachliche Verhaltensänderungen.
- Native APIs ohne Unistyles-Interop, nutzergewählte Farben und offizielle
  Produktkennzeichnungen.
- Datenbank, Auth, Sync, Native-Fingerprint und neue Styling-Runtimes.

## Freigabegate

Diese Map ist ein Entwurf. Die Modulgrenzen und Reihenfolge müssen vor der
Modul-Spec und jedem Produktionscode bestätigt werden.
