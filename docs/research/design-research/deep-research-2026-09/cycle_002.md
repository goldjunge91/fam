# Cycle 002: Übertragbare Muster aus anderen Inventar-Domänen

## Forschungsfrage

Welche Interaktionsmodelle aus Home Inventory, digitaler Garderobe und Kanban lassen sich auf einen Haushalt mit Lebensmitteln übertragen, ohne die Inventaransicht unnötig komplex zu machen?

## Befunde

### Visuelles Wiederfinden statt Datenbankdenken

Sortly beschreibt eine visuelle Inventarisierung mit Fotos, Orten, Ordnern, Tags, QR-Codes und Suchzugriff. Die National Association of Insurance Commissioners beschreibt ebenfalls ein Modell, in dem Gegenstände fotografiert und nach Raum oder Kategorie gruppiert werden. [Sortly Home Inventory](https://www.sortly.com/solutions/home-inventory-software/), [NAIC Home Inventory](https://content.naic.org/consumer/home-inventory)

Übertragbar ist nicht die vollständige Foto-Pflicht. Übertragbar ist die Idee, dass visuelle Miniaturen und reale Orte das Wiederfinden unterstützen. Für Lebensmittel sollten Bilder deshalb die schnelle Erkennung ähnlicher Produkte verbessern, während Name, Menge und Dringlichkeit weiterhin textlich eindeutig bleiben.

### Verbrauchshistorie als Feedback-Schleife

Digitale Garderoben verbinden visuelle Übersicht mit einer Nutzungshistorie. DGCloset beschreibt ein Kalender-Logging, Wear History und Analysen für häufig oder selten verwendete Kleidungsstücke. [DGCloset](https://www.dgcloset.com/)

Für den Vorrat ergibt sich ein kleiner, sinnvoller Transfer: „verwendet“, „teilweise verwendet“ und „weggeworfen“ können als schnelle Zustandsaktionen dienen. Die Historie sollte dabei nicht zum Selbstzweck werden, sondern die nächste Inventarentscheidung verbessern, etwa durch realistischere Mengen oder Hinweise auf vergessene Bestände.

### Board- und Statusmodell

Kanban macht Zustände durch Spalten, Karten und sichtbaren Fluss verständlich. Atlassian betont dabei Visualisierung, begrenzte parallele Arbeit und das Verschieben von Karten durch klar definierte Stadien. [Atlassian Kanban Boards](https://www.atlassian.com/agile/kanban/boards/)

Für Lebensmittel wäre ein vollständiges Board wahrscheinlich zu breit: ein Produkt kann gleichzeitig im Kühlschrank liegen, bald ablaufen und in mehreren Mengen vorhanden sein. Ein reduziertes Statusmodell kann jedoch als temporärer Fokus funktionieren:

`Im Bestand → geöffnet → zuerst verwenden → verwendet / entsorgt`

Diese Zustände sollten nicht die einzige Datenstruktur sein. Sie eignen sich als schnelle Filter- oder Batch-Use-Ansicht, nicht als Ersatz für Menge, Lagerort und Datum.

## Synthese

Drei übertragbare Muster sind besonders wertvoll:

1. **Visuelle Orientierung:** erkennbare Produktbilder und reale Lagerorte helfen beim Wiederfinden.
2. **Verbrauchsschleife:** jede Entnahme ist eine kleine, sofortige Aktualisierung statt eine spätere Verwaltungsaufgabe.
3. **Temporärer Fokus:** ein Statusboard oder eine Arbeitsansicht kann dringende Artikel bündeln, ohne den vollständigen Bestand umzubauen.

## Design-Hypothese

Die innovative Variante ist kein virtuelles 3D-Regal. Ein besseres Verhältnis von Nutzen zu Komplexität ist eine „lebende Bestandsansicht“:

- kompakte Produktminiatur zur visuellen Erkennung;
- klare Menge und Frische-/Dringlichkeitsstatus;
- eine primäre Aktion wie „1 verwendet“;
- optional „teilweise verwendet“ oder „wegwerfen“;
- unmittelbar aktualisierte Priorisierung;
- Detailansicht mit Ort, Kategorie, Datum und Änderungsverlauf.

So verbindet die App das visuelle Wiederfinden einer Garderobe mit dem Statusfluss eines Kanban-Boards, ohne aus dem Haushalt eine Lagerverwaltungssoftware zu machen.

## Nicht übernehmen

- Foto-first als Pflicht für jedes Produkt: zu viel Pflege und unzuverlässig bei ähnlichen Verpackungen.
- Drag-and-drop als zentrale Mengeninteraktion: unpräzise auf kleinen Displays und problematisch für mehrere Mengen.
- ein starres Kanban-Board als Standardansicht: es überlädt den Bildschirm und vermischt Zustände mit Orten.

## Quellen

1. Sortly, „Home Inventory Software“, https://www.sortly.com/solutions/home-inventory-software/
2. National Association of Insurance Commissioners, „Home Inventory“, https://content.naic.org/consumer/home-inventory
3. DGCloset, „AI Wardrobe & Outfit Planner“, https://www.dgcloset.com/
4. Atlassian, „What is a kanban board?“, https://www.atlassian.com/agile/kanban/boards/
