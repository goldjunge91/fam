# Constraints: receipt-processing

**Status:** Aktiv
**Gültig für:** `fam-rfyo`, `fam-n6on`, `fam-tyz6`, `fam-mc71`, `fam-l4gc`,
`fam-qt4m`, `fam-3bzj`, `fam-qgxy`, `fam-swdk`
**Erbt:** [/CONSTRAINTS.md](/Users/marco/Github.tmp/family_app/fam/CONSTRAINTS.md)
**Plan:** [tasks/plan.md](/Users/marco/Github.tmp/family_app/fam/tasks/plan.md)
**Spec:**
[SPEC-receipt-processing.md](/Users/marco/Github.tmp/family_app/fam/docs/specs/household-purchase-memory/SPEC-receipt-processing.md)

Dieser Vertrag verschärft den Root-Vertrag für native Kassenbon-OCR. Er lockert
keine Projektregel.

## Nicht verhandelbare Produktgrenzen

- `expo-ai-kit@0.17.0` ist die gemeinsame Expo-Modul- und App-Schnittstelle.
  Darunter verwendet iOS Apple Vision und Android Google ML Kit.
- `expo-ai-kit@0.17.0` ist der einzige direkte OCR-Provider dieser Umsetzung.
  `expo-mlkit-ocr` wird nicht installiert. Ein Providerwechsel oder Fallback
  braucht eine neue ausdrückliche Maintainer-Entscheidung und Planrevision.
- OCR läuft vollständig auf dem Gerät. Auf Android darf das Play-Services-
  Modell einmalig über `prepareVision()` bereitgestellt werden; Readiness,
  Fehler und Retry müssen sichtbar sein. Nach bestätigter Bereitschaft
  funktioniert OCR ohne Netzwerk.
- Bilder und OCR-Volltext werden nicht an Remote-Dienste gesendet.
- HEIC aus Galerie/Kamera wird als Eingang unterstützt und in ein gemeinsames
  OCR-/Upload-Arbeitsformat normalisiert.
- Nutzer bestätigen einen vollständig korrigierbaren Review vor dem
  Authority-Write.
- Bildbytes, OCR-Volltext und Bounding-Boxes landen nicht in SQLite, Outbox,
  MMKV, Supabase, Sentry oder Produktanalyse.
- Accountwechsel und Logout dürfen keine fremden lokalen Drafts freigeben.
- Rabatt, Coupon, Pfand, Steuer, Zahlung, Signatur und reine Barcodezeilen
  werden nicht als normale Receipt-Items gespeichert.
- Bestätigte Receipts werden nach Kaufdatum sortiert mit Gesamtsumme und
  einer dauerhaft aufrufbaren Detailansicht lesbar gemacht. Die Detailansicht
  zeigt alle gespeicherten fachlichen Receipt-Daten und die vollständige
  bestätigte Artikelliste mit Mengen und Preisen.
- Vorhandene private Bonbilder werden in der Detailansicht in Seitenreihenfolge
  als Vorschau angezeigt und bei Antippen vergrößert geöffnet. Ihre
  ausdrückliche Löschung entfernt nicht die strukturierte Bonansicht.
- Bon erfassen bleibt in der Einkaufsliste. Bon-Historie liegt ausschließlich
  unter `Haushalt > Einstellungen > Bon-Historie`; kein zusätzlicher
  Hauptnavigationseintrag und kein zweiter Capture-Button.
- Kein Receipt-Schritt schreibt Inventory-, Fridge- oder Shopping-List-Daten
  oder erzeugt entsprechende Outbox-Operationen.
- Wiederkehrende Artikelnamen werden nicht automatisch zusammengeführt. Eine
  spätere Verbindung braucht einen expliziten, bestätigten Vertrag.

## Blockierende Gates

### Native-Verfügbarkeit

```bash
bunx expo-modules-autolinking resolve --platform apple
bunx expo-modules-autolinking resolve --platform android
```

Beide Ausgaben müssen den gewählten Provider enthalten. Zusätzlich muss ein
frischer Dev-Build auf beiden Plattformen das native Modul zur Laufzeit
bereitstellen. `requireOptionalNativeModule` oder ein JS-Fallback darf eine
fehlende Native-Integration nicht als Erfolg maskieren.

Auf Android muss zusätzlich die tatsächliche `prepareVision()`-Bereitschaft
geprüft werden. Ein gestarteter Download ist kein erfolgreiches OCR-Gate.

### Realbild-Gate

Die drei Dateien unter `testbilder/` werden auf iOS und Android über
`expo-ai-kit@0.17.0` mit der echten nativen Engine verarbeitet. Für jedes Bild
gilt:

- auf Android ist die Modellvorbereitung zuvor erfolgreich abgeschlossen;
- während OCR, Review, Save und Relaunch ist das Netzwerk deaktiviert;
- OCR liefert echte, nicht leere Zeilen;
- erwarteter Händler und sichtbare Summe kommen bis in den Review;
- Nicht-Artikel-Filter und editierbare Artikel sind sichtbar;
- Save und Relaunch funktionieren.
- der Receipt steht datumssortiert bereit und lässt sich als vollständige
  strukturierte Detailansicht mit Artikeln und Preisen öffnen;
- vorhandene private Bonbilder werden als Vorschau angezeigt und sind
  vergrößert aufrufbar;
- Inventory, Fridge, Shopping List und ihre Outbox bleiben unverändert.

Mocks, manuell eingespeiste Zeilen, Parser-Fixtures, Simulator-Einstieg,
Compile, Archive, TestFlight-Upload oder „kein Crash“ ersetzen dieses Gate
nicht.

### Native-Build-Lock

Vor einer Native-Änderung:

```bash
bun run native:status -- --diff
```

Die bestehende Drift wird erklärt und dem verantwortlichen Scope zugeordnet.
Prebuild, Pod-Install, neue Baseline oder lokaler Rebuild folgen ausschließlich
dem dokumentierten `native:*`-Workflow. `--approve-rebuild` ist Pflicht, wenn
der Projektbefehl es verlangt. Eine neue Baseline darf keinen ungeklärten Drift
verdecken.

### Datenschutz

- Die Originalbilder bleiben lokal.
- Goldmanifest und Evidenz enthalten keine vollständigen Kunden-, Karten-,
  Signatur-, Bon- oder Zahlungsreferenzen.
- Debug-Logs enthalten höchstens Fehlercode, Phase, Plattform, Seitenindex,
  Dauer und grobe Zeilenanzahl.
- Eine Remote-Übertragung der Testbilder oder OCR-Ausgaben ist blockierend.

### Review-/Authority-Parität

Der gespeicherte Receipt muss exakt dem bestätigten Review entsprechen.
Insbesondere müssen add/edit/remove, Marktzuordnung, Datum, Summe und
Positionspreise im Authority-Zustand nachvollziehbar sein. Ein Test, der nur
Mock-Aufrufparameter zählt, reicht nicht; der fokussierte lokale
Authority-Zustand wird gelesen und geprüft.

### Read-only-Grenze zu Bestand und Einkaufsliste

Receipt-Code darf keine Inventory-, Fridge- oder Shopping-List-Mutations-API
importieren oder aufrufen. Der Cross-Surface-Nachweis vergleicht den Zustand
und die relevanten Outbox-Operationen vor und nach Capture, OCR, Review, Save,
History, Delete und Restore. Eine spätere Artikelverknüpfung ändert diese
Grenze nicht.

## Source-driven Development

Vor Framework-/Library-Code werden exakte installierte Versionen und offizielle
Quellen dokumentiert. Mindestquellen:

- Expo SDK 57 ImagePicker;
- Expo SDK 57 ImageManipulator;
- Expo Autolinking;
- Expo AI Kit Vision-Dokumentation, Paketmetadaten und native Konfiguration
  der installierten Version `0.17.0`;
- Google ML Kit Android-Dokumentation für bundled/unbundled Verhalten;
- Apple Vision-Dokumentation für die verwendete Recognition-API.

Ein Paketname oder README-Versprechen ist keine Kompatibilitätsgarantie. Der
SDK-57-Spike und Realbild-Gate entscheiden.

## Testregeln

- Niemals `bun test`; nur `bun run test <scope>`.
- Parser-/Workflow-Tests bleiben fokussiert, ersetzen aber keine Native-
  Abnahme.
- Vor Änderungen an React-Native-Komponententests werden die lokalen RNTL-
  Regeln und installierten Package-Dokumente gelesen.
- Tests dürfen die zu prüfende Domain-/Persistenzlogik nicht wegmocken.
- Fehlerfälle: fehlendes Modul, ungültige URI, HEIC/JPEG, leeres OCR-Ergebnis,
  zweite Seite, Relaunch, Accountwechsel, Offline-Upload, Retry und Discard.
- Kein Snapshot mit vollständigem OCR-Text.

## Dateibesitz und Reihenfolge

Der gemeinsame Feature-Owner ist `src/features/ocr/` mit genau den Grenzen
`authority/`, `capture/` und `processing/`. `fam-rfyo` verschiebt die
bisherigen drei Feature-Roots dorthin, ohne Produktverhalten zu ändern, und ist
Voraussetzung für weitere Produktionsänderungen in diesen Scopes.

Nur `src/features/ocr/processing/` darf `expo-ai-kit` direkt importieren.
`capture/` liefert normalisierte lokale Bilder, `authority/` besitzt den
kanonischen Speichervertrag. Keine dieser Grenzen darf Inventory- oder
Shopping-List-Schreibpfade importieren.

Die Produktionsscopes stehen in den Beads. Gemeinsame Native-Konfiguration
(`package.json`, `bun.lock`, `app.json`, generierte iOS-/Android-Artefakte und
Native-Build-Lock) gehört ausschließlich `fam-n6on`. Andere Tasks fordern dort
benötigte Dependencies an, editieren diese Dateien aber nicht parallel.

Der finale Bead `fam-swdk` besitzt keine Produktionsdateien. Findet er einen
Fehler, wird der verantwortliche Vorgänger-Bead wieder geöffnet oder ein
fokussierter Bug angelegt. Die Abnahme wird nicht durch spontane Änderungen im
Verifikationsbead grün gemacht.

## Abschlussprotokoll

Ein Implementierungsbead darf erst geschlossen werden, wenn:

1. seine fokussierten Tests, Biome und Typecheck grün sind;
2. relevante Source- und Native-Gates dokumentiert sind;
3. keine neue Secret-/Datenschutz- oder Ownership-Verletzung besteht;
4. der konkrete Laufzeitnachweis in der Bead-Notiz steht;
5. alle im Bead genannten Dateien innerhalb des vereinbarten Scopes liegen.

`receipt-processing` selbst bleibt offen, bis `fam-swdk` beide Plattformen und
alle drei Bilder erfolgreich nachweist. Erst danach dürfen Statusangaben in
Plan und Capability Map auf „funktionsfähig“ geändert werden.
