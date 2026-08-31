# Todo: Nutzer-Feedback-Tool

Plan: `tasks/feedback-tool/plan.md`

## 1. DB-Schema & RLS (Fundament)

- [ ] Schema-Nummer gegen `supabase/config.toml` (`schema_paths`) verifizieren (Vorschlag: `04_feedback.sql`, muss vor `10_realtime.sql` laden)
- [ ] `supabase/schemas/0X_feedback.sql`: `feedback_tickets` + `feedback_messages` (Spalten, Indizes, `set_updated_at`-Trigger)
- [ ] RLS-Policies: `feedback_tickets` (select/insert eigene, kein update/delete für `authenticated`)
- [ ] RLS-Policies: `feedback_messages` (select eigene Ticket-Nachrichten, insert nur `author_type='user'` + eigenes offenes Ticket)
- [ ] `supabase/schemas/10_realtime.sql`: beide Tabellen zur `supabase_realtime`-Publication hinzufügen, `replica identity full`
- [ ] `supabase/schemas/20_privileges.sql`: selektive Grants/Revokes (authenticated vs. service_role)
- [ ] `supabase/tests/0X_feedback.test.sql`: pgTAP nach Vorbild `04_invites.test.sql`/`01_privileges.test.sql`
- [ ] `bun run db:diff -- -f feedback`
- [ ] `bun run test:db`
- [ ] `bun run db:advisors`
- [ ] `bun run db:diff` (muss leer sein)
- [ ] `bun run db:types`

**Checkpoint 1:** pgTAP grün, `db:diff` leer, Types aktuell.

## 2. Ticket erstellen

- [ ] `src/features/feedback/types.ts`
- [ ] `src/features/feedback/api.ts#createTicket`
- [ ] `src/features/feedback/hooks.ts#useCreateTicket`
- [ ] `src/features/feedback/feedback-form-screen.tsx` (+ `.test.tsx`)
- [ ] Route `src/app/settings/feedback/new.tsx`
- [ ] Settings-Menüeintrag "Feedback geben" in `settings-screen.tsx` ("App"-Gruppe)

## 3. Ticket-Liste mit Status

- [ ] `api.ts#listMyTickets`, `hooks.ts#useMyTickets`
- [ ] `feedback-list-screen.tsx` (+ `.test.tsx`): Status-Badges, leerer Zustand
- [ ] Route `src/app/settings/feedback/index.tsx`

**Checkpoint 2:** `bun run test -- feedback` grün, `bun run typecheck`, manueller Durchlauf (Ticket erstellen → in Liste sichtbar).

## 4. Ticket-Detail & Thread

- [ ] `api.ts#getTicket`, `#listMessages`, `#sendReply`; passende `hooks.ts`-Einträge
- [ ] `feedback-detail-screen.tsx` (+ `.test.tsx`): Thread-Reihenfolge, Antwort-Eingabe deaktiviert bei `status='closed'`
- [ ] Route `src/app/settings/feedback/[id].tsx`, Navigation aus Liste verdrahten

**Checkpoint 3:** Detail-/Thread-Tests grün, Navigation Liste→Detail funktioniert.

## 5. Realtime-Benachrichtigung

- [ ] `use-feedback-realtime.ts`: Supabase-Realtime-Subscription (Liste: Statuswechsel, Detail: neue Nachrichten), Cache-Invalidierung
- [ ] Banner/Toast bei `status → in_progress`
- [ ] Banner/Toast bei neuer `author_type='staff'`-Nachricht
- [ ] Hook-Test mit gemocktem Supabase-Channel

**Checkpoint 4:** Realtime-Hook-Test grün, `bun run check` + `bun run typecheck` für den gesamten Feature-Ordner.

## Abschluss

- [ ] `src/features/feedback/EXPLANATION.md` schreiben
- [ ] Vollständiger lokaler Verifikationslauf: `bun run check`, `bun run typecheck`, `bun run test -- feedback`, `bun run test:db`
