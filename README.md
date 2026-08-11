# NutriTrack

Expo-App für Haushalt, Einkauf und Ernährung: geteilter Kühlschrank-Bestand und
Einkaufsliste für die ganze Familie, privates Kalorien- und Gewichts-Tracking pro Account.

**Status:** Foundation, Datenmodell/RLS, Offline-Sync-Kern, Auth/Onboarding und
Haushalt (Epics 0–4) sind gebaut und getestet; Kühlschrank/Einkaufsliste und die
Lebensmittel-Datenbank (Epic 5, Parallel-Track P) sind weitgehend fertig. Offen:
Kalorien & Tagebuch (Epic 6, noch nicht begonnen), Dashboard-Feinschliff (Epic 7)
und Datenschutz-Features (Epic 8). Details und Stand pro Issue in
[docs/projekt_status.md](docs/projekt_status.md) und
[docs/ROADMAP.md](docs/ROADMAP.md).

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
- `bun run e2e` — Maestro-Flows gegen einen laufenden Simulator/Emulator
  (Dev Build + `supabase start` + Testaccount nötig, siehe
  `.maestro/flows/onboarding-sign-in.yaml`)
- `bun run e2e:household-create` / `bun run e2e:household-join` — Haushalts-
  Erstellung/-Beitritt im Onboarding; seeden sich ihren Testaccount selbst
  (siehe `scripts/lib/e2e-fixtures.ts`), `bun run e2e:all` führt alle drei
  nacheinander aus
- `bun run user:create` / `bun run user:list` / `bun run user:clean` / `bun run user:delete` — Verwaltung lokaler Test-Accounts (`scripts/test-users.ts`)
- `bash scripts/create-user-with-household.sh` — Erstellt Test-User mit Haushalt und befüllter Einkaufsliste
- `bun run reset-project` — auf ein leeres Template zurücksetzen

### Test-Accounts & Skripte

Zum schnellen Testen auf der lokalen Entwicklungsdatenbank (`supabase start`):

- **Bash Script (`scripts/create-user-with-household.sh`)**:
  - `./scripts/create-user-with-household.sh` — Erstellt 1 neuen Test-Nutzer mit eigenem Haushalt, Standard-Lagerorten und vorausgefüllten Einkaufslisten-Produkten.
  - `./scripts/create-user-with-household.sh <anzahl>` — Kann mehrmals oder mit einer Anzahl aufgerufen werden (z. B. `./scripts/create-user-with-household.sh 5`), um mehrere Test-User gleichzeitig mit jeweils eigenem Haushalt anzulegen.
  - `./scripts/create-user-with-household.sh [email] [passwort] [name] [haushalt]` — Erstellt einen spezifischen Nutzer mit individuellem Haushaltsnamen und Produkten.

- **TypeScript Helper (`scripts/test-users.ts`)**:
  - `bun run user:create [email] [passwort] [name]` — Erstellt einen einfachen Test-Account
  - `bun run user:list` — Listet vorhandene Test-Accounts auf
  - `bun run user:clean` — Löscht alle Test-Accounts (`*@example.com`, `tester_*`)
  - `bun run user:delete <email>` — Löscht einen bestimmten Test-Account


## Umgebungsvariablen

Lege eine `.env` im Projekt-Root an (sie ist gitignored und wird bewusst nicht
mitgeliefert):

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_...
EXPO_PUBLIC_FORCE_ONBOARDING=false  # optional: bei true wird beim App-Start das Profil-Onboarding geöffnet
EXPO_PUBLIC_DEV_TOOLS=false         # optional: bei true erscheint der Entwickler-Bereich in den Einstellungen
```

`127.0.0.1` funktioniert nur im iOS-Simulator (localhost = der Mac selbst).
Fuer ein physisches Geraet im selben WLAN die LAN-IP des Mac verwenden, z. B.
`http://192.168.1.23:54321` (`ifconfig | grep "inet "` zum Finden).

### Entwickler-Bereich

Mit `EXPO_PUBLIC_DEV_TOOLS=true` bekommen die Einstellungen eine Gruppe
„Entwickler" mit einer eigenen Seite. Sie beantwortet die Fragen, die die App
sonst nirgends beantwortet:

- **gegen welches Supabase-Projekt** dieser Build läuft — lokal oder das
  verlinkte Projekt mit echten Daten (rot markiert)
- **Restlaufzeit des Zugriffstokens** — die Erklärung für viele
  „auf einmal geht nichts mehr"-Momente
- **ob die lokale SQLite-Datei zum angemeldeten Nutzer gehört**, dazu
  Schema-Version, Outbox-Zähler und Zeilenzahlen
- Aktionen: Sync erzwingen, Test-Benachrichtigung, Sync-Diagnose, lokale
  Datenbank löschen

Bewusst ein eigener Schalter statt `__DEV__`: Der Bereich ist gerade in einem
echten Build nützlich (etwa TestFlight, wo unklar ist, gegen welches Projekt er
läuft) und soll sich umgekehrt auch während der Entwicklung abschalten lassen,
um die Einstellungen so zu sehen wie Nutzer.

### E-Mail-Bestätigung

Die Bestätigungsmail enthält beides: einen **Link** und einen **6-stelligen
Code**. Der Link trägt bewusst kein `fam://`-Redirect mehr — er setzt nur noch
serverseitig `email_confirmed_at` und funktioniert deshalb aus jedem Browser und
von jedem Gerät. Die App wartet nicht auf einen Deep Link, sondern fragt den
Server selbst (alle 15 s, plus „Jetzt prüfen"-Knopf); wer schneller sein will,
tippt den Code direkt ein.

> **Remote zwingend: eigener SMTP-Server.** Der eingebaute Mailversand von
> Supabase ist ausdrücklich nicht für Produktion gedacht — er
> [„refuses to deliver messages to addresses that are not part of the project's
> team"](https://supabase.com/docs/guides/auth/auth-smtp) und ist auf **2 Mails
> pro Stunde** begrenzt. Dazu kommt: Seit **2026-06-03** können neu angelegte
> Free-Projekte mit dem Standard-SMTP **keine Auth-Templates mehr anpassen**
> ([Changelog](https://supabase.com/changelog)). `fam_app` wurde am 2026-08-05
> erstellt, fällt also darunter. Ohne eigenen SMTP-Server enthielte die Mail
> remote das Standard-Template — **ohne den 6-stelligen Code**, während die App
> weiterhin ein Code-Feld anzeigt. Link, Polling und „Jetzt prüfen" funktionieren
> auch dann; der Code-Weg nicht. Custom SMTP löst beides auf einmal.

Nach dem Klick landet der Browser auf der Edge Function `auth-confirmed`
(`supabase/functions/auth-confirmed/`) — sie zeigt „E-Mail bestätigt" bzw.
„Dieser Link wurde schon benutzt". Vorher zeigte der Browser dort
„Die Website ist nicht erreichbar", weil `site_url` auf einen toten Port zeigte.
Die Seite löst bewusst keine Tokens ein; sie informiert nur.

Fürs Deployment: `supabase functions deploy auth-confirmed` und im Dashboard
unter **Authentication > URL Configuration** die Site URL auf
`https://<projekt>.supabase.co/functions/v1/auth-confirmed` setzen —
`supabase/config.toml` steuert nur die lokale Instanz.

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
supabase db reset # Migrationen neu anwenden
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

| | Installiert |
|---|---|
| Runtime | Expo SDK 57, React Native 0.86, React 19.2 |
| Routing | Expo Router (NativeTabs, typedRoutes) |
| Styling | StyleSheet + `src/constants/theme.ts` |
| Backend | Supabase (Postgres, Auth, Realtime, RLS) |
| Offline | `expo-sqlite` + Outbox-Sync (Pull/Push/LWW), App-seitig per Polling verdrahtet — Realtime-Bridge und Netzwerk-Trigger sind gebaut, aber noch nicht an `_layout.tsx` angeschlossen (siehe [docs/SYNC_ENGINE.md](docs/SYNC_ENGINE.md)) |
| Server-State | TanStack Query |
| Tests | jest-expo + Testing Library, pgTAP-RLS-Tests gegen lokales Postgres |

Kein NativeWind: die stabile Version 4.2.6 ist nicht für RN 0.86 / React 19 gebaut,
und die SDK-57-Variante gäbe es nur als Preview. Gestylt wird über `theme.ts`.

## Struktur

`src/app/` ist ausschließlich Routing. Fachlogik liegt feature-first unter
`src/features/<domain>/` (jeweils `components/`, `hooks/`, `api.ts`, `types.ts`),
geteilte Bausteine in `src/components/`, Supabase- und DB-Setup in `src/lib/`.
## Datenbankschema

Das Projekt nutzt ausschließlich Supabases **Declarative Schema Workflow**. Der
gewünschte Endzustand steht in `supabase/schemas/*.sql`; die Dateien unter
`supabase/migrations/` werden **generiert und nie von Hand bearbeitet**.

```bash
# 1. Endzustand in supabase/schemas/ ändern
# 2. Migration erzeugen und reviewen
supabase db diff -f beschreibender_name
# 3. Anwenden
supabase db reset
```

Zum Ausprobieren während der Entwicklung `supabase db query` nutzen — das
schreibt keine Migrationshistorie und lässt sich frei wiederholen.

Die Reihenfolge der Schemadateien steht in `config.toml` unter `schema_paths`;
Elterntabellen müssen vor ihren Fremdschlüsseln kommen.

## Dokumentation

- [Produktvision](docs/VISION.md) — Features, Module, Datenschutz-Konzept
- [Roadmap](docs/ROADMAP.md) — in welcher Reihenfolge die Issues abgearbeitet werden
- [AGENTS.md](AGENTS.md) — Hinweise für KI-Agenten

## Hinweis zu nativen Modulen

Barcode-Scanner, lokale Datenbank, Benachrichtigungen und der sichere
Session-Speicher laufen **nicht in Expo Go**. Dafür wird ein Development Build
gebraucht ([#27](https://github.com/goldjunge91/fam/issues/27)).
