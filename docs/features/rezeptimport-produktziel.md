# Rezeptimport für fam

**Status:** Eigenständiges Produktziel von Marco am 2026-11-07 bestätigt; lokaler Prototyp im Review-Worktree umgesetzt
**Tracking:** `fam-d5rn.1`, unter dem [AI- und Assistant-Produktziel](ai-und-assistant-produktziel.md)
**Referenz:** [Merran-Rezeptanleitung](https://merran.app/docs/use/recipes/), [Import aus einer Webseite](https://github.com/merran-app/merran/blob/81c670cb1250e42947bfccf946d4d5c1d556d7e4/apps/server/src/services/recipes/import/import-link.ts), [KI-Leser](https://github.com/merran-app/merran/blob/81c670cb1250e42947bfccf946d4d5c1d556d7e4/apps/server/src/services/recipes/import/ai-reader.ts)

„Import Recipe“ ist aus dem Rezeptbereich direkt erreichbar. Das Ergebnis ist ein **Haushaltsrezept**. Ein Import veröffentlicht nichts im globalen Rezeptkatalog und verändert keine vorhandenen Rezepte ohne ausdrückliche Auswahl.

Das Importdiagramm samt Bezug zu Abo und AI-Credits steht in [AI-Abläufe](ai-ablaeufe.md).

## Im lokalen Prototyp enthalten

- Mehrere Webseitenlinks nacheinander; Erfolg, Duplikat und Fehler werden getrennt angezeigt. Fehlerhafte Links lassen sich erneut versuchen.
- Einfügbarer Rezepttext, bis zu fünf Fotos, ein PDF bis 5,5 MB sowie Videolinks.
- Webseitenimport liest strukturierte Rezeptdaten zuerst und verwendet das AI-Gateway nur als Fallback. Text, Fotos, PDF und Video nutzen die AI-Auswertung.
- Der KI-Leser bewahrt Quellensprache und Reihenfolge, lässt fehlende Mengen offen und behandelt Seiten-/Bildinhalte als nicht vertrauenswürdige Daten statt als Anweisungen.
- Importentwürfe und Chats liegen verschlüsselt im Account-Speicher auf dem Gerät. Der Rezepteditor zeigt Quelle, erkennbare Unsicherheiten und bei Fotos das Originalbild. Rohzutaten bleiben unverändert und benötigen vor dem Speichern eine Produktzuordnung und gültige Grammmenge.
- Nach ausdrücklichem Speichern wird das Rezept über den bestehenden Rezeptpfad angelegt. Die Herkunftszuordnung bleibt lokal beim Account; sie wird nicht über SQLite oder Supabase zwischen Geräten synchronisiert.

Die Einwilligung für externe AI-Anbieter wird lokal gespeichert. Eine Freigabe im Produkt bedeutet daher noch keine serverseitige Einwilligungsverwaltung. Eingehendes Teilen aus anderen Apps, PDF-Vorschau im Editor und Quellenabgleich über Geräte hinweg sind noch nicht enthalten.

Der aktuelle Videopfad übergibt die öffentliche URL direkt als Videoeingabe an das gewählte AI-Modell. Er extrahiert noch keine Untertitel, Audiospur oder Einzelbilder. Der bereitgestellte Instagram-Shortcut konnte über Apples iCloud-Metadatenendpunkt in dieser Umgebung nicht geladen werden; für eine genaue Reverse-Engineering-Umsetzung wird sein exportiertes `.shortcut`-Dokument oder die Aktionenliste benötigt.

## Gewünschter Umfang

| Eingang | Gewünschtes Ergebnis | Besonderheit |
| --- | --- | --- |
| Einzelne Rezept-URL | Rezeptdaten und Quelle als prüfbarer Entwurf | Strukturierte Daten der Seite zuerst lesen; KI nur bei fehlenden oder unzureichenden Daten und mit wirksamer Berechtigung. |
| Mehrere URLs | Nachvollziehbare Warteschlange mit Erfolg, Duplikat, Fehler und Wiederholung pro Link | Ein fehlerhafter Link darf erfolgreiche Importe nicht verwerfen. Jeder Entwurf bleibt vor dem Speichern prüfbar. |
| Eingefügter Rezepttext | Name, Portionen, Zutaten, Schritte und Hinweise als Entwurf | Unklare oder fehlende Angaben sichtbar lassen; keine erfundenen Mengen. |
| Fotos oder PDF | Lesbare Rezeptseiten in Reihenfolge auswerten | Original und erkannte Felder müssen nebeneinander prüfbar sein; Bildqualität und Dateigrenzen begrenzen den Ablauf. |
| Video-Link | Beschreibung, Untertitel und gegebenenfalls Bild-/Audioinhalt als Rezeptentwurf auswerten | Eigener längerer Verarbeitungsweg mit Fortschritt, Abbruch und klaren Fehlern bei unzugänglichen Quellen. |
| Teilen aus einer anderen App | URL oder Text an denselben Importablauf übergeben | Im lokalen Prototyp noch nicht enthalten. |

Merran liest bei Webseiten zuerst strukturierte Rezeptdaten und verwendet [KI als Fallback](https://github.com/merran-app/merran/blob/81c670cb1250e42947bfccf946d4d5c1d556d7e4/apps/server/src/services/recipes/import/import-link.ts#L143-L188). Der [KI-Leser](https://github.com/merran-app/merran/blob/81c670cb1250e42947bfccf946d4d5c1d556d7e4/apps/server/src/services/recipes/import/ai-reader.ts#L172-L211) fordert eine strukturierte Antwort an. Merran bietet außerdem [Text, Foto/PDF, Video und mehrere Links](https://merran.app/docs/use/recipes/) an. Diese Eingänge sind für fam Teil desselben Produktziels, auch wenn sie in getrennten Schritten umgesetzt werden.

## Nutzerablauf

1. Der Nutzer wählt den Zielhaushalt und die Quelle. Bei einer URL werden Adresse und Weiterleitungen serverseitig geprüft; bekannte Quellen werden als mögliche Duplikate angezeigt.
2. Der Import erstellt einen Entwurf mit Originalquelle, Titel, Portionen, Zutaten, Mengen und Einheiten, Rezeptkomponenten, Schritten, Bildern und erkennbaren Unsicherheiten. Der Entwurf zeigt, welche Felder aus strukturierten Quelldaten und welche aus einer KI-Auswertung stammen.
3. Der Nutzer prüft die Quelldaten, korrigiert Zutaten und Schritte und ordnet Zutaten den Produkten der App zu. Fehlende oder nicht umrechenbare Mengen bleiben sichtbar und verhindern eine scheinbar präzise Nährwert- oder Einkaufsberechnung.
4. Erst nach Bestätigung wird ein Haushaltsrezept über den normalen Rezept-Mutationspfad gespeichert. Der Assistant darf einen Importentwurf anbieten, aber nicht selbst speichern.
5. Ein erneuter Import derselben Quelle zeigt das vorhandene Rezept und bietet eine bewusste Entscheidung für eine weitere Kopie oder spätere Aktualisierung. Eine Aktualisierung überschreibt keine lokalen Änderungen stillschweigend.

## Daten- und Architekturgrenzen in fam

- [CONTEXT.md](../../CONTEXT.md) definiert `Recipe` als haushaltseigen und `Recipe Template` als global kuratiert. Quelle, Originaltext und Importstatus brauchen einen eigenen Datenbesitz- und Aufbewahrungsvertrag. Ein URL-Import wird nie automatisch zu einem Template.
- Das aktuelle [Rezeptschema](../../supabase/schemas/11_recipes.sql) verlangt für eine Zutatenposition einen Produkt- oder Unterkomponentenbezug und eine positive Grammmenge. Die [Rezepterstellung](../../src/features/recipes/screens/recipe-create-screen.tsx) prüft Produktwahl und Umrechenbarkeit vor Mutationen. Ein Import aus freien Zutatenzeilen passt daher nicht unmittelbar in die gespeicherte Rezeptstruktur. Vor einer Implementierung ist zu entscheiden, wie ein prüfbarer Entwurf Rohzeilen und unaufgelöste Produktkandidaten hält, ohne Scheingenauigkeit zu erzeugen.
- Das Haushaltsrezept besitzt derzeit keinen eigenen source_url-Wert. Der Prototyp speichert Herkunft und Dublettenabgleich lokal beim Account; diese Information synchronisiert nicht und ist auf anderen Geräten nicht verfügbar. Eine dauerhafte Herkunftsanzeige braucht einen fachlichen Datenvertrag mit RLS, lokalem SQLite-Spiegel und Sync-Parität.
- Externe Webseiten werden nur über einen kontrollierten serverseitigen Abruf verarbeitet: zulässige Protokolle und Ziele, Weiterleitungen, Antwortgröße und Dateityp werden begrenzt. Seitentext, eingebettete Daten und Modellantworten sind Eingaben, keine Handlungsanweisungen für den Assistant.
- KI-Auswertung und externe Medienverarbeitung brauchen die geltenden AI-Abo-, Credit- und Einwilligungsregeln. Vor dem Senden ist erkennbar, ob Text, Bild, PDF oder Video an einen Anbieter übermittelt wird. Ein strukturierter Webseitenimport ohne KI soll unabhängig von einem KI-Modell funktionieren.
- Batchimporte haben im Prototyp pro Link einen Status und erneuten Versuch. Videoverarbeitung hängt von der externen Modellfähigkeit ab; Untertitelabruf, Abbruch und dauerhafte Job-Wiederaufnahme sind noch nicht enthalten. Ein verarbeiteter Entwurf bleibt klar vom gespeicherten Rezept getrennt.

## Fachliche Fragen vor dem Implementierungsvertrag

- Wie werden Rohzutaten und nicht zugeordnete Produkte gespeichert oder temporär gehalten, bis ein Rezept vollständig prüfbar ist?
- Welche Quellenangaben bleiben am Rezept erhalten, und wann gelten zwei Links nach Weiterleitung oder Tracking-Parametern als dieselbe Quelle?
- Welche Felder darf ein Import vorbefüllen, wenn Zutatenmenge, Einheit, Portionen oder Zubereitungsschritte in der Quelle fehlen?
- Wie sieht die Prüfung mehrerer Entwürfe im Batch auf dem Telefon aus, ohne stillschweigende Speicherung?
- Welche Medienformate, Dateigrößen und Videoquellen unterstützen wir tatsächlich, und welche Verarbeitung ist offline möglich?
- Wie werden Originalbild, importiertes Bild und eventuell generiertes Rezeptbild unterschieden?

Eine spätere fachliche Spezifikation entscheidet diese Punkte und beschreibt die Felder, Fehlzustände, Berechtigungen und Annahmekriterien. Dauerhafte Datenmodell- oder API-Entscheidungen werden als ADR festgehalten. Dieses Dokument hält den bestätigten Umfang und die Gründe für einen eigenen Importpfad fest.
