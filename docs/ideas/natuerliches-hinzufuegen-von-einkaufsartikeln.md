# Lokales Sprach-Hinzufügen von Einkaufsartikeln

## Problem Statement

Wie können wir Nutzern ermöglichen, mehrere Einkaufsartikel schnell per Sprache zur gemeinsamen Einkaufsliste hinzuzufügen, ohne falsche Mengen oder Laden-Zuordnungen unbemerkt zu speichern?

## Recommended Direction

Die App erhält eine lokale Sprachaufnahme innerhalb der Einkaufsliste. Eingaben wie „4x Skyr von JA, zwei Liter Milch und Brot“ werden in einzelne Artikel mit Name, Menge, Einheit und Marke zerlegt. Im MVP erfolgt die Erkennung über native On-Device-Spracherkennung mit `expo-speech-recognition@^57.0.0`, gekapselt durch einen gemeinsamen App-Adapter. Nach dem MVP kann React Native ExecuTorch als lokaler Whisper-Fallback für kompatible Geräte mit verfügbarer lokaler Modellbasis ergänzt werden.

Die Sprachfunktion wird im MVP nur auf Geräten angeboten, die native On-Device-Spracherkennung unterstützen. Auf nicht unterstützten Geräten bleibt die Texteingabe verfügbar; ein alternativer Sprachmodus ist dort nicht Bestandteil des MVP.

Die Unterstützung wird zur Laufzeit über die nativen Fähigkeiten des Geräts geprüft. Eine feste Geräte-Whitelist ist nicht erforderlich; bei einer negativen oder nicht verfügbaren Prüfung bleibt die Spracheingabe deaktiviert und die Texteingabe nutzbar.

Der App-Adapter prüft die Verfügbarkeit des nativen Erkennungsdienstes und der On-Device-Erkennung und startet die Erkennung ausschließlich mit `requiresOnDeviceRecognition: true`. Fehlt der lokale Dienst oder das erforderliche Sprachmodell, gilt Sprache auf diesem Gerät als nicht verfügbar.

Die Zuordnung zur Einkaufsliste erfolgt über das lokal gespeicherte und haushaltsweit geteilte Einkaufsverhalten. Beispielsweise wird `Skyr` nach bestätigten früheren Zuordnungen automatisch REWE zugeordnet. Korrekturen des Nutzers werden als Feedback gesammelt und nicht sofort als neue automatische Lernregel übernommen.

Das System arbeitet in zwei Stufen:

1. In der Lernphase werden 10–12 einmalige Zuordnungen aus Artikel plus Marke einzeln bestätigt. Wiederholungen derselben Kombination zählen nicht erneut.
2. Danach fragt die App jeden Nutzer einmalig, ob bekannte Zuordnungen künftig automatisch angewendet werden dürfen. Die Entscheidung bleibt widerrufbar.

Nach Zustimmung werden sichere Zuordnungen direkt gespeichert. Bei einer Unsicherheit oberhalb von `30 %` wird nur dann eine gebündelte Rückfrage angezeigt, wenn mindestens `N = 3` Artikel als Vorschläge vorliegen. Bei nur ein oder zwei Artikeln gibt es keine zusätzliche Unterbrechung. Unsichere Artikel bleiben in der normalen Vorschau.

Für jeden unklaren Artikel zeigt die gemeinsame Vorschau die wahrscheinlichsten Einkaufslisten. Bei widersprüchlichen Zuordnungen wird die wahrscheinlichste Liste als `Best Match ?` markiert, aber nicht automatisch ausgewählt. Die Auswahl gilt zunächst nur für die aktuelle Eingabe. Sie wird als Feedback behandelt und nicht direkt als neue haushaltsweite Lernregel gespeichert. Erst drei Bestätigungen derselben Artikel-plus-Marke-Zuordnung in getrennten Eingaben machen daraus eine automatische Regel.

Bestätigungen und Korrekturen werden als einzelne Ereignisse lokal erfasst und nach der Synchronisierung per Mehrheit ausgewertet. So bleiben gleichzeitige Offline-Rückmeldungen erhalten und können nicht durch eine einfache letzte Änderung verloren gehen.

Nutzer können im MVP separat zustimmen, pseudonymisierte Transkripte, Artikel, Marken, Ziel-Listen und Korrekturergebnisse für die Verbesserung des Parsers, der Listen-Zuordnung, eigener Prognosen und direkt verwandter Einkaufsfunktionen zu teilen. Rohes Audio bleibt immer auf dem Gerät. Diese Produktverbesserungsdaten werden getrennt von der normalen App-Nutzung und pro Nutzer verwaltet.

Ein Widerruf stoppt die zukünftige Verarbeitung sofort. Pseudonymisierte Quelldaten werden innerhalb der festgelegten 90-Tage-Frist gelöscht. Bereits exportierte Trainings- oder Prognosemodelle bleiben im MVP bestehen; ihre nachträgliche Entfernung ist nicht Teil des ersten technischen Löschpfads.

Vor der Übertragung filtert das Gerät lokal auf die erlaubten Einkaufsfelder. Verdächtige oder indirekt identifizierende Inhalte werden aus dem Produktverbesserungsereignis entfernt oder das Ereignis wird gar nicht übertragen.

Die Zustimmung erfolgt in zwei getrennten, klar beschrifteten Opt-ins: eines für aggregierte Qualitäts- und Nutzungsmetriken und eines für pseudonymisierte Inhaltsdaten. Beide Zustimmungen sind unabhängig voneinander widerrufbar und gelten nicht pauschal für unverbundene zukünftige Zwecke.

## Key Assumptions to Validate

- [ ] 10–12 bestätigte, unterschiedliche Artikel-plus-Marke-Zuordnungen reichen aus, damit Nutzer dem Automatikmodus vertrauen.
- [ ] Die Laufzeitprüfung erkennt zuverlässig, ob Offline-Spracherkennung verfügbar ist, und verhindert die Spracheingabe auf nicht unterstützten Geräten.
- [ ] Artikel-, Marken- und Laden-Zuordnungen lassen sich aus dem haushaltsweiten Einkaufsverhalten zuverlässig ableiten.
- [ ] Nutzer akzeptieren eine gebündelte Rückfrage ab mindestens drei Vorschlägen besser als einzelne Rückfragen.
- [ ] Korrekturen des Nutzers verbessern die haushaltsweiten Zuordnungen, ohne unbestätigte Regeln sofort zu verstärken.
- [ ] Geteilte Lernregeln erzeugen im Haushalt mehr Nutzen als Konflikte zwischen unterschiedlichen Einkaufsgewohnheiten.
- [ ] `expo-speech-recognition` kann die nativen On-Device-Schnittstellen zuverlässig und ohne Cloud-Fallback über den App-Adapter kapseln.
- [ ] Ein späterer React-Native-ExecuTorch-Fallback liefert auf kompatiblen Geräten ausreichend gute lokale Transkriptionen.
- [ ] Ausgewogene, sicherheitsorientierte und geschwindigkeitsorientierte Metriken liefern gemeinsam genug Signal zur Anpassung der Schwellenwerte.
- [ ] Der Workflow erreicht mindestens 95 % korrekt erkannte Zuordnungen, höchstens 1 % falsche Einkaufslisten, höchstens 10 % manuelle Korrekturen und eine mediane Hinzufügezeit von höchstens 6 Sekunden.
- [ ] Nutzer akzeptieren im MVP eine separate Zustimmung zur pseudonymisierten Produktverbesserung und opt-in-aggregierten Metriken.
- [ ] Eine datenschutzverstärkte Telemetrie kann für die Produktionsauslieferung zusätzlich eingesetzt werden, ohne Audio zu übertragen.
- [ ] Die lokale Entfernung direkter Identifikatoren reduziert die Linkbarkeit von Transkripten und Einkaufsinhalten ausreichend.

## MVP Scope

- Sprachaufnahme direkt innerhalb der Einkaufsliste
- Texteingabe und Spracheingabe über denselben lokalen Parser
- Native On-Device-Spracherkennung über `expo-speech-recognition@^57.0.0` mit gemeinsamem App-Adapter
- Sprachfunktion im MVP nur auf Geräten mit verfügbarer nativer On-Device-Erkennung
- Mehrere Artikel in einer Eingabe
- Erkennung von Artikelname, Menge, Einheit und Marke
- Typische deutsche Einkaufsformen wie `3 Äpfel`, `3x Joghurt`, `2 Liter Milch` und `Skyr von JA`
- Lokale und haushaltsweit synchronisierte Zuordnung zu Produkt und Einkaufsliste
- Lernphase mit 10–12 einmaligen bestätigten Artikel-plus-Marke-Zuordnungen
- Einmalige Zustimmung zum Automatikmodus
- Lokales Weiterlernen aus Korrekturen
- Gebündelte Rückfrage ab 30 % Unsicherheit und mindestens drei Artikelvorschlägen
- Kompakte Auswahl der wahrscheinlichsten Einkaufsliste pro unklarem Artikel
- Markierung des wahrscheinlichsten Konflikttreffers als `Best Match ?`
- Auswahl gilt zunächst nur für die aktuelle Eingabe und wird nicht direkt als Lernregel gespeichert
- Übernahme einer Korrektur als Lernregel erst nach drei Bestätigungen in getrennten Eingaben
- Mehrheit plus Konfliktmodus für haushaltsweit geteilte Zuordnungen
- Automatik-Zustimmung pro Nutzer bei haushaltsweit geteilten Lernregeln
- Widerruf des Automatikmodus in den Einstellungen
- Native On-Device-Spracherkennung ohne verpflichtenden externen KI-Dienst
- Auswertung von Produkt-, Sicherheits- und Geschwindigkeitsmetriken
- Texteingabe als Fallback, wenn lokale Spracherkennung auf dem Gerät nicht verfügbar ist
- Opt-in-aggregierte Metriken im MVP ohne Audio oder Transkript
- Separate Zustimmung pro Nutzer für pseudonymisierte Transkripte, Artikel, Marken, Ziel-Listen und Korrekturergebnisse
- Nutzung dieser Daten für Parser-, Routing-, Prognose- und direkt verwandte Einkaufsfunktionen
- Lokale Entfernung direkter Identifikatoren vor der Übertragung
- Rohes Audio bleibt vollständig auf dem Gerät

## Technische Quellen und Rollen

- [`expo-audio`](https://docs.expo.dev/versions/v57.0.0/sdk/audio/) für optionale Audioaufnahme und Wiedergabe, nicht für die Spracherkennung
- [`expo-speech`](https://docs.expo.dev/versions/v57.0.0/sdk/speech/) für Text-to-Speech, nicht für Spracheingabe
- [`expo-speech-recognition`](https://github.com/jamsch/expo-speech-recognition) als MVP-Brücke zu iOS `SFSpeechRecognizer` und Android `SpeechRecognizer`, inklusive Verfügbarkeits- und On-Device-Prüfung
- [React Native ExecuTorch](https://docs.swmansion.com/react-native-executorch/docs/fundamentals/getting-started) und [Speech-to-Text](https://docs.swmansion.com/react-native-executorch/docs/extensions/speech-to-text) als späterer lokaler Whisper-Fallback

## Not Doing

- Dialogischer Einkaufsassistent
- Cloud-KI oder verpflichtende externe Sprachverarbeitung
- React Native ExecuTorch oder ein anderes gebündeltes Offline-Sprachmodell im MVP; der lokale Modell-Fallback wird erst nach dem MVP geplant
- Datenschutzverstärkte Telemetrie im MVP; sie wird für die Produktionsauslieferung geplant
- Nutzung der Daten für Werbung, Tracking oder nicht verwandte Produktbereiche
- Unbegrenzte Weiterverwendung unter einer pauschalen Zustimmung für beliebige zukünftige Zwecke
- Homescreen-Widget im MVP
- Vollständiges Verständnis beliebiger freier Sätze
- Globale Marken- und Händlerdatenbank
- Automatisches Speichern unbekannter oder widersprüchlicher Zuordnungen
- Komplexe Einkaufsplanung wie „alles für ein Frühstück“
- Persönliche, nicht geteilte Lernregeln im MVP

## Open Questions

- Welche React-Native-ExecuTorch-Whisper-Variante und welche Modellbereitstellung eignen sich für den späteren Fallback?
- Welche konkrete Ausgestaltung erhält die datenschutzverstärkte Telemetrie für die Produktionsauslieferung?
