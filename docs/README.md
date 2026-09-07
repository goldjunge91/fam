# Dokumentation

Diese Seite ist die Landkarte für die Projekt-Dokumentation. Sie trennt
verbindliche Quellen, aktuelle Produkt- und Architekturunterlagen sowie
historisches Arbeitsmaterial. Bei Widersprüchen sind deklarative
Datenbankschemas, Quellcode und gezielte Tests die technische Referenz.

## Einstieg

- [Projektkontext](../CONTEXT.md) – Domänenbegriffe, Eigentümerschaft und
  Architekturgrenzen.
- [AGENTS.md](../AGENTS.md) – verbindliche Arbeitsregeln für Agents und Beiträge.
- [ADRs](adr/README.md) – dauerhafte Architekturentscheidungen und ihre
  Begründungen.
- [Developer Guide](architecture/DEVELOPER_GUIDE.md) – Setup, Arbeitsabläufe,
  Tests und technische Architektur.

## Produkt und aktueller Stand

- [Produktvision](features/VISION.md) – Produktgrenzen, Datenschutzprinzipien
  und langfristige Module.
- [Roadmap](features/ROADMAP.md) – abgeschlossener MVP und geplante Epics.
- [RevenueCat Monetarisierung](specs/revenuecat-plus-ai/SPEC.md) – Spec für die
  Entitlements Plus und AI.
- [Supermarkt-Laufstrecke](features/Supermarkt%20Laufstrecke%20-%20Einkaufslisten%20Sortierung.md)
  – Kategorie-Reihenfolge der Einkaufsliste.
- [Funktionsdiagramme](features/FUNKTIONSDIAGRAMME.md) – Datenmodell und
  Feature-Workflows als Mermaid-Diagramme.

## Architektur und Betrieb

- [Developer Guide](architecture/DEVELOPER_GUIDE.md) – lokaler Entwicklungs-
  und Build-Workflow, Umgebungsvariablen und Tests.
- [EAS-Befehle](architecture/EAS_BUILD_COMMANDS.md) – Development-, TestFlight-
  und Production-Builds.
- [Design-System-Verträge](design-system/contracts/README.md) – normative
  Tokens, Komponentenregeln und Zustände.
- [React Native Harness](../harness/README.md) – Tests in echter iOS-, Android-
  und Web-Runtime.
- [RevenueCat-Webhook](revenuecat/revenuecat-webhook.md) – Deployment und
  Prüfung des Premium-Webhooks.
- [Native-Fingerprint-Debugging](features/native-fingerpint-faster-build/native-fingerprint-drift-debugging.md)
  – Diagnose von absichtlichen und unbeabsichtigten Build-Abweichungen.

## Datenschutz und Store-Release

- [Datenschutzerklärung](architecture/DATENSCHUTZ.md) – tatsächlich verarbeitete
  Daten, Drittdienste und Nutzerrechte.
- [Privacy Labels](architecture/PRIVACY_LABELS.md) – Abgleich für App Store
  Connect und Google Play Data Safety.
- [Apple-App-Store-Unterlagen](app-store/) – Metadaten, Screenshots und
  Release-Checklisten.

## Spezifikationen und Fachunterlagen

- [`specs/`](specs/) – aktuelle Capability Maps und Feature-Spezifikationen.
  Jede Spec beschreibt ihren Status und ihre Gültigkeit selbst.
- [`features/`](features/) – Produktvisionen, Roadmaps und fachliche
  Feature-Dokumente.
- [`revenuecat/`](revenuecat/) – technische RevenueCat-Referenzen und
  Integrationsnotizen.
- [`testing/`](testing/) – testbezogene Projektunterlagen.

Die Dateien unter `docs/specs/nativewind-styling/` dokumentieren die abgeschlossene
Entstehungsgeschichte der NativeWind- und Designsystem-Entscheidungen. Die
laufenden UI-Regeln stehen ausschließlich in
[`design-system/contracts/`](design-system/contracts/README.md).

## Arbeitsmaterial und Historie

- [`research/`](research/) – Untersuchungen und Entscheidungsgrundlagen.
- [`ideas/`](ideas/) – noch nicht verbindliche Produktideen.
- [`mockups/`](mockups/) und [`screenshots/`](screenshots/) – visuelle
  Arbeitsunterlagen und Referenzbilder.
- [`archive/`](archive/) – abgeschlossene oder überholte Unterlagen.

Historische Dokumente erklären ihren damaligen Kontext, sind aber keine
Implementierungsanweisung. Neue dauerhafte Architekturentscheidungen gehören
als ADR nach [`docs/adr/`](adr/README.md), nicht in eine lose Planungsdatei.

## Dokumentationsregeln

- Dokumentiere vor allem das Warum, Randbedingungen und verworfene Alternativen.
- Verlinke auf die technische Quelle statt Code oder Herstellerdokumentation zu
  kopieren.
- Aktualisiere Status, Pfade und Querverweise gemeinsam mit der Entscheidung,
  die sie beschreiben.
- Lösche alte ADRs nicht. Eine geänderte Entscheidung erhält ein neues ADR, das
  die vorherige Entscheidung ablöst.
