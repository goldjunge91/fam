# AI und Assistant für fam

**Status:** Produktziel von Marco am 2026-11-07 bestätigt; fachliche Einzelverträge und Umsetzung offen  
**Tracking:** `fam-d5rn`  
**Referenz:** [Merran-Repository, geprüfter Stand](https://github.com/merran-app/merran/tree/81c670cb1250e42947bfccf946d4d5c1d556d7e4), [Assistant-Dokumentation](https://merran.app/docs/use/assistant/), [AI-Aufgaben im Quellcode](https://github.com/merran-app/merran/blob/81c670cb1250e42947bfccf946d4d5c1d556d7e4/packages/shared/src/ai/catalog.ts)

Marco möchte die Funktionen von Merrans AI und Assistant vollständig für fam nachbauen und die Architektur soweit übernehmen, wie sie zu fam passt. Gemeint ist ein eigener Produktbereich, nicht das Kopieren von Merrans Quellcode. Der Umfang umfasst auch Import, Bilder, Belege und Sprache; er beschränkt sich nicht auf die [fünf bereits gesammelten Beispiele](../ideas/mahlzeitenvorschlaege-aus-bestand.md#inspiration-fünf-merran-beispiele).

## Funktionsumfang

| Bereich | Ziel für fam |
| --- | --- |
| Assistant | Eigene, fortsetzbare Gespräche; Fragen zum aktuellen Rezept, Wochenplan, Bestand und Einkaufszettel; sichtbarer Seitenkontext, Anhänge und gezielte Haushaltsabfragen. |
| Vorschläge und Freigabe | Änderungen an Rezepten, Plan, Einkaufsliste und Vorlieben als prüfbare Vorschläge; ausdrücklich anwenden oder verwerfen. Zutatenersatz kann einmalig für einen Kochvorgang oder dauerhaft für ein Rezept gelten. |
| Rezeptsuche und Entdeckung | Eigene Rezepte zuerst durchsuchen; bei einer ausdrücklichen Anfrage externe Rezeptquellen finden, Seite und Herkunft vor einem Import prüfen. |
| Rezeptimport und Bearbeitung | URL, Text, Bild, PDF und Video soweit Quelle und Eingabe es erlauben; KI-Unterstützung für unstrukturierte Quellen, Rezeptaufbereitung und Änderungen aus Kochnotizen. |
| Kochen und Nährwerte | Rezeptbezogene Zutatenersatzvorschläge, optionale Nährwertschätzung und Hilfe beim Kochen. Schätzungen bleiben als solche erkennbar. |
| Einkauf und Belege | Unterstützung beim Erkennen von Einkaufsartikeln und Zuordnen zu Produkten; Belege als Vorschlag zur Prüfung, bevor Bestand oder Einkaufshistorie geändert werden. |
| Medien und Sprache | Rezeptbilder erzeugen, Sprache transkribieren, Antworten oder Kochschritte vorlesen und Bild-/PDF-Anhänge im passenden Ablauf verarbeiten. |
| Hinweise | KI-gestützte Vorbereitungshinweise nur mit eigener fachlicher Entscheidung über Auslöser, Zeitpunkt und Benachrichtigungsrechte. |
| AI-Betrieb | Mehrere Anbieter und kompatible Endpunkte, aufgabenbezogene Modellwahl nach Fähigkeiten, Kosten- und Nutzungsanzeige, Limits, Schlüsselverwaltung sowie passende Ausweichwege bei Ausfällen. |

Diese Liste deckt Merrans zehn [AI-Aufgaben](https://github.com/merran-app/merran/blob/81c670cb1250e42947bfccf946d4d5c1d556d7e4/packages/shared/src/ai/catalog.ts#L18-L48) und die separat beschriebenen Medienfunktionen ab. Sie ist ein Zielumfang, keine Behauptung, dass die Funktionen in fam bereits existieren oder dass jede Merran-Integration unverändert übertragbar ist.

Der [Rezeptimport](rezeptimport-produktziel.md) ist als eigene Funktion mit Eingängen, Prüfablauf und Anpassung an fams Rezeptmodell dokumentiert.

## Architekturmuster, die wir prüfen und übernehmen wollen

1. **Ein gemeinsamer AI-Aufrufpfad:** Aufgabe, Modellfähigkeit, Anbieter, Kostenregel und Nutzungsprotokoll werden vor dem Modellaufruf bestimmt. Das bestehende [fam-Gateway](../../supabase/functions/ai-gateway/handler.ts) mit RevenueCat- und Credit-Prüfung ist der Ausgangspunkt; seine bisherigen Skill-Verträge werden nicht stillschweigend zu einem allgemeinen Assistant umgedeutet.
2. **Begrenzte Lese- und Vorschlagswerkzeuge:** Der Assistant erhält nur den für die Aufgabe autorisierten Kontext. Lesezugriff und Vorschlagserzeugung sind getrennt; ein Modellaufruf führt keine Bestands-, Plan-, Einkaufs- oder Rezeptmutation aus. Merrans [Werkzeugstruktur](https://github.com/merran-app/merran/blob/81c670cb1250e42947bfccf946d4d5c1d556d7e4/apps/server/src/services/assistant/tools/index.ts) dient als Referenz.
3. **Typisierte Vorschläge mit eigenem Apply-Pfad:** Die Vorschau zeigt betroffene Datensätze, Mengen, Termine und Quellen. Beim Anwenden werden Berechtigung, aktuelle Daten und fachliche Regeln erneut geprüft. Für Plan, Vorlieben und Allergien ist diese erneute Prüfung besonders wichtig; Merrans Dokumentation weist darauf hin, dass sein Konfliktschutz nicht für jede Vorschlagsart gilt. [Merran-Freigaben](https://merran.app/docs/use/assistant/)
4. **Gespräche und Anhänge mit klaren Eigentümern:** Chatverlauf gehört zum Account; geteilte Vorschläge und angewendete Änderungen gehören der betroffenen Domäne. Aufbewahrung, Löschung, Offline-Zustand und Sync werden je Datenart festgelegt.
5. **Lange Aufgaben als überprüfbare Jobs:** Import, Medienverarbeitung und externe Suche dürfen den mobilen Interaktionsablauf nicht blockieren. Ergebnisse erhalten einen nachvollziehbaren Status und werden erst nach Prüfung in Haushaltsdaten übernommen.

## Grenzen von fam

- [CONTEXT.md](../../CONTEXT.md) trennt Haushaltsdaten von privatem Tracking erwachsener Accounts. Ein Assistant darf private Kalorien-, Gewichts-, Medikamenten- oder Symptomdaten nicht allein wegen der Haushaltsmitgliedschaft lesen. Für jedes Werkzeug braucht es einen ausdrücklichen Datenbesitz- und Berechtigungsvertrag.
- Ein Kindprofil hat eigene Zugriffsregeln. Vorlieben und Einschränkungen müssen Personen beziehungsweise Profilen zugeordnet werden können; ein Freitextfeld wie Merrans `who` reicht für fam nicht als dauerhafte Identität.
- Das bestehende AI-Abo, Credits und eine erforderliche Einwilligung bleiben vor externen Modellaufrufen wirksam. Kosten und gesendeter Kontext müssen vor der Nutzung verständlich sein. Merrans [Datenschutzbeschreibung](https://merran.app/docs/project/ai-privacy/) zeigt, dass Chatverlauf, Anhänge, Haushaltsregeln und Werkzeugergebnisse an externe Anbieter gelangen können.
- Fam ist Expo/React Native mit Supabase und lokalem SQLite-Spiegel. Merrans Node-Server, Datenbank und Weboberfläche werden nicht direkt übernommen. Änderungen an synchronisierten Entitäten brauchen die regulären RLS-, Outbox- und Sync-Pfade; Offline-Funktionen behalten einen nutzbaren lokalen Kern.
- Modellantworten sind Vorschläge. Mengen, Allergien, Haltbarkeit, Nährwerte, Quellen, Einheiten und Mutationen werden durch die zuständige Domänenlogik geprüft. Ein späterer Apply-Schritt prüft erneut gegen den dann aktuellen Zustand.

## Verhältnis zu laufender Arbeit

Die [Spezifikation für Mahlzeitenvorschläge](../specs/food-waste-meal-suggestions/food-waste-meal-suggestions.md) definiert weiterhin deren begrenzte Version 1 ohne allgemeine Chatfunktion. Dieses neue Produktziel erweitert den langfristigen Umfang; es überschreibt die Version-1-Verträge und die laufende Rezeptvorschlagsarbeit `fam-y918` nicht stillschweigend. Vor einer Änderung dieser Verträge werden Assistant, Berechtigungen, Vorschläge und AI-Betrieb als eigene Capabilities beschrieben.

Die Umsetzung kann schrittweise erfolgen, **ohne den bestätigten Gesamtumfang zu verkleinern**: zuerst gemeinsame AI- und Vorschlagsgrenzen, dann die fünf Assistant-Abläufe, anschließend Import und weitere Aufgaben, zuletzt Medien- und Sprachabläufe mit ihren jeweiligen Berechtigungen. Eine konkrete Reihenfolge folgt aus Abhängigkeiten, Nutzertests und dem Stand der laufenden Arbeit.

## Nächste fachliche Entscheidungen

- Welche Haushalts- und privaten Daten darf jede Assistant-Aufgabe lesen, und wie wird der Seitenkontext vor dem Senden sichtbar gemacht?
- Welche Vorlieben gelten für welche Mitessenden; wie behandelt die App Allergien und abweichende Regeln in einem Haushalt?
- Welche Änderungen erscheinen als Vorschlag, welche sind reine Antworten, und welche gelten nur für einen Kochvorgang?
- Welche Anbieter- und Schlüsseloptionen werden Endnutzern angeboten, und wie greifen sie in RevenueCat, Credits, Einwilligung und Kostenlimits ein?
- Welche Funktionen bleiben offline nutzbar, und wie werden Chats, Anhänge und Vorschläge gespeichert und gelöscht?

Die technische Ausgestaltung wird in separaten Specs und bei dauerhaften Architekturentscheidungen in ADRs festgehalten. Dieses Dokument hält den bestätigten Produktumfang und die Anpassungsgrenzen fest.
