# Capability Map: Robuste Barcode-Erfassung

**Status:** Review erforderlich (Phase 0)  
**Version:** 0.1  
**Stand:** 2026-09-02  
**Ziel-Stack:** Expo 57.0.17, `expo-camera` 57.0.4, React Native 0.86.3

## Ziel

Diese Initiative erweitert die Produkt-Barcode-Erfassung von Fam, ohne den
schnellen Standardpfad oder die vorhandene local-first-Produktsuche zu
ersetzen. Der normale Scan bleibt `expo-camera`-basiert. Zusätzliche Decoder
und OCR werden nur als gestufte Fallbacks eingesetzt, wenn sie in einem
reproduzierbaren Geräte-Test einen messbaren Nutzen zeigen.

Diese Datei ist die Freigabestufe vor den einzelnen Modul-Specs. Sie legt
stabile Modul-IDs, Verantwortungen, Abhängigkeiten, Annahmen und Go/No-Go-Gates
fest. Sie implementiert nichts und fügt keine native Abhängigkeit hinzu.

## Annahmen zur Freigabe

1. Die Initiative betrifft Produkt-Barcodes. Haushaltsbeitritts-QR-Codes
   bleiben ein eigener Workflow und werden niemals an den Produkt-Lookup
   gesendet.
2. Ein erfolgreich dekodierter Wert ist noch kein gültiger Produktcode. Nur
   ein validierter GTIN oder ein aus GS1-Daten eindeutig extrahierter GTIN darf
   den Produkt-Lookup auslösen.
3. Cache und Scan-Historie bleiben ausschließlich lokal in der bereits
   accountgebundenen, SQLCipher-verschlüsselten SQLite-Datenbank. Sie werden
   weder per Outbox synchronisiert noch nach Supabase geschrieben.
4. Der Auflösungs-Cache erhält zunächst maximal 500 Einträge mit 30 Tagen TTL.
   Die Scan-Historie erhält maximal 50 Einträge mit 7 Tagen Aufbewahrung. Beide
   Werte sind Produktannahmen und können vor der Modul-Spec geändert werden.
5. ZBar läuft nicht parallel auf jedem Kameraframe. Es wird, falls der
   Machbarkeitsnachweis positiv ausfällt, sequenziell auf einem temporären
   Standbild oder Bildausschnitt ausgeführt.
6. OCR ist standardmäßig deaktiviert, arbeitet nur auf dem Gerät und verlangt
   vor einem Netzwerk-Lookup eine Bestätigung des erkannten Werts.

## Recherchebefund: iOS und Android

### Expo 57 als Primärdecoder

`expo-camera` 57 unterstützt laut versionierter API die gewünschten Typen
`upc_a`, `upc_e`, `code39` und `code128` bereits zusätzlich zu `ean13`, `ean8`
und `qr`. Fam aktiviert heute in
`src/features/inventory/barcode-scanner-modal.tsx` nur `ean13`, `ean8` und
`qr`.

Die konkret installierte native Implementierung zeigt:

| Plattform | Primäre Engine in `expo-camera` 57.0.4 | Relevanter Befund |
|---|---|---|
| Android | CameraX mit gebündeltem ML Kit Barcode Scanning 17.3.0 | ML Kit unterstützt UPC-A, UPC-E, Code 39 und Code 128. Google empfiehlt, nur erwartete Formate zu aktivieren und laufende Frame-Analysen zu drosseln. |
| iOS | AVFoundation, ergänzt durch Expos ZXingObjC-Provider | AVFoundation unterstützt UPC-E, EAN-8, EAN-13, Code 39 und Code 128. Expo leitet Code 39 bereits an ZXing weiter. ZBar wäre hier mindestens ein dritter Decoderpfad. |

iOS besitzt keinen eigenen UPC-A-Metadatentyp. AVFoundation meldet UPC-A als
EAN-13 mit führender Null. Die installierte Expo-Version entfernt diese Null
wieder aus dem zurückgegebenen Wert. Deshalb darf die Normalisierung nicht
allein dem gemeldeten Symbologie-Namen vertrauen.

### Normalisierung und Produktidentität

Open Food Facts normalisiert Produktcodes bereits serverseitig. UPC-A wird auf
13 Stellen mit führender Null gebracht, EAN-8 bleibt achtstellig. Dieselbe
Regel muss lokal vor Deduplizierung, Cache, Historie und Lookup gelten, damit
iOS, Android und zusätzliche Decoder denselben Schlüssel erzeugen.

EAN-8, EAN-13, UPC-A und UPC-E kodieren direkt einen GTIN. Code 39 und Code 128
können dagegen beliebige Daten tragen. Bei GS1-128 bezeichnet Application
Identifier `01` einen 14-stelligen GTIN. Fam darf aus Code 128 deshalb nur dann
einen Produktcode ableiten, wenn entweder ein gültiger nackter GTIN vorliegt
oder ein gültiges GS1-Element mit AI `01` eindeutig geparst wurde. Andere
Code-39-/Code-128-Inhalte enden als `unsupported_payload` und gehen nicht an
Open Food Facts.

### ZBar

ZBar 0.23.93 unterstützt die verlangten linearen Formate, bringt aber keine
neue Formatabdeckung gegenüber dem vorhandenen Expo-Stack. Die Bibliothek ist
LGPL-2.1-lizenziert und besitzt keine offizielle Expo-/React-Native-Anbindung.
Eine Integration erfordert daher ein lokales Expo-Modul oder eine eigens
geprüfte Binding-Schicht, einen neuen Dev-Client und native Rebuilds für iOS
und Android.

ZBar wird nur übernommen, wenn ein reproduzierbarer Testkorpus gegenüber dem
Primärdecoder einen relevanten Recall-Gewinn bei beschädigten, kleinen,
schlecht beleuchteten oder schrägen Produkt-Barcodes belegt. Lizenz- und
Binary-Distribution müssen vor einer Aufnahme in Produktions-Builds geprüft
werden.

### OCR

Für iOS ist Apples Vision-Framework die bevorzugte Basis. Die Texterkennung
läuft laut Apple vollständig auf dem Gerät, liefert Konfidenzen und kann auf
einen Bildbereich begrenzt werden. Für Android ist die gebündelte lateinische
ML-Kit-Text-Recognition die bevorzugte Basis, weil sie sofort und offline
verfügbar ist; Google nennt dafür ungefähr 4 MB zusätzliche App-Größe pro
Architektur. Die ungebündelte Variante wäre beim ersten Einsatz eventuell noch
nicht verfügbar und passt daher schlechter zum local-first-Ziel.

OCR akzeptiert ausschließlich Ziffernkandidaten mit erlaubter GTIN-Länge und
gültiger Prüfziffer. Sprachkorrektur wird für die Ziffernzeile deaktiviert.
Kamerabild und Ausschnitt werden nur temporär verarbeitet und nach Abschluss
oder Abbruch gelöscht.

## Capability Map

| Modul-ID | Verantwortung | Abhängigkeiten |
|---|---|---|
| `barcode-core` | Decoderneutrales Ergebnisformat, GS1-/GTIN-Parsing, OFF-kompatible Normalisierung, Prüfziffernprüfung und versuchsweite Deduplizierung. Liefert genau einen kanonischen Barcode an den bestehenden `ProductCatalog`. | keine |
| `native-format-coverage` | Aktiviert UPC-A, UPC-E, Code 39 und Code 128 im vorhandenen `expo-camera`-Scanner. Trennt Produkt-QR von Haushalts-QR. Belegt das reale Verhalten mit einem iOS-/Android-Geräte- und Barcode-Testkorpus. | `barcode-core` |
| `resolution-cache` | Begrenzter lokaler Cache `kanonischer Barcode -> validierter CatalogProduct-Snapshot`. TTL, Maximalgröße, Resolver-Version, LRU-Bereinigung und gezielte Invalidierung. Der Cache steht vor Netzwerk, aber hinter autoritativen lokalen Produktquellen und ersetzt keinen Produktdatensatz. | `barcode-core`, `native-format-coverage` |
| `scan-history` | Kurze, lokale Historie aus `barcode`, `result`, `source`, `created_at`. `source` bezeichnet den Erkennungspfad, `result` nur den Lookup-Ausgang. Produktdetails bleiben im Katalog oder Cache. Automatische und manuelle Löschung sind verpflichtend. | `barcode-core`, `resolution-cache` |
| `zbar-fallback` | Zeitlich nachgelagerter ZBar-Decode eines temporären Standbilds oder ROI, gemeinsame Normalisierung und Deduplizierung mit dem Primärdecoder, native Build- und Lizenzprüfung. Produktion nur nach positivem Recall-/Latenz-Gate. | `barcode-core`, `native-format-coverage` |
| `ocr-fallback` | Optionaler, explizit bestätigter On-Device-OCR-Pfad nach erfolglosen Decodern. iOS Vision, Android gebündeltes ML Kit, strikte Ziffern-/GTIN-Validierung und sofortige Bildlöschung. | `barcode-core`, `zbar-fallback` |

## Build-Reihenfolge

```text
barcode-core
    |
    v
native-format-coverage
    |
    v
resolution-cache
    |
    v
scan-history
    |
    v
zbar-fallback
    |
    v
ocr-fallback
```

Die Reihenfolge entspricht dem gewünschten risikoarmen Ausbau. `zbar-fallback`
und `ocr-fallback` bleiben trotz ihrer Position eigenständige Go/No-Go-Stufen.
Ein negativer ZBar-Entscheid blockiert OCR nicht; in diesem Fall übernimmt das
OCR-Modul nur den gemeinsamen Fallback-Orchestrator ohne ZBar-Laufzeitcode.

## Gemeinsame Verträge

### Decoder-Ergebnis

Alle Erkennungspfade liefern vor dem Lookup denselben semantischen Vertrag:

```ts
type BarcodeCandidate = {
  attemptId: string;
  rawValue: string;
  symbology: 'ean8' | 'ean13' | 'upcA' | 'upcE' | 'code39' | 'code128' | 'qr';
  source: 'expoCamera' | 'zbar' | 'ocr';
};

type NormalizedBarcode = {
  canonicalValue: string;
  lookupValue: string;
  kind: 'gtin';
};
```

`rawValue` darf nur im flüchtigen Scanversuch existieren. Persistiert werden
der normalisierte Barcode und der notwendige Ergebnisstatus. Dedupliziert wird
innerhalb eines Scanversuchs auf `canonicalValue`, nicht auf Rohwert oder
Decoderquelle.

### Cache-Vertrag

Der Cache enthält ausschließlich validierte Produktauflösungen und technische
Gültigkeitsmetadaten:

```text
barcode, product_snapshot, resolved_at, expires_at, resolver_version,
last_accessed_at
```

- Reihenfolge: eigener lokaler Produktspiegel, lokaler OFF-Dump, gültiger
  Resolution-Cache, OFF-API.
- Ein Cache-Treffer wird nie automatisch nach Supabase synchronisiert.
- Erst eine bestehende Nutzeraktion wie „zum Bestand hinzufügen“ nutzt den
  normalen Persistenzpfad für einen echten Produktdatensatz.
- Höchstens 500 Einträge; abgelaufene Einträge zuerst, danach LRU.
- Negative Lookups werden nicht 30 Tage gespeichert. Falls sie zur
  Request-Drosselung gebraucht werden, erhalten sie einen getrennten,
  höchstens fünfminütigen In-Memory-Cache.
- Ein einzelner falscher Treffer und der gesamte Cache müssen löschbar sein.

### Historien-Vertrag

```text
barcode
result       = resolved | not_found | lookup_error | invalid
source       = expo_camera | zbar | ocr
created_at
```

- Maximal 50 Einträge und maximal 7 Tage.
- Bereinigung bei Insert und beim Öffnen der Historie.
- „Erneut suchen“ startet den normalen local-first-Lookup neu.
- „Zuletzt gescannte Produkte“ löst Produktdetails über Katalog oder Cache auf;
  die Historie speichert keine Produktkopie.
- Kein Kamerabild, kein OCR-Volltext, keine Bounding Box und kein Rohwert in
  Analytics, Crash-Reports oder synchronisierten Tabellen.

## Go/No-Go-Gates

### Gate 1: native Formatabdeckung

Vor ZBar muss ein versionierter Testkorpus pro Symbologie mindestens enthalten:

- saubere Referenzcodes;
- kleine und weit entfernte Codes;
- leichte Unschärfe und schwaches Licht;
- schräge und teilweise beschädigte Codes;
- UPC-A mit führender Null sowie UPC-E;
- gültige und ungültige Code-39-/Code-128-Payloads;
- zwei sichtbare Codes zur Prüfung von Deduplizierung und Auswahl.

Der Korpus wird mindestens auf einem iPhone mit iOS 16.4, einem aktuellen
iPhone, einem Android-Gerät nahe Android 7 und zwei aktuellen Android-Geräten
unterschiedlicher Hersteller ausgeführt, soweit diese Geräte im Testpool
verfügbar sind. Simulatoren zählen nicht als Kamera-Nachweis.

### Gate 2: ZBar

ZBar geht nur in Produktion, wenn alle Bedingungen erfüllt sind:

1. Das lokale Expo-Modul baut reproduzierbar für die unterstützten
   iOS-/Android-Architekturen.
2. Die LGPL-2.1- und Store-Distribution ist geprüft und dokumentiert.
3. Gegenüber `expo-camera` steigt der Recall auf dem schwierigen Korpus
   messbar, ohne Median-Latenz, Speicher oder thermische Last unvertretbar zu
   erhöhen.
4. Temporäre Bilder werden auch bei Abbruch und Fehler gelöscht.
5. Derselbe Barcode löst trotz mehrerer Decoder höchstens einen Lookup und
   eine Nutzeraktion aus.

### Gate 3: OCR

OCR geht nur in Produktion, wenn:

1. es explizit aktiviert oder vom Nutzer nach Decoder-Fehlschlag gestartet
   wird;
2. nur bestätigte, prüfzifferngültige GTINs an einen Netzwerk-Lookup gehen;
3. False-Positive-Rate und Latenz auf dem Korpus dokumentiert sind;
4. der Android-Build die Größenänderung der gebündelten ML-Kit-Komponente
   ausweist;
5. kein Bild die lokale temporäre Verarbeitung überlebt.

## Grenzen

### Immer

- Bestehenden `ProductCatalog.findByBarcode()` als einzigen Produkt-Lookup
  verwenden.
- Normalisierung und Prüfziffernprüfung als reine Funktionen testen.
- iOS- und Android-Kopien für betroffene plattformübergreifende Dateien gemäß
  Repository-Konvention anlegen.
- Cache und Historie in Drizzles lokalem SQLite-Schema sowie den lokalen
  Migrationen abbilden, ohne sie zu Sync-Entitäten zu machen.
- Native Kamera-Nachweise auf physischen Geräten ausführen.

### Vorher klären

- Cache-Limit 500, TTL 30 Tage, Historienlimit 50 und Aufbewahrung 7 Tage.
- Ob Produkt-QR neben numerischem GTIN auch GS1 Digital Link in Scope ist.
- Welche messbare Recall-Verbesserung ZBar für ein Go erreichen muss.
- Aufnahme jeder neuen nativen Abhängigkeit und der dafür erforderliche
  Dev-Client-Rebuild.
- Lizenzfreigabe für ZBar/LGPL-2.1.

### Niemals

- Keine beliebigen Code-39-, Code-128- oder QR-Inhalte an Open Food Facts
  senden.
- Keine Kamerabilder oder OCR-Ausschnitte dauerhaft speichern oder hochladen.
- Keine Barcodewerte in externe Analytics- oder Crash-Events aufnehmen.
- Cache oder Historie per Outbox/Supabase zwischen Haushalten oder Geräten
  synchronisieren.
- Keine manuelle Supabase-Migration erstellen.
- ZBar oder OCR auf jedem Live-Frame parallel zum Primärdecoder ausführen.

## Vorgesehene Modul-Specs nach Freigabe

Nach Review dieser Map werden die Specs in Abhängigkeitsreihenfolge erstellt:

1. `SPEC-barcode-core.md`
2. `SPEC-native-format-coverage.md`
3. `SPEC-resolution-cache.md`
4. `SPEC-scan-history.md`
5. `SPEC-zbar-fallback.md`
6. `SPEC-ocr-fallback.md`

Jede Modul-Spec enthält Objective, Tech Stack, vollständige Kommandos,
Projektstruktur, Code-Stil, Teststrategie, Grenzen, messbare Erfolgskriterien
und offene Fragen. Implementierung beginnt erst nach Freigabe der jeweiligen
Spec.

## Quellen

### Offizielle Plattform- und Framework-Dokumentation

- [Expo Camera, SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/camera/)
- [Expo: Add custom native code](https://docs.expo.dev/workflow/customizing/)
- [Expo SDK 57 Plattform- und Versionsmatrix](https://docs.expo.dev/versions/latest/)
- [Apple: Machine-readable object types](https://developer.apple.com/documentation/avfoundation/machine-readable-object-types)
- [Apple TN2325: AV Foundation machine-readable code detection](https://developer.apple.com/library/archive/technotes/tn2325/_index.html)
- [Google ML Kit: Barcode Scanning on Android](https://developers.google.com/ml-kit/vision/barcode-scanning/android)
- [Apple Vision: Recognizing Text in Images](https://developer.apple.com/documentation/vision/recognizing-text-in-images)
- [Google ML Kit: Text Recognition v2 on Android](https://developers.google.com/ml-kit/vision/text-recognition/v2/android)
- [Open Food Facts: Barcode normalization](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/ref-barcode-normalization/)
- [GS1 Application Identifiers](https://www.gs1.org/gs1-application-identifiers)
- [GS1: Implied Application Identifier 01](https://support.gs1.org/support/solutions/articles/43000733404-what-is-an-implied-application-identifier-01-in-a-barcode-)

### Native Bibliothek und lokaler Ist-Stand

- [ZBar Hauptrepository und unterstützte Symbologien](https://github.com/mchehab/zbar)
- [ZBar Releases](https://github.com/mchehab/zbar/releases)
- `node_modules/expo-camera/android/build.gradle`
- `node_modules/expo-camera/android/src/main/java/expo/modules/camera/analyzers/BarcodeAnalyzer.kt`
- `node_modules/expo-camera/ios/Current/BarcodeScannerUtils.swift`
- `node_modules/expo-camera/ios/barcode-scanning/ExpoCameraZXingProvider.swift`
- `src/features/inventory/barcode-scanner-modal.tsx`
- `src/features/product-search/product-catalog.ts`
- `src/features/product-search/hooks/use-product-barcode-lookup.ts`
- `src/lib/db/client.ts`
