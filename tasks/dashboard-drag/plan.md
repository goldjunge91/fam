# Plan: Dashboard-Drag auf iOS reparieren

## Ziel und Grenzen

Beim Greifen bleibt derselbe Punkt des Widgets unter dem Finger. Die Vorschau folgt ohne Sprung; nach Loslassen stimmt die sichtbare Position mit der gespeicherten Reihenfolge überein. Karten behalten ihre natürlichen Größen und einen konsistenten Abstand.

Planungsauftrag vom 2026-09-05. Gezielte Tests sind erlaubt. Kein agent-device, kein Simulatorstart, keine vollständige Testsuite, keine Backend-Arbeit. In dieser Phase keine App-Code-Änderung. Bestehende fremde Änderungen und der offene Streak-Plan unter tasks/ bleiben erhalten.

## Gesicherter Stand

### Nachgewiesene Ursache und Fix

Marcos native Demo-Messung: Provider-Fensterursprung und Drax-Ursprung jeweils (0, 163), Hover relativ (16, 0), erwartete Fensterposition (16, 163), tatsächliche Position (16, 722). Der reine Darstellungsversatz beträgt 559 Punkte.

Drax 1.1.0 verwendet in HoverLayer und DebugOverlay `StyleSheet.absoluteFillObject`. Das installierte React Native exportiert diese Eigenschaft nicht mehr. Der Object-Spread liefert keine Positionierungsattribute; der Hover wird im normalen Layout unter dem Grid angeordnet. Patch `patches/react-native-drax@1.1.0.patch` ersetzt die Referenz durch `StyleSheet.absoluteFill` in Source und Module-Build. Keine native Änderung.

Regressionstest `test/conventions/drax-overlay-compatibility.test.ts` lädt die echten Dependency-Styles mit dem installierten React Native. Beide Prüfungen scheiterten vor dem Fix an fehlendem position/top/left/right/bottom und bestanden danach. Native Bestätigung nach Reload und Aufräumen der früheren Experimente stehen noch aus.

- Laut Marco funktioniert das Ablegen an der gewünschten Position, die Darstellung während des Ziehens ist jedoch falsch. Das grenzt die Untersuchung ein, beweist aber noch keine konkrete Ursache.
- Installiert: Drax 1.1.0, RNGH ~2.32.0 und Reanimated 4.5.1. Die verlinkte aktuelle Dokumentation ist als v2.x bezeichnet. Beispiele müssen gegen den tatsächlich installierten Quellcode geprüft werden.
- Der gemeinsame CardList-Code verwendet inzwischen wieder useSortableList, SortableContainer, SortableItem und packGrid. Eigene Finger-Translation und noHover wurden entfernt.
- Abweichungen vom Beispiel: gemessene Höhen als kleine ganzzahlige rowSpan-Einheiten, eigener Hover-Inhalt, Provider am Dashboard-Screen. Diese Anpassungen sind bislang nicht nativ validiert.
- Eine Android-Kopie besitzt noch ihren eigenen Provider. Der iOS-Jiggle-Wrapper unterscheidet sich vom gemeinsamen Wrapper. Zuerst die tatsächlich aufgelösten Dateien feststellen.
- Dashboard-Tests mocken Drax einschließlich packGrid und SortableItem. Sie prüfen weder native Messungen noch echte Hover-Positionen. Einige Erwartungen hängen an früheren Implementierungsdetails wie Provider-Mounts und rowSpan=1.

## Reihenfolge

### 1. Ausgangslage und Plattformauflösung sichern

Betroffen: CardList, DashboardScreen, JiggleWrapper, Jest-Konfiguration; read-only.

- Änderungen dieses Reparaturversuchs von bereits vorhandenen Änderungen abgrenzen.
- Für iOS die Metro-Auflösung der Dateien dokumentieren, inklusive .android/.ios-Varianten. Prüfen, ob das verwendete Gerät wirklich den aktuellen JS-Stand bekommt, ohne einen Server neu zu starten.
- Offizielles mixed-grid-Beispiel mit einer konkreten Revision sichern und dessen APIs gegen Drax 1.1.0 abgleichen. Keine automatische Aktualisierung nativer Abhängigkeiten.
- Bereits ausgeführte Bestandsaufnahme: 6 Tests bestanden, 4 fehlgeschlagen. Fehlende native Layout-Ereignisse lassen die gemockte Edit-Ansicht leer; zusätzlich erwartet ein Test weiterhin rowSpan=1. Diese Fehler reproduzieren den Hover-Versatz nicht. Keine weitere Arbeit an diesen Mocks vor der nativen Reproduktion.

Abnahme: Klarer Quellcodepfad. Der vorhandene Test-Ausgangszustand ist dokumentiert, aber kein Diagnose-Gate. Marco hat den isolierten Vergleich als Vorgehen bestätigt.

### 2. Fehler unabhängig von unseren Widgets eingrenzen

Betroffen: temporäre Development-Diagnose im Dashboard-Bereich, höchstens zwei Dateien.

- Das offizielle Beispiel zunächst mit einfachen farbigen Views, festen Größen und ohne Jiggle, Daten-Hooks oder unsere Höhenmessung nachbilden. Drax besitzt sämtliche Drag- und Snap-Bewegungen.
- Dasselbe Beispiel innerhalb unserer Screen-Einbettung vergleichen. Erst danach echte Karten und zuletzt Jiggle zuschalten, jeweils eine Änderung.
- Bei Bedarf begrenzte Diagnose für Drag-Start, eine Bewegung und Drag-Ende: absoluter Fingerpunkt, relativer Greifpunkt, Provider-Ursprung, Quellrechteck, Scroll-Offset, Hover-Rechteck. Keine dauerhaften Frame-Logs und keine Nutzerdaten.
- Maßgebliche Invariante: Hover-Ursprung im Fenster plus Greifpunkt entspricht dem Fingerpunkt, ohne doppelte Safe-Area-, Header- oder Scroll-Offsets.

Abnahme: Erste Stufe, an der der Sprung auftritt, plus Messwerte. Native Sichtprüfung erfolgt auf Marcos vorhandenem Gerät, solange Simulator/agent-device ausgeschlossen bleiben. Jest alleine kann diese Abnahme nicht ersetzen.

### 3. Genau den nachgewiesenen Fehler korrigieren

Abhängig von Schritt 2, voraussichtlich ein bis drei Dateien.

- Fehler schon im unveränderten Beispiel: installierte Drax-Implementierung und bekannte Upstream-Korrekturen untersuchen; kleinsten belegten Patch wählen. Versionswechsel nur mit geklärter Kompatibilität und möglichem Rebuild-Aufwand.
- Fehler erst in Screen-Einbettung: genau die falsche Messgrenze oder Provider-Platzierung korrigieren.
- Fehler erst mit echten Widgets: Mess- und Hover-Inhalt trennen beziehungsweise den nachgewiesenen Layout-/Transformkonflikt beheben.
- Keine weiteren pauschalen Offset-Korrekturen, kein paralleler Gesture-Controller, kein Bibliothekswechsel auf Verdacht.

Abnahme: Vorher reproduzierbarer Sprung ist nachher unter denselben Bedingungen verschwunden; korrektes Ablegen bleibt erhalten.

### 4. Abstände und wiederholtes Sortieren absichern

Erst nach korrekter Hover-Bewegung. Betroffen: CardList und gegebenenfalls gezielte Tests.

- Kleine, große und gemischte Karten prüfen; Abstände separat vom Koordinatenfehler behandeln.
- Vorwärts/rückwärts verschieben, mehrere Drags hintereinander, Loslassen ohne Bewegung und Abbruch außerhalb eines Ziels prüfen.
- Größenwechsel, Entfernen/Wiederherstellen und Eintritt/Austritt aus dem Bearbeitungsmodus prüfen. Größere Schrift darf Inhalte nicht abschneiden.
- Gespeicherte Reihenfolge nach erneutem Öffnen prüfen; ausgeblendete Karten dürfen nicht verloren gehen.
- Tests für unsere Reihenfolge-/Layoutverträge verwenden. Keine selbst erfundenen Drax-Koordinaten im Mock als Beweis für native Korrektheit.

Abnahme: Kein kumulativer Versatz, konsistente Abstände, Größen und Persistenz.

### 5. Aufräumen und Abschluss

- Nur nachweislich überholte Änderungen dieses Versuchs entfernen; insbesondere Provider-Dopplungen, Sonderpfade und Diagnosecode überprüfen.
- Strict-Warnung bleibt wie gewünscht deaktiviert; sie gilt nicht als gelöste Ursache.
- Gezielte Tests, Typecheck und relevante Format-/Lint-Prüfung. Keine vollständige Testsuite.
- Abschluss benennt die belegte Ursache, den kleinen Fix und die tatsächlich bestandenen Prüfungen. Ohne native Bestätigung bleibt die Reparatur ausdrücklich unbestätigt.

## Quellen

- https://github.com/nuclearpasta/react-native-drax/blob/main/docs-site/docs/examples/mixed-grid.mdx
- https://nuclearpasta.com/react-native-drax/guides/sortable-grid
- Installierter Drax-Quellcode: DraxProvider, HoverLayer, SortableItem, useDragGesture, useCallbackDispatch und useSortableList.

## 2026-09-05: Position springt direkt nach dem Loslassen zurück

Marco bestätigt inzwischen korrekte Hover-Koordinaten (erwartet und gemessen
16, 163). Das verbleibende Zurückspringen tritt unmittelbar beim Loslassen auf.

Im installierten Drax 1.1.0 liest SortableItem den Abschluss-Callback während des
Renderns aus `_internal`. SortableContainer registriert ihn erst im Layout-Effekt.
Zusätzlich baut useSortableList bei jedem Render ein neues internes Objekt mit
undefiniertem Callback. Dadurch erreicht der Snap-Abschluss `finalizeDrag` nicht,
und die neue Reihenfolge wird nicht über `onReorder` übernommen.

Der bestehende Dependency-Patch liest den Callback erst beim Snap-Abschluss und
hält ihn über einen Ref mit Getter/Setter zwischen Rendern aktuell. Der gezielte
Test verwendet den echten SortableItem und useSortableList, ersetzt nur den
nativen Gesten-Host und war vor der Korrektur rot (0 statt 1 Abschlussaufruf).
Ein zweiter Fall prüft einen noch laufenden Snap nach erneutem Rendern.

Im Dashboard bleiben Kartenarray und keyExtractor zwischen unveränderten Rendern
stabil, damit Drax seine interne Sortierung beim Drag-Start nicht zurücksetzt.
Die iOS-Jiggle-Animation verwendet einen einzelnen umkehrenden withTiming-Verlauf;
withRepeat(reverse=true) unterstützt das vorher verschachtelte withSequence nicht.
Während des Ziehens pausieren Jiggle und Höhenupdates. Native Flüssigkeit und
mehrere aufeinanderfolgende Positionswechsel bleiben am Gerät zu bestätigen;
die Callback-Tests messen keine FPS und ersetzen diese Abnahme nicht.

Validierung: Beide gezielten Drax-Testdateien bestehen mit insgesamt vier Tests.
Nach Bereinigung des Testcodes besteht der Snap-Test erneut (zwei Fälle).
Biome besteht für beide Kartenlisten sowie alle drei Jiggle-Dateien;
`git diff --check` ist sauber. Der projektweite Typecheck meldet daneben Fehler
in inline-select, inventory-item-group-sheet, showcase-patterns und
complete-run-sheet; diese fachfremden Dateien bleiben unangetastet.
