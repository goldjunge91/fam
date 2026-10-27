# H7: Kaufübertragungen korrekt abgleichen

Priorität: High. Reihenfolge: Phase 2.
Maßgeblicher Bead: `fam-nl7e.1`. Umsetzungsstatus ausschließlich in Beads.
Ausgangsbasis: Audit `fam-aen4` vom 27. Oktober 2026.
Dieser Einzelplan ersetzt für H7 den entsprechenden Abschnitt des bisherigen Gesamtplans.

[Übersicht](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/plan.md) · [Gemeinsamer Arbeitsrahmen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/workflow.md) · [Auditbericht](/Volumes/Programme/github/family_app/fam/reports/code-security-review-2026-10-27.md)

## Problem und Ziel

Der allgemeine Event-Parser verlangt app_user_id und weist TRANSFER-Ereignisse ab. Die alte und neue Subscriber-Seite werden dadurch nicht korrekt abgeglichen.


## Eigener Task und begrenzte Umsetzungspakete

| Reihenfolge | Bead | Verantwortung |
| --- | --- | --- |
| 1 | `fam-nl7e.1` | RevenueCat-Transfer typisiert für beide Subscriber abgleichen |


## Vorgehen

1. Nach der HMAC-Prüfung eine eigene typisierte TRANSFER-Eventform validieren.
2. transferred_from und transferred_to vollständig gegen bestätigten aktuellen Produktionsstatus abgleichen.
3. Einen kleinen serverseitigen RevenueCat-Status-Reader am bestehenden Function-Owner vorsehen, der auch den nachfolgenden Gültigkeitspfad bedienen kann.
4. Beide Haushalte, Replay, veraltetes Event, fehlende environment und API-Fehler prüfen; Projektionen idempotent aktualisieren.

## Dateiscope

- `supabase/functions/revenuecat-webhook/handler.ts`
- `supabase/functions/revenuecat-webhook/index.ts`
- `kleiner serverseitiger Status-Reader im bestehenden Function-Owner`
- `supabase/functions/revenuecat-webhook/handler_test.ts`
- `Test für Status-Reader`


## Abhängigkeiten

- [H6: Sandbox und Produktionsberechtigungen trennen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/h6-revenuecat-sandbox/plan.md): Produktions-/Sandbox-Grenze vor dem Transfer-Abgleich bereitstellen.

## Gezielte Verifikation

- Deno-Tests mit zwei Accounts/Haushalten, Duplikat, veraltetem Event und API-Fehler.
- Gezielte pgTAP-Entitlement-/Hardening-Suites, wenn RPCs berührt werden.
- Produktions-/Sandbox-Status in Tests getrennt injizieren.


## Abnahme

Die verbindlichen Akzeptanzkriterien und die tatsächlichen Nachweise besitzt
`fam-nl7e.1`. Der vorgesehene fachliche Abnahmerahmen lautet:

- Gültig signiertes TRANSFER ohne app_user_id wird separat validiert und verarbeitet; ungültige HMAC erreicht keinen Status-Reader.
- Alle transferred_from-/transferred_to-IDs werden gegen bestätigten Produktionsstatus abgeglichen und Haushaltsprojektionen idempotent aktualisiert.
- Ein TRANSFER ohne environment kann über bestätigten Produktionsstatus sicher verarbeitet werden; alte Berechtigung fällt weg, berechtigte neue Zuordnung wird gesetzt.


## Grenzen und Entscheidungen

M8 besitzt das langfristige Gültigkeits-/Grace-Verhalten. Keine allgemeine Event-Plattform und keine echten Kauftransfers als Test.

Ein Transfer ohne environment erhält seine Produktionsentscheidung aus bestätigten Serverdaten, nicht aus einer pauschalen Ablehnung.
