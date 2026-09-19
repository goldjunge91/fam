# Recherche: Parsing natürlicher Einkaufsartikel verbessern

Stand: 18. September 2026  
Scope: V2-Beta `natuerliches-hinzufuegen-von-einkaufsartikeln`, lokaler
deutscher Parser, Spracheingabe über den vorhandenen Adapter und iPhone-11-
Simulator `4B293FA5-24E8-4BF4-8295-3EF2D6C50F7D` mit iOS 26.2.

## Kurzentscheidung

Der nächste Schritt sollte kein allgemeines KI-Parsing und keine neue NLP-
Bibliothek sein. Die beste erste Ausbaustufe ist ein hybrider, lokaler Parser:

1. Transcript normalisieren, ohne semantische Information zu löschen.
2. Artikelgrenzen aus mehreren schwachen Signalen als Kandidaten erzeugen.
3. Kandidatensegmente mit einer kleinen deutschen Einkaufsgrammatik in Slots
   zerlegen: `name`, `quantity`, `unit`, `brand` und später optional
   `store`.
4. Lokale Produkt-/Markenlexika für Erkennung, Aliasauflösung und ASR-Kontext
   verwenden.
5. Unsicherheit, Alternativen und unparsed text sichtbar halten.
6. Simulatoraufnahmen als Fixtures speichern, aber die Parseriteration mit
   schnellen deterministischen Tests ausführen.

Diese Reihenfolge passt zur Beta-Grenze: Sie bleibt lokal, deterministisch,
offline-fähig und sicher vor falschen Listen-Schreibvorgängen.

## Aktueller Baseline-Befund im Repository

Der bestehende Parser unter
`src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/parser.ts`
ist ein sinnvoller Baseline-Parser, aber noch ein sehr enger Regex-Cascade:

- Segmentierung erfolgt über Komma, Semikolon, Zeilenumbruch, `und` und
  Satzzeichen.
- Mengen sind führende arabische Zahlen mit optionalem `x` sowie die deutschen
  Zahlwörter eins bis zehn.
- Einheiten werden nur als erstes Token nach der Menge erkannt.
- Marken werden über `von ...` oder ein führendes Großbuchstabenmuster erkannt.
- Die Ausgabe enthält Artikel, Menge, Einheit, Marke und einen Resttext, aber
  noch keine Parserdiagnostik oder Feldkonfidenz.

Der Sprachadapter unter
`src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/services/speech-recognition-adapter.ts`

- fordert `maxAlternatives: 3` an,
- übernimmt anschließend aber nur `event.results[0]`,
- setzt noch keine `contextualStrings`,
- transportiert finale Speech-Segmente zwar in den Workflow,
- übergibt dem Parser aktuell ausschließlich den finalen Text.

Das sind konkrete, kleine Hebel. Sie rechtfertigen noch kein neues lokales
Modell.

## Befund 1: Speech-Ergebnis als Evidenz, nicht als fertige Artikelliste

Apple beschreibt `SFSpeechRecognitionResult` als Container für eine oder
mehrere Transkriptionen, die nach Konfidenz sortiert werden können. Ein Ergebnis
enthält außerdem den finalen/nicht-finalen Status.

Quelle: [Apple `SFSpeechRecognitionResult`](https://developer.apple.com/documentation/speech/sfspeechrecognitionresult)

Apple beschreibt `SFTranscriptionSegment` als erkannte Einheit mit Text,
Alternativinterpretationen, Konfidenz sowie Startzeit und Dauer.

Quelle: [Apple `SFTranscriptionSegment`](https://developer.apple.com/documentation/speech/sftranscriptionsegment)

Das aktuelle `expo-speech-recognition`-Paket bietet dafür
`maxAlternatives`, `contextualStrings` und finale Ergebnis-Segmente an.

Quelle: [expo-speech-recognition README](https://github.com/jamsch/expo-speech-recognition#readme)

### Übertragbarkeit

- Die beste Transkription darf nicht die einzige intern verwertete Evidenz sein.
- Für die erste Version reicht es, Alternativen und Segmentdaten intern zu
  behalten und nur bei niedriger Parserqualität als Kandidaten zu vergleichen.
- Segmentgrenzen sind starke Hinweise für Pausen oder erkannte Einheiten, aber
  nicht automatisch Artikelgrenzen.
- Start- und Endzeiten können eine Pause zwischen `Milch` und `Eier` als
  zusätzliches, weiches Signal liefern.

Apple beschreibt `addsPunctuation` nur als automatische Einfügung von Punkt,
Fragezeichen und Komma. Daraus folgt: Satzzeichen können ein Grenzsignal sein,
aber keine verlässliche semantische Artikeltrennung.

Quelle: [Apple `addsPunctuation`](https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/addspunctuation)

## Befund 2: Kontextvokabular ist der schnellste ASR-Hebel

Apple unterstützt mit `contextualStrings` kurze, app-spezifische Phrasen,
etwa Produkt- oder Markennamen. Apple empfiehlt kurze Einträge von möglichst
ein bis zwei Wörtern und begrenzt die Liste auf höchstens 100 Phrasen pro
Request.

Quelle: [Apple `contextualStrings`](https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/contextualstrings)

Das vorhandene Paket reicht diese Option an iOS weiter und unterstützt eine
entsprechende Biasing-Liste auch auf unterstützten Android-Versionen.

Quelle: [expo-speech-recognition options](https://github.com/jamsch/expo-speech-recognition#readme)

### Empfehlung

Vor dem Start einer Speech-Session aus dem lokalen Haushaltskontext höchstens
die relevantesten Artikel- und Markennamen auswählen:

- häufige Artikel aus den vorhandenen Einkaufslisten,
- bekannte Marken aus bestätigten Zuordnungen,
- lokale Aliasformen und typische ASR-Schreibvarianten.

Nicht den gesamten Katalog blind in den Request geben. Die Vorschlagsliste
beeinflusst nur die Transkription. Sie darf niemals allein eine automatische
Listenwahl oder einen produktiven Schreibvorgang auslösen.

## Befund 3: Das Problem ist strukturell Slot Filling

Die Spoken-Language-Understanding-Literatur modelliert die Aufgabe als
Slot-Filling: Wörter oder Spans werden semantischen Feldern zugeordnet. Typische
Slots sind hier `quantity`, `unit`, `item` und `brand`. Forschungsarbeiten
zeigen außerdem, dass Slot Filling und die Erkennung der Gesamtabsicht
zusammenhängen und gemeinsame Modelle die gegenseitigen Hinweise nutzen können.

Quellen:

- [Zhang et al., ACL 2019: Joint Slot Filling and Intent Detection via Capsule Neural Networks](https://aclanthology.org/P19-1519/)
- [Liu und Lane, 2016: Joint Online Spoken Language Understanding and Language Modeling](https://aclanthology.org/W16-3603/)

Für die V2 brauchen wir daraus zunächst kein trainiertes JointBERT- oder
Capsule-Modell. Die geeignete Übertragung ist das Datenmodell:

```text
Eingabe
  -> normalisierte Tokens/Spans
  -> Kandidaten für Menge, Einheit, Produktname, Marke
  -> strukturierter Artikel
  -> Routing und Bestätigung
```

Die Parsergrammatik sollte nicht versuchen, beliebige deutsche Sätze zu
verstehen. Sie sollte typische Einkaufsformen vollständig und erklärbar
behandeln und alles andere als sichtbaren Rest oder unsicheren Kandidaten
zurückgeben.

## Befund 4: Gewichtet segmentieren statt an beliebigen Leerzeichen zu teilen

Gewichtete endliche Automaten zeigen ein passendes allgemeines Verfahren:
alternative Pfade werden durch Komposition verbunden, Gewichte können
Wahrscheinlichkeiten oder Kosten ausdrücken, und ein Shortest-Path-Schritt
wählt den besten Pfad.

Quelle: [OpenFst Quick Tour](https://github.com/google-research/openfst/blob/main/docs/quick_tour.md)

Für diese App bedeutet das keine neue OpenFst-Abhängigkeit. Die gleiche Idee
kann als kleine dynamische Programmierung in TypeScript umgesetzt werden:

1. Mögliche Schnitte an Satzzeichen, `und`, erkannten Mengenstarts,
   Speech-Pausen und bekannten Katalogspans erzeugen.
2. Jedes Kandidatensegment mit der Einkaufsgrammatik parsen.
3. Jede Zerlegung mit strukturellen Treffern, Speech-Konfidenz, Pausenstärke
   und Resttextkosten bewerten.
4. Den besten Pfad wählen oder die besten zwei bis drei Pfade behalten, wenn
   die Scores nahe beieinander liegen.
5. Nahe Alternativen in die Preview geben, statt eine unsichere Grenze zu
   verstecken.

Die aktuelle harte Regel `split(/und/)` kann damit ein starkes Signal bleiben,
aber durch eine bessere Mengen-/Produktstruktur überstimmt werden.

## Befund 5: Zahlen und Einheiten brauchen eine eigene Normalisierungsstufe

Die Forschung zur Number Normalization beschreibt finite-state-basierte
Lösungen als datenarm und besonders geeignet, wenn falsche Zahlenwerte
schädlich sind. Die Verfahren sind invertierbar und können gesprochene
Zahlformen in schriftliche Zahlen überführen.

Quelle: [Sproat und Jaitly, 2016: Minimally Supervised Number Normalization](https://aclanthology.org/Q16-1036.pdf)

Die Zahlenlogik sollte vor der Artikelgrammatik als eigener reiner Baustein
stehen und mindestens diese Klassen testen:

- arabische Zahlen mit deutschem Dezimalkomma,
- `x` und `mal` als Multiplikator,
- Zahlwörter über zehn und zusammengesetzte Zahlwörter,
- Bruchteile wie `eine halbe` und `ein halbes`,
- Mengen plus Einheit in Varianten wie `zwei Liter Milch`,
  `Milch zwei Liter` und `zwei Packungen Joghurt`,
- Singular-/Pluralvarianten von Einheiten,
- erkannte ASR-Varianten wie `Stück`, `Stk` und `Stueck`.

Jede Zahl muss eine deterministische Normalisierung oder einen sichtbaren
Unsicherheitsstatus liefern. Eine vermutete Zahl darf nicht stillschweigend die
Menge eines realen Listenartikels ändern.

## Befund 6: Lokales Lexikon statt allgemeiner Entity-NER

Rule-based Entity Recognition ist passend, wenn eine endliche oder kontrollierte
Terminologieliste existiert. Ein Gazetteer kann exakte und mehrwortige Phrasen
case-insensitive finden; längere überlappende Treffer werden bevorzugt.

Quellen: [spaCy Rule-based Matching](https://spacy.io/usage/rule-based-matching) und [EntityRuler API](https://spacy.io/api/entityruler)

Die App sollte dafür keine spaCy-Abhängigkeit einführen. Die übertragbare Idee
ist ein kleiner TypeScript-Gazetteer mit kanonischem Namen, Aliasen, Typ
`product` oder `brand`, optionaler lokaler Produkt-ID, Priorität und
Mehrdeutigkeit.

Open Food Facts kann später als Quelle zur Offline-Anreicherung von Aliasen und
Produktmetadaten dienen. Es ist kein guter Laufzeit-Fallback für jedes
Transcript: Die offizielle API nennt Rate Limits, und die v2-Suche bietet keine
allgemeine Full-Text-Suche.

Quelle: [Open Food Facts API-Dokumentation](https://openfoodfacts.github.io/openfoodfacts-server/api/)

## Befund 7: Robustheit muss aus echten Speech-Varianten kommen

Eine Studie zu umgangssprachlichen deutschen Varianten zeigt, dass
Slot-Erkennung deutlich stärker leiden kann als reine Intent-Erkennung. Eine
weitere Arbeit schlägt Back-Transcription und feingranulare Fehlerklassen vor,
um NLU-Robustheit gegenüber ASR-Fehlern zu bewerten.

Quellen:

- [Artemova et al., EACL 2024: Exploring the Robustness of Task-oriented Dialogue Systems for Colloquial German Varieties](https://aclanthology.org/2024.eacl-long.28/)
- [Kubis et al., EMNLP 2023: Back Transcription as a Method for Evaluating Robustness](https://aclanthology.org/2023.emnlp-main.724/)

Jede Testzeile sollte eine goldene Struktur und die Eingangsart tragen:

- getippter Text,
- Simulator-Transcript ohne Satzzeichen,
- Transcript mit Pausen-/Segmentdaten,
- ASR-Variante mit Zahl- oder Markenverwechslung,
- Umgangssprache und Füllwörter,
- Korrektur oder Selbstreparatur,
- ein, zwei, viele Artikel,
- konfliktträchtige Namen und Marken.

Wichtige Metriken sind:

- Artikelgrenzen: Precision, Recall und F1,
- Feldgenauigkeit für Name, Menge, Einheit und Marke,
- vollständige Frame-Genauigkeit pro Artikel,
- Anteil sichtbarer Resttexte,
- falsche automatische Listen-Schreibvorgänge, Zielwert null im Reviewpfad,
- mediane Parse-Zeit und Zeit bis zur Preview.

## Empfohlene Reihenfolge für den nächsten Plan

### Phase 0: Baseline mit dem funktionierenden Simulator

- iPhone 11 / iOS 26.2 als reproduzierbares Speech-Referenzziel festhalten.
- Eine feste kleine Testsammlung sprechen: einfache Artikel, Mengen, Einheiten,
  Marken, Pausen, `und`, unpunktierte lange Eingaben und Korrekturen.
- Pro Eingabe Transcript, finale Segmente, Zeitspannen und Konfidenzen als
  lokale Entwicklungsfixture erfassen.
- Für jede Audioaufnahme zusätzlich den getippten Goldtext und die erwartete
  strukturierte Ausgabe pflegen.

### Phase 1: Parser-Benchmark vor Verhaltenserweiterung

- Aktuellen Parser unverändert gegen die Sammlung ausführen.
- Fehler nach Ursache klassifizieren: Grenze, Zahl, Einheit, Marke, ASR oder
  unklarer Rest.
- Eine kleine Regressionstabelle erstellen, die jeden Fix gegen Baseline und
  Sicherheitsregeln prüft.

### Phase 2: Deterministischer Parser v2

- Normalisierung und Zahlen-/Einheitengrammatik extrahieren.
- Gazetteer für lokale Produkte, Marken und Aliasformen ergänzen.
- Kandidaten-Segmentierung mit weichen Grenzsignalen und konservativem Scoring
  einführen.
- Output zunächst kompatibel halten; Diagnostik optional separat ergänzen.

### Phase 3: Speech-Evidenz anschließen

- `contextualStrings` aus dem relevanten lokalen Lexikon befüllen.
- N-best-Transcripts nicht mehr sofort auf `results[0]` reduzieren.
- Segmentzeiten und Konfidenzen in die Kandidatenbewertung geben.
- Alternativen nur bei echter Ambiguität in der Preview zeigen.

### Phase 4: Simulator- und Fixture-Gate

- Jeden Parserfix zuerst mit `bun run test <gezielte-datei>` prüfen.
- Den iPhone-11-Simulator nur für neue Speech-Fixtures und wenige End-to-End-
  Smoke-Flows verwenden.
- Vor der nächsten nativen Auslieferung Parser-Metriken und
  Preview-/Bestätigungsfluss gemeinsam prüfen.

## Nicht als nächsten Schritt empfehlen

- keine Cloud-LLM-Interpretation im Parser,
- keine Live-Abfrage von Open Food Facts pro Spracheingabe,
- keine automatische Trennung an beliebigen Leerzeichen,
- keine harte Nutzung von Speech-Pausen als Artikelgrenze,
- kein Fuzzy-Matching ohne Katalogkontext und Unsicherheitsanzeige,
- kein neues natives Modell, bevor die deterministische Baseline mit echten
  Simulator-Transcripts gemessen ist.

## Quellen und Grenzen

Die Aussagen zu Apple Speech, `contextualStrings`, Alternativen, Segmentdaten
und Satzzeichen stammen aus Apples Dokumentation beziehungsweise der
Paketdokumentation. Die Aussagen zu Slot Filling, Number Normalization,
umgangssprachlicher Robustheit und ASR-Evaluierung stammen aus den jeweils
verlinkten Originalarbeiten. Die Empfehlung, daraus einen kleinen
TypeScript-Kandidatenparser statt einer OpenFst- oder spaCy-Laufzeitabhängigkeit
zu bauen, ist eine Architektur-Inferenz für dieses Repository.
