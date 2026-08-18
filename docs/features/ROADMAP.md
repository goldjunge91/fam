# Roadmap

Der MVP ist abgeschlossen: Foundation, RLS, Offline-Sync, Auth, Haushalt,
Bestand, Einkaufsliste, Lebensmitteldatenbank, Tracking, Dashboard und
Datenschutz sind umgesetzt. Die Abschlussdokumentation steht im
[Projektstatus](projekt_status.md).

Die nachfolgenden Epics sind Produktoptionen, keine fest zugesagten Releases.
Vor einer Umsetzung wird das konkrete Problem, der Datenbedarf und die
Datenschutzwirkung entschieden. Die Reihenfolge folgt Nutzen und Abhängigkeiten,
nicht der ursprünglichen Issue-Nummer.

## Nächste sinnvolle Phase

1. **Rezept-Manager und Meal-Planner** (#12, #15) — verbindet Einkaufsliste,
   Bestand und Ernährung zu einem durchgehenden Familien-Workflow.
2. **Premium konsolidieren** (#23) — Paywall, Entitlements und Haushaltszugriff
   verlässlich betreiben, bevor weitere kostenpflichtige Funktionen entstehen.
3. **Fortschritts-Tracking** (#13) — nur mit einer klaren, nicht demotivierenden
   Produktentscheidung und belastbaren Daten.
4. **Push-Benachrichtigungen** (#14) — nach einer Entscheidung, welche Hinweise
   wirklich nützlich und datensparsam sind.

## Spätere Optionen

| Bereich | Epic | Voraussetzung |
| --- | --- | --- |
| Einkauf | #11 Übernahme in Bestand | Produktentscheid zum Shopping-Run-Workflow |
| Preise | #16 Preisvergleich | offizielle Datenquelle oder manuelle Preispflege |
| Gesundheit | #17 Health-Integration | explizites Datenschutz- und Plattformkonzept |
| Tracking | #18 Intervallfasten | eigenständiger, validierter Nutzen |
| Kochen | #19 Kochmodus | Rezeptdatenmodell und Meal-Planner |
| Motivation | #20 Gamification | verlässliche Ereignisdaten und opt-in Konzept |
| Community | #21 Rezept-Sharing | Moderation, Datenschutz und Missbrauchsschutz |
| Auswertung | #22 Analytics und Reports | klare Datenschutz- und Produktentscheidung |
| Plattform | #24 Homescreen-Widgets | belastbarer Nutzerbedarf und native Umsetzung |

## Umsetzungskriterien

- Neue Datenmodelle folgen dem deklarativen Schema-Workflow und haben RLS- sowie
  pgTAP-Tests.
- Synchronisierte Daten erhalten lokale SQLite- und Outbox-Parität.
- Jede sichtbare Aktion hat einen nachvollziehbaren Gegenweg.
- Vor dem Abschluss laufen mindestens `bun run check`, `bun run typecheck` und
  `bun run test`; bei Schemaänderungen zusätzlich `bun run test:db`.

Historische Ideen und Vorüberlegungen befinden sich in
[`plans/phase-2-4-brainstorm.md`](plans/phase-2-4-brainstorm.md).
