# Recherche: Parsing natürlicher Einkaufsartikel verbessern

Bericht erstellt: 18. September 2026
Repository-Abgleich: 6. Oktober 2026
Scope: V2-Beta `natuerliches-hinzufuegen-von-einkaufsartikeln`, lokaler
deutscher Parser und Spracheingabe über den vorhandenen Adapter. Der im
ursprünglichen Testlauf verwendete iPhone-11-Simulator ist historischer Kontext;
sein aktueller Zustand wurde bei diesem Abgleich nicht erneut geprüft.

## Kurzentscheidung

Der nächste Schritt sollte kein allgemeines KI-Parsing und keine neue NLP-
Bibliothek sein. Die beste erste Ausbaustufe ist ein hybrider, lokaler Parser:

1. Transcript normalisieren, ohne semantische Information zu löschen.
2. Artikelgrenzen aus mehreren schwachen Signalen als Kandidaten erzeugen.
3. Kandidatensegmente mit einer kleinen deutschen Einkaufsgrammatik in Slots
   zerlegen: `name`, `quantity`, `unit` und `brand`; die Listenwahl bleibt ein
   nachgelagerter Routing-Schritt.
4. Lokale Produkt-/Markenlexika für Erkennung, Aliasauflösung und ASR-Kontext
   verwenden.
5. Unsicherheit, Alternativen und unparsed text sichtbar halten.
6. Simulatoraufnahmen als Fixtures speichern, aber die Parseriteration mit
   schnellen deterministischen Tests ausführen.

Diese Reihenfolge passt zur Beta-Grenze: Sie bleibt lokal, deterministisch,
offline-fähig und sicher vor falschen Listen-Schreibvorgängen.

## Aktueller Baseline-Befund im Repository

Der aktuelle Parser liegt in
[`src/features/shopping-list/stt-beta/domain/parser.ts`](../../../src/features/shopping-list/stt-beta/domain/parser.ts).
Er ist ein deterministischer Regex-Parser mit diesen belegten Regeln:

- Er normalisiert den Eingang auf NFC, entfernt einen begrenzten Satz an
  Spracheinleitungen und schützt Dezimalzeichen sowie `z. B.`/`stk.` vor dem
  Segmentieren.
- Artikelgrenzen entstehen an Komma, Semikolon, Zeilenumbruch, `und`, Satzende
  und zusätzlichen erkannten Mengenstarts. Gewöhnliche Leerzeichen allein
  trennen nicht. Ein Test hält das absichtlich zusammengeführte Beispiel
  `Apfelkuchen nehme ich Eier Wasser` fest.
- Mengen umfassen führende Dezimalzahlen, `x`/`×`, `ein`/`eine`/`einen`, die
  Zahlwörter `zwei` bis `zwölf`, `zweihundert`, `fünfhundert` sowie
  `halbe`/`halbes` mit optionalem `ein` in der konkreten Regexform. `mal`,
  zusammengesetzte Zahlwörter wie `fünfzehn` und die Form `eine halbe` sind
  nicht abgedeckt.
- Eine Einheit wird nur als erstes Token nach der Menge erkannt. Aliase wie
  `Liter`, `kg`, `Stück`, `Stk`, `Packung`, `Becher`, `Dose` und ihre im Parser
  definierten Varianten werden über `normalizeUnit` abgebildet.
- Eine Marke wird durch ein Suffix `von ...` oder ein führendes Token in
  Großbuchstaben erkannt. Die Schreibweise nach `von` wird nicht kanonisiert;
  z. B. bleibt `ja` kleingeschrieben, wenn es so erkannt wird.
- `ParseResult` enthält nur `items` mit `name`, `quantity`, `unit`, `brand`
  und `unparsedText`. Es gibt weder Feldkonfidenz noch eine Liste von
  Parseralternativen. Nicht erkannte Segmente werden gesammelt und mit Komma
  verbunden; das ist nicht dasselbe wie eine exakte Span-Abbildung auf die
  ursprüngliche Eingabe. Die Optimierungs-Spec verlangt einen exakt erhaltenen
  Rohspan; dieser Anspruch ist durch den Istcode nicht für beliebige
  Segmentierungen erfüllt. Bei mehreren unbekannten Segmenten werden etwa
  unterschiedliche Original-Trennzeichen auf Kommas vereinheitlicht.
- Ein semantisch falsches, aber syntaktisch gültiges Wort kann als Artikelname
  durchlaufen. Deshalb beweist `unparsedText: null` nicht die semantische
  Richtigkeit.

Die vorhandenen Tests in
[`parser.test.ts`](../../../src/features/shopping-list/stt-beta/domain/parser.test.ts)
belegen die Beispiele `3 Äpfel`, `3x Joghurt`, `1,5 Liter Milch`, `ein halbes
Kilo Mehl`, `zwei Packungen Nudeln`, `4x Skyr von JA`, Satzzeichen und
unpunktierte Mengenstarts. Sie sind die bestehende deterministische Baseline,
nicht der Nachweis für vollständiges Sprachverständnis.

Die Strukturbeispiele in der V2- und Optimierungs-Spec zeigen weiterhin den
früheren Feature-Pfad
`src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/`.
Für den Iststand ist `src/features/shopping-list/stt-beta/` der vorhandene
Quellpfad; die Specs werden in diesem Report nicht geändert.

Der Adapter liegt in
[`speech-recognition-adapter.ts`](../../../src/features/shopping-list/stt-beta/services/speech-recognition-adapter.ts);
`bun.lock` pinnt `expo-speech-recognition` auf `57.1.0`. Der aktuelle Code:

- setzt `maxAlternatives: 1`, nicht `3`,
- setzt die statische `CONTEXTUAL_STRING_LIST` mit `Skyr`, `Passata`,
  `Kidneybohnen` und `Erythrit`, nicht ein aus dem Haushaltskatalog
  abgeleitetes Lexikon,
- übernimmt nur das erste finale `event.results[0]` und hängt finale
  Transcript-Chunks zusammen,
- liest dabei weder `confidence` noch `segments` aus und übergibt dem Parser
  ausschließlich den finalen Text,
- setzt derzeit `requiresOnDeviceRecognition: false`.

Der letzte Punkt widerspricht der freigegebenen V2-Spec, die
`requiresOnDeviceRecognition: true` und einen Nichtverfügbarkeitszustand statt
Netzwerk-Fallback verlangt. Die Optimierungs-Spec beschreibt außerdem einen
Baseline-/Kontextstring-A/B-Lauf, während der inspizierte Adapter die statische
Kontextliste immer aktiviert und keine Variantenoption hat. Das sind
Vertragsabweichungen, keine Empfehlung dieses Berichts, den Vertrag zu ändern.
Vor einer nativen ASR-Auswertung müssen sie mit dem zuständigen Owner geklärt
werden.

## Befund 1: Speech-Ergebnis als Evidenz, nicht als fertige Artikelliste

Apple beschreibt `SFSpeechRecognitionResult` als Container für eine oder
mehrere Transkriptionen derselben Äußerung, absteigend nach Konfidenz sortiert.
`isFinal` unterscheidet partielle von finalen Ergebnissen.

Quelle: [Apple `SFSpeechRecognitionResult`](https://developer.apple.com/documentation/speech/sfspeechrecognitionresult)

Apple beschreibt `SFTranscriptionSegment` als erkannte Einheit mit Text,
Alternativinterpretationen, Konfidenz sowie Startzeit und Dauer.

Quelle: [Apple `SFTranscriptionSegment`](https://developer.apple.com/documentation/speech/sftranscriptionsegment)

Die im Projekt gelockte Version `expo-speech-recognition@57.1.0` bietet
`maxAlternatives`, `contextualStrings`, Result-Konfidenz und Segmentdaten an.
Diese Felder sind im aktuellen Adapter verfügbar, werden aber nicht in den
Parser-Workflow übernommen. Die Segmentfelder sind plattformabhängig: Laut
Pakettypdefinition sind Android-Segmente erst ab API 34 beschrieben, nur für
den Google-Sprachdienst verifiziert und haben derzeit keine Segmentkonfidenz.

Quelle: [expo-speech-recognition 57.1.0 README](https://github.com/jamsch/expo-speech-recognition/blob/v57.1.0/README.md) und [Result-Typen](https://github.com/jamsch/expo-speech-recognition/blob/v57.1.0/src/ExpoSpeechRecognitionModule.types.ts)

### Übertragbarkeit

- Die Dokumentation zeigt, dass N-best-Transkriptionen möglich sind; sie
  beweist nicht, dass sie für Einkaufsartikel genauer sind. Mit dem aktuellen
  `maxAlternatives: 1` fordert die App diese Evidenz nicht an.
- Segmentzeiten, Text und Konfidenz könnten intern als Zusatzmerkmale
  ausgewertet werden. Erst ein gepaarter Test kann zeigen, ob das die
  Artikelgrenzen verbessert.
- Segmentgrenzen markieren erkannte Spracheinheiten, nicht Einkaufsartikel.
  Eine Sprechpause muss aus dem Abstand zwischen Endzeit und nächster Startzeit
  abgeleitet werden und bleibt ein weiches Signal.

Apple beschreibt `addsPunctuation` als automatische Einfügung von Punkt oder
Fragezeichen am Satzende sowie Komma innerhalb eines Satzes. Daraus folgt:
Satzzeichen können ein Grenzsignal sein, aber keine verlässliche semantische
Artikeltrennung.

Quelle: [Apple `addsPunctuation`](https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/addspunctuation)

## Befund 2: Kontextvokabular ist ein prüfbarer ASR-Hebel

Apple unterstützt mit `contextualStrings` kurze, app-spezifische Phrasen,
etwa Produkt- oder Markennamen, und beschreibt eine höhere Erkennungs-
wahrscheinlichkeit als Zweck. Apple empfiehlt kurze Einträge von möglichst
ein bis zwei Wörtern und begrenzt die Liste auf höchstens 100 Phrasen pro
Request. Das belegt eine verfügbare Stellschraube, nicht deren Rang als
schnellster oder wirksamster Hebel für diesen Parser.

Quelle: [Apple `contextualStrings`](https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/contextualstrings)

Das vorhandene Paket reicht diese Option an iOS weiter und unterstützt eine
entsprechende Biasing-Liste auch auf unterstützten Android-Versionen.

Quelle: [expo-speech-recognition 57.1.0 README](https://github.com/jamsch/expo-speech-recognition/blob/v57.1.0/README.md)

### Empfehlung

Als späteres Experiment höchstens relevante Artikel- und Markennamen auswählen:

- häufige Artikel aus den vorhandenen Einkaufslisten,
- bekannte Marken aus bestätigten Zuordnungen,
- lokale Aliasformen und typische ASR-Schreibvarianten.

Nicht den gesamten Katalog blind in den Request geben. Die Phrase-Liste darf
nicht als Beleg für eine richtige Produkt- oder Listenentscheidung gelten.
Außerdem legt die freigegebene Optimierungs-Spec einen gepaarten Vergleich mit
einer festen Version der Kontextliste fest. Haushaltsdynamische Listen wären
eine andere Versuchsvariable und müssten separat freigegeben werden.

## Befund 3: Das Problem ist strukturell Slot Filling

Die Spoken-Language-Understanding-Literatur modelliert die Aufgabe als
Slot-Filling: Wörter oder Spans werden semantischen Feldern zugeordnet. Typische
Slots sind hier `quantity`, `unit`, `item` und `brand`. Forschungsarbeiten
zeigen außerdem, dass Slot Filling und die Erkennung der Gesamtabsicht
zusammenhängen und gemeinsame Modelle die gegenseitigen Hinweise nutzen können.

Quellen:

- [Zhang et al., ACL 2019: Joint Slot Filling and Intent Detection via Capsule Neural Networks](https://aclanthology.org/P19-1519/)
- [Liu und Lane, 2016: Joint Online Spoken Language Understanding and Language Modeling](https://aclanthology.org/W16-3603/)

Für die V2 brauchen wir daraus zunächst kein trainiertes NLU-Modell. Die
begrenzte Übertragung ist das Datenmodell und eine getrennte Bewertung der
Slots:

```text
Eingabe
  -> normalisierte Tokens/Spans
  -> Kandidaten für Menge, Einheit, Produktname, Marke
  -> strukturierter Artikel
  -> Routing und Bestätigung
```

Die Arbeiten belegen allgemeine NLU-Modelle, nicht die Güte einer
Einkaufsparser-Implementierung. Für diese lokale V2 sind sie Motivation für
separat messbare Felder und Fehlerklassen, kein Grund für ein trainiertes
Modell. Die Grammatik sollte typische Einkaufsformen erklären und unbekannten
Rest sichtbar lassen; sie kann semantische Fehler ohne Referenzlabel nicht
erkennen.

## Befund 4: Gewichtet segmentieren statt an beliebigen Leerzeichen zu teilen

OpenFst dokumentiert gewichtete Pfade und die zugehörigen Operationen. Das ist
ein Verfahrensbeispiel, kein Nachweis, dass gewichtete Segmentierung die
Einkaufseingaben verbessert. Für diese App bedeutet es keine neue
OpenFst-Abhängigkeit; Kandidatenschnitte könnten als kleine dynamische
Programmierung in TypeScript geprüft werden:

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

Im Iststand wird `und` hart getrennt. Eine spätere Kandidatenbewertung müsste
mit Goldbeispielen zeigen, wann Mengen- oder Produktstruktur diesen Schnitt
überstimmen darf; ohne solche Evidenz bleibt das ein Architekturvorschlag.

## Befund 5: Zahlen und Einheiten brauchen eine eigene Normalisierungsstufe

Gorman und Sproat untersuchen Zahlwort-Normalisierung und beschreiben einen
Finite-State-Ansatz als datenarm für die untersuchten Sprachen Englisch,
Georgisch, Khmer und Russisch. Eine solche Transduktion lässt sich invertieren,
um Zahlwörter in Ziffern zu überführen. Die Arbeit untersucht keine deutschen
Einkaufsartikel und belegt keine Fehlerraten für diesen Parser.

Quelle: [Gorman und Sproat, TACL 2016: Minimally Supervised Number Normalization](https://aclanthology.org/Q16-1036/)

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

spaCy dokumentiert regelbasiertes Matching für exakte Phrasen und Tokenmuster.
Case-insensitive Phrase-Matches erfordern eine Konfiguration wie
`phrase_matcher_attr: LOWER`; das ist nicht der Standard. Bei überlappenden
EntityRuler-Treffern gewinnt die längste Phrase, bei Gleichstand die zuerst
auftretende.

Quellen: [spaCy Rule-based Matching](https://spacy.io/usage/rule-based-matching) und [EntityRuler API](https://spacy.io/api/entityruler)

Die App sollte dafür keine spaCy-Abhängigkeit einführen. Die übertragbare Idee
ist ein kleiner TypeScript-Gazetteer mit kanonischem Namen, Aliasen, Typ
`product` oder `brand`, optionaler lokaler Produkt-ID, Priorität und
Mehrdeutigkeit.

Die Open Food Facts API-Dokumentation erlaubt Bulk-Downloads für größere
Datensätze. Sie nennt Suchlimits und stellt klar, dass die v2-Server-API keine
allgemeine Full-Text-Suche bietet. Das stützt nur den Ausschluss einer
Live-Suche pro Transcript; eine lokale Anreicherung wäre ein eigener
Daten-, Aktualitäts- und Lizenzentscheid.

Quelle: [Open Food Facts API-Dokumentation](https://openfoodfacts.github.io/openfoodfacts-server/api/)

## Befund 7: Robustheit muss aus echten Speech-Varianten kommen

Artemova et al. untersuchen synthetische umgangssprachliche deutsche Varianten
in vier Task-orientierten Dialogdatensätzen und berichten einen mittleren
Rückgang von 21 Prozentpunkten beim Slot-F1 gegenüber 4,62 Prozentpunkten bei
der Intent-Genauigkeit. Das ist ein Grund, deutsche Varianten gezielt zu
prüfen, aber keine Prognose für diesen kleinen Einkaufsparser.
Kubis et al. beschreiben Back-Transcription mit synthetisierter Sprache und
Fehlerklassen als Verfahren, ASR-Auswirkungen auf NLU zu untersuchen. Das
liefert eine Evaluierungsidee, aber keine direkte Qualitätsaussage über den
nativen Speech-Dienst oder diesen Parser.

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

Parser-Metriken:

- Artikelgrenzen: Precision, Recall und F1,
- Feldgenauigkeit für Name, Menge, Einheit und Marke,
- vollständige Artikel-Exaktheit,
- Anteil sichtbarer Resttexte,
- mediane Parse-Zeit.

Workflow-Metriken bleiben getrennt:

- falsche automatische Listen-Zuordnungen, Zielwert null im Reviewpfad,
- Zeit bis zur Preview.

## Konkrete deterministische Versuche

### Versuch A: Parser isoliert vom Speech-Dienst messen

- Eingabe: versionierte UTF-8-Liste mit unverändertem Text, Eingangsart und
  erwarteten `name`, `quantity`, `unit`, `brand` sowie bewusstem Resttext.
- Gleiche Eingabeliste in fester Reihenfolge mit dem aktuellen reinen Parser
  ausführen. Die aktuelle Basis dafür sind
  [`parser.test.ts`](../../../src/features/shopping-list/stt-beta/domain/parser.test.ts)
  und `bun run test src/features/shopping-list/stt-beta/domain/parser.test.ts`.
- Minimalfälle enthalten die bereits getesteten Formen sowie gezielte
  Kontrastpaare: `2x Joghurt`/`2 mal Joghurt`, `fünfzehn Eier`/`zwölf Eier`,
  `eine halbe Packung`/`ein halbes Kilo`, `Skyr von JA`/`Skyr von ja`,
  `zwei Liter Milch und Brot`/`Milch zwei Liter`, und einen gültigen Artikel
  neben `???`.
- Für jeden Fall exakten Feldvergleich und Artikelgrenzen erfassen. Keine
  Zufallsdaten, Uhrzeiten, Speech-Engine oder Haushaltsliste in diesen Lauf
  einmischen.
- Als Sicherheitsmetrik separat zählen, ob Resttext verschwindet oder ein
  semantisch falscher Artikel entsteht. `unparsedText: null` ist keine
  Semantikmetrik.

### Versuch B: Eine Parseränderung pro Vergleich

- Baseline-Ergebnisse und Korpusversion unverändert aufbewahren.
- Eine Änderung an Mengen, Einheiten, Marken oder Segmentierung jeweils einzeln
  gegen exakt dieselben Zeilen messen.
- Jede Abweichung einer festen Klasse zuweisen: Grenze, Menge, Einheit, Marke,
  ASR-Variante oder unerklärter Rest. Ohne Goldlabel eine vermutete Semantik
  nicht als Parserfehler oder -erfolg werten.
- Nur Änderungen übernehmen, die die gewünschte Fehlerklasse verbessern und
  keine zuvor bestandenen Goldfälle regressieren.

### Versuch C: Speech-Evidenz getrennt und nach Vertragsabgleich

- Erst nach Klärung der On-Device-Abweichung und des Variantenvertrags aus der
  [freigegebenen V2-Spec](./natuerliches-hinzufuegen-von-einkaufsartikeln_V2.md)
  dieselben gespeicherten Audiodateien pro Speech-Variante ausführen.
- Gleiche Geräte-/OS-Version, Sprache, Speech-Optionen und Audiofolge verwenden;
  nur die freigegebene Kontextlisten-Variante darf abweichen. Varianten nicht
  mit einer dynamischen Haushaltsliste vermengen.
- Rohtranskript, gewählte Parserstruktur, Zeit-/Konfidenzmetadaten und
  bestätigte Goldstruktur lokal paaren. Segmentdaten separat auswerten, bevor
  sie zur Grenzentscheidung beitragen.
- Native Läufe sind kein Ersatz für Versuch A: Der Speech-Dienst kann dieselbe
  Aufnahme unterschiedlich transkribieren, während ein Parservergleich mit
  festem Transcript deterministisch bleibt.

Der Parserbericht ersetzt weder die aktuelle V2-Spec noch ihre
Optimierungs-Spec. Besonders die Aussagen zu `unparsedText`-Span-Erhalt,
Qualitätsflags und A/B-Varianten sind dort eigene Verträge, die gegen den
tatsächlichen Code separat geprüft werden müssen.

## Nicht als nächsten Schritt empfehlen

- keine Cloud-LLM-Interpretation im Parser,
- keine Live-Abfrage von Open Food Facts pro Spracheingabe,
- keine automatische Trennung an beliebigen Leerzeichen,
- keine harte Nutzung von Speech-Pausen als Artikelgrenze,
- kein Fuzzy-Matching ohne Katalogkontext und Unsicherheitsanzeige,
- kein neues natives Modell, bevor die deterministische Baseline mit echten
  Simulator-Transcripts gemessen ist.

## Quellen und Grenzen

Apple- und Expo-Behauptungen wurden gegen Apples Speech-Dokumentation, die
versionierte [expo-speech-recognition 57.1.0-Dokumentation](https://github.com/jamsch/expo-speech-recognition/tree/v57.1.0)
und die installierte Pakettypdefinition geprüft. Paper-Aussagen sind auf die
jeweils verlinkten Arbeiten und ihre untersuchten Aufgaben begrenzt; sie messen
nicht diese App. spaCy und Open Food Facts sind Primärdokumentation ihrer
jeweiligen Produkte. Die empfohlene TypeScript-Kandidatenbewertung statt einer
OpenFst- oder spaCy-Laufzeitabhängigkeit bleibt eine Architektur-Inferenz für
dieses Repository.
