# Spec: natuerliches-hinzufuegen-von-einkaufsartikeln_V2

Status: Freigegeben, Beta-Scope

## Herkunft und Zuordnung

- Produktquelle: [natuerliches-hinzufuegen-von-einkaufsartikeln.md](../../ideas/natuerliches-hinzufuegen-von-einkaufsartikeln.md)
- Capability Map: [capability-map.md](./capability-map.md)
- Initiative: `natuerliches-hinzufuegen-von-einkaufsartikeln_V2`
- Auslieferungsentscheidung: getrennte Beta, nicht Teil des normalen Einkaufsworkflows
- Diese Spec konkretisiert ausschließlich die genannte Idea-Datei. Andere gleichnamige Specs, Pläne oder Beads-Epics werden nicht herangezogen.

Die Idea-Datei bleibt die Quelle der Produktabsicht. Diese Spec ist der prüfbare technische und fachliche Vertrag für die spätere Umsetzung. Sie darf den dort festgelegten MVP-Scope nicht stillschweigend erweitern.

Die getrennte Beta ist eine zusätzliche Auslieferungsentscheidung des Maintainers. Sie erweitert nicht die Produktidee, sondern begrenzt deren erste Umsetzung: eigener Einstieg, eigene Beta-Daten und eigene Qualitätsauswertung. Bestätigte Artikel dürfen für realistische Tests über den bestehenden Einkaufslisten-Adapter in reale Listen geschrieben werden. Alles davor und daneben bleibt von produktiven Lernregeln, produktiver Telemetrie und dem normalen Einkaufsworkflow getrennt.

## 1. Ziel

Nutzer eines gemeinsamen Haushalts sollen in der App mehrere Einkaufsartikel schnell per Sprache oder Text hinzufügen können. Die Eingabe soll Artikelname, Menge, Einheit und optional Marke erkennen, die richtige Haushalts-Einkaufsliste über gelerntes Verhalten auswählen und möglichst ohne Nachbearbeitung gespeichert werden.

Beispiele:

- `3 Äpfel` → Artikel `Äpfel`, Menge `3`
- `Brot` → Artikel `Brot`, Standardmenge `1`
- `3x Joghurt` → Artikel `Joghurt`, Menge `3`
- `4x Skyr von JA` → Artikel `Skyr`, Menge `4`, Marke `JA`, Zuordnung zur REWE-Liste
- `4x Skyr` → Artikel `Skyr`, Menge `4`, Zuordnung über das gelernte Nutzer-/Haushaltsverhalten, zum Beispiel REWE

Das Verfahren ist zweistufig:

1. Neue Zuordnungen werden zunächst einzeln bestätigt und gelernt.
2. Nach 10 bis 12 einmaligen, einzeln bestätigten Artikel-plus-Marke-Zuordnungen fragt die App den jeweiligen Nutzer einmalig, ob eindeutige Zuordnungen automatisch angewendet werden dürfen. Diese Entscheidung ist in den Einstellungen widerrufbar.

## 2. Beta-Isolation

Diese Funktion wird vollständig als Beta implementiert und ausgeliefert.

- Der Beta-Flow besitzt einen eigenen Einstieg und ein eigenes Feature-Gate, zum Beispiel `natural_language_addition_beta`, und ist im normalen Einkaufsworkflow standardmäßig deaktiviert.
- Beta-Code liegt unter einem eigenen Feature-Bereich. Beta hat eigene Parser-, Lern- und Zustandslogik. Der bestehende Einkaufsworkflow erhält keine direkte Abhängigkeit auf Beta-Code.
- Beta-Lernregeln, Bestätigungen, Konflikte, Rückfragen, Consent-Zustände und Feedback liegen in einem eigenen lokalen Storage-Namespace. Sie werden nicht als produktive Lernregeln interpretiert.
- Beta-Telemetrie und anonymisierte Inhaltsdaten besitzen einen eigenen Namespace und dürfen nicht in produktive Qualitätsmetriken einfließen.
- Die einzige gemeinsame Grenze ist `shopping-list-integration`: Nach expliziter Bestätigung darf sie fertige Beta-Artikel atomar an bestehende Einkaufslisten übergeben.
- Die Beta darf keine unbestätigten, unklaren oder konfliktbehafteten Artikel in reale Listen schreiben.
- Deaktivieren des Beta-Gates lässt den bestehenden Einkaufsworkflow unverändert und entfernt keine produktiven Daten.
- Eine spätere Übernahme von Beta-Lernregeln, Daten oder Metriken in Produktion ist eine separate Entscheidung und nicht Bestandteil dieser Spec.

## 3. MVP-Scope und Grenzen

### Im MVP

- Spracheingabe unterwegs; das lokale Transcript ist die einzige Nutzereingabe.
  Parser- und Reparse-Tests dürfen feste Textfixtures verwenden, aber es gibt
  keine manuelle Texteingabe als Produkt-Fallback.
- Mehrere Artikel aus einer Eingabe.
- Lokale, deterministische Erkennung von Artikelname, Menge, Einheit und Marke.
- Native On-Device-Spracherkennung über einen Adapter für `expo-speech-recognition@^57.0.0`.
- `requiresOnDeviceRecognition: true` als harte Datenschutz- und Offline-Anforderung.
- Laufzeitprüfung der Fähigkeiten. Wenn On-Device-Erkennung nicht verfügbar ist,
  zeigt der Speech-Einstieg einen klaren Nichtverfügbarkeits- bzw. Fehlerzustand.
- Lokale Einkaufslisten-Zuordnung mit Haushaltskontext, Best Match und Konfidenz.
- Gemeinsame Vorschau vor dem Speichern, wenn Artikel unklar oder widersprüchlich sind.
- Lokale SQLite-Verarbeitung mit bestehendem Outbox-Sync.
- Roh-Audio bleibt auf dem Gerät.

### Nach dem MVP

- Ein gebündeltes, lokales Whisper-Tiny-Modell für Geräte- und Sprachabdeckung.
- Optionaler Download eines anderen lokalen Modells nach Tests mit Tiny. Das konkrete Alternativmodell wird erst anhand der Testergebnisse entschieden.
- Produktionsausgestaltung der datenschutzverstärkten Telemetrie.

### Nicht im Scope

- Cloud-KI als notwendige Verarbeitung.
- Dialogischer Einkaufsassistent.
- Automatisches Speichern bei unklarer oder widersprüchlicher Listen-Zuordnung.
- Sofortiges Erzeugen einer Lernregel aus einer einzelnen Vorschauauswahl.
- Aktivierung für alle Nutzer oder Vermischung mit produktiven Lernregeln vor einer separaten Freigabe.

## 4. Technischer Stack und Quellen

- Expo SDK 57, React Native 0.86 und React 19.2.
- Bestehende Shopping-List-Domäne für Artikel, Listen, Produkt-/Markenbezug und Merge-Verhalten.
- Lokale SQLite-Spiegelung mit Drizzle unter `src/lib/db/` sowie Outbox-Sync über `src/lib/sync/`.
- Supabase bleibt Synchronisationsziel für geteilte Haushaltsdaten. Private Daten dürfen nicht in Haushaltsdaten oder gemeinsame Lernregeln einfließen.
- Spracheingangsadapter: [`expo-speech-recognition`](https://github.com/jamsch/expo-speech-recognition)
  ist als native Abhängigkeit integriert und im Dev-Client registriert.
- [`expo-audio`](https://docs.expo.dev/versions/v57.0.0/sdk/audio/) ist für Aufnahme und Wiedergabe relevant, ersetzt aber keine Spracherkennung.
- [`expo-speech`](https://docs.expo.dev/versions/v57.0.0/sdk/speech/) ist Text-to-Speech und kein Spracheingang.
- Späteres alternatives lokales Speech-Modell: [`react-native-executorch Getting Started`](https://docs.swmansion.com/react-native-executorch/docs/fundamentals/getting-started) und [`Speech to Text`](https://docs.swmansion.com/react-native-executorch/docs/extensions/speech-to-text). Das ist nicht Teil des MVP-Speech-Pfads.

Das Hinzufügen einer nativen Abhängigkeit, eines Config-Plugins oder eines lokalen ML-Modells erfordert eine gesonderte Freigabe und einen Dev-Client-Rebuild.

## 5. Ausführbare Befehle

Die spätere Umsetzung verwendet diese Repository-Befehle:

```bash
bun run check
bun run typecheck
bun run test <gezielte-testdatei>
bun run test:integration -- <gezielte-integration-testdatei>
bun run native:status
bun run native:dev -- --target ios-development-simulator
```

Für Android wird das vorhandene Development-Target des Repositories verwendet. Es werden gezielte Tests ausgeführt, keine vollständige Testsuite ohne Anlass. `bun test` ist nicht zulässig.

## 6. Projektstruktur

Die spätere Implementierung wird feature-first strukturiert:

```text
src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/
  components/       # Vorschau und kompakte Rückfrage pro Artikel
  domain/           # Parser, Konfidenz, Lern- und Konfliktregeln
  hooks/            # React-Query-/Workflow-Anbindung
  services/         # Spracheingangsadapter und lokale Datenaufbereitung
  types.ts          # öffentliche Modulverträge
  *.test.ts         # fokussierte Domain- und Service-Tests

src/features/shopping-list/  # bestehender Einkaufsworkflow und Listenadapter
src/lib/db/                  # lokale SQLite-Spiegelung und Outbox-Grenze
src/lib/sync/                # Synchronisation der geteilten Haushaltsdaten
docs/ideas/natuerliches-hinzufuegen-von-einkaufsartikeln.md  # Produktquelle
docs/specs/natuerliches-hinzufuegen-von-einkaufsartikeln_V2/ # diese V2-Artefakte
```

Neue Module dürfen keine zweite Styling-Runtime, kein zweites Datenzugriffsmodell und keine parallele Shopping-List-Mutation einführen.

## 7. Code-Stil und Kernverträge

Die reine Parser- und Routinglogik bleibt lokal, deterministisch und ohne React-Abhängigkeit. Sie verwendet konkrete Typen und gibt keine halbfertigen Domänenobjekte zurück.

```ts
export type ParsedShoppingItem = {
  name: string;
  quantity: number;
  unit: string | null;
  brand: string | null;
};

export type ParseResult = {
  items: readonly ParsedShoppingItem[];
  unparsedText: string | null;
};

export function parseShoppingInput(input: string): ParseResult {
  // Reine, lokale und deterministische Funktion.
  return { items: [], unparsedText: input.trim() || null };
}
```

Der Beispielkörper ist nur der Vertragsschnitt, keine Implementierung. In der Umsetzung gilt zusätzlich:

- keine `any`-Typen;
- keine versteckten Netzwerkaufrufe im Parser oder Spracheingang;
- Unistyles bleibt die einzige Styling-Runtime;
- bestehende Shopping-List-Mutationen und Outbox-Transaktionen werden wiederverwendet;
- Unsicherheit wird als Datenzustand modelliert, nicht durch stilles Raten verdeckt.

## 8. Fachliche Regeln

### 7.1 Parsing

- Eine Eingabe kann null, einen oder mehrere Artikel enthalten.
- Artikelname und Menge sind die minimalen Felder. Einheit und Marke sind optional.
- Fehlende Menge erhält den bestehenden fachlichen Standardwert `1`, ohne eine Marke oder Liste zu erfinden.
- Schreibvarianten wie `4x`, `4 x` und `4` vor dem Artikelnamen werden normalisiert.
- `Skyr von JA` erkennt `Skyr` als Artikel und `JA` als Marke.
- Nicht parsebarer Rest bleibt sichtbar und wird nicht verworfen.

### 7.2 Zuordnung

- Markenwissen darf die Listenwahl beeinflussen. `JA` führt als REWE-Eigenmarke zur REWE-Liste, sofern der Haushaltskontext diese Liste kennt.
- Ein Artikel ohne Marke darf aus dem bestätigten Einkaufsverhalten zugeordnet werden.
- Zuordnungen sind haushaltsweit teilbar, aber die automatische Anwendung ist pro Nutzer freigebbar.
- Konfidenz wird mit der Zuordnung gespeichert. Ein Best Match mit Fragezeichen bedeutet sichtbar unsicher und ist keine automatische Entscheidung.

### 7.3 Lernen und Rückfragen

- Die Lernphase zählt 10 bis 12 einmalige, einzelne Artikel-plus-Marke-Zuordnungen, die der Nutzer jeweils bestätigt hat. Wiederholungen desselben Artikels zählen nicht zusätzlich.
- Nach Erreichen des Schwellenwerts fragt die App den Nutzer einmalig nach der automatischen Anwendung.
- Ein Nutzer kann die Freigabe in den Einstellungen widerrufen. Der Widerruf stoppt automatische Anwendung für diesen Nutzer, löscht aber nicht ungefragt die geteilten Haushaltsregeln.
- Eine neue automatische Haushaltsregel entsteht erst nach drei Bestätigungen in getrennten Eingaben.
- Bei widersprüchlichen Bestätigungen greift der Mehrheits- und Konfliktmodus: klare Mehrheit darf übernehmen; ohne klare Mehrheit bleibt die Zuordnung unklar und zeigt Alternativen.
- Ab 30 Prozent Unklarheit und mindestens drei verfügbaren Vorschlägen zeigt die App eine gebündelte Rückfrage für die Eingabe. Bei nur ein oder zwei Artikeln wird keine zusätzliche Sammelrückfrage erzwungen.
- Unklare oder widersprüchliche Artikel verbleiben in der gemeinsamen Vorschau und benötigen eine kompakte Auswahl pro Artikel oder „Später zuordnen“.
- Eine Vorschauauswahl wird nicht sofort als neue Lernregel gespeichert.

### 7.4 Speichern und Offline

- Erst nach Bestätigung schreibt der Workflow alle bestätigten Artikel in einer lokalen Transaktion.
- Der bestehende Merge- und Outbox-Mechanismus bleibt die einzige Schreibgrenze für Einkaufslisten.
- Offline-Erstellung ist sofort sichtbar und wird später idempotent synchronisiert.
- Ein teilweises Speichern ohne klaren Status ist nicht erlaubt.

### 7.5 Datenschutz und Datenlernen

- Roh-Audio verlässt das Gerät nicht.
- Qualitätsmetriken und pseudonymisierte Inhaltsdaten benötigen getrennte, widerrufbare Einwilligungen.
- Ohne Einwilligung werden keine entsprechenden Uploads erzeugt.
- Vor einer Übertragung filtert das Gerät auf eine Allowlist von Einkaufsfeldern. Verdächtige oder indirekt identifizierende Inhalte werden entfernt; falls dadurch kein sicherer Payload bleibt, wird das Ereignis lokal verworfen.
- Der Widerruf stoppt zukünftige Uploads. Pseudonymisierte Quelldaten werden innerhalb von 90 Tagen gelöscht. Bereits ausgelieferte Modellversionen bleiben im MVP unverändert.
- Die konkrete Produktionsausgestaltung der Telemetrie bleibt bewusst offen und ist kein MVP-Auslieferungsblocker.

## 9. Teststrategie

### Domänentests

- Parser: einzelne und mehrere Artikel, Mengenvarianten, Einheiten, Marken, deutscher Text, nicht parsebarer Rest und leere Eingabe.
- Routing: Markenpriorität, gelernte Artikel ohne Marke, Best Match, Konfidenz über 30 Prozent Unklarheit und Konfliktzustand.
- Lernen: 10 bis 12 einmalige Bestätigungen, Wiederholungen ohne Zählung, drei getrennte Bestätigungen, klare Mehrheit und Patt/Konflikt.
- Nutzerfreigabe: einmalige Frage, automatische Anwendung pro Nutzer, Widerruf und unveränderte Haushaltsregel.
- Beta-Isolation: Feature-Gate, unveränderter Normalworkflow, separater Storage-/Telemetry-Namespace und keine Übernahme in produktive Lernregeln.

### Workflow- und Integrationstests

- Text-/Transkript-Eingabe mit mehreren Artikeln bis zur lokalen Listenansicht.
- Bestätigung speichert mehrere Artikel atomar und nutzt Merge sowie Outbox.
- Offline-Eingabe erscheint lokal und synchronisiert später ohne Duplikate.
- Unklare Artikel zeigen die gemeinsame Vorschau, Einzeloptionen und „Später zuordnen“.

### Native und Datenschutztests

- iOS und Android Development Build: Berechtigungen, Verfügbarkeit, On-Device-Gate und Abbruchverhalten.
- Der Adapter setzt `requiresOnDeviceRecognition: true` und nutzt keinen Cloud-Fallback.
- Auf nicht unterstützten Geräten zeigt der Speech-Einstieg einen klaren Nichtverfügbarkeits- bzw. Fehlerzustand. Der Speech-Pfad öffnet keine manuelle Texteingabe und verwendet keinen Netzwerk-Fallback. Da aktuell nicht alle Capability-Varianten als reale Geräte vorhanden sind, wird dieser Zustand zusätzlich über Capability-Mocks verifiziert.
- Telemetrie-Payloads enthalten niemals Audio und respektieren beide Einwilligungen, Allowlist-Filter, Widerruf und Idempotenz.

## 10. Grenzen und Freigaben

### Immer

- Lokal zuerst und offline-fähig arbeiten.
- Nur On-Device-Spracherkennung verwenden, wenn Sprache aktiviert ist.
- Mehrere erkannte Artikel als überprüfbare Liste behandeln.
- Unklarheit, Konfidenz und Konflikte sichtbar machen.
- Bestehende Haushalts-/Privatdatentrennung, lokale Transaktion und Outbox-Sync einhalten.
- Beta nur über den separaten Einstieg und das Feature-Gate ausführen.
- Beta-Lern-, Consent-, Feedback- und Telemetriedaten getrennt halten.
- Reale Einkaufslisten nur über den bestehenden Adapter und erst nach expliziter Bestätigung verändern.

### Vorher fragen

- Neue native Abhängigkeit, Config-Plugin oder Änderung des Dev-Clients.
- Gebündeltes Whisper-Tiny-Modell oder späteres alternatives lokales Modell.
- Änderung an Supabase-Schema, RLS, SQLite-Spiegel oder Sync-Vertrag.
- Änderung an Schwellenwerten, Einwilligungstexten, Aufbewahrung oder Produktions-Telemetrie.
- Abweichung vom Speech-only-Vertrag oder von `requiresOnDeviceRecognition: true`.
- Aktivierung für eine breitere Nutzergruppe oder Übernahme von Beta-Daten in Produktion.

### Niemals

- Roh-Audio oder notwendige Einkaufsverarbeitung an einen Cloud-KI-Dienst senden.
- Unsichere oder widersprüchliche Zuordnungen automatisch speichern.
- Eine einzelne Vorschauauswahl als sofortige Lernregel werten.
- Nutzer durch Rückfragen bei nur ein oder zwei Artikeln unnötig unterbrechen.
- Private Tracking-Daten in geteilte Haushaltsregeln oder Einkaufsereignisse übernehmen.
- Den normalen Einkaufsworkflow direkt von Beta-Code abhängig machen.
- Beta-Lernregeln, Beta-Telemetrie oder Beta-Feedback stillschweigend als produktive Daten verwenden.
- Unbestätigte Beta-Artikel in reale Einkaufslisten schreiben.
- Deklarative Supabase-Migrationen manuell schreiben.
- `bun test` verwenden oder die vollständige Testsuite ohne begründeten Anlass ausführen.
- Nicht zu dieser V2 gehörende Specs, Pläne oder Beads-Epics verändern.

## 11. Erfolgskriterien

| ID | Kriterium | Verifikation |
| --- | --- | --- |
| `SC-01` | Mehrere Artikel aus einer natürlichen Eingabe werden korrekt in einzelne Datensätze zerlegt. | Parser- und Workflow-Tests mit den Beispielinputs |
| `SC-02` | Mindestens 95 Prozent der Zuordnungen werden korrekt erkannt. | Bewerteter Testdatensatz mit gespeicherter Zuordnungsentscheidung |
| `SC-03` | Höchstens 1 Prozent der Artikel landen in der falschen Einkaufsliste. | Bewerteter Testdatensatz, getrennt von `SC-02` auswertbar |
| `SC-04` | Höchstens 10 Prozent der gespeicherten Artikel benötigen manuelle Korrektur. | Workflow-Metrik aus Test- und Pilotdaten |
| `SC-05` | Die mediane Zeit bis zum Hinzufügen beträgt höchstens 6 Sekunden. | Instrumentierter lokaler Flow vom Submit bis zum sichtbaren Eintrag |
| `SC-06` | Nach 10 bis 12 einmaligen, einzeln bestätigten Zuordnungen wird pro Nutzer einmalig gefragt; die Freigabe ist widerrufbar. | Lern- und Preference-Tests |
| `SC-07` | Ab 30 Prozent Unklarheit und bei mindestens drei Vorschlägen erscheint eine gebündelte Rückfrage; bei ein oder zwei Artikeln nicht automatisch. | Schwellenwerttests |
| `SC-08` | Automatische Regeln benötigen drei getrennte Bestätigungen; Konflikte ohne klare Mehrheit bleiben unsicher. | Lern- und Konflikttests |
| `SC-09` | Sprache wird nur mit positiver On-Device-Fähigkeit und gesetztem On-Device-Gate angeboten; sonst erscheint ein klarer Fehler-/Nichtverfügbarkeitszustand ohne manuelle Texteingabe. | Capability-Mocks plus iOS-/Android-Development-Build |
| `SC-10` | Kein Roh-Audio verlässt das Gerät. Lokale Qualitätsmetriken bleiben separat einwilligungsfähig und widerrufbar; Produktions-Telemetrie ist im MVP deaktiviert. | Storage-, Payload- und Consent-Tests |
| `SC-11` | Eine Produktionsentscheidung für datenschutzverstärkte Telemetrie ist vor dem Produktions-Release dokumentiert. | Offene Entscheidung und Release-Checkliste |
| `SC-BETA-01` | Die Beta ist standardmäßig deaktiviert und kann den normalen Einkaufsworkflow nicht verändern. | Feature-Gate- und Regressionstests |
| `SC-BETA-02` | Beta-Lernregeln, Consents, Feedback und Telemetrie bleiben in einem getrennten Namespace und werden nicht produktiv ausgewertet. | Storage-/Telemetry-Isolationstests |
| `SC-BETA-03` | Nur explizit bestätigte Beta-Artikel erreichen über den bestehenden Adapter reale Einkaufslisten. | Workflow- und Adaptertests |
| `SC-BETA-04` | Eine Deaktivierung der Beta lässt produktive Einkaufslisten und produktive Lernregeln unverändert. | Gate-Off-Regressionstest |

## 12. Traceability Matrix

Jede fachliche Aussage wird auf die Idea-Datei zurückgeführt und genau einem primären Capability-Modul zugewiesen.

| Quell-ID | Abschnitt in `natuerliches-hinzufuegen-von-einkaufsartikeln.md` | Primäres Modul | Spec-Abdeckung |
| --- | --- | --- | --- |
| `SRC-01` | Zielgruppe und Situation | `natural-language-addition-workflow` | Ziel, Scope, `SC-01`, `SC-05` |
| `SRC-02` | Erfolg: mehrere Artikel und wenig Nachbearbeitung | `natural-language-addition-workflow` | Ziel, `SC-01`, `SC-04`, `SC-05` |
| `SRC-03` | Natürliche Beispiele mit Menge und Marke | `item-parser` | Parsing-Regeln, `SC-01` |
| `SRC-04` | Automatische Listenwahl aus Artikel-/Markenverhalten | `household-routing-learning` | Zuordnungsregeln, `SC-02`, `SC-03` |
| `SRC-05` | Lokale und Offline-Verarbeitung | `speech-input` | MVP-Scope, `SC-09` |
| `SRC-06` | 10 bis 12 einmalige bestätigte Zuordnungen | `household-routing-learning` | Lernregeln, `SC-06` |
| `SRC-07` | Nutzerbezogene einmalige, widerrufbare Freigabe | `household-routing-learning` | Lernregeln, Grenzen, `SC-06` |
| `SRC-08` | Unklarheitsschwelle plus mindestens drei Vorschläge | `natural-language-addition-workflow` | Rückfragen, `SC-07` |
| `SRC-09` | Drei Bestätigungen, Mehrheit und Konfliktmodus | `household-routing-learning` | Lernregeln, `SC-08` |
| `SRC-10` | Native On-Device-Erkennung im MVP | `speech-input` | Tech Stack, Native Tests, `SC-09` |
| `SRC-11` | Whisper Tiny gebündelt nach dem MVP, alternatives Modell nach Tests | `speech-input` | Nach-MVP-Scope und Freigabegrenzen |
| `SRC-12` | Getrennte Einwilligungen, lokale Aggregation, Anonymisierung, kein Audio-Upload | `privacy-quality-data` | Datenschutzregeln, `SC-10`, `SC-11` |
| `SRC-13` | Zielmetriken 95/1/10 Prozent und 6 Sekunden | `privacy-quality-data` | Erfolgskriterien `SC-02` bis `SC-05` |
| `SRC-14` | Offene Produktionsfrage zur Telemetrie | `privacy-quality-data` | Nach-MVP-Scope, `SC-11`, offene Fragen |
| `DEC-01` | Maintainer-Entscheidung: Umsetzung als komplett separate Beta | `beta-isolation` | Beta-Isolation, `SC-BETA-01` bis `SC-BETA-04` |

## 13. Offene Fragen

1. Welche konkrete Ausgestaltung erhält die datenschutzverstärkte Telemetrie für die Produktionsauslieferung?

Diese Frage wurde bewusst vertagt. Bis zur Entscheidung bleibt die Produktions-Telemetrie außerhalb des MVP-Auslieferungsschnitts. Die Modellwahl nach Whisper Tiny wird anhand von Tests entschieden und ist daher eine spätere Validierungsentscheidung, keine zusätzliche MVP-Anforderung.

## 14. Freigabestatus

Capability Map und Spec wurden gemeinsam geprüft und für die getrennte Beta sowie deren Implementierungsplanung freigegeben. Der abgeschlossene Implementierungsplan liegt im Archiv unter [natuerliches-hinzufuegen-von-einkaufsartikeln_V2_plan.md](../../../tasks/archive/natuerliches-hinzufuegen-von-einkaufsartikeln_V2_plan.md). Die Umsetzung bleibt vom normalen Einkaufsworkflow getrennt.

Die offene Frage zur Produktions-Telemetrie sowie Entscheidungen über Whisper Tiny, alternative lokale Modelle, eine breitere Aktivierung und eine spätere Übernahme in Produktion bleiben separate Freigabegates.
