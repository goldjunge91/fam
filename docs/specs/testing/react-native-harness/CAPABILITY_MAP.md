# Capability Map: Native React Native Harness

Status: Draft for review

## Scope

Diese Initiative etabliert React Native Harness als ergänzende Real-Runtime-
Testschicht für iOS und Android. Der Web-Runner gehört ausdrücklich nicht zum
Umfang.

| Module id | Verantwortung | Abhängigkeiten |
|---|---|---|
| `native-runtime` | Harness-Konfiguration, iOS-/Android-Runner, lokale Projekt-CLI, Dev-Build-Voraussetzungen und Runner-Preflight | — |
| `test-authoring` | Dateikonventionen, Setup-Phasen, Mocks, UI-Test-API, gemeinsame Test-Helfer und Test-Isolation | `native-runtime` |
| `critical-flows` | Priorisierte Real-Runtime-Tests für die wichtigsten Nutzer- und Datenflüsse | `test-authoring` |
| `developer-workflow` | Wiederholbare Scripts, lokale Verifikation, Troubleshooting und Projektdokumentation | `native-runtime`, `test-authoring` |

## Build order

`native-runtime` → `test-authoring` → `critical-flows` → `developer-workflow`

`developer-workflow` kann während der Implementierung der anderen Module
inkrementell dokumentiert werden, wird aber erst nach einer verifizierten
Runtime als abgeschlossen betrachtet.

## Explicit exclusions

- Kein Web-Runner und keine Web-spezifische Testabdeckung.
- Keine pauschale Migration oder Löschung bestehender Jest-, RNTL- oder
  Maestro-Tests.
- Keine Datenbankschemaänderung.
- Keine CI-Konfiguration ohne separate Freigabe.
