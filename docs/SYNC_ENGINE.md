# Sync-Engine — Architektur

Fundament aus Epic 2 (Welle 2, #45–#51): der Weg, auf dem eine lokale Änderung
über die Outbox zum Server gelangt (#46), die Pull/Push-Orchestrierung, die
dabei Last-Write-Wins anwendet (#47), die Realtime→SQLite-Bridge (#48) und die
Netzwerk-/Hintergrund-Sync-Trigger (#50). Dieses Dokument beschreibt den
gebauten Zustand — die Task-Liste für das, was noch fehlt, steht in
`ROADMAP.md` (#51, App-Verdrahtung ab Epic 4) und den GitHub-Issues, nicht hier.

## Scope-Grenze

Die Engine ist **haushalts-parametrisiert**: jede Funktion nimmt
`householdIds`/`supabase`/`db` explizit als Parameter entgegen. Sie ist
**nicht** in `src/app/_layout.tsx` oder irgendeine Komponente eingehängt —
dafür gibt es noch keinen "aktiver Haushalt"-Context (Welle 4 hat noch nicht
begonnen). Wer die Engine später verdrahtet, ruft `syncHousehold()` mit den
Haushalts-IDs des angemeldeten Nutzers auf; wie diese IDs ermittelt werden,
ist Sache von Epic 4. Dasselbe gilt für #48/#50: `subscribeHouseholdRealtime()`
nimmt `householdIds` entgegen statt sie selbst aufzulösen,
`startNetworkReconnectTrigger()`/`registerBackgroundSync()` nehmen einen
caller-gelieferten Callback statt selbst `syncHousehold()` aufzurufen. Diese
PR ändert dadurch **kein beobachtbares App-Verhalten** — nichts davon wird von
`_layout.tsx` aus aufgerufen.

## Module

| Datei | Art | Zweck |
|---|---|---|
| `src/lib/db/entities.ts` | rein | Pro-Entity-Metadaten (Tabellenname, `hasServerTombstone`, `householdScoped`, Spaltenliste) |
| `src/lib/sync/cursor.ts` | rein | `toEpochMs` — robustes Parsen von PostgREST-`timestamptz`-Text |
| `src/lib/sync/server-clock.ts` | rein + Fetch-Wrapper | Serverzeit aus dem `Date`-Response-Header, für `resolve()`s `clockCeiling` |
| `src/lib/db/outbox.ts` | DB | Outbox-Primitiven: `enqueueMutation`, `loadDueOutboxEntries`, `deleteOutboxEntries`, `recordOutboxOutcome`, `parseOutboxEntry` |
| `src/lib/db/sync-state.ts` | DB | Pull-Cursor lesen/schreiben (`sync_state`) |
| `src/lib/sync/mirror-write.ts` | DB | Gemeinsamer Remote→Lokal-Zeilenschreiber (Pull und Push) |
| `src/lib/sync/push.ts` | Netzwerk + DB | Outbox abarbeiten |
| `src/lib/sync/pull.ts` | Netzwerk + DB | Inkrementeller Pull je Entity |
| `src/lib/sync/engine.ts` | Orchestrator | `syncHousehold()` — Push vor Pull |
| `src/lib/sync/realtime.ts` | Netzwerk + DB | `subscribeHouseholdRealtime()` — Postgres-Changes → SQLite (#48) |
| `src/lib/sync/reconnect.ts` | rein | `detectReconnect()` — Offline→Online-Flankenerkennung (#50) |
| `src/lib/sync/network-trigger.ts` | natives Modul, ungetestet | `startNetworkReconnectTrigger()` — `expo-network`-Wrapper um `reconnect.ts` (#50) |
| `src/lib/sync/background-sync.ts` | natives Modul, ungetestet | `defineBackgroundSyncTask()`/`registerBackgroundSync()` — `expo-background-task`/`expo-task-manager`-Wrapper (#50) |

Bereits vorhanden und wiederverwendet, nicht neu gebaut: `resolve.ts` (LWW +
Tombstone-Entscheidung), `coalesce.ts` (Outbox-Reduktion), `backoff.ts`
(Backoff-Delays + Fehlerklassifikation).

## #48 — Realtime → SQLite Bridge

Ein Channel je Haushalt (`household:<id>`, passend zur AC-Formulierung "Subscription
je aktivem Haushalt", nicht je Tabelle), mit zwei `postgres_changes`-Bindings
darauf — nur `fridge_items` und `shopping_list_items` sind in der
`supabase_realtime`-Publication (`supabase/schemas/10_realtime.sql`);
`storage_locations` und `products` liefern keine Events.

**Echo-Unterdrückung: kein Extra-Mechanismus nötig, sondern eine Konsequenz
der bestehenden Konstruktion.** `push.ts` schreibt die Server-Antwortzeile
bereits synchron mit dem Push-Erfolg lokal (`_dirty=0`), in derselben
Transaktion, die die Outbox-Zeilen löscht. Ein Realtime-Echo dieses Writes
trifft entweder auf eine bereits identische, nicht-dirty Zeile (wirkungsloser
Upsert), oder — falls es vor dem lokalen Write eintrifft — auf eine dirty
Zeile mit älterem Zeitstempel; `resolve()` wählt dann zwangsläufig `'remote'`
(der Server-`updated_at` ist autoritativ und wurde frühestens beim
optimistischen lokalen Write gestempelt). Der Realtime-Pfad ruft dabei nie
`enqueueMutation` auf — er schreibt ausschließlich über
`applyRemoteRow`/`deleteMirrorRow` direkt in die Spiegeltabelle. Es gibt damit
strukturell keinen Weg zurück in die Outbox, also keinen Weg zu einer
Schleife. Bewiesen (nicht nur behauptet) in `realtime.integration.test.ts`.

**Reconnect → voller Pull.** Ein `hasDisconnected`-Flag pro Channel wird nur
bei `CHANNEL_ERROR`/`TIMED_OUT` gesetzt. Der nächste `SUBSCRIBED`-Übergang
danach löst `onReconnectResyncNeeded()` aus (caller-geliefert, typischerweise
`() => syncHousehold(...)`) — der allererste `SUBSCRIBED` beim initialen
Connect zählt bewusst nicht (dafür ist der App-Start-Sync des Aufrufers
zuständig). Ein sauberer `unsubscribe()` setzt `hasDisconnected` nicht — ein
erneutes Abonnieren danach ist ein "erster Connect", kein Reconnect.

**Kein Modul-weites Register.** Die zurückgegebene `() => void` ruft
`supabase.removeChannel(channel)` (nicht nur `channel.unsubscribe()` — erst
`removeChannel` entfernt den Channel auch aus `supabase.getChannels()`) für
jeden von diesem Aufruf erzeugten Channel. Der einzige Zustand ist die
Closure über die Channel-Liste dieses einen Aufrufs — ein erneuter Aufruf mit
anderen `householdIds` nach dem Unsubscribe ist dadurch sicher, ohne dass
irgendetwas Buch führen muss.

**Bekannte Einschränkung dieser Umgebung:** Der WebSocket-Client
(`client.realtime.disconnect()`) hängt sich beim Teardown in den lokalen
Integrationstests selbst auf. `test:integration` läuft deshalb mit
`--forceExit` — betrifft nur den Prozessabschluss nach Testende, nicht die
Testergebnisse.

**Test-Daten und Cleanup:** Jeder Integrationstest, der `setupTwoDevices()`
nutzt, erzeugt echte Supabase-Benutzer, einen Haushalt und verknüpfte Tabellen
in der lokalen bzw. CI-Datenbank. Ohne striktes Cleanup akkumulieren diese Daten
über Test-Läufe hinweg. Da der Haushalt den Ersteller als letzten Admin erzwingt
(Household-Admin-Constraint), schlägt ein reines Löschen des Benutzers per Auth-API
oder Dashboard fehl. Der Cleanup **muss** über die Service-Role per direkten
SQL-Deletes (erst Kind-Tabellen, dann `households`, dann User) erfolgen.
`setupTwoDevices()` liefert hierfür eine `teardown()`-Funktion zurück, die in
`afterEach` bzw. `afterAll` zwingend aufgerufen werden muss, da sonst
(besonders in der CI) die Datenbank und der Auth-Service nach dutzenden
verwaisten Test-Usern mit `504 Timeout` quittieren — was die Integrationstests
zuverlässig fehlschlagen lässt.

## #50 — Netzwerkstatus + Hintergrund-Synchronisation

Bewusst in zwei unabhängige, haushalts-freie Primitiven zerlegt, statt selbst
`syncHousehold()` aufzurufen:

- `startNetworkReconnectTrigger({ onReconnect, minIntervalMs? })` — dünner
  `expo-network`-Wrapper um `reconnect.ts`s reine `detectReconnect()`-Flanke,
  mit einer festen Cooldown-Schwelle (Default 10s) gegen flatternde
  Verbindungen. Bewusst **nicht** über `backoff.ts` — `backoffDelayMs`/
  `classifyError` sind an den Attempt-Zähler einer einzelnen Outbox-Zeile
  gebunden, nicht an eine boolesche Netzwerk-Flanke; das wäre eine
  Vermischung zweier unabhängiger Konzepte, keine Vereinfachung.
- `defineBackgroundSyncTask()`/`registerBackgroundSync()`/
  `setBackgroundSyncHandler()` — Wrapper um `expo-background-task`/
  `expo-task-manager`. `TaskManager.defineTask` muss laut Expo im globalen
  Modul-Scope laufen, nicht in einer Komponente — `defineBackgroundSyncTask()`
  ist trotzdem eine exportierte Funktion mit lazy `require()` (wie
  `client.ts`s `loadSQLite()`), die der Aufrufer einmal früh auf
  Anweisungsebene aufruft. Der veränderliche `handler`-Slot lässt die Task
  heute definieren und später (Epic 4) per `setBackgroundSyncHandler(fn)`
  verdrahten, ohne sie neu zu registrieren.

Realistische Erwartung, nicht nur Dokumentation: beide Plattformen
entscheiden selbst, wann Hintergrundarbeit läuft (iOS kann Intervalle stark
strecken oder ganz aussetzen) — Hintergrund-Sync ist eine Optimierung, kein
Verlass. Die App muss beim Öffnen immer selbst synchronisieren.

Kein automatisierter Test für `network-trigger.ts`/`background-sync.ts` —
beides sind reine native-Modul-Wrapper, die unter keinem der beiden
Jest-Setups laden (derselbe Umstand wie `src/lib/db/client.ts`). Die
eigentliche Logik (`detectReconnect`) ist bereits isoliert und für sich
getestet.

## Warum Push vor Pull

Derselbe Lauf's Pull beobachtet danach sofort die soeben gepushte Zeile (mit
dem autoritativen Server-`updated_at`) und setzt `_dirty` über den ohnehin
idempotenten Upsert-Pfad zurück auf 0 — statt die Spiegelzeile bis zum
nächsten Zyklus dirty zu lassen.

## Row-Mapping

**Pull (remote → lokal):** Spalten werden unverändert übernommen
(`uuid`→`text`, `date`→`text` brauchen keine JS-Transformation, `numeric`
kommt bereits als JS-Number). Separat: `updated_at = toEpochMs(remote.updated_at)`,
`deleted_at = hasServerTombstone ? toEpochMs(remote.deleted_at) : null`
(`products` hat serverseitig kein `deleted_at` und bleibt lokal immer `null`),
`_dirty` je nach Aufrufer (0 bei Pull, 0 nach erfolgreichem Push).

**Push (lokal → remote):**
- `insert`: volle Payload minus `updated_at`/`deleted_at`/`_dirty`. `id`
  (client-generierte UUID) und `created_at` bleiben.
- `update`: nur geänderte Felder, ohne `updated_at`/`deleted_at`/`_dirty`/`id`.
  `updated_at` wird nie gesendet — der `private.set_updated_at()`-Trigger
  überschreibt es serverseitig unconditional, ein Client kann LWW nicht durch
  eine erfundene Zeitangabe gewinnen.
- `delete`: kein echtes SQL-Delete — Remote nutzt Soft-Delete. Wird als
  `update` mit `{ deleted_at: <jetzt> }` gesendet. Bei Entities ohne
  Server-Tombstone (`products`) ist ein `delete` sofort ein permanenter
  Fehler, kein Versuch.
- Nach Erfolg: `.select('*')` anhängen, die zurückgegebene Zeile über
  denselben `upsertMirrorRow` schreiben wie beim Pull — in derselben lokalen
  Transaktion, die die gepushten Outbox-Zeilen löscht.

## Pagination

`updated_at` allein ist **kein** sicherer Cursor — Bulk-Inserts in einer
Transaktion (z. B. die drei Standard-Lagerorte aus `create_household()`)
teilen sich denselben Postgres-`now()`-Wert. Deshalb Keyset-Pagination über
`(updated_at, id)`, `PAGE_SIZE = 500` (unter `config.toml`s `max_rows = 1000`).
Cursor rückt nur nach Commit einer vollständigen Seiten-Transaktion vor, nie
mitten in einer Seite. Initialer Cursor: `(EPOCH_START, '')`.

`products` hat dafür einen dedizierten Index (`products_updated_idx on
products (updated_at, id)`), weil es global ist (kein `household_id`-Präfix).

## Idempotenz

- **Pull**: `on conflict(id) do update` — erneutes Anwenden derselben Seite
  ist wirkungslos. Ein Crash vor dem Commit einer Seite holt beim nächsten
  Lauf einfach dieselbe Seite erneut (Cursor rückte nicht vor).
- **Push, Erfolgspfad**: Outbox-Zeilen werden erst nach echtem Netzwerkerfolg
  gelöscht, in derselben Transaktion wie das Schreiben der Server-Antwort.
- **Push, der eine echte Fall**: Netzwerkaufruf erfolgreich, App stirbt vor
  dem lokalen Commit → ein naiver Retry sendet denselben `insert` erneut →
  Postgres lehnt mit `23505` (Unique-Violation) ab, PostgREST mappt auf 409.
  Ohne Sonderbehandlung würde `classifyError(409)` das als `'permanent'`
  einstufen und der Eintrag bliebe fälschlich terminal, obwohl die Daten
  längst sicher sind. Fix: ein `insert` mit `23505` fällt einmalig auf ein
  `update` gegen dieselbe `id` zurück (idempotent durch Konstruktion).

## Transaktionsgrenzen

- **Outbox-Enqueue**: eine `withExclusiveTransactionAsync` pro Mutation =
  Spiegel-Write + Outbox-Insert, atomar.
- **Pull**: eine Transaktion **pro Seite**. Pro-Zeile wären hunderte
  Mini-Transaktionen; pro-Lauf würde SQLites exklusiver Write-Lock über viele
  sequentielle Netzwerk-Round-Trips gehalten und jeden gleichzeitigen
  lokalen Write blockieren.
- **Push**: `discardable`-Aufräumen ist eine Transaktion (kein Netzwerk
  dazwischen). Jeder einzelne gecoalescte Push bekommt seine eigene kleine
  Transaktion, verschachtelt mit dem (nicht-transaktionalen) Netzwerkaufruf.
- `syncHousehold()` öffnet selbst nie eine Transaktion — reine Sequenz
  unabhängiger lokaler Transaktionen aus `pushOutbox`/`pullHousehold`.

## Push-Fehlerbehandlung — Zustandsautomat

1. Erfolg → Outbox-Zeilen löschen + Server-Zeile upserten, eine Transaktion.
2. `23505` bei `insert` → einmalig als `update` retryen, dann wie (1).
3. Sonst: `status = rawStatus === 0 ? null : rawStatus` (postgrest-js liefert
   bei echten Netzwerkfehlern `0`, nicht `null` — muss vor `classifyError()`
   gemappt werden), `kind = classifyError(status)`.
   - `transient`: `attempts++`; bei `attempts >= MAX_ATTEMPTS` terminal
     (`next_attempt_at = MAX_SAFE_INTEGER`), sonst `next_attempt_at = now +
     backoffDelayMs(attempts)`. Der ganze Push-Lauf **stoppt** — erhält die
     Erstellungsreihenfolge der restlichen Queue.
   - `permanent`: sofort `attempts = MAX_ATTEMPTS`, terminal. Lauf läuft
     **weiter** zum nächsten Eintrag — eine vergiftete Zeile blockiert die
     Queue nicht dauerhaft.

"Terminal" ist einfach `attempts >= MAX_ATTEMPTS`, keine eigene Spalte. Eine
künftige UI (#51) kann `select * from outbox where attempts >= 5` abfragen,
um dauerhaft fehlgeschlagene Einträge anzuzeigen.

## Was absichtlich fehlt

- Keine App-Verdrahtung (`_layout.tsx`, Hooks, Komponenten) — Epic 4. Weder
  `subscribeHouseholdRealtime` noch `startNetworkReconnectTrigger`/
  `registerBackgroundSync` werden von irgendwo im App-Code aufgerufen.
- Keine UI — #51 (separater Workstream/PR).
- Keine Schemaänderung — Serverzeit kommt aus dem `Date`-Header, kein
  dediziertes RPC nötig. Falls die Keyset-Pagination je auf eine
  Postgres-RPC umgestellt werden muss (siehe Kommentar in `pull.ts`), gilt
  der deklarative Workflow aus `AGENTS.md` — nie eine handgeschriebene
  Migration. Auch #48 braucht keine Schemaänderung: `storage_locations`/
  `products` der Realtime-Publication hinzuzufügen ist von keinem
  Akzeptanzkriterium gefordert, und `alter publication … add table` wird von
  `pg-delta` ohnehin nicht erfasst (siehe `AGENTS.md`s Known-Caveats-Tabelle).
