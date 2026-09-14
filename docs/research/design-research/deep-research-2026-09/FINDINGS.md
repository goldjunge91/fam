# Inventar-Redesign für die Haushaltsapp

## Forschungsrahmen

Untersucht wurde die mobile Inventaransicht einer haushalts- und familienorientierten App. Der primäre Nutzerjob ist, den Lebensmittelbestand zu verstehen und Food Waste zu vermeiden. Onboarding, Kassenbon-Import und die Erfassungshierarchie sind nicht Gegenstand dieser Recherche.

Die Recherche beantwortet die beiden Fragen aus dem Brief: Welche Inventarmuster nutzen Wettbewerber, und welche übertragbaren Interaktionsmodelle gibt es außerhalb der Food-Kategorie? Die Evidenz besteht aus offiziellen Produktseiten, App-Store-Beschreibungen, Plattformrichtlinien und wissenschaftlichen Veröffentlichungen. Produktseiten belegen Produktversprechen und beschriebene Funktionen, nicht automatisch die Qualität der tatsächlichen Nutzung.

## Executive Summary

Die beste Differenzierung ist keine weitere Kategorieansicht und kein virtuelles 3D-Regal. Sie ist eine lebende Bestandsansicht, die den vollständigen Haushalt sichtbar hält und gleichzeitig die nächste sinnvolle Verbrauchsaktion priorisiert.

Der Kern sollte aus fünf Entscheidungen bestehen:

1. **Use-first als erste Ebene:** Was sollte jetzt oder als Nächstes verwendet werden?
2. **Vollständiger Bestand als zweite Ebene:** Suche, Mengen, Lagerorte und Kategorien bleiben jederzeit zugänglich.
3. **Erklärbare Dringlichkeit:** Der Grund für die Priorisierung muss sichtbar sein.
4. **Ein-Tap-Verbrauch:** „1 verwendet“, „teilweise verwendet“ und „weggeworfen“ aktualisieren den Zustand sofort.
5. **Haushaltsklarheit:** Die letzte relevante Änderung, die beteiligte Person und eine Rückgängig-Aktion bleiben nachvollziehbar.

Das stärkste Produktprinzip lautet:

> Zeige nicht nur, was vorhanden ist. Zeige, was als Nächstes sinnvoll damit passieren kann, und halte den Bestand nach dieser Handlung korrekt.

## 1. Wettbewerbslandschaft

### Etablierte Muster

| Produkt | Beschriebene Inventarlogik | Schlussfolgerung |
|---|---|---|
| KitchenPal | Single-Screen-Ansicht nach Produktkategorie und Multi-Tab-Ansicht nach Lagerort. Sortierung, eigene Kategorien, Drag-and-drop zwischen Lagerorten und Batch-Verschieben. [^1] | Lagerort und Kategorie sind nützliche Perspektiven, aber nicht zwingend die einzige Primäransicht. |
| Your Food | Eine lesbare Gesamtansicht, optionale Details für Menge, Datum, Preis, Einheit und Notiz sowie eine „use first“-Orientierung. [^2] | Wenige sichtbare Pflichtinformationen halten lange Listen verständlich. |
| NoWaste | Sortierung nach Ablaufdatum, Name oder Kategorie, Filter nach Kategorie oder Platzierung, Kalender, mehrere Listen und Batch-Use. [^3] | Verwaltungstiefe ist vorhanden, kann aber die tägliche Kernhandlung überlagern. |
| PantryVault | „Use It First“, Waste-Status „used or tossed“, Batch-Use, mehrere Darstellungen und Aktionen aus Expiring-Soon-Widgets. [^4] | Verbrauchsorientierung und direkte Zustandsänderung sind bereits die wichtigste neue Wettbewerbsschicht. |
| Zimmer | Pantry mit Mengen, gemeinsamer Zustand und Anzeige, wer einen Eintrag hinzugefügt hat. [^5] | Attribution beantwortet Rückfragen im Haushalt und reduziert doppelte Annahmen. |

### Weitere relevante Produkte

Die zusätzliche Recherche zeigt, dass der Markt bereits deutlich über reine Ablaufdatenlisten hinausgeht:

- Foodminder beschreibt eine tägliche „Use soon“-Sektion mit wenigen priorisierten Einträgen, Menge beziehungsweise Wert und einem konkreten Use-it-up-Vorschlag. [^6]
- EatFirst beschreibt eine selbstsortierende Liste, die nach dem frühesten relevanten Zeitpunkt ordnet und „best before“ von „use by“ trennt. [^7]
- ok2eat organisiert das Produkt um eine „Eat Me First“-Ansicht und liefert neben dem dringendsten Artikel weitere dringende Artikel als Kontext. [^8]
- Celier trennt Küchenübersicht, fokussierte Rezeptentscheidung und spätere Nutzungsanalyse. [^9]

### Marktgap

Die Grundfunktionen sind weitgehend standardisiert: Lagerort, Kategorie, Menge, Datum, Suche und Erinnerungen. Ein weiteres Feld oder eine weitere Sortieroption wäre deshalb keine überzeugende Innovation.

Die offene Position liegt zwischen zwei Extremen:

- reine Verwaltungsdatenbank, die alles speichert, aber keine nächste Handlung anbietet;
- stark automatisierte „Dinner AI“, die eine Entscheidung übernimmt und den Bestand als unsichere Grundlage behandelt.

Die Haushaltsapp kann sich dazwischen positionieren: vollständiger, kontrollierbarer Bestand mit einer kleinen, erklärbaren Handlungsschicht.

## 2. Empfohlene Informationsarchitektur

### Ebene A: Jetzt verwenden

Die Startansicht zeigt maximal drei bis fünf priorisierte Einträge. Jeder Eintrag enthält:

- Produktname und gegebenenfalls Miniatur;
- verbleibende Menge;
- Lagerort als kurze Orientierung;
- Datumsart und Datum oder Öffnungsstatus;
- konkreten Priorisierungsgrund;
- primäre Aktion „1 verwendet“.

Beispiel:

```text
Spinat · 1 Beutel · Kühlschrank
Heute verwenden · geöffnet vor 2 Tagen
[1 verwendet] [Mehr]
```

Die Priorisierung darf nicht als undurchsichtiger Score erscheinen. „Heute verwenden“ ist nur vertrauenswürdig, wenn klar ist, ob der Grund ein Verbrauchsdatum, ein Mindesthaltbarkeitsdatum, ein Öffnungsdatum oder eine unsichere Schätzung ist.

### Ebene B: Vollständiger Bestand

Die vollständige Liste bleibt ein gleichwertiger, aber sekundärer Einstieg. Sie benötigt:

- Suche;
- Lagerortfilter;
- Kategoriefilter;
- Statusfilter;
- Anzeige von Artikeln ohne Datumsangabe;
- Batch-Aktionen für mehrere gleiche oder verwandte Einträge.

Ein Use-first-Einstieg ersetzt die Bestandsansicht nicht. Er legt nur fest, welche Entscheidung beim Öffnen zuerst unterstützt wird.

### Ebene C: Detail und Verlauf

Die Detailansicht enthält die vollständige Bedeutung des Artikels: Einheiten, Lagerort, Datumsart, Datum, Öffnungszustand, Quelle der Angabe, letzte Änderungen sowie Rückgängig- und Korrekturoptionen.

## 3. Datums- und Sicherheitslogik

Die Europäische Kommission unterscheidet „use by“ als Sicherheitsangabe und „best before“ als Qualitätsangabe. Sie berichtet außerdem, dass Verbraucherinnen und Verbraucher Datumsangaben häufig nicht ausreichend unterscheiden und dass Missverständnisse Food Waste begünstigen. [^10]

Das Bundeszentrum für Ernährung beschreibt für Deutschland das Verbrauchsdatum als Endpunkt für leicht verderbliche Lebensmittel. Ein überschrittenes Mindesthaltbarkeitsdatum ist dagegen kein automatisches Wegwerfdatum. Lagerung, Öffnung und der Zustand des Lebensmittels bleiben relevant. [^11] [^12]

Daraus folgt eine verbindliche UI-Regel: Es darf keinen einzigen universellen Status „abgelaufen“ geben.

Empfohlene semantische Zustände:

| Zustand | Bedeutung | UI-Handlung |
|---|---|---|
| Verbrauchsdatum heute | sicherheitsrelevante Dringlichkeit | heute verbrauchen oder fachlich abgesicherte Folgeaktion zeigen |
| Verbrauchsdatum überschritten | nicht als normal weiter essbar darstellen | klar warnen, keine beschwichtigende „prüfen und essen“-Logik |
| MHD bald | Qualitätsverlust kann bevorstehen | bald verwenden, nicht dramatisieren |
| MHD überschritten | kein automatisches Wegwerfdatum | prüfen, Datumstyp sichtbar lassen |
| geöffnet | ursprüngliche Packungslogik kann nicht mehr genügen | Öffnungsdatum und passende Folgeinformation zeigen |
| kein Datum | keine künstliche Präzision | neutral anzeigen, Prüfung und Lagerung beachten |

Automatisch vorgeschlagene Daten müssen als Vorschlag erkennbar sein. Die App darf eine Schätzung nicht wie ein aufgedrucktes Herstellerdatum behandeln.

## 4. Die zentrale Verbrauchsschleife

Wissenschaftliche Arbeiten zeigen, dass Inventarwissen und Datumsbewusstsein sinnvolle Hebel sein können, dass aber die Pflegekosten und die fehlende konkrete Handlung die Wirksamkeit begrenzen. [^13] [^14]

Eine randomisierte Feldstudie zu einem wöchentlichen „Use-up day“ mit flexiblen Rezepten fand deutliche Reduktionen der selbstberichteten Verschwendung. Zusätzliche Sichtbarkeitshilfen wie Korb, Clips oder Whiteboard hatten keinen zusätzlichen Effekt. Die Schlussfolgerung ist nicht, dass Sichtbarkeit nutzlos ist, sondern dass Sichtbarkeit ohne machbare Handlung nicht genügt. [^15]

Die App sollte daher eine kurze Schleife unterstützen:

```text
sehen → auswählen → verwenden → Menge aktualisieren → nächste Priorität
```

Die minimalen Zustandsaktionen sind:

- **1 verwendet:** Menge um eine Einheit reduzieren;
- **teilweise verwendet:** Restmenge eintragen;
- **eingefroren:** Lager- und Frischekontext aktualisieren;
- **weggeworfen:** Waste getrennt vom Verbrauch erfassen;
- **noch vorhanden:** versehentliche Entfernung verhindern oder rückgängig machen.

Ein Streak, ein Score oder eine gerettete Geldsumme darf erst nach einer echten Zustandsänderung entstehen. Die App sollte nicht behaupten, Waste reduziert zu haben, nur weil eine Karte angesehen oder eine Warnung zugestellt wurde.

## 5. Übertragbare Muster außerhalb der Food-Kategorie

### Visuelles Wiederfinden

Sortly und die Home-Inventory-App der National Association of Insurance Commissioners nutzen Fotos und reale Orte, um Gegenstände leichter wiederzufinden. [^16] [^17]

Für Lebensmittel bedeutet das: Produktminiaturen können ähnliche Verpackungen unterscheiden und das visuelle Gedächtnis unterstützen. Ein Foto sollte aber optional bleiben. Der primäre Bestand muss auch ohne Fotos klar und schnell scanbar sein.

### Nutzungshistorie

Digitale Garderoben kombinieren eine visuelle Übersicht mit einer Nutzungshistorie und Analysen für häufig oder selten verwendete Gegenstände. [^18]

Übertragen auf den Vorrat ist eine kleine Historie sinnvoll, wenn sie Entscheidungen verbessert: Wird ein Artikel regelmäßig vergessen, häufig weggeworfen oder zu großzügig eingekauft? Diese Information gehört in Insights oder eine Detailansicht, nicht als tägliche Rangliste auf den Startbildschirm.

### Statusfluss

Kanban macht Zustände und Übergänge sichtbar. [^19] Ein vollständiges Kanban-Board wäre für Lebensmittel zu schwer, weil ein Artikel gleichzeitig Menge, Ort, Datumsart und Öffnungsstatus besitzt.

Übertragbar ist nur das Prinzip der sichtbaren Zustandsänderung:

`im Bestand → geöffnet → zuerst verwenden → verwendet / entsorgt`

Das eignet sich als Filter, Batch-Ansicht oder Detailverlauf, nicht als dauerhafte Standardnavigation.

## 6. Haushaltssynchronisation

Der gemeinsame Bestand braucht keine Chat-Oberfläche. Er braucht Vertrauen:

1. aktuelle Menge;
2. letzte relevante Änderung;
3. beteiligte Person;
4. Zeitangabe;
5. Rückgängig oder Wiederherstellen.

Zimmer zeigt, wer einen Artikel hinzugefügt hat, und HomeVault beschreibt einen Activity Feed für hinzugefügte und verwendete Artikel. [^5] [^20] WhereKeep ergänzt Rollen wie Owner, Editor und Viewer. [^21]

Empfohlene Darstellung:

```text
Joghurt · 2 Becher · Kühlschrank
Mara hat 1 verwendet · gerade eben
[Rückgängig]
```

Die Anzeige darf nicht in eine Personenrangliste kippen. Waste-Statistiken sollten standardmäßig auf Haushaltsebene aggregiert werden. Bei konkurrierenden Änderungen muss die UI die neue Menge zeigen und bei Bedarf erklären, dass sie zwischenzeitlich aktualisiert wurde.

## 7. Widgets und Ambient Surfaces

Apple und Android beschreiben Widgets als kleine, zeitnahe Informations- und Handlungseinheiten. Sie sollen direkt zur passenden Detailansicht führen, nur wenige relevante Informationen zeigen und nicht die komplette App kopieren. [^22] [^23]

PantryVault bietet bereits Expiring-Soon- und Low-Stock-Widgets mit einer „Used One“-Aktion. Ein Widget allein ist deshalb kein Differenzierungsmerkmal. [^4]

Falls Widgets umgesetzt werden, ist folgende Staffelung sinnvoll:

- **klein:** „2 heute“ und der dringendste Artikel;
- **mittel:** zwei bis drei „Jetzt verwenden“-Einträge;
- **groß:** dringende Artikel, Haushaltsstatus und Sync-Hinweis.

Eine direkte Verbrauchsaktion braucht Undo, muss bei veralteten Daten vorsichtig sein und darf keine unsichere Information als Gewissheit darstellen. Ein E-Ink- oder Kühlschrank-Display ist eine interessante spätere Ambient-Fläche, aber nicht notwendig für die mobile erste Version.

## 8. Priorisierte Produktentscheidungen

### P0: Use-first über dem vollständigen Bestand

Die Startansicht priorisiert konkrete Verbrauchsentscheidungen. Lagerort, Kategorie und Suche bleiben verfügbar, aber nicht als einzige Hauptlogik.

### P0: Datumstyp und Priorisierungsgrund sichtbar machen

MHD, Verbrauchsdatum, Öffnungsstatus und unbekannte Daten werden semantisch getrennt. Kein pauschaler „abgelaufen“-Status.

### P1: Verbrauch als Erstklassigkeit

„Verwendet“, Teilmenge, „eingefroren“ und „weggeworfen“ sind direkte, reversible Zustandsaktionen. Der Bestand aktualisiert sich unmittelbar.

### P1: Haushaltsverlauf in kleiner Dosis

Letzte Änderung und Person auf Detail- oder Kartenebene, vollständiger Verlauf sekundär. Keine Schuld- oder Aktivitätsrangliste.

### P2: Widgets als Verstärker

Widgets erst nach stabiler Priorisierung und Konfliktbehandlung. Sie sollen eine konkrete Inventarhandlung verkürzen, nicht nur eine Zahl anzeigen.

## 9. Validierungsplan

Ein Prototyp sollte drei Informationsarchitekturen vergleichen:

- Lagerort-first;
- Kategorie-first;
- Use-first über vollständigem Bestand.

Aufgaben:

1. „Was soll heute zuerst verwendet werden?“
2. „Wo liegt die zweite Packung?“
3. „Welche Artikel haben ein Verbrauchsdatum?“
4. „Was ist ohne Datumsangabe?“
5. „Ich habe eine Einheit verwendet, was muss ich antippen?“
6. „Zwei Personen ändern dieselbe Menge, was ist passiert?“

Metriken:

- Zeit bis zur korrekten ersten Handlung;
- falsche Priorisierungen;
- Fehler bei Teilmengen;
- Korrektur- und Undo-Rate;
- Aktualität des Bestands nach sieben und vierzehn Tagen;
- tatsächlich verwendete und entsorgte Mengen;
- Verständnis von MHD, Verbrauchsdatum und geschätztem Datum;
- Vertrauen bei synchronen und verzögerten Änderungen.

Der Erfolg ist nicht die schönste Oberfläche. Erfolg ist ein Bestand, der im Alltag ausreichend aktuell bleibt und eine richtige nächste Handlung wahrscheinlicher macht.

## 10. Offene Fragen

- Wie genau soll die App mit losen Lebensmitteln ohne Datum umgehen?
- Welche Datenquelle darf Haltbarkeits- oder Öffnungsvorschläge liefern?
- Wie werden Einheiten wie „halbe Packung“ oder Gramm sauber dargestellt?
- Welche Rolle darf ein Kind im Haushalt haben: nur ansehen, verwenden markieren oder auch korrigieren?
- Wie wird eine Offline-Änderung visuell von einer bestätigten synchronisierten Änderung unterschieden?
- Welche Haushaltsmetriken helfen wirklich, ohne Druck oder Schuld zu erzeugen?

## Ergänzende Wettbewerbsrecherche

Die zusätzliche Recherche zu weiteren Inventar-, Küchen-, Einkaufslisten- und Haushalts-Apps ist in [additional-apps-2026-09.md](additional-apps-2026-09.md) dokumentiert. Sie ergänzt die ursprünglichen Zyklen 000–006 um die Zyklen 007–010.

## Visuelle UI-Recherche

Die separate Screenshot-Sammlung mit 12 öffentlich zugänglichen UI-Referenzen und einer zitierten Auswertung liegt in [ui-ideas-2026-09.md](ui-ideas-2026-09.md). Die lokal gespeicherten Bilder und ihre Provenienz stehen in [ui-inspiration-screenshots-2026-09/README.md](ui-inspiration-screenshots-2026-09/README.md). Die visuelle Galerie ist [ui-inspiration-gallery.html](ui-inspiration-gallery.html).

## Quellen

1. KitchenPal, „Kitchen Inventory & Storage FAQs“, https://kitchenpalapp.com/en/faqs/kitchen.html
2. Your Food, „No Waste Inventory“, https://yourfood.app/
3. NoWaste, Apple App Store, https://apps.apple.com/us/app/nowaste-food-inventory-list/id926211004
4. PantryVault, Apple App Store, https://apps.apple.com/us/app/pantryvault/id6755187375
5. Zimmer, „Sharing“, https://zimmerfood.com/sharing/
6. Foodminder, https://www.foodminder.app/
7. EatFirst, https://eatfirst.app/
8. ok2eat, https://ok2eat.com/
9. Celier, https://www.celier.app/
10. European Commission, „Date marking and food waste prevention“, https://food.ec.europa.eu/food-safety/food-waste/eu-actions-against-food-waste/date-marking-and-food-waste-prevention_en?prefLang=fi
11. Bundeszentrum für Ernährung, „Haltbarkeit von Lebensmitteln“, https://www.bzfe.de/kueche-und-alltag/kochen/haltbarkeit-von-lebensmitteln
12. Bundeszentrum für Ernährung, „Lagerung“, https://www.bzfe.de/einfache-sprache/kochen-und-aufbewahren/lagerung
13. Mastorakis et al., „Managing Household Food Waste with the FoodSaveShare Mobile Application“, Sustainability 2024, https://doi.org/10.3390/su16072800
14. Castro et al., „Less Is More: Preventing Household Food Waste through an Integrated Mobile Application“, Sustainability 2023, https://doi.org/10.3390/su151310597
15. Cooper et al., „Use-up day and flexible recipes“, Resources, Conservation & Recycling 2023, https://doi.org/10.1016/j.resconrec.2023.106986
16. Sortly, „Home Inventory Software“, https://www.sortly.com/solutions/home-inventory-software/
17. National Association of Insurance Commissioners, „Home Inventory“, https://content.naic.org/consumer/home-inventory
18. DGCloset, https://www.dgcloset.com/
19. Atlassian, „What is a kanban board?“, https://www.atlassian.com/agile/kanban/boards/
20. HomeVault, https://www.thehomevaultapp.com/
21. WhereKeep, https://www.wherekeep.com/
22. Apple, „Widgets“, https://developer.apple.com/design/human-interface-guidelines/widgets
23. Android Developers, „App widgets overview“, https://developer.android.com/develop/ui/views/appwidgets/overview

[^1]: KitchenPal, „Kitchen Inventory & Storage FAQs“, https://kitchenpalapp.com/en/faqs/kitchen.html
[^2]: Your Food, „No Waste Inventory“, https://yourfood.app/
[^3]: NoWaste, Apple App Store, https://apps.apple.com/us/app/nowaste-food-inventory-list/id926211004
[^4]: PantryVault, Apple App Store, https://apps.apple.com/us/app/pantryvault/id6755187375
[^5]: Zimmer, „Sharing“, https://zimmerfood.com/sharing/
[^6]: Foodminder, https://www.foodminder.app/
[^7]: EatFirst, https://eatfirst.app/
[^8]: ok2eat, https://ok2eat.com/
[^9]: Celier, https://www.celier.app/
[^10]: European Commission, „Date marking and food waste prevention“, https://food.ec.europa.eu/food-safety/food-waste/eu-actions-against-food-waste/date-marking-and-food-waste-prevention_en?prefLang=fi
[^11]: Bundeszentrum für Ernährung, „Haltbarkeit von Lebensmitteln“, https://www.bzfe.de/kueche-und-alltag/kochen/haltbarkeit-von-lebensmitteln
[^12]: Bundeszentrum für Ernährung, „Lagerung“, https://www.bzfe.de/einfache-sprache/kochen-und-aufbewahren/lagerung
[^13]: Mastorakis et al., „Managing Household Food Waste with the FoodSaveShare Mobile Application“, Sustainability 2024, https://doi.org/10.3390/su16072800
[^14]: Castro et al., „Less Is More: Preventing Household Food Waste through an Integrated Mobile Application“, Sustainability 2023, https://doi.org/10.3390/su151310597
[^15]: Cooper et al., „Use-up day and flexible recipes“, Resources, Conservation & Recycling 2023, https://doi.org/10.1016/j.resconrec.2023.106986
[^16]: Sortly, „Home Inventory Software“, https://www.sortly.com/solutions/home-inventory-software/
[^17]: National Association of Insurance Commissioners, „Home Inventory“, https://content.naic.org/consumer/home-inventory
[^18]: DGCloset, https://www.dgcloset.com/
[^19]: Atlassian, „What is a kanban board?“, https://www.atlassian.com/agile/kanban/boards/
[^20]: HomeVault, https://www.thehomevaultapp.com/
[^21]: WhereKeep, https://www.wherekeep.com/
[^22]: Apple, „Widgets“, https://developer.apple.com/design/human-interface-guidelines/widgets
[^23]: Android Developers, „App widgets overview“, https://developer.android.com/develop/ui/views/appwidgets/overview
