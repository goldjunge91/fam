# SPEC: Nutzer-Feedback-Tool

Quelle: `tasks/feedback-tool/plan.md` (Aufgaben-Breakdown & Reihenfolge),
`tasks/feedback-tool/todo.md` (Checkliste).

## 1. Objective

Nutzer der Haushaltsapp können Anregungen, Fehler oder sonstiges Feedback
direkt aus der App einreichen. Sie sehen dabei eine sichtbare Ticket-Nummer
und werden — solange die App offen ist — live informiert, wenn (a) das
Ticket auf "in Bearbeitung" gesetzt wird oder (b) ein Dev geantwortet hat.

**Zielgruppe:** eingeloggte Nutzer, unabhängig von Haushalts-Zugehörigkeit
(`feedback_tickets` hängt nur an `user_id`, nicht an `household_id`).

**Explizit außerhalb des Scopes (v1):**
- Kein In-App-Admin-UI für Devs — Bearbeitung läuft über Supabase Studio
  bzw. `service_role`. Eine geplante Website mit eigenem Ticket-Bereich
  ist ein separates, künftiges Vorhaben; das Datenmodell ist bewusst so
  normalisiert, dass sie später ohne Schema-Bruch andocken kann.
- Kein Server-Push (FCM/APNs) — nur In-App-Realtime bei offener App.
- Nutzer können ihr eigenes Ticket nicht schließen; das macht ausschließlich
  Dev/`service_role`.

## 2. Commands

Keine neuen CLI-Kommandos. Bestehender Workflow gilt unverändert:

```bash
bun run db:diff -- -f feedback   # Migration aus supabase/schemas/*.sql erzeugen
bun run test:db                  # pgTAP-Suite (supabase/tests/)
bun run db:advisors              # Security/Performance-Check
bun run db:diff                  # muss danach leer sein
bun run db:types                 # database.types.ts aktualisieren

bun run test -- feedback         # Jest-Tests des Feature-Ordners
bun run typecheck
bun run check
```

## 3. Project Structure

**Backend (Supabase, deklarativ):**
```
supabase/schemas/0X_feedback.sql   # feedback_tickets, feedback_messages, RLS
                                    # (Nummer < 10_realtime.sql, gegen
                                    # config.toml schema_paths verifizieren —
                                    # voraussichtlich 04_feedback.sql)
supabase/schemas/10_realtime.sql   # + Publication-Einträge für beide Tabellen
supabase/schemas/20_privileges.sql # + Grants/Revokes
supabase/tests/0X_feedback.test.sql
```

**Client (`src/features/feedback/`, flach — analog `src/features/household/`):**
```
types.ts                    # FeedbackTicket, FeedbackMessage, FeedbackType, FeedbackStatus
api.ts                      # createTicket, listMyTickets, getTicket, listMessages, sendReply
hooks.ts                    # React-Query-Hooks (useMyTickets, useTicket, useTicketMessages,
                             # useCreateTicket, useSendReply)
use-feedback-realtime.ts    # Supabase-Realtime-Subscription, Cache-Invalidierung, Toast/Banner-Events
feedback-form-screen.tsx    # + .test.tsx
feedback-list-screen.tsx    # + .test.tsx
feedback-detail-screen.tsx  # + .test.tsx
EXPLANATION.md
```

**Routing (`src/app/settings/feedback/`):**
```
index.tsx   -> feedback-list-screen.tsx
new.tsx     -> feedback-form-screen.tsx
[id].tsx    -> feedback-detail-screen.tsx
```

**Settings-Einstieg:** neue `SettingsRow` "Feedback geben" in der
"App"-Gruppe von `src/features/settings/settings-screen.tsx`.

## 4. Datenmodell (Kern der Spec)

**`feedback_tickets`**
| Spalte | Typ | Anmerkung |
|---|---|---|
| `id` | `uuid pk` | `default gen_random_uuid()` |
| `ticket_number` | `bigint generated always as identity` | sichtbare Ticket-Nummer, z. B. `#142` |
| `user_id` | `uuid not null` | `references auth.users(id) on delete cascade` |
| `type` | `text not null` | `check in ('bug','suggestion','other')` |
| `subject` | `text not null` | |
| `status` | `text not null default 'open'` | `check in ('open','in_progress','answered','closed')` |
| `created_at`/`updated_at` | `timestamptz not null default now()` | `updated_at` per `set_updated_at`-Trigger |

**`feedback_messages`** (Thread; initiale Nutzer-Nachricht = erste Zeile, kein Duplikat-Feld)
| Spalte | Typ | Anmerkung |
|---|---|---|
| `id` | `uuid pk` | |
| `ticket_id` | `uuid not null` | `references feedback_tickets(id) on delete cascade` |
| `author_type` | `text not null` | `check in ('user','staff')` |
| `author_id` | `uuid` | `references auth.users(id) on delete set null`, bei `staff` meist `null` |
| `body` | `text not null` | |
| `created_at` | `timestamptz not null default now()` | |

Indizes: `feedback_tickets(user_id)`, `feedback_messages(ticket_id)`.

**RLS:**
- `feedback_tickets`: `select`/`insert` nur eigene Zeilen; **kein** `update`/`delete` für `authenticated` (auch nicht zum Selbst-Schließen — bewusste Entscheidung, siehe Boundaries).
- `feedback_messages`: `select` nur zu eigenen Tickets; `insert` nur `author_type='user'`, `author_id=auth.uid()`, eigenes Ticket, `status != 'closed'`; **kein** `update`/`delete`.
- Statuswechsel und `staff`-Nachrichten ausschließlich über `service_role`.

**Realtime:** beide Tabellen mit `replica identity full` in der
`supabase_realtime`-Publication (`10_realtime.sql`).

## 5. Testing Strategy

- **pgTAP** (`supabase/tests/0X_feedback.test.sql`, Vorbild `04_invites.test.sql` / `01_privileges.test.sql`):
  eigene Tickets sichtbar, fremde nicht; Client kann keinen Status/keine
  Staff-Nachricht schreiben; `service_role` kann; `ticket_number`
  inkrementiert; `insert` auf geschlossenes Ticket schlägt fehl.
- **RNTL** je Screen (`feedback-form-screen.test.tsx`,
  `feedback-list-screen.test.tsx`, `feedback-detail-screen.test.tsx`):
  Formular-Validierung + Ticket-Nummer-Anzeige nach Submit; Status-Badges
  + leerer Zustand; Thread-Reihenfolge + deaktivierte Antwort-Eingabe bei
  `closed`.
- **Realtime-Hook-Test:** gemockter Supabase-Channel löst
  Cache-Invalidierung und Toast/Banner-Callback bei Statuswechsel bzw.
  neuer `staff`-Nachricht aus.
- Vor Fertigstellung: `bun run check`, `bun run typecheck`,
  `bun run test -- feedback`, `bun run test:db`.

## 6. Boundaries

**Immer tun:**
- RLS auf beiden neuen Tabellen aktivieren, keine Tabelle ohne Policies live schalten.
- Migrationen ausschließlich über `bun run db:diff` aus `supabase/schemas/*.sql` erzeugen, nie von Hand.
- Nach jeder Schema-Änderung `bun run db:types` ausführen.

**Vorher fragen:**
- Bevor eine Staff-Rolle oder ein Admin-UI eingeführt wird (aktuell bewusst ausgelassen, YAGNI bis Website-Anbindung ansteht).
- Bevor echter Server-Push (FCM/APNs) ergänzt wird — eigenes, größeres Infra-Vorhaben.
- Bevor Nutzer das Recht bekommen, eigene Tickets zu schließen oder zu löschen.

**Nie tun:**
- Keine Migrationsdateien unter `supabase/migrations/` von Hand editieren.
- Keine `apply_migration`/Einweg-SQL-Anwendung gegen die lokale DB (lokale Supabase-Instanz laut AGENTS.md ohnehin nicht starten/stoppen).
- Keine vollständige Testsuite (`bun run test` ohne Filter) routinemäßig laufen lassen — nur `bun run test -- feedback`.

## Aufgaben-Reihenfolge

Siehe `tasks/feedback-tool/plan.md` (Abhängigkeitsgraph) und
`tasks/feedback-tool/todo.md` (Checkliste): 1) DB-Schema & RLS →
2)+3) Ticket erstellen / Ticket-Liste (parallel) → 4) Ticket-Detail &
Thread → 5) Realtime-Benachrichtigung.
