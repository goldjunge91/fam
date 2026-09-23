# Umsetzungsplan: Remote-Aktualität und Haushalts-Cursor

Stand: 2026-09-23. Dieses Dokument definiert die Umsetzung der zwei in
Stage 4 reproduzierten Sync-Fehler. Seine Erstellung ist keine Implementierung
und kein Nachweis einer bereits behobenen Störung.

Initiative: `fam-ymz7`. Implementierungsbeads: `fam-ymz7.16` und
`fam-ymz7.17`. Dokumentationsauftrag: `fam-ymz7.22`.

## 1. Zweck und Quellenhierarchie

Zwei beobachtbare Eigenschaften sollen gelten:

1. Ein eindeutig älteres Remote-Update setzt eine bereits bestätigte lokale
   Zeile nicht zurück.
2. Ein Haushalt verwendet ausschließlich seinen eigenen Ladefortschritt.
   Bereits vorhandene ältere Daten eines anderen Haushalts werden beim Wechsel
   vollständig nachgeladen.

[AGENTS.md](../../../AGENTS.md) besitzt den Arbeitsprozess,
[CONSTRAINTS.md](../../../CONSTRAINTS.md) die Qualitätsgrenzen und
[CONTEXT.md](../../../CONTEXT.md) Datenbesitz und Domänensprache. Dieses
Dokument präzisiert Verhalten, Implementierungsgrenzen und Abnahme der zwei
Korrekturen. Es schwächt keinen dieser Verträge ab.

Beads bleiben die einzige Quelle für Live-Status, Zuweisung, Blocker,
Reviewbefunde und tatsächlich ausgeführte Nachweise. Dieses Dokument enthält
keinen zweiten Fortschrittstracker. Bei einer notwendigen Zieländerung werden
Dokument und betroffener Bead gemeinsam angepasst, statt widersprechende
Vorgaben durch zusätzliche Statusdokumente zu ergänzen.

## 2. Belegte Ausgangslage

### 2.1 Ältere Remote-Zeile überschreibt bestätigten Stand

In [mirror-write.ts](../../../src/lib/sync/mirror-write.ts) behandelt
`applyRemoteRow` eine fehlende lokale Zeile und `_dirty === 0` gemeinsam:
beide werden ohne Aktualitätsvergleich upserted. Pull und Realtime verwenden
diesen Owner. SQLite-Serialisierung ordnet Schreibzugriffe, prüft aber nicht
das Alter der enthaltenen Serverdaten.

Reproduktion mit echter SQLite-Datenbank im Speicher:

- Eine bestätigte Bestandszeile hat `updated_at = 2026-09-23T12:00:00Z`
  und den gespeicherten Mengenwert `2000`.
- Der echte Realtime-Callback erhält ein UPDATE für dieselbe ID mit
  `updated_at = 2026-09-22T12:00:00Z` und Mengenwert `3000`.
- Danach enthält SQLite den älteren Wert `3000`; `_dirty` bleibt `0`.

Die Mengenwerte sind rohe Fixture-Werte des bestehenden SQLite-Modells,
keine neue fachliche Mengendefinition. Ein zweiter Diagnosefall bestätigt
dasselbe Verhalten direkt im gemeinsamen Mirror-Owner mit `storage_locations`.

### 2.2 Ein Haushalt übernimmt den Cursor eines anderen

[sync-runner.ts](../../../src/lib/sync/sync-runner.ts) startet den regulären
Sync mit `[householdId]` für den aktiven Haushalt.
[pull.ts](../../../src/lib/sync/pull.ts) filtert die Remote-Abfrage entsprechend,
liest und schreibt den Sync-State aber ohne expliziten Scope.
[sync-state.ts](../../../src/lib/db/sync-state.ts) verwendet dann `default`.

Reproduktion:

- Haushalt A lädt eine Lagerortzeile vom 23. September und rückt den Cursor vor.
- Danach wird Haushalt B geladen. Seine vorhandene Zeile vom 22. September
  liegt vor diesem Cursor.
- Die Abfrage überspringt B, schreibt keine Zeile und meldet keinen Fehler.

Das betrifft auch einen normalen Wechsel zwischen bestehenden Haushalten.
Der Haushalts-Bootstrap lädt nur `households` vollständig, nicht deren
Kindtabellen. Die Orphan-Reconciliation vergleicht IDs und ergänzt keine
fehlenden Remote-Zeilen. Keine dieser Stellen korrigiert den Cursorfehler.

### 2.3 Nachweisgrenzen

Die Codeprüfung führte 146 bestehende Tests aus 17 gezielten Suites erfolgreich
aus. Drei temporäre Diagnosefälle bestätigten das Fehlverhalten an echten
Produktionsfunktionen und In-Memory-SQLite; nur der Netzwerktransport war
simuliert. Das ist keine Beobachtung auf einem Nutzergerät oder Live-Server.

Die damaligen Diagnose-Assertions erwarteten ausdrücklich den fehlerhaften
Ist-Zustand. Sie dürfen nicht als erfolgreiche Fix-Abnahme übernommen werden.
Die folgenden Testfälle definieren das korrekte Sollverhalten unabhängig von
temporären Dateien. Historische Ausführungslogs und Befehle stehen in den Beads.

## 3. Scope und Owner

| Verantwortung | Owner | Geplanter Eingriff |
| --- | --- | --- |
| Übernahme eingehender Remote-Zeilen | [mirror-write.ts](../../../src/lib/sync/mirror-write.ts), `applyRemoteRow` | Aktualitätsprüfung für vorhandene saubere mutable Zeilen |
| Remote-Paginierung und Fortschritt | [pull.ts](../../../src/lib/sync/pull.ts) | Je Haushalt paginieren und konsequent denselben Scope verwenden |
| Cursor-/Fehlerpersistenz | [sync-state.ts](../../../src/lib/db/sync-state.ts) | Vorhandene API unverändert verwenden |
| Entity-Eigenschaften und Reihenfolge | [entities.ts](../../../src/lib/db/entities.ts) | Vorhandene Metadaten auswerten, keine zweite Registry |
| Zeitnormalisierung | [cursor.ts](../../../src/lib/sync/cursor.ts) | Vorhandenes `toEpochMs` verwenden |
| Realtime und Runner | [realtime.ts](../../../src/lib/sync/realtime.ts), [sync-runner.ts](../../../src/lib/sync/sync-runner.ts) | Konsumenten durch Tests absichern; kein geplanter Produktionsumbau |

Geplante Produktionsänderungen beschränken sich auf `mirror-write.ts` und
`pull.ts`. Kleine private Hilfsfunktionen bleiben im jeweiligen Owner.
Keine neue Command-, Queue-, Sync- oder Versionsabstraktion.

Es gibt keine Schema-, RLS-, RPC-, Native-, Dependency- oder UI-Änderung.
`sync_state` besitzt bereits `(entity, scope)` als Primärschlüssel; dafür
wird weder eine Supabase- noch eine Drizzle-Migration erzeugt.

Die von Marco verworfenen Einkaufsaufgaben bleiben verworfen: keine Änderung
an Einkaufsabschluss, Restore/Undo, History-RLS, Screen oder FlashList.
Gemeinsam genutzte Sync-Infrastruktur erhält die hier beschriebenen
entityübergreifenden Korrekturen. Auth-Recovery bleibt separat in `fam-ya7p`.

## 4. Vertrag für fam-ymz7.16: Remote-Aktualität

### 4.1 Entscheidung im gemeinsamen Owner

`applyRemoteRow` unterscheidet folgende Fälle:

| Lokaler Zustand | Eingehender Stand | Wirkung |
| --- | --- | --- |
| Zeile fehlt | gültige Remote-Zeile | Wie bisher einfügen |
| Mutable Zeile, `_dirty = 0` | Normalisierter Remote-Zeitstempel strikt kleiner als lokaler | Keine Änderung; `local-wins` zurückgeben |
| Mutable Zeile, `_dirty = 0` | Zeitstempel gleich oder größer | Wie bisher Remote-Zeile übernehmen |
| Zeile ist dirty | beliebig | Bestehende Outbox-/Konfliktrekonziliation unverändert |
| Append-only-Entity | beliebig | Bestehendes Verhalten unverändert |

Verglichen werden ausschließlich `toEpochMs(remote.updated_at)` und das
gespeicherte lokale `updated_at`. Für zwei bestätigte Serverstände werden
weder Gerätezeit noch `clockCeiling` verwendet. Ungültige Remote-Zeitstempel
bleiben Fehler; sie werden nicht still ignoriert.

Beim Verwerfen bleiben alle Spalten einschließlich `updated_at`, `deleted_at`
und `_dirty` unverändert. Die Rückgabe bleibt mit dem vorhandenen
`Promise<'written' | 'local-wins'>` kompatibel. Ein Pull darf seinen Cursor
trotz einer als älter verworfenen Zeile nach vollständigem Seiten-Commit
weiterführen. Realtime darf weiterhin seine vorhandene Invalidierung melden;
das Ändern dieser Benachrichtigungssemantik ist kein Teil des Fixes.

### 4.2 Soft-Delete und Restore

Soft-Delete und Restore sind Remote-Updates derselben mutable Zeile und folgen
derselben Altersprüfung. Ein alter Tombstone darf keinen neueren aktiven Stand
verdrängen. Ein neuerer Restore darf einen älteren Tombstone ersetzen.

`resolve()` wird dafür nicht wiederverwendet: Seine bestehende Delete-wins-Regel
für Konflikte könnte einen legitimen neueren Restore verhindern. Die
Dirty-Rekonziliation behält ihren bisherigen Owner und Vertrag.

### 4.3 Bewusste Grenzen

`toEpochMs` speichert Millisekunden. Remote-Versionen innerhalb derselben
Millisekunde sind damit nicht zuverlässig ordnungsfähig. Bei gleichen
normalisierten Zeitwerten bleibt die bisherige Remote-Übernahme bestehen;
identische Wiederholung ist idempotent. Dieser Fix behauptet keine vollständige
Versionsordnung und führt dafür kein neues Schema ein.

Physische Realtime-DELETE-Ereignisse laufen über `deleteMirrorRow` und bleiben
unverändert. Push-Acknowledgements schreiben direkt über `upsertMirrorRow`;
ihre Quittierungs- und Outbox-Semantik wird nicht nebenbei geändert.
Die Abnahme betrifft ausdrücklich den gemeinsamen Pull-/Realtime-Apply-Pfad,
nicht sämtliche denkbaren Reihenfolgen zwischen allen Schreibpfaden.

## 5. Vertrag für fam-ymz7.17: Cursor je Haushalt

### 5.1 Scope-Bildung und Aufrufstruktur

Für `meta.householdScoped === true`:

1. Die übergebenen Haushalt-IDs einmal deduplizieren und lexikografisch sortieren.
2. Je Entity diese Haushalte sequenziell bearbeiten; nicht einen Cursor für
   die gesamte ID-Menge erzeugen.
3. Als persistenten Scope exakt `household:<householdId>` verwenden.
4. Eine Seitenabfrage auf genau diesen Haushalt filtern.
5. Für `readSyncState`, `recordSyncError` und jeden `writeSyncCursor` dieselbe
   Scope-Zeichenfolge übergeben, einschließlich leerer Erfolgsantworten.

Die bestehende Entity-Reihenfolge aus `ALL_ENTITIES` bleibt erhalten.
Insbesondere werden die Transaktionen für die angefragten Haushalte vor deren
`fridge_items` verarbeitet, damit die vorhandene Ledger-Rekonziliation stimmt.
Der äußere Ablauf bleibt entityweise; es wird kein kompletter Sync pro
Haushalt rekursiv gestartet.

Für nicht haushaltsgebundene Entities bleibt der bisherige `default`-Scope.
`households` bleibt unabhängig davon ein Vollabruf. Push-only-Entities werden
weiter übersprungen. Bei leerer Haushaltsliste wird für householdScoped-Entities
weder eine Abfrage noch ein Cursor-/Fehlerwrite oder eine Orphan-Reconciliation
ausgeführt. Nicht haushaltsgebundene Entities bleiben ausführbar, insbesondere
der vorhandene Bootstrap mit `entities: ['households']` und leerer ID-Liste.

### 5.2 Ergebnisse, Fehler und Retry

Die öffentliche Ergebnisform bleibt ein `PullOutcome` je Entity. Seiten-,
Write- und Local-wins-Zähler werden aus den verarbeiteten Haushaltsscopes
addiert. Erfolgreiche Teilfortschritte behalten ihre bereits atomar
committeten Cursor.

Beim ersten Abfragefehler stoppt die Entity-Schleife für weitere Haushalte;
danach stoppt wie bisher die äußere Entity-Schleife. Fehlercode, Fehlermeldung
und `errorWasPreviouslyRecorded` stammen aus dem fehlgeschlagenen Scope.
Ein Fehler in B darf weder Cursor noch Fehlerzustand von A überschreiben.

Der bestehende JWT-Refresh darf die fehlgeschlagene Entity erneut ausführen.
Bereits erfolgreiche Haushaltsscopes werden dann mit ihrem eigenen Cursor
wieder aufgenommen; es wird keine zweite Retry-Engine eingeführt.

SQLite-/Parsingfehler dürfen weiterhin propagieren. Der Seiten-Commit bleibt
eine exklusive Transaktion aus sämtlichen Mirror-Writes der Seite und dem
zugehörigen Scope-Cursor. Keine Cursorfortschreibung nach Teil-Rollback.

Die vorhandene Orphan-Reconciliation erfolgt erst nach erfolgreichem Abschluss
aller angefragten Scopes dieser Entity und erhält die deduplizierten IDs.
Nach einem Entity-Fehler läuft sie wie bisher nicht. Ihr fachliches Verhalten
und die Behandlung ausstehender Outbox-Einträge werden nicht verändert.

### 5.3 Bestehende Installationen und Wiederaufnahme

Alte `default`-Cursor für householdScoped-Entities werden nicht kopiert und
nicht als Fallback gelesen: Es ist nicht belegbar, welchem Haushalt sie
entsprechen. Sie können unverändert in `sync_state` verbleiben und werden
von diesem Pfad nicht mehr verwendet.

Fehlt `household:<id>`, beginnt der erste Pull am vorhandenen Initialcursor:
Epoch plus minimale UUID für Zeitcursor, `0` plus minimale UUID für
`sync_sequence`. Dadurch werden eventuell schon vorhandene Daten einmal
erneut geladen. Bestehende Mirror-, Dirty- und Outbox-Zeilen werden nicht
gelöscht; Anwendung und Pagination bleiben idempotent.

Nach Neustart oder Rückwechsel wird der persistierte Haushaltsscope verwendet.
Bei `[A, B] -> [A]` wird B nicht mehr abgefragt; sein Fortschritt bleibt für
einen späteren Rückwechsel erhalten. Der Account-Wipe bleibt unverändert und
verhindert eine Nutzung fremder Account-Cursor.

Ein Entzug und späterer Wiedererhalt von RLS-Rechten innerhalb desselben
Household-Scopes ist ein anderer Lebenszyklus als der hier belegte Wechsel.
Dieser Plan führt keine neue Berechtigungs-/Rejoin-Reconciliation ein und
behauptet dafür keine zusätzliche Garantie.

## 6. Umsetzungsschnitte und Reihenfolge

Bevor Produktionscode geändert wird, die aktuellen Dateien und die beiden
Beads lesen und den fokussierten Scope gegen fremde Änderungen abgrenzen.
Die versionierte Expo-57-Dokumentation wird gemäß AGENTS.md vor Codeänderungen
konsultiert; es sind keine neuen Expo-APIs erforderlich.

Empfohlene Reihenfolge ist `.16`, danach `.17`: Der zweite Fix kann bereits
bekannte Zeilen erneut laden und profitiert damit vom geprüften Apply-Vertrag.
Die Beads bleiben zwei getrennt reviewbare Korrekturen; es wird kein neuer
Sammel-Implementierungstask und kein zusätzlicher Planungszyklus benötigt.

### Schnitt A: fam-ymz7.16

Im bestehenden `realtime.test.ts` einen Regressionstest über den echten
registrierten Callback ergänzen. Die aktuelle Implementierung muss dabei
wegen des falschen gespeicherten Zustands scheitern. Direkte Matrixfälle für
den Mirror-Owner kommen in die neue, UI-freie Standard-Jest-Suite
`src/lib/sync/mirror-write.test.ts`. Diese Datei ist geplant, nicht vorhanden.

Dann ausschließlich den cleanen mutable Zweig in `applyRemoteRow` korrigieren.
Den Endzustand der SQLite-Zeile prüfen und die betroffenen bestehenden
Pull-/Konflikttests ausführen. Keine bestehenden Assertions lockern.

### Schnitt B: fam-ymz7.17

In `pull.test.ts` zuerst den Wechsel A(neuer) nach B(älter) als fehlschlagenden
Sollverhaltenstest ergänzen. Die Remote-Testquelle muss Filter, Sortierung und
Seitengrenzen tatsächlich auswerten; eine ungefilterte feste Antwort beweist
den Cursorvertrag nicht. Echte Produktion für Pull, Sync-State, Mirror und
Transaktionen verwenden.

Danach die Haushaltsschleife und Scope-Weitergabe innerhalb von `pull.ts`
einführen. Vorhandene öffentliche Typen und Rückgaben erhalten. Die nachfolgende
Testmatrix einschließlich alter `default`-Daten und Fehlerfällen abnehmen.

## 7. Verbindliche Testmatrix

| Fall | Erwarteter Nachweis |
| --- | --- |
| Clean: älter / gleich / neuer | Älter schreibt nichts; gleich folgt bestehender Übernahme; neuer aktualisiert |
| Identisches Remote-Update zweimal | Derselbe fachliche Zustand, keine Outbox-Mutation |
| Alte Löschung / neuer Restore | Aktualität entscheidet für beide Richtungen |
| Neue Zeile / append-only / dirty mit Outbox | Bisheriges Verhalten bleibt erhalten |
| Realtime nach neuerem bestätigtem Stand | Echten Callback verwenden; neuer SQLite-Zustand bleibt bestehen |
| Pull verwirft ältere Zeile | Local-wins-Zähler korrekt; Seite und Cursor bleiben konsistent |
| A(neuer) -> B(älter) -> A | B-Daten vollständig; jeder Haushalt verwendet seinen Cursor |
| `[B, A, A]` und `[A, B]` | Gleiche Scopes, keine doppelte Verarbeitung von A |
| Mehr als 500 Zeilen / gleiche Cursorwerte | Vollständige Pagination mit ID-Tiebreaker je Scope |
| `transactions` mit `sync_sequence` | Start bei `0`; eigener Cursor je Haushalt, Ledger-Reihenfolge erhalten |
| Alter default-Cursor / bestehende Dirty-Zeile | Neuer Scope lädt sicher nach; lokale Mutationsabsicht bleibt erhalten |
| Neustart / `[A, B] -> [A] -> [B]` | Fortschritt aus SQLite; kein Cursorleck zwischen Haushalten |
| Fehler in B nach Erfolg in A / Retry | A bleibt committed; B-Fehler isoliert; Retry ohne Verlust |
| Fehler mitten in einer Seite | Reale SQLite-Abfrage belegt Rollback von Daten und Scope-Cursor |
| Leerer Pull nach Fehler | Nur Fehler des betroffenen Scopes wird bereinigt |
| Leere Haushaltsliste / globale und private Entities | Keine Household-Abfrage; unverändertes Default-/Bootstrap-Verhalten |

Keine Supabase-Instanz ist für diese Regressionen erforderlich. Das bestehende
[node-sqlite-adapter.ts](../../../test/node-sqlite-adapter.ts) führt echte
SQLite-Statements im Speicher aus. Native/Netzwerkgrenzen dürfen ersetzt
werden; getestete Produktions-Owner dürfen nicht gemockt werden.

Die vorhandenen `*.integration.test.ts` werden vom Standard-Jest ausgeschlossen.
Die neuen Regressionen gehören deshalb in die oben genannten Standard-Suiten.
Bestehende Integrationstests werden nicht verschoben, umbenannt oder aus ihren
Gates entfernt. Dieser Plan führt keinen Remote-Fallback und keinen neuen
Integration-Preflight ein.

## 8. Befehle und Abnahme

Vor Beginn die tatsächlich verwendete Bun-Version protokollieren:

```bash
bun --version
bun scripts/analyze-inventory-duplicates.ts --json src/lib/sync/pull.ts src/lib/sync/mirror-write.ts
```

Kanonisch ist Bun `1.3.14`. Die Untersuchung verwendete den vorhandenen
Launcher `1.4.2`; diese Abweichung ist separat `fam-2oau` zugeordnet. Finale
Nachweise dürfen diese Versionen nicht gleichsetzen. Keine globale Installation
im Rahmen dieser beiden Beads ändern.

Erster fokussierter Prüfzyklus für Schnitt A, nachdem die geplante Suite
angelegt wurde:

```bash
bun run test -- src/lib/sync/mirror-write.test.ts src/lib/sync/realtime.test.ts --runInBand --watchman=false
```

Erster fokussierter Prüfzyklus für Schnitt B:

```bash
bun run test -- src/lib/sync/pull.test.ts --runInBand --watchman=false
```

Gemeinsame finale Abnahme nach beiden Änderungen:

```bash
bun run test -- src/lib/sync/mirror-write.test.ts src/lib/sync/realtime.test.ts src/lib/sync/pull.test.ts src/lib/sync/household-bootstrap-sync.test.ts src/lib/sync/sync-runner.test.ts src/lib/sync/push.test.ts src/lib/sync/resolve.test.ts src/lib/sync/resolve-inventory-conflict.test.ts --runInBand --watchman=false
bun run check
bun run typecheck
bun scripts/analyze-inventory-duplicates.ts --json src/lib/sync/pull.ts src/lib/sync/mirror-write.ts
```

Die globale Jest-Suite wird nicht ausgeführt. Ohne weitere Codeänderung oder
offenen Befund werden grüne Prüfungen nicht wiederholt. Werden während der
Umsetzung weitere Produktionsdateien tatsächlich notwendig, müssen deren
Verantwortung, Scope und gezielte Tests im betroffenen Bead begründet werden.

Effective LOC und normalisierte Duplikation werden vor und nach der Änderung
mit identischen Optionen verglichen. Für bereits übergroße Dateien gilt das
Ausnahmeverfahren aus CONSTRAINTS.md; dieser Plan erteilt keine Ausnahme.
Die am 2026-09-23 gemessene Planungsbaseline beträgt 365 Effective LOC für
`mirror-write.ts`, 352 für `pull.ts`, zusammen 717; keine exakte normalisierte
Duplikatgruppe. Vor der Umsetzung erneut messen, falls sich die Dateien
zwischenzeitlich geändert haben. Die Cursor-Schleife muss innerhalb eines
kohärenten Owners bleiben; Umfangswachstum rechtfertigt keine allgemeine
Sync-Abstraktion.

Eine Implementierungsaufgabe ist erst abgeschlossen, wenn ihr Sollverhalten
einschließlich Fehlerfällen getestet ist, die erforderlichen Qualitätsgates
belegt sind und die Review keine erforderlichen offenen Befunde enthält.
Die Review prüft Korrektheit, Lesbarkeit, Owner/Abhängigkeiten, Account-/Scope-
Isolation und begrenzte Laufzeitkosten. Optionale Stilvorschläge rechtfertigen
keine neue Planungsrunde. Fremde Baselinefehler werden mit aktuellem Beleg
getrennt ausgewiesen; neue Fehler werden behoben.

Die finale Übergabe nennt geänderte Dateien, tatsächliche Befehle und Ergebnisse,
Reviewnachweis sowie verbleibende Grenzen aus Abschnitt 4.3 und 5.3. Ein
grüner Diagnosefall des alten Fehlverhaltens ersetzt keine Regression.

## 9. Einbindung in den ursprünglichen Auftrag

`fam-ymz7.5` verlangt für diese zwei größeren Folgearbeiten eine vollständige,
ausführbare Planung. Dieses Dokument liefert diese Planung. Deren spätere
Implementierung bleibt in `.16` und `.17` und wird nicht nachträglich zu einer
zusätzlichen Stage-5-Abschlussbedingung gemacht.

`fam-ymz7.3` prüft beim Abschluss des ursprünglichen Auftrags den tatsächlich
umgesetzten Umfang und die korrekte Übergabe der offenen Folgearbeiten.
Die Fertigstellung dieses Dokuments schließt weder `.16` noch `.17` und
behauptet keine erfolgreiche technische Fehlerbehebung.
