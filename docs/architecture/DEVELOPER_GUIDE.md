# Developer Guide

NutriTrack ist eine Expo-/React-Native-App für gemeinsame Haushaltsdaten und
private Ernährungsdaten. Die App läuft auf iOS und Android mit einem Dev Build;
Expo Go reicht wegen SQLite, Kamera, SecureStore und Notifications nicht aus.

Die vollständige Dokumentationslandkarte steht in [docs/README.md](README.md).

## Schnellstart

```bash
bun install
supabase start
bash scripts/ios-dev.sh
```

Für einen vorhandenen iOS-Build genügt `bash scripts/ios-dev.sh --reuse-last`.
Alle Befehle, Umgebungsvariablen und Test-Accounts stehen unten in diesem
Dokument. Das [Projekt-README](../../README.md) bleibt bewusst kurz und
verweist hierher.

## Architektur

```text
fam/
├── src/
│   ├── app/            # 🚦 NUR Routing & Navigation Expo-Routen und Navigation, 
│   ├── features/       # 🧱 Fachlogik nach Themen sortiert (Feature-First)
│   ├── components/     # 🎨 Wiederverwendbare allgemeine UI-Elemente
│   ├── constants/      # 🎨 Theme, Farben, Schriftarten, Abstände
│   ├── hooks/          # 🎣 App-weite React-Hooks (z.B. Theme, Network)
│   └── lib/            # ⚙️ Supabase-Client, Env-Handling, SQLite-Sync
├── supabase/
│   ├── schemas/        # 🗄️ Deklarative Datenbank-Schemas (*.sql)
│   └── tests/          # 🧪 Datenbank-Tests (pgTAP)
└── docs/               # 📖 Status, Roadmap & Vision
```

### 🧠 Die 4 Grundpfeiler des Systems

1. **Routing (`src/app/`)**: Expo Router nutzt **File-based Routing** (ähnlich wie Next.js). Erstellst du eine Datei `src/app/(app)/fridge.tsx`, entsteht automatisch der Screen für den Kühlschrank.
   - `(auth)/`: Screens für nicht eingeloggte Nutzer (Login, Register).
   - `(app)/`: Hauptanwendung mit Tab-Leiste (Kühlschrank, Rezept, Profil, etc.).

2. **Feature-Ordner (`src/features/<domain>/`)**: Die eigentliche Fachlogik liegt nicht in `src/app/`, sondern isoliert im jeweiligen Feature-Ordner. Ein typisches Feature (z.B. `fridge`) sieht so aus:
   - `components/`: UI-Bausteine nur für dieses Feature (z.B. `FridgeItemCard.tsx`).
   - `hooks/`: Daten-Hooks (z.B. `useFridgeItems.ts`).
   - `api.ts`: API-Aufrufe an Supabase / SQLite.
   - `types.ts`: TypeScript-Typen für dieses Feature.

3. **Styling & Theme (`src/constants/theme.ts`)**: In React Native wird mit standardmäßigem `StyleSheet.create({...})` gearbeitet. Farben und Abstände importierst du aus [`theme.ts`](file:///Users/marco/Github.tmp/family_app/fam/src/constants/theme.ts) (`Colors.light.accent`, `Spacing.three`).

4. **Datenbank & Offline-Sync (Supabase + SQLite)**:
   - **Regel laut [`AGENTS.md`](file:///Users/marco/Github.tmp/family_app/fam/AGENTS.md)**: Das Datenbank-Schema wird **ausschließlich deklarativ** unter `supabase/schemas/*.sql` bearbeitet. Du schreibst Migrationen niemals per Hand!
   - Die lokale SQLite-Datenbank sorgt dafür, dass die App auch ohne Internetverbindung funktioniert. Eine Outbox-Sync-Engine synchronisiert Änderungen im Hintergrund mit Supabase.

---
Shared household data (Bestand, Einkaufsliste) und private Daten (Tagebuch,
Gewicht, Ziele) sind auf Datenbankebene durch RLS getrennt. Der lokale
SQLite-Mirror mit Outbox ist der normale Schreibweg für synchronisierte Daten.

## Arbeitsabläufe

### Feature oder UI ändern

1. Route möglichst dünn halten und Fachlogik im passenden `src/features/`-Modul
   umsetzen.
2. Nur semantische Theme-Tokens und bestehende UI-Komponenten verwenden. Details:
   [Design-System](DESIGN_SYSTEM.md).
3. Gegenläufige Nutzeraktion mitdenken, etwa Wiederherstellen zu Löschen.
4. Prüfen:

   ```bash
   bun run check
   bun run typecheck
   bun run test
   ```

### Datenbank ändern

`supabase/schemas/*.sql` beschreibt ausschließlich den gewünschten Endzustand.
Migrationsdateien werden nie direkt bearbeitet.

```bash
# Schema ändern, dann:
bun run db:diff -- -f beschreibender_name
bun run db:reset
bun run test:db
bun run db:advisors
bun run db:diff
bun run db:types
```

Für neue Tabellen gehören RLS-Policies und passende pgTAP-Tests dazu. Änderungen
an synchronisierten Entitäten brauchen zusätzlich SQLite-Schema und Sync-Handler.

### Qualität und Tests

```bash
bun run check       # Biome: Lint und Format
bun run typecheck   # TypeScript
bun run test        # Jest, nicht: bun test
bun run test:db     # pgTAP, falls das Schema betroffen ist
```

Vor Änderungen an React-Native-Komponententests zuerst
`.agents/rules/react-native-testing-library.md` und die lokale Dokumentation
von `@testing-library/react-native` lesen.

bun run native:dev --
iOS:

- ios-development-simulator (Debug, Simulator, .app)
- ios-development-device (Debug, echtes Gerät, .ipa)
- ios-preview-simulator (Release, Simulator, .app)
- ios-preview-testflight (Release, TestFlight, .ipa)
- ios-production (Release, Store, .ipa)

Android:

- android-development (.apk)
- android-preview (.apk)
- android-production (.aab)

Für deinen Fall (lokal im Simulator testen, ob expo-tracking-transparency jetzt funktioniert) wäre ios-development-simulator der richtige Target-Name:

```bash
bun run native:rebuild -- --approve-rebuild --target ios-development-simulator
```

native:rebuild ist bewusst der Release-Pfad (eas build --local, reproduzierbar/signiert, für TestFlight/Production) und entsprechend langsamer/schwerer. Für den reinen Inner-Loop (Simulator während der Entwicklung, mit ccache/DerivedData-Wiederverwendung) ist native:dev vorgesehen:

```bash
bun run native:dev -- --target ios-development-simulator
```

---

## Befehle

- `bun run e2e` — Maestro-Flows gegen einen laufenden Simulator/Emulator
  (Dev Build + `supabase start` + Testaccount nötig, siehe
  `.maestro/flows/onboarding-sign-in.yaml`)
- `bun run e2e:signed-in` — schneller Maestro-Start auf der Übersicht; erhält
  den App-Zustand und setzt eine bereits gespeicherte Anmeldung voraus
- `bun run e2e:household-create` / `bun run e2e:household-join` — Haushalts-
  Erstellung/-Beitritt im Onboarding; seeden sich ihren Testaccount selbst
  (siehe `scripts/maestro/lib/e2e-fixtures.ts`)
- `bun run e2e:alpha` — Einkaufsbereiche-Alpha: automatische Einordnung,
  vollständiger Bereichs-Picker, manuelles Speichern/Abbrechen/Reset und
  Markt-Scope; jeder Flow erhält einen frischen Fixture-Account
- `bun run e2e:all` — führt die reguläre Suite und alle Fixture-Suites
  nacheinander aus
- `bun run user:create` / `bun run user:list` / `bun run user:clean` / `bun run user:delete` — Verwaltung lokaler Test-Accounts (`scripts/test-users.ts`)
- `bash scripts/create-user-with-household.sh` — Erstellt Test-User mit Haushalt und befüllter Einkaufsliste
- `bun run reset-project` — auf ein leeres Template zurücksetzen
- `bun run ios:testflight -- --app-version 0.0.2` (App-Versionsnummer anpassen)
- `bun run ios:testflight -- --build-number 10` (feste Build-Nummer vergeben)
- `bun run ios:testflight -- --no-bump` (ohne Hochzählen der Build-Nummer bauen)
- `bun run ios:testflight -- --skip-pods` (Pod-Installation überspringen für schnellen Rebuild)

### Test-Accounts & Skripte

Zum schnellen Testen auf der lokalen Entwicklungsdatenbank (`supabase start`):

Die Admin-Skripte benötigen `SUPABASE_SERVICE_ROLE_KEY` aus `supabase status`.
Der Wert wird nur als Umgebungsvariable übergeben und nie im Repository hinterlegt.

- **Bash Script (`scripts/create-user-with-household.sh`)**:
  - `./scripts/create-user-with-household.sh` — Erstellt 1 neuen Test-Nutzer mit eigenem Haushalt, Standard-Lagerorten und vorausgefüllten Einkaufslisten-Produkten.
  - `./scripts/create-user-with-household.sh <anzahl>` — Kann mehrmals oder mit einer Anzahl aufgerufen werden (z. B. `./scripts/create-user-with-household.sh 5`), um mehrere Test-User gleichzeitig mit jeweils eigenem Haushalt anzulegen.
  - `./scripts/create-user-with-household.sh [email] [passwort] [name] [haushalt]` — Erstellt einen spezifischen Nutzer mit individuellem Haushaltsnamen und Produkten.

- **TypeScript Helper (`scripts/test-users.ts`)**:
  - `bun run user:create [email] [passwort] [name]` — Erstellt einen einfachen Test-Account
  - `bun run user:list` — Listet vorhandene Test-Accounts auf
  - `bun run user:clean` — Löscht alle Test-Accounts (`*@example.com`, `tester_*`)
  - `bun run user:delete <email>` — Löscht einen bestimmten Test-Account
- **GLP-1-Demo (`scripts/glp1-seed.ts`)**:
  - `SUPABASE_SERVICE_ROLE_KEY=... bun run seed:glp1 [email]` — Befüllt den bestehenden lokalen Account mit einem wiederholbaren 12-Wochen-Verlauf
  - Den lokalen `service_role`-Key zeigt `supabase status`; er wird ausschließlich als Umgebungsvariable übergeben und niemals eingecheckt
  - Ohne E-Mail wird `maestro-e2e@example.com` verwendet; den Account bei Bedarf vorher mit `bun run user:create` anlegen
  - Das Skript löscht nur seine eigenen, deterministisch identifizierten Demo-Zeilen. Ein nicht-lokales Ziel wird standardmäßig abgewiesen.

Für ein bewusstes Remote-Ziel müssen URL und Service-Role-Key explizit gesetzt
werden. Die zusätzliche Freigabe verhindert, dass ein gehostetes Projekt aus
Versehen überschrieben wird:

```bash
GLP1_SEED_URL=https://example.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
GLP1_SEED_ALLOW_NON_LOCAL=true \
bun run seed:glp1 test@example.com
```

## Umgebungsvariablen

Die App lädt ihre Umgebung explizit über Bun-Skripte. Alle Dateien sind
gitignored und werden bewusst nicht mitgeliefert:

| Datei | Verwendung |
| --- | --- |
| `.env.local` | Lokale Supabase-Instanz und RevenueCat Test Store |
| `.env.development` | Gehostete Development-Datenbank und RevenueCat Test Store |
| `.env.preview` | TestFlight über `bun run ios:testflight` |
| `.env.production` | Reserviert für den späteren Produktions-Build |

Beispiel für lokale Entwicklung:

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_...
EXPO_PUBLIC_FORCE_ONBOARDING=false  # optional: bei true wird beim App-Start das Profil-Onboarding geöffnet
EXPO_PUBLIC_DEV_TOOLS=false         # optional: bei true erscheint der Entwickler-Bereich in den Einstellungen
EXPO_PUBLIC_OFF_OFFLINE=false       # optional: bei true werden alle Open-Food-Facts-Anfragen unterbunden (Offline-Test)
EXPO_PUBLIC_ADS_ENABLED=true        # optional: bei false werden Banner, Interstitials und die AdMob-SDK deaktiviert
EXPO_PUBLIC_POSTHOG_API_KEY=phc_... # optional: PostHog-Projekt-API-Key, siehe "Telemetrie und Feature Flags"
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com # optional, Default siehe unten
```

Expo lädt keine weiteren `.env`-Dateien dazu: Die Skripte setzen
`EXPO_NO_DOTENV=1` und `dotenv-cli` lädt genau die ausgewählte Datei.

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
| --- | --- | --- |
| URL | `supabase status` → API URL | Dashboard → Project Settings → API |
| Key | `supabase status` → **Publishable** | Dashboard → Publishable key |

Aktuelle Supabase-Versionen geben **Publishable** und **Secret** aus, nicht mehr
`anon` und `service_role`. In `EXPO_PUBLIC_SUPABASE_KEY` gehört der
Publishable Key — der Secret Key darf niemals in die App.

### Telemetrie und Feature Flags (PostHog)

PostHog (`posthog-react-native`) erhält Produkt-Events, behandelte und
unbehandelte Fehler, Diagnose-Schritte und native Crashes. Session Replay ist
bewusst deaktiviert. Produkt- und Diagnose-Events werden über `src/lib/telemetry`
identisch an PostHog und Aptabase verteilt. Ohne
`EXPO_PUBLIC_POSTHOG_API_KEY` bleibt das ein No-op — `useFeatureFlag()` liefert
dann immer den übergebenen `defaultValue`, App und Tests laufen auch ohne
PostHog-Account.

Die Analytics-Steuerung liegt unabhängig von den Provider-Schlüsseln in
`src/constants/analytics.ts`. Alle Werte sind standardmäßig aktiviert. Im
Entwickler-Bereich (`EXPO_PUBLIC_DEV_TOOLS=true`) lassen sich Aptabase,
PostHog, die Kanäle für Produkt-Events, Fehlerberichte und Diagnose sowie jede
Produkt-Feature-Domäne einzeln umschalten. Die Overrides gelten sofort, werden
lokal auf dem Gerät gespeichert und können dort vollständig zurückgesetzt
werden. Sentry bleibt von diesen Schaltern unabhängig.

Einmalige Einrichtung:

1. PostHog-Projekt anlegen ([posthog.com](https://posthog.com), kostenloser
   Tarif reicht) → **Project Settings > Project API Key** liefert den Key.
2. `EXPO_PUBLIC_POSTHOG_API_KEY` und den passenden
   `EXPO_PUBLIC_POSTHOG_HOST` in der Env-Datei eintragen.
3. Im PostHog-Projekt **Enable exception autocapture** aktivieren und Session
   Recording deaktiviert lassen.
4. Für Source-Maps und native Symbole `POSTHOG_CLI_API_KEY`,
   `POSTHOG_CLI_PROJECT_ID` und bei EU Cloud `POSTHOG_CLI_HOST` als Build-Secrets
   hinterlegen.
5. Neuer Dev-Client-Build nötig (`bash scripts/ios-dev.sh` bzw.
   Android-Äquivalent), weil `@posthog/react-native-plugin` nativen Code enthält.

**Integration testen:** Im Dashboard ein Boolean-Flag `test-feature` anlegen
und an/aus schalten — der Live-Wert steht im Entwickler-Bereich der
Einstellungen (`EXPO_PUBLIC_DEV_TOOLS=true`) unter „Umgebung" > „PostHog".
Kann danach wieder gelöscht werden.

Ein neues Flag anlegen:

1. Im PostHog-Dashboard unter **Feature Flags** ein neues Flag erstellen,
   z. B. `new-onboarding-flow` (Rollout: Prozentsatz oder Zielgruppe).
2. Den Key in `FeatureFlagKey` in `src/lib/posthog.ts` ergänzen.
3. In der Komponente abfragen — nie das SDK direkt importieren:

   ```tsx
   import { useFeatureFlag } from '@/lib/posthog';

   const showNewFlow = useFeatureFlag('new-onboarding-flow', false);
   ```

Flags sind an die Supabase-User-ID gebunden (nicht an die Haushalt-ID) —
PostHog ist personen-zentriert, Prozent-Rollouts und Zielgruppen-Targeting
laufen über diese ID (`src/features/auth/posthog-identity-sync.tsx`).

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
bash scripts/ios-dev.sh                # interaktiver Controller
bash scripts/ios-dev.sh --reuse-last   # registriertes Lock-Artefakt verwenden
bash scripts/ios-dev.sh --no-metro     # nur installieren
bash scripts/ios-dev.sh --device "iPhone 17"
```

Einzelschritte, falls nötig:

```bash
bun run native:run -- --target ios-development-simulator
bun run native:run -- --target android-development
bun run native:run -- --target ios-development-device

# Nur nach bewusster Freigabe: Prebuild und nativer Rebuild
bun run native:rebuild -- --target ios-development-simulator --approve-rebuild
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
| --- | --- |
| Runtime | Expo SDK 57, React Native 0.86, React 19.2 |
| Routing | Expo Router (NativeTabs, typedRoutes) |
| Styling | StyleSheet + `src/constants/theme.ts` |
| Backend | Supabase (Postgres, Auth, Realtime, RLS) |
| Offline | `expo-sqlite` + Outbox-Sync (Pull/Push/LWW), mit Realtime-Bridge, Netzwerk-Reconnect, Background-Sync und Poll-Fallback |
| Server-State | TanStack Query |
| Tests | jest-expo + Testing Library, pgTAP-RLS-Tests gegen lokales Postgres |

Kein NativeWind: die stabile Version 4.2.6 ist nicht für RN 0.86 / React 19 gebaut,
und die SDK-57-Variante gäbe es nur als Preview. Gestylt wird über `theme.ts`.

## Datenbankschema — Referenz

Das Projekt nutzt ausschließlich Supabases **Declarative Schema Workflow**. Der
gewünschte Endzustand steht in `supabase/schemas/*.sql`; die Dateien unter
`supabase/migrations/` werden **generiert und nie von Hand bearbeitet**.

```bash
# 1. Endzustand in supabase/schemas/ ändern
supabase db diff -f beschreibender_name  # 2. Migration erzeugen und reviewen
supabase db reset                        # 3. Anwenden
```

Zum Ausprobieren während der Entwicklung `supabase db query` nutzen — das
schreibt keine Migrationshistorie und lässt sich frei wiederholen.

Die Reihenfolge der Schemadateien steht in `config.toml` unter `schema_paths`;
Elterntabellen müssen vor ihren Fremdschlüsseln kommen.

## Hinweis zu nativen Modulen

Barcode-Scanner, lokale Datenbank, Benachrichtigungen und der sichere
Session-Speicher laufen **nicht in Expo Go**. Dafür wird ein Development Build
gebraucht ([#27](https://github.com/goldjunge91/fam/issues/27)).
