# Research: Externe OCR- und Handschrift-Referenz

**Stand:** 22. September 2026  
**Quelle:** lokaler Referenz-Clone unter `/Volumes/Programme/ocr-reference`  
**Geprüfter Stand:** Branch `new-main-fr`, Commit `1b2c7dcfcb7341c47b3fc4b3a0541bddd4a19c75`

## Kurzfazit

Die externe Referenz hat eine echte mobile, lokale OCR-Pipeline für gedruckte und
handschriftliche Einkaufslisten. Der Kern ist kein Cloud-Dienst und keine
Flutter-UI-Abstraktion, sondern eine portierbare Kombination aus:

1. PP-OCRv6-Textdetektor und CTC-Recognizer als ONNX-Modelle;
2. gemeinsamer Dart-Vor- und Nachverarbeitung für iOS und Android;
3. CTC-Greedy- plus Prefix-Beam-Decoding;
4. Zeilen-/Fragment-Rekonstruktion, Mengen-/Preis-Extraktion und lokaler
   Lebensmittelauflösung;
5. verpflichtendem Review sowie optionalem, lokalem Sammeln korrigierter
   Handschriftzeilen.

Für Haushaltsapp ist die Repo deshalb als technische Referenz und als mögliche
Quelle für Modell-/Evaluationsideen interessant. Sie ist kein Drop-in für Expo
und React Native. Die Flutter-/Dart-Schicht, Drift-Datenbank und der Go-Backend-
Teil müssten neu angebunden werden.

## Was tatsächlich implementiert ist

Der native Pfad lädt zwei ONNX-Assets, führt Detektion und Recognition lokal
über ONNX Runtime aus und gibt pro erkannter Zeile Text, Bounding-Box,
Konfidenz, Alternativen und den erkannten Durchstreichungsstatus zurück. Der
Code verwendet für beide Plattformen dieselbe Dart-Verarbeitung und ruft
keinen Plattform-OCR-Dienst oder Netzwerkdienst auf.

- Runtime und Modellpfad: [`ppocr_inference_native.dart`](/Volumes/Programme/ocr-reference/frontend/lib/services/scan/ppocr_inference_native.dart#L12)
- Initialisierung, Asset-Laden und Tensor-Ausführung: [`ppocr_inference_native.dart`](/Volumes/Programme/ocr-reference/frontend/lib/services/scan/ppocr_inference_native.dart#L119)
- Detektor-Preprocessing und DB-ähnliche Regionsbildung: [`ppocr_processor.dart`](/Volumes/Programme/ocr-reference/frontend/lib/services/scan/ppocr_processor.dart#L63)
- 48-Pixel-Erkennungs-Tensor, CTC-Decoding und Beam-Alternativen: [`ppocr_processor.dart`](/Volumes/Programme/ocr-reference/frontend/lib/services/scan/ppocr_processor.dart#L238)
- Zeilenfragment-Merging und Durchstreichungserkennung: [`ppocr_processor.dart`](/Volumes/Programme/ocr-reference/frontend/lib/services/scan/ppocr_processor.dart#L393)
- Vollständiger Einkaufslistenfluss bis Review und lokale Auflösung: [`scan_pipeline_service.dart`](/Volumes/Programme/ocr-reference/frontend/lib/services/scan/scan_pipeline_service.dart#L18)

Die Recognition ist damit nicht nur ein einzelner Textstring. Das ist für uns
wichtig, weil Bounding-Boxes und Alternativen später auch für Review, Parsing
und Produktauflösung verwendet werden können.

## Handschrift: Stärke und Einschränkung

Handschrift wird unterstützt, aber die Repo enthält nach der aktuellen Prüfung
keinen klar getrennten, bewiesenermaßen handschrift-spezifischen Produktions-
Recognizer.

Es gibt einen Dokumentationskonflikt:

- Die Modell-README nennt den Medium-Recognizer „fine-tuned on handwritten
  shopping lists“.
- [`PP_OCRV6_NOTICE.md`](/Volumes/Programme/ocr-reference/frontend/assets/models/ocr/PP_OCRV6_NOTICE.md#L1)
  beschreibt die beiden Graphen dagegen als byte-identisch mit den offiziellen
  PaddlePaddle-Modellen.
- Die Trainingsanleitung sagt ausdrücklich, dass der gebündelte ONNX-Graph nur
  ein Inferenzartefakt und kein Fine-Tuning-Checkpoint ist. Ein domänenspezifisch
  feinjustierter kompakter CTC-Challenger ist dort als nächster Schritt
  beschrieben: [`OCR_TRAINING.md`](/Volumes/Programme/ocr-reference/frontend/test/fixtures/OCR_TRAINING.md#L45).

Die faire Einordnung lautet daher: Der allgemeine PP-OCRv6-Recognizer kann
Handschrift auf den getesteten Einkaufslisten lesen, aber die aktuelle Repo
belegt nicht sauber, dass das ausgelieferte Modell bereits ein eigenes
Handschriftmodell ist.

Die vorhandene Messung ist trotzdem nützlich:

| Messgröße | Referenz-Baseline |
|---|---:|
| Lesbare Ground-Truth-Zeilen | 45 |
| Recall lesbarer Zeilen | 97,78 % |
| Exakte Zeilen | 37,78 % |
| Character Error Rate | 20,49 % |
| Erkennung durchgestrichener Zeilen | 100 % |
| Mittlere End-to-End-Zeit | 4.464,67 ms |

Die Werte stammen aus sechs privaten Fotos und einer Desktop-Flutter-Messung,
nicht aus einem repräsentativen mobilen Benchmark. Die Repo markiert schwierige
deutsche Handschrift ausdrücklich als Schwachstelle und bezeichnet die
Konfidenz als Review-Hinweis, nicht als Beweis. Siehe [`OCR_BASELINE_PPOCRV6_HOST.md`](/Volumes/Programme/ocr-reference/frontend/test/fixtures/OCR_BASELINE_PPOCRV6_HOST.md#L1)
und [`OCR_HANDWRITING_BAKEOFF.md`](/Volumes/Programme/ocr-reference/frontend/test/fixtures/OCR_HANDWRITING_BAKEOFF.md#L1).

## Besonders gute Ideen für Haushaltsapp

### 1. Lokales Lernset mit sauberer Datenschutzgrenze

Nach manueller Korrektur können nur geeignete, nicht durchgestrichene
Einzelzeilen opt-in lokal als JPEG-Crop plus korrigiertes Label gespeichert
werden. Es werden kein komplettes Listenfoto, keine Account-, Haushalts- oder
Listen-ID und keine E-Mail exportiert. Der Nutzer muss das Trainingsarchiv
explizit exportieren.

Das ist als Grundlage für einen späteren Handschrift-Datensatz deutlich besser
als ungefilterte Screenshots oder Server-Logs: [`ocr_training_data_service.dart`](/Volumes/Programme/ocr-reference/frontend/lib/services/scan/ocr_training_data_service.dart#L18)
und [`ocr_training_data_service.dart`](/Volumes/Programme/ocr-reference/frontend/lib/services/scan/ocr_training_data_service.dart#L51).

### 2. Writer-disjoint Evaluation

Die Trainingsanleitung fordert mindestens 1.000 reale Zeilen von mindestens
fünf Schreibern und trennt Validierungsschreiber vollständig vom Training.
Das ist die richtige Messlogik für Handschrift. Die sechs bestehenden Fotos
bleiben ein eingefrorener Regressionstest und dürfen nicht gleichzeitig für
Training und Tuning verwendet werden.

### 3. Review statt stille Korrektur

CTC-Alternativen werden nur als Evidenz an den lokalen Lebensmittel-Resolver
gegeben. Eine schwache Erkennung wird nicht blind durch ein Wörterbuch ersetzt,
sondern bleibt im Review sichtbar. Haushaltskorrekturen werden anschließend als
lokale Alias-Ereignisse gelernt. Diese Kombination passt gut zu unserem
Prinzip „OCR liefert einen Draft, der Nutzer bestätigt ihn“.

### 4. Durchgestrichene Artikel als eigener visueller Zustand

Die Erkennung von Durchstreichungen ist nicht Teil des OCR-Textes, sondern eine
separate Pixelanalyse des Line-Crops. Das verhindert, dass ein Strich als
zusätzlicher Buchstabe behandelt wird und ist für Einkaufszettel praktisch.

## Übernahmeliste für die weitere Entwicklung

Die folgenden Punkte werden als fachliche Referenz übernommen. „Übernehmen“
bedeutet hier: Verhalten, Datenfluss und Tests in TypeScript neu entwerfen. Es
bedeutet nicht, Dart-, Flutter-, Drift- oder Go-Quelltext direkt zu kopieren.

### Priorität 1: Einkaufslisten und Haushaltsgedächtnis

1. **Haushaltsbezogene Nachkauf-Prognosen**

   Kaufhäufigkeit, typische Abstände, Wochentage, gemeinsame Produkte,
   zeitlicher Verfall und eine vorsichtige Haushaltshistorie sollen später zu
   einer lokalen Rangfolge für „wieder kaufen“, „bald fällig“ und „passt dazu“
   zusammengeführt werden. Referenz: [`household_prior_service.dart`](/Volumes/Programme/ocr-reference/frontend/lib/services/household_prior_service.dart#L176)
   und [`restock_service.dart`](/Volumes/Programme/ocr-reference/frontend/lib/services/restock_service.dart#L31).

2. **Zusammengeführte Vorschlagslogik**

   Vorschläge aus Einkaufsliste, Einkaufshistorie, Produktkatalog und Vorrat
   sollen über eine kanonische Produktidentität zusammengeführt werden.
   Bestehende, abgehakte Einträge sollen bevorzugt wiederhergestellt werden;
   Kategorie und Einheit dürfen beim Zusammenführen nicht verloren gehen.
   Referenz: [`household_suggestion_engine.dart`](/Volumes/Programme/ocr-reference/frontend/lib/services/scan/household_suggestion_engine.dart#L45).

### Priorität 2: OCR-Qualität und Datenschutz

3. **Aufnahmequalitätsprüfung**

   Helligkeit, Kontrast, Schärfe und Spiegelungen sollen vor der OCR bewertet
   werden. Die App soll daraus kurze, konkrete Hinweise ableiten, statt eine
   schlechte Erkennung erst im Review sichtbar zu machen. Referenz:
   [`capture_quality_service.dart`](/Volumes/Programme/ocr-reference/frontend/lib/services/scan/capture_quality_service.dart#L1).

4. **Opt-in-Korrekturspeicher**

   Bestätigte, einzelne Zeilen-Crops können später lokal mit korrigiertem Text
   gespeichert und ausdrücklich exportiert werden. Keine vollständigen Fotos,
   Haushalts-IDs oder Kontodaten in einem Trainingsarchiv. Referenz:
   [`ocr_training_data_service.dart`](/Volumes/Programme/ocr-reference/frontend/lib/services/scan/ocr_training_data_service.dart#L18).

### Optional bei passendem Produktumfang

5. **Rezeptimport mit Fallback-Strategien**

   Falls Webseiten-Rezepte importiert werden, sollen JSON-LD, Microdata, RDFa,
   eingebettete JSON-Daten und heuristische Extraktion als getrennte Parser mit
   Qualitätsbewertung arbeiten. Referenz: [`recipe_parser.go`](/Volumes/Programme/ocr-reference/backend/internal/services/recipe_parser.go#L1).

6. **Haushaltsausgaben**

   Falls gemeinsame Ausgaben Teil des Produktumfangs werden, sind ganzzahlige
   Cent-Beträge, deterministische Rundungsverteilung und explizite
   Ausgleichsbestätigung gute Referenzlogik. Vorher wird dafür keine neue
   Domäne angelegt. Referenz: [`finance_service.go`](/Volumes/Programme/ocr-reference/backend/internal/services/finance_service.go#L1).

### Nicht übernehmen

- die Flutter-, Riverpod-, Drift- und Go-Architektur;
- die dortige Outbox-, Sync-, Konflikt- und Realtime-Implementierung, da unsere
  bestehende lokale SQLite-/Supabase-Synchronisation bereits die passendere
  Grundlage ist;
- die dortige Katalogdatenbank und die UI;
- Authentifizierungs- und Membership-Logik außerhalb unseres Supabase-RLS-Modells;
- eine direkte 1:1-Kopie von Quelltext oder Modellen ohne separate
  Lizenzprüfung.

### Umsetzungsreihenfolge

1. Haushaltsbezogene Nachkauf-Prognosen als reine Domain-Logik mit fokussierten
   Tests;
2. Zusammenführung und Rangfolge aller Einkaufsvorschläge;
3. Aufnahmequalität und opt-in Korrekturspeicher für den Einkaufszettel-OCR;
4. Rezeptimport oder Ausgaben erst, wenn diese Funktionen ausdrücklich in den
   Produktumfang aufgenommen werden.

## Grenzen für eine direkte Übernahme

- Die App ist Flutter/Riverpod/Drift; unser Client ist Expo/React Native mit
  Supabase, React Query, SQLite/Drizzle und Outbox-Sync.
- Das lokale `onnxruntime`-Paket ist ein Dart-FFI-Wrapper mit nativen
  Android-/iOS-Artefakten. Es kann nicht direkt als TypeScript-Abhängigkeit in
  Haushaltsapp verwendet werden.
- Die beiden ONNX-Graphen sind absichtlich nicht im Clone enthalten. Der
  Fetch-Script lädt zusammen etwa 82 MB aus GitHub-Releases und prüft SHA-256:
  [`fetch_ocr_models.py`](/Volumes/Programme/ocr-reference/frontend/tool/fetch_ocr_models.py#L1).
  Im lokalen Clone liegen aktuell nur die Metadaten, nicht die `.onnx`-Dateien.
- Die gemessene End-to-End-Latenz ist Desktop-only. Die aktuelle Implementierung
  konfiguriert ONNX Runtime mit CPU-Threads; ein echter iOS-/Android-
  Gerätemesslauf wäre vor einer Übernahme notwendig.
- Das Root-Projekt steht unter AGPL-3.0. Die Modellnotiz nennt Apache-2.0 für
  die Paddle-Modelle, und der vendorisierte ONNX-Wrapper ist MIT-lizenziert.
  Eine Übernahme kopierter Quelltextteile sollte deshalb separat auf
  Lizenzkompatibilität geprüft werden. Modelle, Algorithmen und eine eigene
  React-Native-Implementierung sind unterschiedliche Fragen.

## Einordnung gegenüber unserem aktuellen Receipt-OCR

Unser Receipt-Ansatz ist bereits fachlich weiter auf den Bon zugeschnitten:
mehrseitige Capture-Drafts, Bounding-Box-basierte Zeilenrekonstruktion,
deutsches Preis-/Datums-Parsing, korrigierbarer Review und bestätigte
Receipt-Authority. Siehe [`CONTEXT-receipt-processing.md`](../specs/household-purchase-memory/CONTEXT-receipt-processing.md)
und [`kassenbon-texterkennung-2026-09-22.md`](kassenbon-texterkennung-2026-09-22.md).

Die externe Referenz ist für einen anderen Teil besonders interessant: das Scannen eines
handschriftlichen oder gedruckten Einkaufszettels in einzelne Listeneinträge.
Ich würde deshalb nicht den bestehenden Receipt-OCR-Pfad ersetzen. Sinnvoller
ist ein späterer separater Benchmark für einen lokalen Handschrift-/Listenmodus:

1. die sechs Referenzbilder und eigene deutsche Einkaufszettel als
   unabhängiges, lokal gehaltenes Testset prüfen;
2. die PP-OCRv6-ONNX-Modelle in einem isolierten nativen Expo-Adapter ausführen;
3. CER, Zeilen-Recall, exakte Zeilen, Latenz, App-Größe und Review-Korrekturen
   getrennt auf iOS und Android messen;
4. nur bei einem klaren Vorteil gegenüber Vision/ML Kit einen zweiten OCR-
   Engine-Pfad für Handschrift hinzufügen.

Damit bleibt `expo-ai-kit` für normale Belege der einfache Standard, während
die externe Repo als Referenz für eine spezialisierte Einkaufszettel-Erkennung dient.

## Kritische Prüfung der aktuellen OCR-Erfassung

**Prüfdatum:** 22. September 2026
**Prüfumfang:** lokaler Capture-/Resume-Pfad, Native-OCR-Adapter, Review-Snapshot,
Logout-Cleanup und die Receipt-Processing-Spec.
**Urteil:** noch nicht abnahmefähig. Diese Prüfung hat keinen Produktionscode
geändert.

### Befunde

1. **Critical: Lokale Capture-Dateien sind nicht kontogetrennt.**

   Der native Adapter speichert normalisierte Bilder unter
   `documents/receipt-captures/<captureId>` ohne Account-Segment
   (`src/features/ocr/capture/capture/native-adapters.ts:152-159`). Die
   Persistenzprüfung akzeptiert außerdem jeden `file://`-Pfad, der nur ein
   `receipt-captures`-Segment enthält
   (`src/features/ocr/capture/persistence/receipt-capture-persistence.ts:81-87`).
   Der Logout löscht Account-Storage und lokale Datenbank, aber keine solchen
   Capture-Dateien (`src/features/auth/sign-out.ts:63-78`). Das widerspricht der
   Account-Isolation und dem Cleanup-Vertrag in
   `docs/specs/household-purchase-memory/SPEC-receipt-processing.md:100-102` und
   `:249-256`.

2. **Critical: OCR-Evidenz wird im Resume-Snapshot dauerhaft gespeichert.**

   `createReceiptReviewSnapshot()` übernimmt `field.evidence` und
   `item.evidence` (`src/features/ocr/processing/review/model.ts:164-200`). Der
   Snapshot wird anschließend in den verschlüsselten Account-Storage geschrieben
   (`src/features/ocr/capture/persistence/receipt-capture-persistence.ts:347-350`).
   Damit bleiben erkannte OCR-Zeilen wie Händler-, Datums-, Summen- und
   Artikeltext erhalten, obwohl die Spec kein OCR-Volltextmaterial in MMKV,
   SQLite, Outbox oder Telemetrie erlaubt
   (`docs/specs/household-purchase-memory/SPEC-receipt-processing.md:258-266`).
   Der bestehende Persistenztest prüft nur das Fehlen von Bounding-Box-Daten,
   nicht das Fehlen der OCR-Evidenz.

3. **Required: Android-Modellbereitschaft ist im produktiven Flow nicht sichtbar.**

   Die Spec verlangt sichtbare Zustände für `not_ready`, Vorbereitung, Fehler und
   Retry (`docs/specs/household-purchase-memory/SPEC-receipt-processing.md:151-158`).
   Der Receipt-Flow wechselt jedoch direkt in `processing` und ruft den
   Verarbeitungsschritt auf
   (`src/features/ocr/processing/review/receipt-capture-review-flow.tsx:183-223`).
   `recognizeReceiptOcr()` kann dabei intern selbst `prepareVision()` auslösen;
   die explizite Bereitschafts- und Fortschrittsdarstellung existiert nur im
   Dev-Inspector. Auf einer frischen Android-Installation kann deshalb ein
   Netzwerkdownload oder ein generischer Processing-Fehler erscheinen, ohne den
   geforderten Modellzustand zu erklären.

4. **Required: Der OCR-Context-Pack enthält veraltete Ist-Zustände.**

   `CONTEXT-receipt-processing.md:46-60` behauptet unter anderem noch fehlende
   `null`-Confidence, fehlende HEIC-Unterstützung, fehlende Draft-Persistenz,
   fehlendes Review-Add/Remove, fehlende Store-Zuordnung und ignorierte
   Bounding-Boxes. Der aktuelle Code enthält diese Pfade bereits, zum Beispiel
   `src/features/ocr/processing/native.ts:137-139`,
   `src/features/ocr/capture/capture/mime.ts:1-12`,
   `src/features/ocr/processing/review/model.ts:301-337` und
   `src/features/ocr/processing/domain/layout.ts:440-479`. Der Context-Pack kann
   damit kommende Agenten zu bereits gelösten Problemen führen.

### Verifikation

Der fokussierte Lauf

```text
bun run test src/features/ocr/capture \
  src/features/ocr/processing/native.test.ts \
  src/features/ocr/processing/review/model.test.ts
```

war erfolgreich: 12 Test-Suites und 63 Tests bestanden. Diese Tests belegen die
TypeScript-Adapter- und Domain-Verträge, aber keine echte native OCR auf iOS oder
Android und keine vollständige Account-Cleanup-Abnahme.

### Offene Umsetzung vor der Abnahme

- Capture-Dateien strikt an Account-Root und Capture-ID binden und bei Logout,
  Accountwechsel und Verwerfen sicher löschen.
- OCR-Evidenz aus dem dauerhaft gespeicherten Resume-Modell entfernen oder einen
  ausdrücklich freigegebenen, datenschutzkonformen Ersatz definieren.
- Android-Modellvorbereitung als sichtbaren Produktzustand vor dem OCR-Lauf
  modellieren, einschließlich Fortschritt, Fehler und Retry.
- Den Context-Pack nach der Entscheidung aktualisieren und die alten Ist-Zustände
  nicht weiter als Arbeitsgrundlage verwenden.

Die im vorherigen Abschnitt vorgeschlagene Aufnahmequalitätsprüfung für
Helligkeit, Kontrast, Schärfe und Spiegelungen bleibt eine separate Scope-
Entscheidung. Sie ist in der aktuellen Receipt-Processing-Spec noch nicht als
Abnahmebedingung enthalten.

## Ergebnis

Der Clone bleibt als Referenz unter [`/Volumes/Programme/ocr-reference`](/Volumes/Programme/ocr-reference).
Die wertvollsten Artefakte für uns sind nicht die Flutter-Screens, sondern:

- das lokale PP-OCRv6-Modell- und ONNX-Vertragsdenken;
- Bounding-Box-/Zeilenverarbeitung und CTC-Alternativen;
- die getrennte Durchstreichungserkennung;
- writer-disjunkte Handschrift-Evaluation;
- opt-in lokale Korrektur-Crops mit explizitem Export.

Die nächste sinnvolle technische Arbeit wäre ein kleiner, isolierter
Kompatibilitäts- und Qualitätsbenchmark. Eine Produktintegration sollte erst
danach entschieden werden.
