# Implementation Plan: merran-ai-assistant

## Overview

Dieser Plan enthält ausschließlich konkrete TypeScript-, React-Native-, Deno-,
declarative-Schema- und Testaufgaben für die dokumentierten Lücken aus
`requirements.md` und `design.md`. Die bestehende fam-AI-Basis bleibt der
Ausgangspunkt: `fam-assistant`, Assistant-Screen, accountbezogene Threads,
Rezept-/Meal-Plan-Kontext, Attachments, read-only Tools, vorhandene Proposal-
Apply-Pfade, `fam-recipe-import`, `fam-cook-from-inventory`,
`fam-inventory-capture`, OpenRouter, Groq, RevenueCat, Credits, Refunds und
Usage Logging werden additiv erweitert, nicht ersetzt.

Das Capability-Inventar enthält genau diese dreizehn IDs: `assistant`, `import`,
`notes`, `swaps`, `nutrition`, `shopping`, `receipts`, `discover`,
`reminders`, `image-generation`, `speech-to-text`, `text-to-speech` und
`media-processing`. Bereits ausreichende Flächen erhalten ausschließlich
Regressionen, Kompatibilitätsprüfungen oder zwingende Metadaten. Es gibt keinen
zweiten Gateway-, Chat-, Storage-, Billing- oder Providerpfad, keine neue
allgemeine Assistant-UI, keine neue AI-Outbox und keine stillen Migrationen.

`recipe_suggestion.v1` und `fam-y918` werden nicht implementiert oder verändert.
Sie werden nur durch fokussierte Regression und Isolation geschützt. Eine
Assistant-Freigabe verändert weder Household-Mitgliedschaft noch Rollen, RLS,
Sichtbarkeit oder die vollständige bestehende Household-Food-Rule-Prüfung.

Tests mit `[ ]` sind Pflichtnachweise. Tests mit `[ ]*` sind optionale,
zusätzliche Property- oder Vertiefungstests. Alle Testaufträge sind gezielt
über die betroffene Datei auszuführen, nicht als vollständige Testsuite.

## Tasks

- [ ] 1. Additive Capability-, Vertrags- und Gateway-Grundlage erweitern
  - Diese Phase erweitert nur vorhandene Typ-, Request- und Gatewaygrenzen. Sie baut keinen zweiten Transport, keinen allgemeinen Chat und keine neue Persistenzbasis.
  - **Akzeptanz:** Die späteren Capability-Aufgaben können über den vorhandenen `ai-gateway` mit stabilen, versionierten und capability-spezifischen Verträgen verdrahtet werden, ohne einen bestehenden Legacy-Vertrag umzudeuten.
  - **Requirements:** 1.1-1.7, 2.1-2.6, 5.9, 9.1, 9.6-9.10.
  - **Design-Anker:** Components and Interfaces 4-6, Data Models 10, Provider 17-19, Correctness Properties 1-2.
  - **Abhängigkeiten:** keine.
  - **Unverändert:** `fam-assistant`, `fam-recipe-import`, `fam-cook-from-inventory`, `fam-inventory-capture`, der bestehende Assistant-Response-Vertrag, `recipe_suggestion.v1` und `fam-y918`.

  - [ ] 1.1 Capability-Allowlist und additive Vertragsmetadaten implementieren
    - **Dateien/Module:** `src/features/ai-assistant/capability-registry.ts`, `src/features/ai-assistant/types.ts`, `src/features/ai-assistant/data/assistant-api.ts`, `supabase/functions/ai-gateway/handler.ts`.
    - **Aktion:** Eine zentrale, typisierte Allowlist für genau die dreizehn IDs mit Status, Evidence-Referenz, Contract-Version, Owner, Data Scope, `onlineOnly`, Mutationsstatus, Provider-Fähigkeit und Testfläche ergänzen. `capabilityId`, `contractVersion` und `purposeCode` als additive Request-Metadaten führen. Unbekannte oder unvollständige Einträge vor Context-Read, Credit Booking und Providerzugriff als `capability_unavailable` ablehnen.
    - **Akzeptanz:** Jede der dreizehn IDs ist genau einmal vorhanden; ein Status `bestehend` erzeugt nur Regression/Kompatibilität/Metadaten, ein Status `teilweise vorhanden` nur die dokumentierte Lücke und ein Status `fehlend` nur mit eigenem Vertrag, Owner, Scope, Online-, Mutations- und Testvertrag. Legacy-Requests bleiben ohne die neuen Metadaten gültig.
    - **Requirements:** 1.1-1.7, 2.1-2.4, 5.9, 7.12.
    - **Design-Anker:** Capability Inventory und additive Lücken, Components 5-6, Minimal additive Vertragsformen 10.
    - **Abhängigkeiten:** keine.
    - **Unverändert:** bestehende Request-/Response-Shapes von `fam-assistant`, alle Legacy Skill-Werte, `recipe_suggestion.v1` und `fam-y918`.

  - [ ] 1.2 Fokussierte Registry- und Unavailable-Tests als Pflichtnachweis schreiben
    - **Dateien/Module:** `src/features/ai-assistant/capability-registry.test.ts`, `src/features/ai-assistant/types.test.ts`, `supabase/functions/ai-gateway/handler_test.ts`.
    - **Aktion:** Beispiele für die vollständige 13er-Allowlist, Statusgrenzen, fehlende Output-/Provider-Verträge und unbekannte IDs testen. Zusätzlich einen Legacy-Request ohne Metadaten gegen den vorhandenen Handler prüfen.
    - **Akzeptanz:** Unbekannte, doppelte oder unvollständige Capability-Definitionen werden vor Credit und Provider abgewiesen; ein gültiger Legacy-Request bleibt erfolgreich parsebar; die Tests enthalten keine Provider-Secrets oder Inhalte.
    - **Requirements:** 1.1-1.7, 2.3-2.6, 7.12, 9.9.
    - **Design-Anker:** Testing Strategy 26-28, Error Handling 22-23.
    - **Abhängigkeiten:** 1.1.
    - **Prüfung:** `bun run test src/features/ai-assistant/capability-registry.test.ts src/features/ai-assistant/types.test.ts supabase/functions/ai-gateway/handler_test.ts`.
    - **Unverändert:** bestehende Assertions und Shapes für `fam-assistant`, `fam-recipe-import`, `fam-cook-from-inventory`, `fam-inventory-capture`, `recipe_suggestion.v1` und `fam-y918`.

  - [ ]* 1.3 Property-Test für **Property 1: Capability Inventory und Statusgrenzen bleiben geschlossen** schreiben
    - **Dateien/Module:** `src/features/ai-assistant/capability-registry.property.test.ts`.
    - **Aktion:** Mit mindestens 100 Fällen Registry-Einträge, Statuskombinationen, fehlende Pflichtfelder, unbekannte IDs und Legacy-Metadaten variieren. Der Test muss die exakte Allowlist und die Ablehnung unvollständiger Capabilities prüfen.
    - **Akzeptanz:** Kein unvollständiger oder unbekannter Eintrag wird als sichtbare oder aufrufbare Capability akzeptiert; der Test läuft ohne Supabase und Provider.
    - **Requirements:** 1.1-1.6.
    - **Design-Anker:** Correctness Property 1 und Testing Strategy 27.
    - **Abhängigkeiten:** 1.1.
    - **Prüfung:** `bun run test src/features/ai-assistant/capability-registry.property.test.ts`.
    - **Unverändert:** Registry-Verträge für bestehende Legacy Skills, `recipe_suggestion.v1` und `fam-y918`.

  - [ ]* 1.4 Property-Test für **Property 2: Neue externe Aufrufe benutzen die bestehende Transportbasis** schreiben
    - **Dateien/Module:** `supabase/functions/ai-gateway/transport-boundary.property.test.ts`.
    - **Aktion:** Für mindestens 100 neue Capability-Requests per Spy nachweisen, dass genau der vorhandene `ai-gateway`-Dispatch und die vorhandenen Provider-Adapter verwendet werden und kein zweiter Gateway-, Chat- oder Assistant-Transport entsteht.
    - **Akzeptanz:** Jeder zugelassene Request bleibt am vorhandenen Gatewaypfad; ein Versuch eines unbekannten Transports wird vor Providerzugriff abgelehnt.
    - **Requirements:** 2.1, 2.4, 2.5, 2.6, 9.1, 9.10.
    - **Design-Anker:** Architecture 2.1, Serverkomponenten 6, Correctness Property 2.
    - **Abhängigkeiten:** 1.1.
    - **Prüfung:** `bun run test:functions -- transport-boundary.property.test.ts`.
    - **Unverändert:** `supabase/functions/ai-gateway/handler.ts` als einziger serverseitiger Einstieg und die vorhandenen OpenRouter-/Groq-Adapter.

- [ ] 2. Einmaligen Consent Frame, Privacy-Verknüpfung und Scope-Safety ergänzen
  - Diese Phase implementiert nur den einmaligen accountbezogenen Freigaberahmen und die dokumentierten Datenbesitzgrenzen. Sie führt keine per-call-Bestätigung und keine allgemeine Freitext-Klassifikationsmaschine ein.
  - **Akzeptanz:** Nur `intolerances`, `dislikedFoods` oder eine leere Auswahl sind wählbar; der Gateway kann den aktiven Rahmen ohne Einzelbestätigung wiederverwenden und blockiert ihn bei Widerruf oder Änderung von Scope, Zweck oder Anbieter.
  - **Requirements:** 3.1-3.10, 4.1-4.9, 10.1-10.9.
  - **Design-Anker:** Data Models 7-9, Data Flow 11-12, Consent 20-21, Error Handling 22, Correctness Properties 3-4 und 11.
  - **Abhängigkeiten:** 1.1, 1.2.
  - **Unverändert:** Household-Mitgliedschaft, Rollen, bestehende RLS für Household-Daten, Household Food-Rule Snapshot mit vollständiger Mitgliederabdeckung, accountbezogener Storage und bestehende Tracking-Domänen.

  - [ ] 2.1 Account-owned Consent Record im vorhandenen AI-Schema ergänzen
    - **Dateien/Module:** `supabase/schemas/28_ai_usage.sql`, `supabase/schemas/29_account_deletion.sql`, `src/lib/database.types.ts` als Generatorausgabe, `supabase/tests/ai_assistant_consents.test.sql`.
    - **Aktion:** Einen einzigen accountbezogenen Consent Record mit Account-ID, Kategorien, Zweckversion, Provider-Rahmen, Vertragsversion, Zeitstempel und Aktivstatus ergänzen. Die Datenbankänderung deklarativ in `28_ai_usage.sql` anlegen, über `bun run db:diff` erzeugen und nach erfolgreicher lokaler Prüfung mit `bun run db:types` typisieren. Keine Disclosure-, Media-Job-, AI-Outbox- oder allgemeine Storage-Tabelle hinzufügen.
    - **Akzeptanz:** Der Record enthält weder aktuelle Präferenzwerte noch Freitext, Tracking- oder Child-Profile-Daten; nur der Account-Owner darf ihn lesen, aktualisieren, widerrufen oder löschen; Account-Löschung entfernt nur account-owned Consent-Daten und keine Household-Rezepte, Meal-Pläne, Einkaufslisten, Belege oder Bestände.
    - **Requirements:** 3.5-3.6, 3.9-3.10, 4.2-4.3, 8.8, 10.1-10.2, 10.7-10.9.
    - **Design-Anker:** Data Models 7, Consent 20-21, Online-/Storage-Grenzen 25.
    - **Abhängigkeiten:** 1.1.
    - **Prüfung:** `bun run db:diff`, `bun run test:db supabase/tests/ai_assistant_consents.test.sql`, danach `bun run db:types`; keine manuelle Migration und kein `apply_migration`.
    - **Unverändert:** bestehende Household-RLS, Tracking-Schemas, `ai_usage_events`-Legacy-Felder und der vorhandene Account-Delete-Owner für fremde Household-Daten.

  - [ ] 2.2 Consent-Repository und Gateway-Lifecycle für Save, Revoke und Re-enable verdrahten
    - **Dateien/Module:** `src/features/ai-assistant/consent/types.ts`, `src/features/ai-assistant/data/consent-api.ts`, `supabase/functions/ai-gateway/consent-loader.ts`, `supabase/functions/ai-gateway/error-codes.ts`.
    - **Aktion:** Save mit leerer Auswahl oder den zwei erlaubten Kategorien, sofortigen Widerruf und Re-enable als neue explizite Einrichtung implementieren. Den Consent Frame unabhängig von einzelnen Requests laden; unveränderte aktive Frames dürfen ohne per-call-Bestätigung passieren. Geänderte Datenumfänge, Zwecke oder Provider müssen vor Booking und Providerzugriff `consent_required` liefern.
    - **Akzeptanz:** Consent Records enthalten nur Rahmenmetadaten; Widerruf blockiert den nächsten External Model Call; Re-enable stellt den alten aktiven Zustand nicht automatisch wieder her; Scope-Fingerprint und aktiver Account werden bei Account- oder Household-Wechsel verworfen.
    - **Requirements:** 3.1, 3.5-3.10, 4.2, 4.6, 8.8, 10.1-10.2.
    - **Design-Anker:** Data Flow 11, Consent-Zustände 21, Error Handling 22.
    - **Abhängigkeiten:** 2.1.
    - **Unverändert:** bestehender `assistant-api`-Transport, RevenueCat-Entitlement, Credit Booking und Household-Berechtigungen.

  - [ ] 2.3 Consent-Einrichtung, Einstellungen und Datenschutzbestimmungen verknüpfen
    - **Dateien/Module:** additive Komponente unter `src/features/ai-assistant/consent/consent-settings.tsx`, `src/features/ai-assistant/screens/assistant-screen.tsx`, `src/features/settings/settings-screen.tsx`, `src/features/settings/privacy-screen.tsx`, `src/i18n/features/settings.de.json`, `src/i18n/features/settings.en.json`, `docs/architecture/DATENSCHUTZ.md` sowie die zugehörigen fokussierten Tests.
    - **Aktion:** Im vorhandenen Assistant-/Settings-Einstieg eine einmalige Einrichtung mit Kurzfassung zu Daten, Zweck und Provider-Rahmen anbieten. Nur leere Auswahl, `intolerances` und `dislikedFoods` rendern. Den vollständigen Text zu erlaubten Daten, Zweck, Anbietern, Aufbewahrung und Widerruf in die bestehende Datenschutzbestimmung einbinden und aus Einrichtung sowie Einstellungen erreichbar machen. Status, Rahmen und Widerruf nach der Einrichtung erreichbar halten.
    - **Akzeptanz:** Es gibt keinen Bestätigungsdialog vor jedem Modellaufruf; aktuelle Präferenzwerte erscheinen nicht im Consent Record; die UI zeigt keine Tracking-, Kind-, Gewichts-, Kalorien-, Medikamenten-, Symptom-, Vital-, Fasten-, Workout- oder Zielkategorie; bestehende Settings- und Privacy-Navigation bleibt erhalten.
    - **Requirements:** 3.1-3.4, 3.7-3.10, 10.1-10.2.
    - **Design-Anker:** Mobile Components 5, Data Flow 11, Consent 20-21, Nicht-property-basierte Schutztests.
    - **Abhängigkeiten:** 2.2.
    - **Unverändert:** vorhandene Privacy-Screen-Abschnitte, Analytics-/Werbe-Privacy-Einstellungen, Assistant-Screen, lokale Threads und die bestehende Settings-Navigation.

  - [ ] 2.4 Positiven Scope- und bekannten Tracking-Safety-Gate im Gateway ergänzen
    - **Dateien/Module:** `supabase/functions/ai-gateway/scope-builder.ts`, `supabase/functions/ai-gateway/assistant-personal-preferences.ts`, `supabase/functions/ai-gateway/tracking-safety.ts`, `supabase/functions/ai-gateway/context-limits.ts`, `supabase/functions/ai-gateway/household-food-rule-snapshot.ts`.
    - **Aktion:** Household-, Page-, Attachment- und eigene Personal-Preference-Quellen capability-spezifisch projizieren. Nur aktuelle Werte des anfragenden Accounts aus einem aktiven Consent verwenden. Bekannte Tracking-Tabellen/-Felder, Child-Profile-Quellen, explizite Tracking-Origin-Marker und tracking-spezifische Context-Flags vor Credit und Provider fail-closed ablehnen. Keine semantische Freitext-Taint-Maschine als neue Kernarchitektur einführen. Den bestehenden Household Food-Rule Snapshot nur als bestehende Sicherheitsprüfung mit unveränderter Mitgliederabdeckung verwenden, nicht in persönliche Providerdaten umdeuten.
    - **Akzeptanz:** Fremde private Werte, Tracking- und Child-Quellen erreichen weder Provider, Cache, Draft, Usage noch Fehlerartefakte; berechtigte Haushaltsmitglieder bleiben in der bestehenden Food-Rule-Prüfung; eine persönliche Freigabe verändert keine RLS- oder Sichtbarkeitsrechte.
    - **Requirements:** 4.1-4.9, 10.3-10.9.
    - **Design-Anker:** Architecture 2.3, Data Models 8-9, Serverkomponenten 6.
    - **Abhängigkeiten:** 2.2.
    - **Unverändert:** bestehende `profile_food_rules`-Semantik, `get_ai_household_food_rule_snapshot`, Household Membership/RLS und Tracking-Tabellen.

  - [ ] 2.5 Consent-, Scope-, Food-Rule- und Account-Ownership-Tests als Pflichtnachweis schreiben
    - **Dateien/Module:** `src/features/ai-assistant/data/consent-api.test.ts`, `src/features/ai-assistant/consent/consent-settings.test.tsx`, `supabase/functions/ai-gateway/consent-loader_test.ts`, `supabase/functions/ai-gateway/scope-builder_test.ts`, `supabase/functions/ai-gateway/tracking-safety_test.ts`, `supabase/tests/ai_assistant_consents.test.sql`.
    - **Aktion:** Save mit leerer Auswahl, unveränderte Wiederverwendung ohne Einzelbestätigung, Scope-/Zweck-/Provider-Wechsel, Revoke, Re-enable, zwei Accounts im selben Haushalt, Household-Food-Rule-Abdeckung und bekannte Tracking-/Child-Quellen testen. Prüfen, dass Vorprüfungsfehler keine Credit-, Provider-, Storage- oder Usage-Spies auslösen.
    - **Akzeptanz:** Die Account-Ownership des Consent Records ist nachgewiesen, Household-Mitglieder erhalten keine privaten Consent-Daten, Food-Rule-Mitgliederabdeckung bleibt vollständig, Tracking-Inhalte werden nicht echoed oder geloggt und keine bestehende Household-Policy wird gelockert oder künstlich gesperrt.
    - **Requirements:** 3.1-3.10, 4.1-4.9, 10.1-10.9.
    - **Design-Anker:** Testing Strategy 26-28, Correctness Properties 3-4 und 11.
    - **Abhängigkeiten:** 2.1, 2.2, 2.3, 2.4.
    - **Prüfung:** `bun run test src/features/ai-assistant/data/consent-api.test.ts src/features/ai-assistant/consent/consent-settings.test.tsx supabase/functions/ai-gateway/consent-loader_test.ts supabase/functions/ai-gateway/scope-builder_test.ts supabase/functions/ai-gateway/tracking-safety_test.ts`; danach `bun run test:db supabase/tests/ai_assistant_consents.test.sql`.
    - **Unverändert:** bestehende RLS-/Food-Rule-Assertions, Household-Mitgliedschaft, Tracking-Schutz und `recipe_suggestion.v1`/`fam-y918`.

  - [ ]* 2.6 Property-Test für **Property 3: Ein unveränderter Consent Frame erlaubt Wiederverwendung ohne per-call Bestätigung** schreiben
    - **Dateien/Module:** `src/features/ai-assistant/consent/consent-reuse.property.test.ts`.
    - **Aktion:** Mit mindestens 100 Fällen aktive, widerrufene, fehlende und veränderte Consent Frames über Account, Kategorien, Scope, Zweck und Provider variieren.
    - **Akzeptanz:** Nur der unveränderte aktive Rahmen darf ohne neue Einzelbestätigung fortsetzen; alle anderen Zustände liefern `consent_required` vor Credit und Provider.
    - **Requirements:** 3.1, 3.5-3.10.
    - **Design-Anker:** Correctness Property 3 und Consent-Zustände 21.
    - **Abhängigkeiten:** 2.2.
    - **Prüfung:** `bun run test src/features/ai-assistant/consent/consent-reuse.property.test.ts`.
    - **Unverändert:** bestehender Einzelrequest-Transport und RevenueCat-/Credit-Grenzen.

  - [ ]* 2.7 Property-Test für **Property 4: Scope und Food-Rule-Prüfung respektieren Ownership ohne Haushaltssperre** schreiben
    - **Dateien/Module:** `supabase/functions/ai-gateway/scope-ownership.property.test.ts`.
    - **Aktion:** Mindestens 100 Kombinationen aus Household-Mitgliedern, fremden und eigenen Präferenzen, Page Contexts und Food-Rule-Snapshots prüfen.
    - **Akzeptanz:** Household-Daten folgen nur Session/Membership/RLS, persönliche Werte kommen ausschließlich vom anfragenden Account und der vollständige Food-Rule Snapshot bleibt erhalten.
    - **Requirements:** 4.1-4.7, 4.9.
    - **Design-Anker:** Correctness Property 4 und Architecture 2.3.
    - **Abhängigkeiten:** 2.4.
    - **Prüfung:** `bun run test:functions -- scope-ownership.property.test.ts`.
    - **Unverändert:** Household-RLS, Member-Abdeckung und `profile_food_rules`.

  - [ ]* 2.8 Property-Test für **Property 11: Tracking und Child-Tracking erreichen keine neue Daten-Senke** schreiben
    - **Dateien/Module:** `supabase/functions/ai-gateway/tracking-exclusion.property.test.ts`.
    - **Aktion:** Mindestens 100 Requests mit bekannten Trackingfeldern, Tracking-Origin-Markern, Child-Quellen und tracking-abgeleiteten Providerresultaten durch Scope, Booking, Provider, Response, Cache, Draft, Usage und Fehlerpfade führen.
    - **Akzeptanz:** Jede bekannte unzulässige Quelle wird vor Credit und Provider abgelehnt; unzulässige Providerresultate werden vollständig verworfen und nicht gespeichert, geloggt oder echoed.
    - **Requirements:** 10.1-10.9.
    - **Design-Anker:** Correctness Property 11 und Data Models 9.
    - **Abhängigkeiten:** 2.4.
    - **Prüfung:** `bun run test:functions -- tracking-exclusion.property.test.ts`.
    - **Unverändert:** bestehende Tracking-Storage-, Analytics- und Usage-Verträge.

  - [ ] 2.9 Checkpoint: Consent-, Scope- und RLS-Nachweise ausführen
    - **Aktion:** Die Pflicht-Tests aus 2.5 sowie die verfügbaren fokussierten Property-Tests aus 2.6-2.8 ausführen und nur bei grünen, zielgerichteten Nachweisen weitergehen.
    - **Akzeptanz:** Consent-Lifecycle, Privacy-Link, Owner-Isolation, Food-Rule-Abdeckung und Tracking-Grenze sind durch fokussierte Tests abgedeckt; kein Test schwächt bestehende Assertions.
    - **Requirements:** 3.1-3.10, 4.1-4.9, 10.1-10.9.
    - **Design-Anker:** Testing Strategy 26-28.
    - **Abhängigkeiten:** 2.5, 2.6, 2.7, 2.8.
    - **Prüfung:** gezielte `bun run test <betroffene-testdatei>`, `bun run test:functions -- <betroffene-function-testdatei>`, `bun run test:db <betroffener-test>`.
    - **Unverändert:** alle bestehenden Household-, Food-Rule-, Tracking- und Legacy-Assertions.

- [ ] 3. Provider-, RevenueCat-, Credit-, Refund- und Usage-Erweiterung am bestehenden Gateway
  - Diese Phase ergänzt nur optionale Capability-/Contract-/Zweckmetadaten und nutzt die bestehende OpenRouter-/Groq-, RevenueCat- und Credit-Infrastruktur.
  - **Akzeptanz:** Neue externe Aufrufe werden erst nach Auth-, Scope-, Consent-, Tracking- und Providerprüfung gebucht; strukturierte Quellen ohne Modellaufruf buchen keine Credits; unbrauchbare Ergebnisse erhalten höchstens den bestehenden einmaligen Refund.
  - **Requirements:** 7.12, 8.2-8.4, 9.1-9.10, 10.1, 10.9.
  - **Design-Anker:** Serverkomponenten 6, Provider 17-19, Error Handling 22-23, Correctness Property 10.
  - **Abhängigkeiten:** 2.9.
  - **Unverändert:** OpenRouter-/Groq-Providerweg, RevenueCat-Entitlement, Credit Booking, Refund-Idempotenz, Legacy Skill-Werte, `recipe_suggestion.v1` und `fam-y918`.

  - [ ] 3.1 Capability-Metadaten, Provider-Allowlist und rückwärtskompatibles Usage Logging implementieren
    - **Dateien/Module:** `supabase/functions/ai-gateway/providers.ts`, `supabase/functions/ai-gateway/handler.ts`, `supabase/functions/ai-gateway/usage.ts`, `supabase/schemas/28_ai_usage.sql`, `src/lib/database.types.ts` als Generatorausgabe.
    - **Aktion:** Optionale `capabilityId`-, `contractVersion`- und `purposeCode`-Felder content-frei an bestehende Usage Events ergänzen. Capability-spezifische Provider-Fähigkeiten gegen die vorhandene OpenRouter-/Groq-Allowlist prüfen. Secret-Bindings ausschließlich aus `SUPABASE_SECRET_KEYS.default` serverseitig lesen; fehlende Konfiguration als stabile unavailable-Fehler melden und keinen stillen Providerwechsel ausführen. Bestehende Entitlement-, atomare Booking- und Refund-Helfer additiv für neue Capability-Requests aufrufen.
    - **Akzeptanz:** Legacy Rows und Legacy Skill-Werte bleiben gültig; neue Metadaten enthalten keinen Prompt, keine Antwort, keine Rohbytes, keine Präferenz- oder Trackingwerte; Provider-, Modell- oder Output-Mismatch stoppt vor Provider/Booking beziehungsweise refundiert höchstens einmal nach vorhandener Regel; der Mobile Client enthält keine Secrets oder Credit-Counter.
    - **Requirements:** 7.12, 8.2-8.4, 9.1-9.10, 10.1, 10.9.
    - **Design-Anker:** Minimal additive Vertragsformen 10, Serverkomponenten 6, Provider 17-19.
    - **Abhängigkeiten:** 2.9, 1.1.
    - **Prüfung:** Schemaänderungen nur über `bun run db:diff` und `bun run db:types`; danach gezielte Function-Tests.
    - **Unverändert:** vorhandene OpenRouter-/Groq-Adapter, `ai_usage_events`-Legacy-Spalten und Skill-Check, RevenueCat-Entitlement, Credit Booking, Refund-Regel und Secret-Key-Vertrag.

  - [ ] 3.2 Provider-, Credit-, Refund- und Usage-Tests als Pflichtnachweis schreiben
    - **Dateien/Module:** `supabase/functions/ai-gateway/providers_test.ts`, `supabase/functions/ai-gateway/usage_test.ts`, `supabase/functions/ai-gateway/handler_test.ts`, `supabase/tests/ai_usage_capability_metadata.test.sql`.
    - **Aktion:** OpenRouter/Groq-Allowlist, fehlendes `SUPABASE_SECRET_KEYS.default`, unavailable ohne stilles Failover, Booking-Reihenfolge, strukturierte Quelle ohne Booking, genau ein Refund und content-freie additive Usage-Metadaten testen. Mobile-Code statisch auf Provider-/Supabase-/RevenueCat-Secret-Keys prüfen.
    - **Akzeptanz:** Kein Vorprüfungsfehler erreicht Booking oder Provider; ein terminal nutzloses Ergebnis refundiert höchstens einmal; Legacy Usage Rows und `recipe_suggestion.v1`-Semantik bleiben unverändert.
    - **Requirements:** 8.2-8.4, 9.1-9.10, 10.1, 10.9.
    - **Design-Anker:** Testing Strategy 26-28, Error Handling 22-23.
    - **Abhängigkeiten:** 3.1.
    - **Prüfung:** `bun run test:functions -- providers_test.ts usage_test.ts handler_test.ts`; danach `bun run test:db supabase/tests/ai_usage_capability_metadata.test.sql`.
    - **Unverändert:** vorhandene Provider- und Billing-Tests sowie Legacy Usage Assertions.

  - [ ]* 3.3 Property-Test für **Property 10: Credits, Refunds und Usage bleiben rückwärtskompatibel** schreiben
    - **Dateien/Module:** `supabase/functions/ai-gateway/credit-usage-compatibility.property.test.ts`.
    - **Aktion:** Mindestens 100 neue Capability-Ausführungen mit strukturierter Quelle, Providerfehler, nutzlosem Ergebnis, erfolgreichem Ergebnis und Legacy-Metadaten simulieren.
    - **Akzeptanz:** Entitlement und Booking folgen dem vorhandenen Weg, strukturierte Quellen buchen null Credits, ein nutzloses Ergebnis erhält höchstens einen Refund und Usage bleibt content-frei sowie Legacy-kompatibel.
    - **Requirements:** 9.3-9.8.
    - **Design-Anker:** Correctness Property 10 und Provider 18-19.
    - **Abhängigkeiten:** 3.1.
    - **Prüfung:** `bun run test:functions -- credit-usage-compatibility.property.test.ts`.
    - **Unverändert:** RevenueCat-, Credit-, Refund- und Legacy-Usage-Verträge.

  - [ ] 3.4 Checkpoint: Gateway-Basis und Kostenpfad gezielt verifizieren
    - **Aktion:** Die Pflicht-Tests aus 3.2 und den verfügbaren Property-Test aus 3.3 ausführen, ohne einen Provider oder Hosted-Zustand außerhalb der gezielten Testumgebung aufzurufen.
    - **Akzeptanz:** Additive Metadaten, Provider-Allowlist, Secret-Binding, Credit-Reihenfolge, Refund-Idempotenz und Usage-Kompatibilität sind grün nachgewiesen.
    - **Requirements:** 9.1-9.10.
    - **Design-Anker:** Testing Strategy 28.
    - **Abhängigkeiten:** 3.2, 3.3.
    - **Prüfung:** gezielte `bun run test:functions -- <betroffene-function-testdatei>`, `bun run test:db <betroffener-test>`.
    - **Unverändert:** alle bestehenden Legacy Gateway-, Provider-, Credit-, Refund- und Usage-Tests.

- [ ] 4. Vorhandenen Assistant und vorhandene Apply-Owner kompatibel erweitern
  - Diese Phase ergänzt ausschließlich Consent-Status, Capability-Metadaten und die dokumentierten Review-Grenzen am bestehenden Assistant. Es entsteht kein paralleler Assistant-Screen und keine generische AI-Mutation.
  - **Akzeptanz:** Route, Screen, accountbezogene Threads, Recipe-/Meal-Plan-Kontext, Attachments, read-only Tools sowie Meal-Plan-, Swap- und Shopping-Apply-Pfade funktionieren weiterhin und bleiben vor Apply read-only.
  - **Requirements:** 2.1-2.6, 3.2-3.4, 5.1-5.9, 8.5-8.9.
  - **Design-Anker:** Architecture 1-2, Mobile Components 5, Data Flow 12, Proposal- und Apply-Grenzen 15-16, Correctness Property 5.
  - **Abhängigkeiten:** 3.4.
  - **Unverändert:** `src/app/assistant.tsx`, `fam-assistant`, `assistant-screen.tsx` als Einstieg, lokale Threads, bestehende Attachment-Grenzen, read-only Tools und alle vorhandenen Apply-Owner.

  - [ ] 4.1 Bestehenden Assistant-Request und Review-Einstieg additiv verdrahten
    - **Dateien/Module:** `src/app/assistant.tsx`, `src/features/ai-assistant/screens/assistant-screen.tsx`, `src/features/ai-assistant/data/assistant-api.ts`, `src/features/ai-assistant/data/assistant-storage.ts`, `src/features/ai-assistant/data/assistant-attachments.ts`.
    - **Aktion:** Optionale Capability-/Contract-Metadaten und Consent-Status am bestehenden Requestpfad ergänzen. Consent-Einrichtung und Status erreichbar machen, ohne einen per-call Dialog zu zeigen. Bestehende Page-Context-, Attachment-, Thread- und Proposal-Review-Validierung weiterverwenden. Proposals bleiben bis zur bestehenden Apply-Aktion read-only; Apply-Aufrufe führen über die vorhandenen Domain Owner.
    - **Akzeptanz:** Maximal fünf Attachments, 8 MB encoded total, bestehende MIME-/Existenzprüfung, maximal 20 Threads und accountbezogener verschlüsselter Storage bleiben unverändert; Rendering oder Öffnen eines Proposals mutiert nichts; stale oder unberechtigte Proposals werden vom bestehenden Owner abgelehnt.
    - **Requirements:** 2.2-2.3, 3.2, 5.1-5.9, 8.5-8.7.
    - **Design-Anker:** Mobile Components 5, Data Flow 12, Proposal- und Apply-Grenzen 15-16.
    - **Abhängigkeiten:** 3.4, 2.9.
    - **Unverändert:** Assistant-Route, Assistant-Screen-Aufbau, accountbezogene Threads, Recipe-/Meal-Plan-Kontext, Attachment-Limits, read-only Tools, `apply-meal-plan-proposal.ts`, `apply-ingredient-swap-proposal.ts` und `apply-shopping-list-proposal.ts`.

  - [ ] 4.2 Assistant-, Attachment-, Storage- und Apply-Regression als Pflichtnachweis schreiben
    - **Dateien/Module:** `src/features/ai-assistant/data/assistant-api.test.ts`, `src/features/ai-assistant/data/assistant-attachments.test.ts`, `src/features/ai-assistant/data/assistant-storage.test.ts`, `src/features/ai-assistant/screens/assistant-screen.test.tsx`, `src/features/ai-assistant/data/apply-meal-plan-proposal.test.ts`, `src/features/ai-assistant/data/apply-meal-plan-proposal.integration.test.ts`, `src/features/ai-assistant/data/apply-ingredient-swap-proposal.test.ts`, `src/features/ai-assistant/data/apply-shopping-list-proposal.test.ts`.
    - **Aktion:** Bestehende Request-/Response-Kompatibilität, Thread-Grenze, Attachment-Limits, Page-Context-Ownership, read-only Proposal-Review, stale-Version, Food-Rule-Evidence und bestehende Apply-Mutationen fokussiert regressiv testen. Die Tests dürfen bestehende Assertions nicht entfernen oder abschwächen.
    - **Akzeptanz:** `fam-assistant` bleibt der einzige Assistant-Einstieg; jeder Apply-Owner revalidiert und mutiert nur bei gültiger Aktion; kein Gateway- oder Providerfehler schreibt Household- oder Trackingdaten.
    - **Requirements:** 2.2-2.3, 5.1-5.8, 8.5-8.9.
    - **Design-Anker:** Testing Strategy 26, Proposal- und Apply-Grenzen 15-16.
    - **Abhängigkeiten:** 4.1.
    - **Prüfung:** `bun run test src/features/ai-assistant/data/assistant-api.test.ts src/features/ai-assistant/data/assistant-attachments.test.ts src/features/ai-assistant/data/assistant-storage.test.ts src/features/ai-assistant/screens/assistant-screen.test.tsx src/features/ai-assistant/data/apply-meal-plan-proposal.test.ts src/features/ai-assistant/data/apply-meal-plan-proposal.integration.test.ts src/features/ai-assistant/data/apply-ingredient-swap-proposal.test.ts src/features/ai-assistant/data/apply-shopping-list-proposal.test.ts`.
    - **Unverändert:** vorhandene Route, Screen, Threads, Attachment-Regeln und Apply-Pfade.

  - [ ]* 4.3 Property-Test für **Property 5: Assistant-Kontext, Anhänge und Proposals bleiben begrenzt und read-only** schreiben
    - **Dateien/Module:** `src/features/ai-assistant/request-boundaries.property.test.ts`.
    - **Aktion:** Mindestens 100 Kombinationen aus Page Context, Attachment-MIME/Größe/Anzahl, Proposal-Snapshot, aktueller Version und Berechtigung prüfen.
    - **Akzeptanz:** Nur besitzgeprüfte Contexts und gültige Attachments passieren; kein Proposal mutiert vor Apply; stale oder unberechtigte Apply-Versuche verändern keinen Domainzustand.
    - **Requirements:** 5.2-5.8.
    - **Design-Anker:** Correctness Property 5 und Mobile Components 5.
    - **Abhängigkeiten:** 4.1.
    - **Prüfung:** `bun run test src/features/ai-assistant/request-boundaries.property.test.ts`.
    - **Unverändert:** bestehende Attachment-Limits, Proposal-Validatoren und Domain Apply-Owner.

  - [ ] 4.4 Checkpoint: Bestehenden Assistant und Apply-Owner absichern
    - **Aktion:** Die Pflicht-Regression aus 4.2 und den verfügbaren Property-Test aus 4.3 ausführen.
    - **Akzeptanz:** Bestehende Assistant-Flächen sind ohne parallelen Chatpfad kompatibel; alle Apply-Owner bleiben die einzigen Mutationsgrenzen.
    - **Requirements:** 2.2-2.3, 5.1-5.8.
    - **Design-Anker:** Testing Strategy 26.
    - **Abhängigkeiten:** 4.2, 4.3.
    - **Prüfung:** gezieltes `bun run test <betroffene-testdatei>`.
    - **Unverändert:** `fam-assistant`, Apply-Pfade, `recipe_suggestion.v1` und `fam-y918`.

- [ ] 5. Bestehenden Rezeptimport um Draft-, Quellen- und Medienstatus-Grenzen erweitern
  - Diese Phase erweitert ausschließlich `fam-recipe-import`; sie erstellt keinen zweiten Importpfad und ersetzt weder strukturierte Quellen noch den bestehenden Recipe-Apply-Owner.
  - **Akzeptanz:** Text, URL, Bild, PDF und Video bleiben verfügbar; strukturierte Quellen werden vor externem Modellzugriff bevorzugt; Drafts sind reviewbar und werden nur nach ausdrücklichem Save zu Household-Rezepten.
  - **Requirements:** 6.1-6.8, 7.11-7.13, 8.1-8.4.
  - **Design-Anker:** Capability Inventory `import`, Data Flow 13-14, Proposal- und Apply-Grenzen 15, Correctness Property 6.
  - **Abhängigkeiten:** 3.4, 4.4.
  - **Unverändert:** `fam-recipe-import`, vorhandene Text-/URL-/Bild-/PDF-/Video-Eingänge, bestehende Import-UI, Recipe-Apply-Owner und Receipt-/Media-Owner.

  - [ ] 5.1 Import-Draft-Envelope und expliziten Review-Übergang implementieren
    - **Dateien/Module:** `src/features/recipe-import/types.ts`, `src/features/recipe-import/data/recipe-import-api.ts`, `src/features/recipe-import/data/recipe-import-storage.ts`, `src/features/recipe-import/screens/*`, `supabase/functions/ai-gateway/recipe-source.ts`, `supabase/functions/ai-gateway/handler.ts`.
    - **Aktion:** Einen separat versionierten Draft-Envelope mit Source Type, Source Reference, extracted fields, Confidence, Warnings und Review Status am vorhandenen Importpfad ergänzen. Strukturierte Quellen vor Providerzugriff verwenden. Capability-/Contract-Metadaten und Purpose-/Input-/Retention-/Error-Grenzen an den bestehenden Pfad geben. Save als einzige Übergabe an den vorhandenen Recipe-Apply-Owner verdrahten.
    - **Akzeptanz:** Kein Draft erzeugt oder verändert ohne ausdrückliches Save ein Household-Rezept; fehlende Medien-Vertragsfelder liefern `media_contract_incomplete`; externe Verarbeitung prüft Consent, Entitlement, Credit und Provider vor Übermittlung; kein zweiter Import-Transport entsteht.
    - **Requirements:** 6.1-6.8, 7.11-7.13.
    - **Design-Anker:** Components 4 `import`, Data Flow 13, Error Handling 22-23.
    - **Abhängigkeiten:** 3.4, 4.4.
    - **Unverändert:** `fam-recipe-import`, bestehende Source-Referenzen, Import-UI, Draft-Review und Recipe-Apply-Owner.

  - [ ] 5.2 Import- und Draft-Regression als Pflichtnachweis schreiben
    - **Dateien/Module:** `src/features/recipe-import/data/recipe-import-api.test.ts`, `src/features/recipe-import/data/recipe-import-storage.test.ts`, `src/features/recipe-import/data/extract-video-recipe-frames.test.ts`, `supabase/functions/ai-gateway/recipe-source_test.ts`.
    - **Aktion:** Alle fünf vorhandenen Eingangstypen, strukturierte Quelle vor Provider, vollständigen Draft-Envelope, Warnungen/Confidence, Review-before-save, fehlendes Save, unveränderte Quelle und fehlende Medien-Vertragsdaten testen.
    - **Akzeptanz:** Vor explizitem Save bleibt die Household Recipe unverändert; offline startet kein externer Fetch/Model-/Media-Vorgang; bestehende Import-Inputs und Fehlercodes bleiben kompatibel.
    - **Requirements:** 6.1-6.8, 8.1-8.4.
    - **Design-Anker:** Testing Strategy 26, Data Flow 13.
    - **Abhängigkeiten:** 5.1.
    - **Prüfung:** `bun run test src/features/recipe-import/data/recipe-import-api.test.ts src/features/recipe-import/data/recipe-import-storage.test.ts src/features/recipe-import/data/extract-video-recipe-frames.test.ts supabase/functions/ai-gateway/recipe-source_test.ts`.
    - **Unverändert:** `fam-recipe-import`, bestehende Draft-/Review-Assertions und Recipe-Apply-Logik.

  - [ ]* 5.3 Property-Test für **Property 6: Import bewahrt Quelle und Review-Grenze** schreiben
    - **Dateien/Module:** `src/features/recipe-import/data/import-draft.property.test.ts`.
    - **Aktion:** Mindestens 100 strukturierte und externe Quellen mit Feldern, Confidence, Warnungen, Review Status und Save-/Discard-Aktionen erzeugen.
    - **Akzeptanz:** Strukturierte Quellen überspringen den External Model Call; jeder Draft bewahrt Quelle und Status; ohne Save bleibt die Household Recipe unverändert.
    - **Requirements:** 6.2-6.6.
    - **Design-Anker:** Correctness Property 6.
    - **Abhängigkeiten:** 5.1.
    - **Prüfung:** `bun run test src/features/recipe-import/data/import-draft.property.test.ts`.
    - **Unverändert:** `fam-recipe-import`-Eingänge, Draft-Review und Recipe-Apply-Owner.

  - [ ] 5.4 Checkpoint: Import- und Draft-Vertrag absichern
    - **Aktion:** Die Pflicht-Regression aus 5.2 und den verfügbaren Property-Test aus 5.3 ausführen.
    - **Akzeptanz:** Kein zweiter Importpfad, kein implizites Save und kein Offline-External-Call ist durch die fokussierten Tests möglich.
    - **Requirements:** 6.1-6.8, 8.1-8.4.
    - **Design-Anker:** Testing Strategy 26-28.
    - **Abhängigkeiten:** 5.2, 5.3.
    - **Prüfung:** gezieltes `bun run test <betroffene-testdatei>`.
    - **Unverändert:** `fam-recipe-import`, bestehende Import-UI und Recipe-Apply-Owner.

- [ ] 6. Notes, Swaps, Nutrition und Shopping nur an ihren dokumentierten Lücken ergänzen
  - Diese Phase implementiert keine neuen allgemeinen Mutationsebenen. Jede dauerhafte Änderung bleibt beim passenden vorhandenen Domain Owner; ein Proposal ohne Owner bleibt read-only.
  - **Akzeptanz:** Notes sind reviewbare Proposals, Swaps unterscheiden Kochmodus und dauerhafte Speicherung, Nutrition bleibt Estimate-only und Shopping erhält nur zwingende Metadaten/Regression.
  - **Requirements:** 7.1-7.4, 7.12-7.13, 9.6-9.9.
  - **Design-Anker:** Capability Inventory `notes`, `swaps`, `nutrition`, `shopping`, Capability-Übergänge 14, Proposal- und Apply-Grenzen 15-16, Correctness Property 7.
  - **Abhängigkeiten:** 3.4, 4.4, 5.4.
  - **Unverändert:** Recipe-, Swap- und Shopping-Domänen, `ingredient_swap_proposal.v1`, `shopping_list_proposal.v1`, `apply-ingredient-swap-proposal.ts`, `apply-shopping-list-proposal.ts` und alle Household-/Tracking-Mutationspfade.

  - [ ] 6.1 `notes` als versioniertes, read-only Recipe-Note-Proposal ergänzen
    - **Dateien/Module:** additive `src/features/ai-assistant/contracts/recipe-notes-proposal.ts`, `src/features/ai-assistant/data/assistant-api.ts`, `src/features/ai-assistant/screens/assistant-screen.tsx`, additive `supabase/functions/ai-gateway/notes.ts` und `supabase/functions/ai-gateway/handler.ts`.
    - **Aktion:** `recipe_notes_proposal.v1` mit Recipe-ID, Quellenreferenz, Notiztext, Unsicherheit, Review Status und Ablauf validieren und im bestehenden Proposal-Review anzeigen. Nur einen ausdrücklich vorhandenen Recipe-Note-Apply-Owner verwenden; solange kein passender Owner existiert, bleibt das Ergebnis vollständig read-only und wird als unavailable für Apply behandelt.
    - **Akzeptanz:** Ein Note-Proposal ändert niemals still ein Rezept; unbekannter Provider/Output-Vertrag liefert unavailable; Rendern, Öffnen oder Verwerfen löst keine Mutation aus.
    - **Requirements:** 7.1, 7.12-7.13.
    - **Design-Anker:** Components 4 `notes`, Capability-Übergänge 14, Proposal- und Apply-Grenzen 15, Error Handling 23.
    - **Abhängigkeiten:** 3.4, 4.4.
    - **Unverändert:** Recipe-Domain, vorhandene Recipe-Mutationsowner, `fam-assistant`, `recipe_suggestion.v1` und `fam-y918`.

  - [ ] 6.2 Notes-Proposal- und No-write-Tests als Pflichtnachweis schreiben
    - **Dateien/Module:** `src/features/ai-assistant/contracts/recipe-notes-proposal.test.ts`, `supabase/functions/ai-gateway/notes_test.ts`, `src/features/ai-assistant/screens/assistant-screen.test.tsx`.
    - **Aktion:** Gültige/ungültige Notes-Proposals, Quellen-/Unsicherheits-/Ablaufvalidierung, read-only Review, unavailable ohne Apply-Owner und fehlende direkte Recipe-Mutation testen.
    - **Akzeptanz:** Jeder ungültige Vertrag wird vor Usage/Storage abgewiesen; ohne passenden Owner bleibt der Vorschlag read-only; keine Recipe-Mutation entsteht durch Modellantwort oder Review.
    - **Requirements:** 7.1, 7.12-7.13.
    - **Design-Anker:** Testing Strategy 26, Error Handling 23.
    - **Abhängigkeiten:** 6.1.
    - **Prüfung:** `bun run test src/features/ai-assistant/contracts/recipe-notes-proposal.test.ts src/features/ai-assistant/screens/assistant-screen.test.tsx`; `bun run test:functions -- notes_test.ts`.
    - **Unverändert:** bestehende Recipe-Apply-Owner und `recipe_suggestion.v1`.

  - [ ] 6.3 `swaps` um additive Kochmodus-Information erweitern
    - **Dateien/Module:** `src/features/ai-assistant/types.ts`, `src/features/ai-assistant/data/assistant-api.ts`, `src/features/ai-assistant/data/apply-ingredient-swap-proposal.ts`, `supabase/functions/ai-gateway/handler.ts`.
    - **Aktion:** Im vorhandenen beziehungsweise separat versionierten Swap-Vertrag `applyMode: 'one_cooking' | 'persist_recipe'` ergänzen. Vor dem bestehenden Apply-Owner den Modus explizit reviewbar machen. `one_cooking` darf nur den aktuellen Kochkontext bedienen; `persist_recipe` darf ausschließlich den vorhandenen Recipe-Apply-Path mit erneuter Version-, Permission- und Food-Rule-Prüfung auslösen.
    - **Akzeptanz:** Kein Modus wird implizit gewählt; stale Version, unzureichende Food-Rule-Evidence oder fehlende Berechtigung verändern kein Rezept; der bestehende Swap-Apply-Path bleibt die einzige Persistenzgrenze.
    - **Requirements:** 7.2, 4.5, 4.9, 5.5-5.8.
    - **Design-Anker:** Components 4 `swaps`, Proposal- und Apply-Grenzen 15-16, Capability-Übergänge 14.
    - **Abhängigkeiten:** 4.4.
    - **Unverändert:** `ingredient_swap_proposal.v1`-Kompatibilität, `apply-ingredient-swap-proposal.ts`, Recipe-RLS und Reverse-State-Regeln.

  - [ ] 6.4 Swap-Modus-, Stale- und Food-Rule-Regression als Pflichtnachweis schreiben
    - **Dateien/Module:** `src/features/ai-assistant/data/apply-ingredient-swap-proposal.test.ts`, `src/features/ai-assistant/contracts/ingredient-swap-proposal.test.ts`, `supabase/functions/ai-gateway/handler_test.ts`.
    - **Aktion:** Beide Modi, fehlenden Modus, stale Recipe-Version, veränderte Food-Rule-Evidence, fehlende Berechtigung und erfolgreiche Nutzung des bestehenden Apply-Owners testen.
    - **Akzeptanz:** Einmaliges Kochen persistiert nichts; dauerhafte Speicherung nutzt nur den bestehenden Owner; jeder Konflikt endet ohne Domainmutation.
    - **Requirements:** 7.2, 4.5, 4.9, 5.7-5.8.
    - **Design-Anker:** Testing Strategy 26, Proposal- und Apply-Grenzen 16.
    - **Abhängigkeiten:** 6.3.
    - **Prüfung:** `bun run test src/features/ai-assistant/data/apply-ingredient-swap-proposal.test.ts src/features/ai-assistant/contracts/ingredient-swap-proposal.test.ts supabase/functions/ai-gateway/handler_test.ts`.
    - **Unverändert:** vorhandener Swap-Vertrag und Apply-Owner.

  - [ ] 6.5 `nutrition` als read-only Estimate-Vertrag ergänzen
    - **Dateien/Module:** additive `src/features/ai-assistant/contracts/nutrition-estimate.ts`, `src/features/ai-assistant/data/assistant-api.ts`, additive `supabase/functions/ai-gateway/nutrition.ts`, `supabase/functions/ai-gateway/handler.ts`.
    - **Aktion:** `nutrition_estimate.v1` mit Wert, Einheit, Quelle, Unsicherheit und unveränderlichem `isEstimate: true` ergänzen. Nur Recipe-/Product-Reads verwenden; keine Nutrition-Tracking-Query, kein Tracking-Write und keine Ableitung aus privaten Trackingdaten zulassen.
    - **Akzeptanz:** Jede sichtbare Darstellung trägt das Estimate-Label; kein Nutrition-Tracking-Eintrag wird durch Request, Response, Cache oder Apply erzeugt; fehlender Vertrag/Provider liefert unavailable.
    - **Requirements:** 7.3, 10.1, 10.4, 10.8-10.9.
    - **Design-Anker:** Components 4 `nutrition`, Data Models 9-10, Capability-Übergänge 14.
    - **Abhängigkeiten:** 3.4, 2.4.
    - **Unverändert:** bestehende Nutrition-Tracking-Domäne, private Tracking-RLS und Rezept-/Produkt-Reads.

  - [ ] 6.6 Nutrition-Estimate- und No-tracking-write-Tests als Pflichtnachweis schreiben
    - **Dateien/Module:** `src/features/ai-assistant/contracts/nutrition-estimate.test.ts`, `supabase/functions/ai-gateway/nutrition_test.ts`, `src/features/calorie-tracking/*` nur als unveränderter Sink-Spy im Test.
    - **Aktion:** `isEstimate`-Invariante, Quellen-/Unsicherheitsvalidierung, fehlende Providerfähigkeit, fehlende Tracking-Reads und fehlende Tracking-Mutation testen.
    - **Akzeptanz:** Ein Estimate ohne Label ist ungültig; Tracking-Queries und Tracking-Writer werden in jedem neuen Nutrition-Pfad nicht aufgerufen; unzulässige Providerresultate werden vollständig verworfen.
    - **Requirements:** 7.3, 10.1, 10.4, 10.9.
    - **Design-Anker:** Testing Strategy 26, Correctness Property 7.
    - **Abhängigkeiten:** 6.5.
    - **Prüfung:** `bun run test src/features/ai-assistant/contracts/nutrition-estimate.test.ts`; `bun run test:functions -- nutrition_test.ts`.
    - **Unverändert:** gesamte private Nutrition-/Tracking-Domäne.

  - [ ] 6.7 `shopping` nur um zwingende Capability-/Contract-/Usage-Metadaten ergänzen
    - **Dateien/Module:** `src/features/ai-assistant/types.ts`, `src/features/ai-assistant/data/assistant-api.ts`, `supabase/functions/ai-gateway/handler.ts`, `supabase/functions/ai-gateway/usage.ts`.
    - **Aktion:** Die vorhandenen `shopping_list_proposal.v1`- und Shopping-List-Item-Proposals nur mit optionalen capability-spezifischen Metadaten und Review-Status versehen. Den bestehenden Shopping-Merge-/Idempotenz-Apply-Owner weiterverwenden; keine neue Shopping-Mutation und keinen zweiten Proposal-Envelope einführen.
    - **Akzeptanz:** Shopping bleibt review-before-apply; neue Metadaten sind optional, content-frei und rückwärtskompatibel; jede Persistenz läuft ausschließlich über `apply-shopping-list-proposal.ts`.
    - **Requirements:** 7.4, 9.6-9.8.
    - **Design-Anker:** Components 4 `shopping`, Provider 19, Proposal- und Apply-Grenzen 15.
    - **Abhängigkeiten:** 3.1, 4.4.
    - **Unverändert:** `shopping_list_proposal.v1`, Shopping-Merge, Idempotenz, RLS und `apply-shopping-list-proposal.ts`.

  - [ ] 6.8 Shopping-Merge-, Review- und Kompatibilitätsregression als Pflichtnachweis schreiben
    - **Dateien/Module:** `src/features/ai-assistant/data/apply-shopping-list-proposal.test.ts`, `src/features/ai-assistant/data/assistant-api.test.ts`, `supabase/functions/ai-gateway/usage_test.ts`.
    - **Aktion:** Bestehende Proposal-Shapes ohne Metadaten, additive Metadaten, Review-before-apply, idempotenten Merge und keine direkte Mutation durch Gateway/Provider testen.
    - **Akzeptanz:** Alte Shopping-Proposals bleiben gültig; kein neuer Apply-Pfad entsteht; ein nicht bestätigtes Proposal verändert keine Shopping-Daten.
    - **Requirements:** 7.4, 5.5-5.8, 9.6-9.8.
    - **Design-Anker:** Testing Strategy 26, Components 4 `shopping`.
    - **Abhängigkeiten:** 6.7.
    - **Prüfung:** `bun run test src/features/ai-assistant/data/apply-shopping-list-proposal.test.ts src/features/ai-assistant/data/assistant-api.test.ts supabase/functions/ai-gateway/usage_test.ts`.
    - **Unverändert:** Shopping-Proposal-Verträge, Merge-/Idempotenzlogik und Apply-Owner.

  - [ ] 6.9 Checkpoint: Fachliche Proposal-Grenzen gezielt verifizieren
    - **Aktion:** Pflichtnachweise 6.2, 6.4, 6.6 und 6.8 ausführen.
    - **Akzeptanz:** Notes, Swaps und Nutrition bleiben capability-spezifisch; Shopping ist ausschließlich additiv erweitert; kein Proposal mutiert außerhalb seines vorhandenen Owners.
    - **Requirements:** 7.1-7.4, 7.12-7.13.
    - **Design-Anker:** Capability-Übergänge 14, Proposal- und Apply-Grenzen 15-16.
    - **Abhängigkeiten:** 6.2, 6.4, 6.6, 6.8.
    - **Prüfung:** gezieltes `bun run test <betroffene-testdatei>` und `bun run test:functions -- <betroffene-function-testdatei>`.
    - **Unverändert:** alle bestehenden Recipe-, Swap-, Nutrition- und Shopping-Owner sowie `recipe_suggestion.v1`/`fam-y918`.

- [ ] 7. Receipt, Discover und Reminder an vorhandene Owner anbinden
  - Diese Phase ergänzt nur die dokumentierten Übergänge: Receipt zuerst als Review-Objekt, Discover mit Herkunft vor Import-Draft und Reminder erst nach vollständig bestätigtem lokalem Scheduling-Rahmen.
  - **Akzeptanz:** Keine Receipt-, Inventory-, Shopping-History-, Recipe- oder Notification-Mutation erfolgt durch Modellantwort allein.
  - **Requirements:** 7.5-7.7, 7.12-7.13, 6.3-6.8.
  - **Design-Anker:** Capability Inventory `receipts`, `discover`, `reminders`, Capability-Übergänge 14, Proposal- und Apply-Grenzen 15-16.
  - **Abhängigkeiten:** 5.4, 6.9.
  - **Unverändert:** OCR-/Receipt-Speicher und Review, Rezeptkatalog/`search_recipes`, `fam-recipe-import`, lokale Notification-/Reminder-Infrastruktur, Household-RLS und bestehende Apply-Owner.

  - [ ] 7.1 `receipts` als reviewbares Receipt-Proposal an OCR/Review anbinden
    - **Dateien/Module:** `src/features/ocr/processing/review/model.ts`, `src/features/ocr/processing/review/receipt-review-modal.tsx`, `src/features/ocr/processing/workflow.ts`, `src/features/ocr/authority/api.ts`, `supabase/functions/ai-gateway/handler.ts`, additive `supabase/functions/ai-gateway/receipt.ts`.
    - **Aktion:** `receipt_proposal.v1` mit Receipt-Referenz, erkannten Items, Confidence, Warnungen und Review Status an den bestehenden OCR-/Receipt-Review-Pfad übergeben. Receipt image/PDF nur für den ausgewählten Receipt-Zweck verarbeiten. Explizite Review-/Apply-Aktion an den bestehenden Receipt-/Inventory-/Shopping-History-Owner weitergeben.
    - **Akzeptanz:** Vor Review und ausdrücklichem Apply bleiben Receipt, Inventory und Shopping History unverändert; fehlende Confidence/Warnungen/Status oder Providerfähigkeit liefert unavailable; kein automatisches Verbuchen entsteht.
    - **Requirements:** 7.5, 6.3-6.8, 7.12-7.13.
    - **Design-Anker:** Components 4 `receipts`, Data Flow 13, Capability-Übergänge 14, Proposal- und Apply-Grenzen 15.
    - **Abhängigkeiten:** 5.4, 3.4.
    - **Unverändert:** OCR-Capture, Receipt-Speicher, Review-Owner, Receipt-/Inventory-/Shopping-History-Mutationen.

  - [ ] 7.2 Receipt-Proposal-, Attachment- und No-write-Regression als Pflichtnachweis schreiben
    - **Dateien/Module:** `src/features/ocr/processing/review/model.test.ts`, `src/features/ocr/processing/review/receipt-review-modal.test.tsx`, `src/features/ocr/processing/workflow.test.ts`, `src/features/ocr/authority/api.test.ts`, `supabase/functions/ai-gateway/receipt_test.ts`.
    - **Aktion:** Image/PDF-Input, Receipt-Referenz, Confidence, Warnungen, Review Status, fehlende Vertragsfelder, Reject-before-Apply und bestehende Review-/Apply-Übergabe testen.
    - **Akzeptanz:** Kein unbestätigtes Receipt-Proposal schreibt Receipt-, Inventory- oder Shopping-History-Daten; vorhandene OCR-/Review-Tests bleiben erhalten.
    - **Requirements:** 7.5, 6.3-6.8.
    - **Design-Anker:** Testing Strategy 26, Error Handling 22-23.
    - **Abhängigkeiten:** 7.1.
    - **Prüfung:** `bun run test src/features/ocr/processing/review/model.test.ts src/features/ocr/processing/review/receipt-review-modal.test.tsx src/features/ocr/processing/workflow.test.ts src/features/ocr/authority/api.test.ts`; `bun run test:functions -- receipt_test.ts`.
    - **Unverändert:** bestehender OCR-/Receipt-Review- und Apply-Pfad.

  - [ ] 7.3 `discover` mit Herkunft und bestehendem Import-Draft verdrahten
    - **Dateien/Module:** `supabase/functions/ai-gateway/catalog-suggestions.ts`, `supabase/functions/ai-gateway/handler.ts`, `src/features/recipes/catalog/use-recipe-catalog.ts`, `src/features/recipes/catalog/recipe-catalog-screen.tsx`, `src/features/recipe-import/data/recipe-import-api.ts`, additive `src/features/ai-assistant/contracts/discover-result.ts`.
    - **Aktion:** `discover_result.v1` mit Source Reference, Origin und ausschließlich der Übergangsaktion `create_import_draft` ergänzen. Externe Quelle nur über den vorhandenen Gateway-/Providerpfad abfragen, Herkunft sichtbar machen und danach den vorhandenen `fam-recipe-import`-Draft verwenden. Keine direkte Recipe-Mutation und keine erfundene Herkunft erlauben.
    - **Akzeptanz:** Herkunft und Source Reference sind vor Draft-Erzeugung sichtbar; fehlende Quelle/Origin liefert unavailable; der Übergang erzeugt nur einen Import-Draft und kein Household-Rezept.
    - **Requirements:** 7.6, 6.1-6.6, 7.12-7.13.
    - **Design-Anker:** Components 4 `discover`, Data Flow 13-14.
    - **Abhängigkeiten:** 5.4, 3.4.
    - **Unverändert:** `search_recipes`, Rezeptkatalog, `fam-recipe-import`, Recipe-Apply-Owner und `recipe_suggestion.v1`.

  - [ ] 7.4 Discover-Origin- und Import-Draft-Regression als Pflichtnachweis schreiben
    - **Dateien/Module:** `src/features/ai-assistant/contracts/discover-result.test.ts`, `supabase/functions/ai-gateway/catalog-suggestions.test.ts`, `src/features/recipes/catalog/use-recipe-catalog.test.ts`, `src/features/recipe-import/data/recipe-import-api.test.ts`.
    - **Aktion:** Source Reference/Origin vor Draft, unbekannte Herkunft, vorhandene Katalogsuche, `create_import_draft` ohne direkte Recipe-Mutation und anschließendes Review-before-save testen.
    - **Akzeptanz:** Keine erfundene Quelle und keine direkte Recipe-Mutation; bestehendes read-only `search_recipes` bleibt kompatibel.
    - **Requirements:** 7.6, 6.1-6.6.
    - **Design-Anker:** Testing Strategy 26, Capability-Übergänge 14.
    - **Abhängigkeiten:** 7.3.
    - **Prüfung:** `bun run test src/features/ai-assistant/contracts/discover-result.test.ts src/features/recipes/catalog/use-recipe-catalog.test.ts src/features/recipe-import/data/recipe-import-api.test.ts supabase/functions/ai-gateway/catalog-suggestions.test.ts`.
    - **Unverändert:** Katalog, `search_recipes`, Import-Draft und Recipe-Apply-Owner.

  - [ ] 7.5 `reminders` als bestätigbares Proposal an lokale Notifications anbinden
    - **Dateien/Module:** additive `src/features/ai-assistant/contracts/reminder-proposal.ts`, `src/features/ai-assistant/data/reminder-proposal.ts`, `src/features/settings/notifications-screen.tsx`, `src/features/settings/notification-permission-card.tsx`, `src/lib/platform/notifications.ts`, `supabase/functions/ai-gateway/handler.ts`.
    - **Aktion:** `reminder_proposal.v1` mit explizitem Trigger, Zeitpunkt, Data Scope und Permission Status erzeugen. Nur nach ausdrücklicher Bestätigung und vorhandener Notification-Permission über den bestehenden lokalen Reminder-/Notification-Owner schedulen. AI-Aufrufe weder automatisch noch im Hintergrund starten.
    - **Akzeptanz:** Fehlender Trigger, Zeitpunkt, Scope oder Permission verhindert Scheduling; Proposal-Rendering und Modellantwort schedulen nichts; bestehende lokale Notification- und Cancel-Verträge bleiben aktiv.
    - **Requirements:** 7.7, 8.1-8.4.
    - **Design-Anker:** Components 4 `reminders`, Capability-Übergänge 14, Error Handling 22.
    - **Abhängigkeiten:** 3.4.
    - **Unverändert:** `src/lib/platform/notifications.ts`, Notification-Permissions, bestehende Reminder-Owner und keine automatische externe Verarbeitung.

  - [ ] 7.6 Reminder-Voraussetzungs- und No-background-call-Tests als Pflichtnachweis schreiben
    - **Dateien/Module:** `src/features/ai-assistant/contracts/reminder-proposal.test.ts`, `src/features/ai-assistant/data/reminder-proposal.test.ts`, `src/lib/platform/notifications.test.ts`, `src/features/settings/notifications-screen.test.tsx`.
    - **Aktion:** Fehlende und vollständige Trigger-/Zeit-/Scope-/Permission-Kombinationen, explizite Bestätigung, Scheduling, Cancel, Offline-Zustand und fehlende ungefragte Modellaufrufe testen.
    - **Akzeptanz:** Nur eine vollständige, bestätigte Eingabe schedult; Offline und Modellantwort allein erzeugen weder Notification noch External Model Call.
    - **Requirements:** 7.7, 8.1-8.4.
    - **Design-Anker:** Testing Strategy 26, Online-/Offline-Grenzen 24-25.
    - **Abhängigkeiten:** 7.5.
    - **Prüfung:** `bun run test src/features/ai-assistant/contracts/reminder-proposal.test.ts src/features/ai-assistant/data/reminder-proposal.test.ts src/lib/platform/notifications.test.ts src/features/settings/notifications-screen.test.tsx`.
    - **Unverändert:** bestehende Notification-/Reminder-Tests und Scheduling-/Cancel-Owner.

  - [ ] 7.7 Checkpoint: Review- und Herkunftsgrenzen der drei Proposals verifizieren
    - **Aktion:** Pflichtnachweise 7.2, 7.4 und 7.6 ausführen.
    - **Akzeptanz:** Receipt bleibt vor Review ohne Mutation, Discover zeigt Herkunft vor Draft und Reminder schedult nur nach vollständiger Bestätigung.
    - **Requirements:** 7.5-7.7.
    - **Design-Anker:** Capability-Übergänge 14, Proposal- und Apply-Grenzen 15-16.
    - **Abhängigkeiten:** 7.2, 7.4, 7.6.
    - **Prüfung:** gezieltes `bun run test <betroffene-testdatei>` und `bun run test:functions -- <betroffene-function-testdatei>`.
    - **Unverändert:** Receipt-/OCR-, Katalog-, Import- und Notification-Owner.

- [ ] 8. Bild, Speech-to-Text, Text-to-Speech und Media-Processing an vorhandene Medienbausteine binden
  - Diese Phase implementiert ausschließlich die vier dokumentierten Medienlücken auf dem vorhandenen Provider-, Attachment-, OCR-, Speech- und Storage-Rahmen. Sie führt keinen allgemeinen Medienjob und keine neue Medien-Outbox ein.
  - **Akzeptanz:** Bildresultate sind als generiert markiert und werden erst nach Attach/Save persistiert; Transkription startet nur explizit und wird vor Folgeaktionen geprüft; TTS liest nur sichtbaren Text lokal; Media-Processing bleibt zweckgebunden und online-only.
  - **Requirements:** 6.3-6.8, 7.8-7.11, 7.12, 8.1-8.4, 9.1-9.9.
  - **Design-Anker:** Components 4 Medien-IDs, Data Flow 13-14, Provider 17, Online-/Storage-Grenzen 24-25, Correctness Property 7.
  - **Abhängigkeiten:** 7.7.
  - **Unverändert:** Assistant-Attachment-Validator, `fam-recipe-import`, OCR-/Receipt-Owner, vorhandener Groq-Transkriptionsbaustein, `expo-speech`, bestehender Storage-Owner und Domain-Outbox.

  - [ ] 8.1 `image-generation` als begrenztes, gekennzeichnetes Resultat implementieren
    - **Dateien/Module:** additive `src/features/ai-assistant/contracts/generated-image.ts`, `src/features/ai-assistant/data/image-generation.ts`, `src/features/ai-assistant/screens/assistant-screen.tsx`, `supabase/functions/ai-gateway/providers.ts`, `supabase/functions/ai-gateway/handler.ts`.
    - **Aktion:** `generated_image.v1` mit Provider-Referenz, Zweck, Generated-Label, Ablauf und Attach-/Save-Option ergänzen. Eine Bildfähigkeit nur über die vorhandene Provider-Allowlist aufrufen. Das Resultat bis zu ausdrücklichem Attach/Save im bestehenden Attachment-/Storage-Owner halten; fehlende Bildfähigkeit als unavailable melden.
    - **Akzeptanz:** Kein Bild wird automatisch gespeichert oder angehängt; das Generated-Label ist unveränderlich sichtbar; keine neue Medienjob- oder Provider-Credential-Basis entsteht.
    - **Requirements:** 7.8, 7.12, 9.1-9.4, 9.6-9.10.
    - **Design-Anker:** Components 4 `image-generation`, Capability-Übergänge 14, Provider 17-19.
    - **Abhängigkeiten:** 3.4, 4.4, 7.7.
    - **Unverändert:** vorhandene Provider-/Credit-/Usage-Adapter, Attachment-/Storage-Owner, keine AI-Outbox.

  - [ ] 8.2 Bildresultat-, Availability- und No-save-Tests als Pflichtnachweis schreiben
    - **Dateien/Module:** `src/features/ai-assistant/contracts/generated-image.test.ts`, `src/features/ai-assistant/data/image-generation.test.ts`, `supabase/functions/ai-gateway/providers_test.ts`, `src/features/ai-assistant/screens/assistant-screen.test.tsx`.
    - **Aktion:** Generated-Label, Zweck/Ablauf, fehlende Bildfähigkeit, Providerfehler, Credit-/Refund-Übergang, Attach/Save-Aktion und fehlendes automatisches Storage testen.
    - **Akzeptanz:** Ohne explizite Aktion entsteht kein Attachment oder Storage-Write; unsupported Provider erzeugt keinen External Model Call und keine Booking.
    - **Requirements:** 7.8, 7.12, 9.3-9.9.
    - **Design-Anker:** Testing Strategy 26, Error Handling 22-23.
    - **Abhängigkeiten:** 8.1.
    - **Prüfung:** `bun run test src/features/ai-assistant/contracts/generated-image.test.ts src/features/ai-assistant/data/image-generation.test.ts src/features/ai-assistant/screens/assistant-screen.test.tsx`; `bun run test:functions -- providers_test.ts`.
    - **Unverändert:** bestehender Storage-/Attachment-Owner und Provider-/Credit-Verträge.

  - [ ] 8.3 Produktive `speech-to-text`-Review für Assistant/Import verdrahten
    - **Dateien/Module:** additive `src/features/ai-assistant/contracts/transcript.ts`, `src/features/ai-assistant/data/speech-to-text.ts`, `src/features/ai-assistant/screens/assistant-screen.tsx`, `src/features/recipe-import/data/recipe-import-api.ts`, `src/lib/platform/microphone-permissions.ts`, `supabase/functions/ai-gateway/providers.ts`, `supabase/functions/ai-gateway/handler.ts`.
    - **Aktion:** `transcript.v1` mit Audio-Referenz, Text, Sprache, Confidence und Review Status ergänzen. Externe Transkription nur nach ausdrücklicher Nutzeraktion, aktiver Verbindung, Consent-/Scope-/Provider-/Credit-Prüfung und Nutzung des bestehenden Groq-Transkriptionsbausteins starten. Das Transcript vor jeder weiteren Assistant- oder Import-Verarbeitung sichtbar prüfen lassen.
    - **Akzeptanz:** Keine automatische Aufnahme oder Upload; unbestätigtes Transcript startet keinen Folge-Call; Offline bleibt der Vorgang unavailable und wird nicht gepuffert; Roh-Audio bleibt außerhalb von Threads und Usage.
    - **Requirements:** 7.9, 6.3-6.8, 8.1-8.4, 9.1-9.9.
    - **Design-Anker:** Components 4 `speech-to-text`, Data Flow 13-14, Provider 17, Online-/Storage-Grenzen 24-25.
    - **Abhängigkeiten:** 3.4, 5.4, 7.7.
    - **Unverändert:** vorhandene Microphone-Permission, Groq-Transkription, Assistant-Attachment-Validator, Importpfad und accountbezogener Thread-Storage.

  - [ ] 8.4 Speech-to-Text-Action-, Review- und Online-only-Tests als Pflichtnachweis schreiben
    - **Dateien/Module:** `src/features/ai-assistant/contracts/transcript.test.ts`, `src/features/ai-assistant/data/speech-to-text.test.ts`, `src/lib/platform/microphone-permissions.test.ts`, `src/features/recipe-import/data/recipe-import-api.test.ts`, `supabase/functions/ai-gateway/providers_test.ts`.
    - **Aktion:** Permission, expliziten Start, Audio-Input, Transcript-Review, Folgeaktion, Provider-/Credit-Gates, Offline und fehlende Rohbyte-Persistenz testen.
    - **Akzeptanz:** Upload geschieht nur nach Nutzeraktion und online; Transcript ist vor Folgeaktionen sichtbar; ein abgelehnter oder ungültiger Transkriptvertrag erreicht weder weitere Capability noch Storage/Usage.
    - **Requirements:** 7.9, 8.1-8.4, 8.7, 9.3-9.9.
    - **Design-Anker:** Testing Strategy 26, Capability-Übergänge 14, Online-/Storage-Grenzen 24-25.
    - **Abhängigkeiten:** 8.3.
    - **Prüfung:** `bun run test src/features/ai-assistant/contracts/transcript.test.ts src/features/ai-assistant/data/speech-to-text.test.ts src/lib/platform/microphone-permissions.test.ts src/features/recipe-import/data/recipe-import-api.test.ts`; `bun run test:functions -- providers_test.ts`.
    - **Unverändert:** Speech-Permissions, Groq-Transkriptionsadapter, Assistant-/Import-Owner.

  - [ ] 8.5 Sichtbares `text-to-speech` über die vorhandene lokale Wiedergabe ergänzen
    - **Dateien/Module:** `src/features/recipes/hooks/use-cooking-mode-voice.ts`, `src/features/recipes/hooks/use-cooking-mode-voice.test.ts`, `src/features/recipes/components/cooking-mode/cooking-mode-voice-status.tsx`, `src/features/ai-assistant/screens/assistant-screen.tsx`, additive `src/features/ai-assistant/data/speech-playback.ts`.
    - **Aktion:** `speech_playback.v1` beziehungsweise einen lokalen Playback-Status für bereits sichtbare Assistant-Antworten und Kochschritte ergänzen. Die vorhandene `expo-speech`-/Cooking-Mode-Logik nach ausdrücklicher Nutzeraktion wiederverwenden. Keine externe Stimme, keine versteckte Modellverarbeitung und kein Hintergrund-Playback einführen.
    - **Akzeptanz:** Nur aktuell sichtbarer Text darf gelesen werden; Start/Stop erfolgt explizit; TTS erzeugt keinen Gateway-, Provider-, Credit-, Usage- oder Storage-Job.
    - **Requirements:** 7.10, 8.1-8.4.
    - **Design-Anker:** Components 4 `text-to-speech`, Capability-Übergänge 14, Provider 17.
    - **Abhängigkeiten:** 4.4, 7.7.
    - **Unverändert:** `expo-speech`, Cooking-Mode-Voice, sichtbare Textquellen und keine neue externe Medienverarbeitung.

  - [ ] 8.6 Text-to-Speech-Visibility- und No-background-call-Tests als Pflichtnachweis schreiben
    - **Dateien/Module:** `src/features/recipes/hooks/use-cooking-mode-voice.test.ts`, `src/features/recipes/components/cooking-mode/cooking-mode-voice-status.test.tsx`, `src/features/ai-assistant/data/speech-playback.test.ts`, `src/features/ai-assistant/screens/assistant-screen.test.tsx`.
    - **Aktion:** Sichtbaren Text, expliziten Start, Stop, leeren/nicht sichtbaren Text, Screen-Wechsel und fehlende externe Calls testen.
    - **Akzeptanz:** Unsichtbarer oder fremder Text wird nicht gesprochen; keine externe Anfrage, Credit-Buchung, Usage-Zeile oder Outbox-Eintrag entsteht.
    - **Requirements:** 7.10, 8.1-8.4.
    - **Design-Anker:** Testing Strategy 26, Capability-Übergänge 14.
    - **Abhängigkeiten:** 8.5.
    - **Prüfung:** `bun run test src/features/recipes/hooks/use-cooking-mode-voice.test.ts src/features/recipes/components/cooking-mode/cooking-mode-voice-status.test.tsx src/features/ai-assistant/data/speech-playback.test.ts src/features/ai-assistant/screens/assistant-screen.test.tsx`.
    - **Unverändert:** lokaler `expo-speech`-Pfad und Cooking-Mode-Voice-Vertrag.

  - [ ] 8.7 Zweckgebundene `media-processing`-Grenzen an vorhandene Flows anbinden
    - **Dateien/Module:** `src/features/ai-assistant/data/assistant-attachments.ts`, `src/features/recipe-import/data/recipe-import-api.ts`, `src/features/ocr/processing/workflow.ts`, `supabase/functions/ai-gateway/context-limits.ts`, `supabase/functions/ai-gateway/handler.ts`, additive `src/features/ai-assistant/contracts/media-result.ts`.
    - **Aktion:** `media_result.v1` beziehungsweise capability-spezifische Resultat-Envelope mit Purpose, Input Type, Status, Retention und Error State ergänzen. Bild, PDF und Video ausschließlich dem ausgewählten Assistant-, Import- oder Receipt-Zweck zuordnen. Fehlende Vertragsfelder als `media_contract_incomplete` melden; keinen allgemeinen Media Job, keine automatische Wiederholung und keine AI-Outbox anlegen.
    - **Akzeptanz:** MIME-, Zweck-, Existenz-, Größen-, Retention- und Fehlergrenzen sind vor Providerzugriff validiert; offline und nach Fehlerstatus wird nichts gepuffert oder automatisch erneut gestartet; Rohbytes werden nicht in Threads, Usage oder Fehlerartefakten abgelegt.
    - **Requirements:** 6.1-6.8, 7.11-7.12, 8.1-8.4, 8.7, 9.6.
    - **Design-Anker:** Components 4 `media-processing`, Data Flow 13, Error Handling 22, Online-/Storage-Grenzen 24-25.
    - **Abhängigkeiten:** 5.4, 7.7, 3.4.
    - **Unverändert:** Attachment-Validator, Import-, OCR- und Receipt-Owner, lokale Outbox und bestehende Storage-Regeln.

  - [ ] 8.8 Media-Processing-, Zweck-, Retention- und No-Outbox-Tests als Pflichtnachweis schreiben
    - **Dateien/Module:** `src/features/ai-assistant/data/assistant-attachments.test.ts`, `src/features/recipe-import/data/recipe-import-api.test.ts`, `src/features/ocr/processing/workflow.test.ts`, `supabase/functions/ai-gateway/context-limits_test.ts`, `supabase/functions/ai-gateway/media-processing_test.ts`.
    - **Aktion:** Zweckgebundene Bild/PDF/Video-Flows, fehlende Vertragsfelder, MIME/Größe, Status-/Fehlerübergänge, Retention-Metadaten, Offline, fehlendes Retry und fehlenden Outbox-Write testen.
    - **Akzeptanz:** Ein Medium wird nie in einen fremden Zweck umgedeutet; fehlende Purpose/Input/Retention/Error-Definition erzeugt unavailable; kein neuer AI- oder Medienjob gelangt in Outbox/Retry.
    - **Requirements:** 6.7-6.8, 7.11-7.12, 8.1-8.4.
    - **Design-Anker:** Testing Strategy 26, Error Handling 22, Online-/Storage-Grenzen 24.
    - **Abhängigkeiten:** 8.7.
    - **Prüfung:** `bun run test src/features/ai-assistant/data/assistant-attachments.test.ts src/features/recipe-import/data/recipe-import-api.test.ts src/features/ocr/processing/workflow.test.ts`; `bun run test:functions -- context-limits_test.ts media-processing_test.ts`.
    - **Unverändert:** bestehende Attachment-, Import-, OCR-, Outbox- und Storage-Tests.

  - [ ] 8.9 Checkpoint: Medienfunktionen ohne Job- oder Providerneubau verifizieren
    - **Aktion:** Pflichtnachweise 8.2, 8.4, 8.6 und 8.8 ausführen.
    - **Akzeptanz:** Bild, Speech-to-Text, Text-to-Speech und Media-Processing erfüllen jeweils ihren Zweck-, Review-, Online- und Mutationsvertrag; keine neue Medien-Outbox oder allgemeine Plattform ist vorhanden.
    - **Requirements:** 7.8-7.11, 8.1-8.4.
    - **Design-Anker:** Testing Strategy 26-28.
    - **Abhängigkeiten:** 8.2, 8.4, 8.6, 8.8.
    - **Prüfung:** gezielte `bun run test <betroffene-testdatei>` und `bun run test:functions -- <betroffene-function-testdatei>`.
    - **Unverändert:** bestehende Provider-, Speech-, OCR-, Attachment-, Storage- und Outbox-Owner.

- [ ] 9. Online-only, lokale Last Results, Account-Storage und Retention absichern
  - Diese Phase ergänzt nur Guards und Nachweise an den bestehenden Client-/Storage-Grenzen. Externe Modell- und Medienvorgänge werden nicht offline gepuffert und nicht automatisch fortgesetzt.
  - **Akzeptanz:** Offline sind Last Local Results und bestehende lokale Eingaben read-only sichtbar; neue externe Vorgänge, Quellen-Fetches, Media-Jobs, Outbox-Einträge und Retries bleiben aus; Connectivity allein startet nichts.
  - **Requirements:** 8.1-8.9, 6.7, 9.10.
  - **Design-Anker:** Online-/Offline- und Storage-Grenzen 24-25, Correctness Properties 8-9.
  - **Abhängigkeiten:** 8.9, 5.4.
  - **Unverändert:** verschlüsselter per-account Storage, maximal 20 Threads, Attachment-Metadatenvertrag, echte Household-Outbox und bestehende Auth-/Identity-Wechsel-Logik.

  - [ ] 9.1 Online-only-Guards und lokale Resultatvalidierung an vorhandenen Flows ergänzen
    - **Dateien/Module:** `src/features/ai-assistant/data/assistant-api.ts`, `src/features/ai-assistant/data/assistant-storage.ts`, `src/features/recipe-import/data/recipe-import-api.ts`, `src/features/ai-assistant/data/image-generation.ts`, `src/features/ai-assistant/data/speech-to-text.ts`, `src/lib/data/query-client.ts`, `src/lib/db/outbox.ts` nur als bestehender Nicht-AI-Sink im Test.
    - **Aktion:** Den vorhandenen `onlineManager`-Zustand vor jedem neuen externen Modell-, Quellen- oder Medienvorgang prüfen. Offline gültige Last Local Results und Eingaben read-only anzeigen, abgelaufene/ungültige Ergebnisse als nicht applybar markieren, Identity-/Household-Wechsel vor dem nächsten External Model Call invalidieren und nach Connectivity-Rückkehr keine automatische Fortsetzung auslösen. Keine AI-/Media-Operation in `src/lib/db/outbox.ts` oder eine neue Retry-Queue schreiben.
    - **Akzeptanz:** Offline liefert der Pfad `offline` ohne Fetch/Provider/Booking/Usage/Outbox; nur eine neue explizite Nutzeraktion kann online starten; Rohbytes bleiben außerhalb des Threads; bestehende Domain-Mutationen dürfen ihre vorhandene Outbox weiter nutzen.
    - **Requirements:** 8.1-8.9, 6.7, 9.10.
    - **Design-Anker:** Online-/Storage-Grenzen 24-25, Error Handling 22.
    - **Abhängigkeiten:** 8.9, 5.4.
    - **Unverändert:** `onlineManager`, accountbezogener MMKV-Storage, 20-Thread-Grenze, Domain-Outbox und bestehende Auth-/Household-Wechsel-Logik.

  - [ ] 9.2 Online-/Offline-, Retention-, Storage- und No-AI-Outbox-Tests als Pflichtnachweis schreiben
    - **Dateien/Module:** `src/features/ai-assistant/data/assistant-api.test.ts`, `src/features/ai-assistant/data/assistant-storage.test.ts`, `src/features/recipe-import/data/recipe-import-api.test.ts`, `src/lib/data/query-client.test.ts`, `src/lib/db/outbox.test.ts`, `src/lib/db/outbox-retry.test.ts`.
    - **Aktion:** Offline Last Local Result, lokale Eingabe, expired/invalid result, Connectivity-Rückkehr ohne Auto-Resume, explicit retry, Identity-/Household-Wechsel, maximal 20 Threads, Attachment-Metadaten ohne Rohbytes und fehlende AI-/Media-Outbox-Einträge testen.
    - **Akzeptanz:** Jeder neue externe Vorgang bleibt offline aus; Domain-Outbox-Tests bleiben für echte Household-Mutationen gültig; keine AI-/Media-Retry-Schlange wird eingeführt.
    - **Requirements:** 8.1-8.9.
    - **Design-Anker:** Testing Strategy 26, Online-/Storage-Grenzen 24-25.
    - **Abhängigkeiten:** 9.1.
    - **Prüfung:** `bun run test src/features/ai-assistant/data/assistant-api.test.ts src/features/ai-assistant/data/assistant-storage.test.ts src/features/recipe-import/data/recipe-import-api.test.ts src/lib/data/query-client.test.ts src/lib/db/outbox.test.ts src/lib/db/outbox-retry.test.ts`.
    - **Unverändert:** bestehende Storage-/Outbox-Assertions und echte Household-Sync-Mutationen.

  - [ ]* 9.3 Property-Test für **Property 8: Offline-Zustände starten oder puffern keine neuen externen Vorgänge** schreiben
    - **Dateien/Module:** `src/features/ai-assistant/online-only.property.test.ts`.
    - **Aktion:** Mindestens 100 Online-/Offline-Aktionen über Assistant, Import, Receipt und Medien mit Last Local Result, Connectivity-Rückkehr und expliziter Wiederholung variieren.
    - **Akzeptanz:** Offline entstehen weder External Model Call, Source Fetch, Media Job, Outbox-Eintrag noch Retry; Connectivity allein startet nichts; abgelaufene Ergebnisse bleiben nicht applybar.
    - **Requirements:** 8.1-8.4, 8.9.
    - **Design-Anker:** Correctness Property 8.
    - **Abhängigkeiten:** 9.1.
    - **Prüfung:** `bun run test src/features/ai-assistant/online-only.property.test.ts`.
    - **Unverändert:** bestehende Domain-Outbox für echte Household-Mutationen.

  - [ ]* 9.4 Property-Test für **Property 9: Lokaler Assistant-Storage bleibt accountbezogen und begrenzt** schreiben
    - **Dateien/Module:** `src/features/ai-assistant/data/assistant-storage.property.test.ts`.
    - **Aktion:** Mindestens 100 Sequenzen aus Thread-, Attachment-, Account- und Household-Wechseln erzeugen.
    - **Akzeptanz:** Höchstens 20 Threads bleiben im verschlüsselten Account-Storage, Rohbytes gelangen nie in Threads und ein Identity-/Household-Wechsel invalidiert den aktiven Scope vor dem nächsten External Model Call.
    - **Requirements:** 8.5-8.8.
    - **Design-Anker:** Correctness Property 9 und Online-/Storage-Grenzen 25.
    - **Abhängigkeiten:** 9.1.
    - **Prüfung:** `bun run test src/features/ai-assistant/data/assistant-storage.property.test.ts`.
    - **Unverändert:** vorhandener `account-storage`-Owner, Thread-Limit und Attachment-Metadatenvertrag.

  - [ ] 9.5 Checkpoint: Online-/Offline- und Retention-Vertrag verifizieren
    - **Aktion:** Pflichtnachweis 9.2 und die verfügbaren Property-Tests aus 9.3-9.4 ausführen.
    - **Akzeptanz:** Keine neue AI-/Media-Outbox, kein Auto-Resume, kein Rohbyte-Thread und kein Apply eines ungültigen Last Local Result ist durch die Tests möglich.
    - **Requirements:** 8.1-8.9.
    - **Design-Anker:** Testing Strategy 26-28.
    - **Abhängigkeiten:** 9.2, 9.3, 9.4.
    - **Prüfung:** gezieltes `bun run test <betroffene-testdatei>`.
    - **Unverändert:** lokale Account-Storage-, Domain-Outbox- und Sync-Verträge.

- [ ] 10. Cross-Surface-Integration und unveränderte Legacy-Isolation nachweisen
  - Diese Phase ergänzt nur fokussierte Regressionen und Isolationstests. Sie ändert weder den bestehenden Rezeptvorschlagsvertrag noch die laufende Legacy-Arbeit.
  - **Akzeptanz:** `fam-assistant`, `fam-recipe-import`, bestehende Apply-Paths, Provider-/Usage-Grenzen und die Isolation von `recipe_suggestion.v1`/`fam-y918` sind gemeinsam nachgewiesen.
  - **Requirements:** 1.2-1.7, 2.1-2.6, 5.1-5.8, 6.1-6.8, 9.1-9.10, 11.1-11.6.
  - **Design-Anker:** Bestands- und Kompatibilitätsregeln 3, Testing Strategy 26-28, Correctness Properties 7 und 12.
  - **Abhängigkeiten:** 9.5, 7.7, 8.9.
  - **Unverändert:** `recipe_suggestion.v1`, seine Route, Request-/Response-Shapes, Validatoren und Tests, `fam-y918`, alle Legacy Skills und vorhandene Apply-Owner.

  - [ ] 10.1 Cross-Surface-Regression für Assistant, Import und Apply-Owner als Pflichtnachweis schreiben
    - **Dateien/Module:** fokussierte Ergänzungen ausschließlich an den bestehenden Test-Ownern `src/features/ai-assistant/data/assistant-api.test.ts`, `src/features/recipe-import/data/recipe-import-api.test.ts`, `src/features/ai-assistant/data/apply-meal-plan-proposal.test.ts`, `src/features/ai-assistant/data/apply-ingredient-swap-proposal.test.ts`, `src/features/ai-assistant/data/apply-shopping-list-proposal.test.ts`, `supabase/functions/ai-gateway/handler_test.ts`.
    - **Aktion:** Einen durchgehenden Request-to-Review-to-Apply-Nachweis mit Consent, Scope, Provider-/Credit-Metadaten, read-only Proposal, explizitem Domain Apply und stale/unauthorized Reject ergänzen. Bestehende Assertions bleiben bestehen; nur additive Kompatibilitätsfälle kommen hinzu.
    - **Akzeptanz:** Kein External Model Call mutiert Household- oder Trackingdaten; jeder bestehende Apply-Owner revalidiert; Import bleibt Draft-before-save; Assistant und Import verwenden weiterhin ihre bestehenden Einstiege.
    - **Requirements:** 2.1-2.4, 5.1-5.8, 6.1-6.6, 9.1-9.9.
    - **Design-Anker:** Data Flow 12-13, Proposal- und Apply-Grenzen 15-16, Testing Strategy 26.
    - **Abhängigkeiten:** 9.5, 7.7, 8.9.
    - **Prüfung:** `bun run test src/features/ai-assistant/data/assistant-api.test.ts src/features/recipe-import/data/recipe-import-api.test.ts src/features/ai-assistant/data/apply-meal-plan-proposal.test.ts src/features/ai-assistant/data/apply-ingredient-swap-proposal.test.ts src/features/ai-assistant/data/apply-shopping-list-proposal.test.ts`; `bun run test:functions -- handler_test.ts`.
    - **Unverändert:** `fam-assistant`, `fam-recipe-import`, alle vorhandenen Apply-Owner und Legacy Skill-Verträge.

  - [ ] 10.2 Regressionstest für die Isolation von `recipe_suggestion.v1` und `fam-y918` schreiben
    - **Dateien/Module:** neuer fokussierter Test `supabase/functions/ai-gateway/merran-ai-assistant-legacy-isolation.test.ts` sowie Ausführung der unveränderten `supabase/functions/ai-gateway/recipe-suggestion-contract.test.ts`, `supabase/functions/ai-gateway/recipe-suggestion-context.test.ts`, `src/features/recipes/data/recipe-suggestion-gateway.test.ts` und `src/features/recipes/data/use-recipe-suggestions.test.ts`.
    - **Aktion:** Nachweisen, dass neue Capability-Registry-, Import-, Proposal- und Medienverträge weder den vorhandenen Legacy-Validator, dessen Route/Shapes noch die `fam-y918`-Logik importieren, überschreiben oder als allgemeines Envelope verwenden. Nur ein neuer Isolationstest darf hinzukommen; bestehende Legacy-Dateien und Assertions bleiben unverändert.
    - **Akzeptanz:** Bestehende Legacy-Tests bleiben unverändert grün; kein neuer Contract-Alias zeigt auf `recipe_suggestion.v1`; Änderungen an `fam-y918` oder dem Legacy-Vertrag sind im Task-Ergebnis nicht vorhanden.
    - **Requirements:** 1.6-1.7, 2.6, 11.1-11.6.
    - **Design-Anker:** Bestands- und Kompatibilitätsregeln 3, Correctness Property 12, Nicht-property-basierte Schutztests.
    - **Abhängigkeiten:** 9.5, 1.2.
    - **Prüfung:** `bun run test supabase/functions/ai-gateway/merran-ai-assistant-legacy-isolation.test.ts supabase/functions/ai-gateway/recipe-suggestion-contract.test.ts supabase/functions/ai-gateway/recipe-suggestion-context.test.ts src/features/recipes/data/recipe-suggestion-gateway.test.ts src/features/recipes/data/use-recipe-suggestions.test.ts`.
    - **Unverändert:** `recipe_suggestion.v1`, `fam-y918`, deren Route, Shapes, Validatoren, Tests und Logik.

  - [ ]* 10.3 Property-Test für **Property 7: Capability-Ergebnisse überschreiten weder Zweck- noch Mutationsgrenze** schreiben
    - **Dateien/Module:** `src/features/ai-assistant/capability-results.property.test.ts`.
    - **Aktion:** Mindestens 100 Ergebnisse für Notes, Swaps, Nutrition, Shopping, Receipts, Discover, Reminders und die vier Medienfunktionen gegen Zweck, Contract, Review, Estimate, Mode, Origin, Permission, Generated-Label, sichtbaren Text und Apply-Owner prüfen.
    - **Akzeptanz:** Jede Capability bleibt bei ihrem eigenen Zweck und Vertrag; fehlende Provider-/Output-Verträge liefern unavailable; kein Ergebnis mutiert direkt; ein fehlender Apply-Owner hält das Ergebnis read-only.
    - **Requirements:** 7.1-7.13.
    - **Design-Anker:** Correctness Property 7 und Capability-Übergänge 14.
    - **Abhängigkeiten:** 7.7, 8.9, 9.5.
    - **Prüfung:** `bun run test src/features/ai-assistant/capability-results.property.test.ts`.
    - **Unverändert:** vorhandene Domain Apply-Owner und alle bestehenden Legacy Contracts.

  - [ ]* 10.4 Property-Test für **Property 12: Bestehende Rezeptvorschläge bleiben außerhalb des neuen Vertragsraums** schreiben
    - **Dateien/Module:** `supabase/functions/ai-gateway/legacy-contract-isolation.property.test.ts`.
    - **Aktion:** Mindestens 100 neue Capability- und Legacy-Vertragsdefinitionen vergleichen und prüfen, dass neue Namespaces eigene Namen/Versionen verwenden und keine Legacy-Route, Shape oder Validatorreferenz als allgemeines Envelope verändert wird.
    - **Akzeptanz:** Kein neuer Vertrag kann `recipe_suggestion.v1` ersetzen, erweitern oder als allgemeine Mutation-/Response-Basis verwenden.
    - **Requirements:** 11.1, 11.3-11.6.
    - **Design-Anker:** Correctness Property 12 und Bestands-/Kompatibilitätsregeln 3.
    - **Abhängigkeiten:** 10.2, 1.1.
    - **Prüfung:** `bun run test:functions -- legacy-contract-isolation.property.test.ts`.
    - **Unverändert:** `recipe_suggestion.v1`, `fam-y918` und alle vorhandenen Legacy-Tests.

  - [ ] 10.5 Finaler Checkpoint: fokussierte Qualitätsgates ausführen
    - **Aktion:** Die Pflicht-Regressionen und die gewählten optionalen Nachweise aus den vorherigen Phasen gezielt ausführen. Danach `bun run typecheck`, `bun run check:functions`, `bun run check` und `git diff --check` starten.
    - **Akzeptanz:** Alle geänderten Coding-/Testflächen sind typisiert und formatiert; die Tests decken Consent, Scope, Tracking-/Kind-Tracking-Grenze, Provider/Credits/Refunds/Usage, 13 Capabilities, Online-only/Retention, bestehende Apply-Owner und Legacy-Isolation ab; keine neue Basis oder ausgeschlossene Capability-ID ist im Ergebnis enthalten.
    - **Requirements:** 1.1-1.7, 2.1-2.6, 3.1-3.10, 4.1-4.9, 5.1-5.9, 6.1-6.8, 7.1-7.13, 8.1-8.9, 9.1-9.10, 10.1-10.9, 11.1-11.6.
    - **Design-Anker:** Testing Strategy 26-28, Nicht-property-basierte Schutztests.
    - **Abhängigkeiten:** 10.1, 10.2, 10.3, 10.4.
    - **Prüfung:** nur gezielte `bun run test <betroffene-testdatei>`, `bun run test:functions -- <betroffene-function-testdatei>`, `bun run test:db <betroffener-test>`, danach `bun run typecheck`, `bun run check:functions`, `bun run check` und `git diff --check`.
    - **Unverändert:** alle bestehenden Legacy-, Apply-, Storage-, RLS-, Provider-, Credit-, Refund- und Usage-Verträge.

## Notes

- Die Tasks enthalten keine Implementierung. Jede spätere Umsetzung bleibt an den in den Tasks genannten vorhandenen Ownern.
- Ein neuer Proposal-Typ ohne passenden Domain Apply-Owner bleibt read-only und erhält keinen generischen AI-Mutationspfad.
- Neue externe Modell-, Quellen- und Medienvorgänge bleiben online-only. Connectivity-Rückkehr startet nichts automatisch.
- Consent speichert nur Rahmenmetadaten. Aktuelle Werte aus `intolerances` und `dislikedFoods` werden requestbezogen aus dem eigenen Account projiziert und nicht im Consent Record abgelegt.
- Household-Mitglieder werden nicht aus bestehenden Food-Rule-Prüfungen entfernt. Eine persönliche Assistant-Freigabe ändert keine Household- oder RLS-Rechte.
- Schemaänderungen erfolgen später ausschließlich über deklarative Schema-Dateien, `bun run db:diff`, lokale DB-Prüfung und `bun run db:types`. `src/lib/database.types.ts` bleibt Generatorausgabe.
- Pflicht- und optionale Tests sind im Projektformat direkt an der jeweiligen Implementierung markiert. Property-Tests verwenden mindestens 100 lokale Fälle und simulieren keine externen Provider hundertfach.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3", "2.4"] },
    { "id": 4, "tasks": ["2.5", "2.6", "2.7", "2.8"] },
    { "id": 5, "tasks": ["2.9"] },
    { "id": 6, "tasks": ["3.1"] },
    { "id": 7, "tasks": ["3.2", "3.3"] },
    { "id": 8, "tasks": ["3.4"] },
    { "id": 9, "tasks": ["4.1"] },
    { "id": 10, "tasks": ["4.2", "4.3"] },
    { "id": 11, "tasks": ["4.4"] },
    { "id": 12, "tasks": ["5.1"] },
    { "id": 13, "tasks": ["5.2", "5.3"] },
    { "id": 14, "tasks": ["5.4"] },
    { "id": 15, "tasks": ["6.1"] },
    { "id": 16, "tasks": ["6.2"] },
    { "id": 17, "tasks": ["6.3"] },
    { "id": 18, "tasks": ["6.4"] },
    { "id": 19, "tasks": ["6.5"] },
    { "id": 20, "tasks": ["6.6"] },
    { "id": 21, "tasks": ["6.7"] },
    { "id": 22, "tasks": ["6.8"] },
    { "id": 23, "tasks": ["6.9"] },
    { "id": 24, "tasks": ["7.1"] },
    { "id": 25, "tasks": ["7.2", "7.3"] },
    { "id": 26, "tasks": ["7.4"] },
    { "id": 27, "tasks": ["7.5"] },
    { "id": 28, "tasks": ["7.6"] },
    { "id": 29, "tasks": ["7.7"] },
    { "id": 30, "tasks": ["8.1"] },
    { "id": 31, "tasks": ["8.2", "8.3"] },
    { "id": 32, "tasks": ["8.4", "8.5"] },
    { "id": 33, "tasks": ["8.6", "8.7"] },
    { "id": 34, "tasks": ["8.8"] },
    { "id": 35, "tasks": ["8.9"] },
    { "id": 36, "tasks": ["9.1"] },
    { "id": 37, "tasks": ["9.2", "9.3", "9.4"] },
    { "id": 38, "tasks": ["9.5"] },
    { "id": 39, "tasks": ["10.1", "10.2"] },
    { "id": 40, "tasks": ["10.3", "10.4"] },
    { "id": 41, "tasks": ["10.5"] }
  ]
}
```
