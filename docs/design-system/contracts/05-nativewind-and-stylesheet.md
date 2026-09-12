# Vertrag: NativeWind und StyleSheet

## Zweck

Styling-Verantwortung richtet sich nach der Bedeutung eines Werts. NativeWind
bleibt bis zum Abschluss der Verbrauchermigration installiert, ist aber eine
auslaufende technische Layout-Hilfe. Der Zielzustand hat keine NativeWind-
Abhängigkeit. Die Entscheidung und ihre Folgen stehen in
[ADR 0006](../../adr/0006-nativewind-als-auslaufende-layout-hilfe.md).
Die drei zentralen Quellen aus der [README](./README.md) besitzen das Design-System.

## Auslaufmodell und Migrationsrichtung

- Neue Komponenten und neue Verbraucher führen keine NativeWind-`className`-
  Nutzung ein.
- Bestehende `className`-Verwendungen sind Migrationsbestand und keine Vorlage
  für neue semantische Entscheidungen.
- Semantische Darstellung wird verbraucherorientiert nach `ui.tsx`, den Theme-
  Tokens und lokalen nativen Layoutstilen verschoben. Es entsteht keine neue
  Theme-Bridge und keine parallele Styling-Runtime.
- NativeWind wird nicht durch eine zweite Styling-Bibliothek ersetzt. Die
  Entfernung erfolgt schrittweise, sobald die aktiven Verbraucher auf die
  zentrale UI-/Theme-Architektur und native Layout-APIs umgestellt sind.
- Die Abhängigkeit, Babel-/Metro-Integration und unbenutzte Legacy-Definitionen
  werden erst nach einer plattformübergreifenden Verbraucherprüfung entfernt.

Bis dahin gelten die folgenden Abschnitte als Übergangsgrenze. Sie erlauben
keine Ausweitung der NativeWind-Verantwortung.

## Erlaubte Zuständigkeiten

| Bereich | Zulässig |
| --- | --- |
| NativeWind | statische Flex-Richtung, Ausrichtung, Positionierung, feste Layoutgrößen und bestehende Layoutabstände gemäß Vertrag 03 |
| `index.ts` | gemeinsame Werte und Tokentypen |
| `ThemeProvider.tsx` | aktive Palette und Themeauflösung |
| `ui.tsx` | Typografie, Farbpaare, Flächen, Konturen, Radien-/Schattenanwendung und Zustandsrezepte |
| Komponenten-/Feature-StyleSheet | nichtsemantisches lokales Layout, berechnete Geometrie und native Integrationswerte |

Eine Farbe direkt aus `useTheme()` zu lesen macht eine lokale Card-, Button- oder
Auswahlgestaltung noch nicht zu einem zentralen Rezept. Höhere Komponenten
wenden gemeinsame Darstellung an und ergänzen Verhalten und Komposition.

Ein `StyleSheet` darf die aktive Palette über `useThemedStyles()` beziehen. Das
ist keine neue Tokenquelle, sondern die Laufzeitbindung an das aktive Theme.
Der kanonische `Button` bleibt das Primitive aus `src/constants/ui.tsx`;
`src/components/ui/buttons/button.tsx` ist nach der Verbrauchermigration kein
zweiter Button-Einstieg mehr.

`className` und allgemeine `style`-Props sind keine Freigabe für semantische
Overrides. Bestehende breite Props bleiben für kompatible Aufrufer und native
Grenzen nutzbar. Wiederkehrende visuelle Entscheidungen werden zentral ausgedrückt.

## Migrationsbestand

Bestehende globale Komponenten-, Farb-, Typografie- und Zustandsklassen sind
Migrationsbestand. Neue Stellen verwenden sie nicht. Dazu zählen auch technisch
korrekte Klassen wie `bg-accent`, `input-field` oder `active:opacity-70`, wenn sie
semantische Darstellung übernehmen. Das Problem ist nicht nur dynamische Syntax.

`global.css` und `tailwind.config.js` erhalten keine neuen semantischen Klassen,
Paletten, Schriftrollen oder Zustände. Es wird keine `vars()`-Bridge oder weitere
NativeWind-Theme-Schicht eingeführt. Die Migration erfolgt über Verbraucher,
nicht über eine zweite synchronisierte Farbquelle.

Alte Exports und Klassen werden erst nach Prüfung aller Verbraucher einschließlich
Android, Web und Referenzseite entfernt. Eine konkrete Prop-Übersetzung darf während der Migration existieren, aber keine zweite Darstellungslogik besitzen;
neue Verbraucher werden direkt auf das kanonische Primitive umgestellt.

## Integrationsausnahmen

Native Views ohne NativeWind-Interop verwenden ihre tatsächliche
`style`-/Prop-API, beispielsweise FlashList, Bottom Sheets, SVG oder `expo-image`.
Palette und semantische Rezepte stammen weiterhin aus den zentralen Quellen.

Medien, offizielle Produktkennzeichnungen, nutzergewählte Farben und Systemcontrols
werden nicht pauschal in die fam-Palette umgefärbt. Ein Crash-Fallback außerhalb
des Providers darf robuste feste Fallbackwerte verwenden. Diese Grenzen erlauben
keine zusätzlichen allgemeinen UI-Farben im Feature.

Für jede verbleibende Ausnahme wird im fachlich passenden Vertrag ein Eintrag mit
**Pfad, Plattform, Grund, betroffener Regel und Prüffall** dokumentiert. Die bloße
Nennung einer Kategorie hier ist keine pauschale Ausnahme für jede ihrer Dateien.
Bewusst falsche Showcase-Beispiele werden ausdrücklich als Gegenbeispiele markiert.

## Beispiel der vorgesehenen Verwendung

```tsx
import { space } from '@/components/theme/index';
import { Surface } from '@/constants/ui';

<Surface
  tone="soft"
  className="flex-row items-center"
  style={{ gap: space.md }}
/>
```

Vertragsbrüche sind eine lokale semantische StyleSheet-Palette, ein eigenes
`selected`-Rezept pro Screen und dynamische Klassen wie `bg-[${color}]`.
Ein rein lokales `flex: 1` oder eine berechnete Bildgröße ist dagegen zulässig.

## Nachweis und Abschluss

Die Verbraucherprüfung umfasst Imports, Klassen und semantische Styles aller
betroffenen aktiven Komponenten sowie ihre Plattformvarianten. Jeder verbleibende
Sonderweg wird migriert oder konkret begründet. Ein Regex, der pauschal Kamera-Schwarz
oder offizielle Kennzeichnungen verbietet, genügt nicht.

Eine abgeschlossene Migration hat keine unbegründeten aktiven semantischen Legacy-
Verbraucher. Nicht mehr verwendete Legacy-Definitionen werden nach Prüfung entfernt.
Betroffene Typ-, Biome- und CSS-Prüfungen sowie gezielte Verbrauchertests müssen
bestehen. Code- und Dokumentationsstatus werden getrennt berichtet.
