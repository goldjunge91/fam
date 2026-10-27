# H5: Browser-OAuth auf PKCE umstellen

Priorität: High. Reihenfolge: Phase 3.
Maßgeblicher Bead: `fam-521t`. Umsetzungsstatus ausschließlich in Beads.
Ausgangsbasis: Audit `fam-aen4` vom 27. Oktober 2026.
Dieser Einzelplan ersetzt für H5 den entsprechenden Abschnitt des bisherigen Gesamtplans.

[Übersicht](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/plan.md) · [Gemeinsamer Arbeitsrahmen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/workflow.md) · [Auditbericht](/Volumes/Programme/github/family_app/fam/reports/code-security-review-2026-10-27.md)

## Problem und Ziel

Der Browser-OAuth-Flow nimmt Access- und Refresh-Token über das private fam:-Schema entgegen. Der Rückweg ist nicht über einen PKCE-Verifier an den begonnenen Login gebunden.


## Eigener Task und begrenzte Umsetzungspakete

| Reihenfolge | Bead | Verantwortung |
| --- | --- | --- |
| 1 | `fam-521t` | Browser-OAuth auf PKCE umstellen |


## Vorgehen

1. Client, Callback-Parser und Browser-OAuth-Einstieg konsistent auf PKCE umstellen.
2. Den Verifier im bestehenden verschlüsselten Auth-Storage halten und ausschließlich den erwarteten Callback-Code akzeptieren.
3. Abbruch, Fehler, Neustart und einen konkurrierenden zweiten Start prüfen.
4. Google-/Browser-Apple-Pfade sowie bestehende Recovery- und native Apple-Nonce-Flows nachweisen.

## Dateiscope

- `src/lib/backend/supabase/remote-client.ts`
- `src/features/auth/oauth-provider-actions.ts`
- `src/features/auth/domain/auth-deep-link.ts`
- `src/features/auth/oauth-provider-actions.test.ts`
- `src/features/auth/domain/auth-deep-link.test.ts`


## Abhängigkeiten

Keine fachliche Vorbedingung aus einem anderen Problemplan. Gemeinsame Dateigrenzen und Betriebsfreigaben bleiben zu beachten.

## Gezielte Verifikation

- Gezielte OAuth-/Deep-Link-/Remote-Client-/Session-Storage-Tests.
- Verifizierter Dev-Client-Nachweis auf freigegebenem iOS/Android-Ziel nach Marcos Laufzeitfreigabe.
- Zuerst PKCE am vorhandenen Callback; HTTPS-App-Link ist eine separate optionale Verbesserung, falls keine aktuelle Konfigurationsänderung nötig ist.


## Abnahme

Die verbindlichen Akzeptanzkriterien und die tatsächlichen Nachweise besitzt
`fam-521t`. Der vorgesehene fachliche Abnahmerahmen lautet:

- Browser-OAuth verwendet durchgehend PKCE und nimmt ausschließlich den zum begonnenen Flow gehörenden Callback-Code an; keine weiterhin akzeptierten impliziten Token-Fragmente.
- Verifier bleibt im bestehenden verschlüsselten Auth-Storage; Abbruch, Fehler, Neustart und gleichzeitiger zweiter Start führen nicht zu falscher Session-Bindung.
- Google sowie der Browser-Apple-Fallback und bestehende Passwort-Recovery-Flows sind nachgewiesen; nativer Apple-iOS-Nonce-Flow bleibt korrekt.


## Grenzen und Entscheidungen

Keine weiter akzeptierten impliziten Token-Fragmente und keine neue Auth-Storage-Runtime.

Zuerst den bestehenden Rückweg mit PKCE sichern. Ein neuer verifizierter HTTPS-App-Link bleibt getrennte Verbesserung, soweit für diesen Fix nicht erforderlich. Laufzeitnachweis nur auf freigegebenem Ziel.
