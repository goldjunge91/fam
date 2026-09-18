### 1. Erkennungsqualität

  In den Logs entstehen echte ASR-Fehler, die der Parser als gültige Artikel übernimmt:

  - BBulgr statt Bulgur
  - Tempi statt Tempeh
  - kich / Rabin statt vermutlich Kichererbsen
  - Kaffee Tee
  - Mineralwasser Orangensaft
  - schmand Käfer

  Dadurch ist unparsed_text: null derzeit kein ausreichender Qualitätsindikator: syntaktisch
  wurde etwas erkannt, semantisch kann es trotzdem falsch sein. Siehe Live-Logs (docs/specs/
  natuerliches-hinzufuegen-von-einkaufsartikeln_V2/live-speech-test-2026-09-18.jsonl).

  Der wichtigste offizielle Hebel ist contextualStrings: Apple unterstützt damit kurze,
  domänenspezifische Produkt- und Markennamen. Apple empfiehlt kurze Einträge mit ein bis
  zwei Wörtern und maximal 100 Phrasen pro Request. Apple-Dokumentation

  Empfehlung:

  - bis zu 100 relevante Einkaufsbegriffe und Marken pro Speech-Session
  - zuerst aus unserem realen Testkorpus
  - später dynamisch aus lokalen Haushaltsartikeln und bestätigten Marken
  - keine komplette Produktdatenbank in den Request laden

  ### 2. Datenschutz und Request-Modus

  de-DE, continuous: true, iosTaskHint: dictation und On-Device bleiben richtig. dictation
  passt zu längeren Einkaufsformulierungen; confirmation wäre nur für „Ja/Nein“-Eingaben
  sinnvoll. Apple Task Hints

  On-Device muss wegen unserer Datenschutzanforderung bleiben. Apple weist allerdings
  ausdrücklich darauf hin, dass On-Device-Erkennung weniger genau sein kann. Deshalb
  verbessern wir Kontext und Parser, statt auf Cloud-Erkennung auszuweichen. Apple On-Device
  Recognition

  addsPunctuation hilft bei Satzzeichen, liefert aber keine zuverlässigen Artikelgrenzen.
  Apple Punctuation

  ### 3. Performance

  Im aktuellen Adapter gibt es drei konkrete Optimierungspunkte:

  - maxAlternatives: 3 wird angefordert, aber nur event.results[0] verwendet. Entweder auf 1
    reduzieren oder Alternativen gezielt nur bei unsicherer Analyse verwenden.

  - Volume-Events laufen alle 100 ms. Die Paketdokumentation sagt ausdrücklich, dass ein
    größeres Intervall die Performance verbessert. expo-speech-recognition Optionen

  - Finale Transcript- und Segment-Arrays werden bei jedem Ergebnis neu kopiert. Das kann
    mit Chunk-Arrays ohne Verhaltensänderung effizienter werden.

  ### Priorität

  Als nächstes sollten wir einen kleinen messbaren Slice bauen:

  1. A/B-Test derselben Audiofiles: ohne und mit contextualStrings.
  2. Metriken ergänzen: erkannte Fachbegriffe, vollständige Artikelstruktur, Artikelgrenzen,
     falsche Zuordnung und Zeit bis Preview.

  3. Erst wenn der A/B-Test verbessert, den Kontext dauerhaft aktivieren.
  4. Danach bedingte Nutzung von Alternativ-Transkripten und die kleinen Array-/Volume-
     Optimierungen.

  Ich würde jetzt noch keinen großen Parserumbau und kein neues KI-Modell anfangen.
