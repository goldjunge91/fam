# React Native Harness

Der React Native Harness führt Jest-ähnliche Tests in der echten fam-Runtime
aus. Die Tests laufen gegen einen iOS- oder Android-Dev-Build oder gegen den
Web-Runner, nicht gegen eine simulierte Jest-Umgebung.

## Voraussetzungen

```bash
bun install
```

Für iOS und Android muss zuerst ein Dev-Build installiert sein:

```bash
bun run ios:development
bun run android:development
```

Expo Go reicht dafür nicht aus. Der iOS-Simulator bzw. Android-Emulator muss
laufen und die konfigurierte App-ID muss installiert sein.

## Tests ausführen

Die Plattform-Scripts laden automatisch `.env.development.local`:

```bash
bun run harness:ios
bun run harness:android
bun run harness:web
```

Wenn Watchman nicht installiert oder nicht erreichbar ist:

```bash
bun run harness:ios -- --watchman=false
```

Ein Harness-Test wird nur aufgelistet, aber nicht ausgeführt, wenn
`--listTests` verwendet wird:

```bash
bun run harness:dev -- --harnessRunner ios --listTests --watchman=false
```

Für die tatsächliche Ausführung muss `--listTests` entfallen.

## Einen Test hinzufügen

Harness-Dateien liegen unter `harness/` und enden auf `.harness.ts` oder
`.harness.tsx`. Die Jest-ähnlichen APIs kommen aus `react-native-harness`:

```ts
import { describe, expect, it } from 'react-native-harness';
import { Platform } from 'react-native';

describe('fam runtime', () => {
  it('starts on the selected platform', () => {
    expect(['ios', 'android', 'web']).toContain(Platform.OS);
  });
});
```

Plattform-spezifische Tests können mit `.ios.harness.ts` oder
`.android.harness.ts` benannt werden. Die globale Harness-Konfiguration steht in
[`rn-harness.config.mjs`](../rn-harness.config.mjs), die Jest-Auswahl in
[`jest.harness.config.mjs`](../jest.harness.config.mjs).

## Performance Monitor in DEV

Der Rozenite Performance Monitor wird nur in `__DEV__` eingebunden. Für die
normale App-Entwicklung kann Rozenite explizit aktiviert werden:

```bash
WITH_ROZENITE=true bun run start:development
```

Der Harness lädt das Performance-Monitor-Plugin während eines Testlaufs
automatisch.

## Harness oder normale App?

Der Harness startet die App-Runtime für Tests und beendet den Testlauf danach.
Er ist kein dauerhafter App-Launcher. Um die normale App zu öffnen, verwende:

```bash
bun run ios:development
# oder
bun run android:development
```

Ein erfolgreicher Harness-Lauf sieht ungefähr so aus:

```text
Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```

Die Jest-Meldung `Jest did not exit one second after the test run has
completed` kann nach einem erfolgreichen Lauf erscheinen, weil native
Runtime-Handles noch auslaufen. Entscheidend sind der Exit-Code und die
Testergebnisse.

