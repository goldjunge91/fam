# Implementierungsplan: Speech-Optimierung und Qualitätsübertragung

Status: Freigegeben – Marco bestätigt am 2026-09-18

## Überblick

Dieser Plan setzt die freigegebene
[Optimierungs-Spec](../docs/specs/natuerliches-hinzufuegen-von-einkaufsartikeln_V2/natuerliches-hinzufuegen-von-einkaufsartikeln_V2_optimierung_spec.md)
um. Der erste vertikale Pfad macht Parserreste und Qualitätsgründe messbar,
führt die aggregierten Zähler in einen versionierten Allowlist-Payload und
vergleicht danach `baseline` gegen `contextual-strings` mit denselben iOS-
Audio-Fixtures. Ein ausschließlich in `__DEV__` aktivierbares Preview-
Testpanel speichert die Snapshots über einen Save-Hook, damit Maestro die
Ergebnisse nach jedem Lauf abholen kann.

Produktcode wird in kleinen TDD-Slices geändert. UI, Android, Cloud-
Erkennung, Datenbankmigrationen und automatischer Transport bleiben außerhalb
des Plans.

## Arbeitssteuerung

Die Aufgaben werden ausschließlich in Beads unter `fam-wlg5` verfolgt. Es wird
kein neues `tasks/todo.md` angelegt. Der vorhandene, unabhängige
`tasks/plan.md` für Maestro-E2E bleibt unverändert.

Parent: `fam-wlg5`  
Spec: `docs/specs/natuerliches-hinzufuegen-von-einkaufsartikeln_V2/natuerliches-hinzufuegen-von-einkaufsartikeln_V2_optimierung_spec.md`

## Architekturentscheidungen

- `unparsedText` beschreibt ausschließlich syntaktisch nicht verbrauchten
  Rohtext. Ein semantisch falsches, aber syntaktisch konsumiertes ASR-Wort
  wird über ein bestätigungs- oder fixturebasiertes Flag erfasst.
- Parser-, Routing- und Korrekturflags sind eine geschlossene Enum-Allowlist.
  Der Transfer enthält nur deren aggregierte Zähler.
- Die lokale Aggregation bleibt die Quelle für Zähler und Dauer-Samples. Der
  Sanitizer ist die einzige Grenze zu Anzeige, Export und späterem Transport.
- `schemaVersion`, `snapshotVersion` und `metricDefinitionVersion` bleiben
  getrennt, damit Struktur-, Snapshot- und Berechnungsänderungen nicht
  vermischt werden.
- Der A/B-Vergleich ist gepaart: dasselbe versionierte Fixture-Set läuft mit
  beiden Varianten. `contextual-strings` wird nicht automatisch aktiviert.
- Das Preview-Testpanel ist kein Produktworkflow. Es wird nur mit
  `__DEV__` plus Dev-/Testflag gerendert und speichert ausschließlich über
  `useNaturalLanguageAdditionTestCapture`.
- IDs und Rohinhalte dürfen lokal für Idempotenz bzw. Debugging existieren,
  aber nicht in den sanitisierten Payload gelangen.

## Abhängigkeitsgraph

```text
fam-wlg5.1 Parser-Restvertrag und Flags
        │
        └── fam-wlg5.2 Lokale Flag-Zähler und MetricSnapshots
                ├── fam-wlg5.3 Allowlist-Sanitizer
                │       └── fam-wlg5.5 Speech-Varianten für A/B
                └── fam-wlg5.4 Flags im Confirm-Workflow
                        └──────────────┐
                                        └── fam-wlg5.7 Maestro-Testpanel und Save-Hook
                                                └── fam-wlg5.8 Maestro-Runner
                                                        └── fam-wlg5.6 iOS-Fixture-Lauf
```

`fam-wlg5.3` und `fam-wlg5.4` können nach `fam-wlg5.2` parallel bearbeitet
werden. `fam-wlg5.5` und `fam-wlg5.7` folgen danach; `fam-wlg5.8` verbindet
den Hook mit Maestro, bevor der finale Simulatorlauf startet.

## Aufgabenliste

### Phase 1: Foundation

#### `fam-wlg5.1` Parser-Restvertrag und Quality-Flag-Typen

- **Abhängigkeiten:** keine
- **Scope:** S bis M, voraussichtlich `types.ts`, `domain/parser.ts`,
  `domain/parser.test.ts`
- **Ergebnis:** Exakter `unparsedText`-Rest und geschlossene parserseitige
  Flags mit fokussierten Regressionstests.
- **Verifikation:** `bun run test <parser-testdatei>` und Typecheck des
  Features.

#### `fam-wlg5.2` Quality-Flag-Zähler in lokale Observationen aufnehmen

- **Abhängigkeiten:** `fam-wlg5.1`
- **Scope:** M, voraussichtlich `types.ts`, `domain/quality-metrics.ts`,
  `domain/quality-metrics.test.ts`, bei Bedarf `beta-storage.ts`
- **Ergebnis:** Idempotente Flag-Zähler und vier MetricSnapshots mit korrekter
  Nenner-, Sample- und Nullsemantik.
- **Verifikation:** fokussierte Quality-Metrics- und Storage-Tests.

### Checkpoint A: Domainvertrag

- [ ] Parser-Regressionen sind grün.
- [ ] `unparsedText: null` wird nicht mehr bei vorhandenem Rohrest erzeugt.
- [ ] Quality-Flags und lokale Zähler sind typisiert und idempotent.
- [ ] Bestehende Beta-Storage-Kompatibilität bleibt erhalten.

### Phase 2: Messpfad

#### `fam-wlg5.3` Allowlist-Sanitizer für Qualitäts-Payload

- **Abhängigkeiten:** `fam-wlg5.2`
- **Scope:** M, voraussichtlich neue Domain-Datei für Payload/Sanitizer plus
  `domain/quality-metrics.ts` und fokussierte Tests
- **Ergebnis:** Versionierter Payload mit vollständigen Zählern, bounded
  Dauer-Samples, festen Flag-Zählern und vier MetricSnapshots.
- **Verifikation:** Allowlist-/Forbidden-Structure-Tests, `NaN`-/`Infinity`-
  Tests und gezielter Typecheck.

#### `fam-wlg5.4` Quality-Flags im Confirm-Workflow verankern

- **Abhängigkeiten:** `fam-wlg5.1`, `fam-wlg5.2`
- **Scope:** M, voraussichtlich `types.ts`, `workflow/text-workflow.ts` und
  `workflow/text-workflow.test.ts`
- **Ergebnis:** bestätigte semantische Abweichungen, falsche automatische
  Listen-Zuordnungen und manuelle Korrekturen werden in den lokalen
  Observations nachvollziehbar gezählt.
- **Verifikation:** fokussierte Workflow-Tests; kein veränderter
  Shopping-List-Adapter.

### Checkpoint B: Sanitized Measurement

- [ ] Der Payload enthält nur die freigegebene Allowlist.
- [ ] Artikeltexte, Marken, Audio, Transkripte, Rohspans und IDs fehlen
  strukturell.
- [ ] Dev-Anzeige und Export verwenden denselben Sanitizer-Schnitt.
- [ ] Confirm-Workflow erzeugt Flags aus bestätigten Entscheidungen, nicht aus
  spekulativer Semantik.

### Phase 3: A/B-Ausführung

#### `fam-wlg5.5` Speech-Varianten für gepaarten A/B-Lauf

- **Abhängigkeiten:** `fam-wlg5.3`
- **Scope:** M, voraussichtlich Speech-Adapter, Konfigurations-/Fixture-
  Vertrag und Speech-Adapter-Tests
- **Ergebnis:** `baseline` ohne `contextualStrings` sowie
  `contextual-strings` mit maximal 100 versionierten Phrasen bei identischen
  übrigen Speech-Optionen.
- **Verifikation:** Adaptertests prüfen die exakten Native-Optionen und die
  Trennung der Varianten. Die installierte `expo-speech-recognition`-API wird
  vor der Änderung gegen die lokale Typdefinition geprüft.

#### `fam-wlg5.7` Maestro-Testpanel für Qualitäts-Snapshots

- **Abhängigkeiten:** `fam-wlg5.3`, `fam-wlg5.4`, `fam-wlg5.5`
- **Scope:** M, voraussichtlich `env.ts`, Preview-Content/-Controller, neuer
  Hook unter `hooks/`, neuer JSONL-Service und fokussierte RNTL-/Service-Tests
- **Ergebnis:** Das Preview zeigt im freigeschalteten Dev-/Testmodus die
  Sektion `Testdiagnostik`. `Testergebnis speichern` ruft den Hook auf,
  schreibt exakt einen sanitisierten Payload in den Simulator-Cache und
  verändert keine reale Einkaufsliste.
- **Verifikation:** Hook-Tests für `idle/saving/saved/error` und
  Doppelaktionen sowie RNTL-Tests für Sichtbarkeit und Selektoren.

#### `fam-wlg5.8` Maestro-Runner für gespeicherte Speech-Snapshots

- **Abhängigkeiten:** `fam-wlg5.7`, `fam-wlg5.5`
- **Scope:** M, `speech-dataset-finish.yaml`, Speech-Dataset-Runner,
  Developer-Guide und Ergebnisdokumentation
- **Ergebnis:** Maestro löst nach jeder Preview `Testergebnis speichern` aus,
  wartet auf `Testergebnis gespeichert` und schließt anschließend mit
  `Später`. Der Host-Runner übernimmt die JSONL-Datei aus dem Simulator-Cache.
- **Verifikation:** gezielter Maestro-Flow auf dem bestehenden iOS-Simulator
  und Prüfung der pro Fixture gespeicherten Payload-Zeile; keine echte
  Shopping-List-Mutation.

#### `fam-wlg5.6` 20-Sätze-iOS-A/B-Lauf mit Repo-Logs

- **Abhängigkeiten:** `fam-wlg5.3`, `fam-wlg5.4`, `fam-wlg5.5`, `fam-wlg5.8`
- **Scope:** M, Laufprotokoll und Ergebnisdateien unter
  `docs/specs/natuerliches-hinzufuegen-von-einkaufsartikeln_V2/`; kein UI-
  Umbau
- **Ergebnis:** alle bereitgestellten 20 Audio-Fixtures laufen gepaart auf
  dem bestehenden iOS-Simulator; beide Varianten liefern getrennte
  sanitiserte Snapshots und nachvollziehbare Repo-Logs. Nach jeder Fixture
  wird das Preview über `Testergebnis speichern` erfasst und anschließend mit
  `Später` geschlossen.
- **Verifikation:** manueller Simulator-/Audio-Lauf, kein Session- oder
  Simulator-Neustart als Bestandteil; Ergebnisprüfung auf Fixture-Version,
  Variante, Zähler, Flags, Metriken und Nullwerte.

### Checkpoint C: A/B-Ergebnis

- [ ] Jede Fixture ist in beiden Varianten verarbeitet oder mit einem
  dokumentierten Fehlerstatus versehen.
- [ ] Die Nennerdefinitionen sind zwischen den Varianten identisch.
- [ ] Rohdiagnostik und sanitiserte Payloads sind getrennt gespeichert.
- [ ] Der Save-Hook schreibt pro Testaktion genau eine JSONL-Zeile und der
  Maestro-Runner übernimmt die Datei aus dem Simulator-Cache.
- [ ] Es gibt keine automatische Aktivierung von `contextual-strings`.
- [ ] Marco erhält den Vergleich als Grundlage für die nächste Entscheidung.

## Verifikationsbefehle

Pro Slice werden nur die betroffenen Tests ausgeführt:

```bash
bun run test src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/parser.test.ts
bun run test src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/quality-metrics.test.ts
bun run test src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/workflow/text-workflow.test.ts
bun run test src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/services/speech-recognition-adapter.test.ts
bun run test src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/hooks/use-natural-language-addition-test-capture.test.ts
bun run test src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/components/natural-language-addition-swift-ui-preview-content.test.tsx
bun run check
bun run typecheck
```

Die vollständige Testsuite und ein neuer Simulator-/Metro-Start sind kein
Standardbestandteil der Zwischen-Checkpoints.

## Risiken und Gegenmaßnahmen

| Risiko | Auswirkung | Gegenmaßnahme |
| --- | --- | --- |
| Parser liefert bisher zusammengefügte Restsegmente statt exakter Rohspans. | Bestehende Parsererwartungen könnten sich ändern. | Vorher fokussierte Regressionen festschreiben; nur Restspan-Semantik ändern. |
| Persistierter Beta-Storage ist Version 1. | Neue Flag-Zähler könnten alte Snapshots verwerfen. | Bestehende Normalisierung/Validierung erweitern und Legacy-Snapshots ohne Rohinhalt akzeptieren. |
| Semantische ASR-Fehler sind ohne Referenz nicht beweisbar. | Flags könnten zu aggressiv oder spekulativ werden. | `semantic_item_mismatch` nur durch Korrektur oder Fixture-Label setzen. |
| Native Runtime ignoriert oder verändert contextualStrings. | A/B-Vergleich wäre nicht aussagekräftig. | Native Optionen im Adaptertest prüfen und im Simulatorlauf Variante/Optionen protokollieren. |
| Audio-Fixture-Ordner ist nicht als Repo-Datei versioniert. | Lauf nicht reproduzierbar. | Fixture-Version und verwendeten Pfad im Ergebnis dokumentieren; keine fehlenden Audios erfinden. |
| Payload wird an einer zweiten Stelle nachgebaut. | Dev-Anzeige und Export könnten auseinanderlaufen. | Strukturtest gegen den einzigen Sanitizer und keine zweite Mapping-Funktion zulassen. |
| Testpanel ist in einem Release-Build sichtbar. | Produktionsoberfläche und Datenpfad werden verunreinigt. | Doppelter Guard aus `__DEV__` und Dev-/Testflag; Release-RNTL-/Build-Kontrakt prüfen. |
| Maestro klickt mehrfach oder der Dateischreibvorgang ist langsam. | Doppelte Snapshots oder falsche Laufreihenfolge. | Hook-Status `saving`, idempotente Sperre und Erfolgstext erst nach erfolgreichem Append. |

## Offene Implementierungsprüfungen

- Vor `fam-wlg5.5` muss die lokale `expo-speech-recognition`-Typdefinition
  weiterhin `contextualStrings` für die installierte Version anbieten.
- Vor `fam-wlg5.6` muss der tatsächlich verfügbare Fixture-Pfad
  `datensätze/20-saetze-neu` lesbar sein; die Audio-Dateien werden nicht in
  den Payload aufgenommen.
- Für `fam-wlg5.7` muss der Dev-/Testflag-Wert im verwendeten iOS-Dev-Client
  gesetzt sein; die Release-Konfiguration darf ihn trotz gesetzter Variable
  nicht anzeigen.
- Die Wahl eines dauerhaften Speech-Defaults bleibt nach dem A/B-Vergleich
  eine separate Maintainer-Entscheidung.

## Abschlusskriterium

Der Plan ist erst abgeschlossen, wenn `fam-wlg5.1` bis `fam-wlg5.8` geschlossen,
die fokussierten Qualitätsgates grün und die beiden A/B-Ergebnis-Payloads sowie
die zugehörigen Repo-Logs geprüft sind. Bis dahin bleibt `contextual-strings`
ein Testvariantenschalter.
