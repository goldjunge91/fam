# Plan: Händlerregeln im Receipt-OCR-Parser trennen

Status: geplant, Beads `fam-6t68`
Übergeordneter Receipt-Plan: [Receipt-OCR-plan.md](Receipt-OCR-plan.md)
Task-System: Beads. Es wird kein `tasks/todo.md` angelegt.

## Ziel

Die gemeinsamen Regeln für deutsche Receipts bleiben in einem gemeinsamen
Parser. Händlerregeln erhalten einen eigenen Owner und werden nur nach
Erkennung des passenden Händlers angewendet. Der bestehende Einstieg
`parseGermanReceipt` und der Rückgabetyp `ReceiptDraft` bleiben stabil.

Die Aufteilung folgt belegtem Verhalten: ROSSMANN hat bereits eigene
Preisartefakt- und Textregeln. Für EDEKA ist bislang die Alias-Erkennung von
`EEDEKA` belegt, aber kein eigenständiger Parsingablauf. Weitere Händler
erhalten erst dann ein eigenes Modul, wenn ein reproduzierbarer Sonderfall
vorliegt. Es entstehen keine leeren Parserdateien für alle erkannten Märkte.

## Kontext und Ist-Zustand

- `src/features/ocr/processing/domain/parser.ts` normalisiert die Eingabe,
  erkennt den Markt, parst Datum und Summen und ruft die gemeinsame
  Artikelverarbeitung auf.
- `src/features/ocr/processing/domain/parser/retailers.ts` enthält sowohl
  Markt-Aliase als auch `normalizeRossmannArtifacts`.
- `src/features/ocr/processing/domain/parser/items.ts` enthält zusätzlich eine
  ROSSMANN-Bedingung für das `C0.`-Fragment bei Barcodezeilen.
- `src/features/ocr/processing/domain/parser.test.ts` hat bereits
  ROSSMANN-only Reparaturfälle und Gegenprüfungen mit EDEKA und REWE.
- `layout.ts` rekonstruiert OCR-Zeilen anhand ihrer Geometrie und bleibt in
  diesem Plan händlerunabhängig.
- Der verfügbare Händlerkorpus belegt zwei EDEKA-Receipts, einen ROSSMANN-Beleg
  und einen synthetischen REWE-Fall. Die Menge belegt noch keine eigenen Regeln
  für alle unterstützten Märkte.

## Architekturentscheidungen

1. **Stabiler Parser-Einstieg.** `parseGermanReceipt(ParserInput): ReceiptDraft`
   bleibt der Aufruf für den Workflow. Die Aufteilung ändert die API nicht.
2. **Gemeinsame Basis, konkrete Händlermodule.** Datums-, Geld-, Summen- und
   allgemeine Artikelregeln bleiben gemeinsam. Eine einfache explizite Auswahl
   wendet nur belegte Händlerregeln an. Es gibt keine Registry und kein
   Plugin-System.
3. **ROSSMANN zuerst.** Preisreparatur und weitere ROSSMANN-spezifische
   Artikelkorrekturen werden zusammen in einem ROSSMANN-Owner gehalten. Der
   gemeinsame Artikelparser enthält danach keine ROSSMANN-Fallunterscheidungen.
4. **EDEKA nach Evidenz.** Die Erkennung von `EEDEKA` bleibt eine
   Händleralias-Regel. Ein `edeka.ts`-Parser entsteht nur, falls der Vergleich
   echter Fälle eine eigene, reproduzierbare Parsingregel zeigt.
5. **Geometrie bleibt gemeinsam.** `layout.ts` arbeitet auf OCR-Geometrie und
   Textfragmenten, nicht auf einer Händlerauswahl. Diese Verantwortung wird
   hier nicht verschoben. Die eigene deterministische Layoutaufgabe ist in
   [Receipt-OCR-plan.md](Receipt-OCR-plan.md) und Bead `fam-iird.8` erfasst.
6. **Providerneutrale Eingabe.** Der Parser verarbeitet weiter `ParserInput`.
   Sowohl MLKit als auch der weitere OCR-Provider können denselben Parser
   verwenden, sofern ihre Adapter die bestehende Eingabeform liefern. Die
   Entscheidung, beide Provider einzubauen oder einen auszuwählen, gehört
   nicht zu diesem Parser-Split.

## Erhalt der OCR-Funktionskommentare

Die nummerierten Funktionskommentare im OCR-Pfad bilden den Ablauf vom
normalisierten Bild bis zum ReceiptDraft ab. Sie bleiben bei Parsertrennung,
Verschiebungen und Refactorings erhalten. Ändert sich Reihenfolge oder Owner,
werden Kommentartext und Nummerierung mitgeführt; beim Ersetzen oder
Zusammenführen einer Funktion wird der erklärende Inhalt an den verbleibenden
Owner übertragen. Die Kommentare werden nicht ersatzlos gelöscht.

## Reihenfolge und Beads

Die Beads sind die maßgebliche Aufgabenliste. Dieser Abschnitt ist der
geordnete Index, keine zweite Aufgabenwahrheit.

| Reihenfolge | Bead | Arbeit | Abhängigkeit |
| --- | --- | --- | --- |
| 1 | `fam-6t68.1` | ROSSMANN-Regeln in einen Händler-Owner auslagern; gemeinsame Artikelverarbeitung erhalten | keine |
| 2 | `fam-6t68.2` | Reale EDEKA-Fälle prüfen und nur bei belegter Abweichung ein EDEKA-Modul ergänzen | `fam-6t68.1` |

### Checkpoint nach `fam-6t68.1`

- Parser-Domain-Tests zeigen unveränderte ROSSMANN-Ergebnisse.
- EDEKA, REWE und ein nicht erkannter Markt erhalten keine ROSSMANN-Reparatur.
- `parseGermanReceipt` und `ReceiptDraft` bleiben unverändert.

### Checkpoint nach `fam-6t68.2`

- Für eine EDEKA-Regel gibt es eine reproduzierbare Eingabe und einen
  fokussierten Test; oder die Entscheidung gegen ein eigenes EDEKA-Modul ist
  mit dem Vergleich in Beads dokumentiert.
- Gemeinsame Artikel-, Summen- und Datumsregeln bleiben über Händlertests
  stabil.
- Jede weitere Händlersonderregel folgt demselben Evidenzmaßstab.

## Verifikation

Implementierungsschritte verwenden die fokussierten Parser-Domain-Tests sowie
`bun run check` und `bun run typecheck`. Für Parseränderungen allein ist kein
nativer Harnesslauf erforderlich. Native OCR-Abnahme bleibt in den separaten
Receipt-OCR-Gates.

Zu prüfen sind mindestens ROSSMANN, EDEKA, REWE und unbekannter Händler. Die
Rossmann-Artefakte müssen nur bei ROSSMANN repariert werden; gemeinsame Fälle
müssen dieselben Artikel- und Summenwerte liefern.

## Risiken und Grenzen

| Risiko | Auswirkung | Begrenzung |
| --- | --- | --- |
| Synthetische Zeilen lassen sich mit echtem OCR-Verhalten verwechseln | Unbelegte Händlersonderregeln | Für neue Regeln einen realen, datensparsamen reproduzierbaren Fall verlangen |
| Marktalias und Parserregel werden vermischt | Händlererkennung erhält ungewollte Parsinglogik | Alias-Erkennung zentral halten und Parsingkorrekturen im Händler-Owner halten |
| Parser-Split wird mit OCR-Providerwahl vermischt | Scope und Tests werden unnötig gekoppelt | Gemeinsame `ParserInput`-Grenze beibehalten; Providerentscheidung separat führen |

## Offene, getrennte Providerfrage

Der aktuelle Arbeitskontext enthält eine MLKit-Implementierung. Der bestehende
Receipt-Vertrag behauptet dagegen, `expo-ai-kit` sei der einzige Provider und
MLKit sei nicht installiert. Diese Vertragsabweichung ist für den Parser-Split
keine Voraussetzung und wird hier nicht entschieden. Vor weiterer
Providerintegration oder -auswahl muss der Receipt-Vertrag separat mit dem
tatsächlichen Stand abgeglichen werden.

## Source-driven Basis

Der Projektstack aus `package.json` verwendet TypeScript `~6.0.3`. Die
TypeScript-Handbook-Dokumentation beschreibt ES-Module über `import` und
`export` und hält Modulnamen im Dateiscope, solange sie nicht exportiert werden.
Der Plan bleibt bei diesen nativen Sprachmodulen und führt kein zusätzliches
Dispatch-Framework ein: [TypeScript Handbook: Modules](https://www.typescriptlang.org/docs/handbook/2/modules.html#how-javascript-modules-are-defined).
