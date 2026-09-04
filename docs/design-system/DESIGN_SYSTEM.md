# Design-System (fam)

> Arbeitsstandard, Stand 2026-08-16 — entstanden aus Issue [#122](https://github.com/goldjunge91/fam/issues/122).
> Abgeleitet **top-down** aus den Screens, die bereits als Referenz gelten:
> Übersicht (`dashboard-screen.tsx`), Vorrat (`fridge-screen.tsx`), Essensplan
> (`meal-planner-screen.tsx`) und größtenteils Rezept-Detail
> (`recipe-detail-screen.tsx`). Token-Grundlage und Radius-Migration sind
> abgeschlossen; die übrigen Backlog-Punkte sind unten dokumentiert.

Quelle der Wahrheit ist der **Code**, nicht Figma. Das Figma-File
["fam – App-Mockup"](https://www.figma.com/design/6RkH2npU7OF3B62Fa9SvoY/fam-–-App-Mockup)
war Ausgangsinspiration und liefert Icon-/Illustrations-Assets
(`src/assets/images/figma/*.svg`, siehe `FamIcon`), ist aber keine Pflicht-
Referenz mehr, gegen die jede Pixelabweichung ein Bug wäre.

**Aktueller Styling-Vertrag (2026-09-04):** Für NativeWind, Theme-Tokens,
Typografie und die Hybridgrenze gilt verbindlich
[`docs/specs/nativewind-styling/`](../specs/nativewind-styling/). Dort ist
`src/components/theme/index.ts` die aktive Tokenquelle und `src/constants/ui.tsx`
stellt `Txt` und `Surface` bereit. Die untenstehenden `ThemedText`-/`theme.ts`-
Verweise dokumentieren den historischen Stand dieser Datei und sind keine
zusätzliche aktive Theme- oder UI-API. Die alten Wrapper wurden nach der
manuellen Maintainer-Freigabe entfernt.

**Aktive Drawer-Navigation (2026-09-04):** Beim Öffnen des Navigationsdrawers
wird der aktuell angezeigte Bereich aus `usePathname()` bestimmt. Der
öffentliche Pfad wird vor dem Vergleich von Expo-Route-Gruppen wie `/(app)`
bereinigt. Aktiv sind nur ein exakter Pfad oder ein echter Unterpfad, nicht
ein beliebiger String-Präfix. Die aktive Zeile verwendet die semantische
Fam-Auswahlfläche, eine stärkere Textdarstellung, die Theme-Akzentfarbe am
Icon und den Accessibility-Zustand `selected`. Das gilt für die gemeinsame
und die Android-Drawer-Variante sowie für `Einstellungen` auf allen
`/settings`-Unterseiten.

---

## 1. Grundprinzipien

- **Ein Screen, ein `<Screen>`.** Jeder Bildschirm baut auf der gemeinsamen
  Gerüst-Komponente (`src/components/screen.tsx`) auf — Safe Area, Titelzeile
  bzw. Hub-Chrome, `MaxContentWidth`, Bottom-Padding. Kein Screen baut Safe
  Area / Gradient-Hintergrund / Breitenbegrenzung von Hand nach (siehe
  [Abschnitt 6](#6-bekannte-abweichungen--migrations-backlog)).
- **Tokens statt Zahlen.** Farben kommen aus `Colors`/`useTheme()`,
  Schriftgrößen aus `FontSize`/`Typography`, Abstände aus `Spacing`. Ein
  frei erfundener Hex-Code oder Pixel-Wert im Screen-Code ist ein Zeichen,
  dass ein Token fehlt — dann wird der Token ergänzt, nicht der Wert
  dupliziert.
- **Informationsdicht, kein Deko-Ballast.** Kein Pulse/Shimmer/Blur-Dauerloop
  (GPU-Last), keine Pillen/Karten nur zur Optik ohne Inhalt.
- **Farbe nie als einziger Träger einer Information.** MHD-Ampel,
  Makro-Balken, Zielüberschreitung — immer Text/Symbol zusätzlich zur Farbe
  (bestehende Praxis in `MacroBar`, `ProgressRing`, `expiry.ts`).
- **Override-Klausel gilt weiter:** Diese Doku sind gute Standardwerte, keine
  Dogmatik. Explizite Anweisung im Prompt schlägt die Doku.

**Korrektur gegenüber `AGENTS.md` — erledigt (2026-08-16).** Der "True
Black"-Pillar war bereits entfernt; die zwei verbliebenen Einzelerwähnungen
(`## Visual and design work` und `## Taste & Architectural Rules of Thumb`)
sind jetzt ebenfalls auf die tatsächliche Mauve-/Creme-Palette korrigiert.
`AGENTS.md` widerspricht der Palette aus Abschnitt 2 nicht mehr.

---

## 2. Tokens (`src/constants/theme.ts`, `src/components/themed-text.tsx`)

### Farben (`Colors.light` / `Colors.dark`)

| Token | Zweck |
| --- | --- |
| `text` / `textSecondary` | Primär-/Sekundärtext |
| `background` | Screen-Grundfläche |
| `backgroundElement` | Karten, Listenzeilen, Flächen über dem Hintergrund |
| `backgroundSelected` | aktiver Zustand (Segmented Control, Tab) |
| `border` | Trennlinien, Outlines |
| `accent` | Primärfarbe für CTAs, aktive Icons, Links |
| `success` / `warning` / `danger` | Statusfarben (MHD-Ampel, Zielüberschreitung) |

Zugriff ausschließlich über `useTheme()` (liest `useColorScheme()`, fällt auf
`light` zurück) — nie `Colors.light.xyz` fest verdrahtet in einer Komponente,
die auch im Dark Mode läuft.

**Schattenfarben — erledigt (2026-08-16).** `Colors.light`/`Colors.dark`
haben jetzt `shadowCard` (`#594059`) und `shadowSheet` (`#2A1F2C`), aus dem
Mittelwert der beiden im Audit gefundenen Cluster, plus einen `withAlpha(hex,
alpha)`-Helper für `boxShadow`-Strings. Alle 15 Fundstellen sind migriert.
`premium-promo-card.tsx` und `navigation-drawer.tsx` sind vollständig an
`useTheme()` angebunden; ihre Hintergründe, Verläufe, Textfarben, Linien und
Schatten enthalten keine lokalen Farbwerte mehr. Details:
[`docs/design-system/gradient-background-audit.md`](./design-system/gradient-background-audit.md).

**Gradient-Hintergrund — erledigt (2026-08-16).** `Gradients.hub` hält die
Light- und Dark-Farben sowie gemeinsame Stop-Positionen des Hub-Verlaufs
zentral. `useHubGradient()` wählt die zum Farbschema passende Variante für
alle regulären Verbraucher. Der Essensplaner bleibt vorerst auf
`Gradients.hub.light`.
**Noch offen:** die 10 Screens, die
`<GradientBackground>` weiterhin manuell statt über `Screen`s
`backgroundGradient`-Prop einbinden, bauen ihre Struktur (Safe Area,
`PageHeader`, Breite) unverändert selbst nach — das ist bewusst nicht Teil
dieser Migration, siehe Migrations-Backlog Punkt 1.

### Typografie (`FontSize`, `Typography`, `ThemedText`)

- `FontSize[N]` — einzige Quelle für rohe `fontSize`-Werte (7–52).
- `Typography.*` — semantische Kombinationen aus `FontSize` + `lineHeight`
  (`micro`, `caption`, `label`, `body`, `bodyLarge`, `title`, `display`, …).
- **`ThemedText`s `type`-Prop deckt seit 2026-08-16 die volle
  `Typography`-Skala automatisch ab** (`type="label"`, `type="bodyLarge"`,
  …) — ein neuer `Typography`-Eintrag steht ohne weitere Änderung als
  `type`-Wert bereit. Screens spreaden `Typography.*` dadurch nicht mehr
  selbst in ein `style`-Objekt (früherer Zustand, z. B.
  `...FontSize[13], lineHeight: 18, fontWeight: '400'` im Dashboard, ist
  Migrationsziel — bestehende Screens sind noch nicht umgezogen).
- Daneben gibt es weiterhin **benannte Text-Rollen** (`default`, `title`,
  `small`, `smallBold`, `subtitle`, `link`, `linkPrimary`, `code`) — feste
  Kombinationen aus Größe **und** Gewicht mit eigener Bedeutung, in
  `themed-text.tsx` als `TEXT_ROLE_STYLES`/`TextRole` benannt (nicht
  "Legacy" — sie sind kein Rückwärtskompatibilitäts-Relikt, sondern der
  bewusste zweite, funktional andere Weg, Text zu stylen: eine feste Rolle
  statt einer reinen Größe).

**Warum `fontWeight` nicht Teil des `Typography`-Mappings ist:** Größe und
Gewicht sind zwei unabhängige Achsen. Dieselbe Größe (`label`, 13px)
kommt in den Referenz-Screens mit Gewicht 400 (Dashboard-Kalorienlabel) und
mit Gewicht 600 (PageHeader-Untertitel) vor — beide sind `label`-groß, aber
unterschiedlich betont. Würde jede Größe ein festes Gewicht bekommen,
bräuchte es für jede Kombination einen eigenen Namen (`label`, `labelBold`,
`caption`, `captionBold`, …) — eine Vervielfachung der Varianten für etwas,
das ein simples `style={{ fontWeight: '600' }}`-Override neben `type`
bereits abdeckt (React Native mergt Style-Arrays, der letzte Eintrag
gewinnt). Die benannten Rollen oben sind die Ausnahme: dort *ist* das
Gewicht Teil der Bedeutung des Namens (`smallBold` ist nicht "irgendein
`small` mit beliebigem Gewicht", sondern definiert 700 mit).

**Namenskollision `title`/`link`/`code` — Beispiel:** `Typography.title`
ist ein reiner Größen-Token (32px/44 Zeilenhöhe, kein Gewicht). Die
Text-Rolle `type="title"` bedeutet aber seit Langem etwas anderes: "große
Überschrift" = `display`-Größe (48px/52) + Gewicht 600 — beide heißen
zufällig `title`. Da ein `type`-String zur Laufzeit nur eine Bedeutung
haben kann, gewinnt die etablierte Rolle (nichts an bestehenden
`type="title"`-Stellen ändert sich), und der rohe `Typography.title`-Wert
ist über `type` schlicht nicht erreichbar:

```tsx
<ThemedText type="title">Guten Morgen</ThemedText>
// → display-Größe (48/52) + Gewicht 600, wie immer

<ThemedText style={Typography.title}>123,45 €</ThemedText>
// → der eigentliche Typography.title-Wert (32/44, kein festes Gewicht):
//   nur per direktem Import + style-Prop erreichbar, nicht über `type`
```

Praktisch betrifft das nur `title`: `link` und `code` als Rolle liefern
ohnehin exakt `Typography.link`/`Typography.code` — kein Unterschied, nur
`title` (Rolle) und `Typography.title` (Rohgröße) sind zwei verschiedene
Werte hinter demselben Namen.

### Abstände & Maße

- `Spacing.half` … `Spacing.six` (2–64px) für Paddings/Gaps.
- `ControlSize.compactHeight` (34px) für kompakte Controls.
- `MaxContentWidth` (800px) — Pflicht für jeden Screen-Root, damit die App
  auf breiten/Web-Viewports nicht auseinanderläuft.
- **`Radius`-Token — umgesetzt (2026-08-16).** App-weiter Audit zeigte 34
  verschiedene `borderRadius`-Werte; ein zweiter Durchgang hat eng
  benachbarte, vermutlich nur durch Abtipp-Drift entstandene Werte
  zusammengeführt und kommt auf **8 konsolidierte Werte**
  (`2 · 4 · 8 · 12 · 14 · 16 · 20 · 28`) — deckt sich auffällig gut mit
  Material Design 3s Shape-Scale (`4/8/12/16/28` ist eine Teilmenge davon).
  `Radius.hairline/xs/sm/control/controlLarge/card/sheet/large/pill` stehen
  jetzt in `src/constants/theme.ts`, nach Komponenten-Rolle statt reiner
  Größenskala. Details in
  [`docs/design-system/radius-audit.md`](./design-system/radius-audit.md).
  **Aktueller Stand:** 228 von 233 Fundstellen verwenden `Radius.*`. Vier
  dynamische Radien bleiben bewusst berechnet. Der 40px-Hintergrund von
  `AnimatedIcon` bleibt als einzelne Illustrations-Ausnahme lokal, da weder
  `Radius.large` noch `Radius.pill` seine Form erhalten würden. Exakte
  Altwerte wurden semantisch zugeordnet; ungeklärte Zwischenwerte verwenden
  den nächstgrößeren Token. Die Dashboard-Karten und `SettingsGroup`
  verwenden damit `Radius.large` (28px).

---

## 3. Screen-Gerüst (`src/components/screen.tsx`)

Jeder Screen wird mit `<Screen>` gebaut. Zwei Header-Modi, die sich
gegenseitig ausschließen — `chrome` gesetzt bedeutet: `back` und `action`
werden ignoriert, selbst wenn sie zusätzlich übergeben würden:

- **Hub-Screens** (`chrome` gesetzt): Hamburger-Menü links, zentrierter
  Titel (+ optionaler Untertitel), Profil-Avatar rechts, kein Zurück-Button.
  Für die früher per Bottom-Tab erreichbaren Screens (Übersicht, Vorrat,
  Einkauf, Rezepte, Einstellungen).

  ```tsx
  const hubGradient = useHubGradient();

  <Screen
    title="Vorrat"
    subtitle="Für alle im Haushalt sichtbar"
    chrome={{ onMenuPress: openDrawer, onAvatarPress: openProfile, initials }}
    backgroundGradient={hubGradient}>
    {/* Inhalt */}
  </Screen>
  ```

- **Detail-Screens** (`back` gesetzt): Zurück-Ziel wird explizit benannt
  (`back={{ label: 'Rezepte', href: '/recipes' }}`), nie aus
  `router.canGoBack()` erraten (siehe Kommentar in `screen.tsx` — bewusste
  Entscheidung, kein Bug: ein einmal gelesener `canGoBack()`-Wert kann nach
  Navigationsänderungen veraltet sein und zu einem toten Button führen).
  Ohne `href` fällt der Button auf `router.back()` zurück
  (`AutoBackButton`), mit `href` navigiert er gezielt
  dorthin — unabhängig vom tatsächlichen Navigationsverlauf.

  ```tsx
  <Screen title="Rezept bearbeiten" back={{ label: 'Rezepte', href: '/recipes' }}>
    {/* Inhalt */}
  </Screen>
  ```

- **Weder `chrome` noch `back`**: einfacher Header ohne Zurück-Button, z. B.
  für einen Screen, der nur über einen expliziten Button erreichbar ist und
  keinen sinnvollen Rücksprung braucht (selten — im Zweifel `back` setzen).

**Alle Props im Detail:**

| Prop | Typ | Zweck |
| --- | --- | --- |
| `title` | `string` | Pflicht. Haupttitel, in beiden Header-Modi mittig bzw. linksbündig. |
| `subtitle` | `string?` | Kleiner Text über/unter dem Titel. |
| `chrome` | `{ onMenuPress, onAvatarPress, initials }?` | Hub-Header, s. o. Schließt `back`/`action` aus. |
| `back` | `{ label: string; href?: Href }?` | Detail-Header mit explizitem Rücksprungziel. `backStyle: 'text' \| 'icon'` steuert Text-Link ("‹ Rezepte") vs. runden Icon-Button. |
| `backgroundGradient` | `GradientSpec?` | Verlauf statt der flachen `background`-Fläche. Hub-Screens verwenden `Gradients.hub`; die 10 Screens, die `<GradientBackground>` manuell statt darüber aufrufen, sind Teil des strukturellen Migrations-Backlogs (Abschnitt 6). |
| `scroll` | `boolean` (Default `true`) | `false` für Screens mit eigenem `ScrollView`/`FlatList` im Inhalt (z. B. Dashboard, das selbst pull-to-refresh braucht). |
| `action` | `ReactNode?` | Kopfzeilen-Aktion **nur im Detail-Header** (`chrome` nicht gesetzt), rechts neben dem Titel. Für Hub-Header gibt es aktuell keinen äquivalenten Slot — siehe Migrations-Backlog Punkt 1 (fehlender `trailing`-Slot). |

---

## 4. Komponenten-Katalog

| Komponente | Zweck | Ort |
| --- | --- | --- |
| `Screen` | Pflicht-Gerüst jedes Screens | `src/components/screen.tsx` |
| `PageHeader` | Kompakter Header *innerhalb* eines Screens ohne `chrome` (z. B. für einen zweiten Header-Bereich) | `src/components/page-header.tsx` |
| `GradientBackground` | SVG-Flächenverlauf hinter Hub-Screens | `src/components/gradient-background.tsx` |
| `ThemedText` / `ThemedView` | Themed-Grundbausteine | `src/components/themed-text.tsx`, `themed-view.tsx` |
| `Card` | Fläche für zusammengehörige Inhalte, optional antippbar | `src/components/card.tsx` |
| `SectionHeading` | Abschnittszeile über Kartenrastern/horizontalen Listen | `src/components/section-heading.tsx` |
| `EmptyState` | Leerer Zustand mit SF-Symbol + Hinweis, nie ohne nächsten Schritt | `src/components/empty-state.tsx` |
| `ProgressRing` | Kreisförmiger Fortschritt (Kalorien, Tagesziele) mit 3 Anzeigemodi | `src/components/progress-ring.tsx` |
| `MacroBar` | Balken-Fortschritt je Makronährstoff | `src/components/macro-bar.tsx` |
| `SegmentedControl` | Umschalter (z. B. Tag/3-Tage/Woche) | `src/components/segmented-control.tsx` |
| `FamIcon` | Figma-SVG-Icon-Set (Nav, Profil, Illustrationen) | `src/components/fam-icon.tsx` |
| `NavigationDrawer` | Geöffnete Bereichsnavigation mit synchroner aktiver Route | `src/features/navigation/navigation-drawer.tsx` und `.android.tsx` |
| `Button` (+ Varianten in `ui/buttons/`) | s. [Abschnitt 6](#6-bekannte-abweichungen--migrations-backlog) — hier ist Konsolidierung nötig | `src/components/ui/buttons/` |

---

## 5. So baust du einen neuen Screen

1. **Route anlegen** unter `src/app/`, nur ein Re-Export — die eigentliche
   Implementierung liegt in `src/features/<domain>/<name>-screen.tsx`
   (Feature-First, siehe `docs/DEVELOPER_GUIDE.md`).
2. **`<Screen>` als Root.** Entscheide zuerst: Hub-Screen (`chrome`) oder
   Detail-Screen (`back`)? Nie beides, nie keins.
3. **Farbverlauf nur für Hub-Screens**, und dann immer über eine am
   Komponentenanfang gelesene `const hubGradient = useHubGradient()`-Variable
   (`backgroundGradient={hubGradient}`, Light-/Dark-Variante B aus dem
   [Gradient-Audit](./design-system/gradient-background-audit.md)).
   Alle anderen Screens bleiben bei der flachen `background`-Fläche.
4. **Inhalte aus dem Katalog zusammensetzen** (Abschnitt 4), bevor du eine
   neue Primitive baust. Fehlt etwas Wiederverwendbares, geht es nach
   `src/components/`, nicht als lokaler Screen-Baustein — es sei denn, es ist
   wirklich nur für dieses eine Feature relevant (`src/features/<domain>/
   components/`).
5. **Keine rohen Hex-Farben/Pixelwerte.** Bewusste, komponentenspezifische
   Sonderverläufe wie die innere Premium-Karte müssen im Audit dokumentiert
   sein und dürfen nicht mit `Gradients.hub` vermischt werden.
6. **Barrierefreiheit nicht vergessen:** `accessibilityRole`,
   `accessibilityLabel` an Pressables, Farbe nie alleiniger Informationsträger.
7. **Reverse-States mitdenken** (`AGENTS.md` §7): jede neue Aktion braucht
   ihr Gegenstück.

---

## 6. Bekannte Abweichungen / Migrations-Backlog

Konkrete Funde aus dem Abgleich der Referenz-Screens — das sind die
Kandidaten für die eigentliche "Bereinigen & Angleichen"-Arbeit, sobald die
Konventionen oben abgenommen sind.

**Reihenfolge (entschieden 2026-08-16):** erst 3 und 4, danach 2. Punkt 7 ist
bereits erledigt. Für Punkt 1 gilt ein eigenes Vorgehen (s. u.) statt fester
Einordnung in die Reihenfolge.

1. **`<Screen>` wird umgangen — breiter als gedacht.** Nicht nur
   `meal-planner-screen.tsx`: der [Gradient-Audit](./design-system/gradient-background-audit.md)
   zeigt, dass **10 von 12 Screens mit Verlaufs-Hintergrund** `<GradientBackground>`
   von Hand aufrufen und Safe Area/`PageHeader`/Breitenbegrenzung manuell
   nachbauen, statt `Screen`s `backgroundGradient`-Prop zu nutzen — nur
   Dashboard und Vorrat tun das bereits richtig. Beim Essensplaner kommt
   zusätzlich ein hart codiertes `maxWidth: 800` statt des
   `MaxContentWidth`-Imports dazu. Ursache u. a.: `Screen`s Hub-Chrome hat
   noch keinen `trailing`-Slot neben dem Avatar (der Essensplaner braucht
   den Kalender-Button dort) — das ist eine echte Lücke in `Screen` selbst,
   nicht nur ein Screen-Fehler. **Die Gradient-Farbe selbst ist bereits
   vereinheitlicht** (Variante B, s. Abschnitt 2) — hier geht es nur noch um
   die Struktur.

   App-weit verwenden aktuell 11 von 40 `*-screen.tsx`-Dateien direkt
   `<Screen>`. Nicht jede der übrigen Dateien ist automatisch ein einfacher
   Migrationskandidat (Modals und Spezialansichten brauchen eine eigene
   Prüfung), aber die Grundregel ist noch nicht flächendeckend umgesetzt.

   **Entscheidung (2026-08-17):** Der Essensplaner bleibt bei der
   Original-Struktur; die Vergleichs-Variante (`meal-planner-screen-v2.tsx`,
   Route `/meal-planner-v2`, Versionsumschalter) wurde entfernt, ohne
   Ergebnis für die strukturelle Migration der übrigen 9 Screens.
   `Screen` besitzt weiterhin den optionalen Hub-`trailing`-Slot
   (Kalender/Profil rechts im Header) für eine künftige Migration.
2. **Button-Konsolidierung — Rollenprüfung abgeschlossen.** Die früheren
   `back-arrow-button`/`back-icon-button` sind in `back-button` mit Varianten
   aufgegangen. Die sieben verbleibenden Komponenten haben eigenständige
   Rollen: Formularaktion, Navigation zurück, kompakte Header-Aktion,
   Navigation öffnen, Profil öffnen, aufklappbare Sheet-Aktion und globale
   schwebende Primäraktion. Größen, Inhalt und Zustände unterscheiden sich;
   eine weitere Zusammenlegung würde nur Varianten-Komplexität erzeugen.
3. **`Radius`-Token — Migration abgeschlossen.** `Radius.*` steht in
   `theme.ts` (34 → 8 konsolidierte Werte), 228 von 233 Fundstellen sind
   migriert. Die übrigen vier Radien sind größenabhängig berechnet; der
   40px-Hintergrund von `AnimatedIcon` ist eine dokumentierte lokale
   Illustrations-Ausnahme. Details stehen im
   [`Radius-Audit`](./design-system/radius-audit.md#aktueller-migrationsstand).
4. **Zwei Wege für Textstile — sichere Migration abgeschlossen.**
   `ThemedText`s `type`-Union deckt jetzt die volle `Typography`-Skala ab
   (s. Abschnitt 2). Alle redundanten `Typography.*`-Spreads auf
   `ThemedText` wurden durch passende `type`-Werte ersetzt. Aktueller Bestand:
   315 `FontSize[...]`-Spreads und 23 `Typography.*`-Spreads. Davon definieren
   acht intern die `ThemedText`-Rollen; die übrigen 15 stylen native
   `Text`-/`TextInput`-Controls und können nicht über `ThemedText.type` laufen.
5. **Dashboard-"Glass Cards" — Phase C erledigt (Stand 2026-08-17).**
   `src/components/glass-card.tsx` (`GlassCard`) rendert echtes Liquid Glass
   (`expo-glass-effect`) auf iOS 26+ für die Essensplan-Karte und die beiden
   Vorrat/Einkauf-Kacheln, sonst die bisherige solide Karte. Die
   Kalorien-Karte bleibt bewusst außen vor (Content-Fläche, kein
   Steuerelement, s. `docs/design-system/nativewind-liquid-glass-migration.md`
   Phase C für Details/Mock-Varianten). `GlassCard` ist trotzdem weiterhin
   **kein** app-weites Primitive — einziger Verbraucher ist das Dashboard;
   eine generischere API wird erst bei einem zweiten echten
   Screen-Anwendungsfall extrahiert (YAGNI).
6. **`recipe-detail-screen.tsx`s Inline-SVG — geprüft, kein Fund.** Der
   vermeintliche Inline-Fortschrittsring ist keiner: `HeroArtwork` baut eine
   dekorative Verlaufs-/Kreis-Illustration als Platzhalter, wenn ein Rezept
   kein Titelbild hat — ein anderer Zweck als `ProgressRing`, keine
   Dopplung. Erledigt, kein Handlungsbedarf.
7. **`AGENTS.md` Pillar 3 ("True Black") — erledigt** (s. Abschnitt 1).
8. **Schattenfarben und Theme-Anbindung — abgeschlossen.**
   `Colors.shadowCard`/`Colors.shadowSheet` plus `withAlpha()` decken alle 15
   Fundstellen ab. `premium-promo-card.tsx` und `navigation-drawer.tsx`
   verwenden vollständig `useTheme()`.

---

## 7. Umsetzungsstand

Die Token-Grundlage und Radius-Migration sind abgeschlossen. Offen bleibt die
schrittweise Migration bestehender Screens in den anderen Design-System-
Bereichen.

**Bereits umgesetzt (2026-08-16):**

- `Gradients.hub` ist die einzige Quelle für Light-/Dark-Farben und
  Stop-Positionen aller Hub-Gradient-Verwendungen. `useHubGradient()` bindet
  alle regulären Verbraucher ans aktuelle Farbschema; die zwei
  Essensplaner-Vergleichsansichten bleiben vorläufig explizit hell.
- Schatten-Tokens (`shadowCard`/`shadowSheet`) plus `withAlpha()`-Helper
  decken alle 15 Fundstellen ab; Premium-Promo und Drawer sind vollständig
  themefähig.
- `ThemedText` deckt die volle `Typography`-Skala ab.
- `Radius.*` steht final in `theme.ts` (8 konsolidierte Werte).
- 228 von 233 Radius-Fundstellen verwenden `Radius.*`; vier sind bewusst
  dynamisch und eine lokale Illustrations-Ausnahme bleibt bei 40px.
- Die drei früheren Zurück-Button-Implementierungen sind in einer Komponente
  mit Varianten konsolidiert.
- Die sieben verbleibenden Button-Komponenten sind als unterschiedliche
  Rollen bestätigt; es gibt keine weitere sinnvolle Zusammenlegung.
- Alle redundanten `Typography.*`-Spreads auf `ThemedText` sind migriert.
- Die Dashboard-Karten bleiben bis zu einem zweiten Screen-Anwendungsfall
  bewusst lokal.
- `AGENTS.md` widerspricht der Palette nirgends mehr.
- `recipe-detail-screen.tsx`s vermeintlicher Inline-Ring geprüft — kein
  Fund, war eine dekorative Illustration, keine Dopplung.

**Noch offen** (Backlog aus Abschnitt 6):

1. Essensplaner bleibt bei der Original-Struktur (V2-Vergleichsvariante
   entfernt, s. Abschnitt 6 Punkt 1). Die strukturelle Migration der 9
   verbleibenden Screens auf `Screen` steht weiterhin aus.
