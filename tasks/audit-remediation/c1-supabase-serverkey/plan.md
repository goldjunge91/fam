# C1: Historischen Supabase-Serverkey behandeln

Priorität: Critical, Reichweite lokal bestätigt. Reihenfolge: Phase 0.
Maßgeblicher Bead: `fam-w1w0`. Umsetzungsstatus ausschließlich in Beads.
Ausgangsbasis: Audit `fam-aen4` vom 27. Oktober 2026.
Dieser Einzelplan ersetzt für C1 den entsprechenden Abschnitt des bisherigen Gesamtplans.

[Übersicht](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/plan.md) · [Gemeinsamer Arbeitsrahmen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/workflow.md) · [Auditbericht](/Volumes/Programme/github/family_app/fam/reports/code-security-review-2026-10-27.md)

## Problem und Ziel

Derselbe Supabase-Serverkey liegt in sechs lokalen Git-Checkpoint-Refs einer historischen .env copy. Eine Veröffentlichung und die heutige Gültigkeit wurden nicht belegt.


## Eigener Task und begrenzte Umsetzungspakete

| Reihenfolge | Bead | Verantwortung |
| --- | --- | --- |
| 1 | `fam-w1w0` | Historischen Supabase-Serverkey behandeln |


## Vorgehen

1. Den Key ausschließlich über maskierte Metadaten dem tatsächlichen Projekt und Widerrufsstatus zuordnen.
2. Bei aktivem Key Ersatz, tatsächliche Verbraucher und kontrollierten Widerruf vorbereiten; Betriebsänderung erst nach Freigabe durchführen.
3. Repository-Ignore auf .env-Kopien ausweiten und Platzhalterdateien weiterhin gezielt versionierbar lassen.
4. Den redigierten Status- und Verbrauchernachweis im Bead ablegen; ein bereits widerrufener Key benötigt keine erneute Rotation.

## Dateiscope

- `.gitignore`
- `Server-Konfiguration nur nach ausdrücklicher Betriebsfreigabe`


## Abhängigkeiten

Keine fachliche Vorbedingung aus einem anderen Problemplan. Gemeinsame Dateigrenzen und Betriebsfreigaben bleiben zu beachten.

## Gezielte Verifikation

- Redigierter Herkunfts-/Statusnachweis; keine Secret-Nutzlast in Ausgaben.
- Nach freigegebener Rotation minimale Funktionsprüfung tatsächlicher Verbraucher, ohne Kundendatenzugriffe.
- Ignore-Test für .env, .env copy, .env.local und weiterhin versionierbare .env.example.


## Abnahme

Die verbindlichen Akzeptanzkriterien und die tatsächlichen Nachweise besitzt
`fam-w1w0`. Der vorgesehene fachliche Abnahmerahmen lautet:

- Masked Key-ID/Projekt und aktueller Widerrufsstatus sind ohne Secret-Ausgabe belegt; lokale Checkpoint-Reichweite bleibt korrekt dokumentiert.
- Ein aktiver betroffener Key wird kontrolliert ersetzt/widerrufen und seine tatsächlichen Verbraucher funktionieren; bereits widerrufener Key benötigt keine unnötige erneute Rotation.
- Neue .env-Kopien werden vom Repository ausgeschlossen; History-/Checkpoint-Löschung wird nicht automatisch ausgeführt.


## Grenzen und Entscheidungen

Keine Key-Werte in Dokumenten oder Logs; kein automatisches Löschen von Checkpoints, kein History-Rewrite.

Eine nötige Rotation wird konkret freigegeben. Die lokale Checkpoint-Bereinigung ist eine getrennte Entscheidung.
