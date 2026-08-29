# Prospekt-Deduplizierung: Arbeitsstand

Stand: 29. August 2026

## Ziel

Ermitteln, wie viele eigenständige Prospektversionen Lidl, Kaufland, Netto
Marken-Discount und REWE tatsächlich ausspielen und wie viel R2-Speicher nach
inhaltlicher Deduplizierung benötigt wird. Die Analyse läuft vollständig lokal
und schreibt weder nach R2 noch nach Supabase.

## Implementierte Pipeline

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

## Vollautomatische 1.000-PLZ-Stichprobe

Der Lauf wurde kontrolliert bei einem persistent gespeicherten Checkpoint
unterbrochen und kann mit demselben Befehl über den Resume-Cache fortgesetzt
werden.

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

## Gesicherte Artefakte

Arbeitsverzeichnis auf der externen Festplatte:

`/Volumes/Programme/FamCrawler/retailer-full-v5-100`

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

## Fortsetzen und automatisch auswerten

```bash
dotenv -o -e .env.development.local -- \
  bun run crawler:retailer-sample \
  --sample-size=1000 \
  --concurrency=12 \
  --pages=all \
  --stores=lidl,kaufland,netto,rewe \
  --output-dir=/Volumes/Programme/FamCrawler/retailer-full-v5-100
```

Danach OCR und automatische Klassifikation ausführen:

```bash
bun run crawler:verify \
  --manifest=/Volumes/Programme/FamCrawler/retailer-full-v5-100/manifest.json \
  --ocr \
  --ocr-concurrency=4
```

Für das vollautomatische Endergebnis ausschließlich
`candidate.automaticClassification` und die Felder
`summary.autoIdenticalPairs`, `summary.autoRegionalVariantPairs`,
`summary.autoDifferentPairs`, `summary.autoUncertainPairs` sowie
`summary.automaticSemanticGroups` auswerten. Die alten Felder `decision`,
`reviewed` und `unreviewed` können Entscheidungen aus der 100er-Kalibrierung
enthalten und gehören nicht in die automatische 1.000er-Auswertung.

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

## Relevante Implementierung

- `tools/crawler/brochures/aldi-sample-v2.ts`: geografischer V2-Crawler
- `tools/crawler/brochures/verify-versions.ts`: SHA-/dHash-/OCR-Verifikation
- `tools/crawler/brochures/auto-classification.ts`: automatische Entscheidung
- `tools/crawler/brochures/ocr.ts`: lokales OCR und Cache
- `tools/crawler/brochures/review-server.ts`: optionale lokale Human-Prüfung
- `tools/crawler/brochures/auto-classification.test.ts`
- `tools/crawler/brochures/ocr.test.ts`

