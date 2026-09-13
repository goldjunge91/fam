# Vollständige NativeWind-Ablösung durch Unistyles v3

## Status

Akzeptiert — löst [ADR 0006](0006-nativewind-als-auslaufende-layout-hilfe.md) ab

## Datum

2026-09-13

## Kontext

ADR 0006 hat NativeWind als auslaufende technische Abhängigkeit eingestuft und
den schrittweisen Abbau beschlossen. Der Mischbetrieb war als kurzfristiger
Übergangszustand explizit begrenzt — kein Zielzustand.

Im Verlauf der Arbeit an `fam-978` wurde bestätigt, dass:

- Die NativeWind-v4-Interop die `Pressable`-Style-Funktion auf dem Gerät
  unterdrückt (belegt am Profilbutton, `pressable-style-function-device`).
- Die drei bestehenden Design-System-Owner (`index.ts`, `ThemeProvider.tsx`,
  `ui.tsx`) den vollständigen semantischen Zielzustand bereits abdecken.
- `react-native-unistyles` v3 eine typisierte, callback-basierte Styling-Runtime
  bereitstellt, die direkt in die drei Owner integriert werden kann, ohne eine
  vierte Quelle einzuführen.
- Der Mischbetrieb nach vollständiger Consumer-Migration keinen Mehrwert mehr
  besitzt und aktiv Komplexität erzeugt.

## Entscheidung

NativeWind und die zugehörige Tailwind-/Babel-/Metro-Integration werden nach
der vollständigen Consumer-Migration (`fam-978.14`–`.64`) vollständig entfernt.
`react-native-unistyles` v3 ist die einzige aktive Styling-Runtime im Endzustand.

Die drei Design-System-Owner bleiben unverändert verbindlich:

| Owner | Verantwortung |
| --- | --- |
| `src/components/theme/index.ts` | Tokens, Paletten, Abstände, Radien, Schriftmaße, Unistyles-Theme-Konfiguration |
| `src/components/theme/ThemeProvider.tsx` | Laufzeitpräferenz, Auflösung `system/light/dark`, `useTheme()` |
| `src/constants/ui.tsx` | Semantische Primitive, Typografie, Farbpaare, Flächen, Interaktionszustände |

Der kanonische Stil für alle neuen und migrierten Komponenten:

```tsx
import { StyleSheet } from 'react-native-unistyles';

const styles = StyleSheet.create((theme) => ({
  root: {
    backgroundColor: theme.background,
    borderColor: theme.border,
  },
}));
```

`className` und `contentContainerClassName` sind ab sofort verboten.
Der Mischbetrieb während der laufenden Migration (`fam-978`) bleibt eine
dokumentierte Übergangsgrenze, die nach `fam-978.65`–`.67` nicht mehr existiert.

## Alternativen

### Mischbetrieb dauerhaft beibehalten

Verworfen. NativeWind verursacht nachgewiesene Gerätegrenzfälle und erhöht
die Komplexität, ohne semantischen Mehrwert zu liefern.

### Andere Styling-Bibliothek (Tamagui, Restyle o. Ä.)

Verworfen. Unistyles v3 integriert sich nativ in die bestehenden drei Owner
ohne vierte Quelle. Ein Wechsel zu einem anderen Framework würde denselben
Migrationsaufwand erzeugen, ohne strukturellen Vorteil.

## Folgen und Abschlusskriterien

- Während der Migration ist ein dokumentierter Mischbetrieb zulässig.
- Nach `fam-978.65`–`.67` enthält der Produktionscode keine
  NativeWind-/Tailwind-Pakete, keine Babel-/Metro-Integration, kein
  `global.css` als aktive Quelle und kein `className` in Komponenten.
- Nachweis: repo-weiter `rg`-Scan für `className=` und
  `contentContainerClassName=` in `src/` meldet keine Treffer.
- iOS- und Android-Geräteprüfung belegen essenzielle interaktive Flächen.
- Abschluss wird in `fam-978.68` dokumentiert.
