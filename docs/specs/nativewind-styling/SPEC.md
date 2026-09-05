# Spec: NativeWind Styling Stabilisierung

## Status

Implementierungsvertrag. Die alten Wrapper wurden während der Migration als Übergang erhalten und nach ausdrücklicher Maintainer-Freigabe entfernt.

## Ziel

Die fam-App soll eine nachvollziehbare UI-Styling-Quelle für ihre React-Native-Oberflächen haben. Buttons, Hintergründe, Karten, Textgrößen und Textfarben müssen zuverlässig übernommen werden. Die Lösung kombiniert NativeWind für deklaratives Layout und einfache Utilities mit React-Native-StyleSheet für semantische, dynamische und plattformnahe Werte. Eine iOS-/Android-Geräteprüfung ist für diese Arbeit ausdrücklich außerhalb des Scopes.

## Nutzer- und Entwickleranforderungen

- Ein Button hat unabhängig von Aufrufer und Plattform eine definierte Variante, Größe, Textfarbe, Hintergrundfarbe und Zustandsdarstellung.
- Ein Text hat eine explizite semantische Rolle und eine deterministische Schriftgröße, Zeilenhöhe, Schriftstärke und Farbe.
- Ein Surface oder eine Card erhält seine Hintergrund- und Border-Farben aus dem aktiven Fam-Theme.
- Dark Mode wechselt alle semantischen Tokens gemeinsam. Einzelne Komponenten erfinden keine eigene Dark-Mode-Logik.
- Beim Öffnen des Navigationsdrawers ist der aktuell angezeigte Bereich sichtbar markiert.
- NativeWind-Klassen dürfen nicht versehentlich eine semantische Inline- oder StyleSheet-Entscheidung überschreiben.
- Komponenten, die kein `className` unterstützen, verwenden ein echtes `style` oder eine typisierte Adaptergrenze.
- Die vorhandenen Fam-Farben bleiben erhalten. ui wird nur dort adaptiert, wo ein primitives Verhalten die Stabilität verbessert.

## Explizite Architekturentscheidungen

1. NativeWind bleibt der einzige Utility-Styling-Rahmen.
2. Es gibt genau eine semantische Theme-Quelle: `src/components/theme/index.ts`, gespeist aus den bestehenden Fam-Tokenwerten.
3. Es gibt genau einen Runtime-Provider: `src/components/theme/ThemeProvider.tsx`.
4. `useThemedStyles()` ist der einzige erlaubte Helper für dynamische StyleSheets. Er wird nur eingesetzt, wenn Werte aus dem aktiven Theme in `StyleSheet.create()` einfließen.
5. `Txt` ersetzt `ThemedText`. `Surface` ersetzt die generische Funktion von `ThemedView`; `Card` bleibt die spezialisierte Kartenkomponente.
6. `src/lib/haptics.ts` ist die einzige Haptics-Implementierung für die neuen Press-/Button-Primitiven.
7. Bestehende ui-Komponenten, Props und Verhalten werden beibehalten. Werte, für die fam bereits ein direktes Gegenstück besitzt, werden durch Fam-Tokens ersetzt. ui-only Werte werden nicht zur globalen Fam-Palette oder Theme-Quelle gemacht.
8. `Screen` stellt einen Safe-Area-bewussten, themefähigen Inhalts-Scaffold bereit. `ScreenHeader` ist der optionale kompakte Header; die bestehende `chrome`-/`back`-API bleibt als kompatible Erweiterung erhalten.

## Aktuelle Probleme, die dieser Vertrag behebt

| Kategorie | Beobachtung | Vertragliche Gegenmaßnahme |
|---|---|---|
| Import-/Runtime-Fehler | Neue Dateien nutzen `~/theme` und `~/lib/store`, obwohl das Projekt `@/...` und andere Storage-Module verwendet | Imports vor Integration an die Projektstruktur anpassen und typisieren |
| Falsche Palette | `src/components/theme/index.ts` nutzt aktuell ui-Farben | Fam-Palette in den neuen Tokenvertrag überführen; keine ui-Hexwerte in Production-Defaults |
| Haptics nicht verdrahtet | `src/lib/haptics.ts` existiert bereits, wird von `ui.tsx` aber noch nicht korrekt importiert | vorhandene Datei direkt einbinden und eine einzige `fireHaptic`-Grenze verwenden |
| Textgrößen | Alte Rollen waren missverständlich und erzeugten widersprüchliche Größen und Zeilenhöhen | Sieben waivy-nahe `Txt`-Varianten mit zentralen, sicheren Zeilenhöhen |
| Stilpriorität | `className`, Komponentendefaults und `style` konkurrieren bei Farbe, Font und Hintergrund | Semantische Werte aus StyleSheet; Caller-Style zuletzt; `className` für Layout und dokumentierte Utilities |
| Views | `lightColor` und `darkColor` von `ThemedView` werden ignoriert | `Surface` mit semantischem `tone` und aktivem Theme |
| Native Grenzen | `expo-image`, FlashList, Bottom Sheets und SVG-Komponenten übernehmen `className` nicht zuverlässig | Boundary-Matrix und `style`-Adapter |
| Typensicherheit | `ui.tsx` verwendet `any` bei FontWeight, Styles und Children | sichere React-Native-Typen verwenden; bestehendes unvermeidbares `any` nur lokal und dokumentiert belassen |
| Provider | Expo-Router-Provider und neuer Fam-Provider haben denselben Namen | Aliased Import und definierte Provider-Reihenfolge |

## Tech Stack

- Expo SDK 57
- React Native 0.86
- React 19
- NativeWind 4 mit Tailwind 3
- `react-native-reanimated` für bestehende UI-Thread-Animationen
- `expo-haptics` über `src/lib/haptics.ts`
- TypeScript, Biome, Jest und React Native Testing Library

## Projektstruktur

```text
src/components/theme/
  index.ts                 # Fam-Tokens und semantische Theme-Typen
  ThemeProvider.tsx        # ein Runtime-Provider, useTheme, useThemedStyles
  ui.tsx                   # kanonische UI-Primitiven inklusive Txt und Surface
  themed-text.tsx          # nach Maintainer-Freigabe entfernt
  themed-view.tsx          # nach Maintainer-Freigabe entfernt

src/constants/
  theme.ts                 # historische Quelle; aktive Runtime-Quelle ist index.ts
  layout.ts                # bestehende Layoutwerte, in index.ts konsolidieren

src/lib/haptics.ts         # einzige Haptics-Grenze
src/features/app-shell/
  app-providers.tsx        # Mount des Fam-Providers
  app-providers.android.tsx

docs/specs/nativewind-styling/
  CAPABILITY_MAP.md
  SPEC.md
  SPEC-token-contract.md
  SPEC-typography-contract.md
  SPEC-component-contract.md
  SPEC-native-boundaries.md
  SPEC-verification-matrix.md
  mocks/index.html         # statische Dashboard-/Essensplaner-Review

tasks/nativewind-styling/
  plan.md
  todo.md
```

## Stilregeln und Beispiel

Semantische Komponenten verwenden StyleSheet für ihre Kernwerte. NativeWind bleibt für Layout und nicht konkurrierende Utilities verfügbar:

```tsx
<Button
  title="Speichern"
  variant="primary"
  size="md"
  className="self-stretch"
  onPress={save}
/>
```

Die interne Priorität lautet:

1. statische Struktur und Fam-Token-Defaults,
2. aktiver Theme-Ton und Zustandswerte,
3. dokumentierte Layout-Utilities aus `className`,
4. explizites `style` des Callers als letzter Override.

Ein Caller darf nicht gleichzeitig `className="bg-* text-* font-*"` und eine semantische Button- oder Textvariante verwenden. Solche Konflikte werden bei der Migration entfernt, nicht mit weiteren `!`-Utilities kaschiert.

## Commands

```bash
bun run check
bun run check:css
bun run typecheck
bun run test src/components/theme
bun run test src/components/ui/buttons
```

Die vollständige Test-Suite wird während dieser Initiative nicht pauschal ausgeführt. `bun test` ist verboten. Bei nativen Änderungen ist ein Development-Client-Rebuild erforderlich; neue native Dependencies werden nicht hinzugefügt.

## Testing Strategy

- Reine Token- und Mapping-Funktionen: Jest-Unit-Tests.
- `Txt`, `Surface`, `Card`, `Button`, `Field`: fokussierte RNTL-Tests auf Role, Props, Accessibility und Zustände.
- Importmigration: statischer `rg`-Audit auf alte Komponenten und veraltete Theme-Imports.
- NativeWind-Boundaries: statischer Audit für `className` auf inkompatiblen Komponenten.
- Visuelle Entscheidungsgrundlage: zwei statische Screen-Mocks für Dashboard und Essensplaner. Geprüft werden Light/Dark, Buttonzustände, Karten und Typografie. Geräteprüfung bleibt außerhalb des Scopes.

## Aktive Navigation im Drawer

Der geöffnete Navigationsdrawer leitet den aktiven Bereich ausschließlich aus
dem aktuellen Expo-Router-Pfad (`usePathname()`) ab. Ein Eintrag ist aktiv,
wenn sein öffentlicher Pfad exakt dem aktuellen Pfad entspricht oder ein
Unterpfad davon ist. Route-Gruppen wie `/(app)` werden vor dem Vergleich
normalisiert. Ein beliebiger String-Präfix ohne Pfadgrenze ist nicht zulässig,
damit ähnliche Pfade nicht gleichzeitig aktiv erscheinen.

Die aktive Markierung besteht aus mehreren Signalen:

- Fam-Auswahlfläche als Hintergrund,
- stärkerer Text und Theme-Akzentfarbe am Icon,
- `accessibilityState={{ selected: true }}` am jeweiligen Pressable.

Das gilt für die gemeinsame und die vorhandene Android-Drawer-Datei.
„Einstellungen“ berücksichtigt zusätzlich `/settings` und alle
Einstellungs-Unterseiten. Die Markierung ist nicht an einen zweiten lokalen
Navigationszustand gebunden und bleibt dadurch automatisch synchron.

## Screen-Scaffold

`src/components/layout/screen.tsx` und die vorhandene
`screen.android.tsx`-Variante verwenden dieselbe Scaffold-API. Der Root nutzt
`Surface tone="page"` für den aktiven Fam-Hintergrund, `SafeAreaView` für die
Gerätebereiche und `CONTENT_MAX_WIDTH` für eine zentrierte Inhaltsbreite.

Die neue, kompatible API umfasst:

- `ScreenHeader({ title, subtitle, back, right })` für einen optionalen
  Header mit Theme-IconButton,
- `padded` für die horizontale Innenauffüllung,
- `contentStyle` als typisierten letzten Style-Override des Inhalts,
- `refreshing` und `onRefresh` für Pull-to-Refresh inklusive Safe-Area-
  Offset,
- `scroll={false}` für Screens mit eigener Liste oder eigenem ScrollView.

Der untere Abstand wird bei aktiviertem `applyBottomPadding` als echter
Laufzeitwert aus `insets.bottom + 96` berechnet. Dadurch bleibt der Inhalt
über Floating Action Button, Sticky-Banner und Home-Indikator erreichbar.
Ein wörtliches Ersetzen durch die externe Referenz wäre nicht kompatibel mit
den bereits bestehenden `chrome`, `back`, `backgroundGradient` und
`applyBottomPadding`-Aufrufern; diese Fähigkeiten bleiben bewusst erhalten.

## Grenzen

### Immer

- Fam-Tokens verwenden.
- Semantische Komponenten mit stabilen, typisierten Props bauen.
- `style`-Reihenfolge bewusst halten.
- Fokus-Tests nach jedem Migrationsschritt ausführen.
- Bestehende Android-Dateipaare bei Importänderungen berücksichtigen, ohne in diesem Scope eine Geräteprüfung zu verlangen.

### Vorher fragen

- Neue Dependencies oder Config-Plugins.
- Änderung der Persistenzsemantik für Theme- oder Haptics-Einstellungen.
- Visuelles Redesign außerhalb der Stabilisierung.
- Entfernen von Feature-spezifischen Sonderstilen, wenn dadurch das Layout sichtbar geändert wird.

### Niemals

- NativeWind durch ein anderes Framework ersetzen.
- ui-Palette als Fam-Palette kopieren.
- Alte und neue Theme-API dauerhaft parallel betreiben.
- `any` als bequemen Workaround, globale `!important`-Regeln oder zufällige Hexwerte als Problemlösung hinzufügen. Ein technisch unvermeidbares bestehendes `any` darf lokal dokumentiert bleiben.
- Tests löschen oder Datenbankmigrationen für diese UI-Arbeit schreiben.

## Erfolgskriterien

- Keine Production-Importe von `themed-text.tsx` oder `themed-view.tsx`.
- Die beiden alten Dateien wurden nach manueller Maintainer-Freigabe entfernt.
- `AppProviders` mountet den Fam-ThemeProvider zusätzlich zum Expo-Router-Provider mit eindeutigem Alias.
- `ThemeProvider.tsx`, `index.ts`, `ui.tsx` und `haptics.ts` kompilieren mit den tatsächlichen fam-Imports und ohne neue `any`-Typen.
- Fam-Light- und Fam-Dark-Werte sind die einzigen globalen semantischen Farbwerte der neuen Lösung; ui-only Component-Fallbacks werden nicht als Theme exportiert.
- Jede bestehende Typografie-Rolle hat eine eindeutige Größe und Zeilenhöhe.
- Buttons, Cards, Surfaces und Fields zeigen in fokussierten Tests und in den zwei Screen-Mocks die erwarteten Zustände.
- Kein ungültiger oder unwirksamer NativeWind-Utility-Name wird für semantische Tokens verwendet.
- `bun run check`, `bun run typecheck` und die betroffenen fokussierten Tests sind erfolgreich.

## Annahmen

1. Die bestehende Fam-Palette aus `src/constants/theme.ts` wird in `src/components/theme/index.ts` konsolidiert und nicht neu gestaltet.
2. Theme-Präferenz darf als nicht sensible Geräteeinstellung behandelt werden. Falls im Projekt bereits ein anderes Settings-Backend dafür existiert, wird dieses als Adapter verwendet.
3. Das erste Ziel ist Styling-Stabilität. Eine neue Einstellungsseite für Light/Dark wird nicht als Teil dieser Arbeit eingeführt.
4. Die Referenzdateien aus `/Users/marco/Downloads` sind nicht automatisch kompilierbarer Projektcode und werden inhaltlich, nicht wörtlich, übernommen.

## Offene Punkte für die Implementierungsfreigabe

- Soll die vorhandene Theme-Präferenz dauerhaft `system` als Default verwenden oder das derzeitige Verhalten des alten Hooks mit Light-Fallback bewahren? Empfehlung: `system`, solange keine bestehende Nutzerpräferenz dagegensteht.
- Die Feather-Annahme der Referenz bleibt zunächst erhalten. Ein Wechsel des Icon-Systems ist nicht Bestandteil dieser Arbeit.
- Die zwei Screen-Mocks dienen als Entscheidungspunkt, bevor an 3D-Tiefe oder sichtbarer Button-Dekoration etwas verändert wird.
