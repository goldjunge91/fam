# Spec: `ai-assist`

**Status:** Entwurf, Review erforderlich
**Parent:** [SPEC.md](./SPEC.md)
**Capability:** `ai-assist`

Die KI-Grenze wird ausschließlich in der isolierten Beta implementiert. Keine
bestehende Shopping-List-Komponente ruft die KI direkt auf.

## Objective

Ein optionaler KI-Fallback verbessert unklare lokale Erkennung, ohne die
local-first Reihenfolge, Nutzerkontrolle oder gemeinsame Schreibgrenze zu
umgehen.

## Contract

- Lokale Erkennung läuft immer zuerst.
- Ein KI-Aufruf benötigt gleichzeitig aktives AI-Abo und ausdrückliche
  Einwilligung.
- Die KI wird nur als Verbesserung/Fallback für unklare oder unvollständige
  lokale Ergebnisse eingesetzt.
- `leicht`: Tippfehler sowie Artikel, Mengen und Einheiten normalisieren.
- `mittel`: zusätzlich Produkte, Marken und Händlerzuordnungen auflösen.
- `voll`: gesamte Eingabe semantisch interpretieren, zerlegen und fehlende
  Details vorschlagen.
- Die KI liefert strukturierte Vorschläge, schreibt aber niemals direkt.
- Unklare KI-Ergebnisse bleiben im Review.
- Anonymisierte Trainingsdatensammlung ist nicht Teil dieser Spec.

## Success Criteria

- Ohne Abo oder Einwilligung wird kein externer KI-Aufruf ausgeführt.
- Alle drei Stufen ändern nur den Umfang der Verbesserung, nicht die
  Schreibberechtigung.
- Ein KI-Fehler fällt auf lokale Ergebnisse und Vorschau zurück.
- Datenschutzrelevante Eingaben erscheinen nicht in Logs oder Analytics.
