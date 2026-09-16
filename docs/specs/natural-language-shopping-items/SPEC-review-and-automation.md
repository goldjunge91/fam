# Spec: `review-and-automation`

**Status:** Entwurf, Review erforderlich
**Parent:** [SPEC.md](./SPEC.md)
**Capability:** `review-and-automation`

Die Vorschau und die Zustimmungsflows gehören ausschließlich zur isolierten
Beta-Oberfläche. Der bestehende manuelle Add-Item-Flow wird nicht erweitert.

## Objective

Die App schützt vor falschen Einkäufen und reduziert nach einer kurzen,
bestätigten Lernphase wiederkehrende Bestätigungsarbeit.

## Contract

- Jeder Artikel erscheint in der Vorschau separat.
- Name, Menge, Einheit, Marke und Händlerliste können dort bearbeitet werden.
- Bestätigung oder Korrektur einer eindeutigen Artikelzuordnung ist ein
  positives Lernsignal.
- Identische normalisierte Zuordnungen zählen nur einmal.
- `positiveAssignmentThreshold` ist konfigurierbar und startet mit `10`.
- Nach Erreichen des Schwellenwerts wird die Frage zur automatischen lokalen
  Verarbeitung einmalig angezeigt.
- Ablehnung hält den Vorschaufluss aktiv; Zustimmung gilt nur für sichere,
  konfliktfreie lokale Ergebnisse.
- Lokale Automatisierung und KI-Einwilligung sind unabhängig.
- Die Entscheidung ist widerrufbar.

## Success Criteria

- Eine Batch-Eingabe mit vier Artikeln kann vier einzelne Entscheidungen und
  Lernsignale erzeugen.
- Nach dem zehnten eindeutigen Lernsignal erscheint genau eine Abfrage.
- Duplikate erhöhen den Zähler nicht.
- Unklare Ergebnisse bleiben trotz Automatisierungszustimmung im Review.
- Zustimmungs-, Ablehnungs- und Widerrufpfade sind getestet.
