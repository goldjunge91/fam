# Startprompt für den Abschluss von fam-ymz7

Der folgende Prompt beauftragt die Umsetzung durch Subagents. Seine Erstellung
startet keine Agents und ändert keine Beads-Abnahmekriterien. Beim Verwenden
beauftragt er ausdrücklich auch die bislang separat geplanten Sync-Fixes
`fam-ymz7.16` und `.17`. Der ursprüngliche Stage-5-Vertrag bleibt davon getrennt.

## Kopierbarer Prompt

```text
Arbeite als koordinierender Hauptagent im Repository
/Users/marco/Github.tmp/family_app/fam.

Ziel: Schließe den verbliebenen Auftrag fam-ymz7 ab. Implementiere außerdem
die beiden bereits geplanten allgemeinen Sync-Folgeaufgaben fam-ymz7.16 und
fam-ymz7.17 und nimm sie ab. Starte dafür ausdrücklich mehrere Subagents.
Liefere überprüfte Änderungen und abgeschlossene Beads, soweit ihre Kriterien
tatsächlich erfüllt sind. Ein weiterer Plan allein erfüllt diesen Auftrag nicht.

1. Verbindliche Grundlagen und Scope

Lies AGENTS.md, CONSTRAINTS.md, CONTEXT.md, den Beads-Skill und
docs/specs/sync-boundaries/IMPLEMENTATION.md. Lade weitere Skills nur für die
konkrete Arbeit. Beachte vor Codeänderungen die im Projekt verlangten offiziellen
versionierten Quellen. Nutze bestehende Planung; beginne kein neues Gesamtaudit.

Rufe bd prime auf. Lies fam-ymz7, seine Kinder einschließlich geschlossener
Aufgaben, fam-2oau und die tatsächlichen Abhängigkeiten. Beschreibung, Design,
Abnahmekriterien, Notizen und Abschlussgrund sind relevant. Prüfe aktuellen
Code und vorhandene Änderungen, bevor du Arbeit verteilst. Sichere eine
lesbare Ausgangsbasis für die Änderungskontrolle; setze fremde Änderungen
niemals zurück. Ein bereits geschlossener Bead wird nicht erneut implementiert.

Der konkrete Arbeitsumfang dieses Auftrags ist:
- fam-2oau: projektlokaler Bun-Prüf-/Setup-Weg nach dessen Abnahmekriterien.
- fam-ymz7.16: ältere Remote-Updates für bestätigte Mirror-Zeilen abweisen.
- fam-ymz7.17: Pull-Cursor mit bestehendem Scope je Haushalt führen.
- fam-ymz7.5: ursprüngliche Stage-5-Abnahme erfüllen und korrekt dokumentieren.
- fam-ymz7.3: abschließende Verifikation der tatsächlich entstandenen Änderungen.
- fam-ymz7: Abschluss nach Erfüllung seiner Kriterien und Auflösung realer Blocker.

Stage 5 verlangt historisch nur die Planung von .16/.17. Verfälsche diese
Abnahme nicht: Die Umsetzung dieser zwei Beads ist ein zusätzlicher expliziter
Teil dieses Startauftrags. Ihre bestehenden fachlichen Verträge bleiben gültig.
Der Live-Stand in Beads hat Vorrang vor veralteten Statusangaben dieses Prompts;
spätere ausdrückliche Nutzerentscheidungen bleiben maßgeblich.

Ausgeschlossen bleiben die verworfenen Einkaufsaufgaben: fam-ymz7.18,
fam-ie54, fam-gng6, fam-jlkw, fam-ymz7.20 und fam-ymz7.21. Keine Änderungen
an Einkaufsabschluss, Restore/Undo, Einkaufs-UI, FlashList oder History-RLS.
Die zwei freigegebenen Korrekturen der gemeinsam verwendeten Sync-Infrastruktur
bleiben im Scope. Auth-Recovery fam-ya7p und Receipt-OCR bleiben separat.

2. Agent-Aufteilung und Zuständigkeit

Verwende die vorhandenen Subagent-Tools dieser Sitzung. Erstelle keine separaten
nutzerseitigen Codex-Tasks und keine neue Agents-Infrastruktur. Nutze höchstens
drei gleichzeitig aktive Subagents neben dir; ein kleineres Harness-Limit gilt.
Modelleinstellungen werden geerbt. Unterdelegation ist nicht nötig.

Starte nach der kurzen Bestandsaufnahme zwei unabhängige Worker:

A, Bun: fam-2oau. Exklusive Schreibverantwortung für den konkret benannten
lokalen Prüfeinstieg, erforderliche package.json-Script-Anbindungen und die
kurze Entwickleranleitung. Die einzige Versionsquelle bleibt packageManager
im Root-package.json. Root und beide Tool-Projekte berücksichtigen. Keine
globale Bun-Installation verändern. Bereits korrekte CI-/EAS-Pins erhalten.
Erwartete Dateiliste vor dem ersten Edit konkretisieren.

B, Sync: zunächst fam-ymz7.16, danach fam-ymz7.17. Exklusive Verantwortung
für src/lib/sync/mirror-write.ts, src/lib/sync/pull.ts und die gezielt
betroffenen Sync-Tests. Arbeite in zwei überprüfbaren Schritten nach
IMPLEMENTATION.md, Abschnitte 4 bis 8. Keine neue Architekturplanung.
Die Reihenfolge dient der Integration und erzeugt keinen erfundenen Beads-Blocker.

C, Review: starte einen unabhängigen Reviewer, sobald ein fertiger Teilschritt
vorliegt. Er liest Vertrag, Änderung und Nachweise, verändert keine Dateien
und schließt keine Beads. Er prüft alle fünf Achsen aus CONSTRAINTS.md.
Währenddessen dürfen andere Worker nur unabhängige, zugewiesene Dateien ändern.
Ein Scope, der gerade geprüft wird, bleibt bis zur Rückmeldung unverändert.

Bleib als Hauptagent für Integration, Testkoordination und Beads-Abnahme
verantwortlich. Prüfe während laufender Worker die Abhängigkeiten, vorhandenen
Nachweise und Testumgebung; implementiere ihre Aufgaben nicht doppelt.

Jeder Worker erhält: Bead-ID, konkretes Ziel und Warum, erlaubte Dateien,
Nicht-Scope, Vertragspfad, relevante Fehlerfälle, Prüfauftrag und Rückgabeformat.
Sage jedem ausdrücklich: Du bist nicht allein im Repository. Überschreibe oder
revertiere keine Änderungen anderer. Passe deine Arbeit an parallele Änderungen
an. Zusätzliche Dateien erst nach Abstimmung mit dem Hauptagenten bearbeiten.

Nur der Hauptagent verwaltet Beads-Schreiboperationen. Beanspruche Aufgaben
atomar mit bd update <id> --claim und halte den tatsächlichen Worker in den
Notizen fest. Übernimm keine laufende fremde Zuweisung mit --force. Prüfe bei
einem Konflikt den aktuellen Stand und arbeite an unabhängigen Aufgaben weiter.
Eine gemeinsame CLI-Identität ersetzt keine explizite Agent-Zuständigkeit.

3. Umsetzung und Nachweise

Bun: Prüfe tatsächliche Version und Ausführungspfad. Weise den positiven Fall
1.3.14 und den negativen Fall 1.4.2 gemäß fam-2oau nach. Vor anschließenden
Abnahmen muss der projektkonforme Bun-Pfad verfügbar sein. Eine Warnung über
eine falsche Version ist kein erfolgreicher Versionsnachweis.

Sync: Übernimm den vollständigen Vertrag aus IMPLEMENTATION.md, insbesondere
Zeitgleichheit, dirty-Zeilen, Deletes, getrennte Haushalts-Cursor, Legacy-default,
Pagination, Restart, Fehler und atomare Speicherung. Geändertes Sollverhalten
durch fokussierte Regressionstests nachweisen. Der getestete Owner bleibt echt;
SQLite-Zustand und Rollback nicht nur durch Mock-Aufrufe behaupten. Historische
Diagnosetests, die das Fehlverhalten erwarten, sind keine Fix-Abnahme.

Koordiniere gemeinsame Tests seriell, damit parallele Änderungen und Logs das
Ergebnis nicht verfälschen. Worker dürfen Code parallel vorbereiten, auch solange
der Bun-Pfad geklärt wird. Keine Abnahme unter einer ungeklärten Laufzeit behaupten.
Führe die relevanten Befehle aus IMPLEMENTATION.md und dem jeweiligen Bead aus:
gezielte Jest-Tests über bun run test, bun run check, bun run typecheck sowie
Scope-/Duplikationsmessung vor und nach der Änderung mit identischen Optionen.
Kein bun test und keine komplette Jest- oder pgTAP-Suite. Ohne Schemaänderung
keine Migration, DB-Reset oder zusätzliche Datenbank-Abnahme erfinden.

Jeder Worker meldet kompakt:
- geänderte Dateien und das jetzt beobachtbare Verhalten;
- Abnahmekriterien mit konkreten Nachweisen;
- ausgeführte Befehle, tatsächliche Bun-Version und Ergebnisse;
- offene Fehler, Blocker und relevante Grenzen.

Der Reviewer liefert nur belegte Befunde mit Dateistelle, Auslöser, Auswirkung
und erforderlicher Korrektur; optionale Hinweise getrennt. Hauptagent und Worker
prüfen Befunde am Code. Erforderliche Fehler behebt der zuständige Worker.
Danach werden nur betroffene Nachweise und Befunde erneut geprüft. Keine endlose
Review-/Planungsschleife und keine neue Aufgabe für bloße Statusprosa.

4. Grenzen und Fortschritt

Halte AGENTS.md und CONSTRAINTS.md unverändert ein. Keine Suppressions,
schwächeren Assertions, gelöschten Pflichtprüfungen oder erfundenen Ausnahmen.
Keine allgemeinen Refactors, neuen Dependencies oder Vertragsabschwächungen.
Keine Commits, Pushes, Deployments, Remote-DB-Änderungen oder nativen Rebuilds
als Nebenwirkung dieses Auftrags. Nutze für die Änderungskontrolle nur im
aktuellen Scope erlaubte Werkzeuge und respektiere bestehende Nutzergrenzen.

Beads sind der einzige Live-Tracker. Dokumentiere dort echte Fortschritte,
Prüfergebnisse und Blocker. Ändere den Umsetzungsplan nur bei einer notwendigen,
belegten technischen Korrektur; keine weiteren Plan-/Statusdokumente anlegen.
Triff Routineentscheidungen selbst. Bei einer wirklich notwendigen fachlichen
Entscheidung oder fehlenden Berechtigung frage gezielt und erledige währenddessen
unabhängige Arbeit. Schweigen gilt nicht als Freigabe.

Gib während der Arbeit kurze verständliche Fortschrittsmeldungen. Wenn ein
Worker stockt, kläre seinen konkreten Blocker, verkleinere den Auftrag oder
übernimm ihn nach expliziter Übergabe. Niemals zwei Schreiber auf dieselbe Datei.
Warte auf alle beauftragten Ergebnisse; beende den Auftrag nicht mit noch
laufenden Subagents. Fehlen Subagent-Tools, melde das und arbeite soweit möglich
sequenziell weiter, ohne eine unabhängige Review vorzutäuschen.

5. Abschluss

Schließe einen Implementierungsbead erst, wenn sein Code, seine fokussierten
Nachweise und die erforderliche unabhängige Review vollständig vorliegen.
Prüfe den gemeinsamen Endstand nach der letzten relevanten Änderung. Bereits
grüne Prüfungen ohne relevante Änderung oder offenen Befund nicht wiederholen.
Fremde Baselinefehler getrennt belegen; ein fehlendes Pflichtgate bleibt offen.

Schließe .5 und .3 anhand ihrer jeweils eigenen Kriterien, danach den Parent,
sofern keine echten Blocker oder offenen erforderlichen Kinder verbleiben.
Benutze weder --force noch Umhängen, Streichen oder Umdefinieren von Aufgaben,
um einen Abschluss künstlich zu ermöglichen. In diesem Startauftrag gehören
auch die implementierten und abgenommenen .16/.17 zum vollständigen Ergebnis.

Die Schlussmeldung nennt knapp:
- tatsächlich umgesetzte Änderungen und betroffene Dateien;
- geprüfte Kriterien, Befehle, Ergebnisse und Reviewnachweis;
- abgeschlossene sowie gegebenenfalls offene/blockierte Bead-IDs mit Grund;
- verbleibende technische Grenzen.
Verworfene Einkaufsaufgaben ausdrücklich als nicht umgesetzt behandeln.
Bleibt ein echter externer Blocker, liefere die genaue Fortsetzung und den
benötigten nächsten Schritt. Behaupte keinen vollständigen Abschluss.
```

## Recherchegrundlage

Recherche: 2026-09-23. Die Quellen begründen die Koordination; Dateizuständigkeiten,
Bead-IDs, Reihenfolge und Prüfungen stammen aus diesem Repository.

- [OpenAI: Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents):
  Delegation ausdrücklich anfordern, Arbeit und Ergebnisformat abgrenzen,
  Ergebnisse zusammenführen und bei parallelen Schreibzugriffen Konflikte vermeiden.
- [OpenAI: Multi-agent](https://developers.openai.com/api/docs/guides/agents-api/multi-agent):
  Unabhängige Aufgaben delegieren und abhängige Schritte koordiniert ausführen.
  Der Prompt nutzt bestehende Codex-Tools; er richtet keine Agents-API-Sitzung ein.
- [OpenAI: Codex Prompting Guide](https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide):
  Umsetzung bis zur Verifikation verfolgen und Wiederholung ohne Fortschritt
  vermeiden. Modell- oder Harness-Konfiguration aus dem älteren API-Beispiel
  wird hier nicht übernommen.
