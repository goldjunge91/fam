# Implementation Plan: RevenueCat Plus und AI

## Overview

Dieser Plan setzt
[`docs/SPEC.md`](../../SPEC.md)
um. Plus und AI gelten haushaltsweit, aber ausschließlich für den jeweils
zugeordneten aktiven Haushalt. Beide Entitlements sind unabhängig und können
gleichzeitig aktiv sein. Der AI-Zielhaushalt darf
höchstens einmal pro Kalendermonat wechseln. Das vorgeschlagene AI-Fair-Use-
Kontingent beträgt zunächst 100 Credits pro Haushalt und Monat mit der
Gewichtung 1/3/2.

Die Task-Quelle ist Beads. Die acht Tasks sind unter dem Feature
`fam-yu6` angelegt. Diese Datei ist nur die technische Reihenfolge,
Architektur und Verifikation; es gibt bewusst keine zusätzliche
`tasks/todo.md`.

## Architecture Decisions

- RevenueCat bleibt die Quelle für Produkt-, Offering- und Store-Metadaten.
  Entitlement-, Produkt-, Offering- und Package-IDs sind für Projekt
  `projca17095c` verifiziert. Der Client nutzt die Offering-Identifier `plus`
  und `ai` sowie `$rc_monthly` und `$rc_annual`; interne Dashboard-IDs bleiben
  Dokumentation.
- Plus-Produkte gewähren ausschließlich `Plus`. AI-Produkte gewähren
  ausschließlich `AI`. Beide Produkte können unabhängig oder gleichzeitig
  aktiv sein.
- Die fachliche Entscheidung trifft das Produktteam. Die Store-seitige
  Subscription-Konfiguration liegt in App Store Connect und Google Play
  Console. RevenueCat bildet die Store-Produkte auf Entitlements und Offerings
  ab, ersetzt aber keine Store-Regeln.
- Für ein späteres gleichzeitiges Plus-/AI-Modell wird die Store-Konfiguration
  als Release-Gate geprüft. Auf iOS braucht jedes unabhängig aktive Abo eine
  eigene Subscription Group; auf Android werden Plus und AI als getrennte
  Subscription-Produkte geprüft.
- RevenueCat identifiziert weiterhin den kaufenden Supabase-Account.
  Haushaltszugriff wird serverseitig über den aktiven Haushalt und einen
  abonnentenbezogenen AI-Assignment-State abgebildet.
- Plus und AI werden als getrennte Haushaltsprojektionen geführt. Ein
  AI-Haushaltswechsel ist eine atomare serverseitige Operation und wird am
  Subscriber gespeichert, damit das Monatslimit nicht über mehrere Haushalte
  umgangen werden kann.
- Ein aktives Entitlement blockiert einen weiteren Kauf desselben Tiers. Plus
  und AI blockieren sich gegenseitig nicht; ein kombinierter Kauf bleibt eine
  spätere Store- und Produktentscheidung.
- Das alte Entitlement `Premium` wird direkt durch `Plus` ersetzt. Es gibt
  keinen Legacy-Fallback und keine Bestandskunden-Kompatibilitätsmigration.
- AI-Fair-Use wird erst an eine konkrete AI-Fachfunktion angeschlossen. Die
  aktuelle Planung definiert den serverseitigen Vertrag, aber keine
  vorgezogene AI-UI, da noch keine AI-Funktion existiert.
- Die App verwendet ihre eigene Paywall-UI. RevenueCat-Paywall-Drafts werden
  nicht über `RevenueCatUI.presentPaywall*` ausgeliefert.

## Dependency Graph

```text
RevenueCat-Katalogvertrag (fam-yu6.1)
    ├── Haushaltsmodell und RLS (fam-yu6.2)
    │       ├── Webhook und Assignment (fam-yu6.4)
    │       │       └── Provider und bestehende Gates (fam-yu6.5)
    │       └── Fair-Use-Vertrag (fam-yu6.7)
    └── Purchases-API und Identität (fam-yu6.3)
            └── Provider und bestehende Gates (fam-yu6.5)
                    └── Paywall und Route (fam-yu6.6)

Store-Konfigurationsprüfung (fam-yu6.8) hängt vom RevenueCat-Katalog ab und
blockiert den kombinierten Kauf-Test vor dem Release.
```

Tasks `fam-yu6.2` und `fam-yu6.3` können nach dem RevenueCat-Katalogvertrag
parallel bearbeitet werden. Der Webhook bleibt nach dem Schema sequentiell.

## Task List

### Phase 1: Vertrag und Fundament

1. `fam-yu6.1` RevenueCat-Katalog auslesen und Produktvertrag festhalten.
2. `fam-yu6.2` Haushaltsmodell für Plus und AI definieren.
3. `fam-yu6.3` RevenueCat-Entitlement-API und Identität erweitern.
4. `fam-yu6.8` Store-Konfiguration für parallele Plus-/AI-Abos prüfen.

### Checkpoint: Fundament

Weitergehen, wenn Produkt- und Offering-IDs aus RevenueCat verifiziert sind,
die unabhängige AI-Produktzuordnung bestätigt ist, Schema- und Client-Vertrag
zusammenpassen und die fokussierten
Entitlement-Tests grün sind.

### Phase 2: Serverautorität und Zugriff

5. `fam-yu6.4` RevenueCat-Webhook für Plus, AI und Haushaltszuordnung.
6. `fam-yu6.5` Entitlement-Provider und bestehende Gates migrieren.

### Checkpoint: Zugriff

Weitergehen, wenn Plus und AI unabhängig getestet sind, AI nur im
zugeordneten Haushalt erscheint, Expiration/stale/duplicate Events korrekt
verarbeitet werden und RLS keine Client-Schreibzugriffe zulässt.

### Phase 3: Kaufoberfläche und Fair Use

7. `fam-yu6.6` Plus-und-AI-Paywall sowie Route umsetzen.
8. `fam-yu6.7` AI-Fair-Use-Limit als serverseitigen Vertrag vorbereiten.

### Checkpoint: Release-Kandidat

Weitergehen, wenn beide Paywalls die RevenueCat-Offerings und lokalisierten
Preise korrekt darstellen, die Route `/settings/plus-and-ai` funktioniert,
die 100-Credit-Baseline als konfigurierbarer Serververtrag dokumentiert ist
und keine AI-Limit-Sperre Plus-Funktionen beeinflusst.

## Verification Plan

Gezielte Client-Prüfungen:

```bash
bun run check
bun run typecheck
bun run test -- purchases
bun run test -- premium
```

Bei Schema-/RLS-Änderungen:

```bash
bun run db:diff -- -f revenuecat-entitlements
bun run test:db
bun run db:advisors
bun run db:diff
bun run db:types
```

Zusätzlich erforderlich:

- RevenueCat Test Store in iOS- und Android-Development-Builds.
- iOS Sandbox/TestFlight und Android-Store-Test.
- Kauf, Restore, Ablauf, unabhängiger Plus-/AI-Kauf und Customer Center.
- App Store Connect: Plus monatlich/jährlich in einer Gruppe, AI
  monatlich/jährlich in einer separaten Gruppe, falls beide gleichzeitig aktiv
  sein sollen.
- Google Play Console: getrennte Plus-/AI-Subscription-Produkte und
  kombinierter Kauf/Add-on-Pfad prüfen.
- Verifikation der Webhook-Zustellhistorie und der Haushaltsprojektionen.
- Kein Test Store API-Key in Preview-/Production-Builds.

## Risks and Mitigations

| Risiko | Impact | Mitigation |
| --- | --- | --- |
| RevenueCat-Katalog driftet von der dokumentierten Matrix ab | Hoch | Zentrale Offering-/Package-Identifier verwenden und Dashboard-Matrix vor Store-Tests prüfen |
| Store erlaubt keine gleichzeitigen Plus-/AI-Abos | Hoch | Store- und Subscription-Gruppen-Konfiguration vor einem kombinierten Angebot prüfen |
| AI-Haushaltswechsel wird über mehrere Haushalte umgangen | Hoch | Subscriberbezogener Assignment-State mit serverseitigem Monatslimit |
| Expiration eines Accounts überschreibt gültigen Haushaltszugriff | Hoch | Zuordnung, Event-Reihenfolge und aktive Quellen atomar prüfen |
| Offline-Client autorisiert veralteten AI-Zugriff | Mittel | Serverautorität; Offline nur zuletzt synchronisierten Zustand anzeigen |
| AI-Limit wird durch Retries doppelt belastet | Mittel | Atomare Credits-Buchung mit Event-/Request-Idempotenz |
| Paywall verwechselt gleichartige Monats-/Jahrespackages | Mittel | Ziel-Entitlement und zentrale Produkt-ID-Zuordnung statt Array-Reihenfolge |
| UI-Änderung driftet vom Designsystem ab | Mittel | Statische Mocks vor Komponentenänderung und Reviewcheckpoint |

## Open Questions

Die Grundarchitektur ist entschieden. Vor dem Release bleiben die folgenden
Produktfragen aus Epic #23 offen:

- Bestätigung der Arbeitsbaseline von 100 AI-Credits sowie der Gewichtung 1/3/2.
- Free-Tier-Werbung, Tracking-/ATT- und Consent-Strategie.
- AI-Testphase, CTA-Hierarchie und Darstellung der Jahresersparnis.
- Upgrade-/Downgrade-Verhalten in iOS und Android.
- Store-Subscription-Gruppen und die gleichzeitige Buchbarkeit von Plus und AI
  müssen vor dem kombinierten Kauf-Test bestätigt werden.
- AI-Caching, Kostenobergrenzen, Abuse-Sperren und benötigte Analytics.

Die Implementierung darf mit der Fair-Use-Baseline planen, muss Änderungen
aber zuerst im Spec und anschließend in den betroffenen Beads-Tasks
nachführen.
