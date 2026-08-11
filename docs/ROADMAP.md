# Roadmap — Abarbeitungsreihenfolge

99 Issues in 10 Wellen. Innerhalb einer Welle ist die Reihenfolge weitgehend frei;
zwischen den Wellen gibt es **vier Gates**, die grün sein müssen, bevor es weitergeht.

Alle Issues: <https://github.com/goldjunge91/fam/issues>

---

## Status-Übersicht

> Stand: 2026-08-11 — korrigiert nach Code-Abgleich und Schließen der GitHub-Issues (#9, #58, #66, #70, #89–#92, #95).
>
> **Korrektur 2026-08-11 (AC-Verifikation):** 32 zuvor als "fertig" geführte Issues wurden einzeln gegen ihre Akzeptanzkriterien im Code geprüft, nicht nur gegen Commit-Messages. 17 waren wirklich fertig (jetzt geschlossen). **15 haben eine Lücke** — 13 fehlt ein einzelnes AC, bei **#78 und #80 existiert trotz vorheriger ✅-Markierung keine Implementierung**. Die Wellen-Status unten spiegeln das jetzt wider; Issue-Details in `docs/projekt_status.md`.

| Welle | Thema | Status | Gate |
|---|---|---|---|
| 0 | Werkzeug & Supabase | ✅ Fertig | **A** ✅ Dev Build läuft |
| 1 | Datenmodell & RLS | ✅ Fertig | **B** ✅ RLS-Tests grün |
| 2 | Offline & Sync | ✅ Fertig (#70 verifiziert in Commit `1a76351` / `b06cd4d`) | **C** ✅ Konflikttests grün |
| 3 | Auth & Onboarding | ✅ Fertig (inkl. #104 6-Step Wizard) | — |
| 4 | Haushalt | 🟡 Fast fertig — #59–64, #66 geschlossen; #65 offen (Kinder-Profil nicht als Mahlzeit-Ziel wählbar) | — |
| 5 | Kühlschrank + Einkaufsliste | 🟡 Fast fertig — #67, #68, #70, #72 geschlossen; #69 (kein Undo), #71 (kein Sortier-Toggle), #73 (Widget versteckt sich nicht) offen | **D** ✅ 2-Geräte-Sync verifiziert |
| P | Lebensmittel-DB | 🔴 Deutlich weniger fertig als bisher dokumentiert — nur #77 geschlossen; #74–76 haben AC-Lücken, **#78 und #80 sind nicht implementiert**, #79 offen (Voraussetzung #86 jetzt erfüllt) | — |
| 6 | Kalorien & Tagebuch | 🟡 Kern fertig (#81, #82, #87 geschlossen) — #83–86, #88 haben je ein fehlendes AC (Presets, Ziel-Override, Kinder-Profile, Undo, Offline-Cache) | — |
| 7 | Dashboard & Navigation | 🟡 Fast fertig — #89–92, #95 geschlossen; #93 offen (kein Pull-to-Refresh) | — |
| 8 | Datenschutz | 🔴 Offen | MVP fertig |

**Sync-Engine-Nachzügler:** Erledigt — Realtime-Bridge (#48), Netzwerk-/Hintergrund-Trigger (#50) sowie Gate D (#70 2-Geräte-Sync) wurden verdrahtet (Commit `1a76351` / `b06cd4d`, PR #118). Der Sync läuft aktuell über **Realtime-Bridge + Netzwerk-Reconnect + Background-Sync + Poll-Fallback (20s)**, alle vier aktiv verdrahtet in `(app)/_layout.tsx`.


---

## Auf einen Blick

| Welle | Thema | Issues | Gate |
|---|---|---|---|
| 0 | Werkzeug & Supabase | [#25](https://github.com/goldjunge91/fam/issues/25)–[#33](https://github.com/goldjunge91/fam/issues/33) | **A** — Dev Build läuft |
| 1 | Datenmodell & RLS | [#34](https://github.com/goldjunge91/fam/issues/34)–[#44](https://github.com/goldjunge91/fam/issues/44) | **B** — RLS-Tests grün |
| 2 | Offline & Sync | [#45](https://github.com/goldjunge91/fam/issues/45)–[#51](https://github.com/goldjunge91/fam/issues/51) | **C** — Konflikttests grün |
| 3 | Auth & Onboarding | [#52](https://github.com/goldjunge91/fam/issues/52)–[#58](https://github.com/goldjunge91/fam/issues/58) | |
| 4 | Haushalt | [#59](https://github.com/goldjunge91/fam/issues/59)–[#66](https://github.com/goldjunge91/fam/issues/66) | |
| 5 | Kühlschrank | [#67](https://github.com/goldjunge91/fam/issues/67)–[#73](https://github.com/goldjunge91/fam/issues/73) | **D** — 2-Geräte-Sync verifiziert |
| P | Lebensmittel-DB *(parallel ab Welle 3)* | [#74](https://github.com/goldjunge91/fam/issues/74)–[#80](https://github.com/goldjunge91/fam/issues/80) | |
| 6 | Kalorien & Tagebuch | [#81](https://github.com/goldjunge91/fam/issues/81)–[#88](https://github.com/goldjunge91/fam/issues/88) | |
| 7 | Dashboard & Navigation | [#89](https://github.com/goldjunge91/fam/issues/89)–[#95](https://github.com/goldjunge91/fam/issues/95) | |
| 8 | Datenschutz | [#96](https://github.com/goldjunge91/fam/issues/96)–[#99](https://github.com/goldjunge91/fam/issues/99) | MVP fertig |

---

## Welle 0 — Werkzeug & Supabase

**Zuerst [#27](https://github.com/goldjunge91/fam/issues/27) (EAS Dev Build) anstoßen** — Cloud-Builds dauern, und ohne Dev Build läuft ab
Welle 2 nichts (`expo-sqlite`, `expo-camera`, `expo-notifications`, `expo-secure-store`
funktionieren nicht in Expo Go). Während der Build läuft, den Rest erledigen.

```
#27 EAS Dev Build ........................ zuerst starten, läuft nebenher
#25 Biome        ┐
#26 jest-expo    ┘ unabhängig, parallel
#28 Supabase CLI → #29 Env-Doku → #30 Supabase-Client (SecureStore-Chunking)
#31 Typgenerierung   (nach den ersten Migrationen erneut laufen lassen)
#32 TanStack Query
#33 CI-Pipeline      (zum Schluss — braucht #25, #26, #31)
```

> **Gate A:** Development Build startet auf iOS und Android und verbindet sich mit Metro.

## Welle 1 — Datenmodell & RLS

Das Fundament. Fehler hier sind später teuer, weil alle Features darauf aufsetzen.

```
#34 profiles + Trigger
 └→ #35 households + household_members     ← kritisch, siehe unten
     ├→ #36 invites + redeem_invite RPC
     └→ #37 child_profiles
#38 products                                (unabhängig, jederzeit)
#39 storage_locations + fridge_items        (braucht #35, #38)
#40 shopping_list_items                     (braucht #35, #38)
#41 private Tracking-Tabellen               (braucht #34, #37, #38)
#42 Sync-Metadaten                          (braucht #39, #40, #41)
#44 Realtime-Publication                    (braucht #39, #40, #42)
#43 RLS-Integrationstests                   ← Gate
```

[#35](https://github.com/goldjunge91/fam/issues/35) ist der Punkt, an dem am meisten Zeit verloren geht: Eine Policy auf
`household_members`, die selbst `household_members` abfragt, läuft in
`infinite recursion`. Zugehörigkeit ausschließlich über `SECURITY DEFINER`-Funktionen
prüfen. Details stehen im Issue.

> **Gate B:** [#43](https://github.com/goldjunge91/fam/issues/43) ist grün — nachgewiesen, dass ein Haushaltsmitglied die privaten
> Tracking-Daten eines anderen weder lesen noch schreiben kann.

## Welle 2 — Offline & Sync

Der technisch riskanteste Teil. Braucht Gate A und Gate B.

```
#45 expo-sqlite + lokales Schema
 └→ #46 Outbox-Queue
     └→ #47 Sync-Engine (Pull/Push/LWW)     ← Herzstück
         ├→ #48 Realtime → SQLite Bridge
         ├→ #49 Konflikt-Unit-Tests         ← Gate
         ├→ #50 Netzwerkstatus + Background
         └→ #51 Offline-Indikator
```

> **Gate C:** [#49](https://github.com/goldjunge91/fam/issues/49) grün — inklusive der Fälle „Delete schlägt Update" und
> „Geräteuhr geht falsch".

## Welle 3 — Auth & Onboarding

```
#52 (auth)-Group + Guard → #53 Registrierung → #54 Login
                                                ├→ #55 Passwort-Reset
                                                ├→ #56 Session-Persistenz  ← nicht überspringen
                                                └→ #58 Logout + lokale Löschung
#57 Profil-Onboarding (braucht #53)
```

[#56](https://github.com/goldjunge91/fam/issues/56) ist der Praxistest für den SecureStore-Adapter aus [#30](https://github.com/goldjunge91/fam/issues/30). Fällt der durch, sind
Nutzer nach jedem App-Neustart ausgeloggt — ein Fehler, der sonst erst spät auffällt.

## Welle 4 — Haushalt 🟡 Fast fertig (#65 offen)

```
#59 Haushalt erstellen
 └→ #60 Mitgliederliste
     ├→ #61 Einladung (Link + QR) → #62 Beitritt
     ├→ #63 Rollenverwaltung → #64 Verlassen/Löschen
     └→ #65 Kinder-Profile
#66 Haushalts-Wechsler (braucht #59 und #48)
```

> **Stand 2026-08-11:** #65 offen — Kinder-Profil-CRUD fertig, aber beim Loggen einer
> Mahlzeit in `calorie-tracking/` nicht als Ziel wählbar.

## Welle 5 — Kühlschrank 🟡 Fast fertig, Gate D ✅

Erstes Feature, das Welle 1, 2 und 4 gleichzeitig belastet — der eigentliche
Integrationstest der Architektur.

```
#67 Bestandsliste → #68 Artikel hinzufügen → #69 Bearbeiten/Verbrauchen
                                              └→ #70 2-Geräte-Sync-Test   ← Gate
#71 Ablauf-Ampel → #72 Lokale Benachrichtigungen
#73 Dashboard-Widget (braucht #71 und #93)
```

> **Stand 2026-08-11:** #69 (kein Undo nach Entfernen), #71 (kein Sortier-Toggle nach
> MHD) und #73 (Widget versteckt sich nicht bei 0 Artikeln, kein Tap-Through) bleiben
> offen.

> **Gate D:** [#70](https://github.com/goldjunge91/fam/issues/70) verifiziert — Änderung auf Gerät A erscheint auf Gerät B in unter
> einer Sekunde, Offline-Änderungen kommen nach Reconnect korrekt an.

## Parallel-Track — Lebensmittel-DB

Berührt keine Haushaltsdaten und kann **ab Welle 3 nebenher** laufen. Gut geeignet, wenn
mehrere Personen oder Agenten parallel arbeiten.

```
#78 Einheiten-Umrechnung    (reine Funktion, braucht nur #26)
#74 Open-Food-Facts-Client → #75 Suche ─┬→ #76 Barcode-Scanner → #80 Produkt manuell
                                        └→ #77 Produktdetail (braucht auch #78)
#79 Häufig verwendet        (erst nach #86)
```

> **Stand 2026-08-11:** #78 und #80 existieren trotz Abhängigkeitspfeilen oben faktisch
> nicht im Code (siehe `docs/projekt_status.md`, Epic 6). #74–76 haben je eine AC-Lücke.
> Nur #77 ist vollständig verifiziert. Bevor hier weitergebaut wird: #78 zuerst, weil
> #77 (Portionsskalierung) bereits eine eigene, unvollständige Kopie der Umrechnungslogik
> mitschleppt statt #78 zu nutzen.

## Welle 6 — Kalorien & Tagebuch

Der Rechenkern besteht aus reinen Funktionen — ohne I/O, damit mock-frei testbar.

```
#81 Grundumsatz-Formeln → #82 TDEE + Zielkalorien → #83 Makro-Verteilung → #84 Ziel-Setup
#85 Tagebuch-Screen → #86 Einträge CRUD → #87 Tagessummen
                                           └→ #88 Datumsnavigation
```

Bei [#82](https://github.com/goldjunge91/fam/issues/82) die Sicherheitskappung nicht weglassen: Das Ziel darf nie unter den
Grundumsatz fallen.

> **Stand 2026-08-11:** #81/#82/#87 verifiziert und geschlossen. #83 (Presets weichen
> vom Spec ab, kein freies Anpassen), #84 (kein Ziel-Override), #85 (ignoriert
> `child_profile_id`), #86 (Confirm-Dialog statt Undo) und #88 (vergangene Tage nicht
> offline verfügbar) bleiben offen — Details in `docs/projekt_status.md`.

## Welle 7 — Dashboard & Navigation

```
#89 Tab-Struktur → #90 Template-Screens ersetzen     ← eigener Commit
#91 Fortschrittsring ┐
#92 Makro-Balken     ┘ → #93 Tagesübersicht → #73
#94 Profil/Einstellungen → #95 Modul-Aktivierung
```

Laut `CLAUDE.md` bekommt jede UI-Änderung einen eigenen Commit, und
`src/components/ui/` wird nicht angefasst.

> **Stand 2026-08-11:** #89–92, #95 verifiziert und geschlossen. #93 bleibt offen — kein
> Pull-to-Refresh im Dashboard (`RefreshControl` kommt im Repo nirgends vor).

## Welle 8 — Datenschutz

```
#96 Datenschutzerklärung → #99 Store-Privacy-Labels
#97 Datenexport
#98 Account-Löschung (braucht #58, #64)
```

Mit Welle 8 ist der MVP komplett. Phase 2–4 sind als Epics
([#11](https://github.com/goldjunge91/fam/issues/11)–[#24](https://github.com/goldjunge91/fam/issues/24)) beschrieben und werden aufgeschlüsselt, sobald der MVP steht.

---

## Parallel arbeiten

Drei Tracks lassen sich ab Welle 3 gleichzeitig bearbeiten, ohne dass sie sich in die
Quere kommen:

| Track | Wellen | Berührt |
|---|---|---|
| A | 3 → 4 → 5 | Auth, Haushalt, Kühlschrank |
| B | Parallel-Track → 6 | Produkte, Kalorien, Tagebuch |
| C | 7 | Dashboard, Navigation |

Track C braucht Ergebnisse aus A und B und startet sinnvoll erst, wenn [#87](https://github.com/goldjunge91/fam/issues/87) steht.

## Ein Issue ist erst „done", wenn …

… seine Akzeptanzkriterien abgehakt sind. Bei Welle 1 und 2 heißt das konkret grüne
Tests (`bun test`, RLS-Suite gegen `supabase start`), nicht „Code existiert".
