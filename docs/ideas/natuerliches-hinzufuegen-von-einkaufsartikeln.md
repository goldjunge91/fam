# Lokales Sprach-Hinzufügen von Einkaufsartikeln

## Problem Statement

Wie können wir Nutzern ermöglichen, mehrere Einkaufsartikel schnell per Sprache zur gemeinsamen Einkaufsliste hinzuzufügen, ohne falsche Mengen oder Laden-Zuordnungen unbemerkt zu speichern?

## Recommended Direction

Die App erhält eine lokale Sprachaufnahme innerhalb der Einkaufsliste. Eingaben wie „4x Skyr von JA, zwei Liter Milch und Brot“ werden in einzelne Artikel mit Name, Menge, Einheit und Marke zerlegt. Im MVP erfolgt die Erkennung über native On-Device-Spracherkennung, die durch ein eigenes Expo-Native-Modul und einen gemeinsamen App-Adapter gekapselt wird.

Die Zuordnung zur Einkaufsliste erfolgt über das lokal gespeicherte und haushaltsweit geteilte Einkaufsverhalten. Beispielsweise wird `Skyr` nach bestätigten früheren Zuordnungen automatisch REWE zugeordnet. Korrekturen des Nutzers werden als Feedback gesammelt und nicht sofort als neue automatische Lernregel übernommen.

Das System arbeitet in zwei Stufen:

1. In der Lernphase werden 10–12 einmalige Zuordnungen aus Artikel plus Marke einzeln bestätigt. Wiederholungen derselben Kombination zählen nicht erneut.
2. Danach fragt die App jeden Nutzer einmalig, ob bekannte Zuordnungen künftig automatisch angewendet werden dürfen. Die Entscheidung bleibt widerrufbar.

Nach Zustimmung werden sichere Zuordnungen direkt gespeichert. Bei einer Unsicherheit oberhalb von `30 %` wird nur dann eine gebündelte Rückfrage angezeigt, wenn mindestens `N = 3` Artikel als Vorschläge vorliegen. Bei nur ein oder zwei Artikeln gibt es keine zusätzliche Unterbrechung. Unsichere Artikel bleiben in der normalen Vorschau.

Für jeden unklaren Artikel zeigt die gemeinsame Vorschau die wahrscheinlichsten Einkaufslisten. Bei widersprüchlichen Zuordnungen wird die wahrscheinlichste Liste als `Best Match ?` markiert, aber nicht automatisch ausgewählt. Die Auswahl gilt zunächst nur für die aktuelle Eingabe. Sie wird als Feedback behandelt und nicht direkt als neue haushaltsweite Lernregel gespeichert. Erst drei Bestätigungen derselben Artikel-plus-Marke-Zuordnung in getrennten Eingaben machen daraus eine automatische Regel.

## Key Assumptions to Validate

- [ ] 10–12 bestätigte, unterschiedliche Artikel-plus-Marke-Zuordnungen reichen aus, damit Nutzer dem Automatikmodus vertrauen.
- [ ] Native On-Device-Sprach-zu-Text-Verarbeitung funktioniert auf iOS und Android ausreichend zuverlässig und offline.
- [ ] Artikel-, Marken- und Laden-Zuordnungen lassen sich aus dem haushaltsweiten Einkaufsverhalten zuverlässig ableiten.
- [ ] Nutzer akzeptieren eine gebündelte Rückfrage ab mindestens drei Vorschlägen besser als einzelne Rückfragen.
- [ ] Korrekturen des Nutzers verbessern die haushaltsweiten Zuordnungen, ohne unbestätigte Regeln sofort zu verstärken.
- [ ] Geteilte Lernregeln erzeugen im Haushalt mehr Nutzen als Konflikte zwischen unterschiedlichen Einkaufsgewohnheiten.
- [ ] Ein eigenes Expo-Native-Modul kann die nativen On-Device-Schnittstellen zuverlässig und ohne Cloud-Fallback kapseln.
- [ ] Ausgewogene, sicherheitsorientierte und geschwindigkeitsorientierte Metriken liefern gemeinsam genug Signal zur Anpassung der Schwellenwerte.

## MVP Scope

- Sprachaufnahme direkt innerhalb der Einkaufsliste
- Texteingabe und Spracheingabe über denselben lokalen Parser
- Native On-Device-Spracherkennung über ein eigenes Expo-Native-Modul mit gemeinsamem App-Adapter
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

## Not Doing

- Dialogischer Einkaufsassistent
- Cloud-KI oder verpflichtende externe Sprachverarbeitung
- Ein gebündeltes Offline-Sprachmodell im MVP; dieses wird erst nach dem MVP geplant
- Homescreen-Widget im MVP
- Vollständiges Verständnis beliebiger freier Sätze
- Globale Marken- und Händlerdatenbank
- Automatisches Speichern unbekannter oder widersprüchlicher Zuordnungen
- Komplexe Einkaufsplanung wie „alles für ein Frühstück“
- Persönliche, nicht geteilte Lernregeln im MVP

## Open Questions

- Welche nativen On-Device-Spracherkennungs-APIs sind auf iOS und Android im MVP verfügbar?
- Wie werden haushaltsweit geteilte Lernregeln bei gleichzeitigen Offline-Korrekturen synchronisiert?
- Wie wird ein Gleichstand behandelt, wenn keine klare Mehrheit für eine Einkaufsliste entsteht?
- Welche Zielwerte gelten für Produktqualität, Sicherheit und Geschwindigkeit?
- Wie werden diese Metriken datensparsam und ohne Speicherung von Audiodaten erhoben?
