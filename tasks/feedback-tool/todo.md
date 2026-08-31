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

**Hinweis:** War in Aufgabe 3 aufgelöst — Route existiert jetzt.

## 3. Ticket-Liste mit Status — ✅ erledigt (d3920a9)

- [x] `api.ts#useMyTickets` (bereits in Aufgabe 2 angelegt, hier um `FeedbackTicket[]`-Rückgabetyp ergänzt)
- [x] `feedback-list-screen.tsx` (+ `.test.tsx`): FlashList mit Status-Badges, leerer Zustand via `EmptyState`, Zeilen navigieren zum Detail
- [x] Route `src/app/settings/feedback/index.tsx`
- [x] `labels.ts`: geteilte Typ-/Status-Anzeigetexte (Formular nutzt sie jetzt auch, keine Duplikation)
- [x] Settings-Menüpunkt zeigt jetzt auf `/settings/feedback` (Liste) statt `/new`

**Checkpoint 2: erreicht.** `bun run test -- feedback` (18 Tests) + `settings-screen.test.tsx` grün, `bun run typecheck` sauber. FlashList-`act()`-Warnung nach Vorbild `docs/fehler bei der test erstellung.md` #7 mit Fake-Timern behoben.

## 4. Ticket-Detail & Thread — ✅ erledigt (03ce014)

- [x] `api.ts#useTicket`, `#useTicketMessages`, `#sendReply`/`#useSendReplyMutation`
- [x] `feedback-detail-screen.tsx` (+ `.test.tsx`): Thread-Reihenfolge inkl. staff-Hervorhebung, Antwortformular verschwindet bei `status='closed'` zugunsten Hinweistext
- [x] Route `src/app/settings/feedback/[id].tsx` — Navigation aus der Liste war bereits in Aufgabe 3 verdrahtet

**Checkpoint 3: erreicht.** 17 Feedback-Tests grün, `bun run typecheck`/`check` sauber.

## 5. Realtime-Benachrichtigung

- [ ] `use-feedback-realtime.ts`: Supabase-Realtime-Subscription (Liste: Statuswechsel, Detail: neue Nachrichten), Cache-Invalidierung
- [ ] Banner/Toast bei `status → in_progress`
- [ ] Banner/Toast bei neuer `author_type='staff'`-Nachricht
- [ ] Hook-Test mit gemocktem Supabase-Channel

**Checkpoint 4:** Realtime-Hook-Test grün, `bun run check` + `bun run typecheck` für den gesamten Feature-Ordner.

## Abschluss

- [ ] `src/features/feedback/EXPLANATION.md` schreiben
- [ ] Vollständiger lokaler Verifikationslauf: `bun run check`, `bun run typecheck`, `bun run test -- feedback`, `bun run test:db`
