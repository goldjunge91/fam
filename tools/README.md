# Experimente und Prototypen

`tools/` enthält unfertige Experimente und lokale Prototypen. Diese Programme
sind nicht Teil der App-Runtime, besitzen keine Stabilitätszusage und können
andere Voraussetzungen als die Expo-App haben.

## Grenze zum Produktcode

- App- und Runtime-Code darf nie aus `tools/` importieren. Das gilt für
  `src/`, `modules/`, `plugins/`, `targets/`, `supabase/functions/` und
  `app.config.ts`.
- Experimente dürfen App-Code importieren, wenn sie damit das echte Verhalten
  untersuchen. Der Category Debugger und `tools/classify.ts` nutzen diese
  Richtung bewusst.
- `package.json` und `justfile` dürfen lokale Einstiegspunkte anbieten. Dadurch
  wird das jeweilige Experiment nicht Teil der App-Runtime.
- Sobald ein Tool eigenständig nutzbar und nicht mehr experimentell ist, wird
  es in ein eigenes Repository ausgelagert. Es wird nicht in die App-Struktur
  verschoben.

Diese einseitige Grenze wird durch
`test/conventions/app-tools-boundary.test.ts` geprüft.

## Aktuelle Experimente

| Pfad | Zweck | Einstieg oder Prüfung | Verwendet App-Code |
| --- | --- | --- | --- |
| `tools/batch-import/` | Lokaler redaktioneller Import für den Rezeptkatalog | `bun --env-file=.env.development.local tools/batch-import/server.ts` | Nein |
| `tools/brochure-viewer/` | Lokaler Browser-Viewer für Prospekte und Hotspots | `bun --env-file=.env tools/brochure-viewer/server.ts` | Nein |
| `tools/build-gui/` | Lokale Oberfläche für Expo-, EAS- und native Build-Abläufe | `python3 tools/build-gui/build_gui.py` | Nein |
| `tools/category-debugger/` | Vite-Evaluationsumgebung für den Einkaufslisten-Classifier | `just debugger-category` | Ja, Classifier aus `src/` |
| `tools/classify.ts` | Ad-hoc-Trace für einzelne Classifier-Eingaben | `just classify "Haferdrink"` | Ja, Classifier aus `src/` |
| `tools/crawler/brochures/listing-only/` | Regionale Bring-Prospektmetadaten mit direkten CDN-URLs | `.github/workflows/update-brochures.yml` oder einzelne Phasen direkt | Nein |
| `tools/llm-test-platform/` | Isolierte Promptfoo- und ChainForge-Evaluation | `bun run --cwd tools/llm-test-platform eval` | Nein |
| `tools/product-search-lab/` | Experimentelle Suche im lokalen Open-Food-Facts-Dump | `bun tools/product-search-lab/server.ts` | Nein |
| `tools/receipt-ocr-tesseract/` | Lokaler Tesseract-Vergleich für Kassenbons | `bun run --cwd tools/receipt-ocr-tesseract web` | Nein |
| `tools/recipe-extraction/` | Konvertierung und Übersetzungsprüfung externer Rezeptdaten | Tests und Einstiegspunkte liegen direkt im Ordner | Nein |
| `tools/recipe-suggestion-prototype/` | Deterministischer Prototyp für Rezeptvorschlagsverträge | `node --test tools/recipe-suggestion-prototype/recipe-suggestion.test.mjs` | Nein |
| `tools/speech-to-text/` | macOS-Audiogenerator für Speech-to-Text-Versuche | `bun run tools/speech-to-text/core.test.ts` | Nein |

## Lokale Daten und Zugangsdaten

Experimente dürfen ihre eigenen ignorierten Abhängigkeiten, Caches, Reports und
Laufzeitdaten besitzen. Nicht reproduzierbare Daten werden nicht allein wegen
ihres Alters gelöscht. `.env`-Dateien, Tokens und Zugangsdaten bleiben lokal
und dürfen weder dokumentiert noch committed werden.

Die jeweilige Unterordner-Dokumentation beschreibt Voraussetzungen und
spezifische Befehle. Bei einem Widerspruch gelten der aktuelle Quellcode,
`package.json`, `justfile` und die zugehörigen Tests.
