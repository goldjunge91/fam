# Cycle 004: Gemeinsamer Haushalt, Attribution und Konfliktklarheit

## Forschungsfrage

Welche Muster helfen mehreren Personen, denselben Lebensmittelbestand zu pflegen, ohne doppelte Käufe, unklare Mengen oder gegenseitige Schuldzuweisungen zu erzeugen?

## Befunde

### Wer hat was verändert?

Zimmer zeigt in Pantry und Einkaufsliste, wer einen Eintrag hinzugefügt hat. Die gemeinsame Küche kann außerdem selektiv geteilt werden: Pantry, Kalender, Einkaufsliste oder alle Bereiche. [Zimmer Sharing](https://zimmerfood.com/sharing/)

HomeVault beschreibt zusätzlich einen Activity Feed, der anzeigt, wer etwas hinzugefügt oder verwendet hat und direkt zum Eintrag springt. [HomeVault](https://www.thehomevaultapp.com/)

Diese Attribution ist nicht bloß soziale Dekoration. Bei einem gemeinsamen Vorrat beantwortet sie die Rückfrage „Ist das noch da oder hat es jemand gerade verwendet?“ und macht eine Korrektur nachvollziehbar.

### Rollen und Sichtbarkeit

WhereKeep trennt Owner, Editor und Viewer. Viewer können suchen, ohne den Bestand zu verändern; Editor können Einträge hinzufügen und organisieren. [WhereKeep](https://www.wherekeep.com/)

Für einen Familienvorrat ist ein einfacher Viewer-Modus besonders relevant: Kinder, Besuch oder ein zweites Gerät sollen den Bestand finden können, ohne versehentlich Mengen zu löschen. Die Rolle muss jedoch die Kernhandlung „verwendet“ ausdrücklich berücksichtigen, sonst verhindert sie den eigentlichen Nutzen.

### Konflikte und Wiederherstellung

PantryVault nennt in der Versionshistorie explizit Verbesserungen an Shared-Meal-Plan-Synchronisation, Conflict Handling, Sync- und Data-Recovery-Messaging sowie zuverlässigen Widget-Aktionen. [PantryVault App Store](https://apps.apple.com/us/app/pantryvault/id6755187375?platform=ipad)

Die Quelle beschreibt keine vollständige Konfliktlösung. Sie bestätigt aber ein wichtiges Produktproblem: Synchronisation ist für die Nutzenden erst dann vertrauenswürdig, wenn bei konkurrierenden Änderungen und Fehlern verständliche Rückmeldung vorhanden ist.

## Synthese

Die Haushaltsansicht sollte nicht jeden technischen Synchronisationsvorgang anzeigen. Sie braucht drei sichtbare Signale:

1. **Aktueller Bestand:** Menge und Status;
2. **Letzte relevante Änderung:** „von Alex vor 2 Min. verwendet“;
3. **Korrekturmöglichkeit:** kurze Undo- oder Wiederherstellen-Aktion.

Ein vollständiger Activity Feed gehört in eine sekundäre Ansicht. Auf der Inventarkarte genügt die letzte relevante Änderung, sofern sie bei Unsicherheit direkt geöffnet werden kann.

## Design-Hypothese

Jede schnelle Verbrauchsaktion sollte lokal so aussehen:

`Joghurt · 2 Becher · Kühlschrank`

`Mara hat 1 verwendet · gerade eben`

`Rückgängig`

Bei einer parallelen Änderung sollte die UI nicht still eine Zahl überschreiben. Sie sollte die neue Menge anzeigen und, wenn nötig, einen Hinweis wie „Währenddessen aktualisiert“ mit Zugriff auf die Änderungshistorie anbieten.

## Datenschutz- und Tonalitätsentscheidung

Attribution sollte sachlich und hilfreich bleiben. „Wer hat was verbraucht?“ darf nicht als Rangliste oder Schuldindikator gestaltet werden. Waste-Statistiken können auf Haushaltsebene aggregiert werden; personenbezogene Verbrauchsauswertungen sollten nicht automatisch prominent werden.

## Validierung

Szenarien mit zwei Personen und absichtlich verzögertem Netz testen:

- beide reduzieren dieselbe Menge;
- eine Person verwendet den letzten Artikel, während die andere die Karte geöffnet hat;
- eine Person verschiebt einen Artikel in einen anderen Lagerort;
- eine falsche Entnahme wird sofort rückgängig gemacht;
- ein Viewer versucht eine Schreibaktion;
- eine Offline-Änderung trifft auf eine spätere Online-Änderung.

Erfolg bedeutet: Die finale Menge ist korrekt, die Beteiligten verstehen die letzte Änderung, und keine Aktion geht ohne erklärbare Rückmeldung verloren.

## Quellen

1. Zimmer, „Sharing“, https://zimmerfood.com/sharing/
2. HomeVault, „Your home, documented“, https://www.thehomevaultapp.com/
3. WhereKeep, „Home Inventory App for Organized Households“, https://www.wherekeep.com/
4. PantryVault, Apple App Store, https://apps.apple.com/us/app/pantryvault/id6755187375?platform=ipad
