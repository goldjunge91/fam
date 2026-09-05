# Dashboard-Drag: Ausführung

- [ ] 1. iOS-Dateiauflösung, Beispielrevision und gezielten Test-Ausgangszustand dokumentieren.
- [ ] 2. Offizielles Minimalbeispiel gegen Screen-Einbettung, Widgets und Jiggle vergleichen; ersten fehlerhaften Übergang messen.
- [x] Demo unter `/settings/drax-demo` mit Basis-/Screen-Vergleich und Reset bereitstellen. Native Reproduktion steht noch aus.
- [x] Checkpoint: Native Messung belegt Darstellungsversatz; entferntes StyleSheet.absoluteFillObject als Ursache nachgewiesen.
- [x] 3. Dependency-Patch für absoluteFill gespeichert; echter Overlay-Style-Test vor Fix rot, danach grün. Native Bestätigung des Ablegens bleibt Teil der Abnahme.
- [ ] 4. Abstände, mehrere Drags, Scrollen, Abbruch, Größenwechsel und Persistenz gezielt prüfen.
- [ ] 5. Überholte Experimente entfernen, gezielte Checks ausführen und native Abnahme dokumentieren.

Details und Abnahmekriterien: [plan.md](plan.md).

- [x] Native Hover-Messung durch Marco bestätigt: erwartet = ist (16, 163).
- [x] Fehlenden Drax-Snap-Abschluss im gezielten Test reproduziert und im Dependency-Patch korrigiert.
- [x] Kartenreferenzen stabilisiert; iOS-Jiggle vereinfacht und während Drag pausiert.
- [ ] Marco: Mehrere Positionswechsel direkt nacheinander, Editmodus verlassen, erneut öffnen; Flüssigkeit beim Wackeln und Ziehen prüfen.
