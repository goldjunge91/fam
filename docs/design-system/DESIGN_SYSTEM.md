# Design-System (fam)

Dieses Dokument ist die Arbeitsreferenz für neue und überarbeitete Oberflächen
der fam-App. Es beschreibt den aktuellen Soll-Zustand: welche Bausteine
verwendet werden, wem Farben und Typografie gehören und wo NativeWind endet.

Die technischen Detailverträge stehen unter
[`docs/specs/nativewind-styling/`](../specs/nativewind-styling/).

Die Verträge mit direkt vergleichbaren Umsetzungsbeispielen sind getrennt
unter [`docs/design-system/contracts/`](./contracts/) abgelegt. Ihre lebende
Darstellung ist in der App unter **Einstellungen → Entwickler →
Design-System-Referenz** erreichbar. Dort werden die echten Tokens und
Komponenten gerendert; die rot markierten Beispiele zeigen bewusst den
jeweiligen Vertragsbruch.

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
| Text-, Surface- und grundlegende UI-Primitiven | `src/constants/ui.tsx` |
| Projektweite Buttons und Navigationsaktionen | `src/components/ui/buttons/` |
| Screen-Gerüst und Safe Area | `src/components/layout/screen.tsx`, `screen.android.tsx` |
| NativeWind-Farbklassen und wiederverwendbare Klassen | `tailwind.config.js`, `src/global.css` |
| Domänenspezifische Komponenten | `src/features/<domain>/components/` |

Feature-Code importiert keine eigene Palette und baut keine zweite
Typografie-Skala. Wenn ein semantischer Wert fehlt, wird zuerst geprüft, ob er
wirklich projektweit wiederkehrt. Erst dann wird die zentrale Quelle erweitert.

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

Die kürzeren Aliasnamen wie `bg`, `surface`, `basil` oder `grape`
existieren für interne Primitive und kompatible Aufrufer. Neuer
Feature-Code bevorzugt die kanonischen semantischen Namen, wenn ein direktes
Gegenstück vorhanden ist. `legacyWaivyColors` ist nur eine Referenz und keine
Produktionspalette.

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
| Statisches Flex-Layout, Positionierung, Gap und Padding | NativeWind `className` |
| Wiederkehrende statische Klassen aus `global.css` | NativeWind |
| Theme-Farben zur Laufzeit | `useTheme()` und `style` |
| Wiederverwendbare dynamische Styles | `useThemedStyles()` mit `StyleSheet.create()` |
| Schattenobjekte, berechnete Maße und Safe-Area-Werte | `style` oder StyleSheet |
| `expo-image`, FlashList, Bottom Sheets, SVG und native Spezialkomponenten | deren native `style`-API |
| Standardtext | `Txt` |
| Standardflächen | `Surface` oder `Card` |

Beispiel für einen themeabhängigen Style:

```tsx
function makeStyles(colors: Palette) {
  return StyleSheet.create({
    input: {
      backgroundColor: colors.backgroundElement,
      borderColor: colors.border,
      color: colors.text,
    },
  });
}

function SearchField() {
  const styles = useThemedStyles(makeStyles);
  return <TextInput className="px-four py-three" style={styles.input} />;
}
```

Regeln:

- `className` übernimmt bevorzugt das statische Layout.
- Eine semantische Komponente besitzt ihre eigenen Farben, Typografie und
  Zustände.
- Ein Caller-`style` ist der letzte, bewusste Override.
- `!text-*` und andere Important-Utilities sind keine Lösung für
  Spezifitätsprobleme.
- Eine Custom Component darf `className` nur anbieten, wenn sie den Prop
  zuverlässig an ein kompatibles Core-Primitive weiterreicht.
- FlashList verwendet kein `className` oder
  `contentContainerClassName`.
- Normale Typografie wird nicht über lokale
  `style={{ fontSize, lineHeight }}`-Objekte definiert.

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

Bedienelemente erzeugen keine zusätzlichen öffentlichen Textvarianten. Ein
`Button`, `QuantityStepper`, `ProgressRing` oder Eingabefeld besitzt seine
Schriftgröße intern. Ein `ScreenHeader` verwendet wie Waivy `title` für den
Titel und `label` für den Untertitel. Links verwenden `label` mit
`tone="accent"`.

### Töne

`tone` akzeptiert `primary`, `secondary`, `accent`, `onAccent`,
`success`, `warning`, `danger` und `inverse`.

`weight` wird nur verwendet, wenn dieselbe Textrolle in diesem Kontext eine
bewusst andere Betonung braucht. `color` ist Laufzeit- und
Integrationsfällen vorbehalten. `className` dient am `Txt` primär dem
Layout, etwa `flex-1`, `mt-two` oder `shrink`.

Wenn eine Komponente verschiedene Größen anbietet, löst sie diese intern über
die kleine `font.sizes`-Skala auf. Screens erfinden dafür keine neue
`Txt`-Variante und setzen keine lokalen Schriftgrößen.

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
4. Statisches Layout mit NativeWind setzen.
5. Dynamische Farben und native Grenzen über Theme und StyleSheet lösen.
6. Fehlende, wiederkehrende Werte als semantischen Token oder Primitive
   ergänzen.
7. Light, Dark, kleine Displays, große Schrift und Interaktionszustände
   prüfen.
8. Bei vorhandener `.android.tsx`-Datei beide Plattformkopien synchron
   überarbeiten.

## 11. Bekannte Grenzen

- Der öffentliche Theme-Modus umfasst derzeit nur `system`, `light` und
  `dark`.
- Die CSS-Farbvariablen in `global.css` folgen dem System-Farbschema.
  Komponenten, die eine explizit erzwungene Theme-Auswahl sicher abbilden
  müssen, beziehen ihre Farben deshalb über `useTheme()`.
- Nicht jede Drittanbieterkomponente unterstützt NativeWind-`className`.
- Bestehende Screens können noch lokale Spezialklassen enthalten. Neue
  Abweichungen werden nicht hinzugefügt; verbindlich sind die Regeln dieses
  Dokuments und die NativeWind-Spezifikation.

## Technische Vertiefung

- [NativeWind-Styling-Spezifikation](../specs/nativewind-styling/SPEC.md)
- [Token-Vertrag](../specs/nativewind-styling/SPEC-token-contract.md)
- [Typografie-Vertrag](../specs/nativewind-styling/SPEC-typography-contract.md)
- [Komponenten-Vertrag](../specs/nativewind-styling/SPEC-component-contract.md)
- [Native Grenzen](../specs/nativewind-styling/SPEC-native-boundaries.md)
