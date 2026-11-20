# Selektive Bewertung des AI-Cooking-Branches

**Datum:** 2026-11-06, aktualisiert auf den aktuellen Checkout
**Aktueller Basisstand:** `3c533702` auf `main`
**Geprüfter Quellstand:** `origin/feature/ai-cooking-port`
**Beads:** `fam-y918`

## Entscheidung

Der alte Branch wird nicht vollständig gemergt und seine Commitreihe wird nicht als Ganzes übernommen. Er liegt weit hinter dem aktuellen `main` und enthält neben dem eigentlichen Kochvorschlagspfad eine veraltete History-/Mutation-Architektur, alte Datenbankänderungen und breite Refactorings. Der aktuelle Checkout besitzt inzwischen eigene Grenzen für Gateway-Authentifizierung, Haushaltsmitgliedschaft, RevenueCat-Entitlements, Credit-Buchung und Erstattung, lokalen Inventory-Lifecycle, Food-Rule-Projektion und Unistyles.

Übernommen werden deshalb nur die verhaltensbezogenen Bausteine für einen read-only Vorschlagspfad:

- versionierter `schema_version: 1`-Vertrag mit ein bis drei Mahlzeiten;
- serverseitige Prüfung von Rezept-, Inventar- und Mengenzuordnungen;
- deterministische Katalogauswahl vor einem einzelnen begrenzten Provider-Aufruf;
- fail-closed Allergenprüfung über die aktuelle Projektion;
- ein geschlossenes OpenRouter-JSON-Schema mit kontextgebundenen IDs;
- ein aktueller Supabase-Function-Adapter und ein React-Query-Mutationspfad für die mobile Anzeige.

## Aktuelle Integration

Der Gateway bleibt der Besitzer der Sicherheitsgrenzen. `authenticate`, `assertHouseholdMember`, `authorizeAiEntitlement`, `bookAiCredit`, `refundAiCredit`, Usage-Recording sowie die bestehenden Assistant-, Import- und Groq-Pfade bleiben im aktuellen Handler. Der Kochvorschlag verwendet weiterhin die bestehende Aktion `recipe`; der Importpfad bleibt getrennt bei `recipe_import`.

Der Server baut den Vorschlagskontext aus dem aktuellen `GatewayCookingContext`, der serverseitigen Food-Rule-Projektion und dem aktuellen Bestand. Private Regeltexte werden nicht in Provider-Form- oder Fehlerlogs geschrieben. Providerantworten werden nur anhand von Schemafehlern, Pfaden und Codes protokolliert, niemals als Rohantwort.

Die Katalogauswahl erhält die heutigen Katalogrezepte und ihre vorhandenen Anweisungen. Erst wenn keine deterministisch nutzbare Mahlzeit entsteht, wird ein Provider mit dem gebundenen Structured-Output-Format aufgerufen. Der Provider erhält keine Haushalts- oder Nutzerkennung.

## Bewusst ausgeschlossene Branch-Dateien

Nicht übernommen werden:

- alte Chef-History-Tabellen, Conversation-/Turn-Persistenz und zugehörige SQLite-Modelle;
- alle Branch-Migrationen und deklarativen SQL-Dateien;
- die Branch-Version von `src/lib/database.types.ts` sowie jede manuelle Änderung an generierten Typen;
- alte Consumption-/Outbox-Adapter, die den aktuellen Inventory-Lifecycle umgehen;
- AI-bezogene Android-Duplikate;
- alte Provider-, Env- und Entitlement-Implementierungen;
- parallele Agent-/Tool-Architekturen ohne aktuellen Produkt-Consumer;
- Open-Food-Facts-, Build-, Crawler-, Eval- und allgemeine Refactor-Dateien;
- Provider- oder Haushalts-Rohlogging.

## Datenbank- und Artefaktgrenze

Dieser Port ist read-only. Er benötigt keine neue Tabelle, keine RLS-Policy, keine Migration, keinen lokalen SQLite-Spiegel und keine Änderung an `src/lib/database.types.ts`. Die bestehende `recipe_import`-Credit-Regel bleibt unberührt und wird separat gegen den lokalen Stack geprüft.

## Verifikation

Die fokussierten Contract-, Context-, Catalog- und OpenRouter-Tests sowie die aktuelle Gateway-Handler-Suite werden mit `bun run test:functions` ausgeführt. Die mobile Seite nutzt ausschließlich das vorhandene Zod-Ergebnisformat, den aktuellen Supabase-Client, React Query, Unistyles und die bestehenden UI-/FlashList-Konventionen. Der mobile Flow speichert weder Rezepte noch Bestand, Einkaufseinträge, Gespräche oder Historie.
