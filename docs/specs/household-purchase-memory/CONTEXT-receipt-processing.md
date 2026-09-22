# Focused Context-Pack: receipt-processing

**Status:** Aktiv, Capability nicht abgenommen
**Scope:** Native OCR, Bildnormalisierung, Layout/Parser, Capture-Resume,
Review, datumssortierte Receipt-Historie und reale Cross-Platform-Abnahme
**Spec:** [SPEC-receipt-processing.md](./SPEC-receipt-processing.md)
**Plan:** [tasks/plan.md](../../../tasks/plan.md)
**Constraints:**
[tasks/household-purchase-memory/CONSTRAINTS-receipt-processing.md](../../../tasks/household-purchase-memory/CONSTRAINTS-receipt-processing.md)

## Read order

1. `AGENTS.md` und Root-`CONSTRAINTS.md`.
2. Processing-Constraints, Processing-Spec und den eigenen Bead im Plan.
3. Diesen Context-Pack.
4. Nur die unter dem eigenen Bead genannten aktuellen Source-/Testdateien.
5. Exakte Expo-SDK-57- und Provider-Dokumentation vor Native-Code.

Die Authority-Spec bleibt für den Speichervertrag relevant, ist aber keine
Quelle für OCR- oder UI-Entscheidungen.

## Wahrheitsquellen

In absteigender Priorität:

1. aktueller Sourcecode und echte Gerätelaufzeit;
2. `SPEC-receipt-processing.md`;
3. `tasks/plan.md` und Bead-Acceptance;
4. `SPEC-receipt-authority.md` für den kanonischen Save;
5. offizielle versionsgenaue Dokumentation;
6. Unit-/Integrationstests.

Ein Test mit injiziertem Native-Payload beweist nur den Adapter oder Workflow,
nicht die Verfügbarkeit oder Qualität der nativen OCR.

## Bekannter Ist-Zustand

- `expo-ai-kit` `0.17.0` ist in `package.json`, `bun.lock` und `app.json`
  vorhanden. Der Adapter importiert den Provider in
  `src/features/ocr/processing/native.ts`.
- `expo-ai-kit` ist die gemeinsame Expo-Schnittstelle: iOS nutzt darunter
  Apple Vision, Android Google ML Kit.
- Das Android-OCR-Modell wird über Google Play Services durch
  `prepareVision()` bereitgestellt. Offline-Abnahme beginnt erst nach
  bestätigter Modellbereitschaft.
- Vorhandene Parser-, Review- und Capture-Tests prüfen TypeScript-Logik; der
  echte native OCR-Lauf wird separat über die Realbild-Harnesses abgenommen.
- `src/features/ocr/processing/native.ts` bewahrt fehlende Provider-Confidence
  als `null`; es wird kein Ersatzwert erfunden.
- `testbilder/IMG_4218.png`/`.jpeg`, `IMG_4219.png`/`.jpeg` und
  `IMG_4220.png`/`.jpeg` sind die realen lokalen Testbildvarianten.
- Sichtbare Goldanker: EDEKA/39,14 EUR, EDEKA/43,37 EUR,
  ROSSMANN/18,95 EUR.
- Der aktuelle MIME-Owner akzeptiert nur JPEG, PNG und WebP.
- Capture-Draft-Metadaten werden kontobezogen verschlüsselt persistiert; das
  laufende Discard wird zwischen Persistence-Instanzen synchronisiert.
- Review-Items können hinzugefügt, entfernt und bearbeitet werden; der Save
  übernimmt die ausgewählte bestehende `store_id`.
- Die geometrische Layout-Rekonstruktion nutzt Bounding-Boxes für Spalten und
  Zeilen. Die datumssortierte Receipt-Historie ist implementiert, aber noch
  nicht als vollständiger nativer Nutzerfluss abgenommen.
- Receipt-Flows dürfen keine Inventory-, Fridge- oder Shopping-List-Mutation
  und keine entsprechende Outbox-Operation erzeugen.

## Task context

### `fam-rfyo` — gemeinsamer OCR-Owner

Laden:

- `src/features/ocr/authority/**`
- `src/features/ocr/capture/**`
- `src/features/ocr/processing/**`
- alle noch nicht aktualisierten Imports der drei früheren Feature-Roots
- Plan, Capability Map, Specs, Context und Constraints dieser Initiative

Prüfen:

- Zielstruktur ist exakt `src/features/ocr/authority/`,
  `src/features/ocr/capture/` und `src/features/ocr/processing/`;
- Verschiebung und Importkorrekturen ändern kein Produktverhalten;
- die bisherigen drei Feature-Roots und alle alten Importverweise sind
  entfernt;
- fokussierte Tests, Biome und Typecheck bleiben grün.

### `fam-tyz6` — Goldmanifest

Laden:

- `testbilder/IMG_4218.png` und `testbilder/IMG_4218.jpeg`
- `testbilder/IMG_4219.png` und `testbilder/IMG_4219.jpeg`
- `testbilder/IMG_4220.png` und `testbilder/IMG_4220.jpeg`
- Processing-Spec: Teststrategie und Datenschutz

Nur minimal nötige Werte transkribieren. Keine Kunden-, Karten-,
Signatur- oder Bonnummern in Manifest oder Bead-Notizen.

### `fam-n6on` — Native Provider

Laden:

- `package.json`, `bun.lock`, `app.json`
- `src/features/ocr/processing/native.ts`
- vorhandene fokussierte Tests unter `src/features/ocr/processing/`
- `node_modules/expo-ai-kit/README.md`
- `node_modules/expo-ai-kit/android/build.gradle`
- Apple-/Android-Autolinking-Ausgaben und native Lockfiles
- `native-build-lock.json`
- Expo Autolinking und Provider-Dokumentation

Prüfen:

- Apple und Android müssen denselben JS-Adaptervertrag erfüllen.
- `expo-ai-kit@0.17.0` bleibt die gemeinsame Expo-API; iOS verwendet Vision,
  Android Google ML Kit.
- Android-Modellvorbereitung, Readiness, Fehler und Retry sind explizit und
  werden vor der Offline-Abnahme nachgewiesen.
- Provideroutput enthält Zeilen/Geometrie oder lässt sich verlustarm daraus
  ableiten.
- Fehlende Confidence bleibt unbekannt.
- Native-Fingerprint-Drift wird vor Baseline/Rebuild erklärt.

### `fam-mc71` — Bildnormalisierung

Laden:

- `src/features/ocr/capture/capture/image-picker.ts`
- `src/features/ocr/capture/capture/native-adapters.ts`
- `src/features/ocr/capture/capture/contracts.ts`
- `src/features/ocr/capture/capture/mime.ts`
- `src/features/ocr/capture/capture/constants.ts`
- zugehörige fokussierte Tests
- Expo SDK 57 ImagePicker und ImageManipulator

Prüfen:

- HEIC ist Eingang, JPEG das kanonische Arbeitsformat.
- EXIF-Orientierung, Lesbarkeit, Dimensionen und Bytegrenze werden geprüft.
- OCR und Upload verwenden dieselbe Datei.
- Temp-/Original-Cleanup ist symmetrisch.

### `fam-l4gc` — Layout und Parser

Laden:

- `src/features/ocr/processing/domain/**`
- Goldmanifest aus `fam-tyz6`
- Provider-Outputvertrag aus `fam-n6on`

Prüfen:

- pageIndex und Bounding-Boxes bleiben bis zur Zeilenrekonstruktion erhalten.
- Gruppenbildung ist rein und deterministisch.
- Barcodepräfixe, Mengen, Steuercodes und getrennte Spalten werden behandelt.
- Nicht-Artikel-Filter laufen vor Authority-Write.
- Kein React-, Expo-, Native- oder Storage-Import in der Domain.

### `fam-qt4m` — Draft und Resume

Laden:

- `src/features/ocr/capture/domain/**`
- `src/features/ocr/capture/api.ts`
- `src/features/ocr/capture/capture/upload-queue.ts`
- `src/lib/storage/account-storage.ts`
- Sign-out-/Accountwechsel-Cleanup-Muster

Prüfen:

- nur Metadaten im verschlüsselten Account-Store;
- Bilder als lokale Dateien;
- kein OCR-Rohtext;
- Resume pro Phase statt kompletter Neustart;
- Delete/Discard besitzt Cleanup-Gegenstück;
- Accountisolation ist getestet.

### `fam-3bzj` — Review und Save

Laden:

- `src/features/ocr/processing/review/**`
- `src/features/ocr/processing/workflow.ts`
- `src/features/ocr/authority/api.ts`
- vorhandenen Household-Store-Hook/API-Owner
- Receipt-Processing-i18n
- vor Teständerungen RNTL-Projektrichtlinien und Package-Dokumentation

Prüfen:

- add/edit/remove als reine Model-Operationen;
- stabile Item-IDs nach Änderungen;
- explizite bestehende Store-Auswahl;
- valide Pflichtwerte vor Save;
- Save entspricht dem Review, nicht dem ursprünglichen OCR-Draft;
- Asset-Uploadfehler bleibt retrybar.

### `fam-swdk` — reale Abnahme

Laden:

- alle drei Testbilder und Goldmanifest;
- aktuelle Bead-Nachweise der Vorgänger;
- `agent-device`-/Simulator-Skills und Native-Build-Workflow;
- keine Produktionsdateien.

Pro Plattform und Bild dokumentieren:

- Build/Fingerprint, OS/Gerät, `expo-ai-kit`-Version und native Engine;
- auf Android vorbereiteter und bestätigter Modellzustand;
- Offlinezustand während OCR, Review, Save und Relaunch;
- OCR nicht leer;
- Händler/Summe;
- Parserfilter;
- Reviewkorrektur;
- gespeicherte strukturierte Authority-Daten und private Asset-Behandlung;
- datumssortierte Historie und Artikelpreise nach Relaunch;
- unveränderter Inventory-/Fridge-/Shopping-List- und Outbox-Zustand;
- redigierte Evidenz.

### `fam-qgxy` — datumssortierte Receipt-Historie

Laden:

- `src/features/ocr/authority/**` für bestätigte Read-Model-Daten;
- lokale Receipt-/Item-Spiegel und bestehende Query-Owner;
- Processing-Spec: Receipt-Historie und Seiteneffektfreiheit;
- vor UI-Code die projektweite Mockup-/Auswahlregel.

Prüfen:

- Sortierung nach `purchase_date` absteigend mit stabilem Tie-Breaker;
- Übersicht mit Datum, Markt und Gesamtsumme;
- stabile Receipt-Route vom Verlauf in eine dauerhaft aufrufbare Detailansicht;
- Detail mit allen gespeicherten fachlichen Receipt-Feldern und allen
  bestätigten Items in Bonreihenfolge, einschließlich Menge und Preis;
- vorhandene private Bonbilder im Detail in Seitenreihenfolge als Vorschau
  anzeigen und bei Antippen vergrößert öffnen;
- Bildlöschung erhält die strukturierte Detailansicht;
- Offline-Lesbarkeit nach Relaunch;
- keine Inventory-, Fridge- oder Shopping-List-Schreibpfade und keine
  entsprechenden Outbox-Operationen;
- kein automatisches Zusammenführen wiederkehrender Artikelnamen.

Der Navigationvertrag ist entschieden: Bon erfassen bleibt in der
Einkaufsliste; Bon-Historie liegt unter
`Haushalt > Einstellungen > Bon-Historie`. Kein Dashboard-Einstieg, kein
zusätzlicher Bottom-Tab und kein zweiter Capture-Button.

## Source references

- Expo SDK 57 ImagePicker:
  <https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/>
- Expo SDK 57 ImageManipulator:
  <https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/>
- Expo Autolinking:
  <https://docs.expo.dev/modules/autolinking/>
- Google ML Kit Text Recognition v2:
  <https://developers.google.com/ml-kit/vision/text-recognition/v2/android>
- Expo AI Kit Vision:
  <https://expo-ai-kit.dev/guides/vision>
- installierte Provider-Dokumentation:
  `node_modules/expo-ai-kit/README.md`

## Context refresh rule

Nach einem Fehler nur Fehlermeldung, betroffene Funktion, direkten Vertrag und
fokussierten Test nachladen. Bei Wechsel des Beads den vorherigen Task-Kontext
verwerfen. Ein Build-/Uploadstatus ersetzt niemals die reale OCR-Matrix.
