# Lokales Sprach-Hinzufügen von Einkaufsartikeln

## Problem Statement

Wie können wir Nutzern ermöglichen, mehrere Einkaufsartikel schnell per Sprache zur gemeinsamen Einkaufsliste hinzuzufügen, ohne falsche Mengen oder Laden-Zuordnungen unbemerkt zu speichern?

## Recommended Direction

Die App erhält eine lokale Sprachaufnahme innerhalb der Einkaufsliste. Eingaben wie „4x Skyr von JA, zwei Liter Milch und Brot“ werden in einzelne Artikel mit Name, Menge, Einheit und Marke zerlegt.

Die Zuordnung zur Einkaufsliste erfolgt über das persönliche lokale Einkaufsverhalten. Beispielsweise wird `Skyr` nach bestätigten früheren Zuordnungen automatisch REWE zugeordnet. Korrekturen des Nutzers aktualisieren dieses lokale Wissen.

Das System arbeitet in zwei Stufen:

1. In der Lernphase werden 10–12 einmalige Artikel-Zuordnungen einzeln bestätigt. Wiederholungen desselben Artikels zählen nicht erneut.
2. Danach fragt die App einmalig, ob bekannte Zuordnungen künftig automatisch angewendet werden dürfen. Die Entscheidung bleibt widerrufbar.

Nach Zustimmung werden sichere Zuordnungen direkt gespeichert. Bei einer Unsicherheit oberhalb von `X %` wird nur dann eine gebündelte Rückfrage angezeigt, wenn mindestens `N = 3` Artikel als Vorschläge vorliegen. Bei nur ein oder zwei Artikeln gibt es keine zusätzliche Unterbrechung. Unsichere Artikel bleiben in der normalen Vorschau.

## Key Assumptions to Validate

- [ ] 10–12 bestätigte, unterschiedliche Zuordnungen reichen aus, damit Nutzer dem Automatikmodus vertrauen.
- [ ] Lokale Sprach-zu-Text-Verarbeitung funktioniert auf iOS und Android ausreichend zuverlässig und offline.
- [ ] Artikel-, Marken- und Laden-Zuordnungen lassen sich aus dem persönlichen Einkaufsverhalten zuverlässig ableiten.
- [ ] Nutzer akzeptieren eine gebündelte Rückfrage ab mindestens drei Vorschlägen besser als einzelne Rückfragen.
- [ ] Korrekturen des Nutzers verbessern die lokalen Zuordnungen, ohne falsche Regeln zu verstärken.
- [ ] Die Lernregeln müssen pro Nutzer gespeichert werden und dürfen nicht ungeprüft als haushaltsweite Wahrheit gelten.

## MVP Scope

- Sprachaufnahme direkt innerhalb der Einkaufsliste
- Texteingabe und Spracheingabe über denselben lokalen Parser
- Mehrere Artikel in einer Eingabe
- Erkennung von Artikelname, Menge, Einheit und Marke
- Typische deutsche Einkaufsformen wie `3 Äpfel`, `3x Joghurt`, `2 Liter Milch` und `Skyr von JA`
- Lokale Zuordnung zu Produkt und Einkaufsliste
- Lernphase mit 10–12 einmaligen bestätigten Zuordnungen
- Einmalige Zustimmung zum Automatikmodus
- Lokales Weiterlernen aus Korrekturen
- Gebündelte Rückfrage ab Unsicherheit `X %` und mindestens drei Artikelvorschlägen
- Widerruf des Automatikmodus in den Einstellungen
- Vollständige Offline-Funktion ohne verpflichtenden externen KI-Dienst

## Not Doing

- Dialogischer Einkaufsassistent
- Cloud-KI oder verpflichtende externe Sprachverarbeitung
- Homescreen-Widget im MVP
- Vollständiges Verständnis beliebiger freier Sätze
- Globale Marken- und Händlerdatenbank
- Automatisches Speichern unbekannter oder widersprüchlicher Zuordnungen
- Komplexe Einkaufsplanung wie „alles für ein Frühstück“
- Haushaltsweite Lernregeln ohne Prüfung der persönlichen Zuordnung

## Open Questions

- Welcher konkrete Unsicherheitswert `X %` fühlt sich richtig an?
- Was gilt exakt als einmalige Zuordnung: Artikel, Artikel plus Marke oder Artikel plus Marke plus Einkaufsliste?
- Wie wird lokale Offline-Spracherkennung technisch auf beiden Plattformen umgesetzt?
- Welche Korrektur zeigt die App, wenn ein Artikel mehreren Einkaufslisten zugeordnet werden könnte?
- Soll ein Nutzer lokale Zuordnungen mit dem Haushalt teilen können oder bleiben sie strikt persönlich?
