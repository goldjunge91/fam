# Plan: T11-Qualitätsmetriken darstellen und auswerten

**Status:** Entwurf, Review durch Marco erforderlich  
**Stand:** 2026-09-18  
**Beads:** `fam-wl9s` mit den Tasks `fam-wl9s.2`, `fam-wl9s.1`,
`fam-wl9s.4` und `fam-wl9s.3`  
**Bezug:** `tasks/natuerliches-hinzufuegen-von-einkaufsartikeln_V2_plan.md`  

Der bestehende `tasks/plan.md` gehört zu einem anderen, noch offenen
Maestro-Vorhaben und bleibt unverändert. Die Umsetzung dieses Plans wird
ausschließlich in Beads verfolgt.

## Ergebnis der Bestandsaufnahme

Die T11-Metriken werden aktuell lokal und accountbezogen im verschlüsselten
Beta-Speicher aggregiert. Es gibt bereits die Zähler und die Berechnung des
aktuellen Snapshots, aber noch keine Darstellung, keinen fachlichen
Pass/Fail-Evaluator und keinen Verlauf.

Geprüfte Quellen:

- `src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/quality-metrics.ts`
- `src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/types.ts`
- `src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/beta-storage.ts`
- `src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/consent.ts`
- `src/features/settings/natural-language-beta-consent.ts`
- `src/features/settings/dev/dev-tools-screen.tsx`
- `src/features/settings/dev/dev-data-screen.tsx`
- `src/features/settings/dev/dev-screen-shared.tsx`
- `src/features/settings/dev/dev-telemetry-screen.tsx`
- `docs/architecture/DEVELOPER_GUIDE.md`
- `docs/features/ANALYTICS_CONTROLS_SPEC.md`

## Gepackter Umsetzungskontext

- Der relevante Stack ist Expo SDK 57 (`expo` `~57.0.19`), Expo Router
  (`~57.0.18`), React Native `0.86.3`, React `19.2.3`, TypeScript und
  `react-native-unistyles` `3.3.0`. Neue framework-spezifische APIs werden
  gegen diese Versionen geprüft, nicht gegen allgemeine Erinnerungsmuster.
- Die lokale Quelle für die Anzeige ist `buildBetaQualityPayload` zusammen mit
  `getBetaQualityMetricSnapshot`. Die neue Evaluator-Schicht darf diese
  Berechnungen nicht parallel duplizieren.
- Für die Dev-Ansicht ist `src/features/settings/dev/dev-data-screen.tsx` das
  Referenzmuster: lokales Laden per Callback, explizite Aktualisierung,
  Fehlerzustand sowie die vorhandenen `Screen`, `Card`, `Button`, `Txt` und
  `Zeile`-Bausteine. Die Route wird als dünner Wrapper unter
  `src/app/settings/...` ergänzt.
- Für Export und Tests werden vorhandene Pakete verwendet. Es werden keine
  neuen Dependencies, keine native Konfiguration und keine Supabase-Schema-
  änderung vorausgesetzt.
- Vor UI-Code ist der im Projekt vorgeschriebene Mock-Review einzuhalten. Für
  RNTL-Tests sind vor der Implementierung die lokalen Paketregeln unter
  `node_modules/@testing-library/react-native/docs/` und
  `.agents/rules/react-native-testing-library.md` zu lesen.

Wichtige Grenzen des aktuellen Modells:

- `automaticAccuracyPercent` und `falseListPercent` haben
  `automaticAssignmentCount` als Nenner.
- `manualCorrectionPercent` hat `confirmedItemCount` als Nenner.
- `medianTimeToAddMs` basiert auf höchstens 64 gespeicherten
  Dauer-Samples, nicht auf einem vollständigen unbegrenzten Verlauf.
- Bei fehlendem Nenner oder fehlendem Dauer-Sample ist der Wert `null`. Das
  darf in der Darstellung und Auswertung nicht zu `0` werden.
- Die aufgezeichneten Observation- und Session-IDs bleiben lokal und gehören
  niemals in eine Export- oder Darstellungs-Payload.
- Es gibt keine historische Snapshot-Liste. Ein Trenddiagramm wäre mit dem
  aktuellen Speicher daher fachlich nicht korrekt.
- Der aktuelle Produktentscheid hält automatische Produktiv-Telemetrie,
  Supabase-Speicherung und neue Datenbankoberflächen außerhalb dieses Scopes.

## Zielbild

### 1. Lokale Darstellung

Eine geschützte Ansicht im Entwicklerbereich zeigt den aktuellen Snapshot des
angemeldeten Kontos. Die erste Version verwendet bewusst eine kompakte
Messwerttabelle statt einer neuen Chart-Bibliothek:

| Metrik | Berechnung | Ziel | Zusätzlich sichtbar |
| --- | --- | --- | --- |
| Automatische Genauigkeit | korrekte automatische Zuordnungen / automatische Zuordnungen | mindestens 95 % | Nenner, Datenstatus |
| Falsche Liste | falsche automatische Zuordnungen / automatische Zuordnungen | höchstens 1 % | Nenner, Datenstatus |
| Manuelle Korrektur | manuelle Korrekturen / bestätigte Artikel | höchstens 10 % | Nenner, Datenstatus |
| Zeit bis zum Hinzufügen | Median der gemessenen Dauer-Samples | höchstens 6.000 ms | Anzahl Samples, Datenstatus |

Jede Zeile enthält Wert, Einheit, Zielrichtung, Zielwert, Nenner oder
Sample-Anzahl und einen Status. Die Statuswerte müssen mindestens zwischen
`keine Daten`, `Daten vorhanden, Stichprobe unklar`, `Ziel erreicht` und
`Ziel verfehlt` unterscheiden. Ein numerischer Wert von `0 %` ist nur dann
zulässig, wenn ein gültiger Nenner vorhanden ist und der Zähler tatsächlich
null ist.

Die erste Implementierung zeigt zusätzlich den vollständigen sanitizierten
Übertragungs-Snapshot. Die Anzeige besteht aus einer Feld-/Wert-Ansicht und
einer lesbaren JSON-Vorschau des exakt gleichen Objekts, das der manuelle
Export und ein späterer Transport verwenden würden. Sichtbar sind damit alle
erlaubten Felder, insbesondere Schema-Version, Aggregate, Zähler/Nenner,
Sample-Metadaten, die vier Zielwerte und `null`-Zustände. Die Vier-Metriken-
Tabelle ist nur eine verständliche Projektion dieses Snapshots und baut keine
zweite Payload.

„Alles anzeigen“ bedeutet hier alle Felder des sanitizierten
Übertragungsvertrags, nicht alle lokalen Speicherfelder. Observation-IDs,
Session-IDs, User-/Haushalts-IDs, Artikeltexte, Marken, Transkripte und Audio
bleiben strukturell ausgeschlossen. Lokale Idempotenzlisten oder andere
interne Hilfsdaten werden niemals nur zur Vollständigkeit in die Vorschau
aufgenommen.

Die Ansicht bleibt zunächst im Entwicklerbereich. Eine user-facing
Haushaltskarte oder eine automatische Synchronisation ist kein Bestandteil
dieses Plans.

### 2. Reproduzierbare Auswertung

Die Auswertung besteht aus zwei Schichten:

1. Eine reine Domainfunktion übersetzt den lokalen Snapshot in typisierte
   Metrikwerte, Datenstatus, Zielvergleich und Stichprobengrundlage.
2. Ein Offline-Report kann ausdrücklich exportierte, bereits sanitizierte
   Snapshots prüfen und für Pilotdaten einen nachvollziehbaren JSON- und
   menschenlesbaren Bericht erzeugen.

Mehrere Snapshots dürfen nicht durch ein einfaches Mittel der bereits
berechneten Prozentwerte zusammengeführt werden. Die Exportstruktur muss die
notwendigen Zähler/Nenner und für die Zeitmetrik eine fachlich geeignete
Sample-Repräsentation enthalten. Falls die exakte Kohorten-Medianbildung nicht
mit den vorhandenen 64 Samples gewünscht ist, wird sie als unbestimmbar
ausgewiesen und nicht geschätzt.

### 3. Datenschutzgrenze

Die erste Auswertung bleibt lokal oder läuft aus einer bewusst manuell
exportierten, numerischen Payload. Sie enthält keine Artikeltexte, Marken,
Transkripte, Audio-Daten, Beta-Session-IDs, Observation-IDs, User-IDs oder
Haushalts-IDs. Quality-Consent bleibt Voraussetzung. Bei Widerruf bleiben
keine alten Qualitätswerte in der Anzeige zurück, weil der bestehende Consent-
Pfad die lokalen Metriken löscht.

## Architekturentscheidungen

- Die vorhandenen Zähler in `BetaQualityMetrics` bleiben die Quelle der
  Wahrheit. Darstellung und Report rechnen nicht unabhängig davon eigene
  Zähler.
- Die Auswertungslogik bleibt pure Domainlogik ohne React, Supabase,
  Telemetrieprovider oder Netzwerk.
- Die Payload-Vorschau, die manuelle Exportaktion und ein späterer Transport
  verwenden exakt denselben versionierten Sanitizer. Ein Feld darf nicht in
  der Anzeige erscheinen, aber im Export fehlen oder umgekehrt.
- Die Darstellung verwendet vorhandene Dev-Screen-Muster wie `Screen`, `Card`,
  `Zeile`, `Txt` und `ProgressBar`. Es wird keine Chart-Dependency ergänzt.
- Der Export ist eine explizite Entwickler-/Pilotaktion über vorhandene
  Clipboard-/Sharing-Abhängigkeiten. Es gibt keinen stillen Upload.
- Eine spätere Supabase- oder Telemetrieübertragung ist ein separates
  Freigabegate mit eigenem Datenschutz-, RLS- und Datenmodell-Review.
- Vor jeder konkreten UI-Implementierung wird der bestehende Mock-Review-Gate
  eingehalten.

## Quellenbasis für framework-spezifische Entscheidungen

Die Metriksemantik stammt aus dem bestehenden Projektcode. Die folgenden
offiziellen Quellen begrenzen nur die späteren Integrationsdetails:

- [Expo Clipboard für SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/clipboard/)
  dokumentiert `import * as Clipboard from 'expo-clipboard'` und
  `Clipboard.setStringAsync(text)` als API für das bewusste Kopieren eines
  Text-Exports. Das Paket ist bereits vorhanden (`^57.0.1`); es wird nicht
  ungefragt aktualisiert.
- [Expo Sharing für SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/sharing/)
  dokumentiert `Sharing.isAvailableAsync()` sowie `Sharing.shareAsync(url)`.
  Lokales Teilen per Datei-URI ist auf Android und iOS möglich, im Web jedoch
  nicht. Deshalb bleibt Clipboard der zuerst zu implementierende Exportweg;
  Share Sheet ist eine nachgelagerte Option. Die Dokumentation nennt
  `~57.0.21` als empfohlene Version, während `package.json` aktuell `~57.0.17`
  enthält. Ohne gesonderte Upgrade-Entscheidung wird diese Abweichung nicht
  stillschweigend verändert.
- [Expo Router: Introduction](https://docs.expo.dev/router/introduction/)
  bestätigt den file-basierten Routing-Ansatz. Die geplante Dev-Route folgt
  daher dem bestehenden dünnen Route-Wrapper statt einer eigenen Navigation-
  Registrierung.
- RNTL-Dokumentation wurde für diese Planprüfung nicht als externe Quelle
  verifiziert. Vor der Umsetzung gelten daher ausschließlich die im
  Projekt vorhandenen lokalen RNTL-Regeln und Paketdokumente; jede dort nicht
  belegte API-Annahme ist vor dem Schreiben eines Tests zu prüfen.

## Abhängigkeitsgraph

```text
Metrikvertrag und Evaluator
        │
        ├──> lokale Dev-Darstellung
        │
        └──> sanitizierter Snapshot-Export
                    │
                    └──> Offline-Kohortenreport
```

## Aufgabenliste

### Phase 1: Vertrag und Auswertungskern

#### Task `fam-wl9s.2`: Metrikvertrag und Statusauswertung definieren

**Beschreibung:** Die vier Zielmetriken, Zielrichtungen, Nenner, Sample-
Abdeckung und Datenstatus als typisierte, reine Domainlogik festlegen.

**Akzeptanzkriterien:**

- Accuracy, False-List, Manual-Correction und Median-Time verwenden exakt die
  oben dokumentierten Zielwerte und Nenner.
- `null`, fehlender Nenner, fehlendes Dauer-Sample und kleine Stichprobe werden
  fachlich von einem gemessenen Nullwert unterschieden.
- Der Evaluator liefert Wert, Ziel, Richtung, Basisanzahl und Status pro
  Metrik.
- Grenzfälle sind durch fokussierte Unit-Tests abgedeckt.

**Verifikation:**

- `bun run test` mit den Quality-Metrics-Domain-Tests.
- `bun run typecheck`.
- `bunx biome check` auf den betroffenen Domain-Dateien.

**Abhängigkeiten:** Keine  
**Wahrscheinliche Dateien:**
`domain/quality-metrics.ts`, neues Domainmodul für Evaluation, colocated Tests  
**Umfang:** S bis M, 2 bis 4 Dateien

### Checkpoint: Evaluator

- [ ] Jeder Wert kann als `gemessen`, `nicht bestimmbar` oder `nicht belastbar`
      erklärt werden.
- [ ] Kein Test behandelt fehlende Daten als falsche Null.
- [ ] Marco bestätigt die Mindeststichprobenregel oder entscheidet sich für
      eine reine Transparenzanzeige ohne hartes Mindest-N.

### Phase 2: Lokale Darstellung und manueller Export

#### Task `fam-wl9s.4`: Lokale Metrikübersicht im Entwicklerbereich darstellen

**Beschreibung:** Eine neue geschützte Dev-Ansicht lädt den lokalen
Beta-Snapshot und stellt die vier Metriken mit Zielwerten, Datengrundlage und
Status dar. Zusätzlich zeigt sie den vollständigen sanitizierten
Übertragungs-Snapshot als Feld-/Wert-Ansicht und JSON-Vorschau.

**Akzeptanzkriterien:**

- Die Route ist nur aus dem Entwicklerbereich erreichbar.
- Lade-, Fehler-, Consent- und Empty-State sind sichtbar und verständlich.
- Jede Metrik zeigt Wert, Einheit, Zielwert, Nenner/Sample Count und Status.
- Alle erlaubten Felder des Übertragungsvertrags sind sichtbar, einschließlich
  Schema-Version, Aggregate, Zähler/Nenner, Sample-Metadaten und `null`-
  Zuständen. Die Anzeige verwendet exakt den Export-Snapshot.
- Artikel-, Marken-, Transcript- und Sessiondaten werden weder gerendert noch
  für die Darstellung geladen.
- Die Ansicht aktualisiert den Snapshot auf ausdrückliche Nutzeraktion.

**Verifikation:**

- Statischer Mock-Review vor UI-Implementierung.
- Fokussierte RNTL-Tests für granted, revoked/undecided, missing und target
  pass/fail.
- iOS-Dev-Client: Ansicht aus den Entwickler-Einstellungen öffnen und mit
  leerem sowie gefülltem lokalem Speicher prüfen.

**Abhängigkeiten:** `fam-wl9s.2`  
**Wahrscheinliche Dateien:** neue Dev-Route und Screen, ggf. gemeinsame
Formatierungsfunktion, colocated RNTL-Test, DE/EN-Übersetzungen  
**Umfang:** M, 4 bis 5 Dateien

#### Task `fam-wl9s.1`: Datensparsamen Qualitäts-Snapshot manuell exportieren

**Beschreibung:** Einen versionierten, numerischen Snapshot für die manuelle
Pilotauswertung erzeugen, in der Dev-Ansicht vollständig anzeigen und über
eine bewusste Copy-/Share-Aktion ausgeben.

**Akzeptanzkriterien:**

- Der Export ist bei fehlendem Quality-Consent oder unzureichenden Daten nicht
  verfügbar.
- Der Export enthält nur erlaubte numerische Aggregate, Ziel-/Nennerdaten und
  die erforderliche Sample-Repräsentation.
- Der Export und die Payload-Vorschau werden aus demselben versionierten
  Sanitizer erzeugt; es gibt keine abweichende Anzeige-Payload.
- Artikeltexte, Marken, Transkripte, Audio-Daten, Session-IDs,
  Observation-IDs, User-IDs und Haushalts-IDs sind strukturell ausgeschlossen.
- JSON-Versionierung und unbekannte/private Felder werden durch Tests
  abgesichert.
- Es gibt keinen automatischen Netzwerkversand.

**Verifikation:**

- Pure Payload-Tests inklusive Privacy-Allowlist und negativer Inhalte.
- Adaptertest für Clipboard/Sharing ohne echten externen Versand.
- Manuelle Prüfung des exportierten Texts aus dem Dev-Screen.

**Abhängigkeiten:** `fam-wl9s.2`  
**Wahrscheinliche Dateien:** Exportvertrag/Domainmodul, Exportadapter,
Dev-Screen-Erweiterung, Tests  
**Umfang:** M, 3 bis 5 Dateien

### Checkpoint: Lokale Inspektion

- [ ] Ein lokaler Snapshot ist direkt auf dem Gerät lesbar.
- [ ] Der vollständige sanitizierte Übertragungs-Snapshot ist vor dem Kopieren
      oder späteren Versenden sichtbar und entspricht dem Exportobjekt.
- [ ] Der manuelle Export enthält keine privaten oder inhaltlichen Felder.
- [ ] Widerruf des Quality-Consents entfernt die lokale Datenbasis und macht
      Darstellung sowie Export leer beziehungsweise unavailable.

### Phase 3: Offline-Pilotreport

#### Task `fam-wl9s.3`: Reproduzierbaren Offline-Kohortenreport bauen

**Beschreibung:** Ein Script/Core-Modul verarbeitet mehrere manuell exportierte
Snapshots ohne App-Netzwerk und erzeugt einen gewichteten, nachvollziehbaren
Bericht über Zielerreichung und Datenqualität.

**Akzeptanzkriterien:**

- Nur der definierte sanitizierte Snapshot-Vertrag wird akzeptiert.
- Ungültige oder zusätzliche private Felder werden abgelehnt oder explizit
  ignoriert, ohne in den Bericht zu gelangen.
- Prozentwerte werden aus Zählern/Nennern aggregiert, nicht ungewichtet
  gemittelt.
- Die Zeitmetrik wird nur aggregiert, wenn die Sample-Repräsentation das
  fachlich erlaubt; sonst wird sie als nicht bestimmbar markiert.
- Der Report zeigt Kohortengröße, Nenner/Sample Count, fehlende Werte,
  Stichprobenstatus, Zielwert und Zielerreichung für alle vier Metriken.
- JSON-Ausgabe und menschenlesbare Ausgabe besitzen fokussierte Tests.

**Verifikation:**

- Core-Unit-Tests für einen, mehrere, leere, unvollständige und ungültige
  Snapshots.
- Script-Smoke-Test mit temporären sanitizierten Fixtures.
- `bun run typecheck` und fokussierter Biome-Check.

**Abhängigkeiten:** `fam-wl9s.2`, `fam-wl9s.1`  
**Wahrscheinliche Dateien:** `scripts/`-Evaluator/Core, Tests, kurze
Bedienungsdokumentation  
**Umfang:** M, 3 bis 5 Dateien

### Checkpoint: Auswertungsbereit

- [ ] Dev-Ansicht und Offline-Report zeigen bei denselben Daten dieselben
      Metrikwerte und Zielurteile.
- [ ] Gewichtete Aggregation ist mit einem Gegenbeispiel zum ungewichteten
      Prozentmittel getestet.
- [ ] Es wird kein Trend behauptet, solange kein Snapshot-Verlauf existiert.

## Definition of Done

- [ ] Beads `fam-wl9s.2`, `fam-wl9s.4`, `fam-wl9s.1` und `fam-wl9s.3` sind
      abgeschlossen.
- [ ] Die vier Zielmetriken sind lokal verständlich darstellbar.
- [ ] Ein fehlender Wert ist von einem echten Nullwert unterscheidbar.
- [ ] Eine manuelle, sanitizierte Pilotauswertung ist reproduzierbar.
- [ ] `bun run test <betroffene Dateien>`, `bun run typecheck` und fokussiertes
      `bunx biome check` sind grün.
- [ ] Es gibt keine neue Supabase-Tabelle, Migration, RLS-Policy,
      automatische Telemetrie oder neue native Abhängigkeit.
- [ ] Der bestehende natürliche Einkaufsartikel-Plan bleibt unverändert; diese
      Arbeit bleibt ein separater Neben-Scope.

## Risiken und Gegenmaßnahmen

| Risiko | Auswirkung | Gegenmaßnahme |
| --- | --- | --- |
| Sehr kleine Stichprobe | Ein zufälliger Pass wirkt wie ein belastbarer Beta-Erfolg | Nenner/Sample Count immer anzeigen und Mindeststichprobe separat entscheiden |
| Unvollständige automatische oder Zeitdaten | Falsche Prozentwerte oder falsche Nullwerte | `null` und Status `unavailable/insufficient` bis in UI und Report erhalten |
| Kumulative Snapshots werden ungewichtet gemittelt | Verzerrte Kohortenwerte | Zähler/Nenner exportieren und Aggregation testen |
| Lokaler Speicher enthält keinen Verlauf | Keine seriöse Trenddarstellung | In Phase 1 nur aktuellen Snapshot zeigen; History als separates Gate behandeln |
| Sanitization wird später umgangen | Artikelinhalte könnten in Export/Report gelangen | Allowlist-Payload, unbekannte Felder ablehnen, Privacy-Regressionstests |
| Dev-Darstellung wird versehentlich produktiv | Ungeplante UX- und Datenschutzoberfläche | Route nur im Entwicklerbereich, keine Navigation im normalen Haushaltsfluss |

## Offene Entscheidungen

1. Welche Mindeststichprobe ist nötig, bevor ein Ziel als belastbar erreicht oder
   verfehlt markiert wird? Empfehlung: zunächst einen eigenen
   `insufficient_sample`-Status und die Zahlen sichtbar machen, statt eine
   unbegründete harte Grenze einzubauen.
2. Soll die Zeitmetrik für Kohortenberichte aus den bis zu 64 lokalen
   Dauer-Samples rekonstruiert werden, oder reicht ein lokaler Median je
   Export? Empfehlung: keine Kohorten-Medianzahl aus Medianwerten ableiten.
3. Soll der manuelle Export zunächst Clipboard, Share Sheet oder beides
   anbieten? Empfehlung: vorhandene Clipboard-Funktion für einen kleinen
   ersten Slice, Share Sheet erst bei realem Pilotbedarf.
4. Eine spätere zentrale Speicherung in Supabase oder Übertragung an einen
   Analytics-Provider braucht eine separate Freigabe mit neuem Schema-/RLS-
   beziehungsweise Telemetrievertrag.
