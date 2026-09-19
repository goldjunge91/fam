# Draft-Spec: Optimierung der Spracheingabe und Qualitätsübertragung

Status: Freigegeben – Contract und Implementierungsumfang bestätigt

Abgeschlossener Implementierungsplan: [Speech-Optimierung und Qualitätsübertragung](../../../tasks/archive/natuerliches-hinzufuegen-von-einkaufsartikeln_V2_optimierung_plan.md)

## 1. Zweck und Problem

Diese Spec konkretisiert den nächsten Optimierungsschritt für die bereits
freigegebene V2-Beta. Sie behebt zuerst die Messlücke rund um
`unparsed_text: null` und schafft danach einen reproduzierbaren A/B-Vergleich
für die iOS-Spracheingabe.

Der aktuelle Parser kann ein semantisch falsches ASR-Ergebnis als normalen
Artikel übernehmen. Dadurch bedeutet `unparsed_text: null` heute nur, dass der
Text syntaktisch konsumiert wurde, nicht dass der erkannte Artikel korrekt ist.
Die Lösung trennt deshalb drei Aussagen:

1. `unparsed_text` enthält den problematischen, nicht syntaktisch verbrauchten
   Rohspan.
2. Strukturierte `quality_flags` beschreiben bekannte Qualitätsgründe.
3. Ein einziger Allowlist-Sanitizer erzeugt den Payload für Dev-Anzeige,
   Copy-Export und späteren Transport.

Die Spec verändert keine Produkt-UI. Eine ausdrücklich erlaubte Ausnahme ist
eine nur in `__DEV__` erreichbare Testdiagnostik-Sektion im bestehenden
Preview-Modal. Sie führt keinen automatischen Upload ein.

## 2. Scope und Baufolge

### Modul A: `quality-measurement`

- Parser-Rest korrekt als `unparsed_text` erhalten.
- Feste, typisierte `quality_flags` statt freier Fehlertexte einführen.
- Die vorhandenen Zähler und die vier Zielmetriken in einen expliziten,
  versionierten Payload überführen.
- Einen einzigen Sanitizer als Grenze für alle Qualitätsausgaben verwenden.
- Rohdiagnostik mit Transkript oder Artikeltext strikt vom Qualitäts-Payload
  trennen.

### Modul B: `speech-ab-experiment`

- Dieselben Audio-Fixtures paarweise mit zwei Speech-Konfigurationen ausführen:
  `baseline` und `contextual-strings`.
- `de-DE`, On-Device-Erkennung, `continuous` und `iosTaskHint: dictation`
  bleiben in beiden Varianten gleich.
- Nur die Kontextphrase-Liste unterscheidet die Varianten.
- Pro Variante entsteht ein Payload nach Modul A. Es gibt keine automatische
  Aktivierung aufgrund eines einzelnen Runs.

### Modul C: `maestro-quality-capture`

- Nur im Dev-/Testmodus eine Testdiagnostik-Sektion im bestehenden Preview-
  Modal anzeigen.
- Die aktuelle Preview-Auswahl als Testannotation speichern, ohne reale
  Einkaufslisten zu verändern oder produktive Lernregeln zu schreiben.
- Den bereits sanitisierten Payload als eine JSONL-Zeile im lokalen
  Simulator-Cache ablegen, damit der Maestro-Runner ihn nach einem Lauf
  abholen kann.
- Stabile `testID`- und Accessibility-Verträge für Maestro bereitstellen.

### Abhängigkeit

`speech-ab-experiment` hängt von `quality-measurement` ab. Ohne stabile
Zähler- und Nullsemantik wäre ein A/B-Ergebnis nicht belastbar.

`maestro-quality-capture` hängt von `quality-measurement`,
`speech-ab-experiment` und dem bestätigungsnahen Qualitätsworkflow ab.

Nicht Bestandteil dieser Spec sind Produkt-UI-Arbeiten außerhalb des
Testpanels, ein Parser-Neubau, ein neues Speech-Modell, Android-Abnahme,
Cloud-Erkennung, Supabase-Schemaänderungen oder automatischer Transport.

## 3. Parsing- und Qualitätsvertrag

### 3.1 `unparsed_text`

Der Parser liefert weiterhin einen lokalen Parse-Vertrag mit `items` und
`unparsedText`.

- `unparsedText` ist der exakt erhaltene, getrimmte Rohspan, der nach dem
  deterministischen Parsing nicht verbraucht wurde.
- `unparsedText` ist `null`, wenn die Eingabe leer ist oder ausschließlich aus
  erfolgreich verbrauchtem Inhalt besteht.
- Das Vorhandensein eines erkannten Artikels darf `unparsedText` nicht auf
  `null` setzen, wenn daneben ein nicht verbrauchter Rohspan verbleibt.
- Ein syntaktisch konsumiertes, aber semantisch falsches ASR-Wort wird nicht
  nachträglich als `unparsedText` ausgegeben. Dafür ist ein
  `semantic_item_mismatch`-Flag nach bestätigter Korrektur oder Fixture-Label
  zuständig.
- `unparsedText` darf in lokalen Rohdiagnosen und in der Entwickleranalyse
  sichtbar bleiben, aber niemals im sanitisierten Qualitäts-Payload stehen.

Damit ist `unparsed_text: null` kein Qualitätsbeweis mehr. Es bedeutet nur noch
„kein syntaktischer Rest vorhanden“.

### 3.2 Strukturierte `quality_flags`

Die Flags sind eine geschlossene Allowlist. Freie Fehlertexte und dynamische
Flag-Namen sind nicht erlaubt.

| Flag | Entstehung | Bedeutung |
| --- | --- | --- |
| `unparsed_text_present` | Parser | Nach dem Parsing bleibt ein nicht leerer Rohspan übrig. |
| `ambiguous_item_boundary` | Parser/Evaluierung | Eine Eingabe lässt die Artikelgrenze nicht zuverlässig erkennen. |
| `semantic_item_mismatch` | bestätigte Korrektur oder gelabeltes Fixture | Das erkannte Item weicht semantisch vom bestätigten bzw. erwarteten Item ab. |
| `incorrect_automatic_assignment` | bestätigte Listenentscheidung | Eine automatische Listen-Zuordnung war falsch. |
| `manual_correction` | bestätigte Nutzerkorrektur | Der Nutzer musste die automatische Entscheidung korrigieren. |

Regeln:

- Parser-Flags beschreiben Syntax bzw. Segmentierung; sie behaupten keine
  semantische Wahrheit.
- `semantic_item_mismatch` wird nicht allein aus einem unbekannten Wort
  abgeleitet. Es braucht eine bestätigte Korrektur oder ein Referenzlabel.
- Flags sind additiv. Ein semantischer Fehler darf ein vorhandenes
  `unparsed_text_present`-Flag nicht ersetzen.
- Eine lokale Observation darf `readonly qualityFlags: QualityFlag[]`
  enthalten. Der Transfer-Payload enthält ausschließlich die aggregierten
  Zähler der geschlossenen Flag-Allowlist.

## 4. Versionierter Übertragungspayload

Der Payload ist ein explizites Objekt mit Allowlist. Der folgende Vertrag ist
die einzige Form, die Qualitätsanzeige, Copy-Export, Dateiexport und späterer
Transport verwenden dürfen:

```ts
type ExperimentVariant = 'baseline' | 'contextual-strings';

type MetricSnapshot = {
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  sampleCount: number;
};

type SanitizedQualityPayload = {
  schemaVersion: 2;
  snapshotVersion: 1;
  metricDefinitionVersion: 1;
  captureKind: 'quality-snapshot' | 'maestro-preview-test';
  fixtureSetVersion: string | null;
  experimentVariant: ExperimentVariant;
  createdAt: string;

  confirmedItemCount: number;
  automaticAssignmentCount: number;
  correctAutomaticAssignmentCount: number;
  falseListAssignmentCount: number;
  manualCorrectionCount: number;
  durationSamplesMs: readonly number[];

  qualityFlags: {
    unparsedTextPresent: number;
    ambiguousItemBoundary: number;
    semanticItemMismatch: number;
    incorrectAutomaticAssignment: number;
    manualCorrection: number;
  };

  metrics: {
    automaticAccuracyPercent: MetricSnapshot;
    falseListPercent: MetricSnapshot;
    manualCorrectionPercent: MetricSnapshot;
    medianTimeToAddMs: MetricSnapshot;
  };
};
```

### 4.1 Versionen und Zeit

- `schemaVersion` versioniert die Struktur und Allowlist des Payloads.
- `snapshotVersion` versioniert die Snapshot-Repräsentation unabhängig von der
  Struktur des Payloads.
- `metricDefinitionVersion` versioniert Zähler, Nenner und Berechnungsregeln.
- `captureKind` unterscheidet eine normale Qualitätsaufnahme von einer
  explizit über das Maestro-Testpanel gespeicherten Preview-Testannotation.
  Beide Werte sind feste Allowlist-Werte und enthalten keine Identität.
- `fixtureSetVersion` identifiziert bei einem A/B-Lauf das gemeinsame,
  versionierte Audio-Set; bei einem nicht fixturebasierten lokalen Snapshot ist
  der Wert `null`.
- `experimentVariant` ist für den A/B-Scope verpflichtend und darf nur die zwei
  aufgeführten Werte tragen.
- `createdAt` ist ein UTC-ISO-Zeitpunkt. Er enthält keine Benutzer-, Session-,
  Observation- oder Haushalts-ID.

### 4.2 Zähler und Dauer-Samples

- Alle Zähler sind endliche, nicht negative Ganzzahlen.
- `correctAutomaticAssignmentCount` und
  `falseListAssignmentCount` beziehen sich ausschließlich auf automatische
  Zuordnungen.
- Die beiden Teilzähler bilden automatische Zuordnungen vollständig ab:
  `correctAutomaticAssignmentCount + falseListAssignmentCount =
  automaticAssignmentCount`. Bei `0` automatischen Zuordnungen sind beide
  Teilzähler `0`.
- `manualCorrectionCount` bezieht sich auf bestätigte Korrekturen und darf
  nicht stillschweigend aus fehlendem Parsing abgeleitet werden.
- `durationSamplesMs` enthält höchstens 64 endliche, nicht negative Werte.
  Fehlende Werte werden nicht als `0` eingefügt. Keine IDs oder Zeitreihen-
  Metadaten werden mitgegeben.

### 4.3 Metriksemantik und Nullwerte

Die vier Zielmetriken werden nicht mehr als lose Zahlen übertragen, sondern
immer mit Berechnungsnachweis:

| Metrik | Zähler | Nenner | `sampleCount` |
| --- | --- | --- | --- |
| `automaticAccuracyPercent` | korrekt automatische Zuordnungen | automatische Zuordnungen | automatische Zuordnungen |
| `falseListPercent` | falsche automatische Zuordnungen | automatische Zuordnungen | automatische Zuordnungen |
| `manualCorrectionPercent` | manuelle Korrekturen | bestätigte Artikel | bestätigte Artikel |
| `medianTimeToAddMs` | `null` | `null` | gültige Dauer-Samples |

- Bei Nenner `0` ist `value: null`, nicht `0`.
- Ohne gültige Dauer-Samples ist `medianTimeToAddMs.value: null`.
- Für eine Median-Metrik bleiben `numerator` und `denominator` `null`.
- `sampleCount` ist immer eine endliche, nicht negative Ganzzahl.
- Der Payload darf weder `NaN` noch `Infinity` enthalten.
- Die Metrikwerte müssen aus den übertragenen Zählern und Samples reproduzierbar
  sein.

## 5. Einziger Sanitizer

Es gibt genau eine reine Funktion als Übergangsgrenze, zum Beispiel:

```ts
sanitizeQualitySnapshot(input): SanitizedQualityPayload | null
```

Sie darf nur die explizit erlaubten numerischen Werte, Versionsfelder, den
Experiment-Enum, `createdAt`, die begrenzten Dauer-Samples und die festen
Flag-Zähler auslesen. Sie erzeugt keine dynamischen Zusatzfelder.

Alle drei Ausgabepfade verwenden das Ergebnis dieser Funktion unverändert:

1. Dev-Anzeige
2. Copy-/Dateiexport
3. späterer Transport

Die Ausgabepfade dürfen das Objekt nicht jeweils neu abbilden oder mit Feldern
anreichern. Der Test vergleicht zusätzlich die serialisierten Schlüssel des
Dev- und Exportpfads mit dem Sanitizer-Ergebnis.

### 5.1 Maestro-Testcapture

Das bestehende Preview-Modal darf bei aktivierter Testfreigabe eine zusätzliche
Sektion `Testdiagnostik` anzeigen. Die Freigabe ist ausschließlich aktiv, wenn
`__DEV__` wahr ist und `EXPO_PUBLIC_DEV_TOOLS` aktiviert ist. In Release-Builds
bleibt die Sektion unabhängig von der Umgebungsvariable unsichtbar.

Die Sektion enthält mindestens:

- die aktive A/B-Variante als nicht editierbare Anzeige,
- eine Aktion `Testergebnis speichern`,
- einen stabilen Erfolg-/Fehlerstatus für Maestro,
- `testID="natural-language-addition-test-panel"` für den Container,
- `testID="natural-language-addition-test-save"` und das Accessibility-Label
  `Testergebnis speichern` für die Aktion.

Die Aktion:

- nutzt denselben Sanitizer wie Dev-Anzeige, Copy-Export und späterer
  Transport;
- annotiert die aktuell ausgewählten Preview-Artikel als Testbestätigung,
  damit Korrekturen messbar werden;
- schreibt keine Artikel über `saveConfirmedBetaOutput`, ändert keine reale
  Einkaufsliste und erzeugt keine produktive Lernregel;
- schreibt exakt eine serialisierte `SanitizedQualityPayload`-Zeile in
  `Paths.cache/fam-natural-language-addition-quality.jsonl`;
- verwendet `captureKind: 'maestro-preview-test'` und enthält weder Rohtext
  noch Audio noch IDs.

### 5.2 Save-Hook-Vertrag

Die Preview-Komponente erhält keinen eigenen Payload-Aufbau. Sie verwendet den
Feature-Hook `useNaturalLanguageAdditionTestCapture`. Der Hook kapselt
Zustand, Persistenz und Fehlerstatus:

```ts
type TestCaptureStatus = 'idle' | 'saving' | 'saved' | 'error';

type UseNaturalLanguageAdditionTestCaptureInput = {
  preview: TextBetaPreview;
  variant: ExperimentVariant;
  storage: TextBetaStorage;
};

type UseNaturalLanguageAdditionTestCaptureResult = {
  enabled: boolean;
  status: TestCaptureStatus;
  error: string | null;
  saveTestMeasurement: (selections: readonly TextBetaSelection[]) => Promise<void>;
};
```

Verbindlicher Ablauf von `saveTestMeasurement`:

1. Wenn der Testmodus nicht aktiv ist oder bereits ein Speichervorgang läuft,
   wird keine zweite Aktion gestartet.
2. Die übergebenen Preview-Auswahlen werden als Testannotation bewertet. Die
   Funktion verwendet dafür die bestehende Domainlogik, aber nicht den realen
   Shopping-List-Adapter und keine produktive Lernregel.
3. Der Hook erstellt den Snapshot mit `captureKind: 'maestro-preview-test'`
   und ruft ausschließlich den gemeinsamen Sanitizer auf.
4. Der exakt erzeugte Payload wird über den lokalen JSONL-Service angehängt.
5. Erst nach erfolgreichem Dateischreiben wechselt der Status auf `saved`;
   Fehler wechseln auf `error` und werden für Maestro sichtbar.

Der Hook ist die einzige Save-Grenze des Testpanels. Die UI darf nur den Hook
aufrufen und dessen Status darstellen. `Testergebnis gespeichert` ist der
stabile Erfolgstext für den Maestro-Flow.

Der Maestro-Runner speichert vor dem Lauf den bisherigen lokalen Ergebnisstand,
führt nach jeder Audioaufnahme die Testaktion aus und kopiert die JSONL-Datei
am Ende aus dem iOS-Simulator-Container in den versionierten Ergebnisordner.
Das vorhandene `Später`-Verhalten bleibt als anschließendes Aufräumen erhalten.

### Verbotene Struktur

Der sanitiserte Payload darf weder als Schlüssel noch als Wertstruktur
enthalten:

- Artikeltexte, Marken oder andere freie Einkaufsinhalte
- Audio, Audio-Pfade oder Audio-Bytes
- Transkripte, `unparsedText` oder Rohspans
- Observation-, Session-, User- oder Haushalts-IDs
- freie Fehlertexte oder dynamische Flag-Namen
- beliebige verschachtelte Rohereignisse

Die lokale JSONL-Rohdiagnostik bleibt davon getrennt. Sie darf während der
Entwicklung weiterhin zur Ursachenanalyse verwendet werden, ist aber niemals
ein Qualitäts- oder Transport-Payload.

## 6. A/B-Versuchsvertrag

### Varianten

| Variante | Speech-Unterschied |
| --- | --- |
| `baseline` | aktuelle Konfiguration ohne `contextualStrings` |
| `contextual-strings` | gleiche Konfiguration mit einer versionierten Liste kurzer, relevanter Einkaufsbegriffe |

Beide Varianten behalten `de-DE`, `continuous: true`,
`requiresOnDeviceRecognition: true`, `iosTaskHint: 'dictation'` und die übrigen
unveränderten Laufzeitbedingungen bei. Die Kontextliste enthält höchstens 100
kurze Phrasen und wird als Teil der Fixture-/Experimentversion dokumentiert.

### Durchführung

- Das Referenzdataset umfasst weiterhin 20 Audio-Fixtures. Für einen manuellen
  A/B- oder Abnahmelauf werden künftig höchstens 5 bis 10 erfolgreich
  gespeicherte Fixture-Durchläufe vorausgesetzt; ein vollständiger 20er-Lauf
  bleibt optional.
- Der am 19.09.2026 nach 14 von 20 Fixtures beendete Lauf gilt damit als
  ausreichend. Das zugehörige Maestro-Artefakt liegt unter
  `/Users/marco/.maestro/tests/2026-09-19_043811`.
- Jede für den jeweiligen Lauf ausgewählte Audio-Fixture aus demselben
  `fixtureSetVersion` wird mit beiden Varianten verarbeitet.
- Die Ergebnis-Payloads werden pro Variante getrennt erstellt und niemals vor
  dem Vergleich vermischt.
- Beide Varianten werden mit identischen Parser-, Routing- und
  Metrikdefinitionen ausgewertet.
- Der A/B-Test darf keine User-, Session- oder Haushalts-ID in den
  Transfer-Payload übernehmen.
- Eine bessere Einzelmetrik aktiviert `contextual-strings` nicht automatisch.
  Die dauerhafte Aktivierung ist eine separate Maintainer-Entscheidung nach
  dem gepaarten Vergleich.

`qualityFlags` dienen im A/B-Vergleich als diagnostische Zähler. Sie ersetzen
die vier Zielmetriken nicht und werden nicht ohne separate Entscheidung zu
einer fünften Zielmetrik erklärt.

## 7. Struktur und betroffene Grenzen

Die Implementierung bleibt im bestehenden Feature:

```text
src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/
  domain/parser.ts
  domain/quality-metrics.ts
  services/speech-recognition-adapter.ts
  services/speech-diagnostics.ts       # bleibt Rohdiagnostik, nicht Payload
  services/quality-test-results.ts     # nur Dev-/Test-JSONL im Simulator-Cache
  hooks/use-natural-language-addition-test-capture.ts
  types.ts

.maestro/ios/flows/speech/
  speech-dataset-finish.yaml           # Testcapture vor dem Schließen
.maestro/scripts/speech-dataset.ts     # Ergebnisdatei abholen
```

Voraussichtliche neue fokussierte Domain-/Service-Tests liegen neben den
betroffenen Modulen. Keine neue Styling-Runtime, kein neues Datenzugriffsmodell,
keine Datenbankmigration und kein Eingriff in die funktionierende UI.

## 8. Testvertrag

Vor Implementierungsabschluss müssen mindestens folgende Fälle fokussiert
getestet werden:

1. Parser gibt einen exakten nicht leeren Rohspan in `unparsedText` zurück,
   obwohl mindestens ein Item erkannt wurde.
2. Parser gibt `unparsedText: null` nur bei leerem bzw. vollständig verbrauchtem
   Input zurück.
3. Semantische Abweichung erzeugt `semantic_item_mismatch` erst nach
   Korrektur/Referenzlabel und wird nicht als syntaktischer Rest ausgegeben.
4. Alle fünf Flags sind geschlossen typisiert und werden korrekt gezählt.
5. Zähler, Nenner, `sampleCount` und `null`-Semantik der vier Metriken sind für
   leere, Grenz- und normale Fälle reproduzierbar.
6. Der Sanitizer kappt Dauer-Samples auf höchstens 64 und entfernt alle
   verbotenen Strukturen.
7. Dev-Anzeige und Copy-Export verwenden exakt die Schlüssel des Sanitizer-
   Ergebnisses.
8. Baseline und `contextual-strings` verarbeiten dasselbe Fixture-Set und
   erzeugen getrennte, variant-markierte Payloads.
9. Der Preview-Testbereich ist in `__DEV__` mit Flag sichtbar, in Release
   unsichtbar; Maestro kann die Testaktion über die stabilen Selektoren
   auslösen.
10. Die Testaktion schreibt exakt eine sanitiserte JSONL-Zeile, ohne reale
    Shopping-List-Mutation oder produktive Lernregel.
11. Der Save-Hook verhindert Doppelaktionen, meldet `saved` erst nach dem
    Dateischreiben und liefert bei Fehlern einen sichtbaren `error`-Status.

Gezielte Verifikation:

```bash
bun run check
bun run typecheck
bun run test <betroffene-testdatei>
```

Die vollständige Testsuite wird nicht als Standardlauf verwendet. Der
Simulatorlauf mit einer repräsentativen Stichprobe von 5 bis 10 Audio-Fixtures
folgt erst nach dem Contract- und Domain-Test. Der vollständige 20er-Lauf bleibt
ein optionaler Referenzlauf und wird nicht durch diese Spec automatisch
gestartet oder neu gestartet.

## 9. Erfolgskriterien

- `unparsed_text: null` kann nicht mehr als Beleg für semantische Korrektheit
  missverstanden werden.
- Syntaktische Reste, bestätigte semantische Fehler und falsche
  Listen-Zuordnungen sind über feste `quality_flags` unterscheidbar.
- Der Qualitäts-Payload ist versioniert, aggregierbar und ohne verbotene
  Inhalte oder IDs.
- Alle Verbraucher des Payloads verwenden denselben Sanitizer.
- Für beide Speech-Varianten existieren gepaarte, reproduzierbare Snapshots mit
  identischen Nennerdefinitionen.
- Ein Maestro-Speech-Lauf kann jede Preview als Testcapture speichern und die
  JSONL-Ergebnisse aus dem Simulator in die Repo-Dokumentation übernehmen.
- Keine UI-, Android-, Datenbank- oder Produktions-Telemetrieänderung wird ohne
  separate Freigabe vorgenommen. Das explizit freigegebene Dev-/Testpanel ist
  davon ausgenommen und bleibt in Release unsichtbar.

## 10. Freigabe und Implementierungs-Gate

Die Spec wurde von Marco freigegeben. Die folgenden Entscheidungen sind damit
für die Implementierung verbindlich:

1. `schemaVersion: 2`, `snapshotVersion: 1` und
   `metricDefinitionVersion: 1` sind die gewünschten Startversionen.
2. Die fünf vorgeschlagenen `qualityFlags` decken den gewünschten ersten
   Messumfang ab.
3. `durationSamplesMs` mit maximal 64 Werten ist als bounded sample zulässig.
4. `contextual-strings` wird zunächst nur gepaart gemessen und nicht
   automatisch aktiviert.
5. Der bestehende Maestro-Datensatzlauf darf das Preview im Testmodus über
   `Testergebnis speichern` erfassen und erst danach mit `Später` schließen.

Die Implementierung startet erst nach einem dokumentierten Plan-Checkpoint.
`fam-wlg5` wird dafür in kleine, abhängige Beads-Aufgaben zerlegt; der erste
TDD-Slice beginnt mit dem Parser-/Quality-Flag-Vertrag.
