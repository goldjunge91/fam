# Nutzung der neuen Speech-Implementierungen

Diese Anleitung beschreibt den aktuellen lokalen Speech-Beta-Pfad: Spracheingabe,
Preview, Testcapture, Qualitäts-Payload und den Maestro-Lauf mit dem 20er-
Referenzdataset.

Die Implementierung misst lokal und schreibt keine echten Einkaufsartikel,
solange im Preview nicht der produktive Button `Artikel hinzufügen` gedrückt
wird.

Abnahmestand vom 19.09.2026: Der laufende 20er-Test wurde nach 14 von 20
Fixtures beendet. Das ist ausreichend. Für künftige manuelle Abnahmen werden
höchstens 5 bis 10 erfolgreich gespeicherte Fixture-Durchläufe vorausgesetzt.
Die 20 Audiodateien bleiben als Referenzdataset verfügbar, sind aber kein
Zwang für jede Abnahme. Der letzte Maestro-Fehler ist unter
`/Users/marco/.maestro/tests/2026-09-19_043811` archiviert.

## 1. Voraussetzungen

Für den manuellen Flow und den Maestro-Datensatzlauf werden benötigt:

- ein iOS-Development-Client mit `expo-speech-recognition`;
- ein laufender Metro-Server;
- eine angemeldete Session mit mindestens einer Einkaufsliste bzw. einem Markt;
- Mikrofonfreigabe und verfügbare deutsche On-Device-Spracherkennung;
- ein laufender iOS-Simulator für `com.goldjunge91.fam1`;
- `BlackHole 2ch` als macOS-Ausgabe, wenn der Audioplayer `afplay` verwendet wird.

Das Testpanel erscheint nur in einem Development-Build mit aktivierten Dev-Tools:

```bash
EXPO_PUBLIC_DEV_TOOLS=true
```

Für lokale Rohdiagnostik zusätzlich:

```bash
EXPO_PUBLIC_DEBUG_LOGS=true
```

Die Variablen müssen vor dem Start von Metro gesetzt sein. Nach einer Änderung
Metro und den Dev-Client neu starten.

## 2. App manuell benutzen

1. Öffne die Einkaufsliste und wähle `Neu hinzufügen`.
2. Wähle `Spracheingabe`.
3. Sprich mehrere Artikel, zum Beispiel: `drei Äpfel, Brot und Milch`.
4. Warte auf `Ich höre zu` und tippe danach auf `Fertig`.
5. Warte auf die Preview `Passt das so?`.
6. Prüfe den erkannten Text, die Artikel und die vorgeschlagenen Listen.

Der Speech-Pfad akzeptiert nur eine erfolgreiche On-Device-Erkennung. Es gibt
keinen Cloud-Fallback und keine automatische manuelle Texteingabe.

### Die beiden Testpanel-Aktionen

Im Development-Preview erscheinen unter `Testdiagnostik` zwei Aktionen. Für
eine Maestro-Messung müssen beide in dieser Reihenfolge ausgeführt werden:

1. `Testauswahl vorbereiten`
   - wählt für jeden Preview-Artikel den besten vorhandenen Vorschlag;
   - zeigt danach `Testauswahl bereit`;
   - schreibt noch keine Datei und verändert keine Einkaufsliste.
2. `Testergebnis speichern`
   - nimmt die aktuell ausgewählten Preview-Artikel als Testannotation;
   - schreibt genau eine sanitiserte JSONL-Zeile in den Simulator-Cache;
   - zeigt nach erfolgreichem Schreiben `Testergebnis gespeichert`.

Danach schließt `Später` die Preview ohne produktive Mutation. Der Button
`Artikel hinzufügen` ist eine echte Einkaufslisten-Mutation und wird im
Datensatzlauf absichtlich nicht verwendet.

Die Testaktionen sind deshalb nicht dasselbe wie das Hinzufügen von Artikeln:
`Testauswahl vorbereiten` füllt nur die Auswahl im Modal, `Testergebnis speichern`
persistiert die Messung lokal und `Später` beendet den Testfall.

## 3. Wichtige Implementierungen

| Datei | Aufgabe |
| --- | --- |
| [`speech-contextual-strings.ts`](../../../src/features/shopping-list/stt-beta/services/speech-contextual-strings.ts) | Versionierte Liste kurzer Einkaufs- und Markenbegriffe. Aktuelle Version: `20-saetze-neu-v1`. |
| [`speech-recognition-adapter.ts`](../../../src/features/shopping-list/stt-beta/services/speech-recognition-adapter.ts) | Einheitlicher Native-Adapter, On-Device-Gate, Berechtigungen, Transcript, Stop/Cancel und Varianten. |
| [`native-speech-recognition.ts`](../../../src/features/shopping-list/stt-beta/services/native-speech-recognition.ts) | Bindet den Adapter an `ExpoSpeechRecognitionModule`. |
| [`natural-language-addition-voice-overlay.tsx`](../../../src/features/shopping-list/stt-beta/components/natural-language-addition-voice-overlay.tsx) | UI für `Ich höre zu`, `Fertig` und `Abbrechen` sowie Lebenszyklus der Speech-Session. |
| [`speech-diagnostics.ts`](../../../src/features/shopping-list/stt-beta/services/speech-diagnostics.ts) | Lokale Rohdiagnostik mit Transkript, Segmenten und Parsergebnis. Nicht mit dem Qualitäts-Payload verwechseln. |
| [`use-natural-language-addition-test-capture.ts`](../../../src/features/shopping-list/stt-beta/hooks/use-natural-language-addition-test-capture.ts) | Dev-only Save-Grenze für Testannotationen und sichtbaren Save-Status. |
| [`quality-test-results.ts`](../../../src/features/shopping-list/stt-beta/services/quality-test-results.ts) | Hält die neuesten 256 sanitisierten Test-Snapshots in `Paths.cache/fam-natural-language-addition-quality.jsonl`; ältere Einträge werden verworfen. |
| [`quality-snapshot.ts`](../../../src/features/shopping-list/stt-beta/domain/quality-snapshot.ts) | Einziger Sanitizer und versionierter Payload-Vertrag. |
| [`quality-metrics.ts`](../../../src/features/shopping-list/stt-beta/domain/quality-metrics.ts) | Zählt bestätigte Artikel, Zuordnungen, Korrekturen, Flags und Zeit-Samples. |
| [`quality-snapshot-export.ts`](../../../src/features/shopping-list/stt-beta/services/quality-snapshot-export.ts) | Bereitet einen lokalen, bereinigten Copy-Export vor. Es gibt keinen Netzwerk-Upload. |
| [`dev-quality-metrics-screen.tsx`](../../../src/features/settings/dev/dev-quality-metrics-screen.tsx) | Entwickleransicht für lokale Qualitätsmetriken und den bereinigten Payload. |
| [`speech-dataset-finish.yaml`](../../../.maestro/ios/flows/speech/speech-dataset-finish.yaml) | Beendet die Aufnahme, bereitet die Auswahl vor, speichert den Snapshot und schließt mit `Später`. |
| [`speech-dataset.ts`](../../../.maestro/scripts/speech-dataset.ts) | Host-Runner für Audio, Maestro-Flows, Simulator-Cache, Manifest und Resume. |
| [`speech-dataset-plan.ts`](../../../.maestro/scripts/speech-dataset-plan.ts) | CLI-Argumente, Default-Dataset, Reihenfolge und Capture-Validierung. |

## 4. `speech-contextual-strings.ts` verwenden

Die Datei exportiert:

```ts
CONTEXTUAL_STRINGS_VERSION // "20-saetze-neu-v1"
CONTEXTUAL_STRINGS         // kurze, eindeutige Einkaufsbegriffe
```

Der Adapter kennt zwei Varianten:

| Variante | Verhalten |
| --- | --- |
| `baseline` | Standardkonfiguration ohne `contextualStrings`. |
| `contextual-strings` | Gleiche On-Device-Konfiguration plus `CONTEXTUAL_STRINGS`. |

Direkte Verwendung am Adapter:

```ts
const session = nativeSpeechRecognitionAdapter.start({
  locale: 'de-DE',
  variant: 'contextual-strings',
});
```

Beide Varianten behalten `de-DE`, `continuous: true`,
`requiresOnDeviceRecognition: true`, `addsPunctuation: true` und
`iosTaskHint: 'dictation'`. Nur die Kontextliste darf sich unterscheiden.

### Variante im laufenden App-Flow

Der Controller liest `EXPO_PUBLIC_NATURAL_LANGUAGE_ADDITION_SPEECH_VARIANT`.
Ohne Wert oder mit einem unbekannten Wert wird sicher `baseline` verwendet.
Die aufgelöste Variante wird sowohl an `speechAdapter.start({ variant })` als
auch an den sanitisierten Test-Payload weitergereicht. Damit beschreibt die
Payload tatsächlich die Native-Konfiguration, die das Audio verarbeitet hat.

Für einen gepaarten A/B-Lauf muss die Variable vor dem Start von Metro gesetzt
und der Dev-Client mit derselben Konfiguration verwendet werden:

```bash
# Baseline
EXPO_PUBLIC_NATURAL_LANGUAGE_ADDITION_SPEECH_VARIANT=baseline

# Contextual-Strings
EXPO_PUBLIC_NATURAL_LANGUAGE_ADDITION_SPEECH_VARIANT=contextual-strings
```

Der Runner-Parameter `--variant` markiert und validiert den erwarteten Lauf,
ändert aber keine bereits laufende Metro-Konfiguration. Deshalb muss der
Parameter mit der vor Metro gesetzten Variable übereinstimmen; sonst bricht der
Runner beim ersten Capture ab, statt ein falsch etikettiertes Ergebnis zu
übernehmen. Baseline und Contextual-Strings werden mit demselben Audio-Set und
getrennten Ergebnisdateien ausgeführt.

## 5. Maestro-Lauf mit dem 20er-Referenzdataset

Zuerst kann die Reihenfolge ohne Simulator und Audio geprüft werden:

```bash
bun .maestro/scripts/speech-dataset.ts --dry-run
```

Ein kurzer Smoke-Lauf mit einer WAV-Datei:

```bash
MAESTRO_DRIVER_STARTUP_TIMEOUT=180000 bun .maestro/scripts/speech-dataset.ts \
  --limit 1 \
  --device 4B293FA5-24E8-4BF4-8295-3EF2D6C50F7D
```

Für die künftige manuelle Abnahme reicht eine Stichprobe mit maximal zehn
Fixtures:

```bash
MAESTRO_DRIVER_STARTUP_TIMEOUT=180000 bun .maestro/scripts/speech-dataset.ts \
  --limit 10 \
  --device 4B293FA5-24E8-4BF4-8295-3EF2D6C50F7D
```

Der optionale vollständige Referenzlauf verwendet standardmäßig
`datensätze/20-saetze-neu` und die WAV-Dateien:

```bash
MAESTRO_DRIVER_STARTUP_TIMEOUT=180000 bun .maestro/scripts/speech-dataset.ts \
  --device 4B293FA5-24E8-4BF4-8295-3EF2D6C50F7D
```

Wenn der Lauf nach bereits gespeicherten Captures abbricht, wird derselbe
unvollständige Lauf so fortgesetzt:

```bash
MAESTRO_DRIVER_STARTUP_TIMEOUT=180000 bun .maestro/scripts/speech-dataset.ts \
  --resume-latest \
  --device 4B293FA5-24E8-4BF4-8295-3EF2D6C50F7D
```

`--resume-latest` prüft Device, Dataset-Reihenfolge und Capture-Dateien. Bereits
gesicherte Fälle werden übersprungen; der erste nicht gesicherte Fall wird
vollständig wiederholt. Einen Shell-Loop braucht der Runner nicht. Nach einem
Fehler wird der einzelne Resume-Befehl erneut ausgeführt, wenn der Simulator
wieder in einem stabilen Zustand ist.

Wichtig: Beim Fortsetzen müssen Dataset, Audioformat und ein eventuell
verwendetes `--limit` zum abgebrochenen Lauf passen. Für einen anderen Plan
einen neuen Lauf ohne `--resume-latest` starten.

## 6. Ergebnisordner

Jeder Lauf liegt unter:

```text
docs/specs/natuerliches-hinzufuegen-von-einkaufsartikeln_V2/maestro-speech-results/run-<timestamp>/
```

Darin befinden sich:

- `manifest.json`: Status, Device, Fixture-Set-Version, Reihenfolge, Checkpoint und Captures;
- `captures/`: genau eine validierte JSONL-Zeile pro erfolgreich abgeschlossenem Audiofall;
- `speech-captures/`: genau ein sanitisiertes Parsergebnis (`items` und `unparsedText`) pro Audio;
- `fam-natural-language-addition-quality.jsonl`: aggregierte Qualitätszeilen des Laufs;
- `quality-before.jsonl`: Cache-Inhalt vor dem Start.

Beim versionierten 20-Sätze-WAV-Datensatz erkennt der Host-Runner zusätzlich
`20-saetze-gold-labels.jsonl` und erzeugt nach einem erfolgreichen Lauf unter
`speech-gold/` automatisch `comparisons.jsonl`, `summary.json` und ein Resume-
Manifest. Der Goldreport verwendet nur das sanitizierte Parsergebnis; Rohtranskript,
Speech-Segmente, Korrelations- und Session-IDs werden nicht in den Repo-Report
übernommen. Andere Datensätze behalten den bisherigen Qualitätslauf ohne Goldreport.

Der Runner leert den Simulator-Cache erst nach der Sicherung des vorherigen
Stands. Nach einem erfolgreichen `Testergebnis speichern` wird genau eine neue
Zeile erwartet. Ein leerer oder mehrzeiliger Capture wird als Fehler behandelt.
Für den Goldpfad wird parallel genau eine neue Speech-Diagnostic-Zeile erwartet;
fehlt sie oder enthält sie kein gültiges Parsergebnis, schlägt der Audiofall fehl.
Der Test-Cache selbst bleibt auf die neuesten 256 Captures begrenzt. Beim
Resume werden außerdem die Fixture-Set-Versionen der gespeicherten und neuen
Captures verglichen, damit keine unterschiedlichen Versionen in einem Lauf
gemischt werden.

## 7. Qualitätsdaten auswerten

Einen lokalen Kohortenreport aus dem Ergebnisfile erzeugen:

```bash
bun scripts/quality-cohort-report.ts \
  "docs/specs/natuerliches-hinzufuegen-von-einkaufsartikeln_V2/maestro-speech-results/run-<timestamp>/fam-natural-language-addition-quality.jsonl" \
  "docs/specs/natuerliches-hinzufuegen-von-einkaufsartikeln_V2/maestro-speech-results/run-<timestamp>/report"
```

Der Report schreibt JSON, Text und HTML. Die vier Zielmetriken benötigen jeweils
mindestens zehn Samples:

- automatische Genauigkeit: mindestens 95 Prozent;
- falsche Liste: höchstens 1 Prozent;
- manuelle Korrektur: höchstens 10 Prozent;
- mediane Zeit bis zum Hinzufügen: höchstens 6 Sekunden.

Diese Mindeststichprobe von zehn Qualitäts-Samples ist nicht identisch mit der
Anzahl der Audio-Fixtures. Eine einzelne Fixture kann mehrere bestätigte
Preview-Artikel liefern.

Baseline- und Contextual-Strings-Dateien getrennt auswerten. Der aktuelle
Kohortenreport ist ein Aggregator für die übergebenen Snapshots und sollte
nicht mit beiden Varianten in einer Datei gefüttert werden, wenn ein A/B-
Vergleich gewünscht ist.

Die lokale Ansicht ist erreichbar über:

```text
Einstellungen → Entwickler → Qualitätsmetriken
```

Diese Ansicht liest den persistenten lokalen Qualitätszustand. Die
Maestro-Testcaptures liegen dagegen im separaten Simulator-Cache und werden
vom Host-Runner in den versionierten Ergebnisordner übernommen.

## 8. Fehlerbilder

### Preview ist leer

Wenn nach `Fertig` zwar `Passt das so?` erscheint, aber keine Preview-Artikel
vorhanden sind, kann `Testauswahl vorbereiten` keine Auswahl erzeugen. Nicht
`Artikel hinzufügen` drücken. Den Lauf abbrechen bzw. mit `Später` schließen,
den Debug-Artifact-Pfad sichern und danach den letzten Lauf mit
`--resume-latest` fortsetzen.

Mit `EXPO_PUBLIC_DEBUG_LOGS=true` liegt die lokale Rohdiagnostik im Cache unter
`fam-natural-language-addition-speech.jsonl`. Sie enthält Transkript,
Speech-Segmente und Parsergebnis und ist nur für die Ursachenanalyse gedacht.

### `Spracheingabe` oder `Ich höre zu` fehlt

Das ist ein UI-Übergangs- oder Sessionproblem, kein Grund, den produktiven
Listenbutton zu verwenden. Der Runner beendet den aktuellen Fall und versucht
über `speech-dataset-cleanup.yaml`, die Ansicht zu schließen. Danach den
einzelnen Resume-Befehl erneut ausführen.

### Testpanel fehlt

Prüfen:

1. Development-Build statt Release-Build verwenden.
2. `EXPO_PUBLIC_DEV_TOOLS=true` vor Metro-Start setzen.
3. Dev-Client und Metro nach einer Env-Änderung neu starten.

### Keine neue JSONL-Zeile

Prüfen, ob zuerst `Testauswahl vorbereiten` und danach
`Testergebnis speichern` ausgeführt wurden, ob mindestens ein Preview-Artikel
vorhanden ist und ob `Testergebnis gespeichert` sichtbar wurde. Der Save-Hook
schreibt erst nach erfolgreichem Dateischreiben und verhindert doppelte Saves.

## 9. Gezielte Verifikation

Die wichtigsten Tests liegen direkt neben den Implementierungen. Nach Änderungen
an diesem Pfad nur fokussiert testen:

```bash
bun run test src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/services/speech-recognition-adapter.test.ts
bun run test src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/hooks/use-natural-language-addition-test-capture.test.ts
bun run test test/maestro/speech-dataset-plan.test.ts
bun run test test/maestro/speech-dataset-flow.test.ts
```

Für eine reine Dokumentationsänderung sind keine App- oder Simulator-
Mutationen erforderlich.
