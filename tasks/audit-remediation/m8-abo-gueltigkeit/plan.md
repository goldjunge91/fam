# M8: Abo-Zugriff bei verlorenen Ablaufereignissen begrenzen

Priorität: Medium. Reihenfolge: Phase 2.
Maßgeblicher Bead: `fam-nl7e.2`. Umsetzungsstatus ausschließlich in Beads.
Ausgangsbasis: Audit `fam-aen4` vom 27. Oktober 2026.
Dieser Einzelplan ersetzt für M8 den entsprechenden Abschnitt des bisherigen Gesamtplans.

[Übersicht](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/plan.md) · [Gemeinsamer Arbeitsrahmen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/workflow.md) · [Auditbericht](/Volumes/Programme/github/family_app/fam/reports/code-security-review-2026-10-27.md)

## Problem und Ziel

Die gespeicherten Active-Flags besitzen bei verpasstem EXPIRATION kein begrenztes verifiziertes Gültigkeitsfenster. So kann eine Berechtigung nach Ablauf unbegrenzt bestehen bleiben.


## Eigener Task und begrenzte Umsetzungspakete

| Reihenfolge | Bead | Verantwortung |
| --- | --- | --- |
| 1 | `fam-nl7e.2` | Abo-Gültigkeit bei verlorenen Ablaufereignissen begrenzen |


## Vorgehen

1. Bestätigte Gültigkeit, Grace Period und Alter der Verifikation als einen bestehenden Abo-Vertrag definieren.
2. Zu alten Status am geschützten Serverzugriff begrenzt nachziehen und bei nicht belegtem Zugriff geschlossen behandeln.
3. Den Status in vorhandener Projektion und tatsächlichem App-Konsumenten verwenden; Plus und AI getrennt halten.
4. Fake-Clock-Fälle für Ablauf, Grace Period, verlorenen Webhook, Offline-Fenster, Reconnect und API-Fehler prüfen.

## Dateiscope

- `supabase/schemas/03_households.sql nur soweit Projektion nötig`
- `bestehender RevenueCat-Status-Reader`
- `src/features/premium/premium-provider.tsx`
- `src/features/premium/premium-provider.test.tsx`
- `gezielter Entitlement-/Ablauftest`


## Abhängigkeiten

- [H7: Kaufübertragungen korrekt abgleichen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/h7-revenuecat-transfer/plan.md): Den aktuellen serverseitigen Produktionsstatus-Reader wiederverwenden.
- [H10: DB-Teststarter ohne automatischen Reset ausführen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/h10-db-testguard/plan.md): Vor eventuell erforderlichen Schema-/Entitlement-Tests.

## Gezielte Verifikation

- Fake-Clock-Fälle vor/nach Ablauf, Grace Period, fehlender Webhook, Reconnect und Providerfehler.
- Gezielte Premium-/Entitlement-Tests einschließlich lokaler Projektion.
- Keine neue allgemeine Scheduler-/Sync-Infrastruktur ohne nachgewiesene Notwendigkeit.


## Abnahme

Die verbindlichen Akzeptanzkriterien und die tatsächlichen Nachweise besitzt
`fam-nl7e.2`. Der vorgesehene fachliche Abnahmerahmen lautet:

- Verpasste EXPIRATION-Ereignisse hinterlassen keine unbegrenzte Freigabe; serverseitig bestätigte Gültigkeit schließt Grace Periods ein.
- Abgelaufener/veralteter Status wird am geschützten Serverzugriff begrenzt nachgezogen, mit geschlossenem Verhalten bei nicht belegtem Zugriff.
- Offline-Verhalten verwendet ein ausdrücklich festgelegtes letztes bestätigtes Fenster; Plus und AI bleiben unabhängig.


## Grenzen und Entscheidungen

Keinen zweiten Status-Reader und keinen allgemeinen Scheduler-/Sync-Unterbau einführen.

Das bestätigte Offline-/Grace-Fenster vor Umsetzung freigeben. Das rohe bezahlte Ablaufdatum allein ist kein vollständiger Grace-Vertrag.
