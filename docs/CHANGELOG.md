# CHANGELOG

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.
Format: [Keep a Changelog](https://keepachangelog.com/de/1.1.0/)

---

## [Unreleased] — in Arbeit

### Geplant (Welle 6 — Kalorien & Tagebuch)
Noch nicht begonnen. DB-Schema existiert bereits (`food_entries`,
`weight_entries`, `user_goals` in `supabase/schemas/09_tracking.sql`), fehlt
ist reiner Client-Code: Grundumsatz-/TDEE-Formeln (#81-82), Makro-Verteilung
(#83), Ziel-Setup-Screen (#84), Tagebuch-Screen + CRUD + Tagessummen (#85-88).

### Offener Nachzügler (Welle 2/5)
- Realtime-Bridge (#48) und Netzwerk-/Hintergrund-Trigger (#50) sind gebaut,
  aber noch nicht an `(app)/_layout.tsx` angeschlossen — Details in
  `docs/SYNC_ENGINE.md`. Voraussetzung für #70 (Gate D, Zwei-Geräte-Sync
  unter 1s).

---

## [0.6.0] — 2026-08-07/08 — Haushalt, Kühlschrank & Einkaufsliste, Lebensmittel-DB

Zwischen den letzten beiden CHANGELOG-Einträgen (Stand 2026-08-06) und jetzt
wurden mehrere Wellen fertiggestellt, ohne dass der Changelog nachgezogen
wurde. Nachträglich zusammengefasst anhand des Codes:

### Added
- **Epic 4 — Haushalt** (#59–66): Haushalt erstellen (`create-household-screen.tsx`),
  Mitgliederliste mit Rollen-Toggle + Entfernen + Admin-Schutz
  (`members-screen.tsx`), Einladung mit dauerhaftem QR-Code + getrennten
  Kopier-Buttons (`invite-modal.tsx`), Beitritt per Deep Link
  (`join-household-screen.tsx`), Verlassen/Löschen, Kinder-Profile
  (`child-profiles-screen.tsx`), Haushalts-Wechsler
  (`household-switcher-modal.tsx`), globaler `ActiveHouseholdProvider`
- **Welle 5 — Kühlschrank & Einkaufsliste** (#67–69, #71–73): die unten schon
  angekündigten Hooks (`use-fridge-mutations.ts`, `use-storage-locations.ts`,
  `use-shopping-list*.ts`) sowie `fridge-screen.tsx`, `shopping-list-screen.tsx`,
  `complete-run-sheet.tsx`, Ablauf-Ampel (`fridge/expiry.ts`), lokale
  Benachrichtigungen (`use-expiry-notifications.ts`) und das
  Dashboard-Ablauf-Widget
- **Parallel-Track P — Lebensmittel-DB** (#74–78, #80): Open-Food-Facts-Client
  (`src/lib/open-food-facts.ts`), Produktsuche (`product-search-dropdown.tsx`),
  Barcode-Scanner (`barcode-scanner-modal.tsx`), Produktdetail
  (`product-detail-modal.tsx`), Einheiten-Umrechnung (`src/lib/units.ts`)
- **Sync-Engine-Verdrahtung:** `src/lib/sync/sync-runner.ts`
  (`useSyncEngine`/`triggerHouseholdSync`) — Poll-Sync alle 20s + bei
  App-Resume, eingehängt in `src/app/(app)/_layout.tsx`. Realtime-Bridge
  und Netzwerk-Trigger sind weiterhin nicht angeschlossen (s. o.)
- `docs/refactoring_plan.md` (Feature-Slicing, `shopping_history`-Tabelle) —
  vollständig umgesetzt

---

## [0.5.0] — 2026-08-06 — Onboarding 6-Step Wizard (PR #105)

### Added
- **6-stufiger Onboarding-Wizard** nach Registrierung ([#104](https://github.com/goldjunge91/fam/issues/104))
  - `step-welcome.tsx` — Willkommens-Schritt
  - `step-account.tsx` — E-Mail/Passwort-Eingabe
  - `step-profile.tsx` — Name, Avatar-Initialen
  - `step-household-info.tsx` — Haushalt benennen
  - `step-create-household.tsx` — Haushalt anlegen via `create_household` RPC
  - `step-inventory.tsx` — Erste Artikel anlegen (optional)
  - `step-indicator.tsx` — Fortschrittsanzeige
- `onboarding-session.ts` — Session-Persistence zwischen Wizard-Schritten
- `auth-schemas.ts` erweitert um Onboarding-Validierung
- Script `scripts/ios-dev_v2.sh` für schnellere Dev-Build-Zyklen

### Changed
- `sign-in-screen.tsx`, `sign-up-screen.tsx` — kleinere UI-Verbesserungen
- `add-item-screen.tsx` — Produkt-Modal und Einheiten-Normalisierung
- `members-screen.tsx` — Korrekturen
- Diverse Route-Stubs angelegt: `settings/`, `household/storage-locations`

---

## [0.4.0] — 2026-08-06 — Realtime-Bridge & Netzwerk-Sync (PR #103)

### Added
- **Realtime → SQLite Bridge** ([#48](https://github.com/goldjunge91/fam/issues/48))
  — Supabase-Realtime-Events werden direkt in die lokale SQLite geschrieben
- **Netzwerkstatus + Hintergrund-Sync** ([#50](https://github.com/goldjunge91/fam/issues/50))
  — `network-trigger.ts` feuert Sync beim Reconnect
  — Hintergrund-Sync-Registrierung via `expo-task-manager`
- **SyncStatusBanner** ([#51](https://github.com/goldjunge91/fam/issues/51))
  — `useSyncStatus`-Hook
  — Status-Berechnung und Outbox-Retry
  — Banner in Root-Layout eingehängt

---

## [0.3.0] — 2026-08-06 — Sync-Engine Kern (PR #101)

### Added
- **expo-sqlite** + lokales Schema ([#45](https://github.com/goldjunge91/fam/issues/45))
  — WAL-Modus, Migration-System, `SqlDatabase`-Port
- **Outbox-Queue** ([#46](https://github.com/goldjunge91/fam/issues/46))
  — `enqueueMutation()` — einziger Schreibweg für alle Spiegeltabellen
  — atomar: Spiegeltabelle + Outbox in einer `withExclusiveTransactionAsync`
- **Sync-Engine** Pull/Push/LWW-Konfliktauflösung ([#47](https://github.com/goldjunge91/fam/issues/47))
  — `sync/pull.ts`, `sync/push.ts`, `sync/coalesce.ts`
  — Last-Write-Wins über `updated_at`
- **Konflikt-Unit-Tests** ([#49](https://github.com/goldjunge91/fam/issues/49))
  — "Delete schlägt Update", "Geräteuhr geht falsch"
  — Mock-frei via `node:sqlite`

---

## [0.2.0] — 2026-08-06 — CI-Pipeline (PR #100)

### Added
- **GitHub Actions CI** ([#33](https://github.com/goldjunge91/fam/issues/33))
  — Unit-Tests (jest-expo)
  — Integration-Tests gegen lokale Supabase
  — Biome Lint/Format-Check

---

## [0.1.0] — 2026-08-05 — Auth & Datenmodell

### Added

#### Auth & Onboarding ([#52](https://github.com/goldjunge91/fam/issues/52)–[#58](https://github.com/goldjunge91/fam/issues/58))
- `(auth)`-Route-Group + Auth-Guard
- Registrierung (E-Mail/Passwort) mit Validierung
- Login mit sauberen Fehlerzuständen
- Passwort-Reset per Deep Link
- Session-Persistenz + Auto-Refresh (SecureStore-Chunking-Adapter)
- Profil-Onboarding
- Logout inkl. lokaler Datenlöschung (`deleteLocalDatabase()`)

#### Datenmodell & RLS ([#34](https://github.com/goldjunge91/fam/issues/34)–[#44](https://github.com/goldjunge91/fam/issues/44))
- `profiles` + `handle_new_user()`-Trigger auf `auth.users`
- `households` + `household_members` (rekursionsfreie Policies via SECURITY DEFINER)
- `household_invites` + `redeem_invite` RPC
- `child_profiles`
- `products` (Lebensmittel-Cache, global)
- `storage_locations` + `fridge_items` (haushaltsbezogen, RLS)
- `shopping_list_items` (haushaltsbezogen, RLS)
- Private Tracking-Tabellen (`nutrition_logs`, `goals` — strikt benutzerbezogen)
- Sync-Metadaten: `updated_at`, `deleted_at`, `_dirty` auf allen Spiegeltabellen
- Realtime-Publication für alle synchronisierten Tabellen
- **pgTAP-Integrationstests** — nachgewiesen dass kein Haushaltsmitglied
  die privaten Tracking-Daten eines anderen lesen kann

#### Foundation ([#25](https://github.com/goldjunge91/fam/issues/25)–[#32](https://github.com/goldjunge91/fam/issues/32))
- Biome (Linter + Formatter)
- jest-expo + Testing Library
- EAS Dev Build (iOS + Android)
- Supabase CLI + lokale Instanz
- Env-Variablen dokumentiert (`.env.example`)
- Supabase-Client mit SecureStore-Chunking-Adapter
- TypeScript-Typen aus DB-Schema generiert
- TanStack Query konfiguriert (AppState-Anbindung für Background-Refetch)
