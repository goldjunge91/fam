# M7: Bildproxy gegen Zugriffe auf interne Dienste begrenzen

Priorität: Medium. Reihenfolge: Phase 0.
Maßgeblicher Bead: `fam-7iu0.2`. Umsetzungsstatus ausschließlich in Beads.
Ausgangsbasis: Audit `fam-aen4` vom 27. Oktober 2026.
Dieser Einzelplan ersetzt für M7 den entsprechenden Abschnitt des bisherigen Gesamtplans.

[Übersicht](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/plan.md) · [Gemeinsamer Arbeitsrahmen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/workflow.md) · [Auditbericht](/Volumes/Programme/github/family_app/fam/reports/code-security-review-2026-10-27.md)

## Problem und Ziel

Der lokale Prospekt-Viewer ruft jede übergebene URL ab, folgt Redirects und gibt den Body mit wildcard-CORS zurück. Bei erreichbarem Tool kann der Rechner zum Proxy ins interne Netz werden.


## Eigener Task und begrenzte Umsetzungspakete

| Reihenfolge | Bead | Verantwortung |
| --- | --- | --- |
| 1 | `fam-7iu0.2` | Prospekt-Bildproxy auf freigegebene Bildquellen begrenzen |


## Vorgehen

1. Den Server auf Loopback und erlaubte Browser-Origins begrenzen.
2. Vorhandenen Bildquellen-URL-Owner wiederverwenden und nur freigegebene HTTPS-Quellen abrufen.
3. Ungeprüfte Redirects verhindern sowie Timeout und Größenlimits vorsehen.
4. Fremde Hosts, lokale/private Ziele, Redirects und Ressourcenlimits mit Fake-Fetch prüfen; gültige Bilder erhalten.

## Dateiscope

- `tools/brochure-viewer/server.ts`
- `supabase/functions/_shared/bring-image-url.ts nur bei nachgewiesener erforderlicher Anpassung`
- `fokussierter Proxy-Test`


## Abhängigkeiten

Keine fachliche Vorbedingung aus einem anderen Problemplan. Gemeinsame Dateigrenzen und Betriebsfreigaben bleiben zu beachten.

## Gezielte Verifikation

- Tabellarische URL-/Redirect-/Timeout-/Größenfälle mit Fake-Fetch.
- Gezielte bestehende URL-Validierungsfälle.
- Kein Zugriff auf echte interne Dienste.


## Abnahme

Die verbindlichen Akzeptanzkriterien und die tatsächlichen Nachweise besitzt
`fam-7iu0.2`. Der vorgesehene fachliche Abnahmerahmen lautet:

- Nur bestehende freigegebene HTTPS-Bildquellen werden abgerufen; Loopback, private IPs, fremde Hosts und Redirects werden abgewiesen.
- Request- und Response-Größe sowie Laufzeit sind begrenzt; Server bindet Loopback und kontrolliert Browser-Origins.
- Valide Bilder bleiben darstellbar; vorhandener URL-Owner wird wiederverwendet.


## Grenzen und Entscheidungen

Der Batch-Importer ist ausschließlich H3 zugeordnet. Keine echten internen Probes und kein zweiter fast gleicher URL-Parser.

Bestehende vertrauenswürdige Bildquellen erhalten; Verhalten eines laufenden Nutzer-Servers nicht verändern.
