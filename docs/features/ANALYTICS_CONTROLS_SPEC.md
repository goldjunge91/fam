# Spec: Analytics-Steuerung

## Objective

Die App erhält eine zentrale, typisierte Konfiguration für Analytics. Aptabase
und PostHog sollen global und unabhängig voneinander deaktivierbar sein.
Zusätzlich sollen Produkt-Events nach Feature-Domäne sowie Fehlerberichte und
Diagnose-Telemetrie separat gesteuert werden können. PostHog bleibt bis zu einer
expliziten Nutzerentscheidung vollständig opt-out.

Die Build-Defaults für die technischen Schalter bleiben aktiv, damit die
vorhandene Telemetrie-Architektur erhalten bleibt. Die PostHog-Einwilligung ist
davon getrennt und startet mit `pending`. Das Dev-Menü kann technische Schalter
lokal zur Laufzeit überschreiben, ist aber kein Ersatz für die Nutzerentscheidung.

## Capability Map

| Modul | Verantwortung | Abhängigkeiten |
|---|---|---|
| `provider-gating` | Aptabase und PostHog global und separat steuern; PostHog-Consent beachten | — |
| `feature-gating` | Produkt-Events nach Feature-Domäne steuern | `provider-gating` |
| `telemetry-policy` | Produkt-, Fehler- und Diagnosekanäle trennen | `provider-gating`, `feature-gating` |
| `diagnostics` | Konfiguration im Dev-Menü anzeigen und ändern | alle vorherigen Module |
| `verification` | Tests und Dokumentation | alle Module |

Build-Reihenfolge: `provider-gating` → `feature-gating` →
`telemetry-policy` → `diagnostics` → `verification`.

## Tech Stack

- Expo SDK 57 / React Native
- TypeScript
- bestehende Telemetrie-Abstraktion unter `src/lib/telemetry/`
- Aptabase und PostHog als vorhandene Provider
- bestehendes Dev-Menü unter `src/features/settings/dev/`
- `react-native-mmkv` über die vorhandene Device-Storage-Abstraktion

Keine neue Dependency.

## Configuration Model

Die Provider-Zugangsdaten bleiben in den Env-Dateien:

```env
EXPO_PUBLIC_APTABASE_APP_KEY=...
EXPO_PUBLIC_POSTHOG_API_KEY=...
EXPO_PUBLIC_POSTHOG_HOST=...
```

Die Schalter liegen zentral in `src/constants/analytics.ts`:

```ts
export const analyticsConfig = {
  enabled: true,
  providers: { aptabase: false, posthog: true },
  channels: { productEvents: true, errorReports: true, diagnostics: true },
  features: {
    onboarding: true,
    household: true,
    inventory: true,
    shoppingList: true,
    recipes: true,
    mealPlanner: true,
    productSearch: true,
    premium: true,
    sync: true,
  },
} as const;
```

Dev-Menü-Overrides werden lokal gespeichert und haben Vorrang vor diesen
technischen Standardwerten. Sie gelten nur auf dem jeweiligen Gerät und werden
beim Zurücksetzen der Analytics-Einstellungen gelöscht. Sie ändern nicht den
PostHog-Consent.

```ts
export type PostHogConsent = 'pending' | 'granted' | 'denied';
```

Die PostHog-Einwilligung wird getrennt von den technischen Dev-Overrides unter
der lokalen Device-Storage-Abstraktion persistiert. `pending` und `denied`
unterdrücken alle PostHog-Fan-out-Aufrufe. Beim Widerruf wird der SDK-Client
zusätzlich mit `optOut()` deaktiviert und zurückgesetzt.


## Event Policy

- `enabled=false` unterdrückt sämtliche Aptabase- und PostHog-Ausgaben.
- Ein Provider-Schalter unterdrückt nur den jeweiligen Provider.
- Ein Feature-Schalter unterdrückt nur Produkt-Events dieser Domäne.
- `errorReports` steuert Fehlerberichte an Aptabase und PostHog.
- `diagnostics` steuert technische Diagnose-Events, nicht Sentry-Breadcrumbs.
- PostHog-Touch-Autocapture und PostHog-JavaScript-/Native-Error-Autocapture
  bleiben deaktiviert. PostHog erhält nur explizite, zentral bereinigte Events.
- Screen-Telemetrie verwendet ausschließlich eine statische Allowlist. Private
  und dynamische Routen werden nicht an PostHog weitergegeben.
- Freie Fehlermeldungen, E-Mail-Adressen, URLs, UUIDs, Haushalts- und
  Identitätsfelder werden aus PostHog-Analyseereignissen entfernt. Die
  Konto-E-Mail wird nur nach PostHog-Einwilligung als Eigenschaft zur
  Feature-Flag-Auswertung übermittelt und nicht als Analyseereignis gesendet.
  Sentry bleibt der vollständige Fehlerdiagnose-Zielort.
- Sentry bleibt unabhängig von dieser Konfiguration.
- Unbekannte Produkt-Events werden nicht stillschweigend einer neuen Domäne
  zugeordnet; sie bleiben bis zur expliziten Zuordnung aktiv.

Die bestehenden typisierten Aufrufe von `trackAnalyticsEvent(...)` bleiben
unverändert. Die Prüfung erfolgt zentral in der Telemetrie-Schicht.

## Commands

Gezielte Tests während der Implementierung:

```bash
bun run test -- src/lib/telemetry
bun run test -- src/features/settings/dev
bun run typecheck
bun run check
```

## Project Structure

```text
src/constants/analytics.ts                 # Standardkonfiguration
src/lib/telemetry/                          # zentrale Policy und Gating-Logik
src/lib/analytics/                          # Provider-Adapter
src/features/settings/dev/                 # Anzeige und Overrides im Dev-Menü
src/lib/storage/local-device-storage.ts          # lokale Persistenz der Overrides
docs/features/ANALYTICS_CONTROLS_SPEC.md   # diese Spezifikation
```

## Code Style

Die Konfiguration bleibt als konkretes Objekt typisiert und wird nicht über
zahlreiche lose String-Konstanten verteilt:

```ts
export function isAnalyticsFeatureEnabled(feature: AnalyticsFeature): boolean {
  return getAnalyticsSettings().features[feature];
}
```

Keine `any`-Typen, keine Änderungen an jedem einzelnen Event-Aufrufer und keine
provider-spezifische Logik in Feature-Komponenten.

## Testing Strategy

- Unit-Tests für globale Aktivierung und Provider-Gating
- Unit-Tests für die Zuordnung von Event-Namen zu Feature-Domänen
- Unit-Tests für Produkt-, Fehler- und Diagnosekanäle
- Tests für Priorität und Persistenz der Dev-Menü-Overrides
- Tests, dass Aptabase und PostHog unabhängig voneinander angesprochen werden
- bestehende Analytics- und Telemetrie-Tests bleiben grün

Keine vollständige Testsuite routinemäßig ausführen; gezielte Tests verwenden.

## Boundaries

- **Immer:** zentrale Gating-Logik verwenden; technische Defaults bleiben
  aktiv, PostHog startet aber mit `pending`; Provider-Keys nicht in
  `src/constants/analytics.ts` ablegen; Tests für jede Schalterebene und die
  Payload-Bereinigung ergänzen.
- **Vorher fragen:** neue Analytics-Provider, Änderungen an Sentry-Verhalten,
  zusätzliche Feature-Domänen oder ein anderes Consent-/Datenregion-Modell.
- **Nie:** Secrets in `src/constants/analytics.ts` ablegen, Event-Aufrufe in
  Features mit Aptabase/PostHog-spezifischer Logik anreichern, Events durch
  stilles Entfernen aus der Telemetrie-Schema-Typisierung umgehen.

## Success Criteria

- Aptabase kann global deaktiviert werden, ohne PostHog zu deaktivieren.
- PostHog kann global deaktiviert werden, ohne Aptabase zu deaktivieren.
- Alle Produkt-Feature-Schalter wirken unabhängig voneinander.
- Fehler- und Diagnosekanäle können unabhängig von Produkt-Events geschaltet
  werden.
- Die technischen Analytics-Werte bleiben standardmäßig aktiv; PostHog sammelt
  vor einer expliziten Einwilligung nichts.
- Eine Nutzerentscheidung für PostHog kann in der Datenschutzseite erteilt und
  widerrufen werden und überlebt einen App-Neustart.
- Touch-Autocapture, automatische Fehlererfassung und dynamische/private
  Screenpfade erreichen PostHog nicht.
- PostHog-Analyseereignisse enthalten keine freien Fehlermeldungen,
  E-Mail-Adressen, URLs, UUIDs, Haushalts- oder Identitätsfelder. Die
  Konto-E-Mail wird ausschließlich bei erteilter PostHog-Einwilligung für
  Feature-Flag-Auswertungen übermittelt.
- Das Dev-Menü kann die technischen Schalter ändern und den Status sichtbar
  anzeigen.
- Die bestehenden Analytics-Aufrufer müssen nicht einzeln angepasst werden.
- Typecheck, Biome und die betroffenen gezielten Jest-Tests laufen erfolgreich.

## Open Questions

- Die PostHog-/Supabase-Edge-Function muss mit `POSTHOG_PERSONAL_API_KEY`,
  `POSTHOG_PROJECT_ID` und `POSTHOG_HOST` konfiguriert und mit einem echten
  Account-Löschlauf abgenommen werden.
- Im PostHog-Dashboard müssen EU Cloud, IP-/GeoIP-Einstellungen, Retention,
  DPA und Zugriffrollen separat bestätigt werden.
- Die RevenueCat-PostHog-Integration bleibt deaktiviert oder muss so gefiltert
  werden, dass das notwendige `household_id`-Subscriber-Attribut nicht an
  PostHog gelangt.
- Ein anderes Consent-, Datenregion- oder Identitätsmodell braucht eine neue
  fachliche Entscheidung.
