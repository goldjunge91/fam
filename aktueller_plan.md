## Festgelegte Zielarchitektur

| Information              |              Sentry |                     PostHog |                Aptabase |
| ------------------------ | ------------------: | --------------------------: | ----------------------: |
| Produkt-Events           | optional Breadcrumb |                          ja |           ja, identisch |
| Behandelte JS-Fehler     |                  ja |                          ja |                      ja |
| Unbehandelte JS-Fehler   |                  ja |                          ja |                      ja |
| Warnungen/Fehlerzustände |                  ja |                          ja |                      ja |
| Operationsdauer          |                  ja |                          ja |                      ja |
| Native Crashes/Hangs     |                  ja | technisch nur eingeschränkt | technisch nicht möglich |
| Session Replay           |                nein |                        nein |         nicht vorhanden |

Wichtige technische Grenze: Ein nativer `SIGABRT` beendet den Prozess, bevor JavaScript noch ein PostHog- oder Aptabase-Event senden kann. Aptabase dokumentiert ausdrücklich, dass native Nicht-JS-Crashes nicht erfasst werden ([SDK-README](/Users/marco/Github.tmp/family_app/fam/node_modules/@aptabase/react-native/README.md:138)). Sentry bleibt daher für den eigentlichen nativen Stack notwendig.

PostHog und Aptabase sollen aber alle vorausgehenden Aktionen sowie beim nächsten Start eine erkannte unsaubere Beendigung erhalten.

## Neuer konkreter Plan

### 1. VisionCamera-Labor hart deaktivieren

Der gesamte Code und alle Abhängigkeiten bleiben erhalten.

1. Lokalen Kill-Switch einführen:

```ts
export const VISION_CAMERA_LAB_ENABLED = false;
```

2. Zugriff nur erlauben, wenn beide Bedingungen gelten:

```ts
VISION_CAMERA_LAB_ENABLED && postHogFeatureFlag;
```

3. Kamera-Labor aus den Dev-Tools ausblenden oder als deaktiviert anzeigen.
4. Die Route darf `CameraScreen` bei ausgeschaltetem Kill-Switch niemals mounten.
5. Das PostHog-Flag allein darf das Labor nicht wieder aktivieren.
6. Spätere Reaktivierung erfolgt bewusst über eine einzige lokale Konstante.

Nicht löschen:

- `src/features/experimentalscreens/`
- `src/components/components_camera/`
- `react-native-vision-camera`
- `react-native-nitro-image`
- Feature Flag

Damit wird der bekannte iOS-26-Crash verhindert, ohne das Experiment wegzuwerfen.

### 2. Replay vollständig deaktivieren

Sentry:

- `SENTRY_REPLAY_DISABLE = true`
- Bei deaktiviertem Replay weder `replaysOnErrorSampleRate` noch `replaysSessionSampleRate` setzen.
- Bei bewusster Reaktivierung kleine Sample-Raten verwenden.
- `Sentry.mobileReplayIntegration()` entfernen

PostHog:

- Keine Replay-Komponente oder Replay-Integration installieren.
- Session Recording zusätzlich im PostHog-Projekt deaktivieren.
- Touch-Autocapture kann vorerst bleiben, ist aber kein Replay.

Aptabase hat kein Session Replay.

### 3. Zentrale Telemetrie als Fan-out bauen

Eine zentrale Schnittstelle unter `src/lib/telemetry/`:

```ts
trackEvent(name, properties);
reportError(error, context);
reportWarning(message, context);
addDiagnosticStep(name, context);
measureOperation(name, operation, context);
```

Fan-out:

```text
trackEvent
 ├─ PostHog.capture
 └─ Aptabase.trackEvent

reportError
 ├─ Sentry.captureException
 ├─ PostHog.captureException
 ├─ Aptabase.trackError
 └─ error.occurred an PostHog + Aptabase

reportWarning
 ├─ Sentry.captureMessage
 ├─ PostHog warning.occurred
 └─ Aptabase warning.occurred
```

Die installierte PostHog-Version besitzt bereits `captureException()` ([posthog-core.ts](/Users/marco/Github.tmp/family_app/fam/node_modules/@posthog/core/src/posthog-core.ts:1359)).

### 4. Strikte Parität zwischen PostHog und Aptabase

Beide erhalten:

- denselben Eventnamen
- dieselben Properties
- denselben Zeitstempel
- dieselbe `correlation_id`
- dieselbe Nutzer-ID
- denselben Fehlercode
- dieselbe Operation und Outcome

Da Aptabase weniger komplexe Properties unterstützt, wird der gemeinsame kleinste Datentyp verwendet:

```ts
type TelemetryValue = string | number;
type TelemetryProperties = Record<string, TelemetryValue>;
```

Boolean-Werte werden als `0` oder `1` normalisiert. Keine verschachtelten Objekte nur bei PostHog, weil dadurch die Dashboards wieder voneinander abweichen würden.

### 5. Einheitliches Event-Schema

Namenskonvention:

```text
domain.operation.outcome
```

Beispiele:

```text
db.open.started
db.open.completed
db.open.failed
auth.session.refresh_failed
sync.pull.completed
sync.pull.failed
shopping_item.create.completed
shopping_item.create.failed
camera.lab.blocked
app.previous_session.unclean
```

Gemeinsame Properties:

```text
correlation_id
operation
outcome
duration_ms
error_code
error_message
route
entity
platform
app_version
build_number
update_id
network_state
outbox_count
user_id
```

### 6. Alle bisherigen Sentry-Meldungen spiegeln

Bestehende Stellen mit `Sentry.captureException()` oder `captureMessage()` werden auf die zentrale Schnittstelle umgestellt.

Priorität:

1. React Query
2. Sync Pull und Push
3. Realtime-Setup
4. Query-Cache Restore/Persist
5. Legacy-Datenmigration
6. Brochure-Sync
7. Auth und Deep Links
8. Error Boundary

Damit wird beispielsweise der bisherige Sentry-Fehler:

```text
?anon_2__loop
```

in PostHog und Aptabase verständlich als:

```text
sync.pull.failed
```

mit folgenden Feldern sichtbar:

```text
entity=households
error_code=jwt_issued_in_future
network_state=online
retry_count=0
clock_skew_ms=...
```

### 7. Unbehandelte JS-Fehler erfassen

- Sentry behält seine automatische JS-Erfassung.
- Aptabase erhält `enableCrashReporting: true`.
- PostHog Exception-Autocapture wird aktiviert.
- React Error Boundary ruft zusätzlich zentral `reportError()` auf.
- Behandelte Fehler werden ausschließlich über `reportError()` gesendet.

Zur Duplikatkontrolle erhält jeder manuell gemeldete Fehler eine `error_id`. Automatisch erfasste und manuell gemeldete Fehler werden über Fingerprint, Nachricht, Route und kurzen Zeitabstand zusammengeführt.

### 8. Breadcrumbs als sichtbare Diagnose-Events spiegeln

Wichtige Zustandswechsel werden gleichzeitig:

- Sentry-Breadcrumb
- PostHog-Event
- Aptabase-Event

Nicht jeder Tap wird gespiegelt. Nur relevante Schritte:

```text
app.started
auth.session.restored
db.open.started
db.open.completed
household.selected
sync.started
sync.completed
route.changed
camera.lab.blocked
app.backgrounded
```

So lässt sich in PostHog und Aptabase die Sequenz vor einem Crash nachvollziehen.

### 9. Native Crashes indirekt spiegeln

Da PostHog und Aptabase den eigentlichen `SIGABRT` nicht mehr senden können:

1. Beim App-Start einen persistenten Session-Marker schreiben.
2. Bei sauberem Hintergrund/Shutdown Marker abschließen.
3. Bleibt er beim nächsten Start offen, senden:

```text
app.previous_session.unclean
```

Properties:

```text
previous_session_id
last_operation
last_route
last_event_at
seconds_since_last_event
app_version
build_number
```

Das ersetzt keinen nativen Stack, macht den Absturz aber in PostHog und Aptabase sichtbar und mit den vorausgehenden Events korrelierbar.

### 10. Reliability-Instrumentierung ergänzen

Zuerst instrumentieren:

- App-Start und Interaktivität
- Datenbanköffnung und SQLCipher-Cutover
- Auth Restore und Refresh
- Sync Pull/Push
- Outbox
- Realtime
- Netzwerkwechsel
- Background Sync
- Kamera-Kill-Switch
- App-Hangs und langsame Operationen

Operationen über beispielsweise 1.000 ms senden zusätzlich:

```text
operation.slow
```

Über 2.000 ms:

```text
operation.hanging
```

Dadurch wird der CSV-Eintrag `App Hanging: at least 2000 ms` in PostHog und Aptabase zeitlich eingrenzbar.

### 11. Produkt-Events angleichen

Alle direkten Aptabase-Aufrufe werden nicht entfernt, sondern auf den gemeinsamen Fan-out umgestellt:

- Haushalt erstellen/beitreten
- Barcode scannen
- Rezept erstellen
- Onboarding
- Käufe
- Screen View/Leave

Danach folgen:

- Einkaufsartikel erstellen, abhaken, wieder öffnen, löschen
- Bestand erstellen, ändern, verbrauchen
- Rezept bearbeiten, archivieren, wiederherstellen
- Mahlzeiten planen, ändern, entfernen
- Sync manuell auslösen
- Offline-Aktion erzeugen und später synchronisieren

Reverse States werden jeweils separat erfasst.

### 12. Dashboards aufbauen

PostHog:

- Fehler nach `error_code`
- letzte Diagnose-Events vor `app.previous_session.unclean`
- langsame Operationen
- Sync-Erfolgsquote
- Outbox-Alter und permanente Fehler
- Workflow-Funnels

Aptabase:

- dieselben Eventnamen und Properties
- Häufigkeiten nach App-Version
- Sync-/DB-/Auth-Fehler
- langsame Operationen
- Produktnutzung

Sentry:

- native Crashes
- App-Hangs
- symbolizierte Stacks
- Release-Regressions
- kein Replay

## Empfohlene Tasks-Aufteilung

1. VisionCamera hart deaktivieren, Replay abschalten, Router korrigieren
2. Telemetrie-Fan-out und gemeinsames Event-Schema (schema ordner ebachten)
3. Sentry-Meldungen nach PostHog und Aptabase spiegeln nur wo mit gering bis kein aufwand möglich
4. DB-, Auth-, Sync-, Outbox- und Hang-Diagnose
5. Bestehende Produkt-Events auf vollständige Parität bringen

Aptabase und das VisionCamera-Labor bleiben vollständig erhalten. Keine Dateien geändert und keine Tests gestartet.
