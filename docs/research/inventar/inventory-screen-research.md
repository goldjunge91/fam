# Research: Inventar-/Vorrat-Screen

Status: Research, keine Implementierungsentscheidung

Stand: 2026-09-13

Bead: `fam-0ry`

## Zweck

Diese Unterlage sammelt alle bisher entwickelten Richtungen für einen
übersichtlicheren Inventar-/Vorrat-Screen sowie die dafür durchgeführte
Webrecherche. Sie ist eine Entscheidungsgrundlage, kein Produktionsvertrag und
ändert keine Daten-, Sync- oder RLS-Regel.

Die fachliche Ausgangslage der Vorschauen verwendet den aktuellen Beispielstand
des Screens: 31 Artikel insgesamt und 6 Artikel mit kritischem MHD.

## Leitfragen

- Wie erkennt ein Haushaltsmitglied in wenigen Sekunden, was relevant ist?
- Wie werden Lagerort, Menge und MHD gemeinsam verständlich?
- Wie führt die Übersicht direkt zu einer sinnvollen nächsten Aktion?
- Wie bleibt die Darstellung für einen geteilten Haushalt einfach und belastbar?

## Bisherige Konzeptvorschläge

### 1. Erste drei Richtungen

Diese Varianten waren die erste Annäherung an den Wunsch nach mehr Überblick.

#### A: Priorität zuerst

Kritische MHDs und nächste Aktionen stehen oben. Darunter folgt eine reduzierte
Liste mit den übrigen Artikeln.

- Stärke: schnellster Blick auf das Dringende.
- Schwäche: Lagerorte und räumliche Orientierung bleiben sekundär.

#### B: Lagerorte zuerst

Kühlschrank, Vorrat und Tiefkühlfach werden als primäre Auswahl mit Mengen
gezeigt. Danach folgt die Artikelliste des gewählten Orts.

- Stärke: passt zum physischen Arbeiten am Kühlschrank oder Regal.
- Schwäche: zeitkritische Artikel sind ohne zusätzliche MHD-Ebene weniger
  präsent.

#### C: Dichte Listenansicht

Eine kompakte Liste gruppiert nach „Jetzt prüfen“, „Bald“ und „Später“.

- Stärke: viele Artikel sind gleichzeitig sichtbar.
- Schwäche: wenig eigenständige Identität und geringe räumliche Orientierung.

### 2. Moderne Richtungen

Diese Runde sollte bewusster über eine klassische Liste hinausgehen.

#### 01: Zeit-Horizont

Der Bestand ordnet sich entlang eines zeitlichen Horizonts: „Jetzt“, „Diese
Woche“ und „Später“. Eine Punktelinie macht die Verteilung der MHD-Relevanz
auf einen Blick sichtbar.

- Stärke: gute Priorisierung ohne viele Statuskarten.
- Schwäche: der Lagerort bleibt in den Zeilen verborgen.

#### 02: Shelf Map

Kühlschrank, Vorrat und Tiefkühlfach werden als visuelle Regale dargestellt.
Artikel stehen hochkant auf den Regalflächen. Kritische Artikel werden mit
Text und Farbsignal markiert.

- Stärke: direkte räumliche Orientierung und hoher Wiedererkennungswert.
- Schwäche: eine rein visuelle Regalmetapher kann bei vielen Artikeln schnell
  überladen werden.

#### 03: Focus Pulse

Die Startfläche zeigt zunächst nur Artikel, die Aufmerksamkeit brauchen. Ein
kompakter Statusstreifen trennt „jetzt prüfen“, „bald prüfen“ und stabile
Artikel.

- Stärke: sehr klarer Einstieg in den Alltag.
- Schwäche: der vollständige Bestand ist zunächst weniger sichtbar.

#### 04: Horizont + Shelf

Die korrigierte Kombination aus 01 und 02:

1. Oben steht exakt die Punktelinie aus dem Abschnitt „Dein Horizont“.
2. Darunter stehen aufrechte Artikel als Shelf Map in Kühlschrank, Vorrat und
   Tiefkühlfach.
3. Das MHD-Signal und der Lagerort sind damit in derselben Ansicht verknüpft.

- Stärke: verbindet zeitliche Priorität mit physischer Orientierung.
- Schwäche: benötigt eine gute Begrenzung der sichtbaren Artikel, damit die
  Shelf-Darstellung nicht zur zweiten überfüllten Liste wird.

#### 05: Shelf Flow

Die ursprünglich getestete Orbit-Idee wurde verworfen. Shelf Flow ersetzt sie
durch ein experimentelles, aber greifbares Modell: drei physische Regalzeilen
werden von einer sichtbaren „Jetzt“-Linie durchlaufen. Artikel links oder nahe
der Linie stehen für die nächste Handlung, Artikel weiter rechts für später.

- Stärke: ungewöhnlich, aber noch an einem realen Regal orientiert.
- Schwäche: muss in einer echten Interaktion sorgfältig erklärt werden.

#### Verworfen: Pantry Orbit

Die radiale Umlaufbahn mit Artikeln um einen Mittelpunkt wurde als zu verspielt
und unübersichtlich verworfen. Sie erzeugt eine starke Metapher, hilft aber
nicht zuverlässig beim schnellen Scannen eines Bestands.

### 3. Recherchebasierte Richtungen ohne vorherige Präferenzen

Diese drei Varianten wurden ausschließlich aus den recherchierten Produktmustern
abgeleitet und bewusst unabhängig von den vorherigen Nutzerpräferenzen gebaut.

#### A: Use It First

Der Screen startet nicht mit dem vollständigen Bestand, sondern mit Artikeln,
die zuerst verwendet werden sollten. Ein hervorgehobener Artikel bietet direkt
„Verbrauchen“ und „Zum Essensplan“. Darunter folgen weitere kritische Artikel
und Rezeptideen aus dem vorhandenen Bestand.

- Primärer Job: Lebensmittel retten.
- Mögliche nächste Aktionen: verbrauchen, in den Essensplan übernehmen,
  Rezept öffnen.
- Hauptrisiko: der Screen kann eher wie ein Tagesplan als wie ein Inventar
  wirken.

#### B: Kitchen Cockpit

Eine kompakte Statusfläche zeigt MHD-Risiken, niedrige Mengen und stabile
Bestände. Darunter liegen zwei direkte Arbeitsbereiche: „Ablauf in Kürze“ und
„Nachkaufen“. Am unteren Rand stehen schnelle Erfassungswege wie Scan, Foto und
Sprache.

- Primärer Job: den Zustand des Haushalts schnell erfassen und bearbeiten.
- Mögliche nächste Aktionen: kritische Artikel prüfen, Bestand nachkaufen,
  neuen Artikel schnell erfassen.
- Hauptrisiko: zu viele Signale können wieder zu einer Dashboard-Ansicht mit
  Karten-Chrome werden.

#### C: Single Stream

Eine einzige lesbare Liste enthält pro Zeile Relevanz, Menge, Lagerort, MHD und
optional den letzten Bearbeiter. Sortiert wird standardmäßig nach Relevanz,
nicht alphabetisch. Inline-Aktionen führen zu Einkauf oder Mengenänderung.

- Primärer Job: alles im Haus zuverlässig finden.
- Mögliche nächste Aktionen: suchen, Menge ändern, auf die Einkaufsliste
  setzen.
- Hauptrisiko: weniger eigenständige visuelle Identität als Shelf-basierte
  Konzepte.

## Synthese als möglicher nächster Kandidat

Aus der Recherche und den bisherigen Tests ergibt sich eine mögliche Variante
06, die nicht einfach eine weitere Liste wäre:

### Use-first Lens auf einer Lagerkarte

- Eine kleine Zeitsteuerung bestimmt, welche Artikel Aufmerksamkeit bekommen.
- Die Artikel bleiben in ihrem Lagerort sichtbar.
- Die zeitkritischen Artikel werden innerhalb der Lagerkarte hervorgehoben.
- Der ausgewählte Artikel bietet unmittelbar „Verbrauchen“, „Zum Essensplan“
  und „Einkaufsliste“.
- Eine Rezeptbrücke kann aus den kritischen Artikeln Vorschläge erzeugen,
  ohne den Inventarbestand automatisch zu verändern.
- Eine optionale Haushaltsinformation wie „zuletzt von Marco geändert“ bleibt
  sekundär und verdrängt nicht Menge, Ort oder MHD.

Das ist eine Synthese aus den Konzepten, keine bereits getroffene Produkt- oder
Architekturentscheidung.

## Webrecherche

### Recherchezeitpunkt

Die Recherche wurde am 13.09.2026 durchgeführt.

### Verwendete Suchanfragen

Textsuche:

1. `modern pantry inventory app expiration date visual shelf UI KitchenPal official`
2. `NoWaste app food inventory expiration dates official`
3. `food inventory app pantry visual organization expiration date official`
4. `shared household inventory app modern UX pantry shopping list official`

Bild-/Screenshot-Suche:

1. `KitchenPal pantry inventory app screenshot`
2. `NoWaste food inventory app screenshot`
3. `Your Food pantry inventory app screenshot`

### Quellen und Beobachtungen

#### NoWaste

[NoWaste im Apple App Store](https://apps.apple.com/us/app/nowaste-food-inventory-list/id926211004)

Beobachtet:

- Synchronisation über mehrere Geräte.
- Sortierung nach Ablaufdatum, Name oder Kategorie.
- Filter nach Kategorie oder Lagerort.
- Suche nach vorhandenen Produkten.
- Verschieben von Artikeln zwischen Bestands- und Einkaufslisten.
- Schnelleingabe über Scanner und zusätzlich ein KI-gestützter Assistent.

Ableitung für Haushaltsapp: Die Vollansicht sollte zuverlässig durchsuchbar
bleiben, aber eine relevante Standardsortierung und ein klarer Übergang zur
Einkaufsliste anbieten.

#### KitchenPal

[KitchenPal: Pantry Tracker, Meal Planner & Shopping List](https://kitchenpalapp.com/en/)

Beobachtet:

- Getrennte Bereiche für Pantry, Kühlschrank, Tiefkühlfach und weitere eigene
  Lagerbereiche.
- Ablaufdaten und Erinnerungen als zentraler Bestandteil der Inventarlogik.
- Rezeptsuche auf Basis des tatsächlichen Bestands.
- Einkaufslisten können aus fehlenden Rezeptzutaten oder Bestandsprüfungen
  entstehen.
- Schnelle Erfassung über Barcode, Sprache oder Text.
- Gemeinsame Nutzung mit der Familie.

Ableitung für Haushaltsapp: MHD-Übersicht gewinnt an Wert, wenn die nächste
Handlung im Essensplan oder auf der Einkaufsliste ohne erneute Eingabe möglich
ist.

#### Your Food

[Your Food: Pantry Inventory App](https://yourfood.app/)

Beobachtet:

- Eine einzelne lesbare Liste für Kühlschrank, Schränke und weitere Orte.
- Optionale Felder für Menge, Datum, Preis, Einheit oder Notiz, statt jedes
  Feld verpflichtend zu machen.
- Artikel mit naher Haltbarkeit werden in der Darstellung nach vorne geholt.
- Ein Artikel kann mit seinen Daten in einem Schritt auf eine Einkaufsliste
  verschoben werden.
- Echtzeit-Synchronisierung innerhalb des Haushalts.
- Die Produktseite beschreibt Eingabefriction, insbesondere das wiederholte
  Tippen von Produktnamen, als wichtigen Grund für Abbrüche.

Ableitung für Haushaltsapp: Überblick und Erfassung müssen getrennt optimiert
werden. Der Hauptscreen darf informativ sein, aber das Hinzufügen und Ändern
eines Artikels sollte so wenig Pflichtfelder und Wiederholung wie möglich
erfordern.

#### PantryVault

[PantryVault im Apple App Store](https://apps.apple.com/us/app/pantryvault/id6755187375?platform=ipad)

Beobachtet:

- Mehrere Darstellungsmodi: Liste, Grid, Bereiche und Aktionen.
- Widgets für „Expiring Soon“ und „Low Stock“.
- Eine tägliche „Use It First“-Ansicht.
- Rezeptvorschläge für Artikel mit nahendem MHD.
- Restock-/Smart-Refill-Vorschläge.
- Konfigurierbare zusätzliche Lagerbereiche.
- Schnelle Aktualisierung der Menge über Widget-Aktionen.

Ableitung für Haushaltsapp: Ein Inventar-Screen muss nicht dauerhaft alle
Informationen in einer Darstellung zeigen. Ein fokussierter Modus oder ein
Widget kann dringende Zustände abbilden, während die vollständige Liste als
verlässliche Quelle erhalten bleibt.

#### Zimmer

[Zimmer: Shared meal plan and pantry](https://zimmerfood.com/sharing/)

Beobachtet:

- Gemeinsamer Pantry-Bestand, Einkaufszettel und Essensplan.
- Haushalte können auswählen, welche Bereiche sie teilen.
- Der letzte Bearbeiter eines Artikels kann sichtbar gemacht werden.
- Ziel ist, Nachfragen und Doppelkäufe innerhalb des Haushalts zu vermeiden.

Ableitung für Haushaltsapp: Bearbeiter- oder Aktivitätsinformationen können bei
geteilten Daten nützlich sein, sollten aber nicht die primäre Bestandsinformation
überdecken.

### Screenshot- und UI-Referenzen

Diese Quellen wurden zusätzlich für visuelle Muster betrachtet:

- [NoWaste Screenshots und UI-Beschreibungen bei MWM](https://mwm.ai/apps/nowaste-food-inventory-list/)
- [NoWaste-Apptest der Verbraucherzentrale](https://www.verbraucherzentrale.de/wissen/digitale-welt/apps-und-software/apptest-nowaste-lebensmittelliste-die-digitale-speisekammer-95921)
- [KitchenPal FAQ mit Inventar-Screenshot](https://kitchenpalapp.com/en/faqs/kitchen.html)

Die visuellen Beobachtungen wurden nur als Inspiration genutzt. Es wurden keine
Screenshots, Markenassets oder fremde UI-Bausteine in die App übernommen.

## Verdichtete Erkenntnisse

### Was sich wiederholt

1. **Use-first statt nur Bestand anzeigen**

   Der relevante Wert entsteht, wenn ein nahendes MHD zu einer konkreten
   Handlung führt.

2. **Bestand, Essensplan und Einkaufsliste verbinden**

   Eine gute Übersicht verhindert nicht nur Verschwendung, sondern auch
   Doppelkäufe und wiederholte Eingabe.

3. **Lagerorte als echte Orientierung verwenden**

   Kühlschrank, Vorrat und Tiefkühlfach sind nicht nur Kategorien. Sie sind
   reale Orte, an denen Nutzer den Bestand suchen und bearbeiten.

4. **Vollständigkeit und Fokus trennen**

   Eine fokussierte „Use first“- oder Widget-Ansicht kann sinnvoll sein, darf
   aber nicht die vollständige, durchsuchbare Bestandsansicht ersetzen.

5. **Erfassung frictionarm machen**

   Scan, Foto, Sprache und optionale Felder senken den Pflegeaufwand. Das ist
   ein eigener Workflow und sollte nicht mit dem Überblick überladen werden.

6. **Haushaltszustand sichtbar, private Daten getrennt halten**

   Bearbeiter, Synchronisationsstatus und gemeinsame Aktionen gehören in den
   Haushaltskontext. Private Tracking-Daten bleiben davon getrennt.

### Was vermieden werden sollte

- Radiale oder orbitartige Navigation, wenn sie keine schnellere Entscheidung
  ermöglicht.
- Eine Shelf-Metapher ohne klare Zuordnung zu echten Lagerorten.
- Zu viele gleichgewichtete Statuskarten.
- MHD-Signale, die ausschließlich über Farbe verständlich sind.
- Eine automatische Aktion, die Bestand, Essensplan oder Einkaufsliste ohne
  ausdrückliche Nutzerentscheidung verändert.

## Vorschau-Dateien

Die Gesprächsvorschauen sind weiterhin als eigenständige statische Dateien
vorhanden und werden durch diese Research-Unterlage erklärt:

- [Erste drei Richtungen](../../inventory-overview-options.html)
- [Moderne Richtungen 01 bis 05](../../inventory-overview-modern-options.html)
- [Recherchebasierte Richtungen A bis C](../../inventory-overview-researched-options.html)

Die Vorschauen sind keine Produktionsimplementierung. Vor einer Umsetzung muss
eine Richtung ausgewählt und in einen überprüfbaren, fokussierten Umfang
überführt werden.

## Guardrails für eine spätere Umsetzung

- Keine Änderung an Datenmodell, RLS, Sync oder Outbox nur für eine neue
  Darstellung.
- Bestehende Inventar- und MHD-Owner weiterverwenden.
- Semantische Farben, Typografie und Interaktionszustände ausschließlich über
  die zentralen Fam-UI- und Unistyles-Owner beziehen.
- Keine `className`- oder `contentContainerClassName`-Einführung.
- Jede neue Aktion erhält ihr logisches Gegenstück.
- Für die gewählte Richtung gezielte Tests der Sortierung, Gruppierung und
  relevanten Zustände ergänzen.
- iOS und Android nach der Umsetzung nativ prüfen.
