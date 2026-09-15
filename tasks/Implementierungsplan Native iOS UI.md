# Implementierungsplan: Native iOS UI mit Expo UI

## Überblick

Der bisherige Maestro-Plan wird vollständig durch einen iOS-UI-Plan ersetzt.
Ziel ist eine klare, performante Präsentationsarchitektur im Design-System:
direkte SwiftUI-Primitives für native iOS-Semantik und RN-Modal nur für
begründete Sonderfälle. Der Maestro-Plan bleibt als Runtime-Nachweis erhalten.
Android, eine globale Modal-Migration und ein Produkt-Redesign sind nicht Teil
dieses Plans.

Die Aufgaben werden in Beads verfolgt. `tasks/todo.md` wird nicht angelegt,
weil Beads der projektweite externe Task-Tracker ist.

## Architekturentscheidungen

- `@expo/ui/swift-ui` ist der iOS-Standard für echte native Semantik.
- `RN-Modal` ist im Showcase als Center-Dialog dokumentiert und bleibt für
  Center-/Fullscreen-/System-Sonderfälle verfügbar.
- `BottomSheet` aus `@expo/ui/swift-ui` wird deklarativ mit
  `isPresented`/`onIsPresentedChange` gesteuert. Detents werden über native
  SwiftUI-Modifikatoren definiert.
- `ConfirmationDialog` aus `@expo/ui/swift-ui` ist der echte iOS-Action-Sheet
  für Titel, Message, Aktionen und Cancel. Ein Action Sheet wird nicht als
  normales BottomSheet nachgebaut.
- `DatePicker` aus `@expo/ui/swift-ui` ist ein nativer Eingabe-Control, kein
  Sheet. Bestehende Datumskomponenten werden nicht ohne belegten UX- oder
  Wartungsvorteil ersetzt.
- `@expo/ui/community/bottom-sheet` wird auf iOS nicht weiter verwendet.
  `category-order-sheet` und `complete-run-sheet` präsentieren ihren
  bestehenden RN-Inhalt auf iOS über direkte SwiftUI-BottomSheets und
  `RNHostView`; die Android-Adapter bleiben unverändert außerhalb dieses Plans.
- SwiftUI- und RN-Grenzen werden sparsam gesetzt: native Inhalte bleiben
  native; `RNHostView` wird nur für tatsächlich benötigte bestehende RN-
  Inhalte verwendet. Theme-Werte kommen aus den bestehenden fam-Tokens.
- Keine eigene JS-Animation, kein Mount-then-close-Workaround und keine neue
  allgemeine Sheet-Abstraktion nur für den Showcase.

## Task-Liste

### Phase 1: Vertrag und bestehende Sonderfälle

- `fam-ev4q.3`: iOS-UI-Contract für SwiftUI-Primitives festschreiben
- `fam-ev4q.2`: bestehende Produktverbraucher auf direkte SwiftUI-BottomSheets
  für iOS migrieren und Android-Adapter unverändert lassen

### Checkpoint: Contract und Drop-in

- Contract benennt alle Präsentationskategorien und Grenzen.
- Der Showcase enthält keine Community-BottomSheet-Referenz mehr.
- Die beiden produktiven iOS-Sheet-Verbraucher verwenden direkte SwiftUI-
  Präsentation mit `RNHostView`; Android bleibt unverändert.
- Fokussierter Test, `bun run check` und `bun run typecheck` sind grün.

### Phase 2: Native Präsentationsprimitive

- `fam-ev4q.4`: Direktes SwiftUI-BottomSheet als iOS-Referenz
- `fam-ev4q.5`: Echtes iOS-Action-Sheet mit `ConfirmationDialog`

### Checkpoint: Native Sheets

- BottomSheet und ConfirmationDialog verwenden kontrollierten State.
- Native Dismiss-Gesten, VoiceOver-Fokus und Token-/Safe-Area-Grenzen sind
  auf iOS nachvollziehbar.
- Maestro prüft Öffnen, Interaktion und Schließen beider Flows.

### Phase 3: Native Eingabe und Abschluss

- `fam-ev4q.6`: Native SwiftUI-DatePicker als Referenz prüfen

### Checkpoint: Abschluss

- Showcase-Beschriftungen entsprechen der tatsächlichen Semantik.
- Bestehende Produktverbraucher bleiben unverändert, sofern kein eigener
  Migrations-Task freigegeben wurde; `fam-ev4q.2` ist der dokumentierte
  iOS-Migrationsschritt für die beiden Shopping-Sheets.
- Alle fokussierten Tests, Biome, Typecheck und iOS-Runtime-Nachweise liegen
  vor.

## Abhängigkeiten

```text
fam-ev4q.3 Contract
    ├── fam-ev4q.4 direktes SwiftUI-BottomSheet
    ├── fam-ev4q.5 ConfirmationDialog
    └── fam-ev4q.6 DatePicker-Referenz
```

Die Beads-Abhängigkeiten sind entsprechend hinterlegt. Die Reihenfolge ist
bewusst seriell, weil die Showcase-Datei von den UI-Slices gemeinsam berührt
wird.

## Verifikation pro Task

- Fokussierter Jest-/Konventionstest für den jeweiligen Slice.
- `bun run check` als eigener Befehl.
- `bun run typecheck` als eigener Befehl.
- iOS-Maestro-Smoke-Test für sichtbare Präsentation, Interaktion und Dismiss.
- Kein Android-Test und keine Änderung an Android-Dateien im Scope.

## Risiken und Gegenmaßnahmen

| Risiko                                                | Auswirkung                                | Gegenmaßnahme                                                        |
| ----------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| `latest`-Doku und lokales Paket driften               | API-/Runtime-Überraschungen               | Lokales `@expo/ui` und Expo 57 vor jedem Slice gegen die Doku prüfen |
| SwiftUI verlangt `Host` und native Child-Komponenten  | Layout- oder Token-Bruch an der RN-Grenze | `Host`/`RNHostView` nur gezielt einsetzen, Tokens zentral zuführen   |
| Action Sheet bleibt ein optisch ähnliches BottomSheet | Falsche iOS-Semantik                      | `ConfirmationDialog` mit echten Actions und Cancel verwenden         |
| Native Modal-Lifecycle unter laufendem Metro-Build    | Falsche negative Runtime-Nachweise        | Maestro nach jedem relevanten Slice isoliert ausführen               |

## Offene Grenzen

- Eine Migration bestehender Produkt-Sheets ist ein separates Vorhaben und
  wird nicht aus dem Showcase-Plan abgeleitet.
- `DatePicker` wird zunächst als Referenz und API-Entscheidung behandelt;
  eine Ersetzung von `date-wheel-field` benötigt einen eigenen UX-Nachweis.
- Die Expo-Dokumentation empfiehlt für die aktuelle Linie `@expo/ui` etwa
  `57.0.18`; lokal ist derzeit `57.0.15` installiert. Ein Paket-Upgrade ist
  nicht Bestandteil dieses Plans.

## Offizielle Referenzen

- [Expo UI SwiftUI](https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/)
- [SwiftUI BottomSheet](https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/bottomsheet/)
- [SwiftUI ConfirmationDialog](https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/confirmationdialog/)
- [SwiftUI DatePicker](https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/datepicker/)
