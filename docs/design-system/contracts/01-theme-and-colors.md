# Vertrag: Theme und Farben

## Zweck und Zuständigkeit

Light, Dark und System verwenden dieselben semantischen Rollen. fam bleibt in
seiner warmen Mauve-/Creme-Palette. Screens wählen Bedeutungen statt Hexwerte.
Tokens und Palettentypen gehören nach `src/components/theme/index.ts`, die aktive
Palette zum `ThemeProvider`, ihre Zuordnung zur Darstellung nach `ui.tsx`.

Wichtige bestehende APIs sind `Colors`, `colorsLight`, `colorsDark`, `Palette`,
`makeAccent()`, `makeCategoryTone()`, `ThemeProvider`, `useTheme()`, `useThemedStyles()`
und `setPref()`. Ihre Existenz macht nicht jede Kombination ihrer Werte zulässig.

## Eine aktive Themeentscheidung

- Alle fam-eigenen Texte, Hintergründe, Konturen, Placeholder, Cursor, Icons und
  Zustände folgen der aufgelösten Provider-Präferenz.
- `system` reagiert auf laufende Systemänderungen. Explizit `light` oder `dark`
  bleibt unabhängig davon, auch wenn das Betriebssystem das Gegentheme verwendet.
- Themewechsel benötigt keinen Remount und erhält Formulareingaben und Fokus.
- Der bestehende Präferenzschlüssel bleibt kompatibel. Ohne verfügbare Persistenz
  funktioniert die Auswahl während der Sitzung weiter.
- NativeWind/CSS erhalten keine zweite Themeauflösung und keine `vars()`-Bridge.
  Die noch vorhandenen CSS-Farben sind Migrationsbestand, keine normative Palette.

## Farbpaare und Semantik

Jede gefüllte Aktion, jeder Status und jedes Badge-Rezept besitzt ausdrücklich
zugeordnete Vordergrund-/Hintergrundwerte. `onAccent` ist nur für die dafür
geprüfte Akzentfläche vorgesehen. Statusfüllung und Statustext werden getrennt,
wenn derselbe Wert den notwendigen Kontrast nicht erfüllt.

Schattenfarben dienen Schatten, niemals Text oder informativen Icons. Historische
Aliasnamen wie `basil`, `carrot`, `sky` und `tomato` sind keine Basis neuer
Produktrezepte. Neue Verwendungen wählen kanonische Bedeutungen wie `accent`,
`warning`, `danger`, `backgroundElement` und `textSecondary`.

Statische Light-Exports wie `colors`, `accent` und `theme.colors` dürfen keine
themeabhängige Produktdarstellung versorgen. Legacy-Exports werden erst nach
Prüfung aller Verbraucher entfernt. `legacyWaivyColors` darf ausschließlich
historische Vergleichsdarstellung versorgen. Domain-Accent-Keys bleiben zulässig,
wenn sie eine belegte Bedeutung und geprüfte Farbpaare besitzen.

## Kontrastvertrag

| Verwendung | Mindestkontrast |
| --- | ---: |
| Informativer Text einschließlich Placeholder und Metadaten auf unterstützten Flächen | 4,5:1 |
| Erforderliche nichttextliche Erkennungs-/Zustandsmerkmale und Fokusindikatoren gegenüber angrenzenden Farben | 3:1 |

Das einheitliche Textziel gilt auch für große Schrift. Es ist bewusst strenger
als die WCAG-Ausnahme für große Texte. Deaktivierte Controls sind davon ausgenommen,
müssen aber erkennbar bleiben; informative Status-Badges sind nicht deaktiviert.
Rein dekorative Card-Konturen benötigen keinen künstlich erhöhten Kontrast.

Transparenzen werden gegen den tatsächlichen Untergrund berechnet. Bei Verläufen
zählt der ungünstigste relevante Hintergrund hinter dem Inhalt. Erforderlichenfalls
verwendet das Rezept eine definierte Textfläche. Status und Auswahl bleiben
zusätzlich über Text, Symbol oder Form erkennbar und besitzen passende
Accessibility-Metadaten. Kontrastwerte allein ersetzen diese Semantik nicht.

Neue korrigierte Farbwerte werden zentral geprüft und vor ihrer sichtbaren
Umsetzung als Palette zur Review gestellt. Dieser Vertrag legt keine ungeprüften
Ersatz-Hexwerte fest.

## Beispiel der vorgesehenen Verwendung

```tsx
import { Surface, Txt } from '@/constants/ui';

<Surface tone="surface">
  <Txt>Vorrat</Txt>
  <Txt tone="secondary">12 Produkte</Txt>
</Surface>
```

Ein eigenes `backgroundColor: '#FFFFFF'` am Feature oder eine Schattenfarbe als
Badge-Schrift umgeht den Vertrag, auch wenn der Wert zufällig zur Light-Palette passt.
Offizielle Kennzeichnungen und Medienfarben folgen den Integrationsregeln aus
[Vertrag 05](./05-nativewind-and-stylesheet.md).

## Nachweis und Migrationsgrenze

Provider-Tests prüfen Systemwechsel, explizite Gegenpräferenz, Persistenz und
Speicherausfall. Kontrastprüfungen berechnen alle unterstützten Paare in beiden
Paletten, nicht beliebige Kombinationen aller Tokens. Die Referenz und native
Formulare belegen den gemeinsamen Wechsel von Schrift, Fläche und Kontur.
Vorhandene CSS- und Alias-Verbraucher gelten bis zur Migration als Abweichungen;
ihre heutige Existenz schwächt den Zielvertrag nicht ab.

Quellen: [W3C Textkontrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
und [W3C nichttextlicher Kontrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
