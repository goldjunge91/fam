# Technical Design: merran-ai-assistant

## Overview

Dieses Dokument überarbeitet den bestehenden Entwurf ausschließlich anhand der
korrigierten `requirements.md`. Es ist kein Neubauplan. Die bestehende fam-AI-
Basis bleibt die einzige Ausgangsarchitektur; der Entwurf beschreibt zuerst
ihren belegten Bestand und danach nur additive Erweiterungspunkte für belegte
Lücken.

Die zugelassenen Capability-IDs sind exakt:

`assistant`, `import`, `notes`, `swaps`, `nutrition`, `shopping`, `receipts`,
`discover`, `reminders`, `image-generation`, `speech-to-text`,
`text-to-speech` und `media-processing`.

Es gibt keine zusätzliche Capability-ID. Der bestehende `fam-assistant`-
Gatewaypfad, der Assistant-Screen, lokale accountbezogene Threads, Rezept- und
Meal-Plan-Kontext, vorhandene read-only Tools, Anhänge, die bestehenden
Proposal-Apply-Pfade, `fam-recipe-import`, `fam-cook-from-inventory`,
`fam-inventory-capture`, OpenRouter, Groq, RevenueCat, Credits, Refunds und
Usage Logging werden weiterverwendet. Eine neue allgemeine Gateway-, Chat- oder
Assistant-Basis ist nicht Teil dieses Designs.

`recipe_suggestion.v1` und `fam-y918` bleiben vollständig getrennte,
unveränderte Verträge. In diesem Vorhaben existieren sie nur als geschützte
Regression.

Externe Modell- und Medienverarbeitung ist online-only. Bestehende lokale
Ergebnisse, lokale Eingaben, accountbezogene Threads und der vorhandene
Synchronisationspfad bleiben erhalten. Für externe AI- oder Medienvorgänge
entsteht keine neue Outbox und keine automatische Retry-Warteschlange.

## Architecture

### 1. Bestand der vorhandenen fam-AI-Basis

Die folgende Tabelle ist die Bestandsaufnahme, nicht die Liste neuer Bausteine.
Jede Erweiterung muss den jeweiligen vorhandenen Owner benutzen.

| Bestand | Belegte Verantwortung | Vertragsgrenze für dieses Design |
|---|---|---|
| `src/app/assistant.tsx` | Vorhandene Assistant-Route | Route bleibt bestehen und wird nicht durch eine zweite Route ersetzt. |
| `src/features/ai-assistant/screens/assistant-screen.tsx` | Assistant-Oberfläche mit Thread-Anzeige, Kontextauswahl, Anhängen und Proposal-Review | Screen bleibt der Einstieg für Assistant-Funktionen. Ergänzungen sind lokal und additiv. |
| `src/features/ai-assistant/types.ts` | Versionierte Assistant-Antworten, Rezept-/Meal-Plan-Kontext, Tools und Proposal-Typen | Bestehende Typen und Antwortformen bleiben kompatibel. Neue Formen erhalten eigene Namen und Versionen. |
| `src/features/ai-assistant/data/assistant-api.ts` | Mobile-Aufruf des vorhandenen `ai-gateway` | Der Client benutzt weiterhin den vorhandenen Gatewaypfad und enthält keine Provider-Geheimnisse. |
| `src/features/ai-assistant/data/assistant-storage.ts` | Lokale, accountbezogene Threads und lokaler Last-Result-Zustand | Verschlüsselter Account-Storage und die Grenze von 20 Threads bleiben unverändert. |
| `src/features/ai-assistant/data/assistant-attachments.ts` | Datei-, MIME-, Anzahl- und encoded-size-Prüfung | Höchstens fünf Assistant-Anhänge und höchstens 8 MB encoded total bleiben verbindlich. Rohbytes gehören nicht in Threads. |
| `apply-meal-plan-proposal.ts` | Anwendung von Meal-Plan-Proposals | Bestehender Apply Path bleibt Owner für Berechtigung, Aktualität und lokale Synchronisation. |
| `apply-ingredient-swap-proposal.ts` | Anwendung von Zutatenwechseln | Bestehender Apply Path bleibt erhalten; ein neuer Modus wird nur als additive Information ergänzt. |
| `apply-shopping-list-proposal.ts` | Merge und idempotente Anwendung von Shopping-Proposals | Bestehender Shopping-Merge und seine Tests bleiben unverändert der Persistenzpfad. |
| `supabase/functions/ai-gateway/handler.ts` | Authentifizierung, bestehende Skills, read-only Tools, Proposal-Validierung, Credits, Refunds und Usage | Der Handler bleibt die einzige serverseitige Grenze für neue externe Capability-Aufrufe. Bestehende Skills behalten ihre Request- und Response-Verträge. |
| `supabase/functions/ai-gateway/providers.ts` | OpenRouter-/Groq-Providerpfad und vorhandener Groq-Transkriptionsbaustein | Provider-Fähigkeiten werden additiv registriert. Kein stiller Providerwechsel und kein Client-Providerzugriff. |
| `fam-recipe-import` | Text-, URL-, Bild-, PDF- und Video-Eingänge mit Draft und Review | Der vorhandene Importpfad wird erweitert, nicht parallel neu aufgebaut. |
| `fam-cook-from-inventory` und `fam-inventory-capture` | Bestehende Koch- und Inventarverträge | Beide bleiben Legacy Skills mit unverändertem Verhalten. |
| Receipt-/OCR-/Review-Pfade | Beleg-Assets, OCR und Review vor Receipt-/Inventory-Verwendung | AI-Erkennung wird als zusätzlicher Review-Schritt an diese Owner angebunden. |
| `profile_food_rules` und Household Food-Rule Snapshot | Lebensmittelregel- und Sicherheitsprüfung für den Haushalt | Die vollständige bestehende Mitgliederabdeckung bleibt erhalten. Diese Prüfung wird nicht in Tracking umbenannt. |
| RevenueCat, Credit Booking und Refund | Bestehende Entitlement-, Buchungs- und Rückgaberegeln | Neue Capabilities verwenden dieselben Regeln und erweitern nur Metadaten/Allowlisten. |
| `ai_usage` und bestehendes Usage Logging | Content-freie serverseitige Nutzungsereignisse | Bestehende Legacy-Skill-Werte und `recipe_suggestion.v1`-Semantik bleiben erhalten. |
| lokaler SQLite-/Drizzle-Spiegel und vorhandene Outbox | Synchronisierte Haushaltsdomänen | Nur explizit angewendete Domänenmutationen nutzen diesen Pfad. AI- und Medienvorgänge werden dort nicht als Jobs abgelegt. |
| vorhandene Speech-Permissions und `expo-speech` im Cooking Mode | Native Sprachbausteine | Sprachfunktionen werden weiterverwendet. Eine neue allgemeine Sprachplattform ist nicht vorgesehen. |
| bestehende Notification- und Reminder-Infrastruktur | Lokale Benachrichtigungen und Reminder | AI liefert höchstens einen reviewbaren, ausdrücklich zu bestätigenden Übergang. |

### 2. Architekturentscheidungen

#### 2.1 Eine additive Erweiterung des vorhandenen Gatewaypfads

Neue externe Capability-Aufrufe werden im bestehenden `ai-gateway` dispatcht.
Ein optionales Capability- und Vertragsmetadatum darf den bestehenden Request-
und Usage-Vertrag erweitern. Bestehende Legacy Requests bleiben mit ihren
bisherigen Shapes gültig. Es gibt keinen zweiten Gateway-Endpunkt, keine
allgemeine zweite API und keinen Provider-Aufruf aus dem Mobile Client.

Der vorhandene `fam-assistant`-Pfad bleibt für den bestehenden Assistant-
Verkehr erhalten. Neue Grenzen werden nur dort ergänzt, wo eine Capability eine
belegte Lücke oder einen zusätzlichen Scope-/Providervertrag benötigt.

#### 2.2 Read-only auf der Modellseite, Mutation beim Domain Owner

Ein External Model Call darf lesen, strukturieren, transkribieren oder ein
reviewbares Proposal beziehungsweise einen Draft erzeugen. Er mutiert keine
Household-Domäne und keine private Tracking-Domäne.

Ein Proposal ist bis zur ausdrücklichen Nutzeraktion read-only. Das Anwenden
läuft über den bereits zuständigen Domain Owner mit erneuter Prüfung von
Berechtigung, Versionsstand, Food-Rule-Evidence, Konflikten und Reverse State.
Es gibt keine generische AI-Schreibfunktion.

#### 2.3 Keine künstliche Haushaltssperre

Jedes berechtigte Household-Mitglied kann den Assistant im Rahmen der
bestehenden Household- und RLS-Regeln verwenden. Eine persönliche Assistant-
Freigabe verändert weder Membership noch Rollen noch Sichtbarkeiten.

Household-Daten werden mit der authentifizierten Session und der bestehenden
Mitgliedschaft gelesen. Die bestehende Household Food-Rule-Prüfung behält ihre
Mitgliederabdeckung. Persönliche Präferenzwerte kommen dagegen ausschließlich
vom anfragenden Account und nur aus den freigegebenen Kategorien.

#### 2.4 Online-Grenze ohne neue AI-Outbox

Neue externe Modell-, Quellen- und Medienverarbeitung benötigt eine aktive
Online-Verbindung. Offline werden vorhandene lokale Ergebnisse und Eingaben
nach den bestehenden Storage-Regeln read-only angezeigt. Connectivity-
Rückkehr startet keinen Vorgang automatisch; sie ermöglicht nur eine neue
explizite Nutzeraktion.

Die bestehende Outbox bleibt für autorisierte synchronisierte
Domänenmutationen bestehen. Kein External Model Call, kein Medienjob und kein
Retry dieser Vorgänge wird dort abgelegt.

### 3. Bestands- und Kompatibilitätsregeln

| Regel | Konsequenz |
|---|---|
| Bestehende Capability-Fläche erfüllt bereits einen Teil des Zielvertrags | Nur die dokumentierte Lücke wird additiv ergänzt. Kein Ersatz und keine stille Migration. |
| Neue Serververarbeitung ist erforderlich | Der vorhandene `ai-gateway`-Handler und seine Provider-Adapter bleiben die Grenze. |
| Ein Vertrag ähnelt einem vorhandenen Rezeptvorschlag | Er erhält einen eigenen Namen und eine eigene Version. `recipe_suggestion.v1` wird nicht als allgemeines Envelope verwendet. |
| Ein Proposal besitzt keinen passenden Domain Apply Path | Das Proposal bleibt vollständig read-only und wird nicht künstlich angewendet. |
| Provider-Fähigkeit, Output-Vertrag, Zweck, Inputtyp, Aufbewahrung oder Fehlerstatus fehlen | Die Capability ist unavailable und darf keinen unsupported External Model Call starten. |
| Eine Änderung beträfe nur eine neue Architekturform | Sie ist aus diesem Design ausgeschlossen. |
| Eine Änderung beträfe `recipe_suggestion.v1` oder `fam-y918` | Sie benötigt eine separate Freigabe und eine separate Spezifikation. |

## Components and Interfaces

### 4. Capability Inventory und additive Lücken

Diese Tabelle ist der zentrale Capability-Vertrag. Sie unterscheidet Bestand,
Lücke, Wiederverwendung, minimale neue Schnittstelle und Testgrenze. Die
Beschreibung einer Lücke ist keine Freigabe für einen Neuaufbau.

| Capability | Status | Aktueller Stand | Fehlende Ergänzung | Wiederverwendetes Modul | Minimale neue Schnittstelle | Testgrenze |
|---|---|---|---|---|---|---|
| `assistant` | teilweise vorhanden | `fam-assistant`, Assistant-Screen, accountbezogene Threads, Rezept-/Meal-Plan-Kontext, Anhänge, read-only Tools und vorhandene Proposal-Apply-Pfade sind vorhanden. | Einmaliger Consent Frame, Scope-/Provider-Grenzen und additive Capability-/Vertragsmetadaten fehlen als gemeinsamer Rahmen. | `assistant.tsx`, `assistant-screen.tsx`, `assistant-api.ts`, `assistant-storage.ts`, Attachment- und Apply-Module, `ai-gateway`. | Optionales `capabilityId`/`contractVersion`-Metadatum am vorhandenen Assistant-Request sowie ein Consent-Status-Leser. Kein neuer Chatvertrag. | Regression von Route, Screen, Threads, Kontext, Attachments, Tools und Apply Paths; zusätzliche Consent-/Scope-Gatewaytests. |
| `import` | teilweise vorhanden | `fam-recipe-import` akzeptiert Text, URL, Bild, PDF und Video und führt über Draft und Review. | Einheitliche additive Draft-/Quellen-/Statusmetadaten und klare Übergänge für externe Medienverarbeitung. | `fam-recipe-import`, bestehende Import-UI, Receipt-/Media- und Recipe-Apply-Owner. | Separat versionierter Import-Draft-Envelope mit Quelle, erkannten Feldern, Confidence, Warnungen und Review-Status. Kein zweiter Importpfad. | Eingangstypen, strukturierte Quelle vor Provider, Draft-Round-Trip, explizites Save und Offline-Sperre. |
| `notes` | fehlend | Die Recipe-Domäne und ihr Domain Owner existieren, aber kein belegter AI-Notizvorschlag. | Read-only Rezeptnotiz-Proposal mit sichtbarer Review-Grenze. Persistenz wird nur über einen ausdrücklich vorhandenen oder separat freigegebenen Recipe-Owner erlaubt. | Recipe-Domäne, vorhandene Assistant-Review-Komponenten und `ai-gateway`. | `recipe_notes_proposal.v1` mit Recipe-ID, Quelle, Notiztext, Unsicherheit und Ablauf. Ohne Apply Path bleibt er read-only. | Proposal ohne Recipe-Mutation; fehlender Apply Path hält den Vorschlag read-only. |
| `swaps` | teilweise vorhanden | Assistant-Tool, `ingredient_swap_proposal.v1`, serverseitige Validierung und lokaler Apply Path existieren. | Einmalige Kochverwendung und dauerhafte Rezeptänderung müssen vor Apply als getrennte Modi erkennbar sein. | `apply-ingredient-swap-proposal.ts`, vorhandene Validierung, Recipe-Owner. | Additives `applyMode: 'one_cooking' | 'persist_recipe'` im bestehenden beziehungsweise separat versionierten Swap-Vertrag. | Beide Modi, Stale-Version, Food-Rule-Prüfung und unverändertes Verhalten des vorhandenen Apply Paths. |
| `nutrition` | teilweise vorhanden | Rezept-/Produktdaten und private Nutrition-Tracking-Domäne existieren. | Read-only Nährwertschätzung mit deutlicher Estimate-Kennzeichnung ohne Zugriff auf oder Schreiben in Tracking. | Recipe-/Product-Reads, bestehender Assistant-Response-Validator. | `nutrition_estimate.v1` mit Wert, Einheit, Quelle, Unsicherheit und `isEstimate: true`. | Label-Invariante und Nachweis, dass keine Nutrition-Tracking-Mutation erfolgt. |
| `shopping` | teilweise vorhanden | Shopping-Proposals, `shopping_list_proposal.v1`, Merge und idempotente Anwendung sind vorhanden. | Capability-spezifische Scope-/Usage-Metadaten und die verbleibende Review-Grenze. Ein neuer Shopping-Apply-Entwurf ist nicht nötig. | `apply-shopping-list-proposal.ts`, Shopping-Domain Owner und bestehende Proposal-Tests. | Optionales Capability-/Contract-Metadatum am vorhandenen Proposal- und Usage-Envelope. | Bestehender Merge-/Idempotenzpfad plus Review-before-Apply; keine zweite Shopping-Mutation. |
| `receipts` | teilweise vorhanden | Receipt-OCR, Receipt-Speicher, Assets und Review-Pfade existieren. | AI-gestützte Erkennung muss als reviewbares Proposal vor Receipt-, Inventory- oder Shopping-History-Mutation erscheinen. | OCR-, Receipt-Review- und Receipt-/Inventory-Owner. | `receipt_proposal.v1` mit Receipt-Referenz, erkannten Items, Confidence, Warnungen und Review-Status. | Attachment-/Review-Tests und No-write vor ausdrücklichem Domain Apply. |
| `discover` | teilweise vorhanden | Rezeptkatalog und `search_recipes` als read-only Assistant-Tool existieren. | Externe Herkunft, Quelle und Übergang in den bestehenden Import-Draft müssen sichtbar sein. | Rezeptkatalog, `search_recipes`, `fam-recipe-import`. | `discover_result.v1` mit Source Reference, Origin und Übergang `create_import_draft`. | Herkunft vor Draft, keine erfundene Quelle und keine direkte Recipe-Mutation. |
| `reminders` | teilweise vorhanden | Lokale Notification- und Reminder-Infrastruktur existiert. | AI-spezifischer Trigger, Zeitpunkt, Notification-Permission und Scope müssen vor Scheduling vollständig sein. | Vorhandener Reminder-/Notification-Owner und lokale Berechtigungsabfrage. | `reminder_proposal.v1` mit Trigger, Zeitpunkt, Scope und Permission-Status. | Fehlende Voraussetzung verhindert Scheduling; keine ungefragten Modellaufrufe. |
| `image-generation` | fehlend | Medien- und Storage-Bausteine existieren, aber kein produktiver Bildgenerierungsvertrag. | Begrenzte Provider-Fähigkeit, Credit-/Usage-Metadaten, generiertes Label und explizites Attach/Save. | `ai-gateway`, bestehende Provider-/Credit-/Usage-Adapter und Storage-/Attachment-Owner. | `generated_image.v1` mit Provider-Referenz, Zweck, Generated-Label, Ablauf und Attach-/Save-Option. | Provider-Availability, Label und No-save-before-action; kein allgemeiner Medienjob. |
| `speech-to-text` | teilweise vorhanden | Native Speech-Permissions, Entwicklungsbausteine und Groq-Transkription existieren. | Produktiver, ausdrücklich gestarteter Assistant-/Import-Übergang mit sichtbarer Transkriptprüfung. | Speech-Permissions, vorhandener Groq-Transkriptionsbaustein, Attachment-Validierung und `ai-gateway`. | `transcript.v1` mit Audio-Referenz, Text, Sprache, Confidence und Review-Status. | Aktion-before-upload, Online-only für externe Transkription und Transcript-before-follow-up. |
| `text-to-speech` | teilweise vorhanden | `expo-speech` und Vorleselogik im Cooking Mode existieren. | Sichtbares Vorlesen von Assistant-Antworten oder Kochschritten nach expliziter Aktion. | `expo-speech`, Cooking-Mode-Voice und vorhandene sichtbare Textquellen. | `speech_playback.v1` beziehungsweise ein lokaler Playback-Status für sichtbaren Text. Keine externe Modell-API für den lokalen Pfad. | Nur sichtbarer Text, explizite Aktion und keine Hintergrundverarbeitung. |
| `media-processing` | teilweise vorhanden | Bild-, PDF- und Video-Eingänge in Assistant, Import und OCR existieren. | Zweck-, Inputtyp-, Status-, Retention- und Fehlergrenzen je Medienfluss. | Attachment-Validator, `fam-recipe-import`, OCR, `ai-gateway` und vorhandene Storage-Owner. | Zweckgebundener `media_result.v1` oder capability-spezifischer Resultat-Envelope. Keine allgemeine Job-Outbox. | MIME-/Zweck-/Retention-/Fehlervertrag sowie Online-only und kein automatisches Retry. |

Bereits ausreichende Teilflächen erhalten ausdrücklich kein eigenes
Implementierungsdesign. Das gilt insbesondere für den vorhandenen Assistant-
Einstieg, lokale Threads, Attachment-Grenzen, Recipe-/Meal-Plan-Kontext,
read-only Tools, bestehende Shopping-/Meal-Plan-/Swap-Apply-Pfade und den
strukturierten Importpfad. Für diese Flächen sind nur Regression,
Kompatibilität und die in der Tabelle genannten Metadaten zulässig.

### 5. Mobile Komponenten und Verantwortungen

Die vorhandene Feature-Struktur bleibt bestehen. Additive Verantwortungen
werden an vorhandene Grenzen angelegt, nicht als allgemeines neues Framework
gebaut.

| Verantwortungsgrenze | Erweiterung | Darf nicht tun |
|---|---|---|
| Assistant-API | Capability-/Contract-Metadaten an den bestehenden Gatewayaufruf geben und stabile Fehler parsen | Provider direkt ansprechen, Secrets halten oder einen zweiten Chat-Transport einführen |
| Assistant-Screen | Bestehenden Kontext, Review und einmalige Consent-Einrichtung erreichen | Einen parallelen Assistant-Screen oder einen per-call Bestätigungsdialog einführen |
| Consent-Settings | Kategorien, Zweck-/Provider-Rahmen, Version, Aktivstatus, Widerruf und Datenschutzhinweis anzeigen | Aktuelle Präferenzwerte im Consent Record speichern |
| Scope-Building | Ausgewählten Household-/Page-/Attachment-Scope und eigene erlaubte Präferenzen beschreiben | Fremde private Daten, Tracking oder Child-Profile laden |
| Proposal-Review | Quelle, Unsicherheit, Status, Ablauf und vorhandene Apply-Aktion anzeigen | Durch Rendern, Öffnen oder Modellantwort mutieren |
| bestehende Apply-Module | Neue Proposal-Kinds nur an einen passenden Domain Owner weiterleiten | Generische AI-Schreiboperationen oder RLS-Umgehung hinzufügen |
| lokaler Account-Storage | Gültige Last Local Results und bestehende Thread-/Attachment-Metadaten sichern | Rohbytes, externe Jobs oder fremde Accountdaten speichern |
| Capability Registry | Exakte IDs, Status, Contracts und benötigte Provider-Fähigkeiten beschreiben | Freitext in eine neue Capability umdeuten oder unbekannte IDs akzeptieren |

React Query, Zustand, Unistyles v3, SQLite/Drizzle und die bestehende
Synchronisationsarchitektur bleiben in ihren vorhandenen Rollen. Für diese
Dokumentationsänderung werden keine UI-Komponenten, nativen Abhängigkeiten,
Schemaänderungen oder Styles entworfen.

### 6. Serverkomponenten im vorhandenen `ai-gateway`

Der vorhandene Handler bleibt der Einstieg. Seine additive Prüfreihenfolge für
neue Capability-Requests ist:

1. Request-Shape und Capability-ID gegen die Allowlist prüfen.
2. Session, aktiven Household-Kontext und bestehende RLS-/Membership-Regeln
   prüfen.
3. Zweck, Page Context, Attachment-Typ und bekannte Datenherkunft prüfen.
4. Den accountbezogenen Consent Record prüfen. Ein unveränderter Rahmen braucht
   keine neue Nutzerbestätigung.
5. Den erlaubten Data Scope aus bestehenden Domain-Reads aufbauen.
6. Bekannte Tracking- und Child-Tracking-Quellen fail-closed ausschließen.
7. Provider-Fähigkeit und Output-Vertrag prüfen.
8. Erst danach RevenueCat-Entitlement und bestehende Credit Booking ausführen.
9. Den vorhandenen OpenRouter-/Groq-Adapter verwenden.
10. Antwort beziehungsweise Proposal streng capability-spezifisch validieren.
11. Content-freies Usage Event schreiben und bei terminal nutzlosem Ergebnis die
    bestehende einmalige Refund-Regel verwenden.
12. Nur gültige Resultate lokal zurückgeben; eine explizite Apply-Aktion bleibt
    ein separater Domain-Schritt.

Diese Reihenfolge stellt sicher, dass ein bekannter unzulässiger Scope weder
Credits bucht noch einen Provider erreicht. Ein nicht konfigurierter Provider
oder fehlender Output-Vertrag ergibt `capability_unavailable` ohne stillen
Providerwechsel.

## Data Models

### 7. Besitz- und Sichtbarkeitsmodell

| Datenklasse | Besitzer | Verwendung in diesem Design |
|---|---|---|
| Assistant Thread und Last Local Result | einzelner Account, verschlüsselter lokaler Account-Storage | Nur derselbe Account, maximal 20 Threads; offline read-only nach bestehenden Regeln. |
| Consent Record | einzelner Account | Nur Rahmenmetadaten, keine aktuellen Werte und keine Freigabe fremder Daten. |
| Household-Daten | Household | Berechtigte Mitglieder lesen sie über Session, Membership und bestehende RLS. |
| Eigene persönliche Präferenzen | anfragender Account | Nur `intolerances` und `dislikedFoods`, wenn sie im aktiven Consent Frame ausgewählt sind. |
| Household Food-Rule Snapshot | bestehende serverseitige Sicherheitsprüfung des Haushalts | Bleibt vollständige Lebensmittelregel-Prüfung für die betroffenen Mitglieder; wird nicht automatisch persönlicher Provider-Payload. |
| Child Profile und Kind-Tracking | Household beziehungsweise Child Profile | Für neue External Model Calls nicht lesbar und nicht als Consent-/Context-Kategorie auswählbar. |
| Adult Tracking | einzelner Account | Nicht lesbar, nicht auswählbar, nicht übertragbar und nicht ableitbar. |
| Receipt-, Recipe-, Shopping-, Meal-Plan- und Inventory-Mutationen | jeweilige Household-Domäne | Nur über den vorhandenen Domain Owner, bestehende RLS, SQLite-/Outbox- und Reverse-State-Regeln. |
| Usage Event | serverseitiger Betriebsdatensatz | Content-frei, serverseitig, mit optionalen additiven Capability-Metadaten. |

Eine Assistant-Freigabe ist kein Berechtigungs- oder Household-Token. Sie
ändert weder Sichtbarkeit noch Membership noch Rollen. Haushaltsmitglieder
werden nicht aus Food-Rule-Prüfungen entfernt, nur weil der anfragende Account
eine persönliche Präferenzfreigabe besitzt.

### 8. Erlaubter Data Scope

Der neue Data Scope besteht aus einer positiven, capability-spezifischen
Zusammenstellung:

- ausdrücklich ausgewählte Household-Daten, die der bestehende Session- und
  RLS-Pfad lesen darf;
- ausdrücklich ausgewählter Rezept-, Meal-Plan-, Import-, Receipt-, Bestands-
  oder Einkaufs-Kontext;
- für den aktuellen Zweck ausgewählte und validierte Attachments;
- ausschließlich eigene aktuelle Werte der Kategorien `intolerances` und
  `dislikedFoods`, sofern diese Kategorien im aktiven Consent Frame enthalten
  sind.

Der Consent Record enthält nur den Rahmen, nicht die aktuellen Werte. Die
persönlichen Werte werden für einen konkreten Request aus dem bestehenden
accountbezogenen Owner gelesen und nur für diesen Request projiziert.

Der Household Food-Rule Snapshot bleibt eine Sicherheits- und
Lebensmittelregelquelle. Er darf für die serverseitige Eignungsprüfung benutzt
werden, wird aber nicht automatisch in eine neue persönliche Provider-
Projektion umbenannt oder überführt. Die vorhandene Mitgliederabdeckung und
Invalidierung bleiben maßgeblich.

### 9. Harte Tracking- und Kind-Tracking-Grenze ohne allgemeine Freitextlogik

Die Grenze wird an Datenbesitz, Quellen-Allowlist und Vertragsformen gesetzt:

1. Capability-Typen, Consent-Optionen, Page Context und Query-Projektionen
   enthalten keine Adult-Tracking- oder Child-Tracking-Quelle.
2. Bekannte Tracking-Tabellen, Tracking-Felder, tracking-spezifische Context-
   Flags und als Tracking markierte Attachments werden vor Credit Booking und
   Providerzugriff abgelehnt.
3. Der Gateway liest für neue Capabilities weder Kalorien, Gewicht,
   Mahlzeitenprotokolle, Medikamente, Symptome, Vitalwerte, Fasten, Workouts,
   Ziele noch `tracking_method` und liest keine Child-Profile-/Kind-Tracking-
   Daten für einen External Model Call.
4. Safety-Projektionen verwenden nur die eigenen freigegebenen persönlichen
   Präferenzen oder den bestehenden Household Food-Rule Snapshot.
5. Tracking wird nicht aus Household-Daten, Product Usage, Assistant-History,
   Estimates, Proposal-Anwendung, Usage Events oder Analytics abgeleitet.
6. Providerantworten mit bekannten Trackingfeldern oder tracking-abgeleiteten
   Werten werden vollständig verworfen, bevor Response, Cache, Draft, Usage
   oder Fehlerartefakt entsteht.

Dieses Design führt keine spekulative allgemeine semantische Freitext-
Klassifikationsmaschine als Produktkern ein. Freie Nachrichten, Quelltexte,
Transkripte und Attachment-Inhalte werden nicht als neue strukturierte
Trackingquelle behandelt oder automatisch in Tracking umgedeutet. Ein
explizit als Tracking deklarierter Ursprung, Context oder Input wird dagegen
fail-closed verworfen, ohne den Inhalt zu echoen, zu speichern oder zu loggen.
Ein künftiger Medien- oder Freitextfluss, der die harte Grenze nicht über
seinen deklarierten Zweck und seine Herkunft garantieren kann, bleibt unter
diesem Design unavailable und benötigt eine eigene fachliche Entscheidung.

### 10. Minimal additive Vertragsformen

Die folgenden Typen beschreiben die kleinste gemeinsame Erweiterung. Sie
ersetzen keine bestehenden Legacy-Verträge.

```ts
type CapabilityId =
  | 'assistant'
  | 'import'
  | 'notes'
  | 'swaps'
  | 'nutrition'
  | 'shopping'
  | 'receipts'
  | 'discover'
  | 'reminders'
  | 'image-generation'
  | 'speech-to-text'
  | 'text-to-speech'
  | 'media-processing';

type CapabilityStatus = 'bestehend' | 'teilweise vorhanden' | 'fehlend';

type PersonalPreferenceCategory = 'intolerances' | 'dislikedFoods';

type ConsentRecord = {
  accountId: string;
  categories: readonly PersonalPreferenceCategory[];
  purposeVersion: string;
  providerFrame: readonly ('openrouter' | 'groq')[];
  contractVersion: string;
  createdAt: string;
  active: boolean;
};

type CapabilityRequestMetadata = {
  capabilityId: CapabilityId;
  contractVersion: string;
  purposeCode: string;
};

type DataScope = {
  householdContext: readonly string[];
  pageContext: string | null;
  attachmentRefs: readonly string[];
  personalPreferenceCategories: readonly PersonalPreferenceCategory[];
};

type UsageExtension = {
  capabilityId?: CapabilityId;
  contractVersion?: string;
  purposeCode?: string;
};
```

`UsageExtension` ist optional, damit vorhandene Legacy Rows und Legacy Skill-
Werte unverändert gültig bleiben. Die Werte sind Metadaten, nie Prompt,
Antwort, Attachment-Inhalt oder Präferenzwert.

Jede fehlende Capability erhält vor Produktfreigabe zusätzlich ihren eigenen
Output-Vertrag, Domain Owner, Data Scope, Online-Modus, Mutationsstatus,
Provider-Fähigkeiten und focused test surface. Ein gemeinsames, untypisiertes
Assistant-Envelope genügt dafür nicht.

## Data Flow

### 11. Einmalige Einrichtung und laufende Requests

Die Einrichtung ist vom einzelnen Modellaufruf getrennt:

```text
Account öffnet Assistant-Einrichtung
        |
        v
Kurzfassung: erlaubte Daten | Zweck | Provider-Rahmen
        |
        +--> vollständige Erklärung in den Datenschutzbestimmungen
        |
        v
Account wählt: leer, intolerances oder dislikedFoods
        |
        v
Consent Record mit Rahmenmetadaten speichern
        |
        v
Bestehender Assistant-Request über assistant-api
        |
        v
ai-gateway: Session -> Household/RLS -> Scope -> Consent -> Providerfähigkeit
        |
        v
RevenueCat-Entitlement -> Credit Booking -> OpenRouter/Groq
        |
        v
Response-/Proposal-Validator -> Usage Event -> lokaler Account-Storage
        |
        v
Optional: ausdrückliche Aktion über den vorhandenen Domain Apply Path
```

Bei unverändertem Data Scope, Zweck und Provider wird kein zusätzlicher
Bestätigungsdialog vor dem einzelnen Aufruf angezeigt. Ändert sich einer
 dieser drei Bestandteile, antwortet der Gateway mit `consent_required`; erst
nach einer neuen expliziten Einrichtung darf der geänderte Request fortgesetzt
werden. Ein Widerruf blockiert folgende External Model Calls. Eine
Reaktivierung stellt den alten Status nicht implizit wieder her, sondern
benötigt eine neue gespeicherte Einrichtung.

### 12. Assistant- und Proposal-Datenfluss

1. Der vorhandene Assistant-Screen wählt Nachricht, bestehenden Thread,
   optionalen Page Context und aktuelle Attachments.
2. Die vorhandene lokale Prüfung validiert Datei-Existenz, MIME, Anzahl und
   encoded size. Die bestehende Grenze von fünf Dateien und 8 MB total bleibt
   bestehen.
3. `assistant-api` benutzt den bestehenden Gatewaypfad.
4. Der Gateway validiert Capability, Session, Household-Mitgliedschaft,
   Context-Ownership, Consent, bekannte Datenherkunft und Providerfähigkeit.
5. Household-Reads verwenden bestehende Session-/RLS-Grenzen. Die
   persönlichen Werte werden nur für den anfragenden Account projiziert.
6. Der vorhandene Provider-Adapter erzeugt eine capability-spezifische
   Anfrage. Providerantworten werden gegen den passenden Output-Vertrag
   validiert.
7. Reply, Quellen und Proposal werden read-only dargestellt und nach den
   bestehenden Storage-Regeln accountbezogen gespeichert.
8. Erst eine ausdrückliche Nutzeraktion kann einen passenden Apply Path
   aufrufen. Der Domain Owner validiert den aktuellen Zustand erneut.

### 13. Import- und Medienfluss

`fam-recipe-import` bleibt der einzige Importpfad. Eine strukturierte Quelle
wird bevorzugt, bevor ein External Model Call notwendig wird. Wenn externe
Verarbeitung erforderlich ist, werden Consent, Entitlement, Credit und
Providerfähigkeit vor Übermittlung geprüft.

Ein Importresultat bewahrt source type, source reference, extracted fields,
confidence, warnings und review status. Ein Import Draft erzeugt oder ändert
kein Household Recipe, solange der Account nicht ausdrücklich speichert.

Für jeden neuen Medienfluss müssen Zweck, Inputtyp, Aufbewahrungsfrist und
Fehlerstatus deklariert sein. Bild, PDF und Video bleiben auf den ausgewählten
Import-, Assistant- oder Receipt-Zweck begrenzt. Es gibt keinen allgemeinen
Medienjob, der offline gepuffert, automatisch wiederholt oder in eine neue
Outbox eingereiht wird.

### 14. Capability-spezifische Übergänge

- `notes` liefert einen reviewbaren Notizvorschlag. Ohne bestehende oder
  separat freigegebene Recipe-Notizmutation bleibt er read-only.
- `swaps` kennzeichnet vor Apply, ob der Wechsel nur für einmaliges Kochen oder
  dauerhaft im Rezept gelten soll. Der vorhandene Swap-Apply Path bleibt der
  Owner.
- `nutrition` liefert nur eine als Schätzung markierte Darstellung und darf
  keinen Nutrition-Tracking-Eintrag erzeugen.
- `shopping` liefert ein vorhandenes Shopping-List-Proposal und nutzt den
  bestehenden Merge-/Apply Path.
- `receipts` liefert ein reviewbares Receipt Proposal vor jeder Receipt-,
  Inventory- oder Shopping-History-Mutation.
- `discover` zeigt Quelle und Origin, bevor ein vorhandener Import Draft
  entsteht.
- `reminders` plant erst nach explizitem Trigger, Zeitpunkt,
  Notification-Permission und Scope über die vorhandene Reminder-Infrastruktur.
- `image-generation` markiert das Ergebnis als generiert. Attach oder Save
  bleibt eine ausdrückliche Aktion am bestehenden Storage-/Attachment-Owner.
- `speech-to-text` beginnt erst nach expliziter Aktion und zeigt das Transcript
  vor jedem weiteren Capability-Schritt.
- `text-to-speech` liest nur bereits sichtbare Assistant-Antworten oder
  Kochschritte nach einer ausdrücklichen Aktion. Der vorhandene lokale
  `expo-speech`-Pfad benötigt dafür keine neue externe Modellgrenze.
- `media-processing` verarbeitet nur den ausgewählten Zweck und meldet einen
  fehlenden Vertragsbestandteil als unavailable.

## Proposal- und Apply-Grenzen

### 15. Bestehende Apply Paths

Die vorhandenen Pfade bleiben unverändert die erste Wahl:

| Ergebnis | Bestehender Owner | Neue AI-Aufgabe |
|---|---|---|
| Meal-Plan-Änderung | `apply-meal-plan-proposal.ts` | Nur Capability-/Contract-Metadaten oder Regression ergänzen. |
| Zutatenwechsel | `apply-ingredient-swap-proposal.ts` | Einmaligen und dauerhaften Modus vor dem bestehenden Apply unterscheiden. |
| Shopping List | `apply-shopping-list-proposal.ts` | Vorhandenes Proposal, Merge und Idempotenz verwenden. |
| Import-Draft zu Recipe | bestehender Recipe-Import-/Recipe-Apply-Owner | Explicit Save und bestehende Review-Grenze bewahren. |
| Receipt-Erkennung | vorhandener Receipt-/OCR-/Review-Owner | AI-Ergebnis zuerst als Review-Objekt übergeben. |
| Reminder | vorhandener Notification-/Reminder-Owner | Nur nach explizitem Trigger und vollständigem Scope schedulen. |
| generiertes Bild | bestehender Attachment-/Storage-Owner | Erst nach Attach oder Save persistieren. |

Ein neuer generischer Apply Path wird nicht entworfen. Nur wenn ein wirklich
neuer Proposal-Typ einen bislang nicht vorhandenen Domain Owner benötigt,
darf eine separate, capability-spezifische Apply-Spezifikation folgen. Bis
dahin bleibt der Typ read-only.

### 16. Revalidierung vor Mutation

Jeder vorhandene oder später separat freigegebene Apply Path prüft vor der
Mutation erneut:

- aktuelle Session, Membership und RLS-Berechtigung;
- aktuelle Entity-Version oder Snapshot-Evidence;
- Food-Rule-Sicherheit und die bestehende Haushaltsmitgliederabdeckung;
- Konflikte, Mengen, IDs und Reverse State;
- lokale SQLite-/Drizzle- und Outbox-Verträglichkeit.

Bei abweichender Autorisierung oder veraltetem Snapshot wird ohne Änderung des
Domainzustands abgebrochen. Öffnen, Rendern, erneutes Laden, Verwerfen oder ein
Provideraufruf wendet kein Proposal an.

## Provider, RevenueCat und Usage

### 17. Providergrenze

Der vorhandene OpenRouter-/Groq-Providerpfad bleibt maßgeblich. Die Capability
Registry ordnet jeder externen Capability die tatsächlich konfigurierte
Provider-Fähigkeit und den eigenen Output-Vertrag zu. Eine fehlende Zuordnung
führt zu `capability_unavailable` ohne Provideraufruf. Ein Fehler bei einem
Provider erzeugt keinen stillen Wechsel zu einem anderen Provider, wenn der
aktuelle Consent-/Provider-Rahmen dadurch verändert würde.

Provider- und Supabase-Secret-Keys bleiben serverseitig. Der Mobile Client
enthält weder Provider Secrets noch Supabase Secret API Keys noch RevenueCat
Secret API Keys.

`text-to-speech` darf den bestehenden lokalen `expo-speech`-Baustein verwenden.
Eine zusätzliche externe Stimme oder Medienverarbeitung wäre ein eigener
online-only Provider-Fall mit demselben Gateway-, Consent-, Credit- und Usage-
Rahmen.

### 18. Credits, Refunds und Entitlements

Ein neuer External Model Call verwendet das bestehende RevenueCat-
AI-Entitlement und die bestehende atomare Credit Booking. Die Booking erfolgt
erst nach Authentifizierung, Scope-, Consent-, Tracking- und Providerprüfung.

Wenn nach einer Booking kein nutzbares Ergebnis entsteht, wird die bestehende
one-time Refund-Regel wiederverwendet. Wiederholte Fehler oder Folgeversuche
führen nicht zu mehrfachen Refunds. Strukturierte Quellen, die ohne External
Model Call abgeschlossen werden, buchen keine AI-Credits.

Es gibt keinen clientseitigen Credit Counter, keine neue Billing-Architektur
und keine zweite Credential- oder Subscriber-Abbildung.

### 19. Rückwärtskompatibles Usage Logging

Usage Events bleiben serverseitig, append-only und content-frei. Bestehende
Felder, Legacy Skill-Werte und die Semantik von `recipe_suggestion.v1` bleiben
unverändert. Neue Capability-, Contract- und Zweckmetadaten sind optional und
additiv.

Nicht zulässig sind Prompt, Antwort, Rohanhang, Trackingwert, Child-Daten,
aktuelle persönliche Präferenzwerte oder eine aus diesen Daten abgeleitete
Analytics-Zeile. Bei einem unzulässigen Providerresultat wird kein Usage Event
für ein verwertbares Ergebnis erzeugt; die bestehende Credit-/Refund-Logik
bleibt idempotent.

## Consent und Datenschutzbestimmungen

### 20. Consent Frame

Die Einrichtung bietet nur:

- `intolerances`;
- `dislikedFoods`;
- eine ausdrücklich leere Auswahl.

Die Kurzfassung benennt verständlich Datenkategorien, Zweck und Provider-
Rahmen. Die vollständige Erläuterung steht in den Datenschutzbestimmungen und
behandelt erlaubte Daten, Zweck, Provider, Aufbewahrung und Widerruf. Der
aktuelle Rahmen, Aktivstatus und die Erklärung bleiben in den Einstellungen
erreichbar.

Der Consent Record besitzt nur:

- Account-ID;
- ausgewählte Kategorien;
- Zweckversion;
- Provider-Rahmen;
- Vertragsversion;
- Zeitpunkt;
- Aktivstatus.

Er enthält keine aktuellen Präferenzwerte, keinen Freitext, keine Adult-
Trackingdaten und keine Child-Profile-Daten. Der Record ist accountbezogen
und verleiht keine Household- oder RLS-Rechte.

### 21. Consent-Zustände

| Zustand | Externer Aufruf |
|---|---|
| Kein Record | `consent_required` vor Credit und Provider. |
| Aktiver Record, unveränderter Daten-/Zweck-/Provider-Rahmen | Aufruf darf ohne erneute Bestätigung fortgesetzt werden. |
| Scope, Zweck oder Provider weicht ab | `consent_required`; erst neue explizite Einrichtung erlaubt den Request. |
| Widerrufen | Nachfolgende External Model Calls bleiben blockiert. |
| Reaktivierung ohne neues Speichern | Bleibt blockiert. |
| Neue gespeicherte Einrichtung | Neuer aktiver Rahmen gilt für nachfolgende passende Requests. |

## Error Handling

### 22. Stabile Fehlerklassen

Die Fehlerklassen werden an der bestehenden `assistant-api`-/Gateway-Grenze
normalisiert. Die Namen sind Vertragsbeispiele, keine zweite API.

| Fehler | Entstehungsgrenze | Verhalten |
|---|---|---|
| `capability_unavailable` | unbekannte ID, fehlender Output-Vertrag oder fehlende Provider-Fähigkeit | Kein Provideraufruf, keine Credit Booking. |
| `consent_required` | fehlender, widerrufener oder nicht passender Consent Frame | Keine Übermittlung und keine Booking. |
| `scope_not_allowed` | fehlende Membership, fremder Context oder nicht erlaubter persönlicher Wert | Keine Provider- oder Domain-Mutation. |
| `tracking_data_not_allowed` | bekannte Trackingquelle, Child-Tracking oder explizit deklarierter Trackinginhalt | Vor Credit und Provider abbrechen, Inhalt nicht echoen oder loggen. |
| `offline` | neue externe Aktion ohne Verbindung | Lokalen Zustand read-only zeigen, nichts puffern oder einreihen. |
| `provider_not_configured` | Provider Secret, Modell oder Capability-Fähigkeit fehlt | Stable unavailable, kein stiller Providerwechsel. |
| `credit_unavailable` | Entitlement oder Credit Booking nicht möglich | Kein Provideraufruf. |
| `invalid_provider_result` | Antwort verletzt den capability-spezifischen Vertrag | Kein gültiges Resultat speichern; bestehende Refund-Regel anwenden, wenn gebucht. |
| `proposal_stale` | Apply Snapshot, Version oder Evidence ist veraltet | Keine Domainänderung; erneuten Online-Lauf verlangen. |
| `media_contract_incomplete` | Zweck, Inputtyp, Aufbewahrung oder Fehlerstatus fehlt | Flow unavailable, kein Medienaufruf. |

Fehler- und Diagnosedaten bleiben content-frei. Weder Rohprompt, Rohantwort,
Rohanhang, Trackingwert noch Kinddaten werden in Usage, Fehlerartefakten oder
Logs geschrieben. Bekannte unzulässige Inhalte werden nicht in Fehlermeldungen
wiederholt.

### 23. Antwort- und Resultatvalidierung

Jede Capability erhält einen strikt versionierten Output-Validator. Er prüft
mindestens Capability-ID, Contract-Version, erforderliche IDs, Quellen,
Unsicherheiten, Review-Status und Ablauf. Ein Ergebnis, das einen Proposal-
oder Import-Apply Path nicht unterstützt, bleibt read-only.

Eine Providerantwort mit bekannten Trackingfeldern oder tracking-abgeleitetem
Wert wird als vollständiger ungültiger Resultatversuch behandelt. Sie darf
nicht teilweise an Mobile, Cache, Draft, Usage oder Fehlerartefakte gelangen.

## Online-/Offline- und Storage-Grenzen

### 24. Offline-Verhalten

Offline darf die App:

- gültige Last Local Results read-only anzeigen;
- bestehende lokale Eingaben anzeigen;
- den vorhandenen accountbezogenen Thread lesen;
- Attachments nach den vorhandenen lokalen Regeln als aktuelle Eingabe halten,
  ohne sie als externen Job zu speichern.

Offline darf die App nicht:

- externe Modelle, externe Quellen oder externe Medienverarbeitung aufrufen;
- einen neuen AI- oder Medienvorgang in Outbox oder Retry-Queue schreiben;
- bei Connectivity-Rückkehr automatisch fortsetzen;
- einen abgelaufenen oder ungültigen Resultat-Envelope anwenden.

### 25. Account- und Attachment-Storage

Assistant Threads bleiben im verschlüsselten per-account Storage und maximal
20 lokal gespeicherte Threads. Attachment-Metadaten dürfen zusammen mit der
aktuellen Unterhaltung gespeichert werden. Rohbytes und Base64 gehören nicht
in den Thread.

Beim Identitäts- oder Household-Wechsel werden aktiver privater und
Household-Kontext vor dem nächsten External Model Call gelöscht oder
invalidiert. Ein lokaler Last Result, der abgelaufen oder nicht validierbar
ist, wird als unavailable for Apply markiert.

Die bestehende Domain-Outbox bleibt für echte Household-Mutationen erhalten.
AI-Requests, Providerjobs, Consent Frames und Medienoperationen werden nicht
als synchronisierte Domain-Entitäten eingeführt.

## Testing Strategy

### 26. Testebenen

Die Tests unterscheiden reine Vertragslogik, bestehende Laufzeitintegration
und Infrastruktur. Property-Tests prüfen nur eigene, kostengünstige Logik und
laufen mit mindestens 100 Iterationen je Property. Externe Provider, Supabase,
RLS, native Berechtigungen und UI werden mit fokussierten Beispiel-,
Integrations- oder Smoke-Tests geprüft.

| Bereich | Nachweis |
|---|---|
| Registry und Verträge | Exakte 13er-Allowlist, Status/Evidence, eigene Contract-Versionen, unavailable-Zustände und keine Legacy-Vertragswiederverwendung. |
| Assistant-Bestand | Regression von Route, Screen, Threads, maximal 20 Threads, Rezept-/Meal-Plan-Kontext, Attachment-Grenzen, read-only Tools und bestehenden Apply Paths. |
| Consent | UI-Einrichtung, Kurzfassung, erreichbare Datenschutzbestimmungen, Einstellungen, Record-Shape, Widerruf, Änderung von Scope/Zweck/Provider und kein per-call Dialog bei unverändertem Rahmen. |
| Datenbesitz und RLS | Authentifizierte Session, Household Membership, fremde private Daten, Food-Rule Snapshot mit vollständiger Mitgliederabdeckung sowie keine Rechteänderung durch Consent. |
| Tracking-Grenze | Bekannte Trackingquellen vor Credit/Provider, keine Tracking-/Child-Queries, keine verbotenen Senken, kein Echo und vollständiges Verwerfen verbotener Providerresultate. |
| Import und Medien | Text/URL/Bild/PDF/Video, strukturierte Quelle zuerst, Draft-Metadaten, Review-before-save, Zweck-/Input-/Retention-/Fehlervertrag und online-only. |
| Capability-Lücken | Notes, Swap-Modi, Nutrition-Estimate, Shopping-Merge, Receipt-Review, Discover-Origin, Reminder-Voraussetzungen und vier Medienfunktionen jeweils separat. |
| Provider und Credits | OpenRouter/Groq, fehlende Providerkonfiguration, RevenueCat-Entitlement, atomare Booking, genau ein Refund, keine Booking bei strukturierter Quelle und additive Usage-Metadaten. |
| Offline und Storage | Last Local Results, keine externe Aktion, keine neue Outbox/Retry, Connectivity ohne Auto-Resume, verschlüsselter Account-Storage, 20-Thread-Grenze und Identity-Wechsel. |
| Legacy-Schutz | Unveränderte fokussierte Tests für `recipe_suggestion.v1`, `fam-y918` und bestehende Legacy Skills. |

### 27. Property-Test-Regeln

Jede Property-Test-Suite referenziert ihre Design-Property im Testnamen oder
Test-Tag, zum Beispiel:

`Feature: merran-ai-assistant, Property 4: Consent-Rahmen bleibt stabil`

Für UI-Rendering, Navigation, native Speech-/Notification-Permissions,
Supabase-RLS, Providerverhalten und bestehende Legacy-Routen sind
beispielbasierte beziehungsweise Integrations-Tests geeigneter als PBT. Keine
Property simuliert einen externen Provider hundertfach.

### 28. Repository-Gates für eine spätere Implementierung

Die spätere Umsetzung darf nur gezielte Gates ausführen, insbesondere:

- `bun run test <betroffene-testdatei>`;
- `bun run test:functions -- <betroffene-function-testdatei>`;
- `bun run test:db <betroffener-test>`;
- `bun run typecheck`;
- `bun run check:functions`;
- `bun run check`;
- `git diff --check`.

Diese Designüberarbeitung selbst schreibt keinen Produktionscode, kein SQL,
keine Migration, keine generierten Datenbanktypen, keinen Providerzustand und
keinen nativen Build.

## Correctness Properties

Die folgenden Properties wurden nach der Testbarkeitsanalyse und einer
Redundanzprüfung konsolidiert. UI-, RLS-, Provider- und Legacy-Nachweise, die
keine kostengünstige universelle Pure-Function-Eigenschaft sind, bleiben als
Beispiel- oder Integrationstests in der Teststrategie verankert.

### Property 1: Capability Inventory und Statusgrenzen bleiben geschlossen

**For all** Registry- und Capability-Definitionen gilt: Die Registry enthält
exakt die dreizehn zugelassenen IDs, jede ID besitzt genau einen Status und eine
Evidenzreferenz, unbekannte IDs werden abgelehnt und eine fehlende Capability
wird erst mit eigenem Vertrag, Owner, Scope, Online-Regel, Mutationsregel und
Testgrenze akzeptiert.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**

### Property 2: Neue externe Aufrufe benutzen die bestehende Transportbasis

**For any** neue Capability-Anfrage gilt: Ihr serverseitiger Dispatch erfolgt
über den bestehenden `ai-gateway`-Pfad und die vorhandenen Provider-Adapter;
eine Anfrage erzeugt weder einen parallelen Gateway-/Chatpfad noch eine neue
allgemeine Assistant-Basis.

**Validates: Requirements 2.1, 2.4, 9.1, 9.10**

### Property 3: Ein unveränderter Consent Frame erlaubt Wiederverwendung ohne per-call Bestätigung

**For any** Consent Record und Request gilt: Sind Account, erlaubte
Kategorien, Datenumfang, Zweck und Provider-Rahmen unverändert und ist der
Record aktiv, kann der Request ohne neue Einzelbestätigung fortsetzen; bei
fehlendem, widerrufenem oder verändertem Rahmen wird vor Credit Booking und
Providerzugriff `consent_required` geliefert.

**Validates: Requirements 3.1, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10**

### Property 4: Scope und Food-Rule-Prüfung respektieren Ownership ohne Haushaltssperre

**For any** berechtigte Household-Anfrage gilt: Household-Daten werden nur
innerhalb bestehender Session-, Membership- und RLS-Rechte gelesen, persönliche
Werte stammen ausschließlich vom anfragenden Account und den ausgewählten
Kategorien, und der bestehende Household Food-Rule Snapshot bleibt die
vollständige Sicherheitsprüfung ohne automatische Umdeutung in persönliche
Providerdaten.

**Validates: Requirements 4.1, 4.2, 4.4, 4.5, 4.6, 4.7, 4.9**

### Property 5: Assistant-Kontext, Anhänge und Proposals bleiben begrenzt und read-only

**For any** gültige oder ungültige Kombination aus Page Context, Attachment,
Proposal und aktuellem Domainstand gilt: Nur erlaubte, besitzgeprüfte Kontexte
und Attachments passieren die bestehenden Grenzen, ein Proposal verändert vor
Apply keinen Domainzustand, und ein Apply mit veralteter oder unberechtigter
Evidence wird ohne Mutation abgelehnt.

**Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.7, 5.8**

### Property 6: Import bewahrt Quelle und Review-Grenze

**For any** Importquelle gilt: Eine ausreichende strukturierte Quelle wird vor
einem External Model Call verwendet; ein extern erzeugter Draft bewahrt Quelle,
Felder, Confidence, Warnungen und Status; ohne ausdrückliches Save bleibt die
Household Recipe unverändert.

**Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6**

### Property 7: Capability-Ergebnisse überschreiten weder Zweck- noch Mutationsgrenze

**For any** registrierte Capability-Anfrage gilt: Ihr Ergebnis verwendet nur
den eigenen Zweck und Contract, bleibt bei fehlendem Provider-/Output-Vertrag
unavailable, erzeugt keine direkte Domainmutation und bleibt read-only, wenn
kein passender Domain Apply Path existiert. Capability-spezifische
Review-, Estimate-, Mode-, Origin-, Permission-, Generated- und Visible-Text-
Regeln bleiben dabei erhalten.

**Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13**

### Property 8: Offline-Zustände starten oder puffern keine neuen externen Vorgänge

**For any** Capability-Aktion bei fehlender Verbindung gilt: Ein gültiger
lokaler Zustand darf read-only angezeigt werden, aber es entsteht weder ein
External Model Call noch ein Quellen-/Medienjob, Outbox-Eintrag oder Retry; die
Connectivity-Rückkehr allein löst keinen Vorgang aus und abgelaufene lokale
Ergebnisse bleiben nicht applybar.

**Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.9**

### Property 9: Lokaler Assistant-Storage bleibt accountbezogen und begrenzt

**For all** Sequenzen aus Thread-, Attachment- und Identity-Storage-Operationen
gilt: Es bleiben höchstens 20 Threads im verschlüsselten Account-Storage,
Attachment-Rohbytes gelangen nicht in den Thread, und ein Identity- oder
Household-Wechsel invalidiert aktiven privaten und Household-Kontext vor dem
nächsten External Model Call.

**Validates: Requirements 8.5, 8.6, 8.7, 8.8**

### Property 10: Credits, Refunds und Usage bleiben rückwärtskompatibel

**For any** neue Capability-Ausführung gilt: Entitlement und Credit Booking
verwenden die vorhandene RevenueCat-Regel, ein nutzloses Ergebnis erhält
höchstens einen Refund, eine strukturierte Ausführung ohne External Model Call
bucht keine Credits, und additive Usage-Metadaten bleiben content-frei sowie
kompatibel mit bestehenden Legacy Skill-Werten.

**Validates: Requirements 9.3, 9.4, 9.5, 9.6, 9.8**

### Property 11: Tracking und Child-Tracking erreichen keine neue Daten-Senke

**For any** Request-, Scope-, Resultat- oder Usage-Projektion gilt: Bekannte
Trackingfelder, Trackingquellen, Child-Tracking, tracking-spezifische Context-
Flags und tracking-abgeleitete Providerresultate werden vor Providerzugriff,
Credit Booking, Response, Cache, Draft, Usage und Fehlerartefakt ausgeschlossen;
Safety verwendet nur erlaubte persönliche Präferenzen oder den bestehenden
Household Food-Rule Snapshot.

**Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.8, 10.9**

### Property 12: Bestehende Rezeptvorschläge bleiben außerhalb des neuen Vertragsraums

**For any** neue Assistant-, Import-, Proposal- oder Mediendefinition gilt:
Sie verwendet einen eigenen Namen und eine eigene Version und kann weder den
bestehenden `recipe_suggestion.v1`-Validator noch dessen Route oder Shape als
allgemeines Vertragsformat verändern.

**Validates: Requirements 11.1, 11.3**

### Nicht-property-basierte Schutztests

Die folgenden Kriterien werden absichtlich als Regression, Integration, Smoke
oder Review nachgewiesen und nicht in eine künstliche universelle Property
gezwungen:

- sichtbare Kurzfassung der Einrichtung, vollständige Datenschutzbestimmungen
  und erreichbarer Status in den Einstellungen;
- unveränderte bestehende Route, Screen-, Thread-, Import-, Provider-, RLS-,
  Usage- und Apply-Integrationen;
- vollständige Food-Rule-Snapshot-Abdeckung und vorhandene RLS-Policies;
- vollständige Regression für `recipe_suggestion.v1` und `fam-y918`;
- Prozessschutz für Änderungen ohne belegte Lücke sowie Änderungen, die eine
  separate Freigabe oder separate Spezifikation benötigen;
- statischer Nachweis, dass Provider-, Supabase- und RevenueCat-Secret-Keys
  nicht in Mobile-Code erscheinen.
