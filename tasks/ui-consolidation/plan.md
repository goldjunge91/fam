# Implementierungsplan: UI-Konsolidierung (fam-Design-System)

Status: Entwurf zur Freigabe
Stand: 2026-09-05
Initiative: `ui-consolidation`
Referenzdokumente:
- Spezifikation: [SPEC.md](../../docs/specs/ui-consolidation/SPEC.md) (Stand 2026-09-05, Contracts-Überarbeitung `fam-c6m`)
- Normative Verträge: [docs/design-system/contracts/](../../docs/design-system/contracts/README.md) (Verträge 01–10, überarbeitet)

Aufgaben werden **nicht** in einer `todo.md` geführt, sondern als Beads-Arbeitspakete (`bd`) unter dem Epic in Abschnitt „Task List“. Dieses Dokument ist die Design-/Architekturentscheidung und Abhängigkeitskarte dazu.

**Hinweis zu einem vorherigen Plan:** Ein früherer Plan unter diesem Pfad existierte bereits (Stand 2026-09-04) und klammerte Plattformparität (`.android`-Kopien) ausdrücklich als out-of-scope aus. Er wurde vor dieser Planungssitzung bereits gelöscht (git-Status zeigte `D` für `plan.md`/`todo.md`, ungecommittet). Das aktuelle `SPEC.md` wurde am selben Tag auf ausdrücklichen Folgeauftrag überarbeitet und führt Plattformparität als `PLATFORM-01` wieder ins Ziel ein. Dieser Plan folgt dem aktuellen `SPEC.md` als einziger Quelle und widerspricht damit bewusst der alten, gelöschten Fassung in diesem Punkt.

---

## 1. Übersicht und Ziel

fam erhält eine konsistente, zugängliche UI auf Basis des vorhandenen Design-Systems: genau drei zentrale Verantwortliche (`theme/index.ts`, `ThemeProvider.tsx`, `ui.tsx`), kanonische Produkt-APIs für Button/Field/SegmentedControl/Card, geprüfte Kontraste, reaktive statt importzeitgebundene Maße, vollständige Zustandsunterscheidung (Loading/Empty/Error/Refresh) und eine Referenzseite, die denselben Zustand zeigt wie der Produktcode. Die warme Mauve-/Creme-Identität und alle bestehenden Funktionen bleiben erhalten (siehe SPEC.md §3.2 Nichtziele).

Erfolg = Abnahmekriterien AC-01 bis AC-17 aus SPEC.md §12 erfüllt, mit Nachweisen gemäß SPEC.md §11.

## 2. Architektur- und Designentscheidungen (aus SPEC.md übernommen)

| ID | Bereich | Entscheidung | Referenz |
| --- | --- | --- | --- |
| ARC-01/02/03 | Verantwortlichkeit & APIs | Dreiteilung strikt einhalten; Produkt-APIs (`src/components/ui/buttons/`, `text-field.tsx`, `segmented-control.tsx`) bleiben kanonischer Einstieg; `className` nur für statisches Layout. | SPEC.md §4 |
| THEME-01 | Themeauflösung | Eine aktive Wahl, kein Remount, `system` folgt Systemwechsel live. | SPEC.md §5 |
| COLOR-01/02 | Farbpaare | Geprüfte Vordergrund-/Hintergrundpaare (4,5:1 Text, 3:1 Nicht-Text); Schattenfarben nie als Vordergrund; Legacy-Namen nur intern gemappt. | SPEC.md §5 |
| TYPE-01/SPACE-01 | Maße | 7 `Txt`-Varianten, feste Basisskala `xs..xxxl`, `rs()` reaktiv über tatsächlich verfügbare Breite, kein Importzeit-Snapshot, Mindesttouch 44×44. | SPEC.md §5 |
| BTN-01/PRESS-01 | Buttons | 4pt Tiefe/Druckweg, Flat-Ausnahme für Header, Reduced-Motion-Zweig, Haptik nur über `src/lib/haptics.ts`. | SPEC.md §6 |
| FIELD-01 | Felder | Gemeinsame Basis für `Field`/`TextField`, Fokus+Fehler gleichzeitig ohne Layoutsprung, native Events/RHF-Refs erhalten. | SPEC.md §6 |
| SELECT-01 | Auswahl | Ein kanonischer `SegmentedControl`, korrekte Rollen (Tab vs. Formularauswahl), abwählbare Mehrfachfilter. | SPEC.md §6 |
| SURFACE-01 | Flächen | `Surface`-Töne bleiben, keine dekorative Card-in-Card-Verschachtelung, antippbare Cards mit Rolle+Feedback. | SPEC.md §6 |
| STATE-01 | Datenzustände | Loading/Empty/Filterleere/Error/Refresh/Offline/Kein-Haushalt sauber getrennt, Retry nur Lesevorgang. | SPEC.md §7 |
| SCREEN-01 | Screens | 320pt + Schriftfaktor 2,0 ohne verbotenen Overflow, ein Scroll-Owner pro Bereich. | SPEC.md §7 |
| PLATFORM-01 | Plattformparität | **Offene Umsetzungsfrage, siehe Abschnitt 6.** SPEC.md verlangt `.android`-Kopien für „jede betroffene plattformübergreifende Feature-Datei“; für geteilte Primitive (`ui.tsx`, `button.tsx`, `text-field.tsx`, `segmented-control.tsx`, `card.tsx`, `empty-state.tsx`, `theme/index.ts`) ist unklar, ob die Pflicht greift. Marco hat entschieden, dies **nicht jetzt** festzulegen, sondern als offenen Punkt zu führen. | SPEC.md §8, Klärung 2026-09-05 |
| D-04/D-05 | Mocks | Sichtbare Farb-/Dichte-/Layoutänderungen erst nach mehreren statischen Mocks und Marcos Auswahl. | SPEC.md §14, AGENTS.md „Visual and design work“ |

## 3. Ist-Stand-Verifikation (vor Planung geprüft)

- Alle in SPEC.md §10.2 genannten Dateien existieren am erwarteten Pfad (verifiziert 2026-09-05).
- `.android`-Pendants existieren bereits für `screen.tsx`, `inventory-screen.tsx`, `shopping-list-screen.tsx` und `profile-button.tsx`. Sie fehlen für `theme/index.ts`, `ThemeProvider.tsx`, `ui.tsx`, `button.tsx`, `text-field.tsx`, `segmented-control.tsx`, `card.tsx`, `empty-state.tsx`.
- Contracts 01–10 und README sind bereits auf den überarbeiteten Zielzustand aktualisiert (Dokumentation, keine Codeumsetzung).
- Keine bestehenden Beads-Issues zu `ui-consolidation` gefunden (`bd search` leer); die in SPEC.md referenzierten `fam-jgi`/`fam-c6m` sind über `bd show`/`bd search` aktuell nicht auflösbar (vermutlich außerhalb des lokal synchronisierten Beads-Stands) — kein Blocker für neue Arbeitspakete, aber als Diskrepanz vermerkt.

## 4. Abhängigkeitsgraph

```
Phase 0: Mock-/Entscheidungs-Gate (D-04 Farbpalette, D-05 Dichte/Zeilenlayout)
    │
    ▼
Phase 1: Foundations (rs()/Fenster-Reaktivität → Farbpaare/Kontrast → Typografie/ThemeProvider)
    │
    ▼
Phase 2: Core Primitives (Button → Field/TextField → SegmentedControl/Pill/Badge → Surface/Card)
    │
    ▼
Phase 3: Screen-Gerüst & Datenzustände (Scroll/Safe-Area → EmptyState/Loading/Error)
    │
    ▼
Phase 4: Feature-Migration (Vorrat → Einkaufsliste → Forms/Settings/Dashboard)
    │
    ▼
Phase 5: Referenz & Abschlussverifikation (Showcase → CSS-Cleanup → AC-01..17-Nachweis)
```

Phase 0 blockiert nur die Aufgaben, die tatsächlich Farbwerte oder Dichte/Layout ändern (1.2, 3.2, 4.1, 4.2); rein strukturelle/reaktive Arbeit (1.1, 1.3, 2.1–2.4, 3.1) kann parallel zur Mock-Entscheidung beginnen. Die offene PLATFORM-01-Frage blockiert keine der Phasen 1–5; sie wird als eigenes Beads-Issue geführt und vor Abschluss von Phase 5 (AC-14) final entschieden.

## 5. Task-Liste (Beads)

Tracking erfolgt vollständig in Beads unter dem Epic. IDs werden nach dem Anlegen hier nachgetragen.

| Phase | Bead-ID | Titel | Hängt ab von |
| --- | --- | --- | --- |
| Epic | `fam-lgl` | UI-Konsolidierung: fam-Design-System | — |
| 0 | `fam-lgl.1` | Farbpaletten-Mocks (D-04) erstellen und Auswahl einholen | — (ready) |
| 0 | `fam-lgl.2` | Dichte-/Zeilenlayout-Mocks (D-05) erstellen und Auswahl einholen | — (ready) |
| 0 | `fam-lgl.3` | PLATFORM-01: Android-Kopie-Pflicht für geteilte Primitive klären | — (ready) |
| 1 | `fam-lgl.4` | 1.1 Reaktive Skalierung `rs()` und Fenster-Dimensionen | — (ready) |
| 1 | `fam-lgl.5` | 1.2 Farbpaare, Schattentrennung, Kontrast-Härtung | `fam-lgl.1` |
| 1 | `fam-lgl.6` | 1.3 Typografie-Basisskala und ThemeProvider-Härtung | `fam-lgl.4` |
| 2 | `fam-lgl.7` | 2.1 Einheitliche Button-Basis, Haptik, Reduced Motion | `fam-lgl.6` |
| 2 | `fam-lgl.8` | 2.2 Gemeinsame Field-/TextField-Eingabebasis | `fam-lgl.7` |
| 2 | `fam-lgl.9` | 2.3 SegmentedControl-/Pill-/Badge-Konsolidierung | `fam-lgl.8` |
| 2 | `fam-lgl.10` | 2.4 Surface-/Card-Foundation | `fam-lgl.9` |
| 3 | `fam-lgl.11` | 3.1 Screen-Gerüst, Safe-Area, Scroll-Ownership | `fam-lgl.10` |
| 3 | `fam-lgl.12` | 3.2 Datenzustände: EmptyState/Loading/Error/Refresh | `fam-lgl.11`, `fam-lgl.2` |
| 4 | `fam-lgl.13` | 4.1 Vorrat: Screen-Migration | `fam-lgl.12`, `fam-lgl.2` |
| 4 | `fam-lgl.14` | 4.2 Einkaufsliste: Screen-Migration | `fam-lgl.13` |
| 4 | `fam-lgl.15` | 4.3 Forms/Settings/Dashboard-Konsolidierung | `fam-lgl.14` |
| 5 | `fam-lgl.16` | 5.1 Showcase-Referenz `/settings/design-system` abgleichen | `fam-lgl.15` |
| 5 | `fam-lgl.17` | 5.2 CSS-/Tailwind-Cleanup (`global.css`) | `fam-lgl.16` |
| 5 | `fam-lgl.18` | 5.3 Abschlussverifikation AC-01..17 und Dokumentationsabgleich | `fam-lgl.17`, `fam-lgl.3` |

Detaillierte Beschreibung, Akzeptanzkriterien, Verifikation und Dateien je Task stehen im jeweiligen Beads-Issue (`bd show <id>`), nicht doppelt hier. `bd ready` zeigt aktuell `fam-lgl.1`, `fam-lgl.2`, `fam-lgl.3` und `fam-lgl.4` als startbereit (verifiziert 2026-09-05).

## 6. Offene Punkte für Marco

1. **PLATFORM-01-Scope** (siehe Abschnitt 2): Gilt die `.android`-Kopiepflicht auch für geteilte Primitive unter `src/components/ui/`, `src/components/forms/`, `src/constants/`, `src/components/theme/`? Aktuell als eigenes Beads-Issue offen geführt, nicht vorentschieden.
2. **iOS-Prüfhost**: SPEC.md §14 nennt einen verfügbaren iOS-Dev-Client-Host samt Testdaten als offene technische Voraussetzung für die native Abnahme (AC-01..17 native Nachweise). Auf diesem Windows-Host ist iOS nicht nativ verifizierbar (SPEC.md §11.3).
3. **`fam-jgi`/`fam-c6m`**: In SPEC.md referenziert, aber lokal in Beads nicht auflösbar. Falls diese IDs woanders geführt werden, bitte Pfad/Datenbank nennen, sonst bleibt es eine reine Doku-Referenz ohne Verknüpfung im lokalen Tracker.

## 7. Risiken und Gegenmaßnahmen

| Risiko | Schwere | Gegenmaßnahme |
| --- | --- | --- |
| Reaktives `rs()` verursacht Re-Render-Schleifen/Performance-Einbußen | Mittel | Nur bei echten Dimensionsänderungen (`useWindowDimensions`) neu berechnen, Werte memoisieren. |
| Layout-Sprung bei Feld-Fokus (1,5pt → 2pt Kontur) | Niedrig | Geometrieausgleich zentral in `ui.tsx` (z. B. kompensierendes Padding), nicht pro Aufrufer. |
| Kontrastkonflikte bei dunklen Badges (Schattenfarbe als Text) | Mittel | Verbot strikt in `makeAccent()`/`makeCategoryTone()` durchsetzen, per Tokentest abgesichert. |
| Bestehende Tests/Snapshots brechen an alten Prop-Namen | Mittel | Dünne Kompatibilitätsadapter, schrittweise Migration mit gezielten RNTL-Tests statt Big-Bang. |
| PLATFORM-01-Unklarheit verzögert Phase-2-Abschluss | Niedrig | Blockiert Phasen 1–5 nicht (siehe Abhängigkeitsgraph); eigenes Issue, Entscheidung spätestens vor Abschlussverifikation nötig. |
| Sichtbare Änderung ohne Mock-Freigabe rutscht versehentlich in einen Task | Mittel | Jeder Task mit Farb-/Dichteänderung referenziert explizit die Phase-0-Mock-Entscheidung als Dependency; kein Start ohne Pick. |

## 8. Was dieser Plan nicht freigibt

Gemäß SPEC.md §13 „Grenzen der späteren Umsetzung“ und AGENTS.md-Leitplanken: keine handgeschriebenen Migrationen, kein Start/Stopp der lokalen Supabase-Instanz, keine `bun test`/volle Testsuite, keine stillen nativen Dependencies, kein Commit/Push ohne ausdrückliche Freigabe, keine Umsetzung sichtbarer Layout-/Copy-Änderungen ohne Mock-Auswahl. Dieser Plan autorisiert keine Codeänderung — das folgt erst nach Freigabe der Beads-Arbeitspakete.
