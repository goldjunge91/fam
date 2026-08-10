# Projekt-Status: Family App (fam)
> Stand: 2026-08-10 · Branch: `worktree-realtime-sync-wiring`
>
> Korrektur ggü. 2026-08-06: Epic 4 (Haushalt) und die Kern-Screens von Epic 5
> (Kühlschrank/Einkaufsliste) sowie der Grossteil von Epic P (Lebensmittel-DB)
> waren im Code bereits fertig, obwohl hier noch als offen geführt. Basis dieser
> Korrektur: direkte Code-Prüfung (Dateien, Tests, `bun run typecheck/lint/test`),
> nicht nur Commit-Messages.
>
> Update 2026-08-10: Epic 7 (Kalorienziele & Ernährungstagebuch, #81–#88) ist
> jetzt vollständig im Code (siehe unten), inklusive Dashboard-Anschluss.

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

### Epic 2 — Offline-Layer & Sync-Engine (🟡 OPEN #3, fast fertig)
| # | Issue | Status |
|---|-------|--------|
| #45 | expo-sqlite + lokales Schema | ✅ |
| #46 | Outbox-Queue | ✅ |
| #47 | Sync-Engine: Pull, Push, Konfliktauflösung | ✅ |
| #48 | Realtime → SQLite Bridge | ✅ |
| #49 | Unit-Tests Konfliktauflösung | ✅ |
| #50 | Netzwerkstatus + Hintergrund-Sync | ✅ |
| #51 | Offline-Indikator + SyncStatusBanner | ✅ |
| **#70** | **Realtime-Sync zwischen 2 Geräten verifizieren** | **🔴 OPEN** |

### Epic 3 — Auth & Onboarding (🟡 OPEN #4)
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
| #59 | Haushalt erstellen | ✅ |
| #60 | Mitgliederliste mit Rollen | ✅ |
| #61 | Einladung erzeugen (Link + QR-Code) | ✅ |
| #62 | Haushalt beitreten (Deep Link/Code) | ✅ |
| #63 | Rollenverwaltung + Mitglieder entfernen | ✅ |
| #64 | Haushalt verlassen und löschen | ✅ |
| #65 | Kinder-Profile anlegen | ✅ |
| #66 | Haushalts-Wechsler | ✅ |

### Epic 5 — Kühlschrank-Tracker (🟡 OPEN #6, Code fertig)
| # | Issue | Status |
|---|-------|--------|
| #67 | Bestandsliste gruppiert nach Lagerort | ✅ |
| #68 | Artikel manuell hinzufügen | ✅ |
| #69 | Artikel bearbeiten, verbrauchen, entfernen | ✅ |
| #70 | Realtime-Sync zwischen 2 Geräten | 🔴 OPEN — braucht zuerst die #48-Realtime-Bridge-Verdrahtung (aktuell nur Poll-Sync alle 20s), siehe `docs/SYNC_ENGINE.md` |
| #71 | Ablauf-Ampel + Sortierung nach MHD | ✅ |
| #72 | Lokale Benachrichtigungen (ablaufende Artikel) | ✅ |
| #73 | Dashboard-Widget 'läuft bald ab' | ✅ |

### Epic 6 — Lebensmittel-Datenbank & Barcode (🟡 OPEN #7, weitgehend fertig)
| # | Issue | Status |
|---|-------|--------|
| #74 | Open-Food-Facts-Client + Mapping | ✅ |
| #75 | Produktsuche mit Debounce | ✅ |
| #76 | Barcode-Scanner | ✅ |
| #77 | Produktdetail mit Portionsauswahl | ✅ |
| #78 | Einheiten-Umrechnung (pure functions) | ✅ |
| #79 | Liste häufig verwendeter Lebensmittel | 🔴 OPEN — bewusst zurückgestellt, Voraussetzung #86 jetzt erfüllt |
| #80 | Produkt manuell anlegen | ✅ |

### Epic 7 — Kalorienziele & Ernährungstagebuch (✅ Fertig)
| # | Issue | Status |
|---|-------|--------|
| #81 | Grundumsatz-Formeln (pure functions) | ✅ |
| #82 | TDEE und Zielkalorien berechnen | ✅ |
| #83 | Makro-Verteilung mit Presets | ✅ |
| #84 | Ziel-Setup-Screen | ✅ |
| #85 | Tagebuch-Screen nach Mahlzeiten | ✅ |
| #86 | Eintrag hinzufügen, bearbeiten, löschen | ✅ |
| #87 | Tagessummen und Restkalorien | ✅ |
| #88 | Datumsnavigation im Tagebuch | ✅ |

### Epic 8 — Dashboard & Navigation (✅ Fertig)
| # | Issue | Status |
|---|-------|--------|
| #89 | Tab-Struktur erweitern | ✅ (tote profile-screen.tsx entfernt, Web-Tabs an native 6 Tabs angeglichen) |
| #90 | Template-Screens durch echte Screens ersetzen | ✅ (bewusst nur Aufräumen — Rezept-CRUD ist Zukunfts-Epic #12) |
| #91 | Animierter Kalorien-Fortschrittsring | ✅ (schon seit Welle 6) |
| #92 | Makro-Fortschrittsbalken | ✅ (schon seit Welle 6) |
| #93 | Dashboard-Tagesübersicht | ✅ (Dashboard zeigt Ring+Makros+Ablauf-Widget bereits auf einer Seite) |
| #94 | Profil- und Einstellungs-Screen | ✅ (settings-screen.tsx ist der Account-Hub, doppelter profile-screen.tsx entfernt) |
| #95 | Modul-Aktivierung (Feature-Flags) | ✅ (neue profiles-Spalten, /settings/modules, ModuleGate) |

### Epic 9 — Datenschutz & Compliance (🔴 OPEN #10)
| # | Issue | Status |
|---|-------|--------|
| #96 | Datenschutzerklärung (Verschlüsselung) | 🔴 OPEN |
| #97 | Datenexport | 🔴 OPEN |
| #98 | Account- und Datenlöschung | 🔴 OPEN |
| #99 | App-Store-Privacy-Labels | 🔴 OPEN |

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
- `fridge/` — fertig (Screen, Mutations, Ablauf-Ampel, Benachrichtigungen)
- `household/` — fertig (Erstellen, Mitglieder/Rollen, Einladung+QR, Beitritt, Kinder-Profile, Wechsler)
- `inventory/` — fertig (Add-Item, Barcode-Scanner, Produktsuche/-detail, Lagerorte)
- `dashboard/` — fertig (Ablauf-Widget, Kalorienring und Makro-Balken an echte Daten aus Welle 6 angebunden)
- `calorie-tracking/` — fertig (Grundumsatz/TDEE/Makro-Presets als reine Funktionen, Ziel-Setup-Screen, Tagebuch-Screen mit CRUD/Tagessummen/Datumsnavigation)
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

**Epic 8 (Dashboard & Navigation) ist fertig.** Sinnvoller nächster Schritt:
Gate D (`#70`, Zwei-Geräte-Sync-Verifikation) nachholen, oder Epic 9
(Datenschutz & Compliance, `#96-99`).

**Nachzügler aus Welle 2/5:** erledigt — Realtime-Bridge (#48) und
Netzwerk-/Hintergrund-Trigger (#50) sind an `(app)/_layout.tsx` angeschlossen.
Offen bleibt die `#70`-Verifikation (Gate D, "<1s"-Konvergenz) am Gerät.
