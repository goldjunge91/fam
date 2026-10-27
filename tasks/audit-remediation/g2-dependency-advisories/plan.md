# G2: Dependency-Advisories nach Erreichbarkeit beheben

Priorität: Nach tatsächlichem Angriffspfad. Reihenfolge: Phase 0, Updates nach Priorität.
Maßgeblicher Bead: `fam-z33t.2`. Umsetzungsstatus ausschließlich in Beads.
Ausgangsbasis: Audit `fam-aen4` vom 27. Oktober 2026.
Dieser Einzelplan ersetzt für G2 den entsprechenden Abschnitt des bisherigen Gesamtplans.

[Übersicht](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/plan.md) · [Gemeinsamer Arbeitsrahmen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/workflow.md) · [Auditbericht](/Volumes/Programme/github/family_app/fam/reports/code-security-review-2026-10-27.md)

## Problem und Ziel

Der Audit meldet 108 Advisory-Einträge in 27 Paketen. Mehrere Meldungen betreffen Tools oder denselben Advisory-Bereich; daraus folgt noch kein erreichbarer Angriff auf die App.


## Eigener Task und begrenzte Umsetzungspakete

| Reihenfolge | Bead | Verantwortung |
| --- | --- | --- |
| 1 | `fam-z33t.2` | Dependency-Advisories nach Erreichbarkeit und Fixpfad auflösen |


## Vorgehen

1. Aktuelle Paketpfade und primäre Advisory-/Changelog-Quellen pro Meldung mit bun audit und bun why abgleichen.
2. Erreichbare High-/Critical-Pfade vorziehen und für jedes tatsächlich nötige Update einen kleinen eigenen Bead/Slice anlegen.
3. Version und Lockfile ausschließlich über Bun ändern; bei nativen Paketen den nötigen Dev-Client-Rebuild vorab benennen.
4. Je Paket passende Verhaltensnachweise ausführen und erneut auditieren; Gegenbelege für unzutreffende Meldungen technisch dokumentieren.

## Dateiscope

- `package.json`
- `bun.lock ausschließlich über Bun erzeugt`
- `betroffene vorhandene patches nur bei tatsächlicher Notwendigkeit`
- `Audit-Nachweis im Bead`


## Abhängigkeiten

Keine fachliche Vorbedingung aus einem anderen Problemplan. Gemeinsame Dateigrenzen und Betriebsfreigaben bleiben zu beachten.

## Gezielte Verifikation

- bun audit --json und bun why mit aktuellen Daten; primäre Advisory-/Changelog-Quellen prüfen.
- Pro Paket betroffene Tests und Typ-/Build-Anforderungen festlegen, anschließend erneut auditieren.
- Kein Bulk-Update, kein manuelles Lockfile, kein automatischer nativer Rebuild.


## Abnahme

Die verbindlichen Akzeptanzkriterien und die tatsächlichen Nachweise besitzt
`fam-z33t.2`. Der vorgesehene fachliche Abnahmerahmen lautet:

- Jeder der 108 Advisory-Einträge ist einem aktuellen Paketpfad, Upstream-Fix und tatsächlicher Laufzeit-/Tool-Exposition zugeordnet.
- Erforderliche Updates erhalten jeweils einen kleinen eigenen Umsetzungsslice; reproduzierbar nicht zutreffende Meldungen erhalten technische Evidenz statt pauschalem Ignore.
- Nach Updates bleiben nur nachweislich nicht betroffene Meldungen oder ausdrücklich offene Blocker; native Änderungen sind als Rebuildbedarf sichtbar.


## Grenzen und Entscheidungen

Kein Bulk-Update, keine manuelle Lockfile-Änderung und keine 27 spekulativen Upgrades vor der Triage.

Ungeklärte Advisories bleiben offen. Native Builds und ein möglicher Dependency-Abbau benötigen die passende Freigabe.
