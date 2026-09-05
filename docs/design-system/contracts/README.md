# Design-System-Verträge

Stand: 2026-09-05. Diese Dateien sind die normative Referenz für das fam-Design-System.
Sie beschreiben den verbindlichen Zielzustand. Die Überarbeitung der Dokumente
ist kein Nachweis, dass App-Code und Referenzseite bereits vollständig entsprechen.

## Gültigkeit und Umsetzung

- **Vertrag:** legt Zuständigkeiten, Verhalten und überprüfbare Anforderungen fest.
- **Migrationsbestand:** vorhandener Code, der noch abweicht. Er darf während der
  Migration weiterarbeiten, ist aber keine Vorlage für neue Implementierungen.
- **Integrationsausnahme:** konkret begründete Grenze, etwa eine native Kamera
  oder offizielle Produktkennzeichnung. Sie wird im zuständigen Vertrag mit
  Pfad, Plattform, Grund und Prüffall benannt; Altbestand allein ist kein Grund.
- **Beispiel:** zeigt die beabsichtigte Verwendung einer API. Es ist keine Aussage
  über den Implementierungsstatus aller Komponenten.
- **Nachweis:** gezielter Test, Codeprüfung oder dokumentierte Geräteprüfung.
  Ein Screenshot von Web belegt kein natives Verhalten.

Die [Konsolidierungs-Spezifikation](../../specs/ui-consolidation/SPEC.md) enthält
Begründung, Umfang und Abnahmekriterien der Überarbeitung. Die Contracts besitzen
weiterhin die laufenden Regeln; die Spec ist keine parallele Designquelle.
`docs/specs/nativewind-styling/` bleibt historische Dokumentation.

Die Dokumentationsüberarbeitung autorisiert keine App-Codeänderung. Bei späterer
Umsetzung müssen Code, Contracts und Referenzseite denselben Zustand erreichen.
Planung und Arbeitsstatus werden separat geführt, Arbeitspakete in Beads.

## Genau drei Verantwortliche

| Quelle | Verantwortung |
| --- | --- |
| `src/components/theme/index.ts` | Wiederverwendbare Tokens: Paletten, Schriftmaße und Gewichte, Abstände, Radien, Schatten, Verläufe und gemeinsame Maße |
| `src/components/theme/ThemeProvider.tsx` | Persistierte Theme-Präferenz, Auflösung von `system/light/dark`, aktive Palette, `useTheme()` und `useThemedStyles()` |
| `src/constants/ui.tsx` | Semantische Primitive und gemeinsame Rezepte für Typografie, Farbpaare, Flächen, Konturen, Interaktionszustände, Motion und Haptikzuordnung |

Höhere Komponenten besitzen Verhalten, Komposition, Accessibility-Metadaten und
lokales Layout. Sie wenden die zentralen Rezepte an. NativeWind bleibt auf
statisches Layout beschränkt. `global.css` und `tailwind.config.js` besitzen keine
zusätzlichen Designentscheidungen; ihre semantischen Bestände werden migriert.

Produktbuttons werden über `src/components/ui/buttons/`, Produktfelder über
`src/components/forms/text-field.tsx` importiert. Kompatibilitätsadapter dürfen
bestehen, wenn sie dieselbe Basis verwenden. Zwei unabhängige Darstellungen
für denselben Komponentenvertrag sind kein zulässiger Endzustand.

## Vertragsübersicht

1. [Theme und Farben](./01-theme-and-colors.md)
2. [Typografie](./02-typography.md)
3. [Spacing und Layout](./03-spacing-and-layout.md)
4. [Radien, Schatten und Verläufe](./04-radius-shadow-gradient.md)
5. [NativeWind und StyleSheet](./05-nativewind-and-stylesheet.md)
6. [Surfaces und Cards](./06-surfaces-and-cards.md)
7. [Buttons und Interaktion](./07-buttons-and-interaction.md)
8. [Felder und Auswahl](./08-fields-and-selection.md)
9. [Screens und Navigation](./09-screens-and-navigation.md)
10. [Accessibility und Zustände](./10-accessibility-and-states.md)

## Referenzseite und Abnahme

`/settings/design-system` zeigt die kanonischen Produktkomponenten und die
zugehörigen Grundlagen. Legacy-Adapter sind ausdrücklich als solche beschriftet.
Gegenbeispiele sind eindeutig gekennzeichnet und dürfen nicht in Produktcode
übernommen werden.

Die Referenz umfasst Light/Dark, lange Beschriftungen und die unterstützten
Normal-, Fokus-, Auswahl-, Fehler-, Disabled- und Loading-Zustände. Große Schrift
und schmale Breite werden mit tatsächlichen Geräte-/Viewport-Einstellungen
geprüft. Die einzelnen Verträge benennen ihre Nachweise; die übergreifende
Prüfmatrix steht in [Vertrag 10](./10-accessibility-and-states.md).

Neue Beispiele dürfen keine noch nicht implementierte API als bereits vorhanden
präsentieren. Fehlende Plattformnachweise werden offen benannt. Nichttriviale
Layout-/Copy-Änderungen benötigen gemäß `AGENTS.md` mehrere statische Mocks und
eine Auswahl vor der Implementierung. Funktionsumfang und Gegenaktionen bleiben
erhalten; dieser Vertrag ist keine Freigabe für ein Redesign aller Screens.
