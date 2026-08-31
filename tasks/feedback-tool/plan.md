# Plan: Nutzer-Feedback-Tool (Anregungen/Fehler/Sonstiges)

## Context

Nutzer sollen Anregungen, Fehler oder sonstiges Feedback einreichen können,
dabei eine Ticket-Nummer sehen und benachrichtigt werden, wenn (a) das
Ticket auf "in Bearbeitung" gesetzt wird und (b) ein Dev geantwortet hat.

Es existiert **kein** bestehendes Feedback/Ticket-System im Code (recherchiert:
`shopping_category_feedback_events` ist ein unabhängiges, push-only
Telemetrie-Konzept ohne Ticket-Charakter). Der interne `gh`-Issue-Tracker
(`docs/agents/issue-tracker.md`) ist reiner Dev-Workflow, kein
Endnutzer-System — keine Kopplung.

Entscheidungen (mit Marco geklärt):
- **Dev-Antwortweg für v1:** kein Admin-UI in der App. Devs bearbeiten
  Status/Antworten direkt in Supabase Studio bzw. per `service_role`.
  Eine Website mit eigenem Ticket-Bereich ist geplant (nicht Teil dieses
  Plans) — das Schema wird deshalb so normalisiert, dass ein späteres
  Website-Interface (weiterhin über `service_role` oder eine künftige
  Staff-Rolle) ohne Schema-Bruch andocken kann.
- **Benachrichtigung für v1:** nur in-App via Supabase Realtime, während
  die App offen ist (kein FCM/APNs, kein Server-Push). Passt zum
  bestehenden Realtime-Setup (`supabase/schemas/10_realtime.sql`).

## Datenmodell

Zwei Tabellen, normalisiert (die initiale Nutzer-Nachricht ist die erste
Zeile in `feedback_messages`, kein Duplikat-Feld in `feedback_tickets`):

**`feedback_tickets`**
- `id uuid primary key default gen_random_uuid()`
- `ticket_number bigint generated always as identity` (fortlaufend,
  sichtbare Ticket-Nummer, z. B. `#142`)
- `user_id uuid not null references auth.users(id) on delete cascade`
- `type text not null check (type in ('bug', 'suggestion', 'other'))`
- `subject text not null`
- `status text not null default 'open' check (status in ('open', 'in_progress', 'answered', 'closed'))`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()` + `set_updated_at`-Trigger (Muster aus `01_private.sql`)

**`feedback_messages`**
- `id uuid primary key default gen_random_uuid()`
- `ticket_id uuid not null references public.feedback_tickets(id) on delete cascade`
- `author_type text not null check (author_type in ('user', 'staff'))`
- `author_id uuid references auth.users(id) on delete set null` (bei `staff` i. d. R. `null`, solange keine Staff-Accounts existieren)
- `body text not null`
- `created_at timestamptz not null default now()`

Indizes: `feedback_tickets(user_id)`, `feedback_messages(ticket_id)`.

**RLS (`feedback_tickets`):**
- `select`/`insert` nur eigene Zeilen (`user_id = (select auth.uid())`)
- **kein** `update`/`delete` für `authenticated` — Statuswechsel passiert
  ausschließlich über `service_role` (Supabase Studio / künftige Website)

**RLS (`feedback_messages`):**
- `select` nur Nachrichten zu eigenen Tickets (Subquery auf `feedback_tickets.user_id`)
- `insert` nur `author_type = 'user'`, `author_id = auth.uid()`, und nur
  wenn das Ticket dem Nutzer gehört und `status != 'closed'`
- **kein** `update`/`delete` für `authenticated`; `staff`-Nachrichten nur via `service_role`

**Privileges (`20_privileges.sql`):** neue Tabellen starten geschlossen,
dann selektive Grants analog `shopping_category_feedback_events`
(`grant select, insert on feedback_tickets to authenticated`, kein
`update`/`delete`; `service_role` erhält volle Rechte für beide Tabellen).

**Realtime (`10_realtime.sql`):** beide Tabellen mit
`replica identity full` zur `supabase_realtime`-Publication hinzufügen,
damit Statuswechsel/neue Antworten RLS-gefiltert live beim Client ankommen.

**Schema-Datei-Nummer:** muss vor `10_realtime.sql` laden (Publication
referenziert die Tabellen). Exakte Nummer beim Umsetzen gegen
`supabase/config.toml` (`schema_paths`) prüfen — voraussichtlich `04_feedback.sql`
(Lücke zwischen `03_households` und `05_products`), aber im Build-Schritt
verifizieren statt blind annehmen.

## Client-Feature: `src/features/feedback/`

Flache Struktur (analog `src/features/household/`, kein Feature dieser
Größe braucht Unterordner nach Verantwortungsschicht):

- `types.ts` — `FeedbackTicket`, `FeedbackMessage`, `FeedbackType`, `FeedbackStatus`
- `api.ts` — Supabase-Calls: `createTicket`, `listMyTickets`, `getTicket`, `listMessages`, `sendReply`
- `hooks.ts` — React-Query-Hooks (`useMyTickets`, `useTicket`, `useTicketMessages`, `useCreateTicket`, `useSendReply`), `query-keys.ts`-Konvention aus `household` übernehmen
- `use-feedback-realtime.ts` — Supabase-Realtime-Subscription auf `feedback_tickets`/`feedback_messages` (gefiltert auf `user_id`/eigene Tickets), invalidiert React-Query-Cache und liefert Events für Banner/Toast
- `feedback-form-screen.tsx` (+ `.test.tsx`) — Typ-Auswahl (Fehler/Anregung/Sonstiges), Betreff, Nachricht; nach Absenden Anzeige der Ticket-Nummer
- `feedback-list-screen.tsx` (+ `.test.tsx`) — "Meine Tickets" mit Status-Badges (offen/in Bearbeitung/beantwortet/geschlossen), Realtime-Live-Update
- `feedback-detail-screen.tsx` (+ `.test.tsx`) — Thread-Ansicht (alle `feedback_messages` inkl. initialer Nachricht), Antwort-Eingabe für den Nutzer, Realtime-Banner bei neuer Staff-Antwort/Statuswechsel
- `EXPLANATION.md` — Kurzdoku (Konvention wie `src/features/settings/EXPLANATION.md`)

**Routing (Expo Router, `src/app/settings/feedback/`):**
- `index.tsx` → `feedback-list-screen.tsx`
- `new.tsx` → `feedback-form-screen.tsx`
- `[id].tsx` → `feedback-detail-screen.tsx`

**Settings-Einstieg:** neue `SettingsRow` in der "App"-Gruppe von
`src/features/settings/settings-screen.tsx`, analog zum bestehenden
"Benachrichtigungen"-Eintrag (`router.push('/settings/feedback')`).

## Aufgaben (vertikale Slices)

```
1. DB-Schema (Fundament)
       │
   ┌───┴────┐
   2         3            ← parallel möglich (beide brauchen nur 1 + Types)
Ticket    Ticket-
erstellen Liste
   │         │
   └────┬────┘
        4                  ← braucht 2 (Ticket muss existieren) + 3 (Navigation aus Liste)
   Ticket-Detail/Thread
        │
        5                  ← braucht 3 + 4 (beide Screens für Live-Update)
   Realtime-Benachrichtigung
```

### 1. DB-Schema & RLS
- `supabase/schemas/0X_feedback.sql` (Nummer gegen `config.toml` verifizieren): Tabellen, Trigger, RLS-Policies wie oben
- `supabase/schemas/10_realtime.sql`: Publication-Einträge ergänzen
- `supabase/schemas/20_privileges.sql`: Grants/Revokes ergänzen
- `supabase/tests/0X_feedback.test.sql`: pgTAP nach Vorbild `04_invites.test.sql`/`01_privileges.test.sql` — eigene Tickets sichtbar, fremde nicht; Client kann keinen Status/keine Staff-Nachricht schreiben; `service_role` kann; `ticket_number` inkrementiert; `insert` auf geschlossenes Ticket schlägt fehl
- `bun run db:diff -- -f feedback` → `bun run test:db` → `bun run db:advisors` → `bun run db:diff` (muss leer sein) → `bun run db:types`

**Akzeptanzkriterien:** pgTAP-Suite grün, `db:diff` leer nach Migration, `database.types.ts` aktuell.

### 2. Ticket erstellen
- `types.ts`, `api.ts#createTicket`, `hooks.ts#useCreateTicket`
- `feedback-form-screen.tsx` + Route `src/app/settings/feedback/new.tsx`
- Settings-Menüeintrag

**Akzeptanzkriterien:** Nutzer wählt Typ, gibt Betreff/Nachricht ein, sendet ab, sieht danach die Ticket-Nummer. RNTL-Test: Formular-Validierung (leerer Betreff blockiert Absenden), erfolgreicher Submit zeigt Ticket-Nummer.

### 3. Ticket-Liste mit Status
- `api.ts#listMyTickets`, `hooks.ts#useMyTickets`
- `feedback-list-screen.tsx` + Route `src/app/settings/feedback/index.tsx`

**Akzeptanzkriterien:** eigene Tickets mit Status-Badge sichtbar, leere Liste zeigt Hinweistext. RNTL-Test: Liste rendert Status korrekt, leerer Zustand.

### 4. Ticket-Detail & Thread
- `api.ts#getTicket`, `#listMessages`, `#sendReply`; `hooks.ts` entsprechend
- `feedback-detail-screen.tsx` + Route `src/app/settings/feedback/[id].tsx`, Navigation aus der Liste

**Akzeptanzkriterien:** Thread zeigt initiale Nachricht + alle Antworten chronologisch; Nutzer kann bei offenem Ticket antworten, nicht bei geschlossenem. RNTL-Test: Thread-Reihenfolge, Antwort-Eingabe deaktiviert bei `status = 'closed'`.

### 5. Realtime-Benachrichtigung
- `use-feedback-realtime.ts`: Subscription in Liste (Statuswechsel) und Detail (neue Nachrichten)
- Banner/Toast bei `status → in_progress` und bei neuer `author_type = 'staff'`-Nachricht

**Akzeptanzkriterien:** Statusänderung während offener App aktualisiert Liste/Detail ohne manuelles Neuladen; sichtbares Signal (Toast/Banner) bei Übergang zu "in Bearbeitung" und bei neuer Dev-Antwort. Test: Realtime-Hook mit gemocktem Supabase-Channel löst Cache-Invalidierung + Callback aus.

## Verifikations-Checkpoints

1. Nach Aufgabe 1: `bun run test:db`, `bun run db:diff` leer, `bun run db:types` aktualisiert `database.types.ts`.
2. Nach Aufgabe 2+3: `bun run test -- feedback` grün, `bun run typecheck`, manueller Durchlauf (Ticket erstellen → in Liste sichtbar).
3. Nach Aufgabe 4: Detail-/Thread-Tests grün, Navigation Liste→Detail funktioniert.
4. Nach Aufgabe 5: Realtime-Hook-Test grün, `bun run check` + `bun run typecheck` für den gesamten Feature-Ordner.

## Risiken / bewusste Auslassungen

- **Kein Push bei geschlossener App** — akzeptiert für v1, siehe Klärung oben.
- **Kein In-App-Admin-UI** — Devs nutzen Supabase Studio/`service_role`; spätere Website übernimmt das, kein Schema-Bruch nötig dank normalisiertem `feedback_messages`.
- **Keine Staff-Rolle in der DB** — bewusst ausgelassen (YAGNI), bis die Website-Anbindung ansteht; dann eigenes Ticket/Issue.
