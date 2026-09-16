# Implementierungsplan: Natürliche Einkaufsartikel-Eingabe als Beta

**Status:** Review erforderlich
**Stand:** 2026-09-16
**Spec:** [docs/specs/natural-language-shopping-items/SPEC.md](../docs/specs/natural-language-shopping-items/SPEC.md)
**Capability Map:** [docs/specs/natural-language-shopping-items/CAPABILITY_MAP.md](../docs/specs/natural-language-shopping-items/CAPABILITY_MAP.md)
**Task-Tracker:** Beads unter `fam-pa0g`; `tasks/plan.md` und `tasks/todo.md` werden für dieses Vorhaben nicht verwendet.

## Overview

Die Umsetzung liefert eine vollständig isolierte Beta für natürlichsprachliche
Einkaufslisten-Eingabe. Text und Speech-to-Text laufen in denselben lokalen
Parser. Die Beta zeigt eine artikelweise Vorschau, routet eindeutige
Händler-/Markenangaben sicher und schreibt erst nach Bestätigung oder sicherer
Automatikfreigabe über die vorhandene `useAddShoppingItem`-/Outbox-Grenze.

Der bestehende manuelle Add-Item-Flow bleibt unverändert. Die Beta darf keine
bestehenden `AddItemForm`-, `AddItemModal`- oder `ShoppingListScreen`-
Komponenten erweitern. KI bleibt optional, nachgelagert und ohne direkte
Schreibberechtigung.

## Context Pack

### Verbindliche Quellen

- [Spec](../docs/specs/natural-language-shopping-items/SPEC.md)
- [Capability Map](../docs/specs/natural-language-shopping-items/CAPABILITY_MAP.md)
- `src/features/shopping-list/ARCHITECTURE.md`
- `src/features/shopping-list/hooks/use-shopping-list-mutations.ts`
- `src/lib/db/shopping-list-merge.ts`
- `src/lib/db/outbox.ts`
- `src/features/shopping-list/hooks/use-stores.ts`
- `src/features/shopping-list/domain-logik/product-store-preference.ts`
- `src/features/premium/` für vorhandenen RevenueCat-/Abo-Kontext

### Bekannte Projektgrenzen

- Expo `~57.0.19`, React Native `0.86.3`, TypeScript `~6.0.3`.
- Unistyles v3 ist die einzige aktive Styling-Runtime.
- `FlashList` ist die einzige virtuelle Listenkomponente.
- Lokale Mutationen laufen über SQLite und Outbox.
- Neue native Abhängigkeiten erfordern Dev-Client-Rebuild und vorherige Prüfung.
- Supabase-Schema bleibt deklarativ; eine Änderung ist nicht geplant.
- Niemals `bun test`; fokussierte Tests laufen über `bun run test <file>`.

## Architecture Decisions

1. **Beta-Isolation:** Neue Beta-Dateien leben unter
   `src/features/shopping-list-natural-language-beta/` mit eigenem App-Einstieg.
   Bestehende Add-Item-Komponenten werden nicht verändert.
2. **Shared write boundary:** Nur `useAddShoppingItem` und der bereits
   etablierte SQLite-/Outbox-Pfad werden wiederverwendet. Es gibt keine zweite
   Shopping-List-Schreib- oder Sync-Schicht.
3. **Pure domain core:** Parser und Händler-Routing sind reine, typisierte
   Funktionen ohne React, Netzwerk, Datenbank oder KI.
4. **Local-first:** Lokale Erkennung und sichere Vorschau sind unabhängig von
   Abo, KI und Netzwerk nutzbar. Die KI erhält nur eine nachgelagerte,
   provider-neutrale Adaptergrenze.
5. **Fail-safe automation:** Nur vollständig aufgelöste, konfliktfreie
   Ergebnisse dürfen nach Nutzerzustimmung automatisch verarbeitet werden.
   Unklare Ergebnisse bleiben im Review.
6. **No schema by default:** Lern-/Zustimmungszustände bleiben zunächst lokal.
   Eine Synchronisation persönlicher Mappings oder eine neue Supabase-Tabelle
   ist ausdrücklich ein separates Ask-first-Gate.

## Dependency Graph

```text
T4 beta-shell ───────────────────────────────────────────────┐
T5 speech-input ───────────────┐                              │
T8 local-recognition ──────────┼─> T1 retailer-routing ───────┤
                               └──────────────────────────────┤
                                                              v
                                                     T6 preview-editor
                                                              |
                                      T3 ai-assist ────────────┤
                                      (parallel after T1/T8)  v
                                                     T7 automation
                                                              |
                                                     T9 integration
                                                              |
                                                     T2 device/E2E
```

T3 kann nach T1 und T8 parallel zu T6/T7 vorbereitet werden. T9 wartet auf
alle Entscheidungen, die das freigegebene Ergebnis oder die Schreibberechtigung
beeinflussen. T2 ist der abschließende Geräte- und End-to-End-Nachweis.

## Task List

### Phase 1: Beta-Grenze und lokale Grundlagen

#### Task `fam-pa0g.4`: Isolated beta shell and entry

**Beschreibung:** Eigenen Beta-Feature-Root, Screen/Form-Komposition und
isolierten App-Einstieg anlegen. Die Beta muss unabhängig vom bestehenden
manuellen Add-Item-Flow testbar und deaktivierbar sein.

**Akzeptanzkriterien:**

- [ ] Beta besitzt einen eigenen Feature-Root und eigenen Einstieg.
- [ ] `AddItemForm`, `AddItemModal` und `ShoppingListScreen` werden nicht
      verändert oder importiert.
- [ ] Beta-Einstieg kann ohne Umbau des bestehenden Add-Flows getestet werden.

**Verifikation:**

- [ ] Fokussierter Screen-/Route-Test.
- [ ] `bun run check` auf dem Slice.
- [ ] Statischer Import-Check bestätigt Beta-Isolation.

**Abhängigkeiten:** Keine
**Wahrscheinliche Dateien:** Neue Beta-Route, Beta-Screen, colocated Tests
**Umfang:** M, 3–5 Dateien

#### Task `fam-pa0g.5`: Validate and implement native speech-to-text boundary

**Beschreibung:** Native Speech-to-Text-Lösung für Expo 57, iOS und Android
prüfen und die kleinste isolierte Adaptergrenze umsetzen. Die Entscheidung
zwischen vorhandener Plattform-API und neuer Abhängigkeit wird dokumentiert,
bevor native Dateien oder Config-Plugins hinzugefügt werden.

**Akzeptanzkriterien:**

- [ ] Start, Stop, Permission, unavailable und error sind typisiert abgebildet.
- [ ] Erfolgreicher Stop liefert direkt den Preview-Input, ohne Transcript-
      Zwischeneditor.
- [ ] Offline-Verhalten funktioniert, wenn die native Plattformerkennung
      verfügbar ist; Texteingabe bleibt bei Fehlern verfügbar.
- [ ] Roh-Audio wird weder persistiert noch geloggt.

**Verifikation:**

- [ ] Versionierte Expo-57-Dokumentation und native Plattformdokumentation
      geprüft.
- [ ] Adapter-Unit-Tests erfolgreich.
- [ ] Mikrofon-, Berechtigungs- und Offlinepfad auf iOS- und Android-Dev-Client
      geprüft.

**Abhängigkeiten:** Keine
**Wahrscheinliche Dateien:** Neue Beta-Speech-Adapterdateien und Tests; native
Dateien nur nach Entscheidungs-Gate
**Umfang:** M, 3–5 Dateien plus mögliche native Grenze

#### Task `fam-pa0g.8`: Implement deterministic local shopping parser

**Beschreibung:** Reine deutsche Parserlogik für Batch-Eingaben implementieren.
Getippter Text und fertige Speech-to-Text-Transcripts verwenden exakt denselben
Vertrag.

**Akzeptanzkriterien:**

- [ ] Der vereinbarte Beispielsatz erzeugt vier Artikel.
- [ ] Menge, Einheit, Produktname und Marke werden getrennt und deterministisch
      ausgegeben.
- [ ] Unklare oder widersprüchliche Fragmente erhalten Reviewstatus.
- [ ] Keine React-, Netzwerk-, Datenbank- oder KI-Abhängigkeit.

**Verifikation:**

- [ ] Fokussierte Parser-Unit-Tests für positive, gemischte und unklare deutsche
      Eingaben.
- [ ] `bun run typecheck`.

**Abhängigkeiten:** Keine
**Wahrscheinliche Dateien:** Parser-Domainmodul und colocated Test
**Umfang:** S, 1–2 Dateien

#### Task `fam-pa0g.1`: Implement retailer routing and product matching contract

**Beschreibung:** Händler- und Markenauflösung als reine Funktion umsetzen.
Explizite Händlerangaben haben Vorrang; unbekannte oder widersprüchliche Fälle
werden sicher in Review gehalten.

**Akzeptanzkriterien:**

- [ ] Expliziter Händler überschreibt ein kollidierendes Markenmapping.
- [ ] `Skyr von ja` routet bei vorhandenem REWE-Store nach REWE.
- [ ] Unbekannte oder widersprüchliche Mappings liefern keinen geratenen Store.
- [ ] Produktmatching kann nur bei eindeutiger lokaler Identität `product_id`
      vorschlagen.

**Verifikation:**

- [ ] Fokussierte Routing-Unit-Tests.
- [ ] `bun run typecheck`.

**Abhängigkeiten:** `fam-pa0g.8`
**Wahrscheinliche Dateien:** Routing-Domainmodul und colocated Test
**Umfang:** S, 1–2 Dateien

### Checkpoint: Lokale Grundlagen

- [ ] T4, T5, T8 und T1 sind verifiziert.
- [ ] Parser und Routing sind ohne Netzwerk und Datenbank testbar.
- [ ] Speech-to-Text-Entscheidung ist dokumentiert und native Risiken sind
      sichtbar.
- [ ] Marco bestätigt den Checkpoint, bevor die Beta-Vorschau integriert wird.

### Phase 2: Review, Lernen und optionale KI

#### Task `fam-pa0g.6`: Build isolated batch preview and editor

**Beschreibung:** Beta-Vorschau für einzelne erkannte Artikel mit Bearbeitung
und sicherem Review-Zustand erstellen.

**Akzeptanzkriterien:**

- [ ] Jeder Artikel erscheint separat.
- [ ] Name, Menge, Einheit, Marke und Händlerliste sind editierbar.
- [ ] Unklare Artikel sind sichtbar markiert und werden nicht automatisch
      geschrieben.
- [ ] Speech-to-Text öffnet nach Stop direkt diese Vorschau.

**Verifikation:**

- [ ] Fokussierte RNTL-Tests für Batch, Editieren, Review und Bestätigung.
- [ ] Kein Import bestehender Add-Item-UI-Komponenten.

**Abhängigkeiten:** `fam-pa0g.8`, `fam-pa0g.1`, `fam-pa0g.5`
**Wahrscheinliche Dateien:** Beta-Preview, Beta-Editor, UI-Testdateien
**Umfang:** M, 3–5 Dateien

#### Task `fam-pa0g.7`: Add learning counter and local automation consent

**Beschreibung:** Positive Lernsignale, Deduplizierung, konfigurierbaren
Schwellenwert und die einmalige Zustimmung zur automatischen lokalen
Verarbeitung implementieren.

**Akzeptanzkriterien:**

- [ ] Bestätigte oder korrigierte eindeutige Zuordnungen zählen einmal.
- [ ] Identische normalisierte Zuordnungen erhöhen den Zähler nicht.
- [ ] `positiveAssignmentThreshold` ist konfigurierbar und startet mit `10`.
- [ ] Die lokale Automatik-Abfrage erscheint nach dem Schwellenwert genau einmal
      und ist widerrufbar.
- [ ] Automatik überspringt keine offenen Konflikte.

**Verifikation:**

- [ ] Fokussierte Domain-Tests für Zähler, Deduplizierung und Freigabe.
- [ ] RNTL-Tests für Zustimmung, Ablehnung und Widerruf.
- [ ] Storage-Scope ist vor Implementierung entschieden: accountgebunden lokal
      oder ausdrücklich anders begründet.

**Abhängigkeiten:** `fam-pa0g.6`
**Wahrscheinliche Dateien:** Beta-Automationslogik, lokaler Preference-Adapter,
Tests
**Umfang:** M, 3–5 Dateien

#### Task `fam-pa0g.3`: Add optional AI fallback and three-level gating

**Beschreibung:** Provider-neutrale KI-Grenze mit Abo-/Einwilligungs-Gates und
den drei Verbesserungsstufen umsetzen. Ein konkreter externer Provider bleibt
bis zur separaten Entscheidung hinter dem Adapter.

**Akzeptanzkriterien:**

- [ ] Lokale Erkennung läuft vor jedem KI-Versuch.
- [ ] Ohne aktives AI-Abo oder ohne separate Einwilligung gibt es keinen
      externen Aufruf.
- [ ] `leicht`, `mittel` und `voll` haben die in der Spec definierten Bereiche.
- [ ] KI liefert Vorschläge, schreibt nicht selbst und lässt Unsicherheit im
      Review.
- [ ] Providerfehler fallen auf lokalen Vorschaupfad zurück.

**Verifikation:**

- [ ] Fokussierte Unit-Tests mit gemocktem Abo-, Einwilligungs- und Provider-
      Adapter.
- [ ] Kein echter externer KI-Aufruf in Unit- oder CI-Tests.
- [ ] Provider-/Edge-Function-Entscheidung und Datenschutzvertrag dokumentiert,
      bevor Netzwerkcode implementiert wird.

**Abhängigkeiten:** `fam-pa0g.8`, `fam-pa0g.1`
**Wahrscheinliche Dateien:** Beta-AI-Vertrag, Gate-Orchestrator, Tests
**Umfang:** M, 3–5 Dateien

### Checkpoint: Review und Freigaben

- [ ] T6, T7 und T3 sind fokussiert getestet.
- [ ] Automatische lokale Verarbeitung ist von KI-Einwilligung getrennt.
- [ ] Alle unklaren lokalen und KI-Ergebnisse bleiben reviewpflichtig.
- [ ] Storage-Scope, Providergrenze und Datenschutzfluss sind explizit bestätigt.

### Phase 3: Bestehende Schreibgrenze und Geräteabnahme

#### Task `fam-pa0g.9`: Persist approved beta results through existing mutation and outbox

**Beschreibung:** Die Beta-Orchestrierung an die bestehende
`useAddShoppingItem`-/Outbox-Grenze anschließen. Die Beta darf keine eigene
Persistenz- oder Sync-Logik einführen.

**Akzeptanzkriterien:**

- [ ] Bestätigte und sicher automatisch freigegebene Artikel werden einzeln
      über die bestehende Mutation geschrieben.
- [ ] Menge, Einheit, eindeutige `product_id` und `store_id` werden korrekt
      übergeben.
- [ ] Unklare Artikel erreichen die Schreibmutation nicht.
- [ ] Bestehende Merge-, SQLite- und Outbox-Verträge bleiben unverändert.

**Verifikation:**

- [ ] Fokussierte Mutation-/Outbox-Integrationstests.
- [ ] Offline-Lokalwrite und Retrypfad geprüft.
- [ ] Bestehende Add-Item-Suite bleibt unverändert grün, soweit der aktuelle
      Projekt-Baseline-Fehler nicht betroffen ist.

**Abhängigkeiten:** `fam-pa0g.6`, `fam-pa0g.7`, `fam-pa0g.3`
**Wahrscheinliche Dateien:** Beta-Orchestrator und colocated Integrationstests
**Umfang:** M, 3–5 Dateien

#### Task `fam-pa0g.2`: Run beta end-to-end and device verification

**Beschreibung:** Den isolierten Beta-Flow auf iOS und Android durchprüfen und
alle Schutz- und Fallbackpfade als finalen Nachweis dokumentieren.

**Akzeptanzkriterien:**

- [ ] Vereinbarte Textbatch funktioniert bis zur richtigen Händlerliste.
- [ ] Speech-to-Text, Vorschaukorrektur, Lernabfrage und lokale Automatik
      funktionieren auf iOS und Android.
- [ ] AI-Gates und Review bei Unklarheit sind nachweisbar.
- [ ] Bestehender manueller Add-Item-Flow bleibt unverändert.
- [ ] Keine Einkaufs- oder Speech-Rohdaten landen in Analytics, Logs oder
      Crash-Reports.

**Verifikation:**

- [ ] Fokussierte Harness-/Gerätechecks auf iOS und Android.
- [ ] Relevante Jest-/RNTL-Suites.
- [ ] `bun run check`.
- [ ] `bun run typecheck`.

**Abhängigkeiten:** `fam-pa0g.4`, `fam-pa0g.5`, `fam-pa0g.9`, `fam-pa0g.7`,
`fam-pa0g.3`
**Wahrscheinliche Dateien:** Beta-Harness-/Geräteflows und Nachweisdokumentation
**Umfang:** M, 3–5 Dateien

### Checkpoint: Beta-Abnahme

- [ ] Alle Beads `fam-pa0g.1` bis `.9` sind verifiziert.
- [ ] Alle Spec-Success-Criteria sind nachweisbar.
- [ ] Bestehende Shopping-List-Komponenten wurden nicht verändert.
- [ ] `bun run check`, `bun run typecheck` und fokussierte Tests sind grün oder
      bekannte Baseline-Fehler separat dokumentiert.
- [ ] Maintainer entscheidet über Freigabe der Beta-Implementierung.

## Parallelization Opportunities

- T4, T5 und T8 können parallel vorbereitet werden.
- T3 kann nach T8/T1 parallel zur Preview- und Automationsarbeit umgesetzt
  werden, solange kein konkreter Provider integriert wird.
- T6 und T3 sind unabhängig, teilen aber den strukturierten Ergebnisvertrag.
- T7, T9 und T2 müssen wegen Zustands- und Schreibgrenzen sequenziell folgen.

## Risks and Mitigations

| Risiko | Auswirkung | Mitigation |
|---|---|---|
| Native Speech-to-Text ist auf Plattformen unterschiedlich verfügbar | Hoch | Adapter zuerst klären, echte Geräte früh testen, Textinput als Fallback erhalten |
| Neue Native-Abhängigkeit verändert Dev-Client und Fingerprint | Hoch | Ask-first-Gate, Expo-57-Prüfung und eigener Geräte-Checkpoint |
| Parser ordnet natürliche Sprache falsch zu | Hoch | Reine Parser-Tests, expliziter Reviewstatus, keine sichere Automatik bei Konflikten |
| Lernregeln werden fälschlich haushaltsweit | Hoch | Nutzer-/Account-Scope vor Persistenz entscheiden, keine Haushalts-Synchronisation im MVP |
| KI-Provider/API ist noch nicht entschieden | Mittel | Provider-neutrale Grenze, echte Netzwerkimplementierung erst nach Provider-/Datenschutzfreigabe |
| Bestehende Mutation erwartet ein anderes Produkt-/Store-Modell | Mittel | Vor Integration bestehende Typen/Merge-Tests laden, nur bestehende Schreibgrenze verwenden |
| Aktueller Arbeitsbaum enthält fremde Änderungen und einen Check-Baseline-Fehler | Mittel | Nur Beta-Dateien anfassen, Gates fokussiert ausführen, Baseline separat dokumentieren |

## Open Questions and Decision Gates

1. **Speech API:** Welche konkrete native oder bestehende Expo-57-kompatible
   Lösung wird verwendet? Entscheidung in T5 vor nativer Implementierung.
2. **Local learning scope:** Bleiben Mapping-/Consent-Zustände accountgebunden
   lokal oder sollen sie später geräteübergreifend synchronisieren? Default im
   MVP ist lokal; Entscheidung in T7 dokumentieren.
3. **Product identity:** Welche lokale Produktauflösung reicht für ein
   automatisches `product_id`-Mapping bei mehreren Treffern? Entscheidung in T1.
4. **AI provider and data contract:** Welcher Provider bzw. welche Edge Function
   darf Einkaufsdaten nach Einwilligung verarbeiten? Entscheidung in T3; bis
   dahin nur Adaptervertrag und Mock.
5. **Beta access gate:** Wird der isolierte Einstieg nur über Dev-Link, einen
   internen Feature-Flag oder eine andere Beta-Freischaltung angeboten? Im Plan
   bleibt der Einstieg eigenständig; das konkrete Gate wird in T4 festgelegt.

## Definition of Done for the Plan

- [ ] Marco bestätigt diesen Plan.
- [ ] Die Beads unter `fam-pa0g` bleiben die einzige Task-Quelle.
- [ ] Vor Implementierungsbeginn sind T5- und T3-Entscheidungsgates geklärt,
      soweit sie den Codepfad betreffen.
- [ ] Jede Implementierung folgt anschließend den Skills für inkrementelle
      Umsetzung und testgetriebene Entwicklung.
