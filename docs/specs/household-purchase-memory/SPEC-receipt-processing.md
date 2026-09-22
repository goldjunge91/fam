# Spec: Receipt Processing

**Status:** In Arbeit, nicht funktionsfähig abgenommen
**Version:** 0.2
**Capability-ID:** `receipt-processing`
**Plan:** [tasks/plan.md](../../../tasks/plan.md)
**Capability Map:** [CAPABILITY_MAP.md](./CAPABILITY_MAP.md)
**Authority-Spec:** [SPEC-receipt-authority.md](./SPEC-receipt-authority.md)
**Implementation-Beads:** `fam-rfyo`, `fam-n6on`, `fam-tyz6`, `fam-mc71`,
`fam-l4gc`, `fam-qt4m`, `fam-3bzj`, `fam-qgxy`, `fam-swdk`

## 1. Objective

`receipt-processing` verwandelt lokale Kassenbonbilder auf dem Gerät in einen
prüfbaren Receipt-Entwurf. Der Nutzer kann den Entwurf vollständig korrigieren
und erst danach in `receipt-authority` speichern.

Die Capability ist erst erfolgreich, wenn der echte Ablauf mit echten Bildern
auf iOS und Android arbeitet. Ein gemockter Native-Adapter, grüne Parsertests,
ein kompilierter Build oder ein TestFlight-Upload sind allein kein
Funktionsnachweis.

Der gemeinsame Code-Owner ist `src/features/ocr/`. Darunter bleiben die
Verantwortungen bewusst getrennt:

```text
src/features/ocr/
  authority/
  capture/
  processing/
```

## 2. Verbindlicher Umfang

### In scope

- Kamera- und Galerieeingang mit einer oder mehreren Seiten.
- HEIC als Eingangsformat sowie JPEG, PNG und WebP.
- Lokale Orientierungs-, Größen- und JPEG-Normalisierung.
- On-Device-Texterkennung ohne Netzwerk.
- Geometrische Lesereihenfolge und Zusammenführung getrennter Bonspalten.
- Erkennung von Händlertext, Datum, EUR-Gesamtsumme und relevanten
  Artikel-/Preiszeilen.
- Ausschluss von Rabatt, Coupon, Pfand, Steuer, Zahlung, Signatur- und
  Barcodezeilen als normale Artikel.
- Vollständig korrigierbarer Review einschließlich Hinzufügen und Entfernen.
- Auswahl eines bestehenden Marktes des aktiven Haushalts.
- Persistenter, kontoisolierter Draft sowie Retry/Resume nach Relaunch.
- Speicherung des bestätigten Zustands über `receipt-authority`.
- Private, retrybare Asset-Uploads ohne Verlust strukturierter Daten.
- Datumssortierte, offline lesbare Receipt-Historie. Jeder Bon öffnet eine
  dauerhafte Detailansicht mit allen gespeicherten fachlichen Receipt-Daten,
  der vollständigen bestätigten Artikelliste und vorhandenen privaten Bildern.
- Harte Seiteneffektfreiheit gegenüber Inventory, Fridge und Shopping List.

### Out of scope

- Cloud-OCR.
- Dauerhaftes OCR-Rohtextarchiv.
- Automatisches Anlegen eines Marktes.
- Haushaltslernen, Produkt-/Kategorie-Automatching und Preisempfehlungen.
- Aggregierte Spending Insights, Budgetlogik und automatische
  Bestandsänderungen.
- Automatisches Verknüpfen ähnlich benannter oder wiederkehrender Artikel.

## 3. Aktuelle Fehler, die diese Spec behebt

1. `expo-ai-kit` `0.17.0` ist installiert und konfiguriert, aber noch nicht mit
   allen drei Realbildern auf frischen iOS- und Android-Builds abgenommen.
2. Vorhandene Parser-, Review- und Capture-Tests prüfen TypeScript-Logik und
   beweisen keine native Bildverarbeitung einer echten Datei.
3. Die realen Testbilder sind HEIC, während der Capture-Pfad HEIC ablehnt.
4. Bounding-Boxes werden nicht zur Rekonstruktion von Produkt-/Preisspalten
   verwendet.
5. Capture-Drafts überleben einen Relaunch nicht zuverlässig.
6. Der Review kann Artikel weder hinzufügen noch entfernen.
7. Erkannter Markttext wird nicht in eine vorhandene `store_id` überführt.
8. Frühere Build-/Upload-Nachweise wurden fälschlich als OCR-Nachweis
   bezeichnet.

## 4. Input- und Bildvertrag

Ein Capture besteht aus mindestens einer geordneten Seite. Die Picker-Reihenfolge
ist die Seitenreihenfolge. Weitere Kameraaufnahmen können vor dem Processing an
denselben Draft angehängt werden.

Jede Picker-Datei durchläuft vor OCR und Upload dieselbe Normalisierung:

1. lokale URI auflösen;
2. Bild dekodieren und EXIF-Orientierung anwenden;
3. lange Kante auf eine dokumentierte OCR-taugliche Obergrenze verkleinern;
4. als JPEG in dokumentierter Qualität speichern;
5. Bytegröße und Dimensionen validieren;
6. in app-eigenen, kontobezogenen Dateiscope verschieben.

Das Ergebnis muss unter dem 5-MiB-Uploadlimit bleiben und für Text lesbar sein.
Die konkrete Auflösung/Qualität wird anhand der drei Realbilder gewählt und in
`fam-mc71` dokumentiert, nicht aus Bauchgefühl.

Originale oder temporäre Varianten werden nach erfolgreicher Übernahme,
explizitem Verwerfen oder Account-Cleanup entfernt. Bildbytes landen nie in
MMKV, SQLite, Outbox, Logs oder Telemetrie.

## 5. Native OCR contract

Der App-Adapter akzeptiert eine lokale normalisierte Bild-URI und liefert:

```ts
type ReceiptOcrLine = {
  text: string;
  confidence: number | null;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

type ReceiptOcrPage = {
  width: number;
  height: number;
  lines: readonly ReceiptOcrLine[];
};
```

Bounding-Boxes werden in eine plattformneutrale Top-left-Normalform überführt.
Leere Zeilen werden entfernt. Die Reihenfolge wird nicht blind vom Provider
übernommen, sondern mit Geometrie stabilisiert.

Fehlende Provider-Confidence bleibt `null`. Der Adapter darf sie weder als
`1` noch als einen anderen scheinpräzisen Wert erfinden.

Typisierte Fehler umfassen mindestens:

- ungültige oder nicht lokale URI;
- Bild nicht gefunden oder nicht dekodierbar;
- Plattform/Device nicht unterstützt;
- Native-Modul nicht verfügbar;
- kein Text erkannt;
- nativer OCR-Fehler.

## 6. Provider-Entscheidung

`expo-ai-kit@0.17.0` ist die gemeinsame Expo-Modul- und App-API. Darunter
verwendet die Integration Apple Vision auf iOS und Google ML Kit auf Android.
Es gibt keine drei konkurrierenden OCR-Implementierungen und keinen zweiten
direkten OCR-Provider im Feature-Code. `expo-mlkit-ocr` ist nicht installiert
und nicht Teil dieser Spec.

Der installierte Android-Pfad verwendet die Play-Services-Variante von ML Kit.
Das Modell kann bei `prepareVision()` einmalig aus dem Netz bereitgestellt
werden. Die App behandelt `not_ready`, Vorbereitung, Fehler und Retry als
sichtbaren Zustand. Erst nach bestätigter Bereitschaft darf sie Offline-OCR
versprechen; danach muss der komplette OCR-Lauf ohne Netzwerk funktionieren.
Offline-OCR auf Android gilt in dieser Phase nach bestätigter einmaliger
Modellbereitschaft. Eine frische Installation ohne Modellvorbereitung ist kein
Abnahmevertrag dieser Spec.

`fam-n6on` muss für die festgelegte Integration nachweisen:

- Expo SDK 57 und React Native 0.86 bauen auf beiden Plattformen;
- Expo-Autolinking enthält den Provider für Apple und Android;
- der Provider ist im frischen Dev-Build zur Laufzeit verfügbar;
- iOS Vision und Android ML Kit werden über `expo-ai-kit@0.17.0` erreicht;
- Android-Modellvorbereitung, Fehler und Retry sind reproduzierbar;
- alle drei Bilder unter `testbilder/` liefern nach bestätigter Bereitschaft
  offline nicht leere Zeilen;
- EDEKA/ROSSMANN sowie die sichtbaren Summen kommen im OCR-Output vor;
- kein Bild oder Text verlässt das Gerät.

Wenn `expo-ai-kit@0.17.0` dieses Gate nicht erfüllt, bleibt der Bead offen und
dokumentiert den reproduzierbaren Fehler. Ein anderer oder zusätzlicher
Provider wird nicht automatisch eingeführt, sondern braucht eine neue
ausdrückliche Maintainer-Entscheidung und Planrevision.

## 7. Layout reconstruction

Reale Bons liefern häufig getrennte OCR-Fragmente für Produktname, Menge,
Einzelpreis, Gesamtpreis und Steuercode. Vor dem semantischen Parser werden
Fragmente deshalb pro Seite rekonstruiert:

1. Bounding-Boxes auf Seitenkoordinaten normalisieren;
2. Zeilen anhand vertikaler Überlappung bzw. Mittelpunkt-Toleranz gruppieren;
3. Fragmente innerhalb einer Zeile von links nach rechts sortieren;
4. ausreichend getrennte Spalten mit genau einem Leerraum verbinden;
5. Seitenreihenfolge erhalten;
6. Rohfragmente nur transient halten.

Die Toleranzwerte werden an den drei Realbildern festgelegt und mit reinen
Domain-Tests abgesichert. Die Rekonstruktion darf keine Preise oder Wörter
erfinden.

## 8. Parser contract

Der Parser arbeitet deterministisch auf rekonstruierten Zeilen. Er unterstützt
mindestens:

- `EDEKA` und `ROSSMANN` als Händlerhinweis;
- Datum als `DD.MM.YYYY`, `DD.MM.YY`, `YYYY-MM-DD` und Datum/Zeit-Zeile;
- `SUMME`, `Gesamt`, `Zu zahlen`, `Total` und vergleichbare finale Summen;
- Dezimalkomma und Tausendertrennzeichen;
- Mengen vor oder innerhalb einer Zeile, etwa `2X` und `0,99 € x 2`;
- 8- bis 14-stellige Barcodepräfixe vor Artikeln;
- getrennte oder zusammengeführte Namens-/Preisspalten;
- trailing Steuercodes wie `A`, `B`, `AW` und `BW`.

Coupon, Rabatt, Pfand, Mehrwertsteuer, Zahlungsarten, Rückgeld,
Treue-/Kundendaten, Signaturblöcke und reine Barcodezeilen werden nicht als
normale Artikel ausgegeben.

Ein Feld darf `null` bleiben. Unsicherheit wird sichtbar, nicht geraten. Die
finale bezahlte Summe bleibt unabhängig von der Summe gefilterter Artikel.

## 9. Review contract

Der Review zeigt mindestens:

- vorgeschlagenen Händlertext und Auswahl eines bestehenden Household-Stores;
- Kaufdatum;
- finale EUR-Summe;
- jede erkannte Artikelzeile mit Name, Menge und Positionspreis;
- sichtbare Markierung unsicherer/fehlender Werte.

Der Nutzer kann:

- Markt, Datum, Summe, Artikelname, Menge und Preis ändern;
- fehlende Artikel hinzufügen;
- falsche Artikel entfernen;
- Verarbeitung abbrechen und später fortsetzen;
- nach Fehlern erneut OCR ausführen;
- den Draft einschließlich lokaler Dateien verwerfen.

Speichern ist nur mit validen Pflichtwerten möglich. `receipt-authority`
erhält exakt den sichtbaren Reviewzustand und die ausgewählte `store_id`.
Erkannter Freitext darf nicht still verloren gehen oder automatisch einen
neuen Markt anlegen.

## 10. Local-first und Lifecycle

Ein Capture-Draft besitzt einen expliziten Zustand:

```text
captured -> normalized -> processing -> needs_review -> saving -> saved
     |           |             |             |            |
     +--------> failed <-------+-------------+------------+
```

`failed` speichert den verantwortlichen Schritt und ist retrybar. Der Draft
wird kontobezogen im verschlüsselten `account-storage` referenziert; Bilder
liegen als Dateien. Accountwechsel und Logout dürfen keinen Zugriff auf Drafts
eines anderen Accounts erlauben.

Nach strukturiertem Save kann ein Asset-Upload weiter `pending` oder `failed`
sein. Dies macht den bestätigten Receipt nicht rückgängig. Cleanup entfernt
lokale Dateien erst, wenn sie nicht mehr für Retry oder Review benötigt werden.

## 11. Datenschutz und Observability

- Keine Remote-OCR und kein Netzwerkbedarf für die Texterkennung.
- Kein OCR-Volltext in Supabase, MMKV, SQLite, Outbox, Sentry, PostHog oder
  Debug-Logs.
- Keine vollständigen Karten-, Kunden-, Signatur- oder Bonnummern in
  Testevidenz.
- Fehlertelemetrie darf nur Code, Plattform, Phase, Seitenindex, Dauer und
  grobe Zeilenanzahl enthalten.
- Die Realbilder unter `testbilder/` bleiben lokale Testdaten. Eine Aufnahme in
  App-Bundles, CI-Artefakte oder Remote-Storage braucht eine eigene
  Maintainer-Freigabe.

## 12. Receipt-Historie und Seiteneffektfreiheit

Nach der Bestätigung liest die App ausschließlich den kanonischen
`receipt-authority`-Zustand:

- Receipts sind nach `purchase_date` absteigend sortiert; ein stabiler
  Zeitstempel dient nur als Tie-Breaker.
- Die Übersicht zeigt mindestens Datum, bestehenden Markt und `total_cents`.
- Jeder Übersichtseintrag ist vollständig aufrufbar und besitzt eine stabile
  Route über die Receipt-ID.
- Die Detailansicht zeigt alle gespeicherten fachlichen Receipt-Daten:
  bestehenden Markt, Kaufdatum, Währung, Gesamtsumme und Reviewstatus.
- Die Detailansicht zeigt alle bestätigten `purchase_receipt_items` vollständig in
  `position`-Reihenfolge: Name, Menge/Einheit, Packungsgröße, Positionspreis
  sowie vorhandene bestätigte Produkt- und Kategoriezuordnung.
- Fehlende Artikelpreise bleiben sichtbar unbekannt und werden nicht aus der
  Gesamtsumme abgeleitet.
- Vorhandene private Receipt-Assets werden in Seitenreihenfolge direkt in der
  Detailansicht angezeigt. Die erste Seite ist als Originalbon-Vorschau
  sichtbar; bei mehreren Seiten kann der Nutzer in `sort_order` wechseln.
  Antippen öffnet eine vergrößerbare Vollbildansicht. Die App speichert dafür
  keine öffentlichen URLs.
- Nach ausdrücklicher Bildlöschung bleibt die vollständige strukturierte
  Detailansicht dauerhaft aufrufbar und weist nur auf das fehlende Bild hin.
- Nicht dauerhaft strukturierte Informationen bleiben über das vorhandene
  Bonbild lesbar; OCR-Volltext und sensible Zahlungsdaten werden nicht allein
  für die Detailansicht zusätzlich gespeichert.
- Ähnliche Namen werden nicht automatisch zusammengeführt. Eine spätere
  Wiedererkennung darf nur über einen expliziten, bestätigten Linking-Vertrag
  oder `product_id` erfolgen.

Der Navigationvertrag ist fest:

- Bon erfassen bleibt über den bestehenden Receipt-Button in der
  Einkaufsliste erreichbar.
- Bon-Historie liegt unter `Haushalt > Einstellungen > Bon-Historie`.
- Die Historie erhält keinen zusätzlichen Bottom-Tab, Dashboard-Einstieg oder
  zweiten Capture-Button.

Kein Capture-, OCR-, Review-, Save-, Historien-, Delete- oder Restore-Schritt
darf Inventory-, Fridge- oder Shopping-List-Daten oder deren Outbox-Einträge
anlegen, ändern oder löschen. Diese Invariante gilt auch für spätere
Artikelverknüpfungen.

## 13. Teststrategie

### Reine Tests

- Provideroutput normalisieren, inklusive `confidence: null`.
- Bounding-Box-Reihenfolge und Spaltenzusammenführung.
- Parser für die drei Goldtranskripte und fokussierte Grenzfälle.
- Review add/edit/remove und Validierung.
- Draft-Persistenz, Accountisolation, Relaunch, Retry und Cleanup.
- Authority-Write entspricht exakt dem Review.
- Historie ist deterministisch nach Kaufdatum sortiert; jeder Bon öffnet die
  vollständige strukturierte Detailansicht mit allen bestätigten Artikeln und
  Preisen.
- Vorhandene private Bonbilder werden aus der Detailansicht in Seitenreihenfolge
  als Vorschau angezeigt und vergrößert geöffnet; Bildlöschung lässt die
  strukturierte Ansicht bestehen.
- Der vollständige Flow erzeugt keine Inventory-, Fridge- oder
  Shopping-List-Mutation und keine entsprechende Outbox-Operation.

### Native und manuelle Tests

Auf einem frischen iOS- und Android-Dev-Build:

1. Auf Android die explizite Modellvorbereitung durchführen und ihren
   Bereitschaftszustand prüfen.
2. Netzwerk deaktivieren.
3. Jedes Bild aus `testbilder/` über den echten App-Fluss auswählen.
4. Nicht leere OCR-Zeilen und erwartete Händler/Summe prüfen.
5. Filter, Reviewkorrektur und Save prüfen.
6. App beenden und Resume, Receipt-Historie und Artikelpreise nach Relaunch
   prüfen.
7. Einen Fehlerfall und Retry prüfen.
8. Inventory, Fridge, Shopping List und ihre Outbox auf unveränderten Zustand
   prüfen.

## 14. Success criteria

Die Capability ist erst funktionsfähig, wenn:

1. Autolinking und Laufzeitverfügbarkeit auf Apple und Android nachgewiesen
   sind.
2. Alle drei HEIC-Bilder nach bestätigter Provider-/Modellbereitschaft offline
   erkannt werden.
3. Die Reviewwerte mindestens EDEKA/39,14 EUR, EDEKA/43,37 EUR und
   ROSSMANN/18,95 EUR korrekt enthalten.
4. Sichtbare relevante Artikel/Preise editierbar sind und Nicht-Artikel
   herausgefiltert werden.
5. Review vollständig korrigierbar ist und der Authority-Save exakt entspricht.
6. Draft, Retry, Accountisolation und Relaunch funktionieren.
7. Fokussierte Tests, Biome, Typecheck und Native-Fingerprint-Gates grün sind.
8. Bestätigte Receipts nach Kaufdatum sortiert sind und jeder Bon dauerhaft
   als strukturierte Detailansicht mit vollständiger Artikelliste und Preisen
   geöffnet werden kann; vorhandene Bonbilder sind dort als Vorschau sichtbar
   und vergrößert aufrufbar.
9. Kein Receipt-Schritt Inventory, Fridge oder Shopping List verändert oder
   eine entsprechende Outbox-Operation erzeugt.
10. `fam-swdk` den realen Nachweis für beide Plattformen enthält.

Bis dahin bleibt der Status „in Arbeit“.
