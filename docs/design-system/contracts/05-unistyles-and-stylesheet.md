# Vertrag: Unistyles und StyleSheet

## Zweck

`react-native-unistyles` v3 ist die einzige aktive Styling-Runtime. Die drei
zentralen Quellen aus der [README](./README.md) besitzen das Design-System.
Theme- und Runtime-abhängige Styles verwenden
typisierte Unistyles-Callbacks; vollständig statische, lokale Styles dürfen
statisch erstellt werden.

## Styling-Runtime

Für Styles mit Theme-Abhängigkeiten ist der vorgesehene Weg:

```tsx
import { StyleSheet } from 'react-native-unistyles';

const styles = StyleSheet.create((theme) => ({
  root: {
    backgroundColor: theme.background,
    borderColor: theme.border,
    padding: theme.space.md,
  },
}));
```

Wenn ein Style zusätzlich Unistyles-Laufzeitwerte wie Insets oder
Bildschirmmaße benötigt, verwendet er den zweiten Callback-Parameter:

```tsx
const styles = StyleSheet.create((theme, rt) => ({
  root: {
    backgroundColor: theme.background,
    paddingTop: rt.insets.top,
  },
}));
```

Ein vollständig statischer, nur lokal verwendeter Style braucht keinen
Theme-Callback:

```tsx
const interactionStyles = StyleSheet.create({
  pressed: { opacity: 0.78 },
});
```

Statische Styles enthalten keine Werte, die sich mit Theme oder Unistyles-
Laufzeit ändern. Gemeinsame semantische Entscheidungen und wiederverwendbare
Designwerte bleiben unabhängig von der Erstellungsform in den zentralen
Ownern.

`className` und `contentContainerClassName` sind verboten.

## Verbindliche Unistyles-v3-Regeln

- `StyleSheet` wird ausschließlich aus `react-native-unistyles` importiert und
  nicht über Barrel-Dateien re-exportiert.
- Reaktive Styles aus `StyleSheet.create()` werden niemals mit dem
  Spread-Operator kombiniert: Das kann die Proxy-Bindung von Unistyles
  aufbrechen. Verwende Style-Arrays, zum Beispiel
  `style={[styles.root, localStyle]}`.
- `StyleSheet.absoluteFill` ist im nativen Unistyles-v3-Adapter ein direkter
  Alias von React Natives statischer `StyleSheet.absoluteFill`-Konstante; es ist
  kein reaktives Ergebnis von `StyleSheet.create()`. Es darf als Eintrag eines
  Style-Arrays verwendet werden. Für gefüllte Overlays wird es am Verbrauchsort
  kombiniert, zum Beispiel
  `style={[StyleSheet.absoluteFill, styles.overlay]}`; spätere Array-Einträge
  überschreiben dabei wie bei einer Objektkombination frühere Werte. So bleibt
  die native Positionierung erhalten, ohne die Konstante in lokale
  StyleSheet-Objekte zu kopieren.
- Das Unistyles-Babel-Plugin ist erforderlich. Es muss den App-Quellcode
  verarbeiten; in diesem Projekt ist `root: 'src'` in `babel.config.js`
  festgelegt.
- `StyleSheet.configure()` wird einmal ausgeführt, bevor irgendein
  `StyleSheet.create()` ausgeführt wird. In diesem Projekt importiert
  `src/index.ts` zuerst `src/components/theme/index.ts` mit der Konfiguration
  und danach `expo-router/entry`.

`StyleSheet.configure` registriert die Light-/Dark-Themes mit
`adaptiveThemes: true`. Der `ThemeProvider` lässt diese native OS-Auflösung für
`system` aktiv und schaltet sie nur für eine explizite `light`-/`dark`-
Präferenz aus, bevor er den gewählten Modus setzt.

## Zuständigkeiten

| Bereich | Zulässig |
| --- | --- |
| `index.ts` | Tokens, Paletten, Abstände, Radien, Schriftmaße, Unistyles-Theme-Konfiguration |
| `ThemeProvider.tsx` | Aktive Palette, Laufzeitauflösung `system/light/dark`, `useTheme()` |
| `ui.tsx` und `ui-shadow.ts` | Gemeinsamer UI-Owner: Typografie, Farbpaare, Flächen, Konturen und Interaktionszustände; `ui-shadow.ts` exportiert ausschließlich die fertigen Schatten-Styles |
| Komponenten-/Feature-StyleSheet | Nichtsemantisches lokales Layout, berechnete Geometrie, native Integrationswerte |

Keine vierte globale Theme- oder Style-Verantwortung. `ui-shadow.ts` ist das
Schattenmodul des dritten Owners, keine eigenständige vierte Quelle.
Keine `vars()`-Bridge. Semantische Entscheidungen gehören in genau einen der
drei zentralen Owner.

## Fachliche Domain-Paletten

Nicht jede dynamische Farbe ist ein Theme-Token. Die folgenden Quellen besitzen
fachliche Identität und bleiben deshalb außerhalb der globalen Theme-Paletten:

| Pfad | Owner und Bedeutung | Zulässige UI-Nutzung |
| --- | --- | --- |
| `src/features/shopping-list/domain-logik/store-presets.ts` und gespeichertes `store.color` | Markt-Preset- und haushaltsbezogene Nutzerfarbe | Dynamische Marktstreifen, Punkte und Auswahlmarkierungen; keine globale App-Fläche und kein informativer Text ohne eigenes Kontrast-Rezept |
| `src/features/shopping-list/classification/placement-taxonomy.ts` über `shopping-categories.ts` | Maßgebliche Placement-/Einkaufslisten-Klassifikation | Kategorie-Indikatoren und definierte Markierungen; die Taxonomie bleibt der fachliche Owner |

Diese Domainfarben werden nicht nach `src/components/theme/index.ts` kopiert und
nicht in `src/constants/ui.tsx` neu klassifiziert. Gemeinsame Alpha-, Fallback-
oder Kontrastrezepte dürfen in `ui.tsx` liegen, wenn mehrere Consumer dasselbe
Darstellungsverhalten benötigen. Die Daten-/Taxonomieentscheidung bleibt dabei
im jeweiligen Domain-Owner.

## Integrationsausnahmen

Native Views ohne Unistyles-Interop verwenden ihre tatsächliche `style`-/Prop-API —
FlashList, Bottom Sheets, SVG, `expo-image`, Reanimated. Palette und semantische
Rezepte stammen weiterhin aus den drei zentralen Quellen.

Medien, offizielle Produktkennzeichnungen, nutzergewählte Farben und Systemcontrols
werden nicht pauschal in die fam-Palette umgefärbt.

Für jede Ausnahme wird in diesem Vertrag ein Eintrag mit **Pfad, Plattform, Grund,
betroffener Regel und Prüffall** dokumentiert.

### ProductInformation und Nutri-Score

`src/features/inventory/components/product-information.tsx` bleibt der Owner für
Verhalten, Komposition, Accessibility und lokales Layout des
Produktinformations-Sheets. Die fünf Werte der lokalen Map
`NUTRI_BADGE_COLORS` sind die offizielle Nutri-Score-Kennzeichnung aus der
externen Quelle Open Food Facts. Sie dürfen ausschließlich als Badge-Fläche für
den angezeigten Nutri-Score verwendet werden.

Die Ausnahme erlaubt keine Verlagerung dieser Werte nach
`src/components/theme/index.ts`, `ThemeProvider.tsx` oder `src/constants/ui.tsx`,
keinen zweiten Farb-Map-Owner unter `src/` und keine Verwendung als fam-eigene
Status-, Marken- oder Surface-Farbe. Alle übrigen Farben und semantischen Rezepte
des Sheets kommen aus `useTheme()` beziehungsweise den drei zentralen Ownern.
Lokale numerische Layoutwerte bleiben zulässig, wenn sie einmalige Geometrie
ausdrücken; wiederkehrende App-Maße werden im nachgelagerten Token-Schritt an
bestehende Theme-Tokens gebunden.

Der fokussierte Contract-Test prüft den eindeutigen Map-Owner, die fünf Grade
`a` bis `e`, die Beschränkung der offiziellen Hexwerte auf diese Map und die
Dokumentationsmarker. Der Farb-/Kontrastvertrag aus Vertrag 01 bleibt auch für
die externe Kennzeichnung gültig; ein Gradwert darf nicht stillschweigend als
allgemeines `onAccent`-Rezept interpretiert werden.

## Dokumentierte native Integrationsausnahmen

| Pfad | Plattform | Grund | Betroffene Regel | Prüffall |
| --- | --- | --- | --- | --- |
| `src/features/inventory/components/product-information.tsx` (`NUTRI_BADGE_COLORS`) | iOS (Android außerhalb dieses Vorhabens) | Offizielle Nutri-Score-Produktkennzeichnung von Open Food Facts; die Quelle ist keine fam-eigene Palette. | Die externen A–E-Werte bleiben lokal auf die Nutri-Score-Badge-Fläche begrenzt; keine Kopie in globale Theme-Owner und keine Verwendung für app-eigene Status-/Surface-Semantik. | Contract-Gate, fokussierter Nutri-Score-/Fallback-Test und iOS-Prüfung in Light/Dark; Kontrastabweichungen werden sichtbar dokumentiert. |
| `src/features/household/invite-modal.tsx` (`QRCode`) | iOS/Android | Die opake weiße Quiet-Zone ist für zuverlässiges Scannen auf unterschiedlichen Hintergründen erforderlich. | Keine freie Feature-Farbe für semantische Flächen; die QR-Renderfläche folgt der nativen QR-API. | QR-Code im hellen und dunklen App-Theme auf iOS und Android mit einem zweiten Gerät scannen. |
| `src/features/shopping-list/sheets/category-order-sheet.tsx` / `.android.tsx` | iOS / Android | iOS nutzt direkte SwiftUI-Präsentation mit `RNHostView` für die bestehende ReorderableList. Der Android-Adapter bleibt als bestehender Community-Verbraucher außerhalb dieses iOS-Schritts unverändert. | Keine Community-Imports im iOS-Adapter; Palette und dynamische Marktfarbe kommen weiterhin aus Unistyles beziehungsweise dem Domain-Wert. | Kategorie-Sheet auf iOS öffnen, Handle/Sheet sichtbar prüfen, schließen und Speichern testen. |
| `src/features/shopping-list/sheets/complete-run-sheet.tsx` / `.android.tsx` | iOS / Android | iOS nutzt direkte SwiftUI-Präsentation mit `RNHostView` für den bestehenden RN-Inhalt. Der Android-Adapter bleibt als bestehender Community-Verbraucher außerhalb dieses iOS-Schritts unverändert. | Keine Community-Imports im iOS-Adapter; bestehende Palette und CTA-Rezepte bleiben aus dem Unistyles-Theme und den UI-Primitiven. | Abschluss-Sheet auf iOS öffnen, Lagerort und Datum bedienen, schließen und Bestätigen testen. |

## Beispiel

```tsx
import { StyleSheet } from 'react-native-unistyles';
import { Surface } from '@/constants/ui';

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
  },
}));

<Surface tone="soft" style={styles.row} />
```

## Nachweis und Abschluss

Eine vollständige Migration hat keine unbegründeten aktiven `className`-Verbraucher.
Der verbindliche Nachweis ist
`bun run test test/conventions/nativewind-removal.test.ts`. Das Gate scannt
JavaScript/TypeScript unter `src/` und im Root per Syntaxbaum und meldet beide
verbotenen Props auch in Objekt-Spreads sowie Referenzen auf ausgemusterte
Styling-Pakete und Interop-APIs. Es prüft außerdem Root-Konfiguration, direkte
Pakete in `package.json` und im Bun-Root-Workspace, ausgemusterte Styling-Assets
sowie aktive CSS-Direktiven. Kommentare, historische Docs und eigenständige
Tools bleiben ausgenommen. Abhängigkeiten separater Tool-Oberflächen außerhalb
des App-Workspaces gelten nicht als App-Styling-Quelle. Positive und negative
Gegenbeispiele verwenden temporäre Dateibäume und verändern keine App-Dateien.
