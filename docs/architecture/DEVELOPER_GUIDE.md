# Developer Guide

fam ist eine Expo-/React-Native-App für gemeinsame Haushaltsdaten und private
Tracking-Daten. Die App läuft ausschließlich auf iOS und Android mit nativen
Development Builds. Expo Go wird wegen SQLite, Kamera, SecureStore und
Notifications nicht verwendet.

Die vollständige Dokumentationslandkarte steht in
[docs/README.md](../README.md). Domänenbegriffe und Eigentümerschaft stehen in
[`CONTEXT.md`](../../CONTEXT.md), verbindliche Agent-Regeln in
[`AGENTS.md`](../../AGENTS.md).

## Schnellstart

```bash
bun install
bun start
bun run native:dev -- --target ios-development-simulator
```

Die App verwendet das in der gewählten Env-Datei konfigurierte Supabase-Ziel.
Agents starten oder stoppen keine lokale Supabase-Instanz eigenmächtig. Für
Schema- und Datenbanktests gelten die Freigaben und der Workflow aus
[`AGENTS.md`](../../AGENTS.md).

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
│   ├── constants/      # 🎨 Semantische UI-Primitiven und App-Konstanten
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

3. **Styling & Theme**: Projektweite Designentscheidungen liegen in
   [`src/components/theme/index.ts`](../../src/components/theme/index.ts),
   [`ThemeProvider.tsx`](../../src/components/theme/ThemeProvider.tsx) und
   [`src/constants/ui.tsx`](../../src/constants/ui.tsx). `react-native-unistyles`
   ist die aktive Styling-Runtime; semantische Farben, Typografie und Zustände
   kommen aus dem Design-System, lokales Layout aus nativen StyleSheets.

4. **Datenbank & Offline-Sync (Supabase + SQLite)**:
   - **Regel laut [`AGENTS.md`](../../AGENTS.md)**: Das Datenbank-Schema wird
     **ausschließlich deklarativ** unter `supabase/schemas/*.sql` bearbeitet.
     Du schreibst Migrationen niemals per Hand!
   - Die lokale SQLite-Datenbank sorgt dafür, dass die App auch ohne Internetverbindung funktioniert. Eine Outbox-Sync-Engine synchronisiert Änderungen im Hintergrund mit Supabase.

Geteilte Haushaltsdaten (Bestand, Einkaufsliste) und private Tracking-Daten
(Mahlzeiten, Gewicht, Ziele) sind auf Datenbankebene durch RLS getrennt. Der lokale
SQLite-Mirror mit Outbox ist der normale Schreibweg für synchronisierte Daten.

## Arbeitsabläufe

### Feature oder UI ändern

1. Route möglichst dünn halten und Fachlogik im passenden `src/features/`-Modul
   umsetzen.
2. Nur semantische Theme-Tokens und bestehende UI-Komponenten verwenden. Details:
   [Design-System-Verträge](../design-system/contracts/README.md).
3. Gegenläufige Nutzeraktion mitdenken, etwa Wiederherstellen zu Löschen.
4. Prüfen:

   ```bash
   bun run check
   bun run typecheck
   bun run test <gezielter-pfad>
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
bun run test <gezielter-pfad>  # Jest, nicht: bun test oder ungezielt alles
bun run test:db     # pgTAP, falls das Schema betroffen ist
```

Vor Änderungen an React-Native-Komponententests zuerst
`.agents/rules/react-native-testing-library.md` und die lokale Dokumentation
von `@testing-library/react-native` lesen.

#### Unistyles-Testgrenze

Unistyles v3 wird in Jest über `react-native-unistyles/mocks` geladen. Der Mock
steht in `jest.config.js` vor `src/components/theme/index.ts`, damit die
Konfiguration auf die bereitgestellten Stubs trifft. Das Babel-Plugin ist in
der Testumgebung automatisch deaktiviert.

Jest-Tests prüfen Verhalten, Accessibility, Interaktionen, Zustandswechsel und
reine Token- oder Domänenlogik. Sie prüfen nicht, wie Unistyles Styles parst
oder ob ein Element aufgrund von Theme, Breakpoints oder Insets sichtbar ist.
Assertions wie `toHaveStyle`, `.props.style`, `StyleSheet.flatten` und
abhängiges `toBeVisible` gehören deshalb nicht in neue Jest-Komponententests.

Die native Darstellung wird mit Maestro beziehungsweise den vorhandenen
E2E-Flows unter `.maestro/ios/flows/` und `.maestro/android/flows/` geprüft.
Das umfasst Theme-Wechsel, Style-Varianten, Keyboard-Insets, Layout und
visuelle Zustände. Die iOS-Suite wird vor der Android-Suite abgenommen.

Für Reanimated kombinieren wir Unistyles- und Animations-Styles über ein
Style-Array. Theme-Werte in Worklets kommen über `useAnimatedTheme` bzw.
`useAnimatedVariantColor` aus `react-native-unistyles/reanimated`. Für
Keyboard-Abstände verwenden wir `rt.insets.ime` im Unistyles-Callback, wo die
Komponente keinen separaten nativen Keyboard-Container benötigt.

Bestehende Style-Assertions gelten als Migrationsbestand. Neue Tests dürfen
ihn nicht vergrößern; einzelne Fälle werden bei Berührung auf Verhalten oder
Maestro verschoben.

### Development-Build-Targets

**iOS:**

- ios-development-simulator (Debug, Simulator, .app)
- ios-development-device (Debug, echtes Gerät, .ipa)
- ios-preview-testflight (Release, TestFlight, .ipa)
- ios-production (Release, Store, .ipa)

Android:

- android-development (.apk)
- android-preview (.apk)
- android-production (.aab)

Für deinen Fall (lokal im Simulator testen, ob expo-tracking-transparency jetzt
funktioniert) ist `ios-development-simulator` der richtige Target-Name.

`native:rebuild` ist bewusst der Release-Pfad (eas build --local,
reproduzierbar/signiert, für TestFlight/Production) und entsprechend
langsamer/schwerer. Für den reinen Inner-Loop (Simulator während der
Entwicklung, mit ccache/DerivedData-Wiederverwendung) ist `native:dev`
vorgesehen:

```bash
bun run native:dev -- --target ios-development-simulator
```

---

## Befehle

Maestro wird direkt über `.maestro/scripts/` gestartet. Dafür braucht es einen
installierten Dev Build, einen laufenden Metro-Server, ein erreichbares
Supabase-Backend und je nach Flow einen vorbereiteten Testaccount. `package.json`
enthält bewusst keine Maestro-Einstiege.

### Maestro-Architektur

Ausführbare User-Journeys liegen unter `.maestro/<platform>/flows/`. Jeder
Journey-Flow ist einzeln startbar, beschreibt die fachliche Reihenfolge direkt
und endet mit einer sichtbaren Zustandsprüfung. Wiederverwendbare Aufgaben
liegen unter `.maestro/<platform>/subflows/` und haben genau eine
Verantwortung, zum Beispiel Welcome, Login, Onboarding-Abschluss, Logout oder
Kaltstart. Ein Gesamt-Journey-Subflow wird nicht verwendet.

Die vier iOS-Kernjourneys sind:

1. `ios/flows/auth/onboarding-registration-successful.yaml` — Registrierung,
   lokale E-Mail-Bestätigung und Dashboard
2. `ios/flows/auth/onboarding-login-successful.yaml` — bestätigter Login und
   Dashboard
3. `ios/flows/auth/onboarding-invalid-credentials-forgot-password-login-successful.yaml`
   — falsches Passwort, falsche E-Mail, Reset-Anforderung und erfolgreicher
   Login
4. `ios/flows/session/sign-out-and-relaunch.yaml` — Login, Dashboard, Logout,
   Kaltstart und eigenständiger Sign-in-Screen

Der lokale iOS-Start ist ausschließlich der installierte fam-Development-Client:

```yaml
- openLink:
    link: "fam://expo-development-client/?url=${METRO_MANIFEST_URL}"
```

`METRO_MANIFEST_URL` wird URL-encodiert übergeben und zeigt standardmäßig auf
`http://127.0.0.1:8081`. Das ist ein Dev-Client-Deep-Link, kein Expo-Go-
`exp://`-Link. Auf einem physischen Gerät muss stattdessen die erreichbare
LAN-Adresse des Macs verwendet werden.

Die JavaScript-Dateien unter `.maestro/scripts/` erzeugen ausschließlich
Fixture-Daten oder lesen lokale Test-Mail. UI-Interaktionen bleiben in YAML.
Die Registrierungsjourney benötigt lokale Supabase-Mailzustellung über
Inbucket (`127.0.0.1:54324`) und endet erst nach Eingabe des sechsstelligen
Bestätigungscodes im echten UI. Ist Inbucket nicht erreichbar, ist nur dieser
Journey blockiert; die E-Mail-Bestätigung wird nicht abgeschaltet und es wird
kein Remote-Projekt verwendet.

Tags trennen zustandsabhängige oder manuelle Flows vom regulären Lauf:

- `fixture`: legt gezielt lokale Nutzer, Haushalte oder Einladungen an
- `local-session`: setzt eine bereits vorbereitete Session voraus
- `manual`: bleibt für interaktive UI-/Design-Abnahmen außerhalb des Smoke-Laufs

Die Plattformreihenfolge ist verbindlich: erst iOS-Kern und iOS-Domain-Flows,
dann Android. Die Android-Suite besitzt eigene `appId`, Config und Subflows;
zwischen den Plattformen werden keine Flow-Dateien geteilt.

### iOS, zuerst ausführen

```bash
# Reguläre iOS-Suite, ohne zustandsabhängige oder manuelle Flows
bun .maestro/scripts/maestro.ts test \
  --config .maestro/ios/config.yaml \
  --device <ios-simulator-udid> \
  --exclude-tags fixture,local-session,manual \
  .maestro/ios

# Einzelner iOS-Flow mit überschriebenen Credentials
bun .maestro/scripts/maestro.ts test \
  --config .maestro/ios/config.yaml \
  --device <ios-simulator-udid> \
  -e TEST_EMAIL=other@example.com \
  -e TEST_PASSWORD='Other123!' \
  .maestro/ios/flows/auth/onboarding-sign-in.yaml

# Bereits angemeldete Session prüfen
bun .maestro/scripts/maestro.ts test \
  --config .maestro/ios/config.yaml \
  --device <ios-simulator-udid> \
  .maestro/ios/flows/session/signed-in-dashboard.yaml

# Fixture-Flows mit frischen Accounts und lokalem Service-Role-Key
bun .maestro/scripts/e2e-household-create.ts
bun .maestro/scripts/e2e-household-join.ts

# Manueller Einkaufsbereich-Flow
bun .maestro/scripts/maestro.ts test \
  --config .maestro/ios/config.yaml \
  --device <ios-simulator-udid> \
  .maestro/ios/flows/shopping/shopping-category-alpha-manual.yaml
```

Der Dev-Client-Endpunkt wird als URL-encodierter Parameter übergeben, wenn
der Standard nicht passt, zum Beispiel
`-e METRO_MANIFEST_URL=http%3A%2F%2F127.0.0.1%3A8081`.

### Android, erst nach grüner iOS-Abnahme

```bash
# Reguläre Android-Suite; der Runner erkennt standardmäßig das ADB-Gerät
bun .maestro/scripts/android.ts

# Einzelner Flow relativ zu .maestro/android/flows
bun .maestro/scripts/android.ts auth/onboarding-sign-in.yaml \
  --device emulator-5554

# Einzelner Domain-Flow
bun .maestro/scripts/android.ts shopping/shopping-list-add-remove.yaml \
  --device emulator-5554
```

Einen Sammellauf über beide Plattformen gibt es absichtlich nicht als
Package-Script. Die Plattformen werden separat und in der Reihenfolge iOS,
dann Android, ausgeführt.

- `bun .maestro/scripts/lib/e2e-fixtures.ts` ist eine Bibliothek und kein
  eigenständiger Runner.
- `bun run user:create` / `bun run user:list` / `bun run user:clean` / `bun run user:delete` — Verwaltung lokaler Test-Accounts (`scripts/test-users.ts`)
- `bash scripts/create-user-with-household.sh` — Erstellt Test-User mit Haushalt und befüllter Einkaufsliste
- `bun run ios:testflight -- --app-version 0.0.2` (App-Versionsnummer anpassen)
- `bun run ios:testflight -- --build-number 10` (feste Build-Nummer vergeben)
- `bun run ios:testflight -- --no-bump` (ohne Hochzählen der Build-Nummer bauen)
- `bun run ios:testflight -- --skip-pods` (Pod-Installation überspringen für schnellen Rebuild)

### Test-Accounts & Skripte

Zum schnellen Testen mit einem bereits bereitgestellten lokalen Entwicklungs-
Backend. Die Skripte zielen fest auf `127.0.0.1:54321`; diese Variante gehört
nicht zum normalen Agent-Workflow und wird nicht eigenmächtig gestartet:

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
5. Neuer Dev-Client-Build nötig (`bun run native:dev` bzw. Android-Äquivalent),
   weil `@posthog/react-native-plugin` nativen Code enthält.

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

## Backend und Datenbanktests

Die App verwendet das in der gewählten Env-Datei konfigurierte Supabase-Ziel.
Lokale Supabase-Instanzen, Docker-Container und laufende Entwicklerprozesse
werden von Agents nicht eigenmächtig gestartet oder beendet. Für vorbereitete
Schema- und Datenbanktests gilt ausschließlich der deklarative Ablauf aus dem
Abschnitt [Datenbank ändern](#datenbank-ändern) und den Regeln in
[`AGENTS.md`](../../AGENTS.md).

Die technische Datenbankquelle ist `supabase/schemas/*.sql`; die lokale
SQLite-Spiegelung unter `src/lib/db/schemas/*.ts` ist davon getrennt.

## Development Build

Barcode-Scanner, lokale Datenbank, Benachrichtigungen und der sichere
Session-Speicher laufen ausschließlich im nativen Development Build:

Alles in einem Schritt — bauen, laden, installieren, Simulator und Metro starten:

```bash
bun run native:dev -- --target ios-development-simulator
bun run native:dev -- --target ios-development-simulator --device "iPhone 17"
```

Einzelschritte, falls nötig:

```bash
bun run native:dev -- --target ios-development-simulator
bun run native:dev -- --target android-development
bun run native:dev -- --target ios-development-device
```

Development-Targets sind nicht Teil des Native-Build-Locks. Der Lock gilt für
reproduzierbare Release-Artefakte wie TestFlight und Production. Für reine
JS-/TS-Änderungen reicht Metro; Änderungen an nativen Modulen, Config-Plugins
oder nativen Dateien erfordern einen neuen Development-Build.

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
| Styling | `src/components/theme/` + `src/constants/ui.tsx`, `react-native-unistyles` für native StyleSheets |
| Backend | Supabase (Postgres, Auth, Realtime, RLS) |
| Offline | `expo-sqlite` + Outbox-Sync (Pull/Push/LWW), mit Realtime-Bridge, Netzwerk-Reconnect, Background-Sync und Poll-Fallback |
| Server-State | TanStack Query |
| Tests | jest-expo + Testing Library, pgTAP-RLS-Tests |

`react-native-unistyles` ist die einzige aktive Styling-Runtime. Sie liefert
keine zweite Theme-Schicht: semantische Farben, Typografie, Flächen, Konturen
und Zustände kommen aus dem Design-System. Die verbindlichen Regeln stehen in den
[Design-System-Verträgen](../design-system/contracts/README.md).

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
Session-Speicher laufen ausschließlich im nativen Development Build
([#27](https://github.com/goldjunge91/fam/issues/27)).
