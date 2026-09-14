# Spec: Theme- und Semantik-Reparatur

Status: Abgeschlossen; Vollständigkeits-Follow-up `fam-7xer` umgesetzt · Android übersprungen · 2026-09-14
Referenzen: `fam-978.76`, Review `fam-978.74`, [Umsetzungsplan](../../../tasks/plan.md)

## Ziel und Scope

App-Theme und Unistyles zeigen dieselbe Palette. Ausgewählte Produktvorschläge
sind in Light und Dark lesbar. Gemeinsame Auswahl-, Header- und Close-Darstellung
liegt ausschließlich in `src/constants/ui.tsx`.

Verbindlich bleiben die Design-System-Verträge
[01 Theme und Farben](../../design-system/contracts/01-theme-and-colors.md),
[05 Unistyles](../../design-system/contracts/05-unistyles-and-stylesheet.md) und
[07 Interaktion](../../design-system/contracts/07-buttons-and-interaction.md).
Dieser Spec konkretisiert deren Verhalten für die Reparatur.

Die ursprüngliche Theme-/Semantik-Reparatur und die anschließende
Vollständigkeitsarbeit in `fam-7xer` sind umgesetzt. React-Native-StyleSheet-
Imports, semantische Ownership und Theme-Callbacks entsprechen dem aktuellen
Dateistand; verbleibende Scan-Kandidaten sind dokumentierte Laufzeit-, Nutzer-
oder native Integrationswerte.

## Entscheidungen

### 1. Eine Theme-Auflösung

- `ThemeProvider.tsx` besitzt Präferenz, Persistenz und die einzige Auflösung:
  `system` folgt dem OS, `light` und `dark` bleiben explizit.
- `index.ts` besitzt Tokens, Paletten und die Unistyles-Konfiguration mit
  `adaptiveThemes: true`.
- Bei `system` übernimmt Unistyles die OS-Auflösung. Für eine explizite
  `light`-/`dark`-Präferenz deaktiviert der Provider Adaptive Themes und setzt
  danach den gewählten Modus über `UnistylesRuntime.setTheme(mode)`.
- Beim Kaltstart wird die gespeicherte Präferenz vor dem ersten sichtbaren
  App-Inhalt angewendet. Der Bootstrap-Default darf nicht sichtbar werden.
- Bei Präferenz-, Speicher- und OS-Änderungen sowie bei Rückkehr in den
  Vordergrund stimmen Context und Runtime vor der nächsten sichtbaren
  Darstellung überein. Keine Runtime-Mutation während des React-Renders;
  keine Theme-Keys oder Remounts zum Erzwingen der Aktualisierung.
- Bei fehlendem oder fehlerhaftem Speicher bleibt die Sitzungsauswahl nutzbar.
  Fehlende oder ungültige Präferenz fällt auf `system` zurück;
  ein unbekanntes OS-Schema auf `light`.

### 2. Ein festes Auswahlrezept

- Produktvorschläge verwenden das bestehende `Press selected`-Rezept:
  ausgewählt `backgroundSoft` mit `accent`-Kontur, sonst
  `backgroundElement` mit `border`-Kontur.
- Titel und Metadaten verwenden die vorhandene primäre Textrolle, ausgewählt
  wie unausgewählt. Beide Flächen-/Textpaare müssen in Light und Dark mindestens
  4,5:1 erreichen. Keine globale Umfärbung bestehender Textrollen.
- Bestehende Auswahlverbraucher behalten ihre zentrale Fläche. Keine neue
  Akzentfüllung und kein zusätzliches Auswahl-Primitive.
- Auswahl bleibt zusätzlich zu Farbe über ein sichtbares Symbol, Text oder
  Form erkennbar und besitzt `accessibilityState.selected`. Erforderliche
  nichttextliche Zustandsmerkmale erfüllen den bestehenden 3:1-Vertrag.

### 3. Vollständige UI-Zuständigkeit

- `ui.tsx` besitzt die semantischen Rezepte für Auswahl, Header und Modal-Close.
  Header verwendet weiterhin `backgroundElement`, Modal-Close `backgroundSoft`.
- `HeaderIconButton`, `household-step` und `module-selector` verwenden diese
  Rezepte. Lokale Styles enthalten nur Layout, Maße und Touch-Geometrie.
- Header und Modal-Close bleiben getrennte Varianten. Bestehende Kinder,
  Labels, HitSlop und öffentliche Props bleiben kompatibel; native oder
  explizit übergebene Farben begründen keine lokale Standardpalette.
- Themeabhängige Rezepte verwenden `StyleSheet.create((theme) => ({ ... }))`.
  Pressable-Flächen erhalten statische Styles, keine Style-Funktionen.

## Umsetzungsmodule und Dateien

Reihenfolge: `theme-runtime-sync → semantic-selection → shared-semantic-owners`.

| Modul | Scope | Ergebnis |
| --- | --- | --- |
| `theme-runtime-sync` | `src/components/theme/{ThemeProvider.tsx,index.ts,index.test.ts}` | Ein aufgelöster Modus, korrekter erster Frame und laufender Wechsel |
| `semantic-selection` | `src/constants/ui.tsx`, zugehöriger Test; Produktvorschläge und zugehöriger Test unter `src/features/shopping-list/forms/` | Bestehende Auswahlfläche, lesbare Textrollen, Selected-Semantik |
| `shared-semantic-owners` | `ui.tsx` samt Test; Onboarding `household-step.tsx`, `module-selector.tsx`; `header-icon-button.tsx` samt Test | Keine lokalen semantischen Auswahl-, Header- oder Close-Rezepte |

Das letzte Modul wird innerhalb des bestehenden Slices erst für Onboarding,
dann für Header/Close bearbeitet. Gemeinsame Owner werden sequenziell geändert.

## Abnahme

| Szenario | Erwartung |
| --- | --- |
| Kaltstart mit gespeichertem Light unter dunklem OS und umgekehrt | Erster sichtbarer App-Frame entspricht der Präferenz |
| `system` mit laufendem OS-Wechsel in beide Richtungen | Context, Unistyles, Text, Fläche und Kontur wechseln gemeinsam |
| `light ↔ dark` und jeweils zurück zu `system` | Sofort korrekte Palette; Systemmodus übernimmt den aktuellen OS-Zustand |
| OS-Wechsel bei expliziter Präferenz | App-Palette bleibt unverändert |
| OS-Wechsel im Hintergrund, anschließend Resume | Systemmodus aktualisiert sich; explizite Präferenz bleibt erhalten |
| Externe Speicheränderung, ungültiger Wert und Speicherausfall | Definierter Fallback; Context und Runtime bleiben konsistent |
| Themewechsel bei offenem Formular | Eingaben, Fokus und Auswahl bleiben ohne Remount erhalten |
| Auswahl, Disabled, Fokus, lange Labels, Header und Close in beiden Paletten | Lesbar, bedienbar und korrekte Accessibility-Zustände |

Fokussierte Jest-Prüfungen beobachten Provider-Verhalten und Runtime-Grenze;
Kontrastprüfungen berechnen tatsächliche Farbpaare. Der iOS-Dev-Client wurde
nach Native-Rebuild in Light und Dark gestartet und zeigt die jeweilige
Palette ohne Unistyles-Fehler. Android wird für diese Abnahme übersprungen.
Mock-Aufrufe allein beweisen weder Flackerfreiheit noch native Darstellung.

Nachweis-Befehle für die Code-Gates:

```bash
bun run test src/components/theme/index.test.ts src/constants/theme.test.ts src/constants/ui.test.tsx --runInBand --watchman=false
bun run test src/features/shopping-list/forms/shopping-product-suggestions.test.tsx src/components/ui/buttons/header-icon-button.test.tsx --runInBand --watchman=false
bun run check
bun run typecheck
bun run native:status -- --diff
```

## Grenzen und Freigabe

- Immer: bestehende drei Owner und Design-System-Verträge einhalten;
  fokussierte Nachweise und iOS-Abnahme vor Abschluss liefern. Android ist
  für diesen Release explizit ausgenommen.
- Vorher abstimmen: neue Farbrollen, sichtbare Gestaltung außerhalb der
  beschriebenen Korrektur, öffentliche API- oder native Dependency-Änderungen.
- Nie: zweite Theme-Auflösung, neue Styling-Runtime, freie Feature-Hexwerte,
  `className`, Style-Spreads oder Casts als Unistyles-Workaround.
- Außerhalb des Scopes: Datenbank, Auth, RLS, SQLite, Outbox, Sync und
  Removal-Gate-Arbeit aus `fam-978.75`/`fam-978.67`.

Die Gestaltungs- und Architekturentscheidungen dieses Specs sind festgelegt und
umgesetzt. Die iOS-Laufzeit ist nachgewiesen; Android ist gemäß aktueller
Entscheidung aus dieser Abnahme ausgenommen.
