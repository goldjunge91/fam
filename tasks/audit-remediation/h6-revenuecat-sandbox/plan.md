# H6: Sandbox und Produktionsberechtigungen trennen

Priorität: High, Produktionskonfiguration ungeprüft. Reihenfolge: Phase 1.
Maßgeblicher Bead: `fam-fp4t`. Umsetzungsstatus ausschließlich in Beads.
Ausgangsbasis: Audit `fam-aen4` vom 27. Oktober 2026.
Dieser Einzelplan ersetzt für H6 den entsprechenden Abschnitt des bisherigen Gesamtplans.

[Übersicht](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/plan.md) · [Gemeinsamer Arbeitsrahmen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/workflow.md) · [Auditbericht](/Volumes/Programme/github/family_app/fam/reports/code-security-review-2026-10-27.md)

## Problem und Ziel

Ein gültig signiertes Sandbox-Kaufereignis kann dieselbe Haushaltsprojektion verändern wie ein Produktionskauf. Die bisherige Anleitung aktiviert beide Umgebungen am selben Endpoint.


## Eigener Task und begrenzte Umsetzungspakete

| Reihenfolge | Bead | Verantwortung |
| --- | --- | --- |
| 1 | `fam-fp4t` | Sandbox und Produktionsberechtigungen trennen |


## Vorgehen

1. Aktivierungsfähige Kaufereignisse typspezifisch einschließlich ihrer Umgebung validieren.
2. Am Produktionsendpoint nur bestätigte Produktionsaktivierungen zulassen; Sandbox und unbekannte/fehlende Umgebung dürfen keinen Kauf-Grant erzeugen.
3. HMAC über den unveränderten Body vor jeder weiteren Verarbeitung erhalten.
4. Tests und Einrichtungsanleitung anpassen; tatsächliche Dashboard-Umstellung und bestehende Grants separat kontrollieren.

## Dateiscope

- `supabase/functions/revenuecat-webhook/handler.ts`
- `supabase/functions/revenuecat-webhook/index.ts nur bei Umgebungsparameter`
- `supabase/functions/revenuecat-webhook/handler_test.ts`
- `docs/revenuecat/revenuecat-webhook.md`


## Abhängigkeiten

Keine fachliche Vorbedingung aus einem anderen Problemplan. Gemeinsame Dateigrenzen und Betriebsfreigaben bleiben zu beachten.

## Gezielte Verifikation

- Deno-Fälle gültig signiertes SANDBOX, PRODUCTION, fehlende Umgebung und ungültige HMAC.
- Vorhandene Kauf-/Expiry-Handlerfälle angepasst und grün.
- Tatsächliche Dashboard-Umstellung und Grant-Abgleich nur nach Betriebsfreigabe.


## Abnahme

Die verbindlichen Akzeptanzkriterien und die tatsächlichen Nachweise besitzt
`fam-fp4t`. Der vorgesehene fachliche Abnahmerahmen lautet:

- Produktive Aktivierung akzeptiert nur extern validierte bestätigte Produktionsereignisse; Sandbox, fehlende oder unbekannte Umgebung bewirken keinen Grant.
- HMAC wird weiter am unveränderten Body und vor jeglicher Verarbeitung geprüft; TEST-Ereignisse bleiben harmlos.
- Einrichtungsanleitung trennt Sandbox und Production; TRANSFER wird später typspezifisch über bestätigten Produktionsstatus behandelt, auch wenn environment fehlt.


## Grenzen und Entscheidungen

Kaufaktivierung hier absichern; TRANSFER bleibt H7 zugeordnet und darf wegen optionaler environment nicht pauschal falsch behandelt werden.

Webhook-Konfiguration und bestehende Produktionsgrants erst nach Betriebsfreigabe verändern.
