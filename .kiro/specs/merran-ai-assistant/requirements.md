# Requirements Document

## Introduction

Diese überarbeitete Spezifikation korrigiert den Requirements-Stand für
`merran-ai-assistant` nach einer vollständigen read-only Ist-Analyse. Sie ist
eine Korrektur des bestehenden Dokuments und kein Neubauplan. Die bestehende
fam-AI-Basis bleibt der Ausgangspunkt. Nur nachgewiesene Lücken oder
unvermeidbare additive Ergänzungen gehören in spätere Design- und Task-Phasen.

Das langfristige Produktziel übernimmt die fachlich passenden Merran-Aufgaben
für fam: `assistant`, `import`, `notes`, `swaps`, `nutrition`, `shopping`,
`receipts`, `discover` und `reminders`. Hinzu kommen die passenden
Medienfunktionen `image-generation`, `speech-to-text`, `text-to-speech` und
`media-processing`. Das frühere zusätzliche Capability-Element ist vollständig
aus diesem Dokument ausgeschlossen. Es erhält keinen Eintrag, Vertrag, keine
UI, keine Implementierung und keinen späteren Task.

Die Spezifikation unterscheidet ausdrücklich zwischen bestehend, teilweise
vorhanden und fehlend. Bestehende Flächen werden bewahrt und durch gezielte
Regressionstests geschützt. Teilweise vorhandene Flächen werden nur um die
belegte Lücke ergänzt. Fehlende Flächen dürfen als additive Capability auf
vorhandenen Haushalts-, Storage-, Provider-, Billing- und UI-Grenzen aufbauen.

Für externe Modell- und Medienverarbeitung gilt ein klarer persönlicher
Datenrahmen. Eine einmalige Freigabe kann ausschließlich eigene
Unverträglichkeiten sowie eigene persönliche Abneigungen oder Dinge, die der
Account nicht mag, umfassen. Tracking-Daten, Kind-Tracking und daraus
abgeleitete Werte gehören nicht in externe Modellaufrufe. Eine neue Freigabe
ist nur erforderlich, wenn sich Datenumfang, Zweck oder Anbieter ändern. Eine
Bestätigung vor jedem einzelnen Modellaufruf gehört nicht zum Zielvertrag.

Offline dürfen bestehende lokale Ergebnisse und Eingaben nach den vorhandenen
Storage-Regeln angezeigt werden. Neue externe Modell- oder Medienverarbeitung
bleibt online-only und erhält keine neue AI-Outbox. RevenueCat, Credits,
Refunds, Provider und Usage Logging werden wiederverwendet und nur
rückwärtskompatibel um neue Capability-Metadaten erweitert.

## Glossary

- **Fam AI System**: Der bestehende und additiv erweiterte fam-AI-Bereich mit
  Mobile Assistant, `ai-gateway`, Import, Vorschlägen und Medienfunktionen.
- **Existing Fam AI Basis**: Die bereits vorhandene Mobile-, Gateway-,
  Storage-, Provider-, Credit-, Usage- und Apply-Infrastruktur, die für diese
  Spec erhalten bleibt.
- **Mobile Assistant**: Die vorhandene mobile Assistant-Oberfläche mit Route,
  Thread-Anzeige, Kontextauswahl, Anhängen und Proposal-Review.
- **AI Gateway**: Die bestehende Supabase Edge Function `ai-gateway` als
  kontrollierte serverseitige Schnittstelle zwischen Mobile Client, fam-Daten
  und Providern.
- **Capability Inventory**: Die verbindliche Liste der für diese Spec
  zugelassenen Capability-IDs.
- **Capability Status**: Der Ist-Zustand `bestehend`, `teilweise vorhanden`
  oder `fehlend`.
- **Merran-Aufgabe**: Eine fachliche Aufgabe aus dem geprüften Merran-Umfang,
  die in dieser Spec durch eine eigene Capability-ID repräsentiert wird.
- **Bestehend**: Ein produktiver Pfad und fokussierte Nachweise decken den
  beschriebenen Umfang bereits ab. Spätere Tasks dürfen nur Regression,
  Kompatibilität oder notwendige Metadaten ergänzen.
- **Teilweise vorhanden**: Mindestens eine produktive Fläche existiert, aber
  ein abgegrenzter Teil des Zielvertrags fehlt. Spätere Tasks dürfen nur diese
  Lücke additiv schließen.
- **Fehlend**: Für den beschriebenen Capability-Zweck existiert noch kein
  produktiver fam-Pfad. Eine Ergänzung muss vorhandene Domänen- und
  Infrastruktur-Owner wiederverwenden.
- **Additive Ergänzung**: Eine neue Capability, ein Adapter, ein Vertrag, ein
  Test oder Metadatum, das bestehende Pfade und Verträge nicht ersetzt,
  umdeutet oder still migriert.
- **Household Data**: Geteilte Daten des aktiven Haushalts, insbesondere
  Bestand, Einkaufsliste, Rezepte, Wochenpläne, Belege und Receipt Items.
- **Personal Preference Data**: Ausschließlich die eigenen Unverträglichkeiten
  und eigenen persönlichen Abneigungen beziehungsweise Angaben zu Dingen, die
  der anfragende Account nicht mag.
- **Tracking Data**: Private Kalorien-, Gewichts-, Mahlzeitenprotokoll-,
  Medikamenten-, Symptom-, Vitalwert-, Fasten-, Workout-, Ziel- und
  `tracking_method`-Daten sowie daraus abgeleitete Werte. Kind-Tracking gehört
  ebenfalls zu Tracking Data.
- **Household Food-Rule Snapshot**: Der bestehende serverseitige Snapshot aus
  den Lebensmittelregeln des Haushalts. Der Snapshot ist eine
  Lebensmittelregel-Prüfung und nicht automatisch Tracking Data oder ein neuer
  persönlicher Assistant-Datenvertrag.
- **Data Scope**: Die für einen External Model Call ausdrücklich erlaubte
  Zusammenstellung aus Household Data, Page Context, Attachment und
  Personal Preference Data.
- **Page Context**: Ein ausdrücklich ausgewählter Bezug zu einer validierten
  Rezept-, Meal-Plan-, Import-, Receipt-, Bestands- oder Einkaufsseite.
- **Attachment**: Eine für den aktuellen Zweck ausgewählte und validierte
  Bild-, PDF-, Audio- oder Video-Datei.
- **Assistant Thread**: Ein accountbezogener lokaler Verlauf aus Assistant-
  Nachrichten, Metadaten und Proposal-Status.
- **Import Pipeline**: Der bestehende und additiv erweiterte Ablauf von Quelle
  über Import Draft und Review bis zum normalen Recipe-Apply Path.
- **Import Draft**: Ein noch nicht dauerhaft gespeicherter Entwurf mit Quelle,
  erkannten Feldern, Unsicherheiten, Status und Review-Informationen.
- **External Model Call**: Ein Aufruf, bei dem der AI Gateway Daten an einen
  externen Modell- oder Medienanbieter übermittelt.
- **Consent Frame**: Der einmalig freigegebene Rahmen aus Datenkategorien,
  Zweck, Anbieter und Vertragsversion. Der Consent Frame enthält keine
  aktuellen Präferenzwerte.
- **Consent Record**: Der accountbezogene Status des Consent Frame mit Account,
  Kategorien, Version, Zeitpunkt und Aktivstatus.
- **Proposal**: Eine versionierte, read-only Antwort mit betroffenen IDs,
  Quellen, Unsicherheiten und der Grundlage für einen getrennten Apply Path.
- **Apply Path**: Der bestehende domänenspezifische Pfad, der nach einer
  Nutzeraktion Berechtigung, Aktualität, Regeln, SQLite-Spiegel und Outbox
  erneut prüft.
- **Domain Owner**: Der bestehende Owner einer Haushaltsdomäne, der
  Berechtigung, Mutation, Sync, Outbox und Reverse State verantwortet.
- **Last Local Result**: Ein bereits lokal gespeichertes und validiertes
  Ergebnis, das offline read-only angezeigt werden darf.
- **Outbox**: Der bestehende lokale Synchronisationspfad für autorisierte
  Domänenmutationen. External Model Calls gehören nicht zur Outbox.
- **Provider**: Ein zugelassener externer Modell- oder Medienanbieter. Der
  aktuelle AI-Pfad verwendet OpenRouter und Groq.
- **AI Entitlement**: Das bestehende RevenueCat-basierte AI-Nutzungsrecht des
  aktiven Haushalts.
- **Credit Booking**: Die bestehende atomare Buchung eines AI-Credit-Gewichts
  gegen den RevenueCat-Subscriber.
- **Refund**: Die bestehende einmalige Rückgabe einer Credit Booking für einen
  Request ohne nutzbares Ergebnis.
- **Usage Event**: Ein serverseitiges, content-freies Nutzungsereignis mit
  Request-, Account-, Haushalt-, Provider-, Modell-, Skill- und
  Kostenmetadaten.
- **Usage Log**: Die bestehende serverseitige Sammlung der Usage Events.
- **Legacy Skill**: Ein bestehender Gateway-Vertrag wie `fam-assistant`,
  `fam-recipe-import`, `fam-cook-from-inventory` oder
  `fam-inventory-capture`, dessen bestehendes Verhalten erhalten bleibt.
- **Recipe Suggestion Contract**: Der unveränderte versionierte Vertrag
  `recipe_suggestion.v1` für den bestehenden Rezeptvorschlagspfad.
- **fam-y918**: Die laufende oder bereits geprüfte Arbeit am bestehenden
  Recipe Suggestion Contract, einschließlich Route, Datenverträgen, Tests und
  Logik.

## Repository Evidence

Die Ist-/Lückenbewertung stützt sich auf folgende read-only geprüfte Quellen:

- `docs/features/ai-und-assistant-produktziel.md` beschreibt den bestätigten
  langfristigen Produktumfang und weist ausdrücklich darauf hin, dass der
  Umfang in fam noch nicht vollständig existiert.
- `bd show fam-d5rn` dokumentiert den offenen Gesamtauftrag. Die Notizen halten
  fest, dass die vorhandene Assistant-, Import-, Groq- und
  Rezeptvorschlagsarbeit getrennt bleibt und der vollständige Zielumfang noch
  offen ist.
- `src/app/assistant.tsx` und
  `src/features/ai-assistant/screens/assistant-screen.tsx` belegen den
  bestehenden `fam-assistant`-Pfad und die vorhandene Assistant-Oberfläche.
  Der Screen trennt bereits den einmaligen Kochmodus über den bestehenden
  `/recipe/cook`-Einstieg vom dauerhaften Speichern über den vorhandenen
  Recipe-Apply-Owner; diese Swap-Modi sind keine neue Lücke.
- `src/features/ai-assistant/types.ts` und
  `src/features/ai-assistant/data/assistant-api.ts` belegen versionierte
  Assistant-Antworten, Recipe- und Meal-Plan-Kontext, read-only Tool-Namen,
  Vorschläge und die Antwortvalidierung.
- `src/features/ai-assistant/data/assistant-storage.ts` belegt lokale,
  accountbezogene Threads im verschlüsselten Storage und die bestehende
  Begrenzung auf 20 Threads.
- `src/features/ai-assistant/data/assistant-attachments.ts` belegt die
  bestehende Prüfung von Dateiexistenz, MIME-Typen, höchstens fünf Anhängen,
  Einzelgrenze und 8-MB-Gesamtgrenze.
- `src/features/ai-assistant/data/apply-meal-plan-proposal.ts`,
  `apply-ingredient-swap-proposal.ts` und
  `apply-shopping-list-proposal.ts` belegen getrennte Apply Paths mit erneuter
  Prüfung und lokalen SQLite-/Outbox-Schritten.
- `supabase/functions/ai-gateway/handler.ts` belegt die bestehenden Legacy
  Skills `fam-assistant`, `fam-recipe-import`, `fam-cook-from-inventory`,
  `fam-inventory-capture`, Credit-Status, Model-Test und
  Proposal-Validation. `fam-recipe-import` akzeptiert aktuell Text, URL, Bild,
  PDF und Video.
- `supabase/functions/ai-gateway/providers.ts` belegt den bestehenden
  OpenRouter-/Groq-Providerpfad und einen Groq-Transkriptionsbaustein. Eine
  Bildgenerierungs-API oder ein entsprechender Providervertrag ist dort nicht
  vorhanden; `image-generation` bleibt deshalb bis zu einer separaten
  Freigabe unavailable.
- `supabase/schemas/03_households.sql` und der bestehende Gateway-Code belegen
  RevenueCat-Entitlement, Credit-Buchung und Refund-Grenzen.
- `supabase/schemas/28_ai_usage.sql` belegt, dass das aktuelle Usage-Schema
  nur die vorhandenen Legacy Skills als `skill` kennt und content-freie
  Provider-Metadaten speichert.
- `profile_food_rules` und der bestehende serverseitige
  `Household Food-Rule Snapshot` sind Lebensmittelregel- und
  Sicherheitsprüfungen. Diese Quellen werden in dieser Spec nicht ohne
  fachliche Analyse in Tracking Data oder einen neuen persönlichen
  Datenvertrag umgedeutet.
- `src/features/ocr/` sowie die Receipt- und Review-Pfade belegen eine
  vorhandene Receipt-/OCR-Basis. Diese Basis ist noch kein AI-Receipt-Proposal-
  Vertrag.
- `src/features/recipes/hooks/use-cooking-mode-voice.ts`, die vorhandenen
  Speech-Permissions und `providers.ts` belegen einzelne Sprachbausteine,
  aber keine vollständige Assistant-Sprach-Capability.
- `docs/architecture/DATENSCHUTZ.md` enthält bereits den aktuellen
  OpenRouter-/Groq-Hinweis, beschreibt aber noch nicht den einmaligen Consent-
  Rahmen, die zulässigen persönlichen Kategorien, Aufbewahrung und Widerruf.
  Die Privacy-Verknüpfung ist deshalb eine belegte additive Lücke und kein
  neuer Datenschutz- oder Storage-Pfad.

## Ist-/Lückenmodell

| Capability-ID | Status | Bestehende Grundlage | Verbleibende Lücke und zulässige Ergänzung |
|---|---|---|---|
| `assistant` | teilweise vorhanden | `fam-assistant`, Assistant-Screen, lokale Account-Threads, Recipe-/Meal-Plan-Kontext, Anhänge, read-only Tools und getrennte Apply Paths | Einrichtungsfreigabe für Consent Frame, additive Capability-/Vertragsmetadaten und die fehlenden Scope-/Provider-Grenzen ergänzen. Bestehende UI, Threads, API und Apply Paths bleiben erhalten. |
| `import` | teilweise vorhanden | `fam-recipe-import` mit Text, URL, Bild, PDF und Video, bestehende Import-Oberfläche, strukturierte Quelle und validierter Draft | Fehlende einheitliche Draft-/Quellen-/Statusgrenzen, Capability-Metadaten und additive Review-Übergänge ergänzen. Kein zweiter Importpfad. |
| `notes` | fehlend | Bestehende Recipe-Domäne und Recipe-Apply-Owner | Read-only Notizvorschlag und sichtbarer Apply Path ergänzen; bestehende Recipe-Mutation bleibt Owner. |
| `swaps` | bestehend | Assistant-Tool, `ingredient_swap_proposal.v1`, serverseitige Validierung, die beiden bestehenden Assistant-Aktionen „Für dieses Mal“ und „Speichern“ sowie der lokale Recipe-Apply Path sind vorhanden. | Nur additive Capability-/Contract-/Usage-Metadaten und fokussierte Regression; kein neuer Swap-Vertrag und kein neuer Apply Path. |
| `nutrition` | teilweise vorhanden | Rezept-/Produktdaten und bestehende private Nutrition-Tracking-Domäne | Read-only Nährwertschätzung mit Kennzeichnung und ohne Tracking-Schreibzugriff ergänzen. Bestehende Tracking-Daten bleiben außerhalb des AI-Scope. |
| `shopping` | teilweise vorhanden | Assistant-Shopping-Proposals, `shopping_list_proposal.v1`, Shopping-Merge und Idempotenz-Apply | Capability-spezifische Scope-/Usage-Metadaten und verbleibende Review-Grenzen ergänzen; die bestehende Shopping-Logik bleibt Owner. |
| `receipts` | teilweise vorhanden | Receipt-OCR, Receipt-Speicher, Review und bestehende Receipt-/Inventory-Domänenpfade | AI-gestützte Receipt-Erkennung als reviewbares Proposal ergänzen; kein automatisches Verbuchen und kein Ersatz des OCR-/Review-Pfads. |
| `discover` | teilweise vorhanden | Rezeptkatalog und `search_recipes` als bestehendes read-only Assistant-Tool | Externe Suche, Quellenherkunft und Übergang in den bestehenden Import-Draft ergänzen. |
| `reminders` | teilweise vorhanden | Bestehende lokale Notification- und Reminder-Infrastruktur | AI-spezifischen Trigger-, Zeitpunkt-, Benachrichtigungs- und Datenrahmen ergänzen; keine ungefragten Modellaufrufe. |
| `image-generation` | fehlend | Medien- und Storage-Bausteine existieren, aber der aktuelle `ai-gateway`-/OpenRouter-/Groq-Pfad enthält keine belegte Bildgenerierungsfähigkeit. | Nur capability-spezifischer Contract und `capability_unavailable`-Guard bis eine separate Provider-Fähigkeit ausdrücklich freigegeben und belegt ist; keine neue Providerbasis und kein Bildaufruf in dieser Spec. |
| `speech-to-text` | teilweise vorhanden | Native Speech-Permissions, Entwicklungsbausteine und Groq-Transkription | Eine produktive, ausdrücklich gestartete Assistant-/Import-Nutzung mit sichtbarer Transkriptprüfung ergänzen. |
| `text-to-speech` | teilweise vorhanden | `expo-speech` im Cooking-Mode und vorhandene Vorleselogik | Sichtbares Vorlesen von Assistant-Antworten oder Kochschritten ergänzen, ohne verborgene Modell- oder Hintergrundverarbeitung. |
| `media-processing` | teilweise vorhanden | Bild-/PDF-/Video-Eingänge, Assistant-Anhänge, Import und OCR | Capability-spezifische Zweck-, Status-, Fehler- und Aufbewahrungsgrenzen ergänzen, ohne eine allgemeine Medienjob-Outbox einzuführen. |

Die Statuswerte sind fachliche Bestandsaussagen, keine Freigabe für einen
Umbau. `bestehend` bedeutet Regression und Kompatibilität. `teilweise
vorhanden` bedeutet ausschließlich die beschriebene Lücke. `fehlend` bedeutet
eine neue, begrenzte Capability auf bestehenden Ownern.

## Requirements

### Requirement 1: Capability Inventory und Statusvertrag

**User Story:** Als Maintainer möchte ich den korrigierten Umfang und den
Implementierungsstand eindeutig erkennen, damit spätere Arbeit keine
Bestandsflächen neu baut oder ausgeschlossene Arbeit einführt.

#### Acceptance Criteria

1. THE Capability Inventory SHALL contain exactly these thirteen IDs: `assistant`, `import`, `notes`, `swaps`, `nutrition`, `shopping`, `receipts`, `discover`, `reminders`, `image-generation`, `speech-to-text`, `text-to-speech` and `media-processing`.
2. THE Capability Inventory SHALL assign exactly one Capability Status and one evidence reference to every listed ID.
3. WHEN a Capability Status is `bestehend`, THE Fam AI System SHALL mark the corresponding implementation scope as regression, compatibility or required metadata only.
4. WHEN a Capability Status is `teilweise vorhanden`, THE Fam AI System SHALL limit later additions to the documented gap in the Ist-/Lückenmodell.
5. WHEN a Capability Status is `fehlend`, THE Fam AI System SHALL require a capability-specific contract, owner, data scope, online rule, mutation rule and focused test surface before product exposure.
6. IF a later Design Document or Task Document contains an ID outside the Capability Inventory, THEN THE Fam AI System SHALL reject the ID from this feature scope.
7. IF a later task changes an existing path without addressing a documented gap, THEN THE Fam AI System SHALL classify the task as out of scope for this feature.

### Requirement 2: Erhalt der bestehenden fam-AI-Basis

**User Story:** Als Maintainer möchte ich die vorhandene fam-AI-Basis weiterverwenden, damit die Korrektur keine parallele Assistant-Architektur und keine stille Migration erzeugt.

#### Acceptance Criteria

1. THE Existing Fam AI Basis SHALL remain the starting point for every Capability in the Capability Inventory.
2. THE Fam AI System SHALL preserve the existing `fam-assistant` route, Assistant-Screen, account-local threads, Recipe-/Meal-Plan-Kontext, existing read-only tools and existing Proposal Apply Paths.
3. WHEN an existing path already satisfies a part of a Capability contract, THE Fam AI System SHALL extend the path additively instead of replacing the path.
4. WHEN a later implementation needs a new server entry point, THE Fam AI System SHALL use the existing `ai-gateway` boundary unless a separate approved specification explicitly establishes another boundary.
5. IF a proposed change introduces a parallel Gateway, a parallel general Assistant UI or a new general chat foundation, THEN THE Fam AI System SHALL reject the change from this feature scope.
6. IF an existing implementation is changed only to conform to a new architecture, THEN THE Fam AI System SHALL reject the change from this feature scope.

### Requirement 3: Einmaliger Consent Frame und transparente Einrichtung

**User Story:** Als Account möchte ich einmalig einen verständlichen Daten-, Zweck- und Anbieterrahmen freigeben, damit externe Verarbeitung nachvollziehbar bleibt, ohne jeden Modellaufruf einzeln bestätigen zu müssen.

#### Acceptance Criteria

1. THE Consent Settings SHALL offer only `intolerances`, `dislikedFoods` and an explicit empty selection as personal categories.
2. WHEN an Account opens the AI setup, THE Mobile Assistant SHALL show a short explanation of the allowed data, purpose and Provider frame.
3. THE Privacy Policy SHALL contain the complete explanation of allowed data, purpose, Provider frame, retention and revocation.
4. THE Settings SHALL keep the current Consent Frame, active status and explanation reachable after setup, and the setup plus Settings privacy entry SHALL expose a reachable link to the complete AI explanation in the Privacy Policy.
5. WHEN an Account saves a Consent Frame, THE Fam AI System SHALL store the Account ID, selected categories, purpose version, Provider frame, contract version, timestamp and active status.
6. THE Consent Record SHALL exclude current preference values, free-form personal content, Tracking Data and Child Profile Data.
7. WHEN a Consent Frame remains unchanged, THE AI Gateway SHALL permit an External Model Call without a new per-call confirmation.
8. IF the Data Scope, purpose or Provider changes, THEN THE Fam AI System SHALL require a new explicit Consent Frame before the changed External Model Call.
9. WHEN an Account revokes the Consent Frame, THE AI Gateway SHALL stop subsequent External Model Calls until a new Consent Frame is saved.
10. IF an Account re-enables a revoked Consent Frame, THEN THE Fam AI System SHALL require a new explicit setup action and SHALL not restore the previous active state implicitly.

### Requirement 4: Datenbesitz, Haushaltszugriff und Lebensmittelregeln

**User Story:** Als Haushaltsmitglied möchte ich den Assistant im Rahmen der bestehenden Haushaltsregeln nutzen, ohne dass eine persönliche AI-Freigabe neue Rechte erzeugt oder andere Mitglieder künstlich aus der Lebensmittelregel-Prüfung entfernt.

#### Acceptance Criteria

1. WHEN the AI Gateway reads Household Data, THE AI Gateway SHALL use the authenticated session, active Household membership and existing RLS rules.
2. THE Consent Frame SHALL not grant a Household Member access to private data owned by another Account.
3. THE Consent Frame SHALL not modify Household membership, Household roles or RLS policies.
4. THE Fam AI System SHALL classify `profile_food_rules` and the existing Household Food-Rule Snapshot as food-rule sources rather than Tracking Data.
5. WHEN a Household capability evaluates food-rule safety, THE AI Gateway SHALL preserve the existing Household Food-Rule Snapshot coverage and member handling.
6. WHEN a new External Model Call uses Personal Preference Data, THE AI Gateway SHALL use only current values owned by the requesting Account and selected in the active Consent Frame.
7. WHEN a Household Food-Rule Snapshot is needed for server-side validation, THE AI Gateway SHALL use the snapshot for validation without automatically converting the snapshot into a new personal Provider payload.
8. IF a new Capability changes the meaning, owner or visibility of a food-rule source, THEN THE Fam AI System SHALL record the change before implementation.
9. WHEN a Household Member applies a Proposal, THE Apply Path SHALL use the affected Household domain's existing authorization and reverse-state rules.

### Requirement 5: Bestehender Assistant, Kontext und Vorschläge

**User Story:** Als Account möchte ich den vorhandenen Assistant weiterverwenden und Vorschläge sicher prüfen, damit die Korrektur keinen neuen Chatpfad voraussetzt.

#### Acceptance Criteria

1. WHEN an Account starts an Assistant request through the existing route, THE Mobile Assistant SHALL continue to use the existing account-local thread and response flow.
2. WHEN a Recipe or Meal-Plan Page Context is selected, THE Assistant SHALL preserve the existing ownership and scope validation before context data reaches the Provider.
3. WHEN an Account selects an Attachment, THE Mobile Assistant SHALL preserve the existing file, MIME, count and encoded-size validation.
4. THE Mobile Assistant SHALL preserve the existing limit of at most five Assistant Attachments and 8 MB encoded total size.
5. WHEN the Assistant receives a Proposal, THE Mobile Assistant SHALL render the Proposal read-only until the Account chooses the existing Apply Path.
6. THE AI Gateway SHALL perform no Household or Tracking mutation during an External Model Call.
7. WHEN an Apply Path is selected, THE Domain Owner SHALL revalidate permissions, current versions, food-rule evidence and conflicts before mutation.
8. IF current data or authorization differs from a Proposal snapshot, THEN THE Apply Path SHALL reject the Proposal without changing domain state.
9. WHEN a new Assistant response contract is needed, THE Fam AI System SHALL add a separately named and versioned contract without replacing the current Assistant response contract.

### Requirement 6: Bestehender Rezeptimport und passende Medienverarbeitung

**User Story:** Als Account möchte ich die vorhandenen Rezeptimport-Eingänge weiterverwenden, damit Medien- und Import-Lücken ohne zweiten Importpfad geschlossen werden.

#### Acceptance Criteria

1. THE Import Pipeline SHALL preserve the existing `fam-recipe-import` inputs for text, URL, image, PDF and video.
2. WHEN a source contains sufficient structured recipe data, THE Import Pipeline SHALL prefer the structured source before an External Model Call.
3. WHEN a source requires external model or media processing, THE Import Pipeline SHALL apply the active Entitlement, Credit, Consent Frame and Provider rules before transmission.
4. WHEN an import produces a result, THE Import Pipeline SHALL preserve source type, source reference, extracted fields, confidence, warnings and review status.
5. WHEN an Account reviews an Import Draft, THE Import Pipeline SHALL require an explicit save action before creating or changing a Household Recipe.
6. IF an Import Draft is not explicitly saved, THEN THE Import Pipeline SHALL leave Household Recipes unchanged.
7. WHILE the device is offline, THE Import Pipeline SHALL display existing local results or input state without starting new external source, model or media processing.
8. IF a new media flow has no declared purpose, input type, retention period and error state, THEN THE Fam AI System SHALL expose the flow as unavailable.

### Requirement 7: Capability-spezifischer Restumfang

**User Story:** Als Account möchte ich die fehlenden und teilweise vorhandenen
Merran-Funktionen einzeln und nachvollziehbar nutzen, ohne dass eine Capability
die Daten- oder Mutationsgrenze einer anderen Capability übernimmt.

#### Acceptance Criteria

1. WHEN an Account submits a cooking note for a Recipe, THE Fam AI System SHALL return a reviewable Recipe note Proposal without silently changing the Recipe.
2. WHEN an Account requests an ingredient swap, THE Fam AI System SHALL distinguish one-cooking use from permanent Recipe storage before an Apply Path starts.
3. WHEN `nutrition` returns a value, THE Fam AI System SHALL label the value as an estimate and SHALL not write a Nutrition Tracking record.
4. WHEN `shopping` returns an item or quantity, THE Fam AI System SHALL return a reviewable Shopping List Proposal and SHALL use the existing Shopping List Apply Path for persistence.
5. WHEN `receipts` processes a Receipt image or PDF, THE Fam AI System SHALL return a reviewable Receipt Proposal before any Receipt, Inventory or Shopping History mutation.
6. WHEN `discover` returns an external recipe source, THE Fam AI System SHALL show source and origin before creating an Import Draft.
7. WHEN `reminders` is enabled, THE Fam AI System SHALL require an explicit trigger, timing, notification permission and data scope before scheduling a reminder.
8. WHEN `image-generation` produces an image, THE Fam AI System SHALL label the image as generated and SHALL require an explicit attach or save action.
9. WHEN `speech-to-text` processes an audio input, THE Fam AI System SHALL require an explicit user action and SHALL show the transcript before further Capability processing.
10. WHEN `text-to-speech` reads an Assistant response or cooking step, THE Fam AI System SHALL read only text already visible to the Account after an explicit action.
11. WHEN `media-processing` handles an image, PDF or video, THE Fam AI System SHALL limit processing to the selected Import, Assistant or Receipt purpose.
12. IF a Capability lacks a matching Provider ability or output contract, THEN THE Fam AI System SHALL report the Capability as unavailable without making an unsupported External Model Call.
13. IF a Proposal is not supported by an existing domain Apply Path, THEN THE Fam AI System SHALL keep the Proposal read-only until a separate domain contract exists.

### Requirement 8: Online-only, lokaler Zustand und Offline-Verhalten

**User Story:** Als Account möchte ich vorhandene lokale Ergebnisse offline sehen, ohne dass die App AI-Aufträge nachholt oder neue private Daten puffert.

#### Acceptance Criteria

1. WHILE the device is offline, THE Fam AI System SHALL display valid Last Local Results and existing local inputs read-only according to the existing Storage rules.
2. WHILE the device is offline, THE Fam AI System SHALL not start an External Model Call, external media operation, external source fetch or server-side AI job.
3. WHILE the device is offline, THE Fam AI System SHALL not place a new AI or media operation into an Outbox or retry queue.
4. WHEN connectivity returns, THE Fam AI System SHALL require a new explicit user action before starting external processing.
5. THE Mobile Assistant SHALL continue to store existing Assistant Threads in the encrypted per-account storage boundary.
6. THE Mobile Assistant SHALL preserve the existing maximum of 20 locally stored Assistant Threads.
7. THE Mobile Assistant SHALL persist Attachment metadata only when the Account keeps the current conversation and SHALL not persist raw Attachment bytes in the Thread.
8. WHEN an Account switches identity or Household, THE Mobile Assistant SHALL clear active private and Household context before the next External Model Call.
9. IF a local result is expired or invalid, THEN THE Mobile Assistant SHALL mark the result unavailable for Apply and SHALL require a new online run.

### Requirement 9: Provider-, RevenueCat-, Credit- und Usage-Vertrag

**User Story:** Als Maintainer möchte ich die vorhandene Provider- und Billing-Struktur wiederverwenden, damit neue Capabilities keine parallele Kosten- oder Nutzungsarchitektur erzeugen.

#### Acceptance Criteria

1. THE Fam AI System SHALL use the existing `ai-gateway` and existing OpenRouter-/Groq Provider path for new external Capability calls.
2. THE Mobile Assistant SHALL not contain Provider secrets, Supabase Secret API Keys or RevenueCat secret API keys.
3. WHEN a new Capability requests an External Model Call, THE AI Gateway SHALL reuse the existing RevenueCat AI Entitlement and Credit Booking rules.
4. WHEN a new Capability produces no usable result after a Credit Booking, THE AI Gateway SHALL reuse the existing one-time Refund rule for the request.
5. WHEN a structured source completes without an External Model Call, THE AI Gateway SHALL not book AI credits for the source.
6. WHEN a new Capability needs a Usage Event, THE Usage Event SHALL retain the existing content-free fields and SHALL add Capability ID or contract metadata only additively.
7. THE Usage Log SHALL preserve existing Legacy Skill values, SHALL record new Capability IDs only in nullable additive metadata, and SHALL preserve the existing `fam-cook-from-inventory`/`recipe_suggestion.v1` behavior without using `recipe_suggestion.v1` as a new general usage or response envelope.
8. IF a new Capability requires a credit action or Usage field not covered by the existing contract, THEN THE Fam AI System SHALL preserve existing rows, fields and tests before acceptance.
9. IF a Provider, model or Capability is not configured for the declared contract, THEN THE AI Gateway SHALL return a stable unavailable error without silent Provider failover.
10. THE Fam AI System SHALL not introduce a new billing architecture, client-side credit counter or second Provider credential path.

### Requirement 10: Harte Daten- und Kind-Tracking-Grenze

**User Story:** Als datenschutzorientierter Account möchte ich sicher sein, dass private Tracking-Daten und Kind-Tracking keinen externen AI-Pfad erreichen.

#### Acceptance Criteria

1. THE Fam AI System SHALL exclude Tracking Data from every new Data Scope, Consent Frame, External Model Call, Usage Event, local Assistant result, Import Draft and error artifact.
2. THE Fam AI System SHALL not offer Tracking Data or Child Tracking as a Consent Settings category or Assistant context.
3. IF a request contains a Tracking Data field, tracking table identifier, tracking-origin Attachment or tracking-specific context flag, THEN THE AI Gateway SHALL reject the request before Credit Booking and Provider access.
4. THE AI Gateway SHALL not read adult calories, weights, meal logs, medications, symptoms, fasting, vital values, workouts, goals or `tracking_method` for a new Capability.
5. THE AI Gateway SHALL not read Child Profile Data or Child Tracking for an External Model Call, including when the requesting Account is Household manager or admin.
6. WHEN a safety check requires a personal value, THE AI Gateway SHALL use only the requesting Account's selected Personal Preference Data or the existing server-side Household Food-Rule Snapshot.
7. IF Tracking Data appears in free text, source text, metadata, transcript or Attachment content, THEN THE AI Gateway SHALL reject the current input without echoing, persisting or logging the detected content.
8. THE Fam AI System SHALL not derive Tracking Data from Household Data, Product Usage, Assistant history, estimates, Proposal applications, Usage Events or analytics events.
9. WHEN a Provider response contains Tracking Data or a tracking-derived value, THE AI Gateway SHALL discard the complete result before Mobile Response, Cache, Draft, Usage Event or error-artifact creation.

### Requirement 11: Unveränderte bestehende Verträge und Regression

**User Story:** Als Maintainer möchte ich laufende Rezeptvorschlagsarbeit und vorhandene Legacy Skills schützen, damit diese Korrektur keine bestehende fachliche Arbeit migriert.

#### Acceptance Criteria

1. THE Fam AI System SHALL keep `recipe_suggestion.v1` separate from every new Assistant, Import, Proposal and media contract.
2. THE Fam AI System SHALL leave the existing `recipe_suggestion.v1` route, request shape, response shape, validators, tests and `fam-y918` logic unchanged.
3. WHEN a new Capability resembles a recipe suggestion, THE Fam AI System SHALL use a separately named and versioned contract.
4. THE Fam AI System SHALL use `fam-y918` and `recipe_suggestion.v1` only as regression-protected existing behavior within this feature.
5. IF a later implementation needs to modify `fam-y918` or `recipe_suggestion.v1`, THEN THE Fam AI System SHALL require separate explicit approval and a separate specification.
6. WHEN new Capability tests are added, THE regression suite SHALL keep existing assertions and SHALL not skip or weaken the focused `fam-y918` and `recipe_suggestion.v1` tests.

## Hard Non-Goals and Scope Boundaries

- Keine neue Gateway-, Assistant- oder allgemeine Chatarchitektur.
- Kein Ersatz der bestehenden Assistant-UI, der `fam-assistant`-Route, der
  lokalen Account-Threads, der vorhandenen read-only Tools oder der getrennten
  Apply Paths.
- Keine Capability, kein Vertrag, keine UI, keine Implementierung und kein
  späterer Task für das ausdrücklich ausgeschlossene frühere Capability-
  Element.
- Keine Übermittlung, Anzeige, Auswahl, Einwilligung, Ableitung oder spätere
  Freischaltung von Tracking-Daten, Kind-Tracking oder daraus abgeleiteten
  Werten an externe Modelle.
- Keine künstliche Entfernung von Haushaltsmitgliedern aus der bestehenden
  Haushalts- oder Lebensmittelregel-Prüfung.
- Keine Änderung der bestehenden Household- oder RLS-Rechte durch eine
  Assistant-Freigabe.
- Keine Bestätigung vor jedem einzelnen Modellaufruf. Einrichtung und
  erneute Freigabe bei Änderung von Datenumfang, Zweck oder Anbieter genügen.
- Keine direkte Mutation durch Provider, Tool-Aufruf, Assistant-Nachricht,
  Importverarbeitung, Receipt-Erkennung, Reminder oder Medienverarbeitung.
- Keine Offline-Modellaufrufe, keine neue AI-Outbox und keine automatische
  Medien- oder Serverjob-Warteschlange.
- Keine neue Billing-Architektur und kein Ersatz der RevenueCat-, Credit-,
  Refund-, Provider- oder Usage-Struktur.
- Kein eingehender Share-Einstieg aus anderen Apps als zusätzlicher
  Importvertrag.
- Keine medizinische Diagnose, allergologische Garantie, verbindliche
  Lebensmittelsicherheitsbewertung oder automatische Nährwertwahrheit.

## Verification Expectations

Die spätere Design- und Implementierungsphase muss mindestens folgende
Nachweisflächen vorsehen:

- fokussierte Vertrags- und Registry-Tests für alle dreizehn Capability-IDs,
  Statuswerte, Output-Verträge, Scope-Grenzen und Unavailable-Zustände;
- Regressionstests für `fam-assistant`, Assistant-Screen, accountbezogene
  Threads, Attachments, Recipe-/Meal-Plan-Kontext, read-only Tools und alle
  bestehenden Apply Paths;
- Tests für Consent Frame, einmalige Einrichtung, Einstellungen, Anbieter-,
  Zweck- und Datenumfangänderungen sowie Widerruf ohne per-call-Bestätigung;
- Tests für Household-Mitgliedschaft, bestehende RLS-Regeln,
  Household Food-Rule Snapshot und getrennte Personal Preference Data;
- fokussierte Gateway-Tests für OpenRouter, Groq, Credits, Refunds,
  Capability-Metadaten und rückwärtskompatibles Usage Logging;
- Tests für Tracking- und Kind-Tracking-Ausschluss vor Providerzugriff,
  Credit-Buchung, Speicherung und Logging;
- Tests für Online-only-Verhalten, lokale Last-Results, verschlüsselten
  Account-Storage, 20-Thread-Grenze und fehlende AI-Outbox;
- Capability-spezifische Tests für Notes, Swaps, Nutrition, Shopping,
  Receipts, Discover, Reminders sowie die vier Medienfunktionen;
- unveränderte Regressionstests für `recipe_suggestion.v1` und `fam-y918`;
- gezielte Repository-Gates mit `bun run test <betroffene-testdatei>`,
  `bun run test:functions -- <betroffene-function-testdatei>`,
  `bun run test:db <betroffener-test>`, `bun run typecheck`,
  `bun run check:functions`, `bun run check` und `git diff --check`.

## Requirements Status

Diese Requirements dokumentieren den korrigierten Ist-/Lückenvertrag. Sie
autorisieren keine Implementierung, keine Schemaänderung, keine Migration,
keinen Provideraufruf, kein Hosted-Deployment und keine native
Laufzeitabnahme. Design- und Task-Phasen dürfen ausschließlich die hier
aufgeführten Capability-IDs und Statusgrenzen übernehmen und müssen die
bestehende fam-AI-Basis als Ausgangspunkt erhalten.
