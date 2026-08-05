# NutriTrack

Expo-App für Haushalt, Einkauf und Ernährung: geteilter Kühlschrank-Bestand und
Einkaufsliste für die ganze Familie, privates Kalorien- und Gewichts-Tracking pro Account.

**Status: Gerüst.** Das Repo ist aktuell das Expo-SDK-57-Default-Template. Vom
Backend-Stack ist noch nichts installiert — die Umsetzung ist in
[99 Issues](https://github.com/goldjunge91/fam/issues) aufgeschlüsselt.

## Quick Start

```bash
bun install && bun start
```

`i` für den iOS-Simulator, `a` für den Android-Emulator, `w` für den Browser.

## Commands

- `bun start` — Metro starten
- `bun run ios` / `bun run android` / `bun run web`
- `bun run check` — Lint + Format prüfen (Biome), `bun run check:fix` schreibt
- `bun run typecheck` — `tsc --noEmit`
- `bun run test` — Jest. **Nicht `bun test`**: das startet Buns eigenen Runner,
  ignoriert `jest.config.js` und schlägt fehl
- `bun run reset-project` — auf ein leeres Template zurücksetzen

## Umgebungsvariablen

Lege eine `.env` im Projekt-Root an (sie ist gitignored und wird bewusst nicht
mitgeliefert):

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_...
```

Nur Variablen mit dem Präfix `EXPO_PUBLIC_` landen im Client-Bundle; Expo setzt
sie zur Build-Zeit als Literal ein. Fehlt eine Variable, bricht `src/lib/env.ts`
mit einer klaren Meldung ab, statt später einen kryptischen Netzwerkfehler zu
erzeugen.

**Woher die Werte kommen:**

| | Lokal | Gehostet |
|---|---|---|
| URL | `supabase status` → API URL | Dashboard → Project Settings → API |
| Key | `supabase status` → **Publishable** | Dashboard → Publishable key |

Aktuelle Supabase-Versionen geben **Publishable** und **Secret** aus, nicht mehr
`anon` und `service_role`. In `EXPO_PUBLIC_SUPABASE_KEY` gehört der
Publishable Key — der Secret Key darf niemals in die App.

## Lokales Backend

```bash
supabase start    # Postgres, Auth, Realtime, Studio (braucht Docker)
supabase status   # URLs und Keys anzeigen
supabase db reset # Schema aus supabase/migrations/ neu aufbauen
supabase stop
```

Studio: <http://localhost:54323>. `imgproxy` und `pooler` erscheinen als
gestoppt — beide sind per Default deaktiviert und werden nicht gebraucht.

## Development Build

Barcode-Scanner, lokale Datenbank, Benachrichtigungen und der sichere
Session-Speicher laufen **nicht in Expo Go**. Dafür wird ein Development Build
gebraucht:

Alles in einem Schritt — bauen, laden, installieren, Simulator und Metro starten:

```bash
bash scripts/ios-dev.sh                # neuer Build
bash scripts/ios-dev.sh --reuse-last   # letzten fertigen Build verwenden
bash scripts/ios-dev.sh --no-metro     # nur installieren
bash scripts/ios-dev.sh --device "iPhone 17"
```

Einzelschritte, falls nötig:

```bash
eas build --profile development --platform ios      # Simulator-Build
eas build --profile development --platform android  # APK
eas build --profile development-device --platform ios  # echtes Gerät
```

Profile stehen in `eas.json`.

**Nach jedem neuen nativen Modul neu bauen.** Native Module landen beim Build im
Binary; Metro liefert nur JavaScript nach. Installierst du etwa
`expo-secure-store`, `expo-sqlite` oder `expo-camera` und startest nur Metro neu,
scheitert die App mit `Cannot find native module '…'` — und, weil der Import
schon beim Laden von `_layout.tsx` wirft, mit den Folgefehlern
`missing the required default export` und `Cannot read property 'ErrorBoundary'
of undefined`. Die eigentliche Ursache steht dann ganz oben im Log.

## Stack

| | Installiert | Geplant |
|---|---|---|
| Runtime | Expo SDK 57, React Native 0.86, React 19.2 | — |
| Routing | Expo Router (NativeTabs, typedRoutes) | — |
| Styling | StyleSheet + `src/constants/theme.ts` | — |
| Backend | — | Supabase (Postgres, Auth, Realtime, RLS) |
| Offline | — | `expo-sqlite` + Outbox-Sync |
| Server-State | — | TanStack Query |
| Tests | — | jest-expo, RLS-Tests gegen lokales Postgres |

Kein NativeWind: die stabile Version 4.2.6 ist nicht für RN 0.86 / React 19 gebaut,
und die SDK-57-Variante gäbe es nur als Preview. Gestylt wird über `theme.ts`.

## Struktur

`src/app/` ist ausschließlich Routing. Fachlogik liegt feature-first unter
`src/features/<domain>/` (jeweils `components/`, `hooks/`, `api.ts`, `types.ts`),
geteilte Bausteine in `src/components/`, Supabase- und DB-Setup in `src/lib/`.
Das DB-Schema ist versioniert in `supabase/migrations/`, nicht im Dashboard.

## Dokumentation

- [Produktvision](docs/VISION.md) — Features, Module, Datenschutz-Konzept
- [Roadmap](docs/ROADMAP.md) — in welcher Reihenfolge die Issues abgearbeitet werden
- [AGENTS.md](AGENTS.md) — Hinweise für KI-Agenten

## Hinweis zu nativen Modulen

Barcode-Scanner, lokale Datenbank, Benachrichtigungen und der sichere
Session-Speicher laufen **nicht in Expo Go**. Dafür wird ein Development Build
gebraucht ([#27](https://github.com/goldjunge91/fam/issues/27)).
