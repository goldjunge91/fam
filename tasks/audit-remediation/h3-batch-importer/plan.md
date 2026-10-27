# H3: Privilegierten Batch-Importer absichern

Priorität: High. Reihenfolge: Phase 0.
Maßgeblicher Bead: `fam-7iu0.1`. Umsetzungsstatus ausschließlich in Beads.
Ausgangsbasis: Audit `fam-aen4` vom 27. Oktober 2026.
Dieser Einzelplan ersetzt für H3 den entsprechenden Abschnitt des bisherigen Gesamtplans.

[Übersicht](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/plan.md) · [Gemeinsamer Arbeitsrahmen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/workflow.md) · [Auditbericht](/Volumes/Programme/github/family_app/fam/reports/code-security-review-2026-10-27.md)

## Problem und Ziel

Der Import-Server bindet ohne Authentifizierung an alle Interfaces und arbeitet mit einem Supabase-Serverkey. Request-gesteuerte Asset-Pfade können zusätzlich lokale Dateien lesen und hochladen.


## Eigener Task und begrenzte Umsetzungspakete

| Reihenfolge | Bead | Verantwortung |
| --- | --- | --- |
| 1 | `fam-7iu0.1` | Batch-Importer auf autorisierte lokale Requests beschränken |


## Vorgehen

1. Server auf Loopback binden und alle Mutationen vorab durch Host-/Origin-/Request-Autorisierung schützen.
2. Asset-Root aus vertrauenswürdiger Startkonfiguration übernehmen und aufgelöste Pfade einschließlich Symlinks innerhalb dieses Roots halten.
3. Ablehnungen vor Datei-Lesen oder DB-Schreiben durchführen.
4. Gültigen lokalen Import sowie fremde Hosts, Origins, fehlende Autorisierung und Dateiausbrüche mit injizierten Adaptern prüfen.

## Dateiscope

- `tools/batch-import/server.ts`
- `neuer reiner Request-/Pfad-Guard im selben Tool, falls erforderlich`
- `fokussierter Tool-Test für Request- und Pfadgrenzen`


## Abhängigkeiten

Keine fachliche Vorbedingung aus einem anderen Problemplan. Gemeinsame Dateigrenzen und Betriebsfreigaben bleiben zu beachten.

## Gezielte Verifikation

- Tool-Tests mit injiziertem Dateizugriff und Supabase-Adapter.
- Gezielter Netzwerkbindungs-/Request-Nachweis in eigener Testinstanz, ohne laufende Nutzer-Tools zu verändern.
- Bestehenden Importvertrag prüfen; keine echten Katalog-Uploads.


## Abnahme

Die verbindlichen Akzeptanzkriterien und die tatsächlichen Nachweise besitzt
`fam-7iu0.1`. Der vorgesehene fachliche Abnahmerahmen lautet:

- Server bindet ausschließlich Loopback; Mutation verlangt vertrauenswürdigen Host/Origin und eine wirksame lokale Request-Autorisierung.
- Asset-Root stammt aus Startkonfiguration; absolute fremde Pfade, Traversal und Symlink-Ausbrüche werden vor Datei-Lesen/DB-Schreiben abgewiesen.
- Gültiger lokaler Import funktioniert; abgewiesene Requests haben weder Dateizugriff noch Supabase-Schreibeffekte.


## Grenzen und Entscheidungen

Der Bildproxy ist ausschließlich M7 zugeordnet. Keine neue gemeinsame Server-Abstraktion und keine echten Katalog-Uploads.

Lokale Bedienbarkeit erhalten; ein laufendes Nutzer-Tool wird für Tests nicht gestartet, gestoppt oder umkonfiguriert.
