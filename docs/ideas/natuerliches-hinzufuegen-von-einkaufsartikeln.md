# Lokales Sprach-Hinzufügen von Einkaufsartikeln

## Problem Statement

Wie können wir Nutzern ermöglichen, mehrere Einkaufsartikel schnell per Sprache zur gemeinsamen Einkaufsliste hinzuzufügen, ohne falsche Mengen oder Laden-Zuordnungen unbemerkt zu speichern?

## Recommended Direction

Die App erhält eine lokale Sprachaufnahme innerhalb der Einkaufsliste. Eingaben wie „4x Skyr von JA, zwei Liter Milch und Brot“ werden in einzelne Artikel mit Name, Menge, Einheit und Marke zerlegt.

Die Zuordnung zur Einkaufsliste erfolgt über das lokal gespeicherte und haushaltsweit geteilte Einkaufsverhalten. Beispielsweise wird `Skyr` nach bestätigten früheren Zuordnungen automatisch REWE zugeordnet. Korrekturen des Nutzers werden als Feedback gesammelt und nicht sofort als neue automatische Lernregel übernommen.

Das System arbeitet in zwei Stufen:

1. In der Lernphase werden 10–12 einmalige Zuordnungen aus Artikel plus Marke einzeln bestätigt. Wiederholungen derselben Kombination zählen nicht erneut.
2. Danach fragt die App einmalig, ob bekannte Zuordnungen künftig automatisch angewendet werden dürfen. Die Entscheidung bleibt widerrufbar.

Nach Zustimmung werden sichere Zuordnungen direkt gespeichert. Bei einer Unsicherheit oberhalb von `30 %` wird nur dann eine gebündelte Rückfrage angezeigt, wenn mindestens `N = 3` Artikel als Vorschläge vorliegen. Bei nur ein oder zwei Artikeln gibt es keine zusätzliche Unterbrechung. Unsichere Artikel bleiben in der normalen Vorschau.

Für jeden unklaren Artikel zeigt die gemeinsame Vorschau die wahrscheinlichsten Einkaufslisten. Die Auswahl gilt zunächst nur für die aktuelle Eingabe. Sie wird als Feedback behandelt und nicht direkt als neue haushaltsweite Lernregel gespeichert.

## Key Assumptions to Validate

- [ ] 10–12 bestätigte, unterschiedliche Artikel-plus-Marke-Zuordnungen reichen aus, damit Nutzer dem Automatikmodus vertrauen.
- [ ] Native On-Device-Sprach-zu-Text-Verarbeitung funktioniert auf iOS und Android ausreichend zuverlässig und offline.
- [ ] Artikel-, Marken- und Laden-Zuordnungen lassen sich aus dem haushaltsweiten Einkaufsverhalten zuverlässig ableiten.
- [ ] Nutzer akzeptieren eine gebündelte Rückfrage ab mindestens drei Vorschlägen besser als einzelne Rückfragen.
- [ ] Korrekturen des Nutzers verbessern die haushaltsweiten Zuordnungen, ohne unbestätigte Regeln sofort zu verstärken.
- [ ] Geteilte Lernregeln erzeugen im Haushalt mehr Nutzen als Konflikte zwischen unterschiedlichen Einkaufsgewohnheiten.

## MVP Scope

- Sprachaufnahme direkt innerhalb der Einkaufsliste
- Texteingabe und Spracheingabe über denselben lokalen Parser
- Mehrere Artikel in einer Eingabe
- Erkennung von Artikelname, Menge, Einheit und Marke
- Typische deutsche Einkaufsformen wie `3 Äpfel`, `3x Joghurt`, `2 Liter Milch` und `Skyr von JA`
- Lokale und haushaltsweit synchronisierte Zuordnung zu Produkt und Einkaufsliste
- Lernphase mit 10–12 einmaligen bestätigten Artikel-plus-Marke-Zuordnungen
- Einmalige Zustimmung zum Automatikmodus
- Lokales Weiterlernen aus Korrekturen
- Gebündelte Rückfrage ab 30 % Unsicherheit und mindestens drei Artikelvorschlägen
- Kompakte Auswahl der wahrscheinlichsten Einkaufsliste pro unklarem Artikel
- Auswahl gilt zunächst nur für die aktuelle Eingabe und wird nicht direkt als Lernregel gespeichert
- Widerruf des Automatikmodus in den Einstellungen
- Native On-Device-Spracherkennung ohne verpflichtenden externen KI-Dienst

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

- Wie viele bestätigte Feedbacks sind nötig, bevor eine Korrektur als haushaltsweite Lernregel übernommen wird?
- Wie werden Konflikte behandelt, wenn Haushaltsmitglieder dieselbe Artikel-plus-Marke-Kombination unterschiedlichen Listen zuordnen?
- Gilt die Zustimmung zum Automatikmodus pro Nutzer oder für den gesamten Haushalt?
- Welche nativen On-Device-Spracherkennungs-APIs sind auf iOS und Android im MVP verfügbar?
- Welche Messwerte zeigen, ob die 30-%-Schwelle und die Mindestmenge von drei Vorschlägen richtig gewählt sind?
