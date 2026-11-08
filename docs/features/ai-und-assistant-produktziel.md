# AI und Assistant für fam

**Status:** Produktziel von Marco am 2026-11-07 bestätigt; lokaler Prototyp mit Assistant-Werkzeugen und Rezeptimport umgesetzt
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
| AI-Betrieb | Mehrere Anbieter und kompatible Endpunkte, serverseitige Modellwahl nach Aufgabenfähigkeit, Kosten- und Nutzungsanzeige, Limits, Schlüsselverwaltung sowie passende Ausweichwege bei Ausfällen. |

Diese Liste deckt Merrans zehn [AI-Aufgaben](https://github.com/merran-app/merran/blob/81c670cb1250e42947bfccf946d4d5c1d556d7e4/packages/shared/src/ai/catalog.ts#L18-L48) und die separat beschriebenen Medienfunktionen ab. Sie ist ein Zielumfang, keine Behauptung, dass die Funktionen in fam bereits existieren oder dass jede Merran-Integration unverändert übertragbar ist.

Der [Rezeptimport](rezeptimport-produktziel.md) ist als eigene Funktion mit Eingängen, Prüfablauf und Anpassung an fams Rezeptmodell dokumentiert.

Die getrennten Mermaid-Abläufe des lokalen Prototyps stehen in [AI-Abläufe](ai-ablaeufe.md).

## Lokaler Prototyp im Review-Worktree

Der Worktree enthält verschlüsselte lokale Gespräche, AI-Einwilligung, ein intern festgelegtes Standardmodell und eine Credit-Anzeige. Nutzer wählen kein Modell aus. Der Haushaltskontext ist in der Assistant-Oberfläche standardmäßig aktiv und kann nicht einzeln abgeschaltet werden: Rezeptsuche, Vorratsabfrage sowie eigene Allergien, Unverträglichkeiten und Abneigungen des anfragenden Accounts werden gemeinsam für Wochenplan- und Zutatenwechselvorschläge verwendet. Der Server begrenzt den Werkzeuglauf auf sechs Runden, validiert Rezept-IDs, Zutaten, Datumswerte und Plan-Slots und liefert eine sichtbare Werkzeugspur zurück.

Planvorschläge bleiben zunächst lokal im verschlüsselten Chat. Erst der ausdrückliche Button erzeugt Wochenplan-Einträge über fams bestehende lokale Outbox-/Sync-Mutationen. Zutatenwechsel werden als nicht angewendete Idee gezeigt und öffnen das zugehörige Haushaltsrezept. Nach der AI-Einwilligung liest der Gateway bei jeder Assistant-Anfrage ausschließlich die Allergien, Unverträglichkeiten und Abneigungen des anfragenden Accounts über dessen eigene RLS-Berechtigung. Rezept- und Ersatzvorschläge werden serverseitig anhand der aufgelösten Zutaten gegen diese Regeln geprüft; unvollständige Zutatenlisten werden bei aktiven Regeln ausgeschlossen. Verpackungsangaben und Kreuzkontamination sind im aktuellen Produktmodell nicht gespeichert und werden in der Vorschau als offene Grenze benannt. Regeln anderer Accounts und Kinderprofile werden nicht gelesen. Private Gesundheits- und Trackingdaten werden nicht geladen.

Der Rezeptimport unterstützt mehrere Webseitenlinks, eingefügten Text, bis zu fünf Fotos, ein PDF und einen Videolink. Für Webseiten werden strukturierte Rezeptdaten zuerst gelesen; nur bei unvollständigen Daten wird das AI-Gateway verwendet. Ergebnisse bleiben in verschlüsselten lokalen Entwürfen und werden im bestehenden Rezepteditor geprüft. Zutaten bleiben Rohtext, bis der Nutzer Produkte und umrechenbare Mengen zuordnet.

Quelltext, Gespräche und Entwürfe werden nicht auf ein neues Servermodell synchronisiert. Die Einwilligung liegt derzeit lokal im Account-Speicher. Assistant-Anhänge, Sprache, Belege und externe Suche sind nicht Teil dieses Prototyps. Video-URLs werden weiterhin direkt an den serverseitig konfigurierten AI-Anbieter übergeben; Untertitel, Audio und Frames werden noch nicht lokal extrahiert. Der bereitgestellte iCloud-Shortcut ließ sich in dieser Umgebung nicht abrufen; seine konkrete Verarbeitung ist deshalb noch nicht reverse-engineert.

## Architekturmuster, die wir prüfen und übernehmen wollen

1. **Ein gemeinsamer AI-Aufrufpfad:** Aufgabe, Modellfähigkeit, Anbieter, Kostenregel und Nutzungsprotokoll werden vor dem Modellaufruf bestimmt. Das bestehende [fam-Gateway](../../supabase/functions/ai-gateway/handler.ts) mit RevenueCat- und Credit-Prüfung wurde um getrennte Verträge für Assistant und Rezeptimport erweitert; bestehende Skills behalten ihre eigenen Verträge.
2. **Begrenzte Lese- und Vorschlagswerkzeuge:** Im Prototyp erhält der Assistant nach Einwilligung bei jeder Anfrage Haushaltsrezepte, Vorräte und die eigenen Lebensmittelregeln des anfragenden Accounts. Lesezugriff und Vorschlagserzeugung sind getrennt; das Modell führt keine Mutation aus. Der lokale Apply-Pfad nutzt bestehende Mutationen und bleibt an eine Nutzeraktion gebunden. Merrans [Werkzeugstruktur](https://github.com/merran-app/merran/blob/81c670cb1250e42947bfccf946d4d5c1d556d7e4/apps/server/src/services/assistant/tools/index.ts) dient als Referenz.
3. **Typisierte Vorschläge mit eigenem Apply-Pfad:** Die Vorschau zeigt betroffene Datensätze, Mengen, Termine und Quellen. Beim Anwenden werden Berechtigung, aktuelle Daten und fachliche Regeln erneut geprüft. Für Plan, Vorlieben und Allergien ist diese erneute Prüfung besonders wichtig; Merrans Dokumentation weist darauf hin, dass sein Konfliktschutz nicht für jede Vorschlagsart gilt. [Merran-Freigaben](https://merran.app/docs/use/assistant/)
4. **Gespräche und Anhänge mit klaren Eigentümern:** Chatverlauf gehört zum Account; geteilte Vorschläge und angewendete Änderungen gehören der betroffenen Domäne. Aufbewahrung, Löschung, Offline-Zustand und Sync werden je Datenart festgelegt.
5. **Lange Aufgaben als überprüfbare Jobs:** Import, Medienverarbeitung und externe Suche dürfen den mobilen Interaktionsablauf nicht blockieren. Ergebnisse erhalten einen nachvollziehbaren Status und werden erst nach Prüfung in Haushaltsdaten übernommen.

## Grenzen von fam

- [CONTEXT.md](../../CONTEXT.md) trennt Haushaltsdaten von privaten Accountdaten. Nach der AI-Einwilligung sendet der Prototyp persönliche Lebensmittelregeln des anfragenden Accounts bei jeder Assistant-Anfrage; RLS verhindert den Zugriff auf Regeln anderer Accounts. Private Kalorien-, Gewichts-, Medikamenten- oder Symptomdaten bleiben ausgeschlossen. Für alle Mitessenden braucht es eine eigene ausdrückliche Freigabe, bevor deren persönliche Regeln in Familienpläne einfließen dürfen.
- Ein Kindprofil hat eigene Zugriffsregeln. Vorlieben und Einschränkungen müssen Personen beziehungsweise Profilen zugeordnet werden können; ein Freitextfeld wie Merrans `who` reicht für fam nicht als dauerhafte Identität.
- Das bestehende AI-Abo, Credits und eine erforderliche Einwilligung bleiben vor externen Modellaufrufen wirksam. Kosten und gesendeter Kontext müssen vor der Nutzung verständlich sein. Merrans [Datenschutzbeschreibung](https://merran.app/docs/project/ai-privacy/) zeigt, dass Chatverlauf, Anhänge, Haushaltsregeln und Werkzeugergebnisse an externe Anbieter gelangen können.
- Fam ist Expo/React Native mit Supabase und lokalem SQLite-Spiegel. Merrans Node-Server, Datenbank und Weboberfläche werden nicht direkt übernommen. Änderungen an synchronisierten Entitäten brauchen die regulären RLS-, Outbox- und Sync-Pfade; Offline-Funktionen behalten einen nutzbaren lokalen Kern.
- Modellantworten sind Vorschläge. Mengen, Lebensmittelregeln, Haltbarkeit, Nährwerte, Quellen, Einheiten und Mutationen werden durch die zuständige Domänenlogik geprüft. Im aktuellen Datenmodell fehlen Allergenkennzeichnungen für Produktverpackungen und Kreuzkontamination. Ein späterer Apply-Schritt prüft erneut gegen den dann aktuellen Zustand.

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
