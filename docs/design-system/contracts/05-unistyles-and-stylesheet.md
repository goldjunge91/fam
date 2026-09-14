# Vertrag: Unistyles und StyleSheet

## Zweck

`react-native-unistyles` v3 ist die einzige aktive Styling-Runtime.
NativeWind ist entfernt. Die drei zentralen Quellen aus der [README](./README.md)
besitzen das Design-System; Styles werden über typisierte Theme-Callbacks erstellt.

## Styling-Runtime

Der kanonische Weg für alle neuen und migrierten Styles:

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

`className` und `contentContainerClassName` sind verboten.
`global.css` und `tailwind.config.js` sind Retirement-Dateien und besitzen
keine aktiven semantischen Klassen, Paletten oder Zustände.

`StyleSheet.configure` registriert die Light-/Dark-Themes mit
`adaptiveThemes: true`. Der `ThemeProvider` lässt diese native OS-Auflösung für
`system` aktiv und schaltet sie nur für eine explizite `light`-/`dark`-
Präferenz aus, bevor er den gewählten Modus setzt.

## Zuständigkeiten

| Bereich | Zulässig |
| --- | --- |
| `index.ts` | Tokens, Paletten, Abstände, Radien, Schriftmaße, Unistyles-Theme-Konfiguration |
| `ThemeProvider.tsx` | Aktive Palette, Laufzeitauflösung `system/light/dark`, `useTheme()` |
| `ui.tsx` | Typografie, Farbpaare, Flächen, Konturen, Schatten, Interaktionszustände |
| Komponenten-/Feature-StyleSheet | Nichtsemantisches lokales Layout, berechnete Geometrie, native Integrationswerte |

Keine vierte globale Theme- oder Style-Quelle. Keine `vars()`-Bridge.
Semantische Entscheidungen gehören in genau eine der drei zentralen Dateien.

## Fachliche Domain-Paletten

Nicht jede dynamische Farbe ist ein Theme-Token. Die folgenden Quellen besitzen
fachliche Identität und bleiben deshalb außerhalb der globalen Theme-Paletten:

| Pfad | Owner und Bedeutung | Zulässige UI-Nutzung |
| --- | --- | --- |
| `src/features/shopping-list/domain-logik/store-presets.ts` und gespeichertes `store.color` | Markt-Preset- und haushaltsbezogene Nutzerfarbe | Dynamische Marktstreifen, Punkte und Auswahlmarkierungen; keine globale App-Fläche und kein informativer Text ohne eigenes Kontrast-Rezept |
| `src/features/shopping-list/classification/placement-taxonomy.ts` über `shopping-categories.ts` | Kanonische Placement-/Einkaufslisten-Klassifikation | Kategorie-Indikatoren und definierte Markierungen; die Taxonomie bleibt der fachliche Owner |

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

## Dokumentierte native Integrationsausnahmen

| Pfad | Plattform | Grund | Betroffene Regel | Prüffall |
| --- | --- | --- | --- | --- |
| `src/features/household/invite-modal.tsx` (`QRCode`) | iOS/Android | Die opake weiße Quiet-Zone ist für zuverlässiges Scannen auf unterschiedlichen Hintergründen erforderlich. | Keine freie Feature-Farbe für semantische Flächen; die QR-Renderfläche folgt der nativen QR-API. | QR-Code im hellen und dunklen App-Theme auf iOS und Android mit einem zweiten Gerät scannen. |
| `src/features/shopping-list/sheets/category-order-sheet.tsx` und `.android.tsx` | iOS/Android | `@expo/ui/community/bottom-sheet` nimmt `backgroundStyle` und `handleIndicatorStyle` als native Props entgegen und besitzt an dieser Grenze keinen Unistyles-Interop. | Palette bleibt aus dem Unistyles-Theme-Callback; die Feature-Dateien transportieren sie ausschließlich in die native Sheet-API. | Kategorie-Sheet öffnen, Handle/Sheet sichtbar prüfen, native Verschiebungsaktion auslösen, schließen und Speichern testen. |
| `src/features/shopping-list/sheets/complete-run-sheet.tsx` und `.android.tsx` | iOS/Android | `@expo/ui/community/bottom-sheet` nimmt `backgroundStyle` und `handleIndicatorStyle` als native Props entgegen und besitzt an dieser Grenze keinen Unistyles-Interop. | Palette bleibt aus dem Unistyles-Theme-Callback; die Feature-Dateien transportieren sie ausschließlich in die native Sheet-API. | Abschluss-Sheet öffnen, Menge editieren, Lagerort auswählen, schließen und Bestätigen testen. |

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
verbotenen Props auch in Objekt-Spreads sowie NativeWind-/Tailwind-/CSS-Interop-
Referenzen. Es prüft außerdem Root-Konfiguration, direkte Pakete in
`package.json` und im Bun-Root-Workspace, entfernte Styling-Assets sowie aktive
Tailwind-CSS-Direktiven. Kommentare, historische Docs und eigenständige Tools
bleiben ausgenommen. Rozenites transitive Tailwind-Abhängigkeit bleibt zulässig,
weil sie keine App-Styling-Quelle ist. Positive und negative Gegenbeispiele
verwenden temporäre Dateibäume und verändern keine App-Dateien.
