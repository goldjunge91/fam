# Projekt-Status: Family App (fam)
> Stand: 2026-08-06 · Branch: `main`

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

### Epic 4 — Haushalt & Familie (🔴 OPEN #5)
| # | Issue | Status |
|---|-------|--------|
| #59 | Haushalt erstellen | 🔴 OPEN |
| #60 | Mitgliederliste mit Rollen | 🔴 OPEN |
| #61 | Einladung erzeugen (Link + QR-Code) | 🔴 OPEN |
| #62 | Haushalt beitreten (Deep Link/Code) | 🔴 OPEN |
| #63 | Rollenverwaltung + Mitglieder entfernen | 🔴 OPEN |
| #64 | Haushalt verlassen und löschen | 🔴 OPEN |
| #65 | Kinder-Profile anlegen | 🔴 OPEN |
| #66 | Haushalts-Wechsler | 🔴 OPEN |

### Epic 5 — Kühlschrank-Tracker (🔴 OPEN #6)
| # | Issue | Status |
|---|-------|--------|
| #67 | Bestandsliste gruppiert nach Lagerort | 🔴 OPEN |
| #68 | Artikel manuell hinzufügen | 🔴 OPEN |
| #69 | Artikel bearbeiten, verbrauchen, entfernen | 🔴 OPEN |
| #70 | Realtime-Sync zwischen 2 Geräten | 🔴 OPEN |
| #71 | Ablauf-Ampel + Sortierung nach MHD | 🔴 OPEN |
| #72 | Lokale Benachrichtigungen (ablaufende Artikel) | 🔴 OPEN |
| #73 | Dashboard-Widget 'läuft bald ab' | 🔴 OPEN |

### Epic 6 — Lebensmittel-Datenbank & Barcode (🔴 OPEN #7)
| # | Issue | Status |
|---|-------|--------|
| #74 | Open-Food-Facts-Client + Mapping | 🔴 OPEN |
| #75 | Produktsuche mit Debounce | 🔴 OPEN |
| #76 | Barcode-Scanner | 🔴 OPEN |
| #77 | Produktdetail mit Portionsauswahl | 🔴 OPEN |
| #78 | Einheiten-Umrechnung (pure functions) | 🔴 OPEN |
| #79 | Liste häufig verwendeter Lebensmittel | 🔴 OPEN |
| #80 | Produkt manuell anlegen | 🔴 OPEN |

### Epic 7 — Kalorienziele & Ernährungstagebuch (🔴 OPEN #8)
| # | Issue | Status |
|---|-------|--------|
| #81 | Grundumsatz-Formeln (pure functions) | 🔴 OPEN |
| #82 | TDEE und Zielkalorien berechnen | 🔴 OPEN |
| #83 | Makro-Verteilung mit Presets | 🔴 OPEN |
| #84 | Ziel-Setup-Screen | 🔴 OPEN |
| #85 | Tagebuch-Screen nach Mahlzeiten | 🔴 OPEN |
| #86 | Eintrag hinzufügen, bearbeiten, löschen | 🔴 OPEN |
| #87 | Tagessummen und Restkalorien | 🔴 OPEN |
| #88 | Datumsnavigation im Tagebuch | 🔴 OPEN |

### Epic 8 — Dashboard & Navigation (🔴 OPEN #9)
| # | Issue | Status |
|---|-------|--------|
| #89 | Tab-Struktur erweitern | 🔴 OPEN |
| #90 | Template-Screens durch echte Screens ersetzen | 🔴 OPEN |
| #91 | Animierter Kalorien-Fortschrittsring | 🔴 OPEN |
| #92 | Makro-Fortschrittsbalken | 🔴 OPEN |
| #93 | Dashboard-Tagesübersicht | 🔴 OPEN |
| #94 | Profil- und Einstellungs-Screen | 🔴 OPEN |
| #95 | Modul-Aktivierung (Feature-Flags) | 🔴 OPEN |

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
- `auth/` — vollständig (Sign-in, Sign-up, Onboarding 6-Step Wizard)
- `fridge/` — UI-Gerüst vorhanden
- `household/` — Members-Screen vorhanden
- `inventory/` — Add-Item-Screen mit Modal (letzter Commit)
- `dashboard/` — Gerüst
- `onboarding/` — fertig
- `profile/` — Gerüst
- `recipes/` — Gerüst
- `settings/` — Gerüst
- `shopping-list/` — Gerüst

### App-Routen (`src/app/`)
- `(auth)/` — Login, Register
- `(app)/` — fridge, index, profile, recipes, settings, shopping-list
- `household/` — storage-locations
- `settings/` — profile, sync-debug
- `onboarding.tsx`, `add-item.tsx`

---

## 🎯 Empfohlene nächste Schritte

**Als nächstes sinnvoll (Epic 4 — Haushalt):**
1. `#59` Haushalt erstellen → DB-RPC `create_household` bereits vorhanden
2. `#60` Mitgliederliste — Members-Screen Gerüst schon da
3. `#61-62` Einladung erzeugen + Deep Link (QR-Code)

**Parallel dazu (Epic 8 — Dashboard):**
- `#89` Tab-Struktur fertigstellen (Placeholder-Tabs existieren schon)
- `#90` Template-Screens durch echte Screens ersetzen

**Epic 2 abschließen:**
- `#70` Realtime-Sync Zwei-Geräte-Test → einziger offener Punkt
