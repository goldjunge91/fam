# Lokaler OCR-Vergleich für Prospektangebote

Stand: 2026-10-08. Alle Bilder und Modell-Caches blieben lokal. Es gab keine
Cloud-OCR-Aufrufe und keine Uploads.

## Umfang und Engines

- 50 Seiten: Seiten 1 und 2 von 25 BRNs aus dem PLZ-22043-Sample, verteilt
  auf 10 Händler. Jede Eingabedatei wurde vor der Erkennung gegen ihren
  SHA-256-Wert im Manifest geprüft.
- PaddleOCR 3.7.0 mit PaddlePaddle 3.3.0 und PP-OCRv6 Medium, Sprache Deutsch.
- Tesseract 5.5.3 mit `deu+eng`: PSM 6 auf dem Original und PSM 11 auf einer
  1,5-fach vergrößerten Graustufen-/Kontrast-Version.
- Mittlere Erkennungszeit pro Seite: PaddleOCR 24,05 s, Tesseract PSM 6 1,90 s,
  Tesseract PSM 11 2,26 s. Das sind Bildlaufzeiten ohne Modellstart.

## Manuell überprüfte Textfelder

Die Werte wurden auf den jeweiligen Seiten visuell geprüft. „Ja“ bedeutet nur,
dass der Wert im OCR-Seitentext vorkommt. Es bestätigt nicht, dass Produkt,
Packungsgröße und Preis im selben Angebot korrekt miteinander verknüpft sind.
Beim OCR-Text wurde für die Suche nach Zahlen ein fehlendes Dezimalzeichen wie
`029` gegenüber `0,29` toleriert.

Alle Engines lasen auf dem REWE-Cover 224645 den Gültigkeitstext „41. Woche
2026. Gültig ab 05.10.2026“. Beim Kaufland-Beck's-Angebot lasen alle drei
„20 × 0,5 L“; diese Packungsgröße allein sagt noch nichts darüber aus, ob die
benachbarten Preise richtig zugeordnet sind.

| Seite und Wert | PaddleOCR | Tesseract PSM 6 | Tesseract PSM 11 |
| --- | --- | --- | --- |
| Kaufland 218342, 19,89 € | Ja | Nein | Nein |
| Kaufland 218342, 9,66 € | Ja | Nein | Ja |
| XXXLutz 218739, 82 % | Ja | Nein | Ja |
| Lidl 224222, 0,99 € | Ja | Nein | Nein |
| Lidl 224222, 1,99 € | Ja | Nein | Nein |
| Lidl 224222, 0,55 € | Ja | Nein | Ja |
| REWE 224645, 0,29 € | Ja, als `029` | Nein | Nein |
| REWE 224645, 0,34 € | Ja, als `034` | Nein | Nein |
| REWE 224645, 0,49 € | Ja | Nein | Nein |

PaddleOCR las in diesen Seiten die meisten der ausgewählten Angebotswerte. Es
verlor bei REWE aber teils das Dezimalzeichen. Tesseract PSM 11 half bei
einzelnen Werten gegenüber PSM 6, war auf dichten Angebotsseiten weiterhin
unvollständig. Diese kleine Feldstichprobe ist ein Vergleich, keine
repräsentative Genauigkeitsquote.

## Identitätskontrollen

- REWE BRN 224249 und 224754: Seite 1 und Seite 2 haben jeweils denselben
  SHA-256-Hash. PaddleOCR lieferte für jede dieser identischen Seiten auch
  denselben Text.
- XXXLutz BRN 218756 und 218757: Seite 1 hat denselben SHA-256-Hash. Die
  geprüften Seiten 2, 3 und 24 haben unterschiedliche Bild-Hashes.
  Auf Seite 2 ist der normalisierte PaddleOCR-Text trotzdem gleich. Eine
  sichtbare Bildabweichung kann für OCR also unsichtbar bleiben.

## Ergebnis und Grenze

PaddleOCR ist für die lokale Lesung kleiner Produkt- und Preisangaben ein
deutlicher Kandidat gegenüber Tesseract PSM 6. PSM 11 gewinnt einzelne Felder
zurück, braucht aber ungefähr dieselbe Größenordnung an Qualitätseinbußen wie
PSM 6 auf den hier geprüften Preisbeispielen. PaddleOCR benötigt auf diesem
Rechner zugleich rund 10 bis 13-mal länger pro Seite als Tesseract.

Keines der drei Verfahren kann aus OCR-Text allein sichere Angebotsgleichheit
feststellen: Spaltenzuordnung kann verloren gehen, Zeichen wie Dezimalpunkte
werden verwechselt oder ausgelassen, und gleiche erkannte Wörter beweisen keine
identischen Bilder. OCR eignet sich hier als Feld-Extraktion und Hinweisgeber.
Für die Gleichheitsentscheidung müssen erkannte Angebotsfelder räumlich und
semantisch zusammengeführt und anschließend gegen visuelle Vergleichsfälle
geprüft werden.

## Reproduzierbare lokale Ergebnisse

- `manifest.json`, `results.json`: 50 Seiten aus PLZ 22043.
- `reference-cases.json`, `reference-results.json`: 12 bekannte REWE- und
  XXXLutz-Seiten.
- `run_benchmark.py`: lokaler OCR-Lauf. `OCR_BENCHMARK_REPAIR_TESSERACT=1`
  erneuert Tesseract-Ergebnisse, ohne vorhandene PaddleOCR-Ergebnisse erneut
  zu rechnen.
