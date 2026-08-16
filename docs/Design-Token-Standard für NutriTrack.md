Ja. Hier ist eine belastbare Vorgabe, die zu eurem bestehenden System passt und nicht aus NutriTrack versehentlich ein überabstrahiertes Design-System-Projekt macht.

# Design-Token-Standard für NutriTrack

## Ziel

Das Design-System soll visuell konsistent, im Dark Mode zuverlässig und bei künftigen Änderungen günstig wartbar sein.

Ein Screen soll Design nicht mehr frei zusammensetzen. Er soll fachlichen Inhalt und vorhandene Komponenten kombinieren. Entscheidungen zu Farbe, Abstand, Form, Text und Interaktionszuständen gehören in Tokens oder wiederverwendbare Komponenten.

Das Ziel ist nicht, jede Zahl zu verbieten. Das Ziel ist, dass jede wiederkehrende visuelle Entscheidung einen eindeutigen, zentralen Namen hat.

## Kernregel

Tokens haben drei Ebenen:

```text
Primitives
  ↓
Semantische Tokens
  ↓
Komponenten-Tokens
  ↓
Screens und Features
```

Ein Screen darf im Normalfall nur semantische Tokens und Komponenten verwenden. Primitive dürfen dort nur eingesetzt werden, wenn die Entscheidung tatsächlich layout-spezifisch ist und keinen neuen Standard definiert.

Beispiel:

```tsx
// Gut: Die Bedeutung ist erkennbar und Dark Mode bleibt korrekt.
backgroundColor: theme.surface.raised
color: theme.content.primary

// Akzeptabel: lokales Layout, keine neue visuelle Rolle.
gap: Spacing.two

// Nicht gut: freie visuelle Entscheidung im Screen.
backgroundColor: '#FBF7F2'
borderRadius: 18
paddingVertical: 10
```

## 1. Primitive Tokens

Primitive Tokens sind die kleinsten, wiederverwendbaren Werte. Sie beschreiben keine Bedeutung im Produkt. Sie sind die Bausteine, aus denen semantische Rollen entstehen.

Sie existieren bereits teilweise in [`theme.ts`](/Users/marco/.t3/worktrees/fam/t3code-53fe27d3/src/constants/theme.ts).

### Farben

Die bisherigen Grundfarben bleiben die technische Quelle für Light und Dark Mode. Die Anwendung greift später vorzugsweise über semantische Rollen zu.

```ts
const ColorPrimitive = {
  // Keine Nutzung direkt in Screens oder Feature-Komponenten.
} as const;
```

Es ist nicht nötig, jede einzelne Farbnuance als öffentliche Palette zu pflegen. Die bestehende Palette ist bewusst klein und das ist richtig.

### Abstände

`Spacing` sollte als bewusst begrenzte Skala bestehen bleiben:

```ts
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;
```

Keine neuen Zwischenwerte wie `10`, `12`, `18` oder `20`, nur weil ein einzelnes Layout danach verlangt. Zuerst prüfen, ob eines der vorhandenen Rastermaße genügt. Falls ein neuer Wert wiederholt vorkommt und wirklich eine neue Rolle abbildet, wird er bewusst ergänzt.

### Radien

`Radius` ist bereits gut auf Rollen statt einer reinen Zahlenreihe ausgerichtet. Das sollte so bleiben:

```ts
Radius.sm
Radius.control
Radius.card
Radius.sheet
Radius.pill
```

Neue Radien dürfen nur ergänzt werden, wenn sie eine neue visuelle Rolle darstellen. Ein Wert wie `Radius.recipeImage` wäre zum Beispiel nur dann legitim, wenn Bildcontainer im gesamten Produkt bewusst eine eigene Formensprache erhalten.

### Typografie

Die Trennung aus `FontSize`, `Typography` und festen Text-Rollen ist richtig:

- `FontSize` bleibt eine technische Skala.
- `Typography` beschreibt Größe und Zeilenhöhe.
- Text-Rollen wie `body`, `smallBold` oder `linkPrimary` bilden stabile, produktbezogene Bedeutungen ab.

Neue Text-Rollen sollten nicht für jede Bildschirmüberschrift entstehen. Sie brauchen eine wiederkehrende Funktion, etwa `tabLabel`, `metricValue` oder `sectionHeading`.

### Ergänzende Primitive

Folgende Skalen fehlen noch und sind sinnvoll:

```ts
export const ControlSize = {
  compactHeight: 34,
  regularHeight: 44,
  largeHeight: 52,
  iconSmall: 16,
  iconMedium: 20,
  iconLarge: 24,
} as const;

export const BorderWidth = {
  hairline: 1,
  strong: 2,
} as const;

export const Opacity = {
  disabled: 0.45,
  pressed: 0.82,
  scrim: 0.42,
} as const;
```

Diese Werte sollten nicht als universelle Antwort auf jede Layoutfrage verwendet werden. Sie sind für standardisierte Controls und Zustände gedacht.

## 2. Semantische Tokens

Semantische Tokens sind die öffentliche Schnittstelle des Themes. Sie sagen, *wofür* ein Wert verwendet wird, nicht wie er aktuell aussieht.

Statt `backgroundElement` wird im neuen Code beispielsweise `surface.raised` verwendet. Dadurch kann sich die konkrete Farbpalette ändern, ohne dass Komponenten ihre Bedeutung verlieren.

Vorschlag für die zentrale Struktur:

```ts
export type Theme = {
  surface: {
    page: string;
    raised: string;
    selected: string;
    overlay: string;
    inverse: string;
  };
  content: {
    primary: string;
    secondary: string;
    disabled: string;
    inverse: string;
    accent: string;
  };
  border: {
    subtle: string;
    strong: string;
    focus: string;
  };
  action: {
    primary: {
      background: string;
      content: string;
      pressedBackground: string;
      disabledBackground: string;
      disabledContent: string;
    };
    secondary: {
      background: string;
      content: string;
      border: string;
    };
    destructive: {
      background: string;
      content: string;
    };
  };
  feedback: {
    success: string;
    warning: string;
    danger: string;
  };
  elevation: {
    card: string;
    sheet: string;
  };
};
```

### Semantische Bedeutungen

| Gruppe | Zweck | Beispiele |
| --- | --- | --- |
| `surface` | Flächen und Ebenen | Screen, Liste, Auswahl, Overlay |
| `content` | Text, Icons und Inhalte | primär, sekundär, deaktiviert, invers |
| `border` | Trennung und Fokus | normale Linie, starke Linie, Fokus |
| `action` | Interaktive Handlungen | primär, sekundär, destruktiv |
| `feedback` | Status und Rückmeldung | erfolgreich, Hinweis, kritisch |
| `elevation` | Schatten und Tiefe | Card, Sheet |

`premium` bleibt ein eigener Bereich, weil der Verlauf bewusst eine fachliche Marke trägt und keine generische Oberflächenrolle ist:

```ts
premium: {
  gradient: GradientSpec;
  onSurface: string;
  actionBackground: string;
  actionContent: string;
}
```

## 3. Komponenten-Tokens

Komponenten-Tokens sind nur für Komponenten sinnvoll, die mehrfach vorkommen und eine feste visuelle Identität haben.

Geeignete erste Kandidaten:

- `Button`
- `IconButton`
- `TextInput`
- `ListRow`
- `SettingsGroup`
- `SegmentedControl`
- `BottomSheet`

Beispiel für einen Button:

```ts
export const ButtonTokens = {
  primary: {
    minHeight: ControlSize.regularHeight,
    borderRadius: Radius.control,
    horizontalPadding: Spacing.three,
  },
  compact: {
    minHeight: ControlSize.compactHeight,
    borderRadius: Radius.control,
    horizontalPadding: Spacing.two,
  },
} as const;
```

Die Farbe gehört nicht in diesen statischen Token, wenn sie vom Theme abhängt. Die Komponente bezieht sie aus `theme.action.primary`.

```tsx
const style = {
  minHeight: ButtonTokens.primary.minHeight,
  borderRadius: ButtonTokens.primary.borderRadius,
  backgroundColor: disabled
    ? theme.action.primary.disabledBackground
    : theme.action.primary.background,
};
```

Das hält die Trennung sauber:

- Theme bestimmt Bedeutung und Modus.
- Component Token bestimmt Form und Maß.
- Die Komponente setzt Verhalten und Zustände um.
- Ein Screen entscheidet nur, welche Variante gebraucht wird.

## 4. Zustände sind Teil des Systems

Jede interaktive Basiskomponente braucht definierte Zustände:

| Zustand | Muss definiert sein |
| --- | --- |
| Normal | Fläche, Inhalt, Border |
| Pressed | sichtbare, aber ruhige Rückmeldung |
| Disabled | Kontrast und Interaktion eingeschränkt |
| Selected | für Tabs, Segmente und auswählbare Zeilen |
| Focused | insbesondere Web und Accessibility |
| Error | für Eingaben und fehlgeschlagene Validierung |
| Loading | kein Dauer-Shimmer, ruhiger statischer oder kurzlebiger Indikator |

Wichtig: Ein `disabled` Button darf nicht bloß dieselbe Farbe mit kleinerer Opacity sein, wenn Kontrast oder Verständlichkeit darunter leiden. Der Theme-Token definiert deshalb explizit Hintergrund und Inhalt für den deaktivierten Zustand.

## 5. Regeln für Screens und Features

Diese Regeln sollten in die Design-System-Dokumentation aufgenommen werden:

1. Screens verwenden `<Screen>` und keine selbst zusammengebauten Bildschirmgerüste.
2. Keine freien Hex-Farben außerhalb von `theme.ts`, SVG-Assets und dokumentierten Ausnahmen.
3. Keine neuen freien `fontSize`, `lineHeight`, `borderRadius`, Control-Höhen oder Schattenwerte im Feature-Code.
4. Wiederkehrende visuelle Muster werden zuerst als gemeinsame Komponente geprüft, nicht als neuer Screen-Style kopiert.
5. Ein lokaler Wert ist erlaubt, wenn er fachlich oder geometrisch dynamisch ist, etwa die berechnete Breite eines Makro-Balkens.
6. Jede Ausnahme erhält einen knappen Kommentar, der erklärt, warum ein Standard-Token nicht passt.
7. Neue Tokens brauchen eine klare, wiederkehrende Rolle. „Weil die Zahl an dieser Stelle gut aussieht“ ist kein ausreichender Grund.

## 6. Migrationsstrategie

Nicht Big Bang migrieren. Das wäre teuer, risikoreich und erzeugt vor allem Diff-Rauschen.

### Phase 1: Theme-Schnittstelle stabilisieren

Bestehende Tokens bleiben kompatibel, aber neue semantische Gruppen werden eingeführt und aus den bestehenden Light-/Dark-Farbwerten abgeleitet.

Beispiel:

```ts
export const Themes = {
  light: {
    surface: {
      page: Colors.light.background,
      raised: Colors.light.backgroundElement,
      selected: Colors.light.backgroundSelected,
      overlay: Colors.light.backgroundElement,
      inverse: Colors.light.text,
    },
    content: {
      primary: Colors.light.text,
      secondary: Colors.light.textSecondary,
      disabled: withAlpha(Colors.light.text, Opacity.disabled),
      inverse: Colors.light.onAccent,
      accent: Colors.light.accent,
    },
    // …
  },
  dark: {
    // …
  },
} as const;
```

Die bisherigen `Colors`-Keys können zunächst bleiben, damit die Migration inkrementell ist.

### Phase 2: Basiskomponenten vereinheitlichen

Zuerst Komponenten migrieren, die viele Screens beeinflussen. Das liefert den größten Nutzen bei geringstem Aufwand.

Empfohlene Reihenfolge:

1. `ThemedText`
2. Button und IconButton
3. Eingabefelder
4. Listenzeilen und Settings-Gruppen
5. Segmented Controls
6. Sheets, Modals und Overlays

### Phase 3: Referenzscreens migrieren

Die bereits als Referenz geltenden Screens sind die richtige Messlatte:

- Übersicht
- Vorrat
- Essensplan
- Rezept-Detail

Bei jedem Screen nur die vorhandenen Entscheidungen auf Tokens abbilden. Keine gleichzeitige Redesign-Runde.

### Phase 4: Schutz vor Rückschritten

Sobald die wichtigsten Tokens stehen:

- neue Hex-Farben im `src/`-Code außerhalb der Theme-Dateien verhindern;
- neue freie `borderRadius`- und `fontSize`-Werte prüfen;
- gezielte Ausnahmen erlauben und dokumentieren;
- Tests für Light und Dark Mode bei Basiskomponenten ergänzen.

Ein Lint-Guard darf anfangs als CI-Warnung starten. Erst wenn die wichtigsten bestehenden Verstöße migriert sind, sollte daraus ein Fehler werden.

# Umsetzungstasks

## P0: Fundament

- [ ] `Spacing`, `Radius`, `ControlSize`, `BorderWidth` und `Opacity` auditieren und die fehlenden Standardwerte in `src/constants/theme.ts` ergänzen.
- [ ] Einen `Theme`-Typ mit `surface`, `content`, `border`, `action`, `feedback`, `premium` und `elevation` einführen.
- [ ] Light- und Dark-Theme vollständig über dieselben semantischen Keys definieren.
- [ ] `useTheme()` auf diese semantische Schnittstelle ausrichten, ohne bestehende Consumer sofort zu brechen.
- [ ] Die Token-Tabelle in `docs/DESIGN_SYSTEM.md` als verbindliche Quelle ergänzen.

**Akzeptanzkriterium:** Neue Komponenten können ohne direkte Referenz auf `Colors.light` oder `Colors.dark` in Light und Dark Mode korrekt gestaltet werden.

## P1: Interaktive Kernkomponenten

- [ ] Für Buttons feste Größen und Varianten definieren.
- [ ] Pressed-, disabled- und destructive-Zustände zentralisieren.
- [ ] Für TextInputs Normal-, Focus-, Error- und Disabled-Zustände definieren.
- [ ] Für IconButtons eine begrenzte Größen- und Touch-Target-Skala festlegen.
- [ ] Komponenten mit gezielten Tests für Zustände und Farbschema absichern.

**Akzeptanzkriterium:** Zwei Screens mit Buttons oder Inputs können nicht mehr unbemerkt unterschiedliche Standardhöhen, Radien oder Disabled-Styles erzeugen.

## P2: Oberflächen und Listen

- [ ] `ListRow`, `SettingsGroup`, Cards und Segmented Controls auf `surface`, `content` und `border` migrieren.
- [ ] Wiederkehrende Padding- und Gap-Muster als Component Tokens oder klar benannte Layout-Konstanten vereinheitlichen.
- [ ] Schatten über Rollen wie `elevation.card` und `elevation.sheet` verwenden, nicht über lokale Werte.

**Akzeptanzkriterium:** Eine Anpassung der Listenfläche oder Sheet-Elevation erfolgt an einer zentralen Stelle.

## P3: Referenzscreen-Migration

- [ ] Übersicht migrieren und als visuelle Referenz prüfen.
- [ ] Vorrat migrieren.
- [ ] Essensplan migrieren.
- [ ] Rezept-Detail migrieren.
- [ ] Abweichungen entweder als Token-Lücke oder bewusste Ausnahme dokumentieren.

**Akzeptanzkriterium:** Die vier Referenzscreens enthalten keine neuen freien Farben, Typografie-Werte, Radien oder Schatten.

## P4: Automatische Absicherung

- [ ] Einen kleinen Check gegen neue Hex-Werte in `src/` einführen.
- [ ] Einen Check gegen neue freie `borderRadius`- und `fontSize`-Werte ergänzen.
- [ ] Dokumentierte Ausnahmebereiche definieren, etwa SVG-Assets, Animationen und mathematisch berechnete Maße.
- [ ] Den Check zunächst nur berichtend ausführen, später in CI verpflichtend machen.

**Akzeptanzkriterium:** Neue visuelle Drift wird im Pull Request sichtbar, bevor sie sich in mehreren Screens vervielfacht.

Der entscheidende Architekturpunkt ist: **Semantische Tokens sind die stabile API, Komponenten-Tokens sind die stabilen Bauteile und Primitive sind nur das Material darunter.** Damit bleibt das System klein, aber Änderungen an Palette, Dark Mode, Controls oder Dichte werden kontrollierbar.
