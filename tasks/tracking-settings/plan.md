# Umsetzungsplan: Mein Tracking aus dem Mockup übernehmen

## 1. Ziel und Quelle

Die bestehende Route `/profile/tracking` soll die Informationsarchitektur aus
[`docs/mockups/tracking-settings/mein-tracking-mockup.html`](../../docs/mockups/tracking-settings/mein-tracking-mockup.html)
übernehmen. Das Mockup ist ein Vergleich von zwei verbesserten Zielvarianten,
keine einzelne bereits ausgewählte Implementierung.

Der empfohlene erste Umsetzungsschnitt ist **Variante A: „Zeilen statt
Kacheln“**. Sie ist näher an den bereits verwendeten `SettingsGroup`- und
`SettingsRow`-Mustern, reduziert die Layout-Komplexität und lässt die
vorhandenen Editierpfade weitgehend unverändert.

Variante B („Kennzahlen oben, Rest eingeklappt“) bleibt eine bewusste Option
für eine zweite Iteration. Sie wird nicht parallel zu A umgesetzt, solange die
Zielvariante nicht bestätigt ist.

## 2. Aktueller Stand

`src/features/profile/tracking-screen.tsx` enthält bereits alle fachlichen
Daten und Mutationen, rendert sie aber noch als große Auswahlkarten und
mehrere Kachel-/Grid-Bereiche:

- Tracking-Methode mit allen Optionen inline und optionalem GLP-1-Plan
- Kalorienziel, Makros und Navigation zu `/settings/goals`
- Gewicht für den logischen Tracking-Tag
- Größe, Geschlecht, Alter, Aktivitätslevel
- berechneter BMR und TDEE
- Tagesstart mit Presets, Stepper, manueller Uhrzeit und Erklärung

Die vorhandenen Sheets für Tracking-Methode und Biometrie besitzen bereits
Android-Kopien. Der Tagesstart-Editor ist aktuell noch direkt im Screen als
`TimePicker` und Modal enthalten. Es ist keine Schema-, RLS-, Outbox- oder
Sync-Änderung nötig, weil ausschließlich bestehende Queries, Mutationen und
Berechnungen neu angeordnet werden.

## 3. Annahmen und empfohlene Produktentscheidung

1. „Mockup übernehmen“ bedeutet, die **verbesserte** Ansicht umzusetzen, nicht
   die Originalansichten zu reproduzieren.
2. Variante A ist der Startpunkt. Sie liefert denselben Informationsumfang mit
   weniger visueller Wiederholung und ohne neues Akkordeon-State-Modell.
3. Ein Chevron bedeutet ausschließlich: Dieser Tap öffnet einen bestehenden
   Bearbeitungs- oder Navigationspfad. Rein informative Werte bekommen keinen
   Chevron.
4. Die Beispielwerte im HTML sind nur Layoutdaten. Im Produkt kommen Werte
   weiterhin aus den bestehenden Queries; fehlende Werte werden mit den
   vorhandenen sinnvollen Leerzuständen angezeigt.
5. Die fachliche Entscheidung, dass `tracking_method` exklusiv ist, bleibt aus
   [`docs/adr/0004-exclusive-tracking-method.md`](../../docs/adr/0004-exclusive-tracking-method.md)
   bestehen.

**Offener Freigabepunkt:** Vor Implementierungsbeginn Variante A bestätigen
oder Variante B als Zielvariante auswählen.

## 4. Zielstruktur für Variante A

### Tracking-Methode

Eine einzige ausgewählte Zeile mit Icon, Methodenname, kurzer Beschreibung und
`Aktiv`/Status. Ein Tap öffnet den vorhandenen `TrackingMethodSheet`; die
Auswahl persistiert weiterhin über `useUpdateTrackingMethodMutation`.

Wenn GLP-1 ausgewählt ist, bleibt der bestehende
`InjectionPlanSection`-Workflow erreichbar. Die Darstellung wird nicht aus
dem Mockup heraus entfernt.

### Ernährung & Ziele

- `Kalorienziel`: informativer Wert, kein Chevron.
- `Makros`: eine zusammengefasste Zeile mit Protein, Carbs und Fett als
  Kurzsummen und Chevron zu `/settings/goals`.

Die bisherige separate Bearbeiten-Schaltfläche wird dadurch nicht zusätzlich
neben der neuen Zeile beibehalten.

### Vitalwerte & Biometrie

- `Körperdaten`: Größe, Geschlecht und Alter als kompakte Zusammenfassung,
  Chevron zum bestehenden validierten Biometrie-Sheet.
- `Gewicht heute`: Wert aus dem logischen Tag, rein informativ.
- `Aktivität`: lesbarer Aktivitätsname, rein informativ.
- `Energiebedarf`: BMR und TDEE als zusammengefasster Wert, rein informativ.

Der bestehende private Gewichtsverlauf und die BMR-/TDEE-Berechnung bleiben
unverändert.

### Rhythmus

Eine `Tagesstart`-Zeile mit Preset-/Uhrzeit-Hinweis und Chevron. Ein Tap öffnet
den bestehenden Tagesstart-Editor. Presets, `-1h`/`+1h`, freie `HH:MM`-Eingabe,
Validierung und die Erklärung zur logischen Tagesgrenze müssen erhalten
bleiben.

## 5. Architekturentscheidungen

- `TrackingScreen` bleibt das Route-Ziel; Fachlogik und Datenzugriff bleiben in
  der Feature-Domäne.
- Wiederverwendet werden `SettingsGroup`, Theme-Tokens, bestehende Sheets,
  React Query und vorhandene Berechnungsfunktionen.
- Für die ausgewählte Tracking-Zeile wird kein generisches Settings-System
  gebaut. Entweder wird `SettingsRow` minimal um einen klar begrenzten
  Selected-State erweitert oder es entsteht eine kleine Tracking-spezifische
  Zeilenkomponente.
- Der Tagesstart-Editor wird bei Bedarf aus dem Screen in eine kleine
  tracking-spezifische Sheet-/Editor-Komponente extrahiert. Die Extraktion
  dient nur der neuen Interaktion, nicht einer allgemeinen Modal-Abstraktion.
- Jede betroffene plattformübergreifende Datei erhält eine eigenständige
  `.android.tsx`-Kopie gemäß Projektregel. Keine Symlinks, Stubs oder bloßen
  Re-Exports.
- Neue native Abhängigkeiten, Datenbankänderungen und neue globale Design-
  Tokens sind nicht vorgesehen.

## 6. Geordnete Arbeitspakete

Die Aufgaben werden in Beads verfolgt. Das bestehende `tasks/plan.md` ist ein
anderer, noch nicht abgeschlossener Plan und wird deshalb nicht überschrieben.

### Phase 1: Vertrag und Zielvariante

**Beads:** `fam-4g7.1`

**Ziel:** Die visuelle und interaktive Zielvariante vor dem Umbau eindeutig
festlegen.

**Akzeptanzkriterien:**

- Variante A oder B ist als verbindliches Ziel bestätigt.
- Jede sichtbare Zeile ist als informativ, navigierbar oder editierbar
  klassifiziert.
- Keine Mockup-Beispielwerte werden als Produkt-Fallback übernommen.
- Bestehende fachliche Aktionen und Leerzustände sind der Zielstruktur
  zugeordnet.

**Dateien/Dokumentation:** Dieser Plan, Mockup, bestehende Tracking- und
  Sheet-Dateien.

**Abhängigkeiten:** keine.

### Phase 2: Kompakte Settings-Struktur umsetzen

**Beads:** `fam-4g7.4`

**Ziel:** Den Screen auf die freigegebene Zeilenstruktur umstellen.

**Akzeptanzkriterien für Variante A:**

- Vier Gruppen entsprechen der Zielstruktur aus dem Mockup.
- Makros und Körperdaten sind jeweils zusammengefasst.
- Keine redundanten Kacheln oder Grid-Blöcke bleiben im Hauptscreen.
- Chevron und Selected-State sind semantisch korrekt und theme-konform.
- Loading-, fehlende Ziel-, fehlende Gewichts- und unvollständige
  Biometriezustände bleiben verständlich.

**Wahrscheinlich betroffene Dateien:**

- `src/features/profile/tracking-screen.tsx`
- `src/features/profile/tracking-screen.android.tsx` neu als eigenständige
  Android-Kopie
- optional eine kleine Komponente unter
  `src/features/profile/components/`
- nur falls erforderlich: bestehende Settings-Klassen in `src/global.css`

**Abhängigkeiten:** Phase 1.

### Phase 3: Detailaktionen und Datenverhalten anbinden

**Beads:** `fam-4g7.5`

**Ziel:** Jeder interaktive Mockup-Tap führt in den passenden bestehenden
  Workflow.

**Akzeptanzkriterien:**

- Tracking-Methode öffnet `TrackingMethodSheet`, Auswahl und Mutation bleiben
  korrekt; GLP-1-Inhalte bleiben verfügbar.
- `Makros` öffnet `/settings/goals`.
- `Körperdaten` öffnet den validierten Biometrie-Flow und aktualisiert danach
  Profil, Alter, BMR und TDEE.
- `Tagesstart` öffnet den bestehenden Editor; Änderung, Pending-State,
  Presets, freie Eingabe und Erklärung funktionieren weiterhin.
- Fehler oder abgebrochene Aktionen hinterlassen keinen inkonsistenten lokalen
  Anzeigezustand.

**Wahrscheinlich betroffene Dateien:**

- `src/features/profile/tracking-screen.tsx` und `.android.tsx`
- `src/features/profile/sheets/tracking-method-sheet.tsx` und `.android.tsx`
- `src/features/profile/sheets/biometrics-sheet.tsx` und `.android.tsx`
- optional neue Tagesstart-Sheet-Datei plus `.android.tsx`

**Abhängigkeiten:** Phase 2.

### Checkpoint: Nach Phase 3

- [ ] Die freigegebene Zielansicht ist auf iOS und Android strukturell
  erreichbar.
- [ ] Jede UI-Aktion hat einen funktionierenden, bestehenden Zielworkflow.
- [ ] Es gibt keine fachliche oder Schemaänderung ohne explizite Begründung.
- [ ] Manuelle Prüfung im Dev Client mit gesetzten und nicht gesetzten Werten.

### Phase 4: Tests und Plattformparität schließen

**Beads:** `fam-4g7.3`

**Ziel:** Verhalten, Accessibility und Android-Kopie gegen Regressionen
absichern.

**Fokussierte Tests:**

- Rendering der vier Gruppen und tatsächlicher Query-Werte
- Zusammenfassung der Makros und Körperdaten
- Navigation zu den Ziel-Einstellungen
- Öffnen und Auswahl der Tracking-Methode
- Öffnen/Speichern des Biometrie-Flows
- Tagesstart-Änderung inklusive logischem Tagesdatum und Validierung
- GLP-1-Plan bei aktivierter Methode
- Accessibility-Rollen, Labels und `selected`-/`disabled`-Zustände

**Verifikation:**

- `bun run test src/features/profile/tracking-screen.test.tsx`
- zusätzliche fokussierte Tests nur für neue extrahierte Komponenten
- `bun run typecheck`
- `bun run check`
- manueller iOS-/Android-Lauf im bestehenden Dev Client; keine laufenden
  Simulatoren oder Metro-Prozesse beenden

Vor dem Schreiben oder Ändern von RNTL-Tests werden die im Projekt
vorgegebenen RNTL-Guides gelesen.

**Abhängigkeiten:** Phasen 2 und 3.

### Phase 5: Optional Variante B

**Beads:** `fam-4g7.2`

Diese Phase startet nur nach einer separaten Auswahl von Variante B.

**Zusätzlicher Umfang:**

- „Auf einen Blick“ mit Kcal-Ziel, Gewicht, TDEE und Tagesstart
- Akkordeon-State für „Methode & Ziele“, „Biometrie“ und „Rhythmus“
- „Methode & Ziele“ initial offen; die anderen Gruppen initial geschlossen
- Chevron-Rotation, Screenreader-Zustände und fokussierte Accordion-Tests
- erneute Prüfung, ob B gegenüber A tatsächlich einen besseren Workflow liefert

## 7. Risiken und Gegenmaßnahmen

| Risiko | Auswirkung | Gegenmaßnahme |
| --- | --- | --- |
| Das Mockup zeigt zwei Zielvarianten | Umsetzung könnte am Produktentscheid vorbeigehen | Phase 1 als verbindlichen Freigabepunkt behandeln; A empfehlen, B nicht ungefragt bauen |
| Der aktuelle Screen bündelt mehrere fachliche Editoren | Layoutänderung könnte Funktionalität verstecken | Jede Zeile bekommt vor Umsetzung einen expliziten Zielworkflow; GLP-1 und Tagesstart als Regressionsthemen testen |
| Unterschiedliche iOS-/Android-Dateiauflösung | Android könnte nach dem Umbau eine alte oder inkomplette Darstellung laden | Betroffene `.android.tsx`-Kopien im selben Arbeitspaket aktualisieren und gezielt prüfen |
| Zu viele Chevron-/Tap-Ziele | Nutzer erwarten Bearbeitung, obwohl ein Wert nur informativ ist | Chevron nur bei Sheet/Route; Accessibility-Label beschreibt die Aktion |
| Mockup-Werte werden versehentlich hart codiert | Falsche Nutzerdaten und irreführende Berechnung | Alle Werte aus Queries/Berechnungen; Tests verwenden Mockdaten ausschließlich als Testdaten |
| Variante B führt zu versteckten Informationen | Mehr Taps und höheres State-/Accessibility-Risiko | B als separate Iteration behandeln und initiale Offenheit sowie Screenreader-State testen |

## 8. Definition of Done

- Freigegebene Zielvariante ist umgesetzt und auf iOS/Android strukturell
  paritätisch.
- Bestehende Tracking-Datenflüsse und fachlichen Regeln sind unverändert.
- Keine Kachel-/Grid-Redundanz aus der bisherigen Ansicht bleibt in Variante A.
- Alle interaktiven Zeilen führen zu einem nachvollziehbaren Workflow.
- Fokussierte Tests, Typecheck und Check bestehen.
- Manuelle Prüfung deckt gesetzte, leere und teilweise gesetzte Profildaten
  sowie Dark Mode ab.
- Beads `fam-4g7.1`, `fam-4g7.4`, `fam-4g7.5` und `fam-4g7.3` werden erst nach
  nachweislicher Erfüllung geschlossen. `fam-4g7.2` bleibt offen, falls B nicht
  ausgewählt wird.
