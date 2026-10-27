# Gemeinsamer Arbeitsrahmen für die Audit-Einzelpläne

Die [Übersicht](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/plan.md) ordnet die Einzelpläne. Jeder Einzelplan
beschreibt genau ein Problem und seine bestehenden Beads. Beads besitzt
Aufgabenstatus, Akzeptanzkriterien, Dateiscope und Nachweise. Dieses Dokument
enthält die gemeinsamen Umsetzungsregeln.

## Umfang und gemeinsame Dateigrenzen

S bedeutet gewöhnlich 1–2 manuell bearbeitete Dateien; M etwa 3–5 inklusive
gezielter Tests. Größere Probleme besitzen begrenzte Teil-Beads im eigenen
Plan. Generierte Migrationen und DB-Typen werden zusätzlich geprüft.
Reine mechanische Formatierung läuft getrennt in kleinen Batches.

Es entsteht kein neuer allgemeiner Sync-, Event-, Transaktions- oder
Auth-Unterbau. Gemeinsame Dateigrenzen werden organisatorisch serialisiert:
`03_households.sql` für Credits/Admin/Billing, das RevenueCat-Function-Paket
für Umgebungen/Transfer/Gültigkeit und Auth-/DB-Lifecycle für Logout/Keys.
Die Planung startet keine zusätzlichen Agenten.

## Betriebsreihenfolge

Vor Produktionsänderungen werden Live-Konfiguration, Key-Status,
Webhook-Umgebung, benötigte Server-Secrets, Migrationen und Kompatibilität
installierter Clients konkret geprüft. Schema und RLS werden kompatibel
vorbereitet, danach darauf angewiesene Functions und App-Konsumenten.
Die Key-Rotation folgt dem eigenen C1-Plan; es werden keine Betriebsmaßnahmen
durch die Planaufteilung ausgeführt.

## Prüfablauf je Änderungspaket

Vor einem Fix wird der konkrete Fehler im bestehenden Test-Owner belegt.
Bei H4 muss es ausdrücklich ein ehemaliges Mitglied und DELETE ohne
Spaltenzugriff sein; bei H8 ein echter SQLite-Rollback; bei H1/H2 echte
konkurrierende Grenzfälle. Falsche Annahmen werden dabei korrigiert.

Danach folgen die kleinste Korrektur, die betroffenen fokussierten Tests,
`bun run check` und `bun run typecheck`. Functions erhalten ihre passenden
Deno-Prüfungen. Größere Abstraktionen und zusätzliche Libraries werden nicht
aus Bequemlichkeit eingeführt. Jede Aufgabe trägt die genauen Dateiscope-
und Verifikationsangaben in ihrem Bead.

Für App-Tests immer `bun run test <konkrete Dateien>`, niemals `bun test`
oder die vollständige App-Suite. Vor RNTL-Teständerungen gelten die
installierten LLM-Guidelines und die Projektregeln. Sobald Phase 0 den
DB-Runner korrigiert hat, muss `bun run test:db <Dateien>` tatsächlich nur
diese Dateien ausführen. Bis dahin ausschließlich der nicht löschende Guard
und direkte freigegebene lokale Dateiauswahl.

Datenbankänderungen werden ausschließlich in `supabase/schemas/*.sql`
beschrieben. Dann `bun run db:diff`, erzeugte Migration prüfen, Anwendung
auf einer ausdrücklich freigegebenen lokalen Testinstanz über
`bun run db:reset`, anschließend `bun run db:types` und gezielte pgTAP-Tests.
Eine benutzte Instanz wird nicht selbstständig zurückgesetzt. Manuelle
Migrationen, Einweg-SQL und manuell editierte DB-Typen bleiben ausgeschlossen.
Neue Tabellen erhalten explizite RLS-/Rechte- und pgTAP-Nachweise.

Schema-Erweiterungen werden auf SQLite, Push, Pull, Realtime und Outbox
abgeglichen. M2 besitzt lokal bereits eine nullable Receipt-Autorenspalte;
das wird genutzt und am echten Verbraucher bestätigt. Eine Änderung bleibt
offen, wenn erforderliche Typgenerierung oder Sync-Nachweis fehlt.

Temporärdateien und alle Caches liegen task-spezifisch unter
`/Volumes/Programme/github/family_app/fam/.tmp/`. Dazu gehören TMPDIR,
Bun-Cache, Deno-Cache, Jest-Cache und Testlogs. Deno-Caches gehören in einen
bereits vom Jest-Modulgraphen ausgeschlossenen Task-Ordner. Keine Ausgaben
nach `/tmp`, Home oder globale Standard-Caches.

Vor Expo-/React-Native-Code wird die dann installierte Expo-Major-Version
erneut gelesen und die passende versionierte Dokumentation verwendet.
Native Nachweise laufen über Device Hub auf den freigegebenen Geräten,
mit Marcos Build-/Signing-Steuerung. Der tatsächliche Produktiv-Screen
beziehungsweise Siri-Workflow liefert den Nachweis.

## Freigaben und verbleibende Betriebsabhängigkeiten

Die Ablage dieses Plans ist freigegeben. **Quellcodeumsetzung, Secret-Rotation,
Remote-Konfiguration, Migrationen gegen benutzte Instanzen, native Builds
und Deployment sind durch den Planungsauftrag noch nicht gestartet.**

Die empfohlenen Entscheidungen zur Receipt-Autorenschaft und zum
Logout-Verhalten können mit der Planfreigabe bestätigt werden.
Credit-Aktionsmapping/-Fehlerabbuchung, Scan-Budgetwerte und das bestätigte
Offline-/Grace-Fenster werden vor den betroffenen Slices konkret festgehalten.
Daraus entsteht kein Anlass, unabhängige Guard-/RLS-/Berechnungsfixes liegen
zu lassen.

Für C1 wird nur anhand maskierter Metadaten entschieden, ob überhaupt noch
ein aktiver Key betroffen ist. Für das native Keychain-Sharing muss das
tatsächliche Provisioning-Profil die Gruppe erlauben. Ohne diese Nachweise
bleiben die zugehörigen Aufgaben offen; eine TS-Test-Suite ersetzt diese
Abnahme nicht.

Der abschließende Kontrollpunkt `fam-aja5` verlangt zusätzlich einen
erneuten gezielten Qualitäts-/Sicherheitsdurchlauf gegen den dann aktuellen
Stand. Frühere 131 Jest-, 64 Deno- und 220 pgTAP-Erfolge sind die Audit-
Baseline und kein Nachweis für spätere Änderungen. Commits, Pushes,
PRs und Merges folgen erst der jeweils erteilten Anweisung.
