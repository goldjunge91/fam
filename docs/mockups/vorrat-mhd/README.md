# Vorrat: gleiche Artikel und mehrere MHDs

Design-Audit und statische Mockups für die Vorratsansicht. Stand: Vorschlag,
nicht implementiert.

- `vorrat-mhd-mockup.html` zeigt drei Varianten im warmen fam-Design.
- Die Mockups modellieren eine Artikelgruppe mit mehreren einzelnen MHD-Losen.
- Die empfohlene Variante ist **A: Artikelgruppe mit MHD-Detail-Sheet**.

## Ausgangslage

Die aktuelle Ansicht rendert jede Zeile aus `fridge_items` direkt. Dadurch
erscheint ein mehrfach erfasster Artikel mehrfach. Die Zeilen enthalten aber
bereits die Information, die für die MHD-Auflösung gebraucht wird: Menge,
Lagerort und `expiry_date`.

Die Mockups gehen deshalb von dieser Trennung aus:

```text
Artikelgruppe: Milch 1,5 %  ·  4 l gesamt
  Los 1: 2 l · MHD 03.09.2026 · Kühlschrank
  Los 2: 2 l · MHD 12.09.2026 · Kühlschrank
```

Die Daten bleiben auf Los-Ebene erhalten. Nur die Darstellung addiert gleiche
Artikel.

## Varianten

1. **A: Detail-Sheet**
   Eine kompakte Zeile pro Artikelgruppe. Ein Tap öffnet alle MHDs, Mengen und
   Lagerorte. Das hält den Hauptscreen ruhig und macht das MHD trotzdem direkt
   einsehbar.
2. **B: Inline-Aufklappen**
   Eine Gruppe lässt sich direkt in der Liste öffnen. Die MHDs sind ohne Sheet
   sichtbar, verbrauchen aber bei mehreren Losen viel vertikalen Platz.
3. **C: MHD als primäre Liste**
   Die Gruppe zeigt alle Lose unter einem sichtbaren MHD-Abschnitt. Das ist
   maximal transparent, verliert aber den schnellen Gesamtbestand aus dem
   Fokus.

## Öffnen

```bash
open docs/mockups/vorrat-mhd/vorrat-mhd-mockup.html
```

