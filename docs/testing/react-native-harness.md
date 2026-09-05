# React Native Harness

The Harness suite runs Jest-style tests in the real fam runtime. It is kept
separate from the regular Jest suite because it needs Metro and a native or
browser runner.

## Run the smoke test

```bash
bun run harness:ios
bun run harness:android
bun run harness:web
```

Die Plattform-Scripts laden automatisch `.env.development.local`, also die
gleiche DEV-Konfiguration wie `start:development` und `ios:development`.
Für eine explizite Standardausführung ohne Env-Overlay steht weiterhin
`bun run harness` zur Verfügung.

Pass `--watchman=false` when Watchman is not available:

```bash
bun run harness:ios -- --watchman=false
```

The runner does not build or install the app. Install a debug development build
first with `bun run ios:development` or `bun run android:development`. The Web
runner starts its own Metro session and uses port 8081 when it is available.

Harness tests use the `.harness.ts` or `.harness.tsx` suffix and import their
Jest-style APIs from `react-native-harness`. Platform-specific tests can use
`.ios.harness.ts` or `.android.harness.ts` as described in the upstream
documentation.
