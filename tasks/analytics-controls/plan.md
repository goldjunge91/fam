# Implementation Plan: Analytics-Steuerung

Spec: `docs/features/ANALYTICS_CONTROLS_SPEC.md`

Tasks are tracked in Beads. The parent issue is `fam-xp4`.

## Architecture Decisions

- Provider-Keys bleiben in `.env`; Schalter und Defaults leben in
  `src/constants/analytics.ts`.
- Alle Defaults sind `true`, damit bestehende Builds unverändert bleiben.
- Aptabase und PostHog werden unabhängig gegated.
- Produkt-Events, Fehlerberichte und Diagnose-Events sind getrennte Kanäle.
- Feature-Gating erfolgt zentral anhand der bestehenden Event-Namenspräfixe.
- Dev-Menü-Overrides werden lokal über `device-storage` persistiert und
  übersteuern die Standardwerte.
- Sentry bleibt unabhängig von dieser Analytics-Konfiguration.

## Dependency Graph

```text
fam-xp4.5 Konfiguration/Persistenz
    ├── fam-xp4.1 Provider-/Telemetrie-Gating
    │       └── fam-xp4.2 Dev-Menü-Overrides
    └── fam-xp4.3 Event-Domänen
            └───────────────┘
                    ↓
            fam-xp4.4 Tests/Dokumentation
```

## Task List

### Phase 1: Foundation

- [ ] `fam-xp4.5` Analytics-Konfiguration und Persistenz
- [ ] `fam-xp4.1` Provider- und Telemetrie-Gating
- [ ] `fam-xp4.3` Produkt-Event-Domänen vollständig zuordnen

Tasks `fam-xp4.1` und `fam-xp4.3` können nach `fam-xp4.5` parallel bearbeitet
werden.

### Checkpoint: Telemetrie-Kern

- [ ] Globale und Provider-Schalter wirken unabhängig.
- [ ] Produkt-, Fehler- und Diagnosekanäle sind getrennt.
- [ ] Jede bestehende Produkt-Event-Domäne ist deterministisch zugeordnet.
- [ ] Fokussierte Telemetrie-Tests sind grün.

### Phase 2: Dev-Menü

- [ ] `fam-xp4.2` Dev-Menü für Analytics-Overrides

### Checkpoint: Runtime-Steuerung

- [ ] Jeder Schalter ist im Dev-Menü sichtbar und änderbar.
- [ ] Overrides greifen ohne App-Neustart.
- [ ] Overrides überleben einen App-Neustart.
- [ ] Reset stellt die Defaults aus `analytics.ts` wieder her.

### Phase 3: Verification

- [ ] `fam-xp4.4` Analytics-Tests und Dokumentation

### Checkpoint: Complete

- [ ] `bun run test -- src/lib/telemetry` erfolgreich
- [ ] relevante Dev-Menü-Tests erfolgreich
- [ ] `bun run typecheck` erfolgreich
- [ ] `bun run check` erfolgreich
- [ ] Spec und Beads-Aufgaben entsprechen dem implementierten Verhalten

## Verification Strategy

Nach der Foundation: gezielte Tests für Konfiguration, Provider-Gating und
Event-Zuordnung. Nach dem Dev-Menü: Persistenz- und UI-Tests. Zum Abschluss
Typecheck und Biome-Check sowie alle betroffenen Jest-Tests. Keine lokale
Supabase-Instanz und keine vollständige ungezielte Testsuite starten.

## Risks and Mitigations

| Risiko | Auswirkung | Gegenmaßnahme |
|---|---|---|
| PostHog initialisiert trotz Deaktivierung | unerwünschte Datenübertragung | Schalter vor SDK-Initialisierung prüfen |
| Neue Events haben keine Domäne | Feature-Schalter greifen nicht | zentrale Zuordnung testen und unbekannte Events sichtbar halten |
| Dev-Override bleibt inkonsistent | UI zeigt falschen Zustand | eine zentrale Settings-API mit persistiertem Snapshot verwenden |
| Fehlerkanal wird versehentlich mit Produktkanal gekoppelt | Diagnoseverlust | getrennte Policies und Tests für jeden Kanal |
| SDK-Provider werden zur Laufzeit neu initialisiert | stale Clients oder doppelte Events | Initialisierung/Deinitialisierung als expliziten Lebenszyklus behandeln |

## Open Questions

Keine fachlichen Fragen. Vor der Implementierung bleibt nur die technische
Entscheidung, wie ein bereits initialisierter Provider bei einem Dev-Menü-
Override deaktiviert beziehungsweise wieder aktiviert wird.
