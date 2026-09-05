# Implementierungsplan V2: UI-Konsolidierung mit weniger Code

Status: Bestätigte Planungsgrundlage; Umsetzung gestartet
Stand: 2026-09-05
Initiative: `ui-consolidation-v2`

Referenzen:

- [Spezifikation](../../docs/specs/ui-consolidation/SPEC.md)
- [Design-System-Verträge](../../docs/design-system/contracts/README.md)
- [Definition of Done](../../.claude/references/definition-of-done.md)
- Beads-Epic: `fam-6zf`

## Bestätigte Entscheidungen

- V2 umfasst Core-Primitives sowie Inventory und Shopping. Weitere Screens
  folgen nur bei einem konkreten verbleibenden Befund.
- `rs()` wird nur bei einem sehr kleinen Eingriff reaktiv gemacht. Andernfalls
  bleibt der Waivy-nahe Istzustand unverändert.
- Bestehende V2-/V3-Mocks sind unfertige Beispiele, keine freigegebenen Ziele.
  Sichtbare Änderungen warten auf den finalen Mock und Marcos ausdrückliche
  Freigabe; es wird keine konkurrierende Mockrunde gestartet.

## 1. Ergebnis der Gegenprüfung

Der bisherige Plan ist nicht mehr die richtige Umsetzungsgrundlage. Seine
Richtung ist grundsätzlich korrekt, aber er würde an mehreren Stellen mehr
Mechanik und mehr Übergangscode erzeugen als nötig:

1. Er erkennt die statische `rs()`-Berechnung richtig, begrenzt die Lösung aber
   nicht auf den kleinsten möglichen Eingriff. Ohne diese Grenze könnte daraus
   ein Responsive-Provider oder eine zweite Token-Laufzeit entstehen.
   `SCREEN_W` und `IS_TABLET` haben außerhalb der Entwicklerreferenz keine
   produktiven Verbraucher.
2. Er bevorzugt Kompatibilitätsadapter für doppelte Komponenten. Im aktuellen
   Code existieren zwei nahezu identische Button-Implementierungen mit
   unterschiedlichen Props. Der Foundation-Button aus `ui.tsx` wird deshalb um
   die belegten `link`- und `flat`-Fälle ergänzt; der Produkt-Button wird nach
   direkter Aufrufermigration entfernt.
3. Die Phasen sind unnötig vollständig serialisiert. Inventory und Shopping
   können nach stabilen Primitives unabhängig bearbeitet werden.
4. Mehrere Arbeitspakete behaupten einen Zwei-Dateien-Scope, obwohl sie ganze
   Featurebereiche oder vorhandene Plattformdateien betreffen.
5. Die Spec enthält weiterhin die inzwischen entfernte Pflicht, für jede
   betroffene Datei eine `.android`-Kopie zu führen. Die Maintainer-Anweisung
   überschreibt diesen Teil, die Dokumente müssen vor der Codeumsetzung wieder
   widerspruchsfrei werden.
6. Der frühere Hinweis auf eine Windows-Umgebung ist für dieses Repository-
   Arbeitsverzeichnis nicht zutreffend.

## 2. Ziel

Wir richten das bestehende Design-System gerade, indem wir konkurrierende
Implementierungen entfernen und die tatsächlich verwendeten Produktkomponenten
stabilisieren. Die Konsolidierung ist erfolgreich, wenn:

- `Button`, `TextField`, `SegmentedControl` und `EmptyState` jeweils genau eine
  echte Implementierung besitzen;
- `ui.tsx` gemeinsame Rezepte und kleine, tatsächlich genutzte Primitive enthält,
  aber keine zweite Produktkomponentenbibliothek;
- `rs()` bleibt im Waivy-nahen Bestand oder wird nur mit einem nachweislich kleinen
  Eingriff reaktiv; es entsteht keine zusätzliche Token-Schicht;
- Inventory und Shopping Loading, Empty, No Results, Error und Refresh korrekt
  unterscheiden;
- entfernte APIs, Klassen und Tokens nachweislich keine Verbraucher mehr haben;
- die Produktionsdateien der Konsolidierung in Summe nicht wachsen, außer eine
  konkret notwendige Accessibility-Korrektur wird im Review begründet.

## 3. Architekturentscheidungen

### 3.1 Eine Implementierung statt Adapterketten

Die etablierten Produktimporte bleiben die öffentliche Grenze:

| Vertrag | Kanonischer Einstieg |
| --- | --- |
| Button | `src/constants/ui.tsx` |
| Textfeld | `src/components/forms/text-field.tsx` |
| Einzelauswahl | `src/components/ui/segmented-control.tsx` |
| Empty State | `src/components/ui/empty-state.tsx` |
| Text, Surface und kleine Layoutprimitives | `src/constants/ui.tsx` |

Ein Adapter bleibt nur, wenn er nachweislich eigenständige Komposition oder
native Integration besitzt. Reine Prop-Umbenennungen werden nach Migration der
wenigen Aufrufer gelöscht. `Card` darf deshalb als Produktkomposition über einer
zentralen Surface/Card-Foundation bestehen; zwei unabhängige Card-Rezepte dürfen
nicht bestehen.

Für `Button` bedeutet das ausdrücklich: Der bestehende Foundation-Button unter
`src/constants/ui.tsx` bleibt die einzige Zielimplementierung. Task 4 ergänzt
dort die bereits belegten `link`- und `flat`-Fälle und prüft die gemeinsame API.
Task 5 migriert die Verbraucher des Produkt-Buttons direkt auf diese API und
löscht anschließend `src/components/ui/buttons/button.tsx` samt reinem Export.
Dabei gilt `label → title`, `default → md`, `large → lg` und `compact → sm`.
Es bleibt kein Adapter oder Re-Export für die alte Button-Implementierung.

### 3.2 `rs()` nur bei praktisch kostenlosem Gewinn anfassen

`rs()`, `SCREEN_W` und `IS_TABLET` bleiben zunächst so, wie sie aus dem
Waivy-nahen Ausgangscode übernommen wurden. Eine reaktive globale Skala ist
kein Teil dieses Konsolidierungsschritts. Ein konkreter sichtbarer Layoutfehler
darf weiterhin lokal mit Laufzeitmaßen gelöst werden, ohne eine neue Token-
oder Provider-Schicht einzuführen.

Sobald die Lösung mehr Infrastruktur oder Änderungen quer durch die App braucht,
wird sie nicht umgesetzt. Der aktuelle Code bleibt dann in diesem Punkt bestehen
und Responsive-Verhalten wird nur dort lokal ergänzt, wo ein konkret sichtbarer
Layoutfehler vorliegt. Das ist kein Blocker für die UI-Konsolidierung.

### 3.3 Android-Pflicht ist aus dem Scope entfernt

Es werden keine neuen `.android.ts`- oder `.android.tsx`-Kopien erzeugt. Bereits
existierende Plattformdateien werden nur geändert, wenn sie direkt eine entfernte
API importieren oder der Typecheck sonst bricht. Android-Geräteabnahme ist für
diesen ersten Konsolidierungsschritt kein Abschlusskriterium und wird nicht als
bestanden behauptet. Das allgemeine Produktziel iOS und Android bleibt davon
unberührt.

### 3.4 Keine vorsorgliche Infrastruktur

Nicht vorgesehen sind ein universeller Async-Screen-Wrapper, eine Komponenten-
Registry, neue Dependencies, Snapshot-Infrastruktur, Theme-Bridge, neue globale
NativeWind-Komponentenklassen oder ein pauschaler Rewrite aller Screens.

### 3.5 Sichtbare Entscheidungen bleiben ein Gate

Kontrastkorrekturen und Änderungen an Listen-/Headerdichte warten auf den finalen
Mock. Die vorhandenen V2-/V3-Artefakte bleiben unfertige Beispiele und begründen
keine Produktentscheidung. Es wird keine weitere konkurrierende Mockrunde
erzeugt. Strukturelle Konsolidierung mit erhaltener Darstellung kann sofort
beginnen; sichtbare Änderungen starten erst nach ausdrücklicher Freigabe des
finalen Mocks.

## 4. Scope

### Enthalten

- Widerspruchsfreie UI-Spec und Verträge für den V2-Scope.
- Pragmatische Prüfung von Theme-Tokens; Responsive-Code nur bei kleinem Eingriff.
- Zusammenführung der vier doppelt vorhandenen Komponentenverträge.
- Gezielte Accessibility-Korrekturen an diesen Komponenten.
- Zustandsdarstellung in Inventory und Shopping.
- Entfernung ausschließlich nachweislich ungenutzter semantischer CSS-/NativeWind-
  Bestände.
- Abgleich der bestehenden Design-System-Referenz mit den echten Produktkomponenten.

### Nicht enthalten

- Neue Produktfunktionen, Navigation, Datenmodelle, Supabase, SQLite oder Outbox.
- Neue native Abhängigkeiten oder Änderungen am Native-Build.
- Pauschale Synchronisierung oder Neuerstellung von Android-Dateikopien.
- Komplettes visuelles Redesign aller Features.
- Bereinigung fachfremder Legacy-CSS-Klassen ohne Bezug zu den migrierten APIs.
- Vollständige Jest-, DB- oder Screenshot-Suite.

## 5. Abhängigkeiten und Reihenfolge

```text
Task 1  Scope-Verträge korrigieren
  |
  +--> Task 3  Tokens pragmatisch prüfen
  +--> Task 4  Foundation-Button in ui.tsx erweitern --> Task 5  Produkt-Button löschen
  +--> Task 6  TextField --> Task 7  SegmentedControl --> Task 8  Card/EmptyState

Task 2  finalen Mock nach Fertigstellung und Freigabe übernehmen
  |
  +--> sichtbare Farb-/Dichteänderungen in Tasks 3, 9 und 10

Tasks 3, 6, 7 und 8
  |
  +--> Task 9   Inventory-Zustände
  +--> Task 10  Shopping-Zustände

Tasks 3 bis 10
  |
  +--> Task 11  Legacy-Cleanup --> Task 12  Abschlussprüfung
```

Tasks 4, 6, 7 und 8 teilen zentrale Dateien und werden nicht parallel umgesetzt.
Der noch unfertige finale Mock blockiert diese strukturellen Tasks nicht. Tasks 9
und 10 können nach Mockfreigabe parallel laufen, sofern jeder Agent
ausschließlich seinen Featurepfad besitzt.

## 6. Beads-Taskliste

Beads ist die verbindliche Quelle für Status, Abhängigkeiten, Abnahmekriterien
und Task-Ergebnisse. Das Epic ist `fam-6zf`.

### Phase A: Zielvertrag und visuelle Freigabe

1. `fam-6zf.1` V2-Scope in Spec und Contracts korrigieren
2. `fam-6zf.2` Finalen Mock nach Fertigstellung und Freigabe übernehmen

Task 1 ist nach der abschließenden Konsistenzprüfung der benannten Contracts
geschlossen. Task 2 bleibt blockiert, solange V2/V3 nur unfertige Beispiele sind und
der finale Mock nicht ausdrücklich freigegeben wurde. Es wird keine
konkurrierende Mockrunde erzeugt.

### Phase B: Foundations und kanonische Komponenten

3. `fam-6zf.3` Tokens und unterstützte Farbpaare pragmatisch vereinfachen
4. `fam-6zf.4` Foundation-Button in `ui.tsx` um `link` und `flat` ergänzen
5. `fam-6zf.5` Verbraucher direkt auf `ui.tsx`-Button migrieren und Produkt-Button löschen
6. `fam-6zf.6` `Field` in `ui.tsx` zu `TextField` umbenennen, die produktiven Eingabefunktionen zusammenführen und bestehende Verbraucher nur auf den neuen Importpfad umstellen
7. `fam-6zf.7` SegmentedControl als einzige Einzelauswahl konsolidieren
8. `fam-6zf.8` Card- und EmptyState-Verantwortung bereinigen

### Phase C: Vertikale Produktpfade

9. `fam-6zf.9` Inventory-Datenzustände vertikal korrigieren
10. `fam-6zf.10` Shopping-Datenzustände vertikal korrigieren

### Phase D: Löschen und Verifizieren

11. `fam-6zf.11` Verwaiste CSS-, Token- und Showcase-Bestände löschen
12. `fam-6zf.12` V2-Abschlussprüfung und Dokumentationsabgleich

### Checkpoints

- Vor Phase B: Zielvertrag enthält weder Android-Kopierpflicht noch eine neue
  responsive Token-Schicht; der V2-Mock ist als sichtbares Ziel benannt.
- Vor Phase C: Jeder Core-Vertrag hat genau eine Darstellungsimplementierung;
  fokussierte Tests, Typecheck und Biome sind grün.
- Vor Phase D: Inventory und Shopping unterscheiden ihre Datenzustände und
  erhalten bestehende Offline- und Gegenaktionen.
- Abschluss: Keine Verbraucher gelöschter APIs verbleiben; nicht geprüfte
  Plattformen werden ausdrücklich als nicht geprüft ausgewiesen.

## 7. Zusammenarbeit im geteilten Worktree

- Vor jedem Task werden `git status --short` und der Diff der vorgesehenen Dateien
  geprüft. Fremde Änderungen werden nicht zurückgesetzt oder überschrieben.
- Ein Agent besitzt während eines Tasks die angegebenen Dateien. Task 4 besitzt
  ausschließlich `src/constants/ui.tsx` und seinen fokussierten Test. Task 5
  besitzt den Produkt-Button, dessen Export und die belegten Verbraucher.
  Tasks mit `src/constants/ui.tsx`, `src/components/theme/index.ts` oder
  Showcase-Dateien laufen seriell.
- Die aktuell parallel geänderten Dashboard-Dateien werden in Task 5 erst nach
  ausdrücklicher Freigabe des dortigen Owners angefasst.
- Vorhandene `.android`-Dateien sind keine Aufforderung, neue Mirrors anzulegen.
  Wenn ein entfernter Export dort importiert wird, ist die minimale Compiler-
  Anpassung Teil des Löschschritts.
- Planungsbestände außerhalb von `tasks/ui-consolidation-v2/` bleiben unberührt.

## 8. Verifikationsstrategie

Pro Task werden nur die betroffenen Tests ausgeführt. Zulässige Befehle sind zum
Beispiel:

```bash
bun run test --runInBand --runTestsByPath <betroffene-testdateien>
bun run typecheck
bun run check
bun run check:css
git diff --check
```

Es wird niemals `bun test` und nicht die vollständige Jest- oder DB-Suite
ausgeführt. RNTL-Tests prüfen Verhalten über Rolle, Namen und State statt über
interne Baumstruktur. Native Laufzeitprüfung erfolgt für den aktuell freigegebenen
iOS-Pfad; Web darf als schnelle Layoutkontrolle dienen, ersetzt aber keinen
nativen Nachweis.

## 9. Risiken und Gegenmaßnahmen

| Risiko | Auswirkung | Gegenmaßnahme |
| --- | --- | --- |
| Parallel geänderte Dashboard-Dateien | Konflikt oder verlorene Arbeit | Task 5 blockieren, bis der Owner die Dateien freigibt |
| Entfernte Legacy-API besitzt versteckte Verbraucher | Typecheck- oder Laufzeitfehler | Vor Löschung Import- und JSX-Suche, danach Typecheck und fokussierte Tests |
| Reaktives `rs()` wächst zu einer zweiten Theme-Schicht | Mehr Code und schwer nachvollziehbare Updates | Nur umsetzen, wenn ein kleiner lokaler Helper reicht; andernfalls Waivy-nahen Istzustand behalten |
| Kontrastkorrektur verändert Markenwirkung | UI wirkt fremd | Palette vor Implementierung als Varianten zeigen und auswählen lassen |
| Scope wächst zu einem Gesamtrewrite | Lange, konfliktanfällige Initiative | Nur direkte Verbraucher und zwei vereinbarte Hauptflows anfassen |

## 10. Umsetzungsstart

Die Planungsrichtung ist bestätigt. `fam-6zf.1` ist nach der
Konsistenzprüfung der benannten Contracts geschlossen. `fam-6zf.4` und
`fam-6zf.5` sind abgeschlossen: Der Foundation-Button in `ui.tsx` besitzt
`link` und `flat`, alle direkten Verbraucher verwenden die kanonische API und
der doppelte Produkt-Button samt reinem Export ist entfernt. `fam-6zf.2`
bleibt blockiert, bis der finale Mock fertiggestellt und ausdrücklich
freigegeben ist. Weitere Tasks werden durch den hinterlegten Abhängigkeitsgraphen
freigegeben; unfertige V2-/V3-Beispiele lösen keine sichtbaren Layout- oder
Farbänderungen aus.
