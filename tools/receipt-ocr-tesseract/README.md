# Lokales Receipt-OCR-Testtool

Eigenständiges Vergleichswerkzeug für deutsche Kassenbons. Es verwendet nur
das lokal installierte Tesseract-CLI und verarbeitet Bilder vollständig lokal.

Das Tool ist absichtlich unabhängig von der App, der nativen Receipt-OCR und
anderen Pipeline-Tools. Es importiert keine Dateien aus `src/`, `harness/` oder
anderen `tools/`-Unterordnern.

Für die reproduzierbare Verarbeitung wird die lokale Bilddatei vor Tesseract
standardmäßig EXIF-orientiert, in Graustufen umgewandelt, normalisiert und mit
einem festen Threshold von 160 binarisiert. Die temporäre Datei bleibt im
ignorierten `.runtime/`-Ordner des Tools und wird nach dem Lauf gelöscht.

## Voraussetzungen

- Bun
- Tesseract 5 oder neuer
- deutsche Sprachdatei `deu`

Prüfen:

```sh
tesseract --version
tesseract --list-langs
```

## Einzelbild oder Testset verarbeiten

Aus dem Repository-Root:

```sh
bun run --cwd tools/receipt-ocr-tesseract ocr -- \
  ../../testbilder/IMG_4218.png \
  ../../testbilder/IMG_4220.png \
  --output-dir reports
```

Die Bildaufbereitung kann für einen Rohvergleich abgeschaltet werden:

```sh
bun run --cwd tools/receipt-ocr-tesseract ocr -- \
  ../../testbilder/IMG_4218.png \
  --preprocess none \
  --output-dir reports-raw
```

Die Reports enthalten pro erkannter Zeile:

- Text
- mittlere Tesseract-Confidence der Wörter
- Bounding-Box der Zeile
- einzelne Wörter mit eigener Position und Confidence
- Laufzeit, Sprache, PSM und Tesseract-Version

Der Standard ist `deu` und `--psm 6`. Für schmale, überwiegend einzelne
Textzeilen kann `--psm 4` oder `--psm 11` als separater Messpunkt ausgeführt
werden.

## Vergleich mit einem nativen Report

Ein Referenzreport muss ein JSON-Objekt mit `native_lines` oder `lines` und
jeweils einem `text`-Feld enthalten. Das Format ist bewusst klein gehalten,
damit native Harness-Ausgaben oder manuell exportierte Vergleichsdaten ohne
Import in dieses Tool verwendet werden können:

```sh
bun run --cwd tools/receipt-ocr-tesseract ocr -- \
  ../../testbilder/IMG_4218.png \
  --reference ../../tmp/native-IMG_4218.json \
  --output-dir reports
```

Der Vergleich enthält Zeilenanzahl, gewichtete Token-Ähnlichkeit sowie fehlende
und zusätzliche Tokens. Preis- und Zahlen-Tokens werden stärker gewichtet als
gewöhnlicher Beschreibungstext.

## Lokale Weboberfläche

Die Oberfläche läuft ausschließlich auf `127.0.0.1`. Sie benötigt weder ein
CDN noch einen Cloud-, AI- oder Pay-Dienst:

```sh
bun run --cwd tools/receipt-ocr-tesseract web
```

Danach `http://localhost:8787` öffnen. Dort können ein oder mehrere Bilder per
Drag-and-drop geladen werden. Sprache, PSM und Bildaufbereitung sind pro Lauf
wählbar. Die Oberfläche zeigt die normalisierte Vorschau mit OCR-Boxen,
Zeilen-Confidence, Rohtext, normalisierten Text, Laufzeit und die
Bildmetadaten.

Für den direkten Vergleich kann der Native-JSON-Report unter „Native
Referenzreport“ geladen werden. Ein Goldmanifest wird unter „Goldvergleich“
ausgewählt. Das vorhandene lokale Manifest kann direkt verwendet werden:

```text
testbilder/receipt-ocr-expected.json
```

Die Dateinamen im Manifest werden ohne Endung verglichen, sodass etwa die
PNG-Goldquelle auch zu einer gleichnamigen JPEG-Aufnahme passt. Über
„JSON herunterladen“ wird der vollständige lokale Laufreport gespeichert.

## Tests und Typen

```sh
bun run --cwd tools/receipt-ocr-tesseract test
bun run --cwd tools/receipt-ocr-tesseract typecheck
```

Reports und lokale Modell-/Cache-Dateien gehören nicht in Git. Der OCR-Text
kann personenbezogene oder zahlungsbezogene Angaben enthalten; Reports deshalb
nur lokal erzeugen und vor Weitergabe prüfen.
