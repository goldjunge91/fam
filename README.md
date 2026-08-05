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
- `bun run lint` — Linting (wird durch Biome ersetzt, [#25](https://github.com/goldjunge91/fam/issues/25))
- `bun run reset-project` — auf ein leeres Template zurücksetzen

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
