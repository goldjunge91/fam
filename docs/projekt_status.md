# Projekt-Status: Family App (fam)
> Stand: 2026-08-11 · Branch: `main`
>
> Update 2026-08-11: Epic 8 (Dashboard & Navigation, #89–#95) sowie Gate D (#70, 2-Geräte-Sync-Verifikation) sind vollständig im Code umgesetzt, verifiziert und auf GitHub geschlossen (Commits `704b953`, `4c262cf`, `1a76351`, `b06cd4d`, `f58e3bf`).
>
> **Korrektur 2026-08-11 (Verifikation gegen Code+AC, nicht nur gegen Doku):** 32 als "fertig" geführte Issues wurden einzeln gegen ihre Akzeptanzkriterien im Code geprüft. 17 waren tatsächlich vollständig — die wurden jetzt erst auf GitHub geschlossen (vorher stand die Doku auf ✅, GitHub auf offen). Bei **13 Issues fehlt ein konkretes AC**, bei **2 (#78, #80) existiert trotz ✅-Markierung gar keine Implementierung**. Details je Issue unten. Betroffen bleiben absichtlich **offen** auf GitHub.


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
| **#70** | **Realtime-Sync zwischen 2 Geräten verifizieren** | **✅ CLOSED (Commit `1a76351` / `b06cd4d`)** |

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

### Epic 4 — Haushalt & Familie (🟡 OPEN #5 — #65 hat eine AC-Lücke)
| # | Issue | Status |
|---|-------|--------|
| #59 | Haushalt erstellen | ✅ CLOSED |
| #60 | Mitgliederliste mit Rollen | ✅ CLOSED |
| #61 | Einladung erzeugen (Link + QR-Code) | ✅ CLOSED |
| #62 | Haushalt beitreten (Deep Link/Code) | ✅ CLOSED |
| #63 | Rollenverwaltung + Mitglieder entfernen | ✅ CLOSED |
| #64 | Haushalt verlassen und löschen | ✅ CLOSED |
| #65 | Kinder-Profile anlegen | 🟡 OPEN — CRUD fertig, aber Kinder-Profil beim Mahlzeit-Loggen nicht als Ziel wählbar (`calorie-tracking/` referenziert kein `child`) |
| #66 | Haushalts-Wechsler | ✅ |

### Epic 5 — Kühlschrank-Tracker (🟡 OPEN #6 — 3 von 6 Issues haben AC-Lücken)
| # | Issue | Status |
|---|-------|--------|
| #67 | Bestandsliste gruppiert nach Lagerort | ✅ CLOSED |
| #68 | Artikel manuell hinzufügen | ✅ CLOSED |
| #69 | Artikel bearbeiten, verbrauchen, entfernen | 🟡 OPEN — Menge/Soft-Delete da, aber kein "Undo direkt nach dem Entfernen" |
| #70 | Realtime-Sync zwischen 2 Geräten | ✅ CLOSED (verifiziert am 2026-08-11, Commit `1a76351`) |
| #71 | Ablauf-Ampel + Sortierung nach MHD | 🟡 OPEN — Ampel + Gruppierung fertig, aber kein Sortier-Toggle nach MHD |
| #72 | Lokale Benachrichtigungen (ablaufende Artikel) | ✅ CLOSED |
| #73 | Dashboard-Widget 'läuft bald ab' | 🟡 OPEN — Karte bleibt bei 0 Artikeln sichtbar statt sich zu verstecken; kein Tap-Through zur gefilterten Bestandsliste |

### Epic 6 — Lebensmittel-Datenbank & Barcode (🔴 OPEN #7 — deutlich weniger fertig als die Doku bisher zeigte)
| # | Issue | Status |
|---|-------|--------|
| #74 | Open-Food-Facts-Client + Mapping | 🟡 OPEN — Client + Checks solide, aber Suchergebnis wird nie in `products` gespeichert (kein `.from('products')`-Insert im ganzen `src`) |
| #75 | Produktsuche mit Debounce | 🟡 OPEN — 300ms-Debounce da, aber kein lokaler SQLite→products→OFF-Fallback, kein Offline-Pfad |
| #76 | Barcode-Scanner | 🟡 OPEN — Scan + Permission-Fallback da, kein haptisches Feedback (kein `expo-haptics`-Import) |
| #77 | Produktdetail mit Portionsauswahl | ✅ CLOSED (Portionsskalierung sitzt in `add-food-entry-screen.tsx`, nicht in `inventory/product-detail-modal.tsx` — letzteres ist eine statische Demo) |
| #78 | Einheiten-Umrechnung (pure functions) | 🔴 OPEN — **nicht implementiert wie spezifiziert**: `units.ts` enthält nur Label-Normalisierung, keine g↔kg/ml↔l/Stück-Umrechnung; echte (unvollständige) Logik ist eine unexportierte Inline-Funktion in `add-food-entry-screen.tsx` |
| #79 | Liste häufig verwendeter Lebensmittel | 🔴 OPEN — bewusst zurückgestellt, Voraussetzung #86 jetzt erfüllt |
| #80 | Produkt manuell anlegen | 🔴 OPEN — **nicht implementiert**: kein Code-Pfad legt einen `products`-Eintrag mit `source='manual'` an; `add-item-screen.tsx` schreibt nur `fridge_items` |

### Epic 7 — Kalorienziele & Ernährungstagebuch (🟡 OPEN — Kern fertig, 5 von 8 Issues haben AC-Lücken)
| # | Issue | Status |
|---|-------|--------|
| #81 | Grundumsatz-Formeln (pure functions) | ✅ CLOSED |
| #82 | TDEE und Zielkalorien berechnen | ✅ CLOSED |
| #83 | Makro-Verteilung mit Presets | 🟡 OPEN — 3 Presets da, aber `low_carb` weicht vom Spec ab (30/20/50 statt 40/20/40 laut Issue) und freies Anpassen der Makros fehlt komplett |
| #84 | Ziel-Setup-Screen | 🟡 OPEN — Live-Vorschau + Kappung da, aber kein manuelles Überschreiben des berechneten Ziels möglich |
| #85 | Tagebuch-Screen nach Mahlzeiten | 🟡 OPEN — Mahlzeiten-UI da, aber `child_profile_id` (existiert im Schema) wird nirgends referenziert — Tagebuch funktioniert nur für den eingeloggten Erwachsenen |
| #86 | Eintrag hinzufügen, bearbeiten, löschen | 🟡 OPEN — Soft-Delete da, aber "Löschen mit Undo" ist tatsächlich ein Confirm-Dialog vor dem Löschen, kein Undo danach |
| #87 | Tagessummen und Restkalorien | ✅ CLOSED |
| #88 | Datumsnavigation im Tagebuch | 🟡 OPEN — Pfeil-Navigation + Zukunfts-Sperre da, aber vergangene Tage sind NICHT offline verfügbar (kein Cache-Persister, `food_entries` bewusst am SQLite-Sync vorbei — siehe Architekturnotiz unten) |

### Epic 8 — Dashboard & Navigation (🟡 OPEN — #93 hat eine AC-Lücke)
| # | Issue | Status |
|---|-------|--------|
| #89 | Tab-Struktur erweitern | ✅ (tote profile-screen.tsx entfernt, Web-Tabs an native 6 Tabs angeglichen) |
| #90 | Template-Screens durch echte Screens ersetzen | ✅ CLOSED (bewusst nur Aufräumen — Rezept-CRUD ist Zukunfts-Epic #12) |
| #91 | Animierter Kalorien-Fortschrittsring | ✅ CLOSED (schon seit Welle 6) |
| #92 | Makro-Fortschrittsbalken | ✅ CLOSED (schon seit Welle 6) |
| #93 | Dashboard-Tagesübersicht | 🟡 OPEN — Ring+Makros+Ablauf-Widget auf einer Seite da, aber kein Pull-to-Refresh (`RefreshControl` existiert nirgends im Repo) |
| #94 | Profil- und Einstellungs-Screen | ✅ (settings-screen.tsx ist der Account-Hub, doppelter profile-screen.tsx entfernt) |
| #95 | Modul-Aktivierung (Feature-Flags) | ✅ CLOSED (neue profiles-Spalten, /settings/modules, ModuleGate) |

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
- `fridge/` — überwiegend fertig (Screen, Mutations, Ablauf-Ampel, Benachrichtigungen); Lücken: kein Undo nach Entfernen (#69), kein MHD-Sortier-Toggle (#71)
- `household/` — überwiegend fertig (Erstellen, Mitglieder/Rollen, Einladung+QR, Beitritt, Wechsler); Kinder-Profile-CRUD fertig, aber nicht als Mahlzeit-Ziel wählbar (#65)
- `inventory/` — überwiegend fertig (Add-Item, Barcode-Scanner, Produktsuche); Lücken: keine `products`-Persistierung von OFF-Treffern (#74), kein Offline-Suchpfad (#75), kein Haptic-Feedback beim Scan (#76), keine echte Einheiten-Umrechnung (#78), kein manuelles Produktanlegen (#80)
- `dashboard/` — überwiegend fertig (Ablauf-Widget, Kalorienring und Makro-Balken an echte Daten angebunden); kein Pull-to-Refresh (#93), Ablauf-Widget versteckt sich nicht bei 0 Artikeln und hat kein Tap-Through (#73)
- `calorie-tracking/` — Kern fertig (Grundumsatz/TDEE als reine Funktionen, Tagessummen); Lücken: Makro-Presets weichen vom Spec ab + kein freies Anpassen (#83), kein manuelles Ziel-Override (#84), Tagebuch ignoriert Kinder-Profile (#85), "Löschen mit Undo" ist nur ein Confirm-Dialog (#86), vergangene Tage nicht offline verfügbar (#88)
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

Gate D (#70) ist verifiziert und alle 4 Wellen-Gates sind grün. **17 Issues aus Welle 4/5/6/7/8-Vorarbeiten wurden am 2026-08-11 gegen ihre Akzeptanzkriterien geprüft und auf GitHub geschlossen.** Bei der Prüfung kamen aber **15 offene Lücken** zum Vorschein (13 Issues mit einzelnen fehlenden AC, 2 Issues — `#78`, `#80` — komplett unimplementiert trotz vorheriger "✅"-Markierung); Details in den Epic-Tabellen oben. Diese Issues bleiben bewusst offen.

Zwei unabhängige nächste Schritte, keiner blockiert den anderen:
- **Welle 8 (Datenschutz & Compliance, `#96–99`)** — der letzte MVP-Baustein, bisher nicht begonnen.
- **Die 15 aufgedeckten Lücken schließen** — insbesondere `#78`/`#80` (Lebensmittel-DB), da dort mehrere andere Issues (`#74`, `#75`) implizit auf einer funktionierenden `products`-Tabelle aufbauen, die es faktisch noch nicht befüllt gibt.

