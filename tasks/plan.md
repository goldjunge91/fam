# Implementierungsplan: funktionsfähige Kassenbon-Texterkennung

**Status:** In Arbeit. `receipt-authority` ist vorhanden, aber
`receipt-processing` ist nicht funktionsfähig abgenommen.
**Initiative:** `fam-qesi`
**Plan-Revision:** `fam-5ilb`
**Struktur-Migration:** `fam-rfyo`
**Offener Native-Fix:** `fam-n6on`
**Processing-Spec:**
[SPEC-receipt-processing.md](../docs/specs/household-purchase-memory/SPEC-receipt-processing.md)
**Capability Map:**
[CAPABILITY_MAP.md](../docs/specs/household-purchase-memory/CAPABILITY_MAP.md)
**Context-Pack:**
[CONTEXT-receipt-processing.md](../docs/specs/household-purchase-memory/CONTEXT-receipt-processing.md)
**Constraints:**
[CONSTRAINTS-receipt-processing.md](household-purchase-memory/CONSTRAINTS-receipt-processing.md)
**Task-System:** Beads. Es wird kein `tasks/todo.md` angelegt.

## Ziel

Ein Haushaltsmitglied kann einen oder mehrere Kassenbonbilder fotografieren
oder aus der Galerie auswählen. Die App normalisiert die Bilder lokal, erkennt
den Text ohne Netzwerk, rekonstruiert die sichtbaren Belegzeilen, erzeugt einen
korrigierbaren Entwurf und speichert erst nach Bestätigung den kanonischen
Receipt-/Item-Zustand. Danach zeigt sie bestätigte Einkäufe nach Kaufdatum
sortiert. Jeder Bon lässt sich dauerhaft als Detailansicht öffnen. Diese zeigt
Händler, Datum, Gesamtsumme und die vollständige bestätigte Artikelliste mit
Menge und Preis sowie vorhandene private Bonbilder. Der Ablauf funktioniert
auf iOS und Android.

Receipts sind in dieser Phase reine Einkaufs- und Preisinformation. Capture,
OCR, Review, Save, Verlauf und Löschen dürfen weder Bestände noch Einkaufslisten
ändern und keine Inventory-, Fridge- oder Shopping-List-Outbox-Operation
erzeugen. Ein späteres optionales Verknüpfen wiederkehrender Artikel bleibt
eine eigene Capability und hat ebenfalls keine implizite Bestandswirkung.

„Funktioniert“ bedeutet hier nicht, dass TypeScript-Tests einen erfundenen
OCR-Payload verarbeiten können. Es bedeutet, dass echte Bilddateien die echte
native OCR-Engine durchlaufen und die erwarteten Werte in der App sichtbar und
speicherbar werden.

### Receipt asset upload barrier (2026-09-22)

Der bestätigte Receipt-Write ist local-first und atomar, aber der anschließende
Bild-Upload benötigt eine zusätzliche serverseitige Sichtbarkeitsbarriere:
`purchase_receipts` muss für denselben Haushalt remote vorhanden sein, bevor
Storage und `receipt_assets` beschrieben werden. Dafür wird kein neuer
allgemeiner Queue- oder Sync-Layer eingeführt. Der bestehende Owner
`src/lib/sync/sync-runner.ts` teilt den laufenden scoped Sync mit konkurrierenden
Aufrufern und garantiert einen abschließenden Folge-Lauf für Mutationen, die
nach dem Push-Snapshot entstanden sind. Der bestehende `waitForParentSync`-
Seam in `src/features/ocr/capture/capture/upload-queue.ts` wird im produktiven
Review-Pfad verdrahtet. `receipt_assets` bleibt außerhalb von SQLite, Outbox,
Realtime und generischem Entity-Sync.

## Verifizierter Ist-Zustand

Stand 2026-09-21:

- `receipt-authority` mit Server-, RLS-, Local-Mirror- und Outbox-Vertrag ist
  vorhanden und bleibt die kanonische Speichergrenze.
- Die Receipt-Dateien liegen bereits unter
  `src/features/ocr/{authority,capture,processing}`. `fam-rfyo` ist für die
  Struktur- und Importmigration abgeschlossen; die verbleibenden Gates sind
  fachlich/native und nicht mehr Pfadbereinigung.
- Der Receipt-Button, Kamera-/Galerieaufruf, Parser, Review und
  Authority-Write existieren als Codepfad.
- `expo-ai-kit` `0.17.0` ist als Provider installiert, in `app.json`
  konfiguriert und wird vom Adapter in
  `src/features/ocr/processing/native.ts` verwendet.
- Eine echte Cross-Platform-Abnahme mit den drei Belegen fehlt weiterhin. Ein
  erfolgreicher Build oder TestFlight-Upload beweist weder Texterkennung noch
  Ergebnisqualität.
- Auf Android verwendet der installierte Provider ein über Google Play
  Services bereitgestelltes OCR-Modell. `prepareVision()` kann deshalb vor der
  ersten Nutzung Netzwerk benötigen. Die App muss diesen Bereitschaftszustand
  explizit behandeln; nach erfolgreicher Vorbereitung läuft die Abnahme mit
  deaktiviertem Netzwerk.
- Die fokussierten Parser-, Review- und Capture-Tests prüfen TypeScript-Logik;
  der native Realbild-Lauf ist separat im iOS-Harness für alle sechs PNG-/JPEG-
  Varianten nachgewiesen. Die vollständige App-Abnahme auf beiden Plattformen
  bleibt offen.
- Der Adapter bewahrt fehlende native Confidence als `null`; es wird kein
  erfundener Ersatzwert gesetzt.
- Die sechs vorhandenen Testbildvarianten liegen als PNG und JPEG vor. Der
  aktuelle Capture-Pfad akzeptiert JPEG, PNG und WebP, normalisiert die
  Eingänge gemeinsam und persistiert den Draft kontobezogen.
- Review-Items können hinzugefügt, entfernt und bearbeitet werden. Der Save
  übernimmt die ausgewählte bestehende `store_id`; der Hot-Reload-Discard ist
  zwischen Persistence-Instanzen synchronisiert.
- Der Parser nutzt Bounding-Boxes für die geometrische Rekonstruktion von
  getrennten Produkt- und Preisspalten. Die nativen Plattform-Gates bleiben
  offen.

Die verbleibenden offenen Punkte sind Plattform-, Relaunch- und
Abnahme-Gates, keine erfundenen OCR- oder Review-Lücken.

## Reale Abnahmebilder

Die sechs Dateien unter `testbilder/` sind der verbindliche lokale
Abnahmekorpus für drei Belege. Sie werden nicht in Supabase hochgeladen, nicht
als Produktassets gebündelt und nicht als dauerhaftes OCR-Rohtextarchiv
abgelegt.

| Datei | Sichtbarer Händler | Sichtbare Summe | Wesentliche Fälle |
| --- | --- | ---: | --- |
| `IMG_4218.png` / `IMG_4218.jpeg` | EDEKA | 39,14 EUR | Falten, schräges Foto, getrennte Preis-/Namensspalten, Mengen |
| `IMG_4219.png` / `IMG_4219.jpeg` | EDEKA | 43,37 EUR | viele Positionen, Pfand, Gratisartikel/Coupon, Mengen |
| `IMG_4220.png` / `IMG_4220.jpeg` | ROSSMANN | 18,95 EUR | Barcodes vor Artikeln, Coupons, Steuerblock, ISO-Datum/Zeit |

`fam-tyz6` erstellt daraus ein minimales Goldmanifest. Es enthält nur Werte,
die für die Erkennung nötig sind. Kunden-, Karten-, Signatur- und sonstige
personenbezogene Angaben werden nicht zusätzlich transkribiert.

## Architekturentscheidungen

1. **Ein gemeinsamer Feature-Owner.** Der vollständige Receipt-OCR-Code liegt
   unter `src/features/ocr/` mit den klaren Grenzen `authority/`, `capture/`
   und `processing/`. `fam-rfyo` finalisiert die bereits begonnene Verschiebung
   aus den bisherigen drei Receipt-Feature-Roots und korrigiert alle Imports
   ohne Verhaltensänderung.
2. **On-device und offline nach Bereitschaft.** `expo-ai-kit` `0.17.0`
   verwendet auf iOS Apple Vision und auf Android Google-ML-Kit über Play
   Services. OCR sendet weder Bilder noch Text an einen Cloud-Dienst. Android
   darf das Modell einmalig über `prepareVision()` bereitstellen; die App zeigt
   diesen Zustand und behauptet vorher keine Offline-Bereitschaft. Nach der
   Vorbereitung muss OCR ohne Netzwerk funktionieren. Offline-OCR vor dieser
   einmaligen Android-Bereitschaft ist kein Ziel dieses Plans.
3. **Genau ein direkter Provider.** `expo-ai-kit@0.17.0` ist für diesen Plan
   festgelegt. Es kapselt Apple Vision auf iOS und Google ML Kit auf Android.
   `expo-mlkit-ocr` ist nicht installiert und nicht Teil der Umsetzung. Scheitert
   das SDK-57-, Autolinking-, Build-, Readiness- oder Realbild-Gate, bleibt
   `fam-n6on` offen und ein Dependency-Wechsel braucht eine neue ausdrückliche
   Maintainer-Entscheidung; es gibt keinen stillen zweiten Provider oder
   Fallback.
4. **Schmale App-Grenze.** `src/features/ocr/processing/native.ts`
   normalisiert den Provideroutput. Domain, Parser und UI importieren den
   Drittanbieter nicht direkt.
5. **Keine erfundene Confidence.** Wenn der Provider keine native Confidence
   liefert, bleibt sie unbekannt. Sie wird nicht auf `1` gesetzt. Semantische
   Parser-Sicherheit und native OCR-Sicherheit bleiben unterscheidbar.
6. **Ein normalisiertes Bild.** Kamera- und Galerieeingang werden vor OCR und
   Upload in ein orientiertes, begrenztes JPEG überführt. OCR und Upload lesen
   dieselbe persistente Datei. HEIC ist ein unterstützter Eingang, aber kein
   kanonisches Arbeitsformat.
7. **Layout vor Semantik.** Native Blocks/Lines werden pro Seite anhand der
   Geometrie in Lesereihenfolge gebracht und getrennte Namens-/Preisspalten zu
   Belegzeilen zusammengesetzt. Erst danach arbeitet der deutsche Parser.
8. **Review ist die Autoritätsgrenze.** Unsichere oder fehlende Werte bleiben
   sichtbar. Nutzer können Positionen hinzufügen, entfernen und ändern. Ein
   bestehender Haushaltsmarkt wird explizit gewählt; OCR legt keinen Markt an.
9. **Lokaler Draft statt Bildbytes im KV-Store.** Bildbytes bleiben in
   app-eigenen Dateien. Kontobezogene Draft-Metadaten und Zustände dürfen über
   den verschlüsselten `account-storage`-Owner persistiert werden. SQLite,
   Outbox und MMKV enthalten keine Bildbytes und keinen OCR-Volltext.
10. **Build ist Voraussetzung, kein Beweis.** Autolinking, Compile und Upload
   beweisen nur, dass ein Binary erstellt wurde. Abschluss erfordert den echten
   OCR- und Save-Fluss mit allen drei Bildern auf beiden Plattformen.
11. **Read-only gegenüber Inventory.** Receipt-Funktionen lesen und schreiben
    ausschließlich Receipt-/Asset-Daten. Wiederkehrende Artikel dürfen später
    explizit über `product_id` oder einen freigegebenen Linking-Vertrag
    verbunden werden; Namensähnlichkeit löst weder Linking noch Bestandswrites
    aus.
12. **Strukturierte Daten und Bilder sind getrennt.** Nach Bestätigung bleiben
    Kaufdatum, ausgewählter Markt, Gesamtsumme und bestätigte Artikelpreise in
    `purchase_receipts`/`purchase_receipt_items` gespeichert und werden offline gespiegelt.
    Bonbilder sind getrennte private Assets und unabhängig löschbar. OCR-
    Volltext wird nicht dauerhaft gespeichert.
13. **Getrennte Einstiege.** Der bestehende Bon-Button in der Einkaufsliste
    bleibt ausschließlich der Einstieg zum Erfassen. Die Bon-Historie liegt
    unter `Haushalt > Einstellungen > Bon-Historie`; es gibt dafür keinen
    zweiten Capture-Button und keinen zusätzlichen Hauptnavigationseintrag.
14. **Originalbon im Detail.** Die Bon-Detailansicht zeigt vorhandene private
    Originalbilder direkt als Vorschau in Seitenreihenfolge. Antippen öffnet
    eine vergrößerbare Vollbildansicht. Lokale Dateien werden bevorzugt;
    synchronisierte Assets werden über private, kurzlebige Zugriffe geladen.

## Abhängigkeitsfolge

```text
fam-rfyo Struktur-Migration --> fam-n6on Native Provider --+
fam-tyz6 Goldmanifest -----------------------+              |
                                             v              v
                                  fam-l4gc Layout/Parser  fam-mc71 Bildnormalisierung
                                             |              |
                                             |              v
                                             |       fam-qt4m Resume/Queue
                                             |              |
                                             +-------+------+
                                                     v
                                            fam-3bzj Review/Save
                                                     |
                                                     v
                                            fam-qgxy Verlauf
                                                     |
                                                     v
                                            fam-swdk Realabnahme
```

## Task-Index

Die vollständigen Acceptance Criteria und Dateiscopes liegen in Beads. Dieser
Abschnitt ist nur der geordnete Index und keine zweite Task-Wahrheit.

### Phase 0: gemeinsamer OCR-Owner

0. `fam-rfyo` — die begonnene Verschiebung von `receipt-authority`,
  `receipt-capture` und `receipt-processing` nach
  `src/features/ocr/{authority,capture,processing}` finalisieren und alle
  Imports, Tests und Dokumente ohne Verhaltensänderung aktualisieren. Erledigt.

**Checkpoint 0:** Erledigt. Die drei alten Feature-Roots existieren nicht mehr. Eine
gezielte Suche findet keine produktiven oder dokumentierten Imports auf die
alten Pfade; fokussierte Tests, Biome und Typecheck bleiben grün.

### Phase 1: Wahrheit und native Lauffähigkeit

1. `fam-tyz6` — Goldwerte für die drei realen Bilder definieren.
2. `fam-n6on` — die vorhandene `expo-ai-kit`-Integration auf iOS und Android
   vollständig lauffähig machen und mit echten Bildern validieren.

**Checkpoint A:** Apple- und Android-Autolinking enthalten `expo-ai-kit`. Ein
frischer Dev-Build liefert für jedes Testbild echte, nicht leere, geordnete
Zeilen. Auf Android wird die Modellvorbereitung samt Fehler-/Retry-Zustand
nachgewiesen; anschließend gelingt derselbe Lauf bei deaktiviertem Netzwerk.
`NATIVE_MODULE_UNAVAILABLE` ist nicht reproduzierbar.

### Phase 2: reale Bild- und Belegstruktur

3. `fam-mc71` — Bildformate, Orientierung, Größe und JPEG-Arbeitsformat für OCR
   und Upload normalisieren.
4. `fam-l4gc` — geometrische Zeilenrekonstruktion und Parser an EDEKA und
   ROSSMANN härten.

**Checkpoint B:** Alle sechs PNG-/JPEG-Testbildvarianten erreichen als lesbare,
korrekt orientierte JPEGs den Provider. Händler und sichtbare Summen entsprechen
dem Goldmanifest; Coupons, Pfand, Steuer, Zahlung, Signatur und Barcode werden
nicht zu Artikeln.

### Phase 3: belastbarer Nutzerfluss

5. `fam-qt4m` — Capture-Draft, Seitenfolge und Retry kontobezogen
   persistieren; Resume nach Relaunch und weitere Kameraseiten unterstützen.
6. `fam-3bzj` — Review vollständig korrigierbar machen und bestätigte Werte
   exakt in `receipt-authority` speichern.

**Checkpoint C:** Ein Offline-Draft überlebt Relaunch. Der Nutzer kann jede
falsche Position entfernen, jede fehlende Position hinzufügen, Werte ändern
und einen bestehenden Haushaltsmarkt auswählen. Der Save entspricht dem
sichtbaren Review.

### Phase 4: datumssortierte Information

7. `fam-qgxy` — bestätigte Receipts nach Kaufdatum absteigend mit
   Gesamtsumme anzeigen. Jeder Eintrag öffnet eine dauerhafte Detailansicht mit
   allen gespeicherten fachlichen Receipt-Daten, der vollständigen Artikelliste
   und ihren Preisen. Der Einstieg liegt verbindlich unter
   `Haushalt > Einstellungen > Bon-Historie`; der Capture-Button bleibt in der
   Einkaufsliste. Die Detailansicht zeigt vorhandene Originalbon-Seiten direkt
   als Vorschau und öffnet sie bei Antippen vergrößert.

**Checkpoint D:** Gespeicherte Einkäufe sind offline-fähig und deterministisch
nach Datum sortiert lesbar. Jeder Bon bleibt nach Relaunch aufrufbar; seine
Detailansicht zeigt die vollständigen bestätigten Positionen in Bonreihenfolge
mit Menge und Preis. Vorhandene Bonbilder können aus der Detailansicht geöffnet
werden und erscheinen davor bereits als Vorschau. Mehrseitige Bons behalten
ihre Seitenreihenfolge. Nach ausdrücklicher Bildlöschung bleibt die
strukturierte Bonansicht erhalten. Der komplette Flow erzeugt nachweislich
keine Inventory-, Fridge- oder Shopping-List-Mutation.

### Phase 5: reale Cross-Platform-Abnahme

8. `fam-swdk` — vollständigen Ablauf mit allen drei Bildern auf iOS und
   Android abnehmen.

**Checkpoint E:** Die Definition of Done weiter unten ist vollständig belegt.
Erst dann dürfen Capability Map, Plan und Bead den Status „funktionsfähig“
tragen.

## Verifikation je Schicht

### Statische und fokussierte Gates

```bash
bunx expo-modules-autolinking resolve --platform apple
bunx expo-modules-autolinking resolve --platform android
bun run test src/features/ocr/capture
bun run test src/features/ocr/processing
bun run test src/features/ocr/authority
bun run check
bun run typecheck
bun run native:status -- --diff
```

Kein `bun test` und keine ungefilterte Jest-Suite. Ein echter Native-Change
erfordert den dokumentierten Rebuild-/Baseline-Prozess aus `AGENTS.md`.

### Reale OCR-Matrix

Für jede Kombination aus iOS/Android und den drei Bildern wird in der
`fam-swdk`-Notiz festgehalten:

- Plattform, OS, Gerät/Simulator und Build-/Fingerprint-ID;
- Provider und exakte Version;
- Netzwerk deaktiviert;
- OCR liefert nicht leere, geordnete Zeilen;
- erkannter Händler und erkannte Summe;
- Parserergebnis und bewusst ausgeschlossene Zeilen;
- Review-Korrekturen;
- gespeicherte `purchase_receipts`-/`purchase_receipt_items`-Werte nach Relaunch;
- Position im datumssortierten Verlauf und sichtbare Artikelpreise;
- vollständige Bon-Detailansicht und Aufruf vorhandener privater Assets;
- eingebettete Originalbon-Vorschau, Seitenreihenfolge und vergrößerbare
  Bildansicht;
- Nachweis, dass keine Inventory-/Shopping-List-Entity und keine entsprechende
  Outbox-Operation verändert wurde;
- Fehler- und Retry-Verhalten.

Screenshots oder Logs dürfen keine vollständigen Kunden-, Karten- oder
Signaturdaten enthalten.

## Stop-Regeln

- Wenn `expo-ai-kit@0.17.0` nicht auf beiden Plattformen autolinkt,
  kompiliert oder die drei Bilder offline lesen kann, wird er nicht durch
  Adaptertricks als „fertig“ erklärt. `fam-n6on` bleibt offen und dokumentiert
  den reproduzierbaren Fehler. Eine andere Dependency oder ein zweiter
  Provider wird erst nach einer neuen ausdrücklichen Maintainer-Entscheidung
  geplant.
- Ein Mock-, Fixture- oder Parser-Test kann den Native-Gate nicht ersetzen.
- Ein Simulator-Einstieg, ein Release-Build, ein Archive-Upload oder ein
  TestFlight-Status kann den Realbild-Gate nicht ersetzen.
- OCR-Rohtext, Bilder oder Goldwerte werden nicht an Supabase, Telemetrie,
  Sentry oder andere Remote-Ziele gesendet.
- Ein nicht erklärter Native-Fingerprint-Drift wird nicht durch eine neue
  Baseline verdeckt.

## Nicht Teil dieses Plans

- `receipt-learning` und haushaltsbezogene automatische Zuordnungen;
- automatisches Verknüpfen wiederkehrender Artikel; eine spätere explizite
  Verbindung über `product_id` bleibt möglich;
- Produkt- und Kategorie-Matching jenseits manueller Reviewwerte;
- Aggregationen, Preisverlaufsanalyse und Budgetlogik;
- jede Inventory-, Fridge- oder Shopping-List-Änderung;
- Cloud-OCR oder ein dauerhaftes OCR-Volltextarchiv.

## Definition of Done

`receipt-processing` ist erst funktionsfähig, wenn alle Punkte gleichzeitig
erfüllt sind:

1. Der native Provider ist in frischen iOS- und Android-Dev-Builds verlinkt.
2. Alle sechs PNG-/JPEG-Testbildvarianten werden lokal normalisiert und bei
   deaktiviertem Netzwerk erkannt. Auf Android darf davor genau die dokumentierte
   Play-Services-Modellvorbereitung erfolgt sein; ihr Zustand und Retry sind
   Teil des Produktflusses.
3. Die Reviews zeigen EDEKA/39,14 EUR, EDEKA/43,37 EUR und
   ROSSMANN/18,95 EUR; das sichtbare Rossmann-Datum wird erkannt, sofern es im
   Native-Output vorhanden ist.
4. Relevante Artikel/Preise sind als editierbare Positionen vorhanden;
   Coupon, Rabatt, Pfand, Steuer, Zahlung, Signatur und Barcode werden nicht
   als normale Artikel gespeichert.
5. Nutzer können Markt, Datum, Summe und Positionen vollständig korrigieren,
   inklusive Hinzufügen und Entfernen.
6. Ein bestätigter Receipt entspricht exakt dem Review und bleibt nach
   Relaunch verfügbar; ein Uploadfehler bleibt retrybar. Der Receipt erscheint
   nach Kaufdatum sortiert; jeder Bon lässt sich als vollständige strukturierte
   Detailansicht mit bestätigten Artikelpreisen öffnen. Vorhandene Bonbilder
   werden dort als Vorschau angezeigt und sind vergrößert aufrufbar.
7. Capture-Drafts überleben Offlinezustand und Relaunch kontoisoliert; ein
   verworfener Draft hinterlässt keine lokalen Bilddateien.
8. Kein Receipt-Schritt verändert Inventory, Fridge oder Shopping List und
   erzeugt keine entsprechende Outbox-Operation.
9. Fokussierte Tests, Biome und Typecheck sind grün. Native-Fingerprint und
   Rebuild sind nach dem Projektvertrag dokumentiert.
10. `fam-swdk` enthält den realen Nachweis für beide Plattformen. Erst danach
   werden die offenen Beads geschlossen und Statusangaben aktualisiert.

## Quellen für die Umsetzung

- [Expo SDK 57 ImagePicker](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/)
- [Expo SDK 57 ImageManipulator](https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/)
- [Expo Autolinking](https://docs.expo.dev/modules/autolinking/)
- [Google ML Kit Text Recognition v2 für Android](https://developers.google.com/ml-kit/vision/text-recognition/v2/android)
- [Expo AI Kit: Vision](https://expo-ai-kit.dev/guides/vision)
- Installierte Provider-Dokumentation: `node_modules/expo-ai-kit/README.md`
