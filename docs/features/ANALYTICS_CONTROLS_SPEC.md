# Spec: Analytics-Steuerung

## Objective

Die App erhält eine zentrale, typisierte Konfiguration für Analytics. Aptabase
und PostHog sollen global und unabhängig voneinander deaktivierbar sein.
Zusätzlich sollen Produkt-Events nach Feature-Domäne sowie Fehlerberichte und
Diagnose-Telemetrie separat gesteuert werden können.

Die Standardwerte sind aktiv, damit bestehende Builds ihr Verhalten behalten.
Das Dev-Menü kann jeden Schalter lokal zur Laufzeit überschreiben.

## Capability Map

| Modul | Verantwortung | Abhängigkeiten |
|---|---|---|
| `provider-gating` | Aptabase und PostHog global und separat steuern | — |
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
  providers: { aptabase: true, posthog: true },
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
Standardwerten. Sie gelten nur auf dem jeweiligen Gerät und werden beim
Zurücksetzen der Analytics-Einstellungen gelöscht.

## Event Policy

- `enabled=false` unterdrückt sämtliche Aptabase- und PostHog-Ausgaben.
- Ein Provider-Schalter unterdrückt nur den jeweiligen Provider.
- Ein Feature-Schalter unterdrückt nur Produkt-Events dieser Domäne.
- `errorReports` steuert Fehlerberichte an Aptabase und PostHog.
- `diagnostics` steuert technische Diagnose-Events, nicht Sentry-Breadcrumbs.
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
src/lib/storage/device-storage.ts          # lokale Persistenz der Overrides
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

- **Immer:** zentrale Gating-Logik verwenden, Defaults auf `true` halten,
  Provider-Keys nicht in die neue Variablen-Datei verschieben, Tests für jede
  Schalterebene ergänzen.
- **Vorher fragen:** neue Analytics-Provider, Nutzer-Opt-out außerhalb des
  Dev-Menüs, Änderungen an Sentry-Verhalten oder zusätzliche Feature-Domänen.
- **Nie:** Secrets in `src/constants/analytics.ts` ablegen, Event-Aufrufe in
  Features mit Aptabase/PostHog-spezifischer Logik anreichern, Events durch
  stilles Entfernen aus der Telemetrie-Schema-Typisierung umgehen.

## Success Criteria

- Aptabase kann global deaktiviert werden, ohne PostHog zu deaktivieren.
- PostHog kann global deaktiviert werden, ohne Aptabase zu deaktivieren.
- Alle Produkt-Feature-Schalter wirken unabhängig voneinander.
- Fehler- und Diagnosekanäle können unabhängig von Produkt-Events geschaltet
  werden.
- Alle Werte sind standardmäßig aktiv.
- Das Dev-Menü kann jeden Wert ändern und den Status sichtbar anzeigen.
- Ein gespeicherter Override überlebt einen App-Neustart.
- Die bestehenden Analytics-Aufrufer müssen nicht einzeln angepasst werden.
- Typecheck, Biome und die betroffenen gezielten Jest-Tests laufen erfolgreich.

## Open Questions

Keine fachlichen Fragen offen. Die Implementierungsdetails für die konkrete
Event-Domänen-Zuordnung werden im technischen Plan festgelegt.
