# Implementierungsplan: natuerliches-hinzufuegen-von-einkaufsartikeln_V2

Status: Plan zur Umsetzung der freigegebenen Beta-Spec

Quelle: [natuerliches-hinzufuegen-von-einkaufsartikeln_V2.md](./natuerliches-hinzufuegen-von-einkaufsartikeln_V2.md)

Capability Map: [capability-map.md](./capability-map.md)

Beads-Epic: `fam-gbv7`

## Überblick

Die V2 wird als vollständig getrennte Beta umgesetzt. Sie besitzt einen eigenen Einstieg, ein eigenes Gate, eigene lokale Lern-/Session-/Consent-Daten und eine eigene Parser-, Routing- und Workflow-Schicht. Nur ein explizit bestätigter Beta-Output darf über eine schmale Integrationsgrenze in die bestehende Einkaufslisten-Domäne geschrieben werden. Der normale Einkaufsworkflow importiert keinen Beta-Code und bleibt bei deaktivierter Beta unverändert.

Die V2-Tasks werden ausschließlich unter `fam-gbv7` in Beads verfolgt. Dieses Dokument bleibt die fachliche Planquelle und enthält den geordneten Index, die Abhängigkeiten, Checkpoints und Architekturentscheidungen. Die englischen Legacy-Artefakte und ihre Tasks bleiben vollständig getrennt und werden nicht neu angelegt.

## Planannahmen

- Die freigegebene V2-Spec und die Capability Map sind die einzigen fachlichen Quellen für diese Umsetzung.
- Die von Marco festgelegte getrennte Beta hat Vorrang vor einer Integration in den normalen Einkaufsworkflow.
- Der MVP startet mit nativer On-Device-Spracherkennung über einen Adapter. Ein gebündeltes Whisper-Tiny-Modell ist ausdrücklich nachgelagert.
- Der vorhandene lokale SQLite-/Drizzle-/Outbox-Stack sowie die bestehende Shopping-List-Mutation werden wiederverwendet, nicht dupliziert.
- Beta-Lernregeln und Consent sind accountbezogener lokaler Zustand. Sie werden nicht als produktive Präferenzen interpretiert.
- Die vorhandenen Geräte reichen für die primäre Capability-Verifikation aus. Nicht verfügbare On-Device-Fähigkeiten werden über Capability-Mocks und den Text-Fallback geprüft.

## Architekturentscheidungen

1. **Separates Feature-Modul:** Der Code liegt unter `src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/`. Die Produktive Shopping-List-Domäne erhält keine direkte Abhängigkeit auf dieses Modul.
2. **Default-off-Beta-Gate:** Der Beta-Einstieg ist separat und standardmäßig deaktiviert. Ein produktiver Rollout, eine breitere Zielgruppe oder eine Verknüpfung mit bestehender Navigation benötigen eine eigene Freigabe.
3. **Eigener lokaler Namespace:** Beta-Session, Lernregeln, einzelne Bestätigungen, Konflikte, Rückfragen, Consent und Feedback werden unter einem eigenen Namespace im verschlüsselten Account-Speicher gehalten.
4. **Reine Domainlogik:** Parser, Konfidenz, Routing und Lernregeln bleiben deterministische, testbare Funktionen ohne React, Netzwerk oder direkte Listenmutation.
5. **Eine Integrationsgrenze:** Nur `shopping-list-integration` darf bestätigte Ergebnisse an die bestehenden Einkaufslisten-Mutationen und damit an lokale SQLite-/Outbox-Schreibvorgänge übergeben.
6. **Text als erster Vertical Slice:** Der Textpfad beweist den vollständigen lokalen Ablauf mit geringem Plattformrisiko. Sprache liefert später nur ein lokales Transkript in denselben Ablauf.
7. **Datenschutz als harte Grenze:** `requiresOnDeviceRecognition: true`, kein Roh-Audio-Upload, getrennte Einwilligungen und lokale Bereinigung vor jeder optionalen Übertragung.
8. **Keine neue Datenbankoberfläche im MVP:** Eine zusätzliche Supabase-Tabelle, RLS-Policy, SQLite-Spiegeltabelle oder Sync-Entität ist nicht eingeplant. Falls das für spätere Haushalts-Synchronisation nötig wird, ist das eine neue Entscheidung mit eigenem Schema-/RLS-/Outbox-Task.

## Abhängigkeitsgraph

```text
T1 Beta-Verträge/Gate
├── T2 Beta-Speicher
├── T3 Parser
├── T4 Native Speech Adapter
└── T6 Listenadapter

T2 + T3 ──> T5 Routing/Lernen
T2 + T3 + T5 + T6 ──> T7 Text-Workflow
T4 + T7 ──> T8 Sprach-Workflow
T7 ──> T9 Vorschau/Rückfragen
T2 + T7 + T9 ──> T10 Consent/Feedback
T2 + T7 + T9 + T10 ──> T11 Privacy/Qualitätsmetriken
T8 + T9 + T10 + T11 ──> T12 Geräte-/Auslieferungsverifikation
```

## Task-Liste

Die fachlichen Slices, Akzeptanzkriterien und Verifikationsschritte bleiben in diesem Plan dokumentiert. Die Reihenfolge ist verbindlich, parallele Arbeit ist nur innerhalb der angegebenen Abhängigkeiten vorgesehen.

### Phase 1: Foundation und frühes Plattformrisiko

1. **fam-gbv7.1 / T1 — V2 Beta-Verträge und Feature-Gate definieren**
   Abhängigkeiten: keine.
   Capability Map: `beta-isolation`.

2. **fam-gbv7.2 / T2 — Getrennten Beta-Speicher und Sessionzustand anlegen**
   Abhängigkeit: T1.
   Capability Map: `beta-isolation`.

3. **fam-gbv7.3 / T3 — Deterministischen lokalen Einkaufsartikel-Parser implementieren**
   Abhängigkeit: T1.
   Capability Map: `item-parser`.

4. **fam-gbv7.4 / T4 — Native On-Device-Spracherkennung mit Text-Fallback anbinden**
   Abhängigkeit: T1.
   Capability Map: `speech-input`.
   Freigabegate: Native Dependency, Config-Plugin und Dev-Client-Rebuild vor Umsetzung.

### Checkpoint: Foundation

- [ ] Beta-Gate ist default-off und der normale Einkaufsworkflow bleibt importseitig unabhängig.
- [ ] Beta-Storage ist accountbezogen, verschlüsselt und namespace-isoliert.
- [ ] Parser-Testvektoren für mehrere Artikel, Menge, Einheit, Marke und Resttext sind grün.
- [ ] Speech-Capability-Vertrag und Text-Fallback sind getestet.
- [ ] Vor der nativen Umsetzung ist die gesonderte Native-Freigabe dokumentiert.

### Phase 2: Domäne und bestätigter Output

5. **fam-gbv7.5 / T5 — Haushaltsrouting, Lernphase und Konfliktmodus bauen**
   Abhängigkeiten: T2, T3.
   Capability Map: `household-routing-learning`.

6. **fam-gbv7.6 / T6 — Bestätigten Beta-Output über den bestehenden Listenadapter speichern**
   Abhängigkeit: T1.
   Capability Map: `shopping-list-integration`.

7. **fam-gbv7.7 / T7 — Textbasierte Beta als vertikalen Mehrfachartikel-Workflow verbinden**
   Abhängigkeiten: T2, T3, T5, T6.
   Capability Map: `natural-language-addition-workflow`.

### Checkpoint: Lokaler Text-Vertical-Slice

- [ ] `3 Äpfel`, `Brot`, `3x Joghurt` und `4x Skyr von JA` werden lokal in prüfbare Artikel zerlegt.
- [ ] `JA` kann im vorhandenen Haushaltskontext zur REWE-Liste führen; unbekannte oder widersprüchliche Zuordnungen bleiben sichtbar unsicher.
- [ ] Drei getrennte Bestätigungen sind nötig, bevor eine automatische Regel entsteht.
- [ ] Kein unbestätigter Beta-Artikel erreicht den produktiven Listenadapter.
- [ ] Bestätigte Artikel werden mit bestehendem Merge- und Outbox-Verhalten lokal gespeichert.
- [ ] Der vollständige Textablauf ist offline testbar, ohne Native Speech.

### Phase 3: Sprache und Beta-Oberfläche

8. **fam-gbv7.8 / T8 — Sprachpfad an den Beta-Workflow anschließen**
   Abhängigkeiten: T4, T7.
   Capability Map: `speech-input`, `natural-language-addition-workflow`.

9. **fam-gbv7.9 / T9 — Beta-Vorschau und kompakte Artikel-Rückfragen umsetzen**
   Abhängigkeit: T7.
   Capability Map: `natural-language-addition-workflow`.
   UX-Gate: Vor konkreter UI-Implementierung ist ein separater Mock-Review mit Marco erforderlich.

10. **fam-gbv7.10 / T10 — Nutzerfreigabe, widerrufbaren Consent und Beta-Feedback anbinden**
    Abhängigkeiten: T2, T7, T9.
    Capability Map: `household-routing-learning`, `privacy-quality-data`.

### Checkpoint: Beta-Nutzerfluss

- [ ] Text und Sprache laufen durch exakt denselben Parser-/Routing-/Bestätigungsweg.
- [ ] Fehlende On-Device-Fähigkeit lässt den Text-Fallback nutzbar, ohne Cloud-Verarbeitung zu aktivieren.
- [ ] Ab 30 Prozent Unklarheit und mindestens drei Vorschlägen wird gebündelt gefragt.
- [ ] Bei ein oder zwei Artikeln wird keine zusätzliche Sammelunterbrechung ausgelöst.
- [ ] Die Vorschau zeigt pro unklarem Artikel kompakte Alternativen und `Später zuordnen`.
- [ ] Die einmalige Nutzerfrage erscheint erst nach 10–12 einmaligen, einzeln bestätigten Artikel-plus-Marke-Zuordnungen.
- [ ] Widerruf in den Einstellungen stoppt automatische Anwendung, ohne geteilte Regeln ungefragt zu löschen.
- [ ] Für UI-Tests werden die Regeln aus `.agents/rules/react-native-testing-library.md` eingehalten.

### Phase 4: Qualität und Auslieferung

11. **fam-gbv7.11 / T11 — Lokale Qualitätsmetriken und anonymisierte Beta-Daten sichern**
    Abhängigkeiten: T2, T7, T9, T10.
    Capability Map: `privacy-quality-data`.
    Freigabegate: Produktionsausgestaltung der Telemetrie bleibt bis zur offenen Entscheidung außerhalb des MVP-Releases.

12. **fam-gbv7.12 / T12 — Beta auf verfügbaren iOS-/Android-Targets verifizieren und auslieferbar machen**
    Abhängigkeiten: T8, T9, T10, T11.
    Capability Map: alle Module.
    Freigabegate: keine breitere Aktivierung und keine Modellübernahme ohne separate Freigabe.

### Checkpoint: Auslieferungsfreigabe

- [ ] `bun run check` ist grün.
- [ ] `bun run typecheck` ist grün.
- [ ] Alle geänderten Domain-, Service-, Workflow- und UI-Tests laufen als fokussierte `bun run test <datei>`-Aufrufe.
- [ ] Relevante SQLite-/Outbox-Integrationstests sind grün.
- [ ] iOS und Android zeigen dasselbe Gate-, Capability- und Text-Fallback-Verhalten.
- [ ] Roh-Audio verlässt das Gerät nicht.
- [ ] Content- und Qualitätsdaten haben getrennte, widerrufbare Einwilligungen.
- [ ] Die Zielmetriken sind aus Test-/Pilotdaten berechenbar: mindestens 95 Prozent korrekte Zuordnungen, höchstens 1 Prozent falsche Listen, höchstens 10 Prozent manuelle Korrekturen, median höchstens 6 Sekunden.
- [ ] Nur explizit bestätigte Artikel erreichen reale Einkaufslisten.
- [ ] Produktions-Telemetrie, Whisper Tiny und ein alternatives Modell sind als separate spätere Entscheidungen dokumentiert.

## Verifikationsstrategie

Jeder Beads-Task trägt seine fokussierte Test- und Build-Verifikation. Die Umsetzung folgt diesem Muster:

1. Reine Domainlogik zuerst mit festen Testvektoren und ohne React-/Native-Abhängigkeit.
2. Beta-Storage und Integrationsgrenzen mit isolierten Mocks bzw. lokaler SQLite testen.
3. Den Textpfad end-to-end testen, bevor Sprache und UI-Komplexität hinzukommen.
4. RNTL-Tests erst nach dem Mock-Review und gemäß den lokalen Testregeln schreiben.
5. Native Capability und Offline-Verhalten in vorhandenen iOS-/Android-Development-Builds prüfen.
6. Keine vollständige Jest-Suite ohne konkreten Anlass; niemals `bun test`.
7. Keine manuelle Supabase-Migration. Ein späterer Datenbankbedarf eröffnet einen neuen, separat freizugebenden Schema-/RLS-/Sync-Task.

## Risiken und Gegenmaßnahmen

| Risiko | Auswirkung | Gegenmaßnahme |
| --- | --- | --- |
| On-Device-STT ist auf einem Zielgerät nicht verfügbar | Spracheingabe fehlt oder verletzt die Offline-Anforderung | Capability zur Laufzeit prüfen, Sprache deaktivieren und Text-Fallback sichtbar anbieten; später Tiny nur nach Tests prüfen |
| Native Dependency verändert Fingerprint/Dev-Client | Build- und Geräteverifikation blockiert | Native-Freigabe vor Installation, danach `bun run native:status` und kontrollierter Rebuild |
| Parsing erkennt Marke oder Artikelgrenzen falsch | Falsche Listen oder manuelle Nacharbeit | deterministische Testvektoren, sichtbarer Resttext und Vorschau vor Commit |
| Lernregeln werden zu früh oder durch Wiederholungen gebildet | Falsche automatische Zuordnung | einmalige Einzelzuordnungen zählen, drei Bestätigungen erzwingen, Konfliktmodus beibehalten |
| Beta schreibt versehentlich in Produktion | Daten- und Architekturverletzung | eigener Gate-/Storage-Namespace, Import-Regressionstest und genau eine bestätigte Adaptergrenze |
| Telemetrie enthält identifizierbare Einkaufsinhalte | Datenschutzrisiko und Release-Blocker | lokale Filterung, getrennte Consents, kein Audio, Drop bei unsicherer Payload; Produktionsentscheidung offen halten |
| UI-Aufwand wächst vor stabiler Domainlogik | Rework und Scope-Ausweitung | Text-Vertical-Slice zuerst, Mock-Review vor UI-Implementierung, UI bleibt separat vom Listenadapter |

## Offene Entscheidungen und Freigabegates

- Die konkrete Produktionsausgestaltung der datenschutzverstärkten Telemetrie ist die einzige offene Frage aus der Spec und muss vor einem Produktionsrelease entschieden werden.
- Die native Abhängigkeit `expo-speech-recognition` sowie ein möglicher Config-Plugin-/Dev-Client-Rebuild benötigen vor der nativen Umsetzung eine gesonderte Freigabe.
- Whisper Tiny ist post-MVP. Ein alternatives lokales Modell wird erst anhand von Tests entschieden und gehört nicht in das MVP-Implementierungsgate.
- Eine spätere Übernahme von Beta-Lernregeln, Beta-Daten oder Beta-Metriken in produktive Systeme ist ein separates Vorhaben.
- Die konkrete UI darf erst nach dem Mock-Review mit Marco umgesetzt werden.

## Definition of Done für diese Planung

- [ ] Der deutsche V2-Plan ist unter `fam-gbv7` mit `fam-gbv7.1` bis `fam-gbv7.12` verknüpft; englische Legacy-Tasks bleiben gelöscht und getrennt.
- [ ] Kein Task ist als unteilbares XL-Paket formuliert; die fachlichen Slices bleiben einzeln testbar.
- [ ] Checkpoints liegen nach den Foundation-, Text- und Beta-Nutzerfluss-Phasen.
- [ ] Plan, Spec und Capability Map verweisen eindeutig aufeinander.
- [ ] Der Plan verändert keine Implementierungsdateien, Datenbankschemas oder nativen Abhängigkeiten.
- [ ] Gesperrte Alt-Artefakte und gleichnamige fremde Specs/Pläne/Epics sind nicht Teil des Plans.
