# G1: Edge-Qualitätsgate reproduzierbar grün herstellen

Priorität: Qualitätsnacharbeit. Reihenfolge: Phase 0.
Maßgeblicher Bead: `fam-z33t.1`. Umsetzungsstatus ausschließlich in Beads.
Ausgangsbasis: Audit `fam-aen4` vom 27. Oktober 2026.
Dieser Einzelplan ersetzt für G1 den entsprechenden Abschnitt des bisherigen Gesamtplans.

[Übersicht](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/plan.md) · [Gemeinsamer Arbeitsrahmen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/workflow.md) · [Auditbericht](/Volumes/Programme/github/family_app/fam/reports/code-security-review-2026-10-27.md)

## Problem und Ziel

check:functions bricht an 14 Formatierungsdateien ab. Separates Lint meldet fünf Probleme; die zusätzliche Typprüfung ist durch Dependency-Auflösung blockiert.


## Eigener Task und begrenzte Umsetzungspakete

| Reihenfolge | Bead | Verantwortung |
| --- | --- | --- |
| 1 | `fam-z33t.1` | Edge-Formatierung, Lint und reproduzierbare Typprüfung herstellen |


## Vorgehen

1. Mechanische Formatierung getrennt von Verhaltenskorrekturen in kleinen Batches durchführen.
2. Die vier require-await-Fälle und die ungenutzte Variable gezielt korrigieren, ohne Regeln abzuschalten.
3. Deno-/npm-Auflösung samt Lockfile reproduzierbar konfigurieren und task-spezifische Caches aus dem Jest-Modulgraphen heraushalten.
4. check:functions vollständig und die betroffenen vorhandenen Deno-Tests ausführen; App-Gates erhalten.

## Dateiscope

- `supabase/functions/deno.json`
- `supabase/functions/deno.lock nur generatorgestützt`
- `mechanische Formatierung der 14 gemeldeten Function-Dateien in getrennten Batches`
- `supabase/functions/ai-gateway/handler_test.ts`
- `supabase/functions/ai-gateway/index.ts`


## Abhängigkeiten

Keine fachliche Vorbedingung aus einem anderen Problemplan. Gemeinsame Dateigrenzen und Betriebsfreigaben bleiben zu beachten.

## Gezielte Verifikation

- bun run check:functions mit Repository-TMPDIR/DENO_DIR.
- 64 vorhandene gezielte Edge-Tests erneut ausführen, soweit Owner betroffen.
- App-Biome/Typecheck bleiben grün; Formatierung getrennt von Verhaltensfixes.


## Abnahme

Die verbindlichen Akzeptanzkriterien und die tatsächlichen Nachweise besitzt
`fam-z33t.1`. Der vorgesehene fachliche Abnahmerahmen lautet:

- check:functions läuft mit einer dokumentierten reproduzierbaren Dependency-Auflösung vollständig durch.
- Die 14 Formatierungsdateien und fünf Lintprobleme sind behoben, ohne Regeln abzuschalten oder fachliches Verhalten zu ändern.
- Deno-Caches liegen im projektspezifischen ignorierten Verzeichnis und erzeugen keine zusätzlichen Jest-Modulkollisionen.


## Grenzen und Entscheidungen

Keine pauschalen Dependency-Upgrades und keine fachlichen AI-/Webhook-Änderungen in der Formatierung.

Automatische Lockfile-Erzeugung und klare lokale Cache-Pfade verwenden; Typprüfung nicht abschwächen.
