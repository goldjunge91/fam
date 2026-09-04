# Spec: `theme-runtime`

## Objective

Der aktive Farbmodus wird an einer Stelle aufgelöst und an alle neuen UI-Primitiven verteilt. Es darf nicht gleichzeitig einen alten `useTheme()`-Hook mit `Colors[...]` und einen neuen Provider mit einer abweichenden Palette geben.

## Provider-Vertrag

`src/components/theme/ThemeProvider.tsx` exportiert:

```ts
type ThemePref = 'system' | 'light' | 'dark';
type ThemeMode = 'light' | 'dark';

type ThemeValue = {
  mode: ThemeMode;
  pref: ThemePref;
  colors: FamPalette;
  setPref: (pref: ThemePref) => void;
};

function useTheme(): ThemeValue;
function useThemedStyles<T>(factory: (colors: FamPalette) => T): T;
```

`setPref` kann entfallen, falls die bestehende Settings-Domäne die Präferenz bereits besitzt. Dann bleibt die Runtime read-only und verwendet den vorhandenen Settings-Adapter.

## Auflösung

1. Eine gültige gespeicherte Präferenz `light` oder `dark` gewinnt.
2. Bei `system` folgt `useColorScheme()` dem Betriebssystem.
3. Eine ungültige oder fehlende Präferenz fällt auf den vereinbarten Default zurück. Empfehlung: `system`.
4. Die Auflösung ist frei von Render- und Storage-Nebenwirkungen.

## Storage

Die Referenz `ThemeProvider.tsx` nutzt `useKVRaw` und den Schlüssel `srf:settings-theme`. `useKVRaw` wird nicht übernommen. Für diese UI-Präferenz verwenden wir den vorhandenen MMKV-Gerätespeicher über `src/lib/storage/device-storage.ts`.

- Theme-Präferenz ist nicht sensibel und wird verbindlich im vorhandenen MMKV-`device-storage` gespeichert.
- Der Storage-Zugriff wird hinter einem kleinen, testbaren Adapter gekapselt. Der Provider liest synchron initial und hält die aktive Präferenz in lokalem React-State.
- Kein Account-Storage für eine geräteweite UI-Präferenz.
- Kein neuer globaler Zustand neben dem Provider.
- Kein zusätzliches KV- oder State-Framework neben MMKV.

## App-Integration

In `app-providers.tsx` und `app-providers.android.tsx` werden die beiden Provider eindeutig benannt:

```tsx
import { ThemeProvider as FamThemeProvider } from '@/components/theme/ThemeProvider';
import { ThemeProvider as RouterThemeProvider } from 'expo-router';
```

Der Router-Provider bleibt für Navigation zuständig. Der Fam-Provider versorgt Fam-UI-Tokens. Der Name darf nicht durch einen unklaren Import überschrieben werden.

## Migration des alten Hooks

`src/hooks/use-theme.ts` darf nach der Migration nur noch:

- den Fam-Provider re-exportieren, oder
- vorübergehend einen typisierten Adapter auf denselben Provider liefern.

Er darf keine eigene `useColorScheme()`- und `Colors[...]`-Auflösung mehr enthalten. Der Adapter bleibt bis zu einer ausdrücklichen Maintainer-Freigabe bestehen, auch wenn keine Aufrufer mehr bleiben.

## `useThemedStyles()`

Der Helper memoisiert nur Werte, die vom Provider abhängen:

```tsx
const styles = useThemedStyles((colors) =>
  StyleSheet.create({
    input: {
      backgroundColor: colors.backgroundElement,
      borderColor: colors.border,
      color: colors.text,
    },
  }),
);
```

Statische Layoutwerte bleiben außerhalb des Helpers. Der Helper wird nicht verwendet, um NativeWind zu ersetzen oder jeden Style künstlich dynamisch zu machen.

## Acceptance criteria

- [x] Provider verwendet reale Projektimports und ist typisiert.
- [x] Theme-Modus und Palette kommen aus einer gemeinsamen Auflösung.
- [x] Provider ist in beiden App-Provider-Dateien korrekt und eindeutig gemountet.
- [x] Der alte Hook enthält keine zweite Theme-Logik.
- [x] Storage ist gerätebezogen, nicht sensibel, MMKV-basiert und testbar.
- [x] `useThemedStyles()` reagiert auf einen Theme-Wechsel und erzeugt keine unnötigen Render-Schleifen.
