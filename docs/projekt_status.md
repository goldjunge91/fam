# Projekt-Status: Family App (fam)
> Stand: 2026-08-12 · Branch: `main`
>
> **MVP komplett: GitHub-Milestone "Phase 1 - MVP" hat 0 offene Issues (56 geschlossen).**
> Wellen 0–8 aus `docs/ROADMAP.md` sind vollständig umgesetzt, getestet und
> auf GitHub geschlossen. Offen sind ausschließlich die Phase-2–4-Epics
> (#11–#24) — noch unspezifiziertes Zukunftswerk, siehe Abschnitt
> "Roadmap (offene Epics, Future)" unten.
>
> Update 2026-08-12: Welle 8 (Datenschutz & Compliance, #96–#99) implementiert
> — Datenschutzerklärung (`docs/DATENSCHUTZ.md`), Datenexport, Account-
> Löschung (Edge Function `delete-account` + RPC `prepare_account_deletion`,
> dabei einen vorbestehenden Bug in `guard_last_admin` gefunden und behoben,
> der jede Haushaltslöschung mit mehr als einem Mitglied blockierte),
> Privacy-Labels-Referenz (`docs/PRIVACY_LABELS.md`). #79 (Liste häufig
> verwendeter Lebensmittel) stellte sich als bereits vollständig implementiert
> heraus (nur nicht verifiziert) und wurde ebenfalls geschlossen. Damit sind
> auch Epic 6 (#7), Epic 9 (#10) sowie die zuvor "fast fertig" markierten
> Epics 2 und 3 (#3, #4) geschlossen.
>
> Update 2026-08-11: Epic 8 (Dashboard & Navigation, #89–#95) sowie Gate D (#70, 2-Geräte-Sync-Verifikation) sind vollständig im Code umgesetzt, verifiziert und auf GitHub geschlossen (Commits `704b953`, `4c262cf`, `1a76351`, `b06cd4d`, `f58e3bf`).
>
> **Korrektur 2026-08-11 (Verifikation gegen Code+AC, nicht nur gegen Doku):** 32 als "fertig" geführte Issues wurden einzeln gegen ihre Akzeptanzkriterien im Code geprüft. 17 waren tatsächlich vollständig — die wurden jetzt erst auf GitHub geschlossen (vorher stand die Doku auf ✅, GitHub auf offen). Bei **13 Issues fehlte ein konkretes AC**, bei **2 (#78, #80) existierte trotz ✅-Markierung gar keine Implementierung**.
>
> **Nachtrag 2026-08-11: alle 15 AC-Lücken geschlossen** (Branch `ac-luecken-fixes`, 22 Commits, siehe `tasks/fam-backlog/008-ac-luecken-verifikation.md`). PR #119 in `main` gemerged (Merge-Commit `45b650c`), alle 15 GitHub-Issues (#65, #69, #71, #73, #74, #75, #76, #78, #80, #83, #84, #85, #86, #88, #93) mit Beleg-Kommentar geschlossen.


## ✅ Abgeschlossene Epics & Issues

### Epic 0 — Foundation (✅ CLOSED #1)
| # | Issue | Status |
|---|-------|--------|
| #25 | Biome Linter/Formatter | ✅ |
| #26 | Test-Setup: jest-expo + Testing Library | ✅ |
| #27 | EAS konfigurieren + Dev Build | ✅ |
| #28 | Supabase CLI + lokale Instanz | ✅ |
| #29 | Env-Variablen dokumentiert | ✅ |
| #30 | Supabase-Client + SecureStore-Adapter | ✅ |
| #31 | TypeScript-Typen aus DB-Schema | ✅ |
| #32 | TanStack Query einrichten | ✅ |
| #33 | GitHub Actions CI-Pipeline | ✅ |

### Epic 1 — Datenmodell & RLS (✅ CLOSED #2)
| # | Issue | Status |
|---|-------|--------|
| #34 | Migration: profiles + Trigger | ✅ |
| #35 | Migration: households + members (RLS) | ✅ |
| #36 | Migration: household_invites + redeem_invite RPC | ✅ |
| #37 | Migration: child_profiles | ✅ |
| #38 | Migration: products | ✅ |
| #39 | Migration: storage_locations + fridge_items | ✅ |
| #40 | Migration: shopping_list_items | ✅ |
| #41 | Migration: private Tracking-Tabellen | ✅ |
| #42 | Sync-Metadaten auf synchronisierten Tabellen | ✅ |
| #43 | RLS-Integrationstests gegen echtes Postgres | ✅ |
| #44 | Realtime-Publication aktiviert | ✅ |

### Epic 2 — Offline-Layer & Sync-Engine (✅ CLOSED #3)
| # | Issue | Status |
|---|-------|--------|
| #45 | expo-sqlite + lokales Schema | ✅ |
| #46 | Outbox-Queue | ✅ |
| #47 | Sync-Engine: Pull, Push, Konfliktauflösung | ✅ |
| #48 | Realtime → SQLite Bridge | ✅ |
| #49 | Unit-Tests Konfliktauflösung | ✅ |
| #50 | Netzwerkstatus + Hintergrund-Sync | ✅ |
| #51 | Offline-Indikator + SyncStatusBanner | ✅ |
| **#70** | **Realtime-Sync zwischen 2 Geräten verifizieren** | **✅ CLOSED (Commit `1a76351` / `b06cd4d`)** |

### Epic 3 — Auth & Onboarding (✅ CLOSED #4)
| # | Issue | Status |
|---|-------|--------|
| #52 | (auth)-Route-Group + Auth-Guard | ✅ |
| #53 | Registrierung (E-Mail/Passwort) | ✅ |
| #54 | Login mit Fehlerzuständen | ✅ |
| #55 | Passwort-Reset per Deep Link | ✅ |
| #56 | Session-Persistenz + Auto-Refresh | ✅ |
| #57 | Profil-Onboarding | ✅ |
| #58 | Logout inkl. lokaler Datenlöschung | ✅ |
| **#104** | **App-Onboarding Multi-Step Wizard** | **✅ gerade gemergt** |

### Epic 4 — Haushalt & Familie (✅ CLOSED #5)
| # | Issue | Status |
|---|-------|--------|
| #59 | Haushalt erstellen | ✅ CLOSED |
| #60 | Mitgliederliste mit Rollen | ✅ CLOSED |
| #61 | Einladung erzeugen (Link + QR-Code) | ✅ CLOSED |
| #62 | Haushalt beitreten (Deep Link/Code) | ✅ CLOSED |
| #63 | Rollenverwaltung + Mitglieder entfernen | ✅ CLOSED |
| #64 | Haushalt verlassen und löschen | ✅ CLOSED |
| #65 | Kinder-Profile anlegen | ✅ CLOSED (2026-08-11) — Profil-Auswahl in `add-food-entry-screen.tsx`, `useActiveProfile`/`useChildProfiles` |
| #66 | Haushalts-Wechsler | ✅ |

### Epic 5 — Kühlschrank-Tracker (✅ CLOSED #6)
| # | Issue | Status |
|---|-------|--------|
| #67 | Bestandsliste gruppiert nach Lagerort | ✅ CLOSED |
| #68 | Artikel manuell hinzufügen | ✅ CLOSED |
| #69 | Artikel bearbeiten, verbrauchen, entfernen | ✅ CLOSED (2026-08-11) — sofortiges Löschen + Undo-Snackbar, neuer `restore`-Outbox-Op |
| #70 | Realtime-Sync zwischen 2 Geräten | ✅ CLOSED (verifiziert am 2026-08-11, Commit `1a76351`) |
| #71 | Ablauf-Ampel + Sortierung nach MHD | ✅ CLOSED (2026-08-11) — MHD/Name-Sortier-Toggle in `fridge-screen.tsx` |
| #72 | Lokale Benachrichtigungen (ablaufende Artikel) | ✅ CLOSED |
| #73 | Dashboard-Widget 'läuft bald ab' | ✅ CLOSED (2026-08-11) — Karte blendet sich bei 0 Artikeln aus, Tap-Through zu `/fridge?filter=expiring` |

### Epic 6 — Lebensmittel-Datenbank & Barcode (✅ CLOSED #7)
| # | Issue | Status |
|---|-------|--------|
| #74 | Open-Food-Facts-Client + Mapping | ✅ CLOSED (2026-08-11) — OFF-Treffer werden beim Hinzufügen als `products`-Zeile (`source='off'`) persistiert |
| #75 | Produktsuche mit Debounce | ✅ CLOSED (2026-08-11) — lokales `products`-Tiering vor OFF-Fallback, Offline-Pfad |
| #76 | Barcode-Scanner | ✅ CLOSED (2026-08-11) — `Haptics.notificationAsync` bei erfolgreichem Scan |
| #77 | Produktdetail mit Portionsauswahl | ✅ CLOSED (Portionsskalierung sitzt in `add-food-entry-screen.tsx`, nicht in `inventory/product-detail-modal.tsx` — letzteres ist eine statische Demo) |
| #78 | Einheiten-Umrechnung (pure functions) | ✅ CLOSED (2026-08-11) — `toGramsEquivalent`/`scaleToQuantity` in `units.ts`, `add-food-entry-screen.tsx` nutzt sie |
| #79 | Liste häufig verwendeter Lebensmittel | ✅ CLOSED (2026-08-12) — war bereits implementiert (`product_usage`, `FrequentProductsQuickSelect`, `useLocalFoodUsage`), nur nicht verifiziert |
| #80 | Produkt manuell anlegen | ✅ CLOSED (2026-08-11) — neuer `add-product-screen.tsx`, verlinkt aus der Produktsuche |

### Epic 7 — Kalorienziele & Ernährungstagebuch (✅ CLOSED)
| # | Issue | Status |
|---|-------|--------|
| #81 | Grundumsatz-Formeln (pure functions) | ✅ CLOSED |
| #82 | TDEE und Zielkalorien berechnen | ✅ CLOSED |
| #83 | Makro-Verteilung mit Presets | ✅ CLOSED (2026-08-11) — `low_carb` auf 40/20/40 korrigiert, "Benutzerdefiniert"-Option mit Summen-Validierung |
| #84 | Ziel-Setup-Screen | ✅ CLOSED (2026-08-11) — editierbares kcal-Feld, vorbefüllt und überschreibbar, Grundumsatz-Kappung bleibt |
| #85 | Tagebuch-Screen nach Mahlzeiten | ✅ CLOSED (2026-08-11) — Profil-Picker filtert Tagebuch nach Erwachsenem/Kind |
| #86 | Eintrag hinzufügen, bearbeiten, löschen | ✅ CLOSED (2026-08-11) — sofortiges Löschen + Undo-Snackbar |
| #87 | Tagessummen und Restkalorien | ✅ CLOSED |
| #88 | Datumsnavigation im Tagebuch | ✅ CLOSED (2026-08-11) — React-Query-Cache persistiert (`@tanstack/query-async-storage-persister`), gescopt auf `calorie-tracking`-Keys |

### Epic 8 — Dashboard & Navigation (✅ CLOSED)
| # | Issue | Status |
|---|-------|--------|
| #89 | Tab-Struktur erweitern | ✅ (tote profile-screen.tsx entfernt, Web-Tabs an native 6 Tabs angeglichen) |
| #90 | Template-Screens durch echte Screens ersetzen | ✅ CLOSED (bewusst nur Aufräumen — Rezept-CRUD ist Zukunfts-Epic #12) |
| #91 | Animierter Kalorien-Fortschrittsring | ✅ CLOSED (schon seit Welle 6) |
| #92 | Makro-Fortschrittsbalken | ✅ CLOSED (schon seit Welle 6) |
| #93 | Dashboard-Tagesübersicht | ✅ CLOSED (2026-08-11) — `RefreshControl` ruft `triggerHouseholdSync` auf |
| #94 | Profil- und Einstellungs-Screen | ✅ (settings-screen.tsx ist der Account-Hub, doppelter profile-screen.tsx entfernt) |
| #95 | Modul-Aktivierung (Feature-Flags) | ✅ CLOSED (neue profiles-Spalten, /settings/modules, ModuleGate) |

### Epic 9 — Datenschutz & Compliance (✅ CLOSED #10)
| # | Issue | Status |
|---|-------|--------|
| #96 | Datenschutzerklärung (Verschlüsselung) | ✅ CLOSED (2026-08-12) — `docs/DATENSCHUTZ.md` + `/settings/privacy` |
| #97 | Datenexport | ✅ CLOSED (2026-08-12) — `/settings/export`, JSON via `expo-sharing` |
| #98 | Account- und Datenlöschung | ✅ CLOSED (2026-08-12) — Edge Function `delete-account` + RPC `prepare_account_deletion` |
| #99 | App-Store-Privacy-Labels | ✅ CLOSED (2026-08-12) — `docs/PRIVACY_LABELS.md` |

---

## 🗺️ Roadmap (offene Epics, Future)
| Epic | Status |
|------|--------|
| #11 Einkaufsliste & Übernahme in Bestand | 🔴 |
| #12 Rezept-Manager & Rezept-Builder | 🔴 |
| #13 Fortschritts-Tracking & Charts | 🔴 |
| #14 Push-Benachrichtigungen | 🔴 |
| #15 Meal-Planner (Wochenplanung) | 🔴 |
| #16 Supermarkt-Preisvergleich | 🔴 |
| #17 Aktivitätstracking & Health-Integration | 🔴 |
| #18 Intervallfasten-Tracker | 🔴 |
| #19 Kochmodus 'Was kann ich kochen?' | 🔴 |
| #20 Gamification (XP, Streaks, Achievements) | 🔴 |
| #21 Rezept-Sharing & Community | 🔴 |
| #22 Analytics & Report-Generator | 🔴 |
| #23 Premium-Features & Monetarisierung | 🔴 |
| #24 Homescreen-Widgets | 🔴 |

---

## 📁 Aktueller Codestand

### Feature-Module (`src/features/`)
- `auth/` — vollständig (Sign-in, Sign-up, Onboarding 6-Step Wizard, PendingAuthBanner)
- `fridge/` — fertig (Screen, Mutations, Ablauf-Ampel, Benachrichtigungen, Undo-Löschen #69, MHD/Name-Sortier-Toggle #71)
- `household/` — fertig (Erstellen, Mitglieder/Rollen, Einladung+QR, Beitritt, Wechsler, Kinder-Profile als Mahlzeit-Ziel wählbar #65)
- `inventory/` — fertig (Add-Item, Barcode-Scanner mit Haptics #76, Produktsuche mit lokalem Tiering #75, OFF-Persistierung #74, Einheiten-Umrechnung #78, manuelles Produktanlegen #80)
- `dashboard/` — fertig (Ablauf-Widget mit Ausblenden+Tap-Through #73, Pull-to-Refresh #93, Kalorienring und Makro-Balken an echte Daten angebunden)
- `calorie-tracking/` — fertig (Grundumsatz/TDEE als reine Funktionen, Tagessummen, korrigierte Makro-Presets + freies Anpassen #83, manueller Ziel-Override #84, Kinder-Profil-Filter im Tagebuch #85, Undo-Löschen #86, persistierter Offline-Cache #88)
- `onboarding/` — fertig (inkl. Modul-Auswahl, jetzt tatsächlich persistiert — #95)
- `recipes/` — Gerüst (bewusst so belassen, echter Rezept-Builder ist Zukunfts-Epic #12), hinter `ModuleGate` erreichbar
- `settings/` — fertig (Verzeichnis mit Unterseiten, inkl. `/settings/modules` für #95)
- `shopping-list/` — fertig (Screen, Add-Item-Form, Complete-Run-Sheet, `shopping_history`)

`profile/` wurde entfernt — war ein nirgends verlinkter Duplikat-Screen von
`settings-screen.tsx` (Bereinigung im Rahmen von #89/#94).

### App-Routen (`src/app/`)
- `(auth)/` — Login, Register
- `(app)/` — fridge, index, recipes, settings, shopping-list, diary (alle vier
  Modul-Tabs hinter `ModuleGate`)
- `household/` — storage-locations
- `settings/` — profile, sync-debug, goals, modules
- `onboarding.tsx`, `add-item.tsx`, `add-food-entry.tsx`

---

## 🎯 Empfohlene nächste Schritte

Gate D (#70) ist verifiziert und alle 4 Wellen-Gates sind grün. **17 Issues aus Welle 4/5/6/7/8-Vorarbeiten wurden am 2026-08-11 gegen ihre Akzeptanzkriterien geprüft und auf GitHub geschlossen.** Bei der Prüfung kamen **15 offene Lücken** zum Vorschein (13 Issues mit einzelnen fehlenden AC, 2 Issues — `#78`, `#80` — komplett unimplementiert trotz vorheriger "✅"-Markierung); **alle 15 wurden noch am selben Tag auf Branch `ac-luecken-fixes` geschlossen** (22 Commits, jeweils mit Tests; Details in `tasks/fam-backlog/008-ac-luecken-verifikation.md`) und über PR #119 (Merge `45b650c`) in `main` gemerged. Alle 15 GitHub-Issues sind mit Beleg-Kommentar geschlossen.

**MVP komplett (2026-08-12):** Welle 8 (Datenschutz & Compliance, `#96–99`) implementiert, `#79` verifiziert und geschlossen. GitHub-Milestone "Phase 1 - MVP" hat 0 offene Issues.

Nächster inhaltlicher Schritt:
- **Phase 2–4 aufschlüsseln** (`#11`–`#24`) — bisher nur grobe Epics ohne Kind-Issues, siehe "Roadmap (offene Epics, Future)" oben.

