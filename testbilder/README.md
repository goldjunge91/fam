# Receipt-Goldmanifest

`receipt-gold.json` ist ein minimales, manuell gegen die drei lokalen PNG-
und JPEG-Quelldateien geprüftes Goldmanifest für `receipt-processing`. Es ist kein
vollständiges OCR-Transkript. Die `article_anchors` markieren nur sichtbare
Artikel-/Preisfälle, die für Händler-, Summen-, Mengen-, Spalten- und
Filterprüfung relevant sind.

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

Die drei PNG-Dateien bleiben lokale Testdaten. Dieses Manifest enthält keine
Bildbytes, keinen OCR-Volltext und keine personenbezogenen oder
zahlungsbezogenen Referenzdaten.
