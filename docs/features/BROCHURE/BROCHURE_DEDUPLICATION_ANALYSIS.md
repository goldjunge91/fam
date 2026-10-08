# Prospekt-Deduplizierung: Vollscan und historische Stichproben

Die in diesem Dokument enthaltenen Händler-Stichproben stammen aus dem
eingestellten Sample-Workflow und sind kein aktueller Prospektbestand. Der
aktuelle Ablauf ist die
[listing-only Vollseitenverifikation](../../../tools/crawler/brochures/README.md#listing-only-vollscan-und-vollständige-prospektverifikation).
Die hier festgehaltenen Cover-, OCR- und Stichprobenmessungen sind historisch;
sie steuern keine Prospektzusammenführung.

## Listing-only-Messung vom 2026-10-07

Der frühere Cover-only-Bericht liegt unter
`tools/crawler/data/listing-only/analysis-report.json`. Er umfasst 4.550
Prospekt-Verweise und 3.094 eindeutige Cover-Dateien. SHA-256-Prüfung ergab
keine fehlenden, verwaisten oder abweichenden Dateien. dHash lieferte 927.842
Kandidatenpaare; 2.960 Cover wurden per OCR ausgewertet. 72 Paare hatten keinen
nutzbaren OCR-Text. Diese Kandidatenwerte beweisen keine vollständige
Prospektidentität und sind keine Zusammenführungsentscheidung.

Stand der historischen Messungen: 29. August 2026

## Ziel

Ermitteln, wie viele eigenständige Prospektversionen Lidl, Kaufland, Netto
Marken-Discount und REWE tatsächlich ausspielen und wie viel R2-Speicher nach
inhaltlicher Deduplizierung benötigt wird. Die Analyse läuft vollständig lokal
und schreibt weder nach R2 noch nach Supabase.

## Historische Analysepipeline

1. Der geografisch verteilte V2-Crawler lädt alle Produktseiten einer Ausgabe.
2. SHA-256 erkennt byte-identische Bilder und Prospektsequenzen zweifelsfrei.
3. Ein 64-Bit-dHash gruppiert visuell gleiche JPEG-/Exportvarianten.
4. Lokales Tesseract-OCR vergleicht nur visuell nahe, nicht byte-identische
   Kandidaten und liest unter anderem REWE-Regionscodes aus.
5. Die automatische Klassifikation verwendet eine konservativ kalibrierte
   Merge-Regel. Unklare Fälle bleiben getrennt und werden nicht stillschweigend
   zusammengeführt.

Automatisch als identisch gilt ein Kandidatenpaar nur, wenn:

- Gesamt-dHash mindestens `0.995` ist,
- jede verglichene Seite mindestens `0.95` erreicht,
- die Seitenanzahl identisch ist,
- OCR keine Textabweichung meldet und
- kein unterschiedlicher REWE-Regionscode erkannt wurde.

Die möglichen Ergebnisse sind `identical`, `regional-variant`, `different`
und `uncertain`. Für eine sichere Speicherdeduplizierung werden ausschließlich
`identical`-Kanten vereinigt. `uncertain` bedeutet daher zusätzlichen Speicher,
nicht das Risiko eines falschen Merge.

## Kalibrierung mit 100 PLZ

Die vollständige menschlich geprüfte Referenz enthält:

- 100/100 erfolgreiche PLZ
- 447 Prospektsichtungen
- 235 Prospekt-IDs
- 208 byte-eindeutige Prospektversionen
- 26.195 Seitenreferenzen
- 3.273 einzigartige Assets
- 12,40 GiB naive Speicherung
- 1,66 GiB nach SHA-Deduplizierung, entsprechend 86,63 % Einsparung
- 185 manuell entschiedene Grenzfälle: 135 identisch, 29 regional,
  18 unterschiedlich und 3 falsche Werbeseiten
- `unreviewed = 0`

Die konservative Auto-Merge-Regel fand 31 identische Paare. Alle 31 waren in
der Human-Referenz ebenfalls als identisch markiert. dHash >= 99,5 % allein war
nicht ausreichend: Von 83 solchen Paaren waren 79 identisch, 3 regional und
1 unterschiedlich.

Die automatische Einordnung der 100er-Referenz ergab:

- 31 `identical`
- 11 `regional-variant`
- 18 `different`
- 143 `uncertain`
- 177 automatische semantische Gruppen

OCR verarbeitete 948 Assets und 1.771 Seitenvergleiche. Volltext-OCR ist bei
kleinem Prospekttext zu verrauscht, um allein über Gleichheit zu entscheiden.
Es bleibt deshalb ein konservatives Ausschluss- und Regionscode-Signal.

Mit den menschlich bestätigten Gruppen sank die 100er-Stichprobe auf 1.593
einzigartige Assets beziehungsweise 832.726.532 Bytes (0,776 GiB). Das sind
93,7 % weniger als die naive Speicherung.

## Früherer 1.000-PLZ-Checkpoint

Dieser Zwischenstand stammt aus dem früheren Sample-Lauf. Er ist keine
fortsetzbare Datenquelle für die aktuelle listing-only Pipeline.

Checkpoint:

- Ziel: 1.000 PLZ
- abgeschlossen: 732 PLZ
- fehlgeschlagen: 0 PLZ
- Prospektsichtungen: 3.357
- eindeutige Prospekt-IDs: 755
- byte-eindeutige Prospektversionen: 469
- Seitenreferenzen: 193.683
- einzigartige Assets: 4.239
- logische/naive Bildmenge: 98.653.197.646 Bytes (91,87 GiB)
- einzigartige SHA-Assets: 2.408.786.787 Bytes (2,24 GiB)
- exakte Deduplizierung: 97,5583 %

Händlerstand am Checkpoint:

| Händler | Standorte | Sichtungen | IDs | Byte-eindeutige Versionen |
| --- | ---: | ---: | ---: | ---: |
| Kaufland | 729 | 729 | 328 | 254 |
| Lidl | 732 | 732 | 20 | 20 |
| Netto Marken-Discount | 732 | 1.464 | 74 | 61 |
| REWE | 432 | 432 | 333 | 134 |

Schon vor Abschluss zeigt sich ein starkes Plateau: 91,87 GiB referenzierte
Bilder benötigen byte-dedupliziert nur 2,24 GiB. Der bisherige R2-Verbrauch
darf deshalb nicht linear pro PLZ oder Prospektsichtung hochgerechnet werden.

## Nicht mehr vorhandene Artefakte des früheren Checkpoints

Arbeitsverzeichnis im aktuellen Repository:

`tools/crawler/data/retailer-full-v5-100`

Das frühere Verzeichnis ist nicht mehr vorhanden. Die darin beschriebenen
Manifest-, OCR- und Asset-Dateien dürfen nicht durch neue Ersatzdaten
rekonstruiert oder mit dem aktuellen Vollscan vermischt werden.

Wichtige Dateien:

- `manifest.json`: aktueller 732/1.000-Checkpoint, etwa 18 MB
- `manifest-human-100.json`: eingefrorene 100er-Referenz
- `verification-report-human-100.json`: vollständiger 100er-Prüfbericht
- `review-decisions-human-100.json`: alle Human-Entscheidungen
- `verification-report.json`: letzter Bericht vor dem 1.000er-Lauf
- `review-decisions.json`: Arbeitskopie der Review-Entscheidungen
- `ocr-cache.json`: lokaler OCR-Cache, falls im Verzeichnis vorhanden
- `assets/`: inhaltsadressierte Bilddateien

Die `*-human-100.json`-Dateien dürfen beim vollautomatischen 1.000er-Ergebnis
nicht als Entscheidungsquelle verwendet werden. Sie dienen nur zur Kalibrierung
und späteren Qualitätskontrolle.

Die Vollscan-Ausgabe liegt unter `tools/crawler/data/listing-only/`. Für neue
Messungen gilt nur der oben verlinkte Vollseiten-Workflow. Die historischen
Paar- und OCR-Zahlen hier dürfen nicht als Ergebnisse der aktuellen
Vollseitenverifikation ausgegeben werden.

## Bekannte Fehlerquellen und Grenzen

- Geonames enthält neben Gemeinden auch Sonder-PLZ mit Firmen- oder
  Behördennamen. Die konkrete PLZ bleibt gültig, kann die Stichprobe aber
  gegenüber reinen Wohnort-PLZ leicht verzerren.
- REWE war am Checkpoint nur an 432 von 732 PLZ in der Quelle vorhanden.
  Fehlende REWE-Sichtungen sind Händlerabdeckung und bisher keine
  Crawlerfehler.
- Unterschiedliche OCR-Regionscodes sind ein Warnsignal, aber wegen möglicher
  OCR-Zeichenfehler kein sicherer Beweis für eine regionale Variante.
- OCR-Volltext kann kleine Preis- und Seitenzahlen falsch lesen. Deshalb wird
  OCR niemals als alleiniger positiver Merge-Beweis genutzt.
- Gleiche Seiten können im Druck mit linker/rechter Seitennummer beschriftet
  sein. Solche marginalen Unterschiede dürfen ohne weitere Signale keinen
  inhaltlich gleichen Prospekt trennen.
- Die automatische Pipeline priorisiert keine falschen Merges. Dadurch können
  tatsächlich identische `uncertain`-Paare getrennt bleiben und etwas mehr
  Speicher benötigen.

## Aktuelle Implementierung

- `tools/crawler/brochures/listing-only/all-stores-full.ts`: vollständiger Offers-Scan
- `tools/crawler/brochures/listing-only/fetch-detail-pages.ts`: echte Seitenzahlen
- `tools/crawler/brochures/listing-only/verify-full-brochures.ts`: vollständige Originalseiten-Hashes und lokale Assets
- `tools/crawler/brochures/listing-only/persist-canonical.ts`: geprüfte Varianten je Hashvektor
- `tools/crawler/brochures/listing-only/canonical-report.ts`: Vollscan- und Variantenbericht
