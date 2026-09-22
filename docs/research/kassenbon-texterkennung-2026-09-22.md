# Recherche: Kassenbon-Texterkennung für Haushaltsapp

**Stand:** 22. September 2026  
**Scope:** Mobile Erfassung in Expo/React Native, deutsche Einkaufsbons,
Datenschutz, Offline-Fähigkeit und strukturierte Felder wie Händler, Datum,
Artikel und Gesamtsumme.

## Kurzfazit

Die beste Lösung ist keine einzelne OCR-Bibliothek, sondern eine Pipeline aus:

1. sauberer Aufnahme und Bildnormalisierung;
2. On-Device-OCR mit Textzeilen, Bounding-Boxes und Konfidenzen;
3. deterministischer Rekonstruktion der Bonzeilen;
4. regelbasiertem Parsing für Händler, Datum, Artikel, Mengen und Summen;
5. Plausibilitätsprüfung und vollständig editierbarem Review vor dem Speichern.

Für Haushaltsapp ist On-Device-OCR die passende Primärstrategie. Apple Vision
und Google ML Kit verarbeiten den Text auf dem Gerät. ML Kit dokumentiert
außerdem explizit die Offline-Nutzung und dass Eingabedaten sowie Ergebnisse
nicht an Google-Server gesendet werden. Auf Android muss das benötigte Modell
allerdings vorher bereitgestellt werden. [ML Kit: Text Recognition v2](https://developers.google.com/ml-kit/vision/text-recognition/v2),
[ML Kit: Terms & Privacy](https://developers.google.com/ml-kit/terms),
[expo-ai-kit: Vision](https://expo-ai-kit.dev/guides/vision)

## Was die OCR liefern sollte

Nicht nur einen zusammenhängenden String speichern oder weiterreichen. Die
Pipeline sollte pro Seite mindestens Folgendes behalten:

```text
text
confidence: number | null
boundingBox: x, y, width, height
pageIndex
```

Apple Vision liefert erkannte Textkandidaten, Konfidenz und Zeichen-Bounding-Boxen.
ML Kit Text Recognition v2 liefert Textblöcke, Zeilen und Elemente sowie
Bounding-Boxes, Eckpunkte und Konfidenzen. Die Bounding-Boxes sind für Bons
wichtig, weil Produktname, Menge, Einzelpreis und Zeilenpreis häufig in
getrennten Spalten erkannt werden. [Apple: Recognized Text](https://developer.apple.com/documentation/vision/vnrecognizedtext),
[Google: Text Recognition v2](https://developers.google.com/ml-kit/vision/text-recognition/v2)

Die Zeilenrekonstruktion sollte deterministisch arbeiten:

- Koordinaten in eine gemeinsame Top-left-Normalform bringen;
- Fragmente nach vertikaler Überlappung oder Mittelpunkt-Toleranz gruppieren;
- innerhalb einer Zeile von links nach rechts sortieren;
- getrennte Preis- und Namensspalten mit genau einem Leerzeichen verbinden;
- Seiten- und Reihenfolge erhalten.

Das ist bewusst ein eigener Parser-Schritt. Die Anbieter-OCR erkennt Text und
Geometrie, sie garantiert nicht die fachlich richtige Zuordnung aller
Einkaufszeilen.

## Aufnahme und Bildqualität

Die Kamera- oder Galerieaufnahme sollte einen einzelnen, möglichst vollständig
sichtbaren Bon liefern. Fokus, Kontrast, Reflexionen und ausreichende Textgröße
sind wichtiger als nachträgliche Parser-Komplexität. ML Kit nennt ungefähr
16 Pixel pro Zeichen als sinnvolle Untergrenze und weist darauf hin, dass
schlechter Fokus die Erkennung verschlechtert. [Google: Input image guidelines](https://developers.google.com/ml-kit/vision/text-recognition/v2/android)

Für Expo SDK 57 empfiehlt sich ein gemeinsamer lokaler Verarbeitungspfad:

1. EXIF-Orientierung anwenden;
2. lange Kante auf eine getestete Obergrenze verkleinern;
3. als JPEG mit dokumentierter Qualität speichern;
4. Dimension und Bytegröße prüfen;
5. exakt dieselbe normalisierte Datei für OCR und späteren Upload verwenden.

`expo-image-manipulator` unterstützt Crop, Rotate, Resize und JPEG/PNG/WebP-
Ausgabe auf dem lokalen Dateisystem. [Expo SDK 57: ImageManipulator](https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/)

Ein vordefinierter Capture-Rahmen, gute Ausleuchtung und eine kurze
"Bitte näher herangehen"-Rückmeldung sind sinnvoll. Vor der Parserentwicklung
sollten echte Bons aus den Zielmärkten gesammelt werden, nicht nur saubere
Beispielbilder.

## On-Device-Optionen

| Option | Stärke | Grenze |
| --- | --- | --- |
| Apple Vision | Genauigkeits- und Schnellmodus, Sprachkonfiguration, lokale Verarbeitung, für iOS gut geeignet | Liefert primär OCR-Observations, keine fertige Kassenbon-Domäne |
| Google ML Kit Text Recognition v2 | Android/iOS, Offline-Verarbeitung, hierarchische Blöcke/Zeilen/Elemente, Boxen und Konfidenzen | Bundled-Modell vergrößert die App; unbundled/Play-Services-Modell braucht Download und Readiness |
| `expo-ai-kit` | Gemeinsame Expo-API; kapselt iOS Vision und Android ML Kit, liefert normalisierte Bounds und Status/Fehler | Native Dev-Build erforderlich; Android-Modell muss explizit vorbereitet werden |

Apple beschreibt für Vision sowohl einen schnellen als auch einen genaueren
Erkennungspfad und nennt explizit Offline- und Privacy-Anwendungsfälle.
[Apple: Recognizing Text in Images](https://developer.apple.com/documentation/vision/recognizing-text-in-images)

`expo-ai-kit` dokumentiert für Android einen einmaligen Modelldownload über
Google Play Services und einen expliziten `prepareVision()`-Schritt. Es lädt
nicht implizit während der OCR. Deshalb muss die App `available`, `downloadable`,
`downloading`, `not_ready` und Fehler sichtbar behandeln. [expo-ai-kit: Vision](https://expo-ai-kit.dev/guides/vision)

## Parser und Review

Der Parser sollte für deutsche Bons mindestens Folgendes unterstützen:

- `DD.MM.YYYY`, `DD.MM.YY` und ISO-Daten;
- Dezimalkomma, EUR und Tausendertrennzeichen;
- `SUMME`, `Gesamt`, `Zu zahlen`, `Total` und Händler-spezifische Varianten;
- Mengen wie `2X` sowie Einzel- und Zeilenpreis;
- Barcodepräfixe und abschließende Steuerkennzeichen;
- Filter für Rabatt, Coupon, Pfand, Steuer, Zahlungsarten, Rückgeld,
  Signatur- und reine Barcodezeilen.

Fehlende Werte bleiben `null`. Eine erkannte Zahl darf nicht allein deshalb als
Gesamtsumme gelten, weil sie die größte Zahl auf dem Bon ist. Die Regeln sollten
mindestens prüfen:

- ist der Betrag parsebar und nicht negativ;
- passen Zeilenpreise und Mengen plausibel zusammen;
- liegt die Summe der akzeptierten Artikel nahe an der erkannten Gesamtsumme;
- gibt es mehrere konkurrierende Summen oder Datumswerte;
- ist die Konfidenz ausreichend oder muss der Nutzer prüfen.

Der Nutzer sollte Händler, Datum, Gesamtsumme, Name, Menge und Preis jeder Zeile
ändern sowie Zeilen hinzufügen oder entfernen können. Erst der bestätigte
Review-Zustand wird gespeichert. Rohes OCR sollte nur transient bleiben.

## Cloud-Parser als spätere Option

Cloud-APIs sind stark, wenn fertige semantische Felder und weniger eigener
Parser-Code wichtiger sind als Offline-Verarbeitung. Sie sind für Haushaltsapp
aber kein guter Primärpfad, weil das Bonbild das Gerät verlassen muss.

- **Google Document AI Expense Parser:** extrahiert unter anderem Händler,
  Datum, Gesamtsumme, Währung und Line Items. Deutsch ist als Sprache gelistet,
  und die Expense-Parser-Seite nennt eine EU-Region. [Processor list](https://docs.cloud.google.com/document-ai/docs/processors-list)
- **Amazon Textract AnalyzeExpense:** liefert `SummaryFields`,
  `LineItemGroups`, Geometrie und Konfidenzen. [AnalyzeExpense API](https://docs.aws.amazon.com/textract/latest/APIReference/API_AnalyzeExpense.html)
- **Azure AI Document Intelligence Receipt:** liefert Händler, Datum, Total,
  Steuer sowie Artikel mit Name, Menge, Einzel- und Gesamtpreis; Deutsch ist in
  der unterstützten Sprachliste enthalten. Der Dienst verarbeitet beim Receipt-
  Modell nur die erste Seite. [Receipt model](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/receipt?view=doc-intel-4.0.0)

Wenn später ein Cloud-Fallback nötig wird, wäre Google Document AI in der EU
der erste Benchmark-Kandidat für deutsche Bons. Das ist eine Engineering-
Empfehlung, keine Aussage über eine garantierte Erkennungsquote. Der Fallback
sollte nur nach ausdrücklicher Zustimmung, mit kurzlebiger Verarbeitung und
ohne dauerhaftes OCR-Archiv laufen.

## Empfohlene Architektur für Haushaltsapp

Die bestehende Richtung im Repository ist fachlich passend: `expo-ai-kit` als
gemeinsamer Native-Adapter, lokale OCR, Geometrie-Parser, Review und Speicherung
nur bestätigter strukturierter Receipts. Siehe
[Receipt Processing Spec](../specs/household-purchase-memory/SPEC-receipt-processing.md)
und [Capability Map](../specs/household-purchase-memory/CAPABILITY_MAP.md).

Die sinnvollste Reihenfolge ist:

1. Capture mit mehreren Seiten und lokaler JPEG-Normalisierung.
2. Native OCR nach bestätigter Android-Modelldownload-Bereitschaft.
3. Zeilenrekonstruktion aus Geometrie, nicht aus blindem OCR-String.
4. Deterministischer deutscher Parser mit `null` für Unsicherheit.
5. Kompakter, vollständig korrigierbarer Review-Screen.
6. Speicherung des Reviews in Cent, ohne OCR-Volltext in SQLite, Outbox oder
   kanonischen Receipt-Tabellen.
7. Messung gegen echte deutsche Bons auf iOS und Android.

## Messung statt Marketingwerte

Für die Abnahme sollte ein anonymisiertes Goldset aus realen Bons der Zielmärkte
verwendet werden. Getrennt messen:

- Händler-Erkennung;
- Datum exakt oder falsch;
- Gesamtsumme exakt in Cent;
- Artikel-Precision und -Recall;
- Mengen- und Preisgenauigkeit;
- Anteil der Felder, die Nutzer korrigieren;
- Offline-Erfolgsrate, Laufzeit und Fehler nach Gerät/Plattform.

Ein grüner Adaptertest beweist nur die JS-Verkabelung. Die Capability ist erst
belastbar, wenn reale Bilder nach Modellvorbereitung auf frischen iOS- und
Android-Dev-Builds funktionieren und der Nutzer unsichere Ergebnisse vor dem
Save korrigieren kann.

## Ergänzung aus englischsprachigen Primärquellen

Die zusätzliche Recherche wurde gegen die englischen Herstellerdokumentationen
und API-Referenzen durchgeführt. Sie bestätigt die bestehende Empfehlung und
präzisiert einige Implementierungsdetails:

- Apple Vision verwendet standardmäßig den genaueren Erkennungspfad. Der schnelle
  Pfad ist für Live-Vorschauen sinnvoll, der genaue Pfad für die finale
  Belegaufnahme. Sprachkorrektur und `customWords` können marken- und
  produktspezifische Begriffe unterstützen. [Apple: Recognizing Text in Images](https://developer.apple.com/documentation/vision/recognizing-text-in-images)
- ML Kit unterscheidet zwischen gebündelten Modellen mit größerer App und
  ungebündelten Modellen mit nachgelagertem Download. Für den Offline-Vertrag
  muss die Modellbereitschaft deshalb ein eigener Zustand sein. ML Kit verarbeitet
  Bilder und Ergebnisse auf dem Gerät; für Modellupdates kann es trotzdem
  gelegentlich Google-Server kontaktieren. [ML Kit Android](https://developers.google.com/ml-kit/vision/text-recognition/v2/android),
  [ML Kit Privacy](https://developers.google.com/ml-kit/terms)
- `expo-ai-kit` wendet EXIF-Orientierung an, liefert normalisierte Bounds und
  lädt Android-OCR-Modelle nicht implizit während `recognizeText()`. Der
  Vorbereitungs- und Fehlerzustand sollte daher vor der eigentlichen Aufnahme
  sichtbar sein. [expo-ai-kit Vision](https://expo-ai-kit.dev/guides/vision)
- Google Document AI kann für einen späteren Fallback auf den EU-Endpunkt
  begrenzt werden. Google dokumentiert, dass synchrone Dokumentverarbeitung im
  Speicher erfolgt und Kundendaten nicht zum Trainieren der Document-AI-Modelle
  verwendet werden. Das ändert aber nichts daran, dass das Bild das Gerät
  verlässt. [Document AI Setup](https://docs.cloud.google.com/document-ai/docs/setup),
  [Document AI Security](https://docs.cloud.google.com/document-ai/docs/security)
- Die Cloud-Parser liefern wertvolle Struktur für Vergleichstests: Textract
  liefert Summary Fields, Line Item Groups, Geometrie und Konfidenzen; Azure
  liefert Artikelname, Menge, Einzelpreis und Gesamtpreis, verarbeitet beim
  Receipt-Modell aber nur die erste Seite. [AWS AnalyzeExpense](https://docs.aws.amazon.com/textract/latest/APIReference/API_AnalyzeExpense.html),
  [Azure Receipt model](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/receipt?view=doc-intel-4.0.0)

Die praktische Konsequenz bleibt: native OCR als Standard, ein geometriebewusster
deutscher Parser und Review vor dem Save. Cloud-Parser sind Vergleichs- oder
Consent-Fallbacks, keine Voraussetzung für den Offline-MVP.
