# Todo: Design-System-Referenz

## Slice 1: Gerüst

- [x] Gemeinsame Vergleichs-, Token- und Codebeispiel-Bausteine anlegen.
- [x] Kategorie-Navigation für Konzept B anlegen.
- [x] Route `/settings/design-system` für iOS und Android ergänzen.

## Slice 2: Foundations

- [x] Aktive Light-/Dark-Themefarben darstellen.
- [x] Semantische Farbrollen vollständig darstellen.
- [x] Akzent- und Kategorie-Töne darstellen.
- [x] Alle `Txt`-Varianten, Töne und Gewichte darstellen.
- [x] `space`, `radius`, `shadow`, `BUTTON_DEPTH` und responsive Werte darstellen.
- [x] `Gradients` und `Fonts` darstellen.

## Slice 3: Komponenten

- [x] `Surface` und `Card` darstellen.
- [x] Feature-facing Buttonvarianten, Größen und Zustände darstellen.
- [x] Haptikvertrag erklären und an interaktiven Beispielen verwenden.
- [x] Field-, Pill-, Badge- und Segmented-Control-Zustände darstellen.
- [x] Feedback-, Empty-, Progress- und Steuerelemente darstellen.

## Slice 4: Muster und Grenzen

- [x] `Screen`, Header, `chrome` und `back` darstellen.
- [x] NativeWind-/StyleSheet-Aufgabenteilung darstellen.
- [x] Laufzeitfarben und `withAlpha()` darstellen.
- [x] Accessibility-, Loading-, Disabled-, Selected- und Error-Zustände darstellen.

## Slice 5: Dokumentation und Integration

- [x] Zehn getrennte Vertragsdokumente erstellen.
- [x] `DESIGN_SYSTEM.md` als Einstieg und Inhaltsverzeichnis aktualisieren.
- [x] Entwicklerbereich um die Referenzroute ergänzen.

## Verifikation

- [x] `git diff --check` für die neuen Änderungen.
- [x] Biome nur für die neuen und direkt geänderten Dateien.
- [ ] Fokussierter TypeScript-Check ohne nativen Build. Der projektweite Compiler
      lief auch mit eingeschränkter Dateiliste länger als 30 Sekunden und wurde
      zum Schutz der verfügbaren Ressourcen beendet.
- [x] Keine vollständige Theme-/UI-Datei gelöscht oder ersetzt.

## Slice 6: Visuelle Präzisierung

- [x] `BUTTON_DEPTH` sichtbar von 4pt auf 6pt erhöhen und beide Button-APIs
      darüber steuern.
- [x] Bestätigten Field-Fokus mit Label-, Border- und Cursorzustand dokumentieren.
- [x] Zielrollen und vollständige Zuordnung aller heutigen Typografievarianten
      festschreiben.
- [x] Ersten wertgleichen Batch `headingSmall` zu `heading` migrieren.
- [x] Nach jedem Batch gezielte Prüfung ausführen; kein nativer Build und keine
      vollständige Testsuite.
