# Implementierungsplan V2: UI-Konsolidierung mit weniger Code

Status: Entwurf zur Maintainer-Freigabe  
Stand: 2026-09-05  
Initiative: `ui-consolidation-v2`

Referenzen:

- [Spezifikation](../../docs/specs/ui-consolidation/SPEC.md)
- [Design-System-Verträge](../../docs/design-system/contracts/README.md)
- [Definition of Done](../../.claude/references/definition-of-done.md)
- [Todo](./todo.md)

## 1. Ergebnis der Gegenprüfung

Der bisherige Plan ist nicht mehr die richtige Umsetzungsgrundlage. Seine
Richtung ist grundsätzlich korrekt, aber er würde an mehreren Stellen mehr
Mechanik und mehr Übergangscode erzeugen als nötig:

1. Er plant eine reaktive `rs()`-Infrastruktur, obwohl `rs()` derzeit nur beim
   Modulimport die gemeinsamen Tokenwerte berechnet. `SCREEN_W` und `IS_TABLET`
   haben außerhalb der Entwicklerreferenz keine produktiven Verbraucher.
2. Er bevorzugt Kompatibilitätsadapter für doppelte Komponenten. Im aktuellen
   Code haben `Field` und das zweite `SegmentedControl` aus `ui.tsx` keine
   Produktverbraucher; der alte `Button` aus `ui.tsx` hat nur die Dashboard-
   Kartenliste als echten Verbraucher. Diese APIs können nach einer kleinen
   Aufrufermigration gelöscht werden.
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
- Theme und Tokens ohne importzeitabhängige Fensterbreite funktionieren;
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
| Button | `src/components/ui/buttons/button.tsx` |
| Textfeld | `src/components/forms/text-field.tsx` |
| Einzelauswahl | `src/components/ui/segmented-control.tsx` |
| Empty State | `src/components/ui/empty-state.tsx` |
| Text, Surface und kleine Layoutprimitives | `src/constants/ui.tsx` |

Ein Adapter bleibt nur, wenn er nachweislich eigenständige Komposition oder
native Integration besitzt. Reine Prop-Umbenennungen werden nach Migration der
wenigen Aufrufer gelöscht. `Card` darf deshalb als Produktkomposition über einer
zentralen Surface/Card-Foundation bestehen; zwei unabhängige Card-Rezepte dürfen
nicht bestehen.

### 3.2 Keine responsive Token-Laufzeit

Schriftgrößen, Zeilenhöhen und Spacing verwenden feste logische RN-Einheiten.
React Native übernimmt die Systemschrift-Skalierung. `useWindowDimensions()`
wird nur in einer konkreten Komponente eingesetzt, wenn deren Anordnung wirklich
von der verfügbaren Breite abhängt. Es entsteht kein Responsive-Theme-Provider,
kein Token-Hook und kein globales Rechnen aller Abstände bei Rotation.

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

Kontrastkorrekturen und Änderungen an Listen-/Headerdichte benötigen vor dem
Produktcode mehrere statische Mocks und Marcos Auswahl. Reine Beseitigung einer
doppelten Implementierung darf vorher erfolgen, solange die sichtbare bestehende
Darstellung erhalten bleibt.

## 4. Scope

### Enthalten

- Widerspruchsfreie UI-Spec und Verträge für den V2-Scope.
- Vereinfachung von Theme-Tokens und Entfernung ungenutzter responsiver Exports.
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
  +--> Task 2  visuelle Entscheidungen freigeben
  |      |
  |      +--> Task 3  Tokens und Farbpaare vereinfachen
  |                    |
  |                    +--> Task 4  Produkt-Button stabilisieren
  |                    |      |
  |                    |      +--> Task 5  Legacy-Button löschen
  |                    |
  |                    +--> Task 6  TextField konsolidieren
  |                    |
  |                    +--> Task 7  SegmentedControl konsolidieren
  |                    |
  |                    +--> Task 8  Card und EmptyState bereinigen
  |                                  |
  |                                  +--> Task 9   Inventory-Zustände
  |                                  +--> Task 10  Shopping-Zustände
  |
  +--> Tasks 11 und 12  erst nach allen Verbraucheränderungen
```

Tasks 4, 6 und 7 teilen zentrale Dateien und werden nicht parallel umgesetzt.
Tasks 9 und 10 können danach parallel laufen, sofern jeder Agent ausschließlich
seinen Featurepfad besitzt.

## 6. Taskliste

### Phase A: Zielvertrag und visuelle Freigabe

- [ ] Task 1: V2-Scope in Spec und Contracts korrigieren
- [ ] Task 2: Palette und Dichte über statische Mocks entscheiden

### Checkpoint A

- [ ] Marco hat Plan und sichtbare Varianten freigegeben
- [ ] Keine Android-Kopierpflicht und keine responsive Token-Laufzeit stehen mehr im Zielvertrag

### Phase B: Foundations und kanonische Komponenten

- [ ] Task 3: Tokens und unterstützte Farbpaare vereinfachen
- [ ] Task 4: Produkt-Button als einzige Implementierung stabilisieren
- [ ] Task 5: Legacy-Button nach Dashboard-Freigabe löschen
- [ ] Task 6: TextField als einzige Eingabedarstellung konsolidieren
- [ ] Task 7: SegmentedControl als einzige Einzelauswahl konsolidieren
- [ ] Task 8: Card- und EmptyState-Verantwortung bereinigen

### Checkpoint B

- [ ] Je Komponentenvertrag existiert genau eine Darstellungsimplementierung
- [ ] Fokussierte Komponententests, Typecheck und Biome sind grün
- [ ] Produktionscode der betroffenen Core-Dateien ist netto nicht gewachsen oder die Abweichung ist begründet

### Phase C: Vertikale Produktpfade

- [ ] Task 9: Inventory-Datenzustände auf die kanonischen Komponenten ziehen
- [ ] Task 10: Shopping-Datenzustände auf die kanonischen Komponenten ziehen

### Checkpoint C

- [ ] Beide Hauptflows unterscheiden Loading, Empty, No Results, Error und Refresh
- [ ] Bestehende Aktionen, Offline-Daten und Gegenaktionen bleiben erhalten
- [ ] Ausgewählte Mocks sind in sichtbaren Änderungen nachvollziehbar

### Phase D: Löschen und Verifizieren

- [ ] Task 11: Verwaiste CSS-, Token- und Showcase-Bestände löschen
- [ ] Task 12: Zielgerichtete Abschlussprüfung und Dokumentationsabgleich

### Checkpoint D

- [ ] Keine Verbraucher der entfernten APIs oder Klassen verbleiben
- [ ] Definition of Done und V2-Abnahmekriterien sind erfüllt
- [ ] Nicht geprüfte Plattformen werden ausdrücklich als nicht geprüft ausgewiesen

Die vollständigen Beschreibungen, Abnahmekriterien, Prüfungen, Abhängigkeiten
und Dateigrenzen stehen in [todo.md](./todo.md).

## 7. Zusammenarbeit im geteilten Worktree

- Vor jedem Task werden `git status --short` und der Diff der vorgesehenen Dateien
  geprüft. Fremde Änderungen werden nicht zurückgesetzt oder überschrieben.
- Ein Agent besitzt während eines Tasks die angegebenen Dateien. Tasks mit
  `src/constants/ui.tsx`, `src/components/theme/index.ts` oder Showcase-Dateien
  laufen seriell.
- Die aktuell parallel geänderten Dashboard-Dateien werden in Task 5 erst nach
  ausdrücklicher Freigabe des dortigen Owners angefasst.
- Vorhandene `.android`-Dateien sind keine Aufforderung, neue Mirrors anzulegen.
  Wenn ein entfernter Export dort importiert wird, ist die minimale Compiler-
  Anpassung Teil des Löschschritts.
- Der bestehende gelöschte Ordner `tasks/ui-consolidation/` und globale
  `tasks/plan.md`/`tasks/todo.md` bleiben unberührt.

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
| Feste Tokens verändern kleine Geräte sichtbar | Unbeabsichtigte Dichteänderung | Referenzwerte beibehalten, 320-Punkte-Ansicht und große Systemschrift prüfen |
| Kontrastkorrektur verändert Markenwirkung | UI wirkt fremd | Palette vor Implementierung als Varianten zeigen und auswählen lassen |
| Scope wächst zu einem Gesamtrewrite | Lange, konfliktanfällige Initiative | Nur direkte Verbraucher und zwei vereinbarte Hauptflows anfassen |

## 10. Freigabepunkt

Dieser Plan autorisiert noch keine Produktcodeänderung. Nach Marcos Review beginnt
Task 1. Sichtbare Layout- und Farbänderungen warten zusätzlich auf Checkpoint A.
