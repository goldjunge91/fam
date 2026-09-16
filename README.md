# fam

[![CI](https://github.com/goldjunge91/fam/actions/workflows/ci.yml/badge.svg)](https://github.com/goldjunge91/fam/actions/workflows/ci.yml)
[![Milestones](https://img.shields.io/badge/milestones-github-blue)](https://github.com/goldjunge91/fam/milestones)
[![Epics](https://img.shields.io/badge/epics-tracked-blue)](https://github.com/goldjunge91/fam/issues?q=is%3Aissue+label%3Aepic)

Expo-/React-Native-App für Haushalt, Einkauf und Ernährung: ein geteilter
Kühlschrank-Bestand und eine Einkaufsliste für die ganze Familie, kombiniert
mit privatem Kalorien-, Nährwert- und Gewichts-Tracking pro Account — streng
per Row Level Security getrennt. Mental Anchor: eine datenschutzorientierte,
kollaborative Kombination aus *Bring!* und *MyFitnessPal*.

Details zu Produktentscheidungen und Grenzen: [Produktvision](docs/features/VISION.md).

<p>
  <img src="docs/screenshots/01-home.png" width="150" alt="Dashboard" />
  <img src="docs/screenshots/03-inventory.png" width="150" alt="Kühlschrank-Bestand" />
  <img src="docs/screenshots/04-shopping-list.png" width="150" alt="Einkaufsliste" />
  <img src="docs/screenshots/05-meal-planner.png" width="150" alt="Meal-Planner" />
  <img src="docs/screenshots/06-recipes.png" width="150" alt="Rezepte" />
</p>

## Inhalt

- [fam](#fam)
  - [Inhalt](#inhalt)
    - [App Release *(in Arbeit)*](#app-release-in-arbeit)
    - [Ohne festen Meilenstein](#ohne-festen-meilenstein)
  - [Erste Schritte](#erste-schritte)
  - [Maestro E2E](#maestro-e2e)
  - [React Native Harness](#react-native-harness)
  - [Stack](#stack)
  - [Dokumentation](#dokumentation)

### App Release *(in Arbeit)*

| Epic | Umfang |
| --- | --- |
| [Apple App Store Release](https://github.com/goldjunge91/fam/issues/317) | Developer Account, Produktionsbuild, App-Privacy, TestFlight bis Store-Veröffentlichung |
| [Google Play Store Release](https://github.com/goldjunge91/fam/issues/316) | Entwicklerkonto, Produktionsbuild, Data Safety, interner Test bis Produktionsfreigabe |

### Ohne festen Meilenstein

| Epic | Umfang |
| --- | --- |
| [Abnehm- & Trainingsmethoden](https://github.com/goldjunge91/fam/issues/179) | Spezifische Protokolle: GLP-1, Fasten, Keto, CGM, Workouts & Energiedichte |
| [Datenpipeline für Supermarkt-Prospekte](https://github.com/goldjunge91/fam/issues/246) | Robuste, deutschlandweite Datenpipeline für mehrere Ketten statt einer einzelnen, undokumentierten Quelle |

Diese Epics sind Produktoptionen, keine fest zugesagten Releases — vor jeder
Umsetzung werden Problem, Datenbedarf und Datenschutzwirkung entschieden
(Details in der [Roadmap](docs/features/ROADMAP.md)).

## Erste Schritte

```bash
bun install
bun start        # Metro starten — 'i' iOS, 'a' Android, 'w' Web
```

Kamera, Barcode-Scanner, lokale SQLite-Datenbank, SecureStore und
Notifications laufen nicht in Expo Go und brauchen einen Dev Client:

```bash
bash scripts/ios-dev.sh
```

Alle weiteren Befehle, Umgebungsvariablen, Test-Accounts, Telemetrie-Setup und
die volle Architektur stehen im [Developer Guide](docs/architecture/DEVELOPER_GUIDE.md).

## Maestro E2E

Die ausführbaren Maestro-Journeys liegen unter `.maestro/ios/flows/` und
`.maestro/android/flows/`. Wiederverwendbare Einzelschritte liegen getrennt
unter den jeweiligen `subflows/`-Ordnern. Der lokale iOS-Dev-Client wird über
`fam://expo-development-client/?url=...` mit einem laufenden Metro-Server
gestartet. Expo Go und `exp://` gehören nicht zum Testsetup.

Die iOS-Kernjourneys werden zuerst abgenommen:

- Registrierung mit lokaler Inbucket-Bestätigung bis zum Dashboard
- erfolgreicher Login bis zum Dashboard
- falsche Credentials, Passwort-Reset-Anforderung und erfolgreicher Login
- Abmelden, Kaltstart und erneuter Sign-in

Maestro wird direkt über `.maestro/scripts/maestro.ts` beziehungsweise
`.maestro/scripts/android.ts` ausgeführt. Es gibt absichtlich keine Maestro-
oder E2E-Scripts in `package.json`. Voraussetzungen, Parameter, Tags und die
vollständige Reihenfolge stehen im [Developer Guide](docs/architecture/DEVELOPER_GUIDE.md#maestro-architektur).

## React Native Harness

Die Anleitung für Harness-Tests, Dev-Builds, Plattform-Runner und den DEV-
Performance-Monitor steht in [harness/README.md](harness/README.md).

## Stack

Expo SDK 57 · React Native 0.86 · React 19.2 · Expo Router · Supabase
(Postgres, Auth, Realtime, RLS) · `expo-sqlite` mit Outbox-Sync · TanStack
Query · RevenueCat. Details und Begründungen: [Developer Guide](docs/architecture/DEVELOPER_GUIDE.md#stack).

## Dokumentation

Die vollständige, nach Zweck sortierte Dokumentation steht in
[docs/README.md](docs/README.md). Für Entwicklungsregeln ist
[AGENTS.md](AGENTS.md) verbindlich. Die Domänenbegriffe und
Eigentümerschaftsregeln stehen in [CONTEXT.md](CONTEXT.md).
