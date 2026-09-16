# Spec: `local-recognition`

**Status:** Entwurf, Review erforderlich
**Parent:** [SPEC.md](./SPEC.md)
**Capability:** `local-recognition`

## Objective

Getippte Eingaben und Speech-to-Text-Transcripts werden deterministisch und
offline in einzelne strukturierte Einkaufsartikel zerlegt.

## Contract

- Mehrere Artikel in einer Eingabe werden getrennt.
- Der MVP erkennt deutsche Mengen und Einheiten wie `2 Liter`, `6` und
  `eine Packung`.
- Produktname und Markenangabe werden getrennt repräsentiert.
- Dezimalzahlen und typische Schreibvarianten werden normalisiert.
- Jede Ausgabe trägt mindestens `rawText`, `name`, `quantity`, `unit`, `brand`
  und einen Reviewstatus.
- Fehlende oder widersprüchliche Angaben werden als Review markiert.
- Das Modul führt keine Datenbank-, Netzwerk-, KI- oder UI-Operation aus.

## Success Criteria

- Der bestätigte Beispielsatz erzeugt vier Artikel.
- Mengen und Einheiten werden ohne stillen Verlust übernommen.
- Unklare Fragmente bleiben sichtbar und werden nicht als sichere Werte
  ausgegeben.
- Unit-Tests decken positive, gemischte und fehlerhafte deutsche Eingaben ab.
