# Dokumentation

Diese Übersicht trennt die verbindlichen Arbeitsdokumente von historischen
Untersuchungen. Der Code, die deklarativen Datenbankschemas und Tests bleiben
bei Widersprüchen die maßgebliche Quelle.

## Produkt und aktueller Stand

- [Produktvision](features/VISION.md) — Produktgrenzen, Datenschutzprinzipien und langfristige Module.
- [Roadmap](features/ROADMAP.md) — abgeschlossener MVP und geplante Phase-2–4-Epics.
- [RevenueCat Monetarisierung](specs/revenuecat-plus-ai/SPEC.md) — Spec für die Entitlements Plus und AI.
- [Supermarkt-Laufstrecke](features/Supermarkt%20Laufstrecke%20-%20Einkaufslisten%20Sortierung.md) — Kategorie-Reihenfolge der Einkaufsliste.

## Entwicklung und Betrieb

- [Developer Guide](architecture/DEVELOPER_GUIDE.md) — lokales Setup, Architektur und Standardabläufe.
- [Funktionsdiagramme](features/FUNKTIONSDIAGRAMME.md) — Systemarchitektur, Datenmodelle und Feature-Workflows (Mermaid).
- [Design-System](design-system/DESIGN_SYSTEM.md) — verbindliche Tokens und Komponentenregeln.
- [RevenueCat-Webhook](revenuecat/revenuecat-webhook.md) — Deployment und Prüfung des Premium-Webhooks.

## Datenschutz und Store-Release

- [Datenschutzerklärung](architecture/DATENSCHUTZ.md)
- [Privacy Labels](architecture/PRIVACY_LABELS.md)

## Arbeitsunterlagen und Audits

Die folgenden Dateien sind Entscheidungs- oder Untersuchungsprotokolle. Sie
erläutern den damaligen Kontext, sind aber keine aktuelle Implementierungsanweisung.

- `plans/` — Diagnosen, erledigte Fix-Pläne und Produkt-Brainstorming.
- `reviews/` — externe Code-Reviews.
- `design-system/` — abgeschlossene visuelle Audits.

## Bewusst nicht versioniert

Zeilenweise Erklärungen von Quellcode und Kopien fremder Herstellerdokumentation
werden nicht gepflegt. Sie veralten sofort und duplizieren die eigentlichen
Quellen: Code, Tests sowie die offizielle Dokumentation der jeweiligen Plattform.
