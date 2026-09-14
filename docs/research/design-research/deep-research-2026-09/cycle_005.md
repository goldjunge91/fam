# Cycle 005: Widgets und glanzbare Inventarflächen

## Forschungsfrage

Welche Informationen und Aktionen des Vorrats sind außerhalb der App sinnvoll sichtbar, und wie kann ein Widget mehr leisten als ein App-Icon mit einer Zahl?

## Plattformprinzipien

Apple beschreibt Widgets als zeitnahe, fokussierte Informationen mit passenden Deep Links und optionalen einfachen Aktionen. Ein Widget soll nicht die App kopieren, sondern eine kleine, eigenständige Aufgabe direkt aus dem Kontext heraus unterstützen. Apple empfiehlt außerdem, nur dann mehrere Größen anzubieten, wenn jede Größe zusätzlichen Nutzen liefert. [Apple Human Interface Guidelines: Widgets](https://developer.apple.com/design/human-interface-guidelines/widgets)

Android unterscheidet Informations-, Collection-, Control- und Hybrid-Widgets. Collection-Widgets können mehrere Einträge zeigen und einfache Aktionen wie „erledigt“ unterstützen. Die Plattform empfiehlt kleine, glanceable Informationsmengen, flexible Größen und direkte Navigation in den passenden Detailbereich. [Android Developers: App widgets overview](https://developer.android.com/develop/ui/views/appwidgets/overview)

## Wettbewerbsbefund

PantryVault bietet bereits Expiring-Soon- und Low-Stock-Widgets, inklusive einer „Used One“-Aktion und einem direkten Einstieg in die „Use It First“-Ansicht. Damit ist „wir haben ein Ablaufdaten-Widget“ kein eigenständiger Differenzierungsgrund. [PantryVault App Store](https://apps.apple.com/us/app/pantryvault/id6755187375)

EatFirst beschreibt zusätzlich ein dauerhaft sichtbares E-Ink-Panel an der Kühlschranktür mit einer kurzen Liste von Artikeln, die heute oder bald verwendet werden sollten. Das ist eine interessante Ambient-Idee, aber kein notwendiger Bestandteil einer mobilen ersten Version. [EatFirst](https://eatfirst.app/)

## Designvorschlag

Ein sinnvoller Widget-Satz wäre:

### Klein: „Was zuerst?“

Eine Zahl und der dringendste Artikel, zum Beispiel „2 heute“. Tap öffnet direkt den Use-first-Fokus. Das ist ein Informations-Widget und bleibt auch bei minimaler Fläche verständlich.

### Mittel: „Jetzt verwenden“

Die zwei oder drei wichtigsten Einträge mit Menge und kurzer Datumsart. Jeder Eintrag öffnet sein Detail; eine einzige prominente „1 verwendet“-Aktion kann sinnvoll sein, wenn die Datenlage aktuell ist.

### Groß: Haushaltsstatus

Dringende Artikel, ein neutraler Synchronisationsstatus und eine kompakte Aktion für die gesamte Gruppe. Kein vollständiger Vorrat und keine lange Historie.

## Vertrauensregeln

Ein Widget darf keine veraltete oder unsichere Information als aktuelle Gewissheit darstellen. Bei Offline- oder Synchronisationsunsicherheit sollte es zurückhaltend bleiben und beim Öffnen die Aktualisierung erklären. Eine direkte „verwendet“-Aktion braucht Undo und muss bei Konflikten eine nachvollziehbare Rückmeldung geben.

## Synthese

Widgets sind eher ein Verstärker der Inventarlogik als die Innovation selbst. Der eigentliche Vorteil entsteht, wenn das Widget die richtige nächste Handlung mit einem Tap erreichbar macht und die App anschließend direkt beim betroffenen Artikel öffnet. Ein Widget mit bloßem „12 Lebensmittel im Vorrat“ erzeugt Aufmerksamkeit, aber keine Waste-reduzierende Handlung.

## Validierung

Prototypen in klein, mittel und groß mit vier Zuständen testen: keine dringenden Artikel, ein Artikel heute, mehrere Artikel mit unterschiedlichen Datumsarten und nicht synchronisierte Daten. Messen:

- Erkennen Personen die Bedeutung ohne App-Kontext?
- Öffnen sie den richtigen Artikel?
- Wird eine Menge korrekt reduziert?
- Verstehen sie alte oder unsichere Daten?
- Bleibt die Darstellung in verschiedenen Größen, Themes und Plattformen lesbar?

## Quellen

1. Apple, „Widgets“, https://developer.apple.com/design/human-interface-guidelines/widgets
2. Android Developers, „App widgets overview“, https://developer.android.com/develop/ui/views/appwidgets/overview
3. PantryVault, Apple App Store, https://apps.apple.com/us/app/pantryvault/id6755187375
4. EatFirst, https://eatfirst.app/
