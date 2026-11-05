# Gemeinsamer Arbeitsrahmen für die Audit-Einzelpläne

Die [Übersicht](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/plan.md) ordnet die verbleibenden Einzelpläne. Jeder vorhandene Einzelplan beschreibt genau ein offenes Problem und seine bestehenden Beads. Beads besitzt Aufgabenstatus, Akzeptanzkriterien, Dateiscope und Nachweise. Dieses Dokument enthält die gemeinsamen Umsetzungsregeln.

## Umfang und gemeinsame Dateigrenzen

S bedeutet gewöhnlich 1–2 manuell bearbeitete Dateien; M etwa 3–5 inklusive
gezielter Tests. Größere Probleme besitzen begrenzte Teil-Beads im eigenen
Plan. Generierte Migrationen und DB-Typen werden zusätzlich geprüft.
Reine mechanische Formatierung läuft getrennt in kleinen Batches.

Es entsteht kein neuer allgemeiner Sync-, Event-, Transaktions- oder
Auth-Unterbau. Gemeinsame Dateigrenzen werden organisatorisch serialisiert:
`03_households.sql` für Credits und Billing, das RevenueCat-Function-Paket für
Abo-Gültigkeit und Gateway-Zugriff sowie die Mengen-Owner für beide
Bedarfshooks. Die Planung startet keine zusätzlichen Agenten.

## Betriebsreihenfolge

Vor Produktionsänderungen werden Live-Konfiguration, Abo-Status, benötigte
Server-Secrets, Migrationen und Kompatibilität installierter Clients konkret
geprüft. Schema und RLS werden kompatibel vorbereitet, danach darauf
angewiesene Functions und App-Konsumenten.

## Prüfablauf je Änderungspaket

Vor einem Fix wird der konkrete Fehler im bestehenden Test-Owner belegt. H1
benötigt echte konkurrierende Credit-Grenzfälle. M2 prüft den tatsächlichen
Account-Löschpfad. M6 belegt Packungsmaße an beiden Bedarfshooks. M8 verwendet
eine kontrollierte Uhr für Ablauf, Grace, verlorene Ereignisse und Reconnect.
Falsche Annahmen werden dabei korrigiert.

Danach folgen die kleinste Korrektur, die betroffenen fokussierten Tests,
`bun run check` und `bun run typecheck`. Functions erhalten ihre passenden
Deno-Prüfungen. Größere Abstraktionen und zusätzliche Libraries werden nicht
aus Bequemlichkeit eingeführt. Jede Aufgabe trägt die genauen Dateiscope- und
Verifikationsangaben in ihrem Bead.

Für App-Tests immer `bun run test <konkrete Dateien>`, niemals `bun test` oder
die vollständige App-Suite. Vor RNTL-Teständerungen gelten die installierten
LLM-Guidelines und die Projektregeln.

Datenbankänderungen werden ausschließlich in `supabase/schemas/*.sql`
beschrieben. Dann `bun run db:diff`, erzeugte Migration prüfen, Anwendung auf
der lokalen fam-Testinstanz über `bun run db:reset`, anschließend
`bun run db:types` und gezielte pgTAP-Tests. Manuelle Migrationen, Einweg-SQL
und manuell editierte DB-Typen bleiben ausgeschlossen. Neue Tabellen erhalten
explizite RLS-, Rechte- und pgTAP-Nachweise.

Schema-Erweiterungen werden auf SQLite, Push, Pull, Realtime und Outbox
abgeglichen. M2 besitzt lokal bereits eine nullable Receipt-Autorenspalte; das
wird genutzt und am echten Verbraucher bestätigt. Eine Änderung bleibt offen,
wenn erforderliche Typgenerierung oder Sync-Nachweis fehlt.

Temporärdateien und alle Caches liegen task-spezifisch unter
`/Volumes/Programme/github/family_app/fam/.tmp/`. Dazu gehören TMPDIR,
Bun-Cache, Deno-Cache, Jest-Cache und Testlogs. Deno-Caches gehören in einen
bereits vom Jest-Modulgraphen ausgeschlossenen Task-Ordner. Keine Ausgaben
nach `/tmp`, Home oder globale Standard-Caches.

Vor Expo- oder React-Native-Code wird die installierte Expo-Major-Version
erneut gelesen und die passende versionierte Dokumentation verwendet. Native
Nachweise laufen über Device Hub auf den freigegebenen Geräten, mit Marcos
Build- und Signing-Steuerung. Der tatsächliche Produktiv-Screen liefert den
Nachweis.

## Freigaben und verbleibende Betriebsabhängigkeiten

Die Ablage dieser Pläne ist freigegeben. **Quellcodeumsetzung,
Remote-Konfiguration, Migrationen gegen verknüpfte oder gehostete Instanzen,
native Builds und Deployment sind durch den Planungsauftrag noch nicht
gestartet.**

Die empfohlene nullable Receipt-Autorenschaft kann mit der Planfreigabe
bestätigt werden. Credit-Aktionsmapping, Fehlerabbuchung und das bestätigte
Offline- und Grace-Fenster werden vor den betroffenen Slices konkret
festgehalten. Daraus entsteht kein Anlass, unabhängige RLS- oder
Berechnungsfixes liegen zu lassen.

Der abschließende Kontrollpunkt `fam-aja5` verlangt zusätzlich einen erneuten
gezielten Qualitäts- und Sicherheitsdurchlauf gegen den dann aktuellen Stand.
Frühere Prüfergebnisse sind historische Evidenz und kein Nachweis für spätere
Änderungen. Commits, Pushes, PRs und Merges folgen erst der jeweils erteilten
Anweisung.
