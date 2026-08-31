# Todo: Nutzer-Feedback-Tool

Plan: `tasks/feedback-tool/plan.md`

## 1. DB-Schema & RLS (Fundament) — ✅ erledigt (7f241ad)

- [x] Schema-Nummer gegen `supabase/config.toml` (`schema_paths`) verifizieren — `24_feedback.sql`, eingehängt vor `09_tracking.sql`/`10_realtime.sql` (Ladereihenfolge ≠ Dateiname, siehe `config.toml`)
- [x] `supabase/schemas/24_feedback.sql`: `feedback_tickets` + `feedback_messages` (Spalten, Indizes, `set_updated_at`-Trigger)
- [x] RLS-Policies: `feedback_tickets` (select/insert eigene, kein update/delete für `authenticated`)
- [x] RLS-Policies: `feedback_messages` (select eigene Ticket-Nachrichten, insert nur `author_type='user'` + eigenes offenes Ticket)
- [x] `supabase/schemas/10_realtime.sql`: beide Tabellen zur `supabase_realtime`-Publication hinzufügen, `replica identity full`
- [x] `supabase/schemas/20_privileges.sql`: selektive Grants/Revokes (authenticated vs. service_role)
- [x] `supabase/tests/18_feedback.test.sql`: pgTAP nach Vorbild `04_invites.test.sql`/`01_privileges.test.sql` (11 Assertions)
- [x] `bun run db:diff -- -f feedback`
- [x] `bun run test:db` — 231/231 grün
- [x] `bun run db:advisors` — keine Findings
- [x] `bun run db:diff` (leer)
- [x] `bun run db:types`

**Checkpoint 1: erreicht.** pgTAP grün, `db:diff` leer, Types aktuell.

## 2. Ticket erstellen — ✅ erledigt (17131bf)

- [x] `src/features/feedback/api.ts`: Types (`FeedbackType`/`FeedbackStatus` als eigene Literal-Unions, generierte Row-Typen kennen nur `string`) + `createTicket` + `useCreateTicketMutation` (kombiniert statt separater `types.ts`/`hooks.ts` — folgt dem Muster aus `calorie-tracking/api.ts`)
- [x] `src/features/feedback/feedback-form-screen.tsx` (+ `.test.tsx`): Typ-Auswahl (SegmentedControl), Betreff, Nachricht, zeigt Ticket-Nummer nach Absenden
- [x] Route `src/app/settings/feedback/new.tsx`
- [x] Settings-Menüeintrag "Feedback geben" in `settings-screen.tsx` ("App"-Gruppe) — zeigt vorerst direkt aufs Formular (`/settings/feedback/new`), Aufgabe 3 biegt auf die Liste (`/settings/feedback`) um

**Hinweis:** `router.replace('/settings/feedback')` (Liste) im Erfolgs-Screen zeigt bis Aufgabe 3 auf eine noch nicht existierende Route.

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
