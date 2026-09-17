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

### Beta-Override für den aktuellen Sprachtestpfad

Der aktuelle Beta-Testpfad verwendet vorübergehend `requiresOnDeviceRecognition: false`, damit die native Spracherkennung auf den verfügbaren Geräten unabhängig von der On-Device-Capability getestet werden kann. Das bedeutet: Die Erkennung darf den nativen Netzwerkdienst verwenden; der Adapter lädt selbst kein Roh-Audio hoch und protokolliert weder Audio noch vollständige Transkripte. Dieser Override ist ausschließlich für die Beta und hebt die Produktionsgrenze aus Entscheidung 7 nicht auf. Vor einer produktiven Aktivierung müssen On-Device-Erkennung mit Capability-Fallback oder ein ausdrücklich dokumentierter Netzwerkdienst mit passender Einwilligung entschieden und verifiziert werden.

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

## Planergänzung: TestFlight-Feedback zu Speech und Sheets (2026-09-17)

Diese Ergänzung erweitert denselben V2-Scope. Der bestehende, unabhängige
Maestro-Plan unter `tasks/plan.md` bleibt unverändert.

### Beobachtete Evidenz

- Das isolierte Expo-Beispiel läuft auf iOS mit `de-DE`, `interimResults: true`,
  `maxAlternatives: 3`, `continuous: true`,
  `requiresOnDeviceRecognition: false` und `addsPunctuation: true`.
- Die Beispielausgabe zeigt trotzdem ein unpunktiertes Gesamt-Transcript wie
  `Apfelkuchen nehme ich Eier Wasser`. `addsPunctuation` ist damit kein
  verlässlicher Artikeltrenner.
- Der aktuelle Produktiv-Adapter beendet die Session beim ersten finalen
  Ergebnis und startet mit `continuous: false`. Das weicht vom funktionierenden
  Referenz-Lifecycle ab.
- `CloseButton` verwendet das zentrale `ui.tsx`-Primitiv, dessen globaler
  Layout-Contract in diesem Arbeitsabschnitt nicht verändert werden darf. Die
  beiden Beta-Sheets erhalten deshalb eine eigene, lokal zentrierte
  Close-Aktion auf Basis des bestehenden `Press`-Primitivs.
- Beide Beta-Sheets verwenden `@expo/ui` ohne `snapPoints`. Dadurch werden sie
  an den Inhalt angepasst und sind bei langen Inhalten nicht zuverlässig
  vergrößerbar bzw. scrollbar.

### Architekturentscheidungen für die Ergänzung

1. `ui.tsx` bleibt unverändert. Die beiden Feature-Sheets verwenden eine
   gemeinsame lokale Close-Aktion mit mindestens 44 x 44 Touchfläche und
   expliziter horizontaler und vertikaler Zentrierung.
2. Die beiden vorhandenen `@expo/ui`-Sheets behalten ihre native Präsentation
   und erhalten `snapPoints={['half', 'full']}` sowie einen begrenzten
   `ScrollView`-Inhalt. Eine neue Sheet-Library oder ein eigener Drag-
   Mechanismus ist nicht vorgesehen.
3. Die Preview erhält ein editierbares Roh-Transcript. Eine Änderung wird über
   den bestehenden Parser und das bestehende Routing neu geprüft. Dadurch gibt
   es keine zweite Parserlogik und keine veralteten lokalen Schattenartikel.
4. Sprache sammelt bei `continuous: true` finale Ergebnisstücke bis zum
   expliziten Fertig-Signal. Erst der vollständige `end`-Übergang öffnet die
   Preview.
5. Eine automatische Trennung an beliebigen Leerzeichen wird ausdrücklich nicht
   eingeführt. Ein unpunktiertes Ergebnis kann semantisch nicht zuverlässig in
   Artikel zerlegt werden. Die editierbare Preview ist der sichere Fallback.

### Geordnete Ergänzungstasks

#### Slice A: `fam-gbv7.18` - Close-Aktion in den Beta-Sheets zentrieren

**Abhängigkeiten:** keine.

**Akzeptanz:** Das X ist in Eingabe- und Preview-Sheet horizontal und vertikal
zentriert. Die wirksame Touchfläche bleibt mindestens 44 x 44. Ein fokussierter
UI-/Style-Test schützt den zentralen Contract.

**Verifikation:** Fokussierter Test für die lokale Sheet-Close-Aktion, anschließend iOS-
Screenshot im bestehenden Dev-/TestFlight-Ziel. Kein weiterer Build nur für
diese Planungsänderung.

#### Slice B: `fam-gbv7.19` - Eingabe und Preview vergrößerbar, scrollbar und tastaturfest

**Abhängigkeit:** `fam-gbv7.18`.

**Akzeptanz:** Beide Sheets öffnen bei `half`, lassen sich auf `full` ziehen und
scrollen den Inhalt innerhalb der nativen Höhe. Das Textfeld und die unteren
Aktionen bleiben mit geöffneter Tastatur erreichbar. Dismiss synchronisiert
weiterhin den kontrollierten Consumer-State.

**Verifikation:** Fokussierte RNTL-Assertions für `snapPoints` und den
Scrollcontainer; danach ein manueller iOS- und Android-Lauf mit vielen Preview-
Artikeln, Drag auf full, Scroll, Tastatur und Dismiss.

#### Slice C: `fam-gbv7.17` - Roh-Transcript in der Preview bearbeiten und neu prüfen

**Abhängigkeit:** `fam-gbv7.19`.

**Akzeptanz:** Das erkannte Transcript kann vor der Bestätigung geändert werden.
Eine erneute Prüfung erzeugt Artikel, Mengen, Einheiten, Marken und Routing
aus dem neuen Text. Alte Auswahlzustände werden nicht fälschlich auf geänderte
Artikel übernommen. Nur die aktuell bestätigten editierten Artikel erreichen
den bestehenden Listenadapter.

**Verifikation:** Erst ein fokussierter Workflow-Test für Reparse und Routing,
dann ein RNTL-Test für Editieren, erneute Prüfung und Bestätigung. Der
produktive Adapter bleibt unverändert.

#### Slice D: `fam-gbv7.20` - Speech-Lifecycle an das Expo-Beispiel angleichen

**Abhängigkeiten:** `fam-gbv7.8` und `fam-gbv7.15`.

**Akzeptanz:** Der Adapter verwendet den geprüften Referenz-Lifecycle mit
`de-DE`, Interim-Ergebnissen, `maxAlternatives: 3`, `continuous: true`,
`requiresOnDeviceRecognition: false`, `addsPunctuation: true` und dem
Dictation-Hinweis. Finale Ergebnisstücke werden bis `end` gesammelt. Ein
sichtbarer Fertig-Button ruft `stop` auf, Abbrechen ruft `abort` auf. Die
Preview öffnet erst nach dem vollständigen Ergebnis. Im Beta-Testpfad
speichert oder lädt die App selbst kein Roh-Audio hoch; der native Dienst kann
bei `requiresOnDeviceRecognition: false` jedoch Netzwerk-Erkennung verwenden.
Der Start erfordert deshalb eine ausdrückliche, verschlüsselt gespeicherte
Einwilligung für `contentData`; ohne diese Einwilligung werden weder
Berechtigungen angefragt noch native Erkennung gestartet. Das ist kein
Produktionspfad. Vor Produktion bleibt die On-Device-/Consent-Entscheidung aus
Architekturentscheidung 7 offen.

**Verifikation:** Fokussierte Adapter-/RNTL-Tests für mehrere finale Stücke,
Fertig, Abbrechen und Fehler. Danach genau ein neuer TestFlight-Build für den
kompletten Slice A bis D und ein dokumentierter Test mit mehreren Artikeln.

### Checkpoint vor einem neuen TestFlight-Build

- [ ] Alle vier Slices sind implementiert und fokussiert getestet.
- [ ] `bun run check` und `bun run typecheck` laufen erst nach Marcos Signal,
  weil der aktuelle native Build zunächst nicht unterbrochen werden soll.
- [ ] Der lokale iOS-/Android-Dev-Client zeigt Drag, Scroll, Tastatur,
  Editieren, Reparse und den vollständigen Speech-Lifecycle.
- [ ] Erst danach wird ein gemeinsamer TestFlight-Build erstellt.
- [ ] Der TestFlight-Nachweis prüft sowohl ein explizit getrenntes Transcript
  als auch das unpunktierte Beispiel und bestätigt, dass letzteres editierbar
  bleibt statt falsch automatisch geteilt zu werden.

### Quellen und Grenzen

Die `expo-speech-recognition`-Dokumentation beschreibt `stop()` als Ende der
Audioaufnahme mit finalem Ergebnis und weist darauf hin, dass iOS im
Continuous-Modus ein finales Ergebnis vor `end` liefert, während Android
segmentierte Ergebnisse liefern kann:
<https://github.com/jamsch/expo-speech-recognition#direct-module-api>

Die Expo-SDK-v57-Dokumentation beschreibt für den universellen `BottomSheet`,
dass fehlende `snapPoints` den Inhalt automatisch bestimmen, dass `half` und
`full` als native Höhen verfügbar sind und dass bei längerem Inhalt ein
`ScrollView` verwendet werden soll:
<https://docs.expo.dev/versions/v57.0.0/sdk/ui/universal/bottomsheet/>

Apple dokumentiert `addsPunctuation` als Punctuation-Option des
Speech-Requests, nicht als semantische Artikelgrenze:
<https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/addspunctuation>

### Freigabe

Die Implementierung ist freigegeben. Die vorgeschlagene Editierbarkeit betrifft
bewusst das Roh-Transcript mit anschließendem Reparse, nicht separate frei
editierbare Felder pro bereits falsch gesplittetem Artikel. `ui.tsx` bleibt
unverändert.
