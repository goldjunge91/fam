# Design-System (fam)

Dieses Dokument ist die Arbeitsreferenz für neue und überarbeitete Oberflächen
der fam-App. Es beschreibt den aktuellen Soll-Zustand: welche Bausteine
verwendet werden, wem Farben und Typografie gehören und wo NativeWind endet.

Die normativen Verträge mit direkt vergleichbaren Umsetzungsbeispielen stehen
unter [`docs/design-system/contracts/`](./contracts/). Ihre lebende
Darstellung ist in der App unter **Einstellungen → Entwickler →
Design-System-Referenz** erreichbar. Dort werden die echten Tokens und
Komponenten gerendert; die rot markierten Beispiele zeigen bewusst den
jeweiligen Vertragsbruch.

[`docs/specs/nativewind-styling/`](../specs/nativewind-styling/) dokumentiert
die abgeschlossene Entstehung dieser Architektur. Die Specs sind historischer
Kontext und keine zweite aktuelle Design-System-Quelle.

| Vertrag | Referenz-Screen |
| --- | --- |
| [Theme und Farben](./contracts/01-theme-and-colors.md) | Theme, Farben |
| [Typografie](./contracts/02-typography.md) | Typografie |
| [Spacing und Layout](./contracts/03-spacing-and-layout.md) | Tokens |
| [Radien, Schatten und Verläufe](./contracts/04-radius-shadow-gradient.md) | Tokens |
| [NativeWind und StyleSheet](./contracts/05-nativewind-and-stylesheet.md) | Hybrid |
| [Surfaces und Cards](./contracts/06-surfaces-and-cards.md) | Flächen |
| [Buttons und Interaktion](./contracts/07-buttons-and-interaction.md) | Bedienung |
| [Felder und Auswahl](./contracts/08-fields-and-selection.md) | Bedienung |
| [Screens und Navigation](./contracts/09-screens-and-navigation.md) | Screens |
| [Accessibility und Zustände](./contracts/10-accessibility-and-states.md) | Zustände, Feedback |

## 1. Quellen der Wahrheit

| Verantwortung | Quelle |
| --- | --- |
| Farben, Abstände, Radien, Schriftmaße, Schatten, Verläufe | `src/components/theme/index.ts` |
| Aktiver Theme-Modus und persistierte Auswahl | `src/components/theme/ThemeProvider.tsx` |
| Semantische UI-Primitiven, Typografie, Flächen und gemeinsame Zustände | `src/constants/ui.tsx` |

`index.ts`, `ThemeProvider.tsx` und `ui.tsx` regeln zusammen jede
projektweite Designentscheidung. Feature-Code importiert keine eigene Palette
und baut keine zweite Typografie- oder Zustands-API. Wenn ein semantischer Wert
fehlt, wird zuerst geprüft, ob er wirklich projektweit wiederkehrt. Erst dann
wird genau eine der drei zentralen Quellen erweitert.

### Implementierungs- und Verbraucherorte

| Ort | Rolle |
| --- | --- |
| `src/components/ui/` | Wendet die zentralen Definitionen an und ergänzt Verhalten oder Komposition |
| `src/components/layout/` | Screen-Gerüste und lokales Layout |
| `src/features/<domain>/components/` | Fachliche Komposition ohne eigene Designquelle |
| `tailwind.config.js`, `src/global.css` | Technischer NativeWind-Einstieg und bestehender Migrationsbestand |

## 2. Visuelle Sprache

fam ist warm, ruhig und informationsdicht:

- Mauve ist die Marken- und Aktionsfarbe.
- Creme und warme, leicht getönte Flächen bilden die Grundstruktur.
- Inhalte und Aufgaben stehen vor dekorativer Oberfläche.
- Karten gruppieren zusammengehörige Inhalte, nicht jeden einzelnen Textblock.
- Pillen werden für Auswahl, Filter oder Status verwendet, nicht als allgemeine
  Dekoration.
- Primärtext bleibt kontrastreich. Sekundärtext ist zurückhaltend, aber lesbar.
- Statusfarben werden immer zusätzlich durch Text, Symbol oder Form erklärt.
- Dauerhaft neu zeichnende Animationen wie Pulse, Shimmer und Blur-Loops werden
  vermieden.
- Kopie bleibt kurz. Keine Em-Dashes in sichtbaren App-Texten.

## 3. Theme und Farben

### Theme-Modi

Der `ThemeProvider` unterstützt:

- `system`: folgt dem Betriebssystem
- `light`: erzwingt das helle Theme
- `dark`: erzwingt das dunkle Theme

Die Auswahl wird im Geräte-KV-Store unter `srf:settings-theme` gespeichert.
Komponenten lesen den aufgelösten Modus und die Palette über `useTheme()`.

```tsx
const { mode, colors, accent, setPref } = useTheme();
```

Weitere Varianten wie `light1` oder `dark1` sind aktuell kein Teil des
Theme-Vertrags.

### Kanonische Farbrollen

| Token | Light | Dark | Verwendung |
| --- | --- | --- | --- |
| `background` | `#F8F4EF` | `#211D23` | Screen-Grundfläche |
| `backgroundElement` | `#FBF7F2` | `#2B262E` | Karten, Listenzeilen, Eingaben |
| `backgroundSoft` | `#E9E1E7` | `#382F3B` | Dezente Hintergründe, Tracks und inaktive Controls |
| `text` | `#2D2830` | `#F2ECE7` | Primärtext und Standardicons |
| `textSecondary` | `#786F79` | `#B7ADB3` | Sekundärtext |
| `border` | `#E4DDE3` | `#3E3640` | Trennlinien und Konturen |
| `accent` | `#705773` | `#B79CBA` | Primäraktionen und aktive Zustände |
| `onAccent` | `#FFFFFF` | `#211D23` | Inhalt auf Akzentflächen |
| `success` | `#78906F` | `#8FAE86` | Erfolg |
| `warning` | `#C69059` | `#D9A86C` | Warnung |
| `danger` | `#C65F50` | `#D9776A` | Kritische und destruktive Aktion |
| `buttonPrimaryDepth` | `#5E4861` | `#5E4861` | Deckende Tiefe primärer Buttons |
| `buttonDangerDepth` | `#A94C40` | `#A94C40` | Deckende Tiefe gefährlicher Buttons |
| `buttonAccentDepth` | `#A87343` | `#A87343` | Deckende Tiefe von Akzentbuttons |
| `shadowCard` | `#594059` | `#594059` | Kartenschatten |
| `shadowSheet` | `#2A1F2C` | `#2A1F2C` | Sheets und stärkere Tiefe |

Premiumflächen verwenden ausschließlich die
`premiumGradient*`-, `premiumOnSurface`- und `premiumAction*`-Tokens.

Die kürzeren Aliasnamen wie `bg`, `surface`, `basil` oder `grape` sind interner
Migrationsbestand. Neuer Feature-Code verwendet für normale UI keine Palette
direkt, sondern die semantischen Primitiven und Styles aus
`src/constants/ui.tsx`. Direkter Palettenzugriff bleibt datengetriebenen Farben
und nativen Integrationsgrenzen vorbehalten. `legacyWaivyColors` ist nur eine
Referenz und keine Produktionspalette.

### Transparente und dynamische Farben

Muss eine Themefarbe transparent dargestellt werden, wird `withAlpha()`
verwendet:

```tsx
backgroundColor: withAlpha(colors.shadowSheet, 0.45)
```

Existiert bereits ein passender transparenter Theme-Token wie `scrim`, wird
dieser direkt verwendet.

Farben, die erst zur Laufzeit aus Daten oder Benutzereinstellungen entstehen,
werden über einen typisierten `color`-Prop oder `style` gesetzt. Dynamisch
zusammengesetzte NativeWind-Klassen werden nicht verwendet.

## 4. Layout-, Radius- und Schattentokens

| Export | Zweck |
| --- | --- |
| `space` | Responsive Abstände von `xs` bis `xxxl` |
| `radius` | Radien von `sm` bis `xxl` sowie `pill` |
| `font` | Responsive Schriftgrößen, Zeilenhöhen und Gewichte |
| `Fonts` | Plattformgerechte Sans-, Serif-, Rounded- und Mono-Familien |
| `shadow` | `sm`, `md`, `lg` |
| `BUTTON_DEPTH` | 4pt sichtbare Tiefe und 4pt Druckweg gefüllter 3D-Buttons |
| `CONTENT_MAX_WIDTH` | Maximale Inhaltsbreite von 600pt |
| `Gradients.hub` | Light- und Dark-Verlauf für Hauptbereiche |

Abstände und Schriftmaße skalieren leicht mit der Gerätebreite und werden auf
großen Geräten begrenzt. Deshalb werden die Exporte verwendet und keine zweite
Pixel-Skala im Feature angelegt.

## 5. NativeWind und StyleSheet

fam verwendet eine Hybridlösung. Beide Werkzeuge haben eine klar getrennte
Aufgabe.

| Aufgabe | Werkzeug |
| --- | --- |
| Einfaches statisches Layout: Flex, Ausrichtung, Gap, Padding, Margin, Position und feste Layoutgrößen | NativeWind `className` |
| Aufgelöste aktive Palette | `ThemeProvider.tsx` und `useTheme()` |
| Semantische Typografie, Farben, Flächen, Konturen, Schatten und Zustandsstyles | `src/constants/ui.tsx` |
| Berechnete Werte, native Grenzen und nicht semantisches lokales Layout | lokales `style` oder StyleSheet |
| `expo-image`, FlashList, Bottom Sheets, SVG und native Spezialkomponenten | deren native `style`-API mit zentralen Tokens und Rezepten |
| Standardtext | `Txt` |
| Standardflächen | `Surface` oder `Card` |

Beispiel für die Aufgabenteilung:

```tsx
<Surface
  tone="soft"
  className="flex-row items-center"
  style={{ gap: space.md }}
/>
```

Regeln:

- `className` übernimmt ausschließlich einfaches statisches Layout.
- Neue semantische Farb-, Text-, Hintergrund-, Kontur-, Schatten- oder
  Zustandsklassen werden nicht mit NativeWind gebaut.
- Eine semantische Komponente wendet die in `src/constants/ui.tsx` definierten
  Farben, Typografierezepte und Zustandsstyles an. Sie besitzt nur Verhalten,
  Komposition und lokales Layout.
- Ein Caller-`style` ist der letzte, bewusste Override.
- `!text-*` und andere Important-Utilities sind keine Lösung für
  Spezifitätsprobleme.
- Eine Custom Component darf `className` nur anbieten, wenn sie den Prop
  zuverlässig an ein kompatibles Core-Primitive weiterreicht.
- FlashList verwendet kein `className` oder
  `contentContainerClassName`.
- Normale Typografie wird nicht über lokale
  `style={{ fontSize, lineHeight }}`-Objekte definiert.
- `global.css` und `tailwind.config.js` sind keine Design-System-Quellen. Dort
  werden keine neuen Komponentenklassen, Farbpaletten, Typografieskalen oder
  semantischen Zustände ergänzt.
- Es gibt keine zusätzliche NativeWind-`vars()`-Bridge. Light, Dark und System
  werden ausschließlich im `ThemeProvider` aufgelöst.

## 6. Typografie mit `Txt`

`Txt` ist die Standardkomponente für sichtbaren Text. Die öffentliche API ist
bewusst so klein wie bei Waivy. Jede Variante setzt Schriftgröße, sichere
Zeilenhöhe, Gewicht und Standardton gemeinsam.

```tsx
<Txt variant="title">Vorrat</Txt>
<Txt variant="body" tone="secondary">Für alle im Haushalt sichtbar</Txt>
<Txt variant="label" tone="danger">Läuft heute ab</Txt>
```

### Varianten nach Aufgabe

| Aufgabe | Varianten |
| --- | --- |
| Große Hierarchie | `display`, `title`, `heading`, `subheading` |
| Fließtext | `body` |
| Beschriftungen | `label` |
| Metadaten und kleine Hinweise | `caption` |

Bedienelemente erzeugen keine zusätzlichen öffentlichen Textvarianten. Ihre
komponentenspezifischen Typografierezepte werden in `src/constants/ui.tsx`
definiert und von der Implementierung intern ausgewählt. Komponenten definieren
keine lokalen Schriftgrößen direkt aus `font.sizes`. Ein `ScreenHeader`
verwendet wie Waivy `title` für den Titel und `label` für den Untertitel. Links
verwenden `label` mit `tone="accent"`.

### Töne

`tone` akzeptiert `primary`, `secondary`, `accent`, `onAccent`,
`success`, `warning`, `danger` und `inverse`.

`weight` wird nur verwendet, wenn dieselbe Textrolle in diesem Kontext eine
bewusst andere Betonung braucht. `color` ist Laufzeit- und
Integrationsfällen vorbehalten. `className` dient am `Txt` primär dem
Layout, etwa `flex-1`, `mt-two` oder `shrink`.

Wenn eine Komponente verschiedene Größen anbietet, wählt sie intern ein in
`src/constants/ui.tsx` definiertes Typografierezept. Screens und Komponenten
erfinden dafür keine neue `Txt`-Variante und setzen keine lokalen Schriftgrößen.

## 7. Screen-Gerüst

`Screen` aus `src/components/layout/screen.tsx` liefert:

- Theme-Hintergrund über `Surface tone="page"`
- Safe Area
- zentrierte Inhaltsbreite bis `CONTENT_MAX_WIDTH`
- optionalen Verlauf
- optionales Scrollen und Pull-to-Refresh
- Tastaturanpassung
- unteren Freiraum für Home-Indikator, Tabbar und Floating Action Button

### Header-Modi

| Modus | Verwendung | Darstellung |
| --- | --- | --- |
| `chrome` | Hauptbereiche | Menü links, Titel mittig, optionale Aktion und Profil rechts |
| `back` | Unterseiten | Zurücknavigation plus normaler Seitentitel |
| weder noch | Einfache oder selbst gerenderte Ansicht | normaler Titel, falls `title` gesetzt ist |
| `ScreenHeader` | Manueller Header in einem titellosen `Screen` | optionaler Pfeil, Titel, Untertitel und rechter Slot |

`chrome` und `back` werden nicht kombiniert. Wenn `chrome` gesetzt ist,
hat es Vorrang; der separate `back`-Bereich und `action` werden nicht
gerendert. Eine Aktion im Hauptheader gehört in `chrome.trailing`.

```tsx
<Screen
  title="Vorrat"
  subtitle="Gemeinsamer Haushalt"
  chrome={{
    onMenuPress: openDrawer,
    onAvatarPress: openProfile,
    initials,
    avatarUrl,
    trailing: <CalendarButton />,
  }}>
  {content}
</Screen>
```

Bei `back={{ label, href }}` wird zuerst die echte Navigationshistorie
verwendet. Nur wenn kein Zurückschritt möglich ist, dient `href` als
Ausweichziel. Ohne `href` wird der Zurückbutton nur angezeigt, wenn der
Navigator tatsächlich zurückgehen kann.

```tsx
<Screen
  title="Produktsuche"
  back={{ label: 'Einstellungen', href: '/settings' }}
  backStyle="icon">
  {content}
</Screen>
```

`ScreenHeader back` ruft direkt `router.back()` auf und hat kein
Ausweichziel. Für reguläre geroutete Unterseiten ist deshalb der
`Screen back`-Prop vorzuziehen.

### Wichtige Props

| Prop | Zweck |
| --- | --- |
| `title`, `subtitle` | Header-Inhalt; `title` ist optional |
| `chrome` | Hauptbereich-Header |
| `back`, `backStyle` | Rücknavigation als Text oder Icon |
| `action` | Aktion im normalen Titelheader |
| `backgroundGradient` | Verlauf hinter dem Screen |
| `scroll` | Interner ScrollView, Standard `true` |
| `padded` | Horizontale Inhaltsauffüllung |
| `refreshing`, `onRefresh` | Pull-to-Refresh |
| `contentStyle` | Typisierter letzter Layout-Override |
| `applyBottomPadding` | Unteren Safe-Area- und Aktionsabstand aktivieren |

Screens mit FlashList oder einem eigenen ScrollView verwenden
`scroll={false}`. Verschachtelte virtualisierte Listen werden vermieden.

## 8. Komponenten

### Feature-facing Imports

| Komponente | Import | Zweck |
| --- | --- | --- |
| `Screen`, `ScreenHeader` | `@/components/layout/screen` | Screen-Rahmen |
| `PageHeader` | `@/components/layout/page-header` | Kompakter manueller Hauptheader |
| `HubScreen` | `@/components/layout/hub-screen` | Bestehender Hub-Rahmen mit Verlauf |
| `Txt`, `Surface`, `Row`, `Divider`, `Spacer` | `@/constants/ui` | Kernprimitiven |
| `Button`, `BackButton`, `HeaderIconButton`, `MenuButton`, `ProfileButton`, `FloatingActionButton` | `@/components/ui/buttons` | Projektweite Aktionen |
| `Card` | `@/components/ui/card` | Gruppierte Inhaltsfläche |
| `EmptyState` | `@/components/ui/empty-state` | Leerer Zustand mit nächstem Schritt |
| `ProgressBar`, `ProgressRing` | `@/components/ui/` | Fortschritt |
| `SegmentedControl` | `@/components/ui/segmented-control` | Kleine exklusive Auswahl |
| `FamIcon` | `@/components/icons/fam-icon` | Fam-Icon-System |

Für normale Feature-CTAs wird der `Button` aus
`@/components/ui/buttons` verwendet. Gefüllte Varianten
`primary`, `danger` und `accent` besitzen eine deckende 4pt-Tiefenebene aus
dem Theme. Beim Drücken bewegt sich ihre Vorderseite in 60ms um genau
`BUTTON_DEPTH` nach unten und federt beim Loslassen zurück. Zusätzliche
Farb-Overlays oder zeitgesteuerte Press-Sequenzen gibt es nicht.
`secondary`, `ghost` und `link` sind flach.
Ein beliebiger lokaler `Pressable` ist kein Ersatz für einen Standardbutton.

Die ähnlich benannten Low-Level-Exporte in `src/constants/ui.tsx` werden
nicht mit den feature-facing Komponenten innerhalb eines Screens gemischt.

## 9. Zustände und Barrierefreiheit

Jede interaktive Komponente berücksichtigt:

- normales, gedrücktes und deaktiviertes Verhalten
- Loading ohne Doppel-Submit
- mindestens 44pt große Touch-Ziele bei regulären Aktionen
- `accessibilityRole` und ein verständliches `accessibilityLabel`
- `accessibilityState` für disabled, busy und selected
- ausreichenden Kontrast in Light und Dark
- Haptik nur bei tatsächlich erlaubter Aktion
- ein logisches Gegenstück für umkehrbare Aktionen

Farbe allein darf keinen ausgewählten, kritischen oder erfolgreichen Zustand
kommunizieren.

## 10. Vorgehen für neue UI

1. Passenden `Screen`- und Header-Modus wählen.
2. Vorhandene Komponenten aus Abschnitt 8 zusammensetzen.
3. Textrolle und Ton über `Txt` ausdrücken.
4. Nur einfaches statisches Layout mit NativeWind setzen.
5. Semantische Farben und Zustände über die Primitiven und Styles aus
   `src/constants/ui.tsx` ausdrücken. `useTheme()` und lokale Styles nur für
   datengetriebene Werte und native Grenzen verwenden.
6. Fehlende Tokens in `theme/index.ts`, Theme-Auflösung in
   `ThemeProvider.tsx` und fehlende semantische Primitiven, Typografie-, Farb-
   oder Zustandsrezepte in `ui.tsx` ergänzen.
7. Light, Dark, kleine Displays, große Schrift und Interaktionszustände
   prüfen.
8. Bei vorhandener `.android.tsx`-Datei beide Plattformkopien synchron
   überarbeiten.

## 11. Bekannte Grenzen

- Der öffentliche Theme-Modus umfasst derzeit nur `system`, `light` und
  `dark`.
- Bestehende semantische Farb- und Komponentenklassen in `global.css` sind
  Migrationsbestand. Neue Screens verwenden sie nicht.
- Nicht jede Drittanbieterkomponente unterstützt NativeWind-`className`.
- Bestehende Screens können noch lokale Spezialklassen enthalten. Neue
  Abweichungen werden nicht hinzugefügt; verbindlich sind die Verträge unter
  `docs/design-system/contracts/`.

## Historische Implementierungsspezifikation

- [NativeWind-Styling-Spezifikation](../specs/nativewind-styling/SPEC.md)
- [Token-Vertrag](../specs/nativewind-styling/SPEC-token-contract.md)
- [Typografie-Vertrag](../specs/nativewind-styling/SPEC-typography-contract.md)
- [Komponenten-Vertrag](../specs/nativewind-styling/SPEC-component-contract.md)
- [Native Grenzen](../specs/nativewind-styling/SPEC-native-boundaries.md)
