# Epic 2 Fundament: Outbox-Enqueue (#46) + Sync-Engine Pull/Push/Konfliktauflösung (#47)

## Context

Epic 2 (Offline & Sync, Welle 2, Issues #45–#51) ist der laut Roadmap "technisch riskanteste Teil" der App. #45 (SQLite-Schema/Migrator) und #49 (Konfliktauflösungs-Unit-Tests) sind bereits fertig und grün; `resolve.ts`, `coalesce.ts` und `backoff.ts` existieren als vollständig getestete, reine Funktionen. Was fehlt, ist die eigentliche Sync-Engine: der Pfad, über den lokale Schreibzugriffe in die Outbox gelangen (#46), und die Pull/Push-Orchestrierung gegen Supabase, die `resolve`/`coalesce`/`backoff` tatsächlich benutzt (#47 — "Herzstück von Epic 2").

**Bewusste Scope-Entscheidung (mit dem Nutzer abgestimmt):** Dieser Plan deckt ausschließlich #46 + #47 ab. #48 (Realtime→SQLite-Bridge), #50 (Netzwerkstatus/Background-Sync) und #51 (Offline-Indikator-UI) hängen alle von #47 ab und werden erst geplant, sobald diese Engine steht und getestet ist.

**Zweite Entscheidung:** Es gibt noch keinen "aktiver Haushalt"-Hook/Context in der App — Welle 4 (Haushalt erstellen/beitreten) hat noch nicht begonnen. Die Engine wird deshalb **haushalts-parametrisiert** gebaut (`householdIds` als expliziter Parameter) und **nicht** in `src/app/_layout.tsx` oder irgendeine Komponente eingehängt. Sie ist ein eigenständiges, vollständig getestetes Modul — genau wie `resolve.ts`/`coalesce.ts`/`backoff.ts` — und wird erst verdrahtet, wenn Epic 4 einen echten Household-Context liefert.

**Verifizierte Korrektur gegenüber der ursprünglichen Annahme:** `src/lib/db/schema.integration.test.ts` läuft NICHT über `bun run test` — `jest.config.js` schließt `*.integration.test.ts` explizit aus (`testPathIgnorePatterns`). Es läuft ausschließlich über `bun run test:integration`, das eine laufende lokale Supabase-Instanz voraussetzt (`test/setup-integration.js`), auch wenn diese konkrete Suite selbst kein Netzwerk anfasst. Konvention in diesem Repo: reine Funktionen ohne I/O → `*.test.ts` via `bun run test`; alles, was einen echten `SqlDatabase`-Treiber (node:sqlite) ODER echtes Supabase anfasst → `*.integration.test.ts` via `bun run test:integration`. Kein Mocking (CLAUDE.md: "DONT USE MOCK") — durchgehend echte Engines (`test/node-sqlite-adapter.ts`, echte lokale Supabase-Instanz).

**Zweite Verifikation:** `@supabase/postgrest-js` liefert bei einem echten Netzwerkfehler (Flugmodus, DNS) `status: 0`, nicht `null` (bestätigt in `node_modules/@supabase/postgrest-js/src/PostgrestBuilder.ts:453`). Das Push-Error-Handling muss `status === 0 → null` mappen, bevor es `classifyError()` aufruft — dessen Vertrag behandelt nur `null` als "Request hat den Server nie erreicht".

## Neue Module und ihre öffentliche API

### `src/lib/db/entities.ts` — rein, kein I/O
Pro-Entity-Metadaten, gemeinsam genutzt von Pull, Push und künftigen Outbox-Enqueue-Aufrufern.

```ts
export type EntityMeta = {
  entity: Entity;
  table: string;
  hasServerTombstone: boolean;   // false nur bei 'products'
  householdScoped: boolean;      // false nur bei 'products'
  columns: readonly string[];    // ohne updated_at/deleted_at/_dirty, id zuerst
};

export const ENTITIES: Readonly<Record<Entity, EntityMeta>>;
export const ALL_ENTITIES: readonly Entity[];
export function hasServerTombstone(entity: Entity): boolean;
export function metaOf(entity: Entity): EntityMeta;
```

`columns` pro Entity (1:1 aus `migrations.ts`'s `V1_MIRRORS`, minus Sync-Spalten):
- `storage_locations`: `id, household_id, name, kind, sort_order, created_at`
- `fridge_items`: `id, household_id, location_id, product_id, name, quantity, unit, expiry_date, added_by, created_at`
- `shopping_list_items`: `id, household_id, product_id, name, quantity, unit, category, sort_index, checked_at, checked_by, added_by, created_at`
- `products`: `id, barcode, name, brand, kcal_per_100, protein_g_per_100, carbs_g_per_100, fat_g_per_100, fiber_g_per_100, sugar_g_per_100, salt_g_per_100, serving_size_g, source, created_by, created_at`

### `src/lib/sync/cursor.ts` — rein, kein I/O

```ts
export const EPOCH_START: string; // '1970-01-01T00:00:00Z' — Cursor fuer den allerersten Pull
export function toEpochMs(pgTimestamp: string): number; // wirft bei unparsbarem Input
```

`Date.parse` ist auf PostgRESTs rohem `timestamptz`-Text nicht vertrauenswürdig (`Z` vs. `+00:00`, 0–6 Nachkommastellen). Implementierung: Regex zerlegt `YYYY-MM-DDTHH:MM:SS(.ffffff)?(Z|±HH:MM|±HHMM|±HH)?`, kürzt Nachkommastellen auf 3 (JS-`Date`-Auflösungsgrenze), normalisiert das Offset-Format, erst dann `Date.parse` auf den kanonischen String. Wirft mit dem Original-String in der Fehlermeldung bei Nicht-Match — Schema-Drift schlägt laut fehl statt still `NaN` zu produzieren.

Präzisionsverlust auf Millisekunden ist sicher: Der tatsächliche Pull-Filter nutzt immer den **rohen, unveränderten String** aus `sync_state.last_synced_at` — `toEpochMs`-Rundung überspringt nie eine Zeile beim nächsten Pull. Sie wirkt nur auf lokale Sortierung/Anzeige und `resolve()`s Vergleich, und beide Seiten dieses Vergleichs durchlaufen dieselbe Kürzung.

### `src/lib/sync/server-clock.ts` — reine Parsing-Funktion + dünner Fetch-Wrapper

```ts
export function parseDateHeader(value: string | null): number | null; // rein

export type ServerClock = { fetch: typeof fetch; serverNowMs(): number | null };
export function createServerClock(baseFetch?: typeof fetch): ServerClock;
export function clockCeiling(clock: ServerClock, fallbackNowMs: number): number;
```

`createServerClock` liefert eine `fetch`-kompatible Funktion, die an `baseFetch` delegiert, den `Date`-Response-Header jeder Antwort liest und den letzten erfolgreich geparsten Wert merkt — ohne zusätzlichen Round-Trip (der `Date`-Header ist auf jeder PostgREST/Supabase-REST-Antwort vorhanden; Sekundenpräzision reicht, um den tatsächlichen #49-Fehlerfall zu fangen: eine Geräteuhr, die um Monate/Jahre danebenliegt). `clockCeiling` fällt nur beim allerersten Aufruf einer Session auf die eigene Uhr zurück, und selbst dann nur als Obergrenze, nie als Autorität — passend zu `resolve.ts`s bestehendem Vertrag.

**Kopplung, die das erzeugt:** Der `TypedSupabaseClient`, der der Engine übergeben wird, muss mit `createClient(url, key, { global: { fetch: serverClock.fetch } })` gebaut sein. `src/lib/supabase.ts`s `getSupabase()`-Singleton tut das heute nicht — dieser Plan ändert das nicht (App-Verdrahtung, verschoben auf Epic 4). Für die Tests dieses Plans wird der Client wie in `auth.integration.test.ts` direkt konstruiert, nicht über `getSupabase()`.

### `src/lib/db/outbox.ts` — DB-anfassend (nimmt `SqlDatabase` entgegen)

Hier lebt #46. Braucht eine echte Transaktion, kann nicht rein sein; ist eine DB-Primitive, keine Sync-Algorithmus-Logik — gehört nach `src/lib/db/`, nicht `src/lib/sync/`.

```ts
export function parseOutboxEntry(entry: OutboxEntry): Record<string, unknown>;
// verschoben aus coalesce.ts's privatem parsePayload — siehe Sequencing Schritt 4

export type EnqueueMutationInput = {
  entity: Entity;
  entityId: string;
  op: OutboxOp;
  payload: Record<string, unknown>; // volle Zeile bei insert, geaenderte Felder bei update; household_id muss enthalten sein
  applyLocally: (txn: SqlDatabase) => Promise<void>; // Aufrufer schreibt die Spiegeltabelle
  now?: number; // injizierbare Uhr, Default Date.now()
};
export async function enqueueMutation(db: SqlDatabase, input: EnqueueMutationInput): Promise<void>;

export async function loadDueOutboxEntries(db: SqlDatabase, nowMs: number): Promise<OutboxEntry[]>;
// select * from outbox where next_attempt_at <= ? and attempts < ? order by id asc

export async function deleteOutboxEntries(db: SqlDatabase, ids: readonly number[]): Promise<void>;

export async function recordOutboxOutcome(
  db: SqlDatabase, ids: readonly number[],
  outcome: { attempts: number; lastError: string; nextAttemptAtMs: number },
): Promise<void>;
```

`enqueueMutation` kennt bewusst keine Spaltenliste irgendeiner Spiegeltabelle. Der Aufrufer liefert `applyLocally`, das gegen das übergebene Transaktions-Handle läuft (nie gegen das äußere `db`); `enqueueMutation` bündelt es mit dem Outbox-Insert in einem `withExclusiveTransactionAsync`-Aufruf. Erfüllt damit strukturell alle drei #46-Akzeptanzkriterien: dieselbe Transaktion (atomarer Abbruch), kein `await` auf Netzwerk darin (sofort/optimistisch), ein werfendes `applyLocally` rollt beide Writes zurück.

### `src/lib/db/sync-state.ts` — DB-anfassend

```ts
export type SyncCursor = { lastSyncedAt: string; lastSyncedId: string };
export async function readSyncState(db: SqlDatabase, entity: Entity, scope?: string): Promise<{ cursor: SyncCursor | null; lastError: string | null }>;
export async function writeSyncCursor(txn: SqlDatabase, entity: Entity, cursor: SyncCursor, lastRunAtMs: number, scope?: string): Promise<void>;
export async function recordSyncError(db: SqlDatabase, entity: Entity, error: string, scope?: string): Promise<void>;
```

### `src/lib/sync/mirror-write.ts` — DB-anfassend, gemeinsam von Pull und Push genutzt

```ts
export async function upsertMirrorRow(
  txn: SqlDatabase, entity: Entity, remoteRow: Record<string, unknown>, options: { dirty: 0 | 1 },
): Promise<void>;
```

Ein gemeinsamer Remote→Lokal-Zeilenschreiber, damit das uuid/timestamptz→text/epoch-ms-Mapping an genau einer Stelle existiert und identisch von Pulls "eingehende Remote-Zeile anwenden" und Pushs "Server-Antwortzeile anwenden" genutzt wird.

### `src/lib/sync/push.ts` — Netzwerk + DB

```ts
export type PushOutcome =
  | { kind: 'pushed' | 'discarded'; entity?: Entity; entityId?: string; sourceIds: number[] }
  | { kind: 'failed-transient' | 'failed-permanent'; entity: Entity; entityId: string; sourceIds: number[]; error: string };
export type PushResult = { outcomes: PushOutcome[]; stoppedEarly: boolean };

export async function pushOutbox(deps: {
  db: SqlDatabase; supabase: TypedSupabaseClient; now?(): number;
}): Promise<PushResult>;
```

### `src/lib/sync/pull.ts` — Netzwerk + DB

```ts
export type PullOutcome = { entity: Entity; pagesFetched: number; rowsWritten: number; rowsSkippedAsLocalWins: number };

export async function pullHousehold(deps: {
  db: SqlDatabase; supabase: TypedSupabaseClient;
  householdIds: readonly string[]; clockCeilingMs: number;
  entities?: readonly Entity[]; // Default ALL_ENTITIES
}): Promise<PullOutcome[]>;
```

### `src/lib/sync/engine.ts` — Top-Level-Orchestrator

```ts
export type SyncRunResult = { push: PushResult; pull: PullOutcome[] };

export async function syncHousehold(deps: {
  db: SqlDatabase;
  supabase: TypedSupabaseClient;   // muss mit serverClock.fetch gebaut sein
  serverClock: ServerClock;
  householdIds: readonly string[];
  now?(): number;
}): Promise<SyncRunResult>;
```

Push läuft **vor** Pull: derselbe Lauf's Pull beobachtet danach sofort die soeben gepushte Zeile (mit dem autoritativen Server-`updated_at`) und setzt `_dirty` über den ohnehin idempotenten Upsert-Pfad zurück auf 0, statt die Spiegelzeile bis zum nächsten Zyklus dirty zu lassen.

## Interaktion mit bestehendem Code

- `resolve()` wird genau einmal pro Remote-Zeile in `pull.ts` aufgerufen, nur wenn die passende lokale Zeile `_dirty = 1` hat. Nie aus `push.ts` — Postgres hat kein Compare-and-Swap auf `updated_at` (der `before update`-Trigger setzt unconditional `new.updated_at := now()`), der Server nimmt einen Write immer an und stempelt einen neuen, autoritativen Timestamp, egal was er überschreibt. `resolve()`s Job ist enger als naiv gelesen: es entscheidet, was die **lokale Spiegeltabelle kurzzeitig anzeigt**, während ein Push aussteht/in der Queue ist — insbesondere ob ein eingehender Remote-Tombstone trotz ausstehender lokaler Änderung angezeigt wird. Es entscheidet nie, ob gepusht wird.
- `coalesce()` wird einmal pro `pushOutbox()`-Lauf aufgerufen, auf dem Batch von `loadDueOutboxEntries`.
- `backoffDelayMs()`/`classifyError()`/`MAX_ATTEMPTS` werden aus `push.ts`s Pro-Entry-Fehlerpfad aufgerufen (siehe Fehlerbehandlung unten), inkl. der `status: 0 → null`-Zuordnung vor `classifyError`.
- `SqlDatabase`/`withExclusiveTransactionAsync`: jeder Write innerhalb einer Transaktion läuft auf dem `txn`-Handle, nie auf dem äußeren `db`.
- `getSupabase()`/`TypedSupabaseClient` werden aus `sync/*` in diesem Plan nicht aufgerufen — jede Funktion nimmt `supabase: TypedSupabaseClient` als expliziten Parameter entgegen (die geforderte Haushalts-Parametrisierung). Echte App-Verdrahtung ist Epic 4.

## Row-Mapping

**Pull (remote → lokal, in `upsertMirrorRow`)**: für jede `column` in `metaOf(entity).columns` wird `remoteRow[column]` unverändert übernommen (uuid→text und date→text brauchen keine JS-Transformation, numeric→real kommt bereits als JS-Number). Separat: `updated_at = toEpochMs(remoteRow.updated_at)`, `deleted_at = meta.hasServerTombstone && remoteRow.deleted_at ? toEpochMs(remoteRow.deleted_at) : null` (bei `products` bleibt `deleted_at` immer null), `_dirty = options.dirty`.

```sql
insert into <table> (<columns>, updated_at, deleted_at, _dirty)
values (?, ?, ..., ?, ?, ?)
on conflict(id) do update set
  <col1> = excluded.<col1>, ..., updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at, _dirty = excluded._dirty
```

**Push (lokal → remote, in `push.ts`s Payload-Builder)**:
- `insert`: volle Outbox-Payload minus `updated_at`/`deleted_at`/`_dirty` — `id` (client-generierte UUID, wird echter PK) und `created_at` bleiben.
- `update`: nur geänderte Felder aus `coalesce()`s gemergter Payload, ohne `updated_at`/`deleted_at`/`_dirty`/`id` (id geht in `.eq('id', entityId)`). `updated_at` nie senden — der Server überschreibt es ohnehin unconditional.
- `delete`: kein echtes SQL-Delete (Remote nutzt Soft-Delete). Synthetisiere `{ deleted_at: new Date().toISOString() }`, sende als `update`. Präzision irrelevant, da `resolve()` nur `deletedAt !== null` testet; LWW-Ordering läuft immer über `updated_at`. Bei `hasServerTombstone === false` (`products`) wird ein `delete`-Op sofort als permanenter Fehler behandelt (kein Retry) statt versucht.
- Nach erfolgreichem `insert`/`update`/`delete-als-update`: `.select('*')` anhängen, zurückgegebene Zeile durch dasselbe `upsertMirrorRow(txn, entity, returnedRow, { dirty: 0 })` schreiben wie beim Pull — in derselben lokalen Transaktion, die die gepushten Outbox-Zeilen löscht.

## Pagination-Strategie

`supabase/config.toml` deckelt `max_rows = 1000`; `PAGE_SIZE = 500` als sicherer Default.

`updated_at` allein ist **kein** sicherer Cursor: `create_household()` fügt drei `storage_locations` in einer Transaktion ein — Postgres' `now()` ist für die ganze Transaktion stabil, alle drei teilen sich denselben `updated_at`-Wert. Jede Bulk-Operation hat dasselbe Tie-Risiko. Deshalb Keyset-Pagination über `(updated_at, id)` — passend zum bereits existierenden `products_updated_idx on public.products (updated_at, id)`.

Cursor rückt **nur nach Commit einer vollständigen Seiten-Transaktion** vor (nie mitten in einer Seite):

```ts
supabase.from(meta.table)
  .select('*')
  .in('household_id', householdIds)          // entfaellt komplett bei products
  .or(`updated_at.gt.${cursorTs},and(updated_at.eq.${cursorTs},id.gt.${cursorId})`)
  .order('updated_at', { ascending: true })
  .order('id', { ascending: true })
  .limit(500)
```

Äquivalentes SQL:
```sql
select * from fridge_items
where household_id in (:household_ids)
  and (updated_at > :cursor_ts or (updated_at = :cursor_ts and id > :cursor_id))
order by updated_at asc, id asc
limit 500;
```

Initialer Cursor: `(EPOCH_START, '')`. Schleife endet, wenn eine Seite weniger als `PAGE_SIZE` Zeilen liefert oder null Zeilen.

**Risiko, früh zu validieren (Sequencing Stufe 3, Schritt 8):** der `.or(...)`-String ist der unsicherste Teil dieses Plans — muss gegen die echte lokale Supabase-Instanz geprüft werden, insbesondere ob `+`/`:`/`.` im Timestamp die Query-String-Kodierung von `.or()` unbeschädigt überstehen. Fallback bei Scheitern: eine dedizierte Postgres-RPC pro Entity mit nativem Tupel-Vergleich `where household_id = any($1) and (updated_at, id) > ($2, $3) order by updated_at, id limit $4` — das WÄRE eine Schemaänderung und müsste durch den deklarativen Workflow (`supabase/schemas/*.sql` → `bun run db:diff -f <name>` → Review → `db:reset`/`db:push`, nie handgeschrieben, per `AGENTS.md`). Nicht Teil dieses Plans, außer die Spike zeigt, dass `.or()` scheitert.

## Idempotenz-Garantie

- **Pull**: `on conflict(id) do update` macht erneutes Anwenden derselben Seite wirkungslos (gleiche Werte zweimal geschrieben). Ein Crash zwischen Fetch und Commit einer Seite holt beim nächsten Lauf einfach dieselbe Seite erneut (Cursor rückte nicht vor).
- **Push, Erfolgspfad**: Outbox-Zeilen werden erst nach tatsächlichem Netzwerkerfolg gelöscht, in derselben Transaktion wie das Schreiben der Server-Antwortzeile.
- **Push, echte Lücke + Fix**: Wenn der Netzwerkaufruf erfolgreich ist, die App aber vor dem lokalen Commit (Outbox-Löschung + Server-Zeile-Upsert) beendet wird, würde ein naiver Retry denselben `insert` mit derselben `id` erneut senden → Postgres lehnt mit Unique-Violation ab (`error.code === '23505'`, PostgREST mappt auf HTTP 409). `classifyError(409)` liefert `'permanent'` — ohne Sonderbehandlung würde der Eintrag fälschlich terminal, obwohl die Daten längst sicher auf dem Server sind. **Fix:** ein `insert`, der `23505` bekommt, fällt zurück auf ein `update` gegen dieselbe `id` mit derselben Payload (idempotent durch Konstruktion). `update`/`delete-als-update` brauchen diesen Sonderfall nicht — bereits idempotent unter Retry.
- **Doppelter voller Sync-Lauf**: Push findet ein leeres Due-Set, Pulls erste Seite pro Entity liefert null Zeilen, Schleife endet sofort ohne Schreiben — verifizierbar mit dem bestehenden `countingDatabase()`-Test-Decorator.

## Transaktionsgrenzen

Nach dem Vorbild von `runMigrations` (DDL + `PRAGMA user_version` in einer Transaktion) und SQLites Single-Writer-Modell:

- **Outbox-Enqueue (#46)**: eine `withExclusiveTransactionAsync` pro Mutation = Spiegel-Write + Outbox-Insert. Nie über mehrere User-Aktionen gebündelt.
- **Pull**: eine Transaktion **pro Seite**, nicht pro Zeile, nicht pro Entity/Lauf. Pro-Zeile wären hunderte Mini-Transaktionen; pro-Entity/Lauf würde SQLites exklusiven Write-Lock über viele sequentielle Netzwerk-Round-Trips halten und jeden gleichzeitigen lokalen Write blockieren.
- **Push**: initiales `discardable`-Aufräumen ist eine Transaktion (gebündeltes `delete ... where id in (...)`, kein Netzwerk dazwischen). Jeder einzelne gecoalescte Push bekommt seine **eigene** kleine Transaktion (Erfolg: Outbox-Zeilen löschen + Server-Zeile upserten; Fehler: `attempts`/`last_error`/`next_attempt_at` schreiben), verschachtelt mit dem (nicht-transaktionalen) Netzwerkaufruf.
- `syncHousehold()` selbst öffnet nie direkt eine Transaktion — reine Sequenz vieler unabhängiger lokaler Transaktionen aus `pushOutbox`/`pullHousehold`.

## Fehlerbehandlung Push — Zustandsautomat

Pro gecoalescten Eintrag in `applyOnePush`:

1. Request senden.
2. **Erfolg** → `sourceIds` aus `outbox` löschen, Server-Antwortzeile mit `_dirty = 0` upserten, eine Transaktion. Terminal.
3. **Fehler, `error.code === '23505'` bei `insert`** → einmalig als `update` gegen dieselbe `id` mit derselben Payload retryen; Ergebnis wie (2) behandeln.
4. **Fehler, sonst** → `status = rawStatus === 0 ? null : rawStatus`; `kind = classifyError(status)`.
   - `kind === 'transient'`: `nextAttempts = currentAttempts + 1`. Bei `nextAttempts >= MAX_ATTEMPTS` (5): terminal — `attempts = nextAttempts`, `last_error`, `next_attempt_at = Number.MAX_SAFE_INTEGER` (dauerhaft ausgeschlossen aus `loadDueOutboxEntries`s `attempts < MAX_ATTEMPTS`-Filter — "terminal" ist einfach `attempts >= MAX_ATTEMPTS`, keine neue Spalte nötig). Sonst `attempts = nextAttempts`, `next_attempt_at = now + backoffDelayMs(currentAttempts)`. Der ganze `pushOutbox`-Lauf **stoppt hier** (`stoppedEarly: true`) — erhält die Erstellungsreihenfolge der restlichen Queue.
   - `kind === 'permanent'`: sofort `attempts = MAX_ATTEMPTS` (überspringt inkrementellen Backoff), `last_error`, `next_attempt_at = Number.MAX_SAFE_INTEGER`. Lauf **läuft weiter** zum nächsten Eintrag — eine vergiftete Zeile darf die Queue nicht dauerhaft blockieren.

`last_error`/`attempts` existieren bereits als Outbox-Spalten genau dafür — keine Schemaänderung nötig, damit ein künftiges #51-UI `select * from outbox where attempts >= 5` abfragen kann.

## Sequencing

**Stufe 1 — reine Grundlagen** (`*.test.ts`, `bun run test`):
1. `src/lib/db/entities.ts` + Test
2. `src/lib/sync/cursor.ts` + Test
3. `src/lib/sync/server-clock.ts`s reine Hälfte (`parseDateHeader`) + Test
4. Aufräumen: `coalesce.ts`s privates `parsePayload` nach `src/lib/db/outbox.ts` als `parseOutboxEntry` verschieben, `coalesce.ts` importiert es; `coalesce.test.ts` bleibt unverändert grün.

**Stufe 2 — DB-anfassende Primitiven** (`*.integration.test.ts` gegen node:sqlite, `bun run test:integration`):
5. `src/lib/db/outbox.ts` (Rest: `enqueueMutation`, `loadDueOutboxEntries`, `deleteOutboxEntries`, `recordOutboxOutcome`) — #46s eigentliches Ergebnis, eigenständig landbar ohne Netzwerkabhängigkeit.
6. `src/lib/db/sync-state.ts`
7. `src/lib/sync/mirror-write.ts`

**Stufe 3 — netzwerkanfassend, echtes lokales Supabase** (`*.integration.test.ts`, `bun run test:integration`):
8. Spike/Test zur Validierung des `.or()`-Keyset-Filters gegen die echte lokale Instanz — VOR dem Festlegen in `pull.ts`. Höchstes Unsicherheitsrisiko des ganzen Plans, soll früh und billig scheitern falls falsch.
9. `src/lib/sync/push.ts` — hängt nur von Stufe 1+2 ab, unabhängig von pull.ts.
10. `src/lib/sync/pull.ts` — hängt von Stufe 1+2+`mirror-write.ts`+dem validierten Filter aus Schritt 8 ab.
11. `src/lib/sync/engine.ts` (`syncHousehold`) — dünne Komposition aus 9+10, plus die Cross-Device-End-to-End-Tests als eigentlicher Nachweis der #47-Akzeptanzkriterien.

## Test-Plan

| Datei                                           | Art                                                            | Läuft über                 | Beweist                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------- | -------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/db/entities.test.ts`                   | rein                                                           | `bun run test`             | 4 Entities, `hasServerTombstone` nur bei `products` false, Spaltenlisten                                                                                                                                                                                                                                                                          |
| `src/lib/db/entities.integration.test.ts`       | node:sqlite                                                    | `bun run test:integration` | `entities.ts`-Spalten matchen echtes migriertes Schema via `PRAGMA table_info`                                                                                                                                                                                                                                                                    |
| `src/lib/sync/cursor.test.ts`                   | rein                                                           | `bun run test`             | `Z` vs `+00:00`, 0/3/6 Nachkommastellen, ungültiger Input wirft                                                                                                                                                                                                                                                                                   |
| `src/lib/sync/server-clock.test.ts`             | rein                                                           | `bun run test`             | `parseDateHeader` valide/fehlend/kaputt; `createServerClock` mit handgeschriebener Fetch-Funktion (kein Modul-Mock)                                                                                                                                                                                                                               |
| `src/lib/sync/server-clock.integration.test.ts` | echtes Supabase                                                | `bun run test:integration` | echter Request durch Client mit `{ global: { fetch: clock.fetch } }` befüllt `serverNowMs()` nahe `Date.now()`                                                                                                                                                                                                                                    |
| `src/lib/db/outbox.integration.test.ts`         | node:sqlite                                                    | `bun run test:integration` | **#46 AC1/AC3**: `enqueueMutation` schreibt Spiegel+Outbox atomar; werfendes `applyLocally` hinterlässt keine Zeile in beiden Tabellen; `loadDueOutboxEntries`/`deleteOutboxEntries`/`recordOutboxOutcome` Round-Trip inkl. `attempts < MAX_ATTEMPTS`-Ausschluss                                                                                  |
| `src/lib/db/sync-state.integration.test.ts`     | node:sqlite                                                    | `bun run test:integration` | Cursor Read/Write rundtrippt den rohen String unverändert                                                                                                                                                                                                                                                                                         |
| `src/lib/sync/mirror-write.integration.test.ts` | node:sqlite                                                    | `bun run test:integration` | Upsert schreibt korrekte Typen; `products.deleted_at` bleibt immer null                                                                                                                                                                                                                                                                           |
| `src/lib/sync/push.integration.test.ts`         | echtes Supabase                                                | `bun run test:integration` | insert/update/delete-als-update Payload-Shapes landen korrekt; client-gesendetes `updated_at` wird nachweislich ignoriert; Backoff/`classifyError`-Wiring (403 via fremde `household_id` → permanent, terminal nach einem Versuch; 5xx/offline → transient, `stoppedEarly: true`, terminal bei `MAX_ATTEMPTS`); `23505`-Retry-als-Update-Fallback |
| `src/lib/sync/pull.integration.test.ts`         | echtes Supabase                                                | `bun run test:integration` | **#47 Pagination**: >500 Zeilen seeden, `pagesFetched > 1`, jede Zeile genau einmal; Tombstones gepullt; dirty lokal + neuer remote → resolve waehlt remote; dirty lokal + aelter remote → lokaler Wert bleibt; doppelter Pull ohne Aenderung = No-Op (`countingDatabase`)                                                                        |
| `src/lib/sync/engine.integration.test.ts`       | echtes Supabase, zwei unabhängige Clients (2 Geräte simuliert) | `bun run test:integration` | **#47 AC1** offline erstelltes Item erscheint auf Gerät B; **AC2** gleichzeitige Edits konvergieren auf beiden Geräten identisch; **AC3** offline-Delete auf A bleibt auf B geloescht, auch bei unsynced unrelated Edit auf B; **AC4** zweifacher `syncHousehold()`-Lauf erzeugt keine Duplikate                                                  |

## Migrationsbedarf

**Keine Schemaänderung für diesen Plan nötig.** Server-Zeit für `clockCeiling` kommt aus dem `Date`-HTTP-Response-Header (kein dediziertes RPC nötig). Client-gesendetes `deleted_at` bei einem Delete-Push nimmt an keiner Ordering/Konflikt-Entscheidung teil (siehe oben) — harmlos für Korrektheit.

Optionaler, nicht Teil dieses Plans: `private.set_updated_at()` künftig auch `new.deleted_at := now()` stempeln lassen für eine spätere "vor N Minuten gelöscht"-UI. Falls verfolgt: nur über den deklarativen Workflow (`supabase/schemas/01_private.sql` → `bun run db:diff -f <name>` → Review → `db:reset` → `db:diff` leer), nie handgeschrieben.

Einzige *bedingte* Schemaänderung: die Keyset-Pagination-RPC als Fallback (siehe Pagination-Abschnitt), nur falls der `.or()`-Filter in der Stufe-3-Spike scheitert.

## Kritische Dateien

- `src/lib/db/types.ts` — bestehende Typen, wiederverwenden
- `src/lib/db/migrations.ts` — Schema-Referenz für Spaltenlisten
- `src/lib/sync/resolve.ts`, `src/lib/sync/coalesce.ts`, `src/lib/sync/backoff.ts` — wiederverwenden, nicht neu implementieren
- `src/lib/db/client.ts` — `SqlDatabase`-Port-Vertrag
- `src/lib/supabase.ts` — `TypedSupabaseClient`-Typ (Client selbst wird in Tests separat konstruiert, nicht über `getSupabase()`)
- `supabase/schemas/08_inventory.sql`, `supabase/schemas/05_products.sql` — Remote-Schema-Referenz für Row-Mapping
- `test/node-sqlite-adapter.ts` — Testmuster für node:sqlite
- `test/setup-integration.js` — Testmuster für echtes lokales Supabase

## Verifikation

Nach jeder Sequencing-Stufe:
1. Stufe 1: `bun run test` — alle neuen `*.test.ts` grün, `coalesce.test.ts` weiterhin grün nach der `parseOutboxEntry`-Extraktion.
2. Stufe 2: `bun run test:integration` — neue `*.integration.test.ts` gegen node:sqlite grün.
3. Stufe 3 Schritt 8: Spike gegen laufende lokale Supabase-Instanz (`supabase status` muss laufen) — Filter-String validiert, bevor `pull.ts` darauf aufbaut.
4. Stufe 3 Schritt 9–11: `bun run test:integration` — Push/Pull/Engine-Suiten grün, inkl. der Zwei-Geräte-Konvergenz- und Idempotenz-Tests, die #47s Akzeptanzkriterien direkt beweisen.
5. Am Ende: `bun run check` (Biome) und `bun run typecheck` sauber, vollständiger `bun run test` + `bun run test:integration`-Lauf grün, `bun run db:diff` weiterhin leer (keine Schemaänderung in diesem Plan).
6. GitHub: #46 und #49 (bereits fertig) sowie #47 mit Verweis auf die grünen Test-Läufe schließen — #48/#50/#51 bleiben offen für den nächsten Plan.
