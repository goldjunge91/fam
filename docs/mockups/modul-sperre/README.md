# Modul-Sperre (Feature-Flag aus)

Visuelle Behandlung für ein Modul (Rezepte, Meal-Planner, Kalorienzähler), dessen
PostHog-Feature-Flag noch nicht freigeschaltet ist — im Gegensatz zur nutzereigenen
`ModulePreferences`-Deaktivierung soll die Karte hier sichtbar bleiben, aber unbedienbar
sein, statt komplett zu verschwinden. Teil von #183 (PostHog Feature Flags).

Stand: implementiert (`module-settings-screen.tsx`, `module-selector.tsx`).

- `modul-sperre-mockup.html` — die drei zur Auswahl gestellten Varianten (lokale Kopie).
- Live-Artifact: https://claude.ai/code/artifact/bd92ca96-0e89-4fe0-a43e-f98fd193f361

## Kernpunkte

- **Variante A gewählt und umgesetzt**: graue Überlagerung (`withAlpha(theme.backgroundElement, 0.4)`)
  über die ganze Karte, zentrierter dunkler Pill „Demnächst verfügbar" deckt den Switch ab.
- Variante B (Eck-Badge + Schloss-Symbol) und Variante C (dezenter Inline-Chip) wurden verworfen.
- Pill-Hintergrund/-Text bewusst per Inline-`style` (`theme.text`/`theme.background`) statt
  Tailwind-`className` gesetzt — `ThemedText`s eigene `type`-Farbklasse kann eine per
  `className`/`themeColor` übergebene Farbe unzuverlässig überschreiben (beide im selben
  Tailwind-Layer, Reihenfolge nicht garantiert). Inline-`style` gewinnt bei NativeWind immer.
- Wash-Opazität nach Nutzer-Feedback von 55% auf 40% reduziert.
- Vorrat/Einkauf sind von der Flag-Sperre ausgenommen, bleiben rein nutzergesteuert.
