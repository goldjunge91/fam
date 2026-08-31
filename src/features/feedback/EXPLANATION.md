# Feature Documentation: Feedback (`src/features/feedback`)

Kurzüberblick über das Nutzer-Feedback-Tool (Issue #347). Details zu
Datenmodell, RLS und Entscheidungen stehen in `SPEC.md` (Projekt-Root) und
`tasks/feedback-tool/plan.md`; dieses Dokument beschreibt nur den
Client-Feature-Ordner.

## Zweck

Nutzer melden Anregungen, Fehler oder Sonstiges, bekommen eine sichtbare
Ticket-Nummer und sehen live (solange die App offen ist), wenn ein Ticket
auf „in Bearbeitung“ wechselt oder das Team geantwortet hat. Es gibt in v1
kein In-App-Admin-UI — Devs bearbeiten Tickets über Supabase Studio bzw.
`service_role`.

## Dateien

| Datei | Zweck |
|---|---|
| `api.ts` | Types (`FeedbackTicket`, `FeedbackMessage`, `FeedbackType`, `FeedbackStatus`) + React-Query-Hooks. Direkt gegen Supabase, kein lokaler SQLite-Spiegel (Feedback ist keine offline-kritische, geteilte Haushaltsdaten-Domäne — Vorbild ist `calorie-tracking/api.ts`, nicht `household/api.ts`). |
| `labels.ts` | Deutsche Anzeigetexte + Statusfarben, geteilt zwischen Formular, Liste und Detail — vermeidet Duplikation der Typ-/Status-Übersetzung. |
| `feedback-form-screen.tsx` | Ticket erstellen: Typ-Auswahl (`SegmentedControl`), Betreff, Nachricht. Legt beim Absenden zwei Zeilen an (`feedback_tickets` + die initiale `feedback_messages`-Zeile) und zeigt danach die Ticket-Nummer. |
| `feedback-list-screen.tsx` | „Meine Tickets“ — `FlashList` mit Status-Badge je Zeile, `EmptyState` ohne Tickets, `+ Neu`-Aktion. Zeigt ein Banner, wenn der Realtime-Hook einen Übergang zu `in_progress` meldet. |
| `feedback-detail-screen.tsx` | Ticket-Kopf (Betreff/Typ/Status) + Thread (`feedback_messages`, chronologisch, staff-Zeilen optisch abgesetzt). Antwortformular verschwindet bei `status = 'closed'`. Zeigt ein Banner bei neuer staff-Antwort. |
| `use-feedback-realtime.ts` | Ein Supabase-Realtime-Channel pro Nutzer (`feedback:<userId>`). Hört auf `UPDATE` bei `feedback_tickets` (serverseitig auf `user_id` gefiltert) und `INSERT` bei `feedback_messages` (kein Filter möglich — die Tabelle hat keine `user_id`-Spalte, RLS aus `24_feedback.sql` grenzt die gelieferten Zeilen trotzdem korrekt ein). Invalidiert die passenden React-Query-Caches und ruft optionale Callbacks (`onTicketInProgress`, `onStaffReply`) für die Banner in Liste/Detail. |

## Routing

`src/app/settings/feedback/index.tsx` (Liste) → `new.tsx` (Formular) →
`[id].tsx` (Detail). Einstieg über den Menüpunkt „Feedback geben“ in der
„App“-Gruppe von `src/features/settings/settings-screen.tsx`.

## Bewusste Vereinfachungen (v1)

- **Kein Server-Push.** Nur Realtime bei offener App — kein FCM/APNs, keine
  Push-Token-Verwaltung. Bei geschlossener App sieht der Nutzer den
  aktuellen Status erst beim nächsten Öffnen der Liste (die liest den
  aktuellen Stand ohnehin bei jedem Mount neu).
- **Kein Unread-Tracking.** Es gibt kein `last_viewed_at`-Feld — das Banner
  ist ein einmaliges, auto-verschwindendes Live-Signal, kein persistenter
  Ungelesen-Zustand.
- **Kein In-App-Admin-UI.** Status setzen und als `staff` antworten geht
  nur über `service_role` (Supabase Studio oder, künftig, eine separate
  Website mit Ticket-Bereich — dafür ist das Schema mit einem
  normalisierten `feedback_messages`-Thread vorbereitet, siehe SPEC.md).

## Tests

24 Tests über 5 Dateien (`api.test.ts`, `feedback-form-screen.test.tsx`,
`feedback-list-screen.test.tsx`, `feedback-detail-screen.test.tsx`,
`use-feedback-realtime.test.tsx`). `feedback-list-screen.test.tsx` nutzt
Fake-Timer um/nach dem Test (siehe `docs/fehler bei der test erstellung.md`
#7) wegen `FlashList`s internem verzögertem Layout-Update.
