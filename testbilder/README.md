# Receipt-Goldmanifest

`receipt-gold.json` enthält Referenzdaten für vier lokale Belegbilder. Es ist
kein OCR-Transkript. Bei `IMG_4231.png` stammen alle 17 Artikel und Preise aus
einer vollständigen manuellen Abschrift; bei den älteren Bildern markieren die
`article_anchors` ausgewählte sichtbare Artikel-/Preisfälle. Die
`receipt-ocr-expected.json` enthält die ausführlichere Artikelliste für sechs
Bilddateien.

- `file` benennt die kanonische lokale PNG-Quelldatei. Die gleichnamige JPEG-
  Variante wird im Native-Harness zusätzlich separat verarbeitet.
- Geldbeträge stehen als ganzzahlige Euro-Centwerte in `*_cents`.
- `purchase_date` ist `null`, wenn auf dem Bild kein eindeutiges Kaufdatum
  sichtbar ist. Beim ROSSMANN-Bon ist nur das sichtbare Datum ohne Uhrzeit
  aufgenommen.
- `excluded_lines` beschreibt Zeilen, die ausdrücklich nicht als normale
  Receipt-Items gespeichert werden. `visible: false` bedeutet, dass die
  Kategorie auf diesem Bild nicht als eigene sichtbare Zeile vorkommt.
- Coupon-, Pfand-, Steuer-, Zahlungs-, Barcode-, Kunden-, Karten-, Signatur-
  und Bonnummerninhalte werden nicht als OCR-Rohtext oder Testevidenz
  transkribiert. Die lokalen Bilddateien bleiben die einzige Detailquelle.

Die Bilddateien bleiben lokale Testdaten. Dieses Manifest enthält keine
Bildbytes, keinen OCR-Volltext und keine personenbezogenen oder
zahlungsbezogenen Referenzdaten.

## In den iOS-Simulator kopieren

Das Script akzeptiert eine einzelne Bilddatei oder einen Ordner. Standardmäßig
kopiert es die Bilder in `Documents/testbilder` der installierten fam-App; mit
`--photos` werden sie in die Fotos-Mediathek importiert:

```bash
bun run simulator:testbilder -- \
  --device 4B293FA5-24E8-4BF4-8295-3EF2D6C50F7D \
  testbilder/

bun run simulator:testbilder -- \
  --device 4B293FA5-24E8-4BF4-8295-3EF2D6C50F7D \
  --photos testbilder/
```
