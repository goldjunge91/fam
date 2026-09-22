# Capability Map: Haushalts-Einkaufsgedächtnis

**Status:** Freigegebene Modulgrenzen; Authority umgesetzt, Capture,
Processing und Receipt-Historie noch nicht vollständig abgenommen
**Version:** 0.5
**Bezug:** `docs/ideas/haushalts-einkaufsgedaechtnis.md`
**Bead:** `fam-qesi`
**Freigabe:** 2026-09-20, Marco

Diese Datei ist das Scope-Gate der Initiative. Ein Build, Simulatorstart oder
TestFlight-Upload ist kein Nachweis für funktionierende Kassenbonerkennung.
Der aktuelle Implementierungs- und Abnahmeplan steht in
[tasks/plan.md](../../../tasks/plan.md).

## Ziel der Initiative

Haushalte erfassen Kassenbons mit möglichst wenig manueller Arbeit und können
anschließend nach Kaufdatum sehen:

- wann und in welchem bestehenden Markt ein Einkauf stattfand;
- was der Einkauf insgesamt gekostet hat;
- welche bestätigten Artikel enthalten waren und was sie gekostet haben.

Receipts sind reine Einkaufs- und Preisinformation. Capture, OCR, Review,
Save, Historie, Delete und Restore verändern weder Inventory/Fridge noch die
Shopping List und erzeugen keine entsprechenden Outbox-Operationen.

Ein späteres Zusammenführen wiederkehrender Artikel ist möglich, aber eine
eigene Capability. Es braucht eine explizit bestätigte Identität, etwa
`product_id`, und besitzt ebenfalls keine implizite Bestandswirkung.

## Capability Map

Alle drei Receipt-Capabilities besitzen einen gemeinsamen Code-Owner unter
`src/features/ocr/`:

```text
src/features/ocr/
  authority/
  capture/
  processing/
```

Die Unterordner bleiben fachlich getrennt. Die gemeinsame Wurzel ist eine
Strukturentscheidung und erlaubt keine Rückkopplung von Receipt-Daten in
Inventory oder Shopping List.

| Modul-ID | Verantwortung | Abhängigkeiten |
| --- | --- | --- |
| `receipt-authority` | Kanonisches Receipt-/Item-Modell, finale Summe, Haushalts-RLS, Offline-Mirror, Outbox sowie privater Asset- und Löschvertrag. | bestehende Auth-, Household-, Product-, Store- und Storage-Grundlagen |
| `receipt-capture` | Kamera/Galerie, mehrere Seiten, HEIC-/Orientierungs-/Größennormalisierung, persistenter lokaler Draft und retrybarer Asset-Upload. Keine OCR-Interpretation. | `receipt-authority` |
| `receipt-processing` | `expo-ai-kit@0.17.0` als gemeinsame Expo-API mit Apple Vision auf iOS und Google ML Kit auf Android; Texterkennung, geometrische Zeilenrekonstruktion, Parsing sowie vollständig korrigierbarer Review. Kein Cloud-OCR. | `receipt-authority`, `receipt-capture` |
| `spending-insights` | Zunächst nur datumssortierte Receipt-Historie unter `Haushalt > Einstellungen`. Jeder Bon öffnet eine dauerhafte Detailansicht mit Markt, Datum, Gesamtsumme, vollständiger bestätigter Artikelliste samt Preisen und eingebetteter Originalbon-Vorschau. Aggregationen, Budgets und Empfehlungen bleiben späterer Scope. | `receipt-authority`, `receipt-processing` |
| `receipt-learning` | Spätere, explizite Verknüpfung wiederkehrender Positionen mit bestätigten Produkten. Keine Namensheuristik als Autorität, keine automatische Änderung alter Receipts und keine Bestandswirkung. | `receipt-authority` |

## Umsetzungsstatus

| Capability | Status | Bead/Plan |
| --- | --- | --- |
| `receipt-authority` | fachlich umgesetzt; kanonischer Server-, Local-Mirror-, Outbox- und RLS-Vertrag vorhanden, Struktur-Migration noch offen | `fam-qesi.2`, `fam-rfyo` |
| `receipt-capture` | teilweise vorhanden; HEIC-Normalisierung, persistenter Draft und Relaunch-Resume offen | `fam-mc71`, `fam-qt4m` |
| `receipt-processing` | in Arbeit; gemeinsame Struktur und Provider eingebaut, aber Importmigration, Realbild-, Layout-, Review- und Cross-Platform-Gates offen | `fam-rfyo`, `fam-n6on`, `fam-tyz6`, `fam-l4gc`, `fam-3bzj`, `fam-swdk` |
| `spending-insights` | erster Slice als Receipt-Historie geplant | `fam-qgxy` |
| `receipt-learning` | nicht Teil der aktuellen Umsetzung | späterer eigener Bead |

## Build-Reihenfolge

```text
receipt-authority
    |
    +--> receipt-capture --> receipt-processing --> Receipt-Historie
    |
    +--> receipt-learning (optional, später)
```

`receipt-learning` blockiert weder OCR noch die Receipt-Historie. Die Historie
liest ausschließlich bestätigte kanonische Daten.

## Boundary-Verträge

1. `receipt-capture` liefert geordnete, normalisierte lokale Seiten und einen
   retrybaren Asset-Zustand, ohne OCR-Interpretation.
2. `receipt-processing` erzeugt einen normalisierten, prüfbaren
   `ReceiptDraft`. Unsichere Felder bleiben sichtbar und werden nicht geraten.
3. `receipt-authority` speichert exakt den bestätigten Review. Die finale
   bezahlte Summe bleibt unabhängig davon erhalten, ob alle Artikel erkannt
   oder gespeichert wurden.
4. `spending-insights` liest nur bestätigte Receipts und Items. Fehlende Preise
   bleiben unbekannt; sie werden nicht aus der Gesamtsumme erfunden.
5. `receipt-learning` darf später nur bestätigte Identitäten liefern. Ein
   ähnlicher Name allein verknüpft keine Artikel.
6. Kein Modul dieser Initiative ruft Inventory-, Fridge- oder
   Shopping-List-Mutationen auf.

## Festgelegte Entscheidungen

1. Der Capture-Einstieg liegt als eigenes Receipt-Icon neben den bestehenden
   Aktionen der Einkaufsliste. Der vorhandene Barcode-Scan bleibt unverändert.
2. Die Bon-Historie liegt getrennt davon unter
   `Haushalt > Einstellungen > Bon-Historie`. Sie erhält keinen eigenen
   Hauptnavigationseintrag und keinen zweiten Capture-Button.
3. Ein Receipt kann einem bereits vorhandenen Markt des aktiven Haushalts
   zugeordnet werden. OCR legt keinen Markt an.
4. Die Währung ist im MVP ausschließlich EUR; Geld wird in Cent gespeichert.
5. Rabatt, Coupon, Pfand, Steuer, Zahlung, Signatur und reine Barcodezeilen
   werden nicht als normale `purchase_receipt_items` gespeichert. Die bestätigte
   Gesamtsumme bleibt autoritativ.
6. Ein Receipt darf mehrere Bilder/Seiten besitzen. Das Entfernen eines Bilds
   entfernt keine strukturierten Receipt- oder Item-Daten.
7. Bilder liegen privat und haushaltsbezogen. Die Bon-Detailansicht zeigt sie
   direkt als Vorschau in Seitenreihenfolge und öffnet sie bei Antippen
   vergrößert. Es gibt keine öffentlichen URLs.
8. Strukturierte Receipts und Items sind offline gespiegelt und werden über die
   bestehende Outbox synchronisiert. Bildbytes liegen weder in SQLite noch in
   der Outbox oder in MMKV.
9. Rohes OCR-Volltextmaterial wird nicht dauerhaft gespeichert.
10. `expo-ai-kit@0.17.0` ist die gemeinsame Expo-Modul- und App-Schnittstelle.
   Darunter nutzt iOS Apple Vision und Android Google ML Kit. Feature-Code
   importiert keinen zweiten direkten OCR-Provider. `expo-mlkit-ocr` ist nicht
   installiert und nicht Teil der aktuellen Umsetzung; ein Dependency-Wechsel
   braucht eine neue ausdrückliche Maintainer-Entscheidung.
11. Das Android-Play-Services-Modell darf bei `prepareVision()` einmalig
    Netzwerk benötigen. Die App zeigt Bereitschaft, Vorbereitung, Fehler und
    Retry. Nach bestätigter Bereitschaft funktioniert OCR offline.
12. Die drei HEIC-Dateien unter `testbilder/` bilden den verbindlichen lokalen
    Realbildkorpus für iOS und Android.
13. Die aktuelle Leseoberfläche ist bewusst fokussiert: nach Datum sortierte
    Einkäufe und eine dauerhaft aufrufbare Bon-Detailansicht mit allen
    gespeicherten fachlichen Receipt-Daten, vollständiger Artikelliste,
    Artikelpreisen und eingebetteter Originalbon-Vorschau. Aggregationen und
    Budgets sind nicht Teil dieses Plans.
14. Receipt-Funktionen verändern niemals Inventory, Fridge oder Shopping List.
    Diese Grenze gilt auch für spätere Artikelverknüpfungen.

## Nicht in der aktuellen Umsetzung

- automatische Bestandspflege oder Einkaufslistenänderungen;
- automatische Verknüpfung wiederkehrender Artikel;
- Preisaggregation, Budgetplanung, Budgetwarnungen oder Markt-Empfehlungen;
- private Kalorien-, Gewichts- oder Gesundheitsdaten;
- Cloud-OCR oder ein dauerhaftes OCR-Rohtextarchiv;
- zusätzliche oder parallele OCR-Provider. `expo-ai-kit@0.17.0` kapselt die
  nativen Plattform-Engines.

## Abnahme-Gate

Die Capability Map darf `receipt-processing` erst als funktionsfähig markieren,
wenn `fam-swdk` alle drei Bilder auf frischen iOS- und Android-Dev-Builds durch
den echten App-Fluss verarbeitet hat. Auf Android wird zuerst die
Modellbereitschaft bestätigt, danach läuft die Abnahme ohne Netzwerk. Save,
Relaunch, datumssortierte Historie, Artikelpreise und der unveränderte
Inventory-/Shopping-Zustand gehören zum selben Gate.
