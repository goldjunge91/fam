# Sync-Engine — Architektur

Fundament aus Epic 2 (Welle 2, #45–#51): der Weg, auf dem eine lokale Änderung
über die Outbox zum Server gelangt (#46), und die Pull/Push-Orchestrierung,
die dabei Last-Write-Wins anwendet (#47). Dieses Dokument beschreibt den
gebauten Zustand — die Task-Liste für das, was noch fehlt, steht in
`ROADMAP.md` (#48, #50, #51) und den GitHub-Issues, nicht hier.

## Scope-Grenze

Die Engine ist **haushalts-parametrisiert**: jede Funktion nimmt
`householdIds`/`supabase`/`db` explizit als Parameter entgegen. Sie ist
**nicht** in `src/app/_layout.tsx` oder irgendeine Komponente eingehängt —
dafür gibt es noch keinen "aktiver Haushalt"-Context (Welle 4 hat noch nicht
begonnen). Wer die Engine später verdrahtet, ruft `syncHousehold()` mit den
Haushalts-IDs des angemeldeten Nutzers auf; wie diese IDs ermittelt werden,
ist Sache von Epic 4.

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

Bereits vorhanden und wiederverwendet, nicht neu gebaut: `resolve.ts` (LWW +
Tombstone-Entscheidung), `coalesce.ts` (Outbox-Reduktion), `backoff.ts`
(Backoff-Delays + Fehlerklassifikation).

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

- Keine App-Verdrahtung (`_layout.tsx`, Hooks, Komponenten) — Epic 4.
- Keine Realtime-Subscription — #48.
- Kein Netzwerkstatus-/Background-Sync-Trigger — #50.
- Keine UI — #51.
- Keine Schemaänderung — Serverzeit kommt aus dem `Date`-Header, kein
  dediziertes RPC nötig. Falls die Keyset-Pagination je auf eine
  Postgres-RPC umgestellt werden muss (siehe Kommentar in `pull.ts`), gilt
  der deklarative Workflow aus `AGENTS.md` — nie eine handgeschriebene
  Migration.
