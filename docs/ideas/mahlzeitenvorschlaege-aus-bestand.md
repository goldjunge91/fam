# Ideensammlung: Mahlzeitenvorschläge aus dem Bestand

**Status:** Unverbindliche Ideensammlung, keine Implementierungsfreigabe  
**Stand:** 2026-11-07  
**Herkunft:** Drei von Marco eingereichte Entwurfstexte zu Einstieg, Kontextaufbereitung und zweistufiger Rezeptanzeige.

Diese Sammlung bewahrt die Produktideen der Entwürfe. Beispielcode, Dateinamen, API-Formen und behauptete Messwerte aus den Originaltexten sind keine Vorgabe. Für das Zielverhalten gilt die [fachlich abgestimmte Spezifikation](../specs/food-waste-meal-suggestions/food-waste-meal-suggestions.md); für das aktuelle Verhalten gelten Schema und Produktionscode. Die neue Funktion soll laut Spezifikation eigene Verträge erhalten und bestehende KI-Workflows nicht stillschweigend erweitern.

## Einstieg und Anzeige

- Die Einkaufsabsicht vor einer Anfrage in der Oberfläche erfassen, falls sie für den gewählten Ablauf benötigt wird. Eine Voreinstellung „ohne Einkauf“ könnte unnötige Rückfragen vermeiden. Ob und wie die Einkaufsliste dafür berücksichtigt wird, muss mit dem fachlichen Ablauf abgestimmt werden.
- Portionszahl und Zeitlimit leicht erreichbar machen. Die Anzahl der Haushalts-Accounts ist keine verlässliche Zahl der Mitessenden; eine Auswahl der Teilnehmenden oder eine ausdrücklich gewählte Portionszahl ist präziser.
- Kurze Auswahlmöglichkeiten wie „unter 20 Minuten“ oder „wenig Abwasch“ als mögliche Eingabehilfe prüfen. Ihre Wirkung auf die Anfrage und die visuelle Gestaltung sind offen.
- Berücksichtigte Ernährungsregeln verständlich anzeigen, ohne private Regeln einzelner Personen offenzulegen.
- Die Detailansicht könnte Zutaten unmittelbar zeigen. Ein sichtbarer Ladezustand für spätere Inhalte bleibt eine mögliche Variante für eine spätere, eigens entschiedene Architektur.

## Kontext, Auswahl und Kosten

- Geeignete Bestände serverseitig nach wirksamem MHD, verifizierter Verderblichkeit, verfügbarer Menge und Rezepttauglichkeit priorisieren. Für geöffnete Produkte gilt die abgeleitete Haltbarkeit des Inventarmoduls; „geöffnet“ allein ist keine feste Dringlichkeitsklasse.
- Große Bestände vor einem Modellaufruf auf einen begründeten, begrenzten Ausschnitt reduzieren. Die Auswahl und ihre Begründung gehören in deterministische Domänenlogik.
- Vorhandene Katalogrezepte und geeignete Haushaltsrezepte zuerst ohne Modell prüfen. Der Entwurf nennt einen solchen Schnellweg, der im derzeitigen `ai-gateway` noch nicht implementiert ist.
- Modellantworten mit einem versionierten Schema und fachlichen Regeln prüfen. Insbesondere Referenzen, Mengen, Einheiten, Allergien, Zubereitungsmuster und unterschiedliche Vorschläge müssen serverseitig validiert werden. Ungültige Vorschläge werden verworfen, nicht stillschweigend durch Löschen einzelner Felder repariert.
- Nur Wasser, Salz, Pfeffer und neutrales Speiseöl sind laut Spezifikation global vorausgesetzt. Der im Entwurf vorgeschlagene größere Satz aus Butter, Mehl, Zucker, Brühe, Essig und Senf bleibt eine verworfene Annahme für Version 1.
- Eine kompakte Sitzungszusammenfassung statt kompletter History wäre erst bei einer später ausdrücklich gewählten Gesprächsfunktion relevant. Die erste Version sieht keine allgemeine Chatfunktion vor.

## Kochen, Einkauf und Bestandsreview

- Fehlende Zutaten mit der aktuellen Einkaufsliste deterministisch abgleichen. Vorhandene Listeneinträge können sichtbar markiert und bei einer bestätigten Übernahme berücksichtigt werden. Modellgenerierte `alreadyOnShoppingList`-Werte sind dafür keine Autorität.
- „Gekocht“ als eigenständige Nutzeraktion mit vorausgefülltem Bestandsreview prüfen. Mengen müssen korrigierbar und abwählbar sein. Erst bestätigte Mengen laufen über die normalen `out`-Transaktionen des Inventarmoduls.
- Eine Modellantwort darf keinen endgültigen Wert für „vollständig verbraucht“ festlegen und keine direkte Löschung oder Mengenänderung auslösen.
- Katalogrezepte besitzen bereits redaktionelle Schritte. Für den begrenzten generativen Fallback werden Schritte aus geprüften Zubereitungsmustern gerendert.

## Spätere Experimente

- **Vorschau und Details in zwei Anfragen:** Der Entwurf schlägt kurze Rezeptkarten und später erzeugte Kochschritte samt Snapshot-Cache vor. Das widerspricht derzeit dem auf einen Modellaufruf begrenzten Fallback und dem Verbot frei generierter Kochschritte. Nur nach einer neuen fachlichen Entscheidung und einem Vergleich von Qualität, Gesamtkosten und Latenz erneut prüfen.
- **Vorabladen des ersten Vorschlags:** Könnte die Wartezeit beim Öffnen verkürzen, verursacht aber Modellkosten auch ohne Auswahl. Erst mit echten Nutzungsdaten und einer geklärten Kostenregel beurteilen.
- **Rezepte in den globalen Katalog übernehmen:** Ein Koch- oder Bewertungssignal kann Kandidaten für eine separate redaktionelle Prüfung liefern. Es berechtigt nicht zur automatischen Veröffentlichung von Haushaltsinhalten.

Die im Entwurf genannten Werte von 60–70 % kürzerer Wartezeit, 80 % weniger Input-Tokens, 1,5 Sekunden für Details und 65 % Auswahl des ersten Vorschlags sind Hypothesen ohne Messnachweis für diese App.

## Inspiration: fünf Merran-Beispiele

Marco hat fünf Einstiege aus der [interaktiven Merran-Vorschau](https://merran.app/) als Ideen für spätere Produktabläufe eingebracht. Die Website bezeichnet diese Beispiele ausdrücklich als geskriptete Vorschau mit Beispieldaten. Sie belegen ein Interaktionskonzept, nicht die Qualität einer laufenden KI oder eines echten Imports.

| Beispiel | Gezeigter Ablauf | Mögliche Idee für fam |
| --- | --- | --- |
| „Saturday's open. What can I make?“ | Vorrat und eigene Rezepte werden betrachtet. Zwei passende Gerichte erscheinen mit Hinweisen zu vorhandenen oder fehlenden Zutaten; eines kann für Samstag vorgeschlagen werden. | Einen offenen Planplatz als Einstieg in begründete Rezeptvorschläge prüfen. Eine Übernahme in den Plan bleibt eine eigene, bestätigte Aktion. |
| „Plan easy lunches for next week“ | Ein Vorschlag für fünf Mittagessen nutzt Rezepte, Zutaten und einen Tag für Reste. Der Plan kann als Ganzes übernommen oder verworfen werden. | Später einen Wochenplan als überprüfbaren Entwurf anbieten, mit Portionen, Resten und klarer Bestätigung vor Änderungen. |
| „Find me a good birria recipe“ | Eine beispielhafte Webfundstelle wird als Rezeptkarte mit Importoption gezeigt. Die Vorschau führt keine echte Suche oder Verifikation aus. | Eine spätere Rezeptentdeckung müsste Quelle und Inhalt vor einem Import sichtbar und prüfbar machen. |
| „No buttermilk. What can I use?“ | Im Kontext eines Pfannkuchenrezepts wird anhand des Vorrats ein Ersatz vorgeschlagen. Die angepasste Fassung kann als neues Rezept gespeichert werden. | Zutatenersatz an das konkrete Rezept und den verfügbaren Bestand binden; Änderungen am Original und eine neue Variante als unterschiedliche Entscheidungen behandeln. |
| „Jamie can't stand mushrooms“ | Der Assistent schlägt vor, eine Abneigung zu merken und ihre Stärke in den Haushaltseinstellungen zu prüfen. | Vorlieben einer Person zuordnen und ausdrücklich bestätigen lassen. Eine persönliche Abneigung darf nicht ohne Entscheidung als Verbot für den ganzen Haushalt gelten. |

Gemeinsames Muster: Anliegen und Kontext führen zu einem konkreten Vorschlag; eine Änderung an Plan, Rezepten oder Vorlieben braucht einen sichtbaren Freigabeschritt. Die fünf Beispiele sind unterschiedliche Aufgaben, keine fünf Varianten derselben Rezeptsuche. Die [Merran-Dokumentation zu Vorschlägen und Freigaben](https://merran.app/docs/use/assistant/) beschreibt dieses Prinzip.

Für die erste Version der [fachlich abgestimmten Spezifikation](../specs/food-waste-meal-suggestions/food-waste-meal-suggestions.md) ist vor allem der Vorschlag aus Vorrat und vorhandenen Rezepten anschlussfähig. Wochenplanung, Websuche, Rezeptänderungen und das Merken von Vorlieben sind spätere, separat zu entscheidende Funktionen.

Marco hat am 2026-11-07 den [vollständigen AI- und Assistant-Funktionsumfang als Produktziel](../features/ai-und-assistant-produktziel.md) bestätigt. Diese fünf Beispiele bleiben konkrete Einstiege für den größeren Produktbereich.

Weiterführend: [Vergleich mit anderen Projekten](../research/mahlzeitenvorschlaege-vergleichsprojekte-2026-11-07.md) und [aktuelle Modell- und Anbieteroptionen](../research/ai-rezeptvorschlaege-modelle-anbieter-2026-11-07.md).
