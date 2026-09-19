# Implementierungsplan: Speech-Gold-Evaluation für 20 Audio-Fixtures

Status: Abgeschlossen; Beads-Parent `fam-wlg5` geschlossen (Stand 2026-09-19)

Beads-Abschluss: `fam-wlg5.9` bis `fam-wlg5.12` sowie die zugehörigen Review-
Follow-ups sind geschlossen. Die lokale Abnahme wurde mit 14 von 20 Fixtures
aus dem Referenzdataset abgeschlossen; ein vollständiger 20er-Lauf bleibt
optional.

Dieser Plan ergänzt den freigegebenen V2-Optimierungsplan um den unabhängigen
Gold-Label- und Audiovergleich. Er beschreibt den Kern der Evaluation und ist
nicht an Maestro, Agent Device oder einen bestimmten Audio-Player gebunden.
Diese Werkzeuge können später austauschbare Ausführungsadapter liefern.

## Ziel

Die 20 Audiodateien aus `datensätze/20-saetze-neu` werden weiter als reale
Speech-Eingaben verarbeitet. Das tatsächliche Ergebnis aus der lokalen Speech-
Diagnostik wird pro Audio gegen ein unabhängig geprüftes JSONL-Goldlabel
verglichen.

Der Lauf liefert nicht nur eine Artikelanzahl, sondern einen nachvollziehbaren
Diff:

- fehlende Artikel (`missing`)
- unerwartete Artikel (`unexpected`)
- namensgleiche Artikel mit Mengen-, Einheiten- oder Markenfehlern
  (`mismatched`)
- Abweichungen bei `unparsed_text`
- aggregierte, klar definierte Offline-Qualitätsmetriken

Für einen vollständigen Referenzlauf gilt: Jedes geplante Fixture besitzt ein
gespeichertes Vergleichsergebnis. Ein fehlgeschlagenes Fixture wird beim Resume
vollständig wiederholt. Für die abgeschlossene lokale Abnahme wurden 14 von 20
Fixtures als ausreichend akzeptiert.

## Scope und Nicht-Ziele

### Im Scope

- versionierter JSONL-Goldlabel-Vertrag
- unabhängige Validierung der 20 Goldlabels
- reiner, deterministischer Artikelvergleich
- Erfassung und Zuordnung genau eines Speech-Diagnostic-Ergebnisses pro Audio
- resumierbarer, sequenzieller Lauf
- JSONL-Diff, `summary.json` und `manifest.json` im versionierten Ergebnisordner
- fokussierte Domain- und Runner-Tests
- dokumentierte Abweichungen zwischen Audio, Transkript, Parsergebnis und Goldlabel

### Nicht im Scope

- Maestro- oder Agent-Device-spezifische Logik im Kern
- Änderung des Preview-UI oder des produktiven Bestätigungsflows
- echte Shopping-List-Mutationen; alle Goldfixtures verwenden `targetListId: null`
- neue Supabase-/SQLite-Tabellen, Migrationen oder Remote-Transport
- ein neuer Parser oder ein zweiter Speech-Parser
- Fuzzy-Korrektur, automatische Goldlabel-Erzeugung oder stilles Schönrechnen
- A/B-Varianten und `contextualStrings`; das bleibt im bestehenden
  Optimierungs-/A-B-Plan

## Qualitätsbar: KISS, DRY, Performance, Qualität

### KISS

- Eine kanonische Goldquelle: `20-saetze-gold-labels.jsonl`.
- Eine reine Vergleichsfunktion für ein Fixture.
- Ein sequenzieller Laufzustand mit drei Zuständen: offen, erfolgreich, fehlgeschlagen.
- Ein Ergebnisformat für Einzelvergleiche und ein Aggregat.
- Audio- und UI-Steuerung bleiben Adapter und werden nicht in die Domainlogik kopiert.

### DRY

- `ParsedShoppingItem` und `SpeechParseDiagnosticRecord` bleiben die bestehenden
  Ist-Verträge.
- Goldlabel-Validierung, Normalisierung und Vergleich werden nur einmal
  implementiert.
- Manifest-/Resume-Regeln werden nicht separat für einzelne Treiber dupliziert.
- Der Produkt-Sanitizer bleibt unverändert; Gold-Evaluation ist ein lokaler
  Entwicklungsreport und kein zweiter Sanitizer.

### Performance

- Goldlabels werden einmal geladen und validiert.
- Der Vergleich verwendet indexierte Namensgruppen bzw. Multiset-Abgleich und
  keine wiederholten Parser- oder UI-Aufrufe.
- Pro Fixture wird genau eine neue Diagnostic-Zeile verarbeitet; kein Busy-Waiting
  und kein vollständiges Rescannen alter Läufe.
- Ergebnisse werden atomar und inkrementell geschrieben, damit Resume keinen
  kompletten Lauf wiederholt.
- Speicher bleibt auf die aktuelle Fixture und das begrenzte Report-Aggregat
  beschränkt.

### Qualität

- Goldlabels werden nicht vom App-Parser erzeugt.
- Der Primärvergleich ist exakt nach normalisiertem Namen, Menge, Einheit und
  Marke; keine Fuzzy-Matches, die Fehler verdecken.
- Ungültige, doppelte oder unvollständige Labels brechen vor dem Audiolauf ab.
- Ein erfolgreicher Lauf ohne Diff-Datei oder mit fehlender Fixture ist unmöglich.
- Jede Metrik dokumentiert Zähler, Nenner und Semantik.

## Datenverträge

### Goldlabel: `datensätze/20-saetze-neu/20-saetze-gold-labels.jsonl`

JSONL ist die normative Sollquelle. Die TXT bleibt die lesbare Referenz und
Auditquelle; sie wird nicht zur Laufzeit erneut durch den Produktparser in
Sollwerte umgewandelt.

```ts
type SpeechGoldLabel = {
  schemaVersion: 1;
  fixtureSetVersion: string;
  audio: string;
  referenceFile: string;
  referenceLine: number;
  targetListId: null;
  mentionedMarket: string | null;
  expectedUnparsedText: string | null;
  items: readonly {
    name: string;
    quantity: number;
    unit: string | null;
    brand?: string | null;
  }[];
};
```

Der Loader normalisiert ein fehlendes optionales `brand` intern zu `null`, ohne
die Quelldatei still zu verändern. Audio-Dateien und Referenzzeilen müssen
innerhalb eines Fixture-Sets eindeutig sein. `mentionedMarket` ist Kontext und
keine Zielzuweisung.

### Ist-Ergebnis

Die bestehende lokale Speech-Diagnostic liefert `parsed_items` und
`unparsed_text`. Ein äußerer Lauf ordnet die neue Diagnostic-Zeile dem gerade
abgespielten Audio über den Run-Kontext zu. Rohtranskript und Speech-Segmente
bleiben Diagnostik; der Gold-Report braucht sie nicht.

### Einzelvergleich

```ts
type SpeechGoldComparison = {
  schemaVersion: 1;
  comparisonKind: 'speech-gold-label';
  audio: string;
  referenceLine: number;
  expectedItemCount: number;
  actualItemCount: number;
  matchedItemCount: number;
  missing: readonly SpeechGoldLabelItem[];
  unexpected: readonly ParsedShoppingItem[];
  mismatched: readonly {
    expected: SpeechGoldLabelItem;
    actual: ParsedShoppingItem;
    fields: readonly ('quantity' | 'unit' | 'brand')[];
  }[];
  expectedUnparsedText: string | null;
  actualUnparsedText: string | null;
  unparsedTextMatch: boolean;
  exactMatch: boolean;
};
```

Die Namensnormalisierung beschränkt sich auf Unicode-Normalisierung, Trim und
zusammengefasste Leerzeichen. Ein anderer Artikelname bleibt als
`missing`/`unexpected` sichtbar. Mengen- und Einheitenfehler werden nicht als
Namensfehler versteckt.

## Ergebnisformat und Metriken

Pro Lauf:

```text
docs/specs/natuerliches-hinzufuegen-von-einkaufsartikeln_V2/
└── speech-gold-results/
    └── run-<timestamp>/
        ├── manifest.json
        ├── comparisons.jsonl
        └── summary.json
```

`comparisons.jsonl` enthält genau eine Einzelvergleichszeile pro Audio.
`summary.json` enthält mindestens:

- `fixtureCount`, `completedFixtureCount`, `exactMatchFixtureCount`
- `expectedItemCount`, `actualItemCount`, `matchedItemCount`
- `missingItemCount`, `unexpectedItemCount`
- `quantityMismatchCount`, `unitMismatchCount`, `brandMismatchCount`
- `unparsedTextMismatchCount`
- die daraus berechneten Raten mit explizitem Nenner

Diese Offline-Metriken bewerten Parser-/Speech-Erkennung gegen Fixtures. Sie
sind nicht automatisch die vier produktiven Qualitätsmetriken und werden nicht
in den sanitisierten Transport-Payload aufgenommen.

## Abhängigkeitsgraph

```text
JSONL-Vertrag und Validator
          │
          ├── reiner Gold-Diff
          │       │
          │       └── Aggregation und summary.json
          │
          └── Fixture-Manifest
                  │
                  └── Beobachtungszuordnung, Resume und Repo-Report
```

Die Audio-/UI-Ausführung hängt nur am äußeren Adaptervertrag. Der Comparator
ist ohne Simulator, Metro, Maestro, Agent Device oder React testbar.

## Task-Liste

Die Aufgaben werden ausschließlich in Beads unter `fam-wlg5` verfolgt. Es wird
kein neues `tasks/todo.md` angelegt.

### Phase 1: Quelle und Vertrag

#### `fam-wlg5.12` - 20 Goldlabels fachlich finalisieren

Die fachliche Goldlabel-Aufgabe und die technische Auswertung liegen gemeinsam
unter `fam-wlg5`. Dadurch gibt es für diesen Evaluationspfad nur einen
verantwortlichen Plan und keine Aufteilung über einen UI-Bug-Kontext.

**Akzeptanzkriterien:**

- [x] 20 eindeutige Audio-IDs und Referenzzeilen.
- [x] Artikel, Mengen, Einheiten und Kontext sind manuell gegen die TXT geprüft.
- [x] Alle `targetListId`-Werte sind `null`.
- [x] Audio-/Referenzabweichungen werden dokumentiert.

**Verifikation:** JSONL-Validator und vollständige Abdeckung der 20 Zeilen.

#### `fam-wlg5.9` - JSONL-Vertrag und Validator

**Abhängigkeit:** `fam-wlg5.12`.

**Akzeptanzkriterien:**

- [x] Fehlendes, doppeltes oder ungültiges Label bricht verständlich ab.
- [x] Schema-Version, Fixture-Version, Referenzzeile, Items und Nullziel werden geprüft.
- [x] Der Loader erzeugt keine Sollwerte über den Produktparser.

**Verifikation:** fokussierte Validator-Tests mit gültigen und absichtlich
defekten JSONL-Zeilen.

### Checkpoint A: Goldquelle

- [x] JSONL ist unabhängig vom Parser und vollständig.
- [x] TXT und JSONL sind über `referenceFile`/`referenceLine` rückverfolgbar.
- [x] Keine Audioausführung startet bei ungültiger Goldquelle.

### Phase 2: Vergleich und Messung

#### `fam-wlg5.10` - Gold-Diff und Offline-Qualitätsmetriken

**Abhängigkeit:** `fam-wlg5.9`.

**Akzeptanzkriterien:**

- [x] Exakt gleiche Artikel ergeben `exactMatch: true`.
- [x] Fehlende und unerwartete Artikel bleiben getrennt sichtbar.
- [x] Mengen-, Einheiten- und Markenfehler werden pro Artikel ausgewiesen.
- [x] `unparsed_text` wird separat verglichen.
- [x] Aggregierte Raten haben dokumentierte Nenner und keine stillen Nullwerte.

**Verifikation:** reine Domain-Tests für exakten Treffer, ASR-Namensfehler,
Mengen-/Einheitenfehler, Duplikate und Resttext.

#### `fam-wlg5.11` - Gold-Lauf, Resume und Repo-Report

**Abhängigkeiten:** `fam-wlg5.9`, `fam-wlg5.10`.

**Akzeptanzkriterien:**

- [x] Pro Audio entsteht genau eine Vergleichszeile.
- [x] Manifest speichert den letzten erfolgreich verglichenen Audio-Identifier.
- [x] Resume überspringt nur vollständige Vergleichsergebnisse.
- [x] Ein fehlgeschlagenes Audio wird vollständig wiederholt.
- [x] `comparisons.jsonl` und `summary.json` werden atomar und versioniert geschrieben.

**Verifikation:** Runner-Tests mit simulierten Diagnostic-Zeilen, Fehler in der
Mitte des Laufs und anschließendem Resume.

### Checkpoint B: lokaler Abnahmelauf

- [x] Die abgeschlossene lokale Abnahme verarbeitet 14 von 20 Audios und ordnet
  jedes verwendete Audio einer Diagnostic zu; die übrigen sechs bleiben
  Referenzfixtures.
- [x] Die Einzelvergleiche der Abnahme und das Aggregat liegen im Ergebnisartefakt;
  ein vollständiger 20er-Ergebnisordner bleibt optional.
- [x] Kein Fixture der abgenommenen Durchläufe wurde wegen eines angeblichen
  Erfolgs übersprungen.
- [x] Eine Wiederaufnahme wiederholt nur das fehlgeschlagene Fixture.

### Phase 3: Qualitätsreview

- [x] Jede Abweichung ist einer Kategorie zugeordnet: Name, Menge, Einheit,
  Marke, Resttext oder fehlendes Diagnostic.
- [x] Keine semantische Abweichung wird durch Fuzzy-Matching verborgen.
- [x] Die Ergebnisse sind von den produktiven Qualitätsmetriken getrennt.
- [x] Erst nach diesem Review werden Parserverbesserungen als eigener Task
  priorisiert.

## Wahrscheinliche Dateien

- `datensätze/20-saetze-neu/20-saetze-gold-labels.jsonl`
- `src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/speech-gold-comparison.ts`
- `src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/speech-gold-comparison.test.ts`
- `scripts/speech-gold-runner.ts`
- `scripts/speech-gold-runner.test.ts`
- `docs/specs/natuerliches-hinzufuegen-von-einkaufsartikeln_V2/speech-gold-results/`

Treiberdateien für Maestro, Agent Device oder andere UI-Werkzeuge werden nur
angepasst, wenn ein späterer Adapter konkret benötigt wird. Sie gehören nicht
zum Kern dieses Plans.

## Risiken und Gegenmaßnahmen

| Risiko | Auswirkung | Gegenmaßnahme |
| --- | --- | --- |
| Goldlabel wird aus dem Parser erzeugt | Test bestätigt nur die Implementierung | Goldlabel bleibt manuell geprüftes JSONL; Parser erzeugt nur Ist-Daten |
| Diagnostic-Zeilen werden falsch einem Audio zugeordnet | Metriken sind unbrauchbar | Run-Manifest, Vorher-/Nachher-Zeilenstand und genau eine neue Zeile pro Fixture |
| ASR-Fehler werden durch Fuzzy-Matching verborgen | Qualität wird überschätzt | Exakter Primärvergleich; optionale Ähnlichkeit nur als separate Analyse |
| Lauf bricht mitten in 20 Audios ab | Wiederholungen und unklare Ergebnisse | atomare Einzelreports und Resume ab letzter erfolgreicher Fixture |
| Produktmetriken und Goldreport vermischen sich | falsche KPI-Aussage | getrennte Dateiformate, Module und Dokumentation |
| Große Diagnostikdatei wird wiederholt komplett gelesen | unnötige Laufzeit | Cursor/Zeilenoffset pro Run und inkrementelle Verarbeitung |

## Definition of Done

- [x] JSONL-Goldquelle ist versioniert, validiert und vollständig.
- [x] Reiner Comparator und fokussierte Tests sind grün.
- [x] Der Runner kann die reale Audioausführung über einen beliebigen Adapter
  anschließen, ohne Comparator- oder Goldlabel-Code zu duplizieren.
- [x] Der akzeptierte 14-von-20-Fixture-Lauf erzeugt die zugehörigen Diffs und
  ein Aggregat; ein vollständiger 20-Fixture-Lauf bleibt optional.
- [x] Resume und Fehlerwiederholung sind getestet.
- [x] Alle Abweichungen sind nachvollziehbar dokumentiert.
- [x] `bun run check` und `bun run typecheck` sind grün; relevante Tests laufen
  gezielt über `bun run test <datei>`.
- [x] Kein Produktcode, keine Shopping-List-Mutation und kein Remote-Transport
  werden durch die Evaluation verändert.
