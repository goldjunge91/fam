# Vertrag: Modal und Sheets

## Zweck und Scope

Der Vertrag hält die iOS-Präsentationssemantik fest. Er gilt für neue
Implementierungen und neue Showcase-Beispiele. Android, eine Migration des
Altbestands und ein Produkt-Redesign sind nicht Teil dieses Vertrags.

Die Präsentationsart wird nach dem Zweck gewählt, nicht nach der sichtbaren
Form. Ein Action Sheet ist deshalb kein normales Bottom Sheet mit anders
beschrifteten Buttons.

## Semantische Auswahl

| Primitive | Zweck | Verbindliche API | Nicht dafür verwenden |
| --- | --- | --- | --- |
| `Modal` aus `react-native` | Center-Dialoge, Fullscreen-Formulare, begründete System-, Medien- und Scanner-Grenzen | `visible`, `onRequestClose`, optional `onDismiss` | Standard-Inhaltsfluss, Action-Sheet-Ersatz |
| `BottomSheet` aus `@expo/ui/swift-ui` | Inhalts- und Detailfluss von unten mit nativen Höhen | `isPresented`, `onIsPresentedChange`, optional `onDismiss`, `presentationDetents` | Aktionen, die nur bestätigen oder abbrechen |
| `ConfirmationDialog` aus `@expo/ui/swift-ui` | echtes iOS-Action-Sheet für eine Auswahl von Aktionen | `Trigger`, `Actions`, optional `Message`, native `cancel`- und `destructive`-Rolle | Inhaltslisten, Formulare, frei gestaltete Sheet-Layouts |

`@expo/ui/community/bottom-sheet` wird auf iOS nicht weiter verwendet. Produktive
iOS-Verbraucher präsentieren direkt über SwiftUI mit `RNHostView`; die
Android-Adapter bleiben nach Vertrag 05 getrennt.

## State und Lifecycle

- Jede Präsentation besitzt genau einen kontrollierten State im Consumer.
- Das SwiftUI-`BottomSheet` wird deklarativ über `isPresented` und
  `onIsPresentedChange` gesteuert. `onDismiss` synchronisiert den Abschluss
  optional nach dem nativen Dismiss.
- `ConfirmationDialog` nutzt `isPresented` und `onIsPresentedChange`. Der
  sichtbare Trigger bleibt als `ConfirmationDialog.Trigger` Teil des nativen
  Baums.
- Ein RN-`Modal` behandelt `onRequestClose` als System- oder Back-Navigation und
  synchronisiert den State. Ein Außentap schließt nur eine ausdrücklich nicht
  destruktive, abbrechbare Aktion.
- Kein Mount-then-close-Workaround, keine imperative `ref`-Steuerung, kein
  `useEffect`-Rennen zum Öffnen oder Schließen direkter SwiftUI-Primitives.
- Sheet-Inhalt wird erst mit der nativen Präsentation gemountet. Das Öffnen
  löst allein keine teure Datenabfrage oder Mutation aus.

## Dismiss, Safe Area und Keyboard

- Native Sheets bringen Handle-, Dismiss- und Safe-Area-Verhalten mit. Der
  Consumer dupliziert keine Home-Indicator- oder Sheet-Padding-Logik.
- Erlaubtes interaktives Dismiss synchronisiert den kontrollierten State. Nach
  programmgesteuertem Schließen bleibt kein veralteter `isPresented`-Wert.
- RN-Modal-Sonderfälle definieren Backdrop, Außentap, `onRequestClose` und
  `onDismiss` explizit. Safe Area wird genau einmal berücksichtigt (Vertrag 03).
- Tastatur, Scrollcontainer und untere Aktionsfläche bleiben erreichbar. Für
  Eingaben in Sheets gilt die Keyboard-Toolbar-Regel aus Vertrag 08.
- `Host` und `RNHostView` stehen nur an der tatsächlichen UIKit-SwiftUI-Grenze.
  `ignoreSafeArea` braucht eine konkrete Begründung, nie einen pauschalen
  Layout-Fix.

## Accessibility und Interaktion

- Trigger und Aktionen tragen einen verständlichen sichtbaren Namen. Native
  Aktionen verwenden die passende `cancel`- oder `destructive`-Rolle, damit
  Destruktives nicht allein über Farbe erklärt wird (Vertrag 01).
- VoiceOver erhält beim Öffnen den nativen Präsentationsfokus und kehrt nach
  dem Schließen zum auslösenden Trigger zurück.
- RN-Trigger und RN-Aktionen behalten mindestens 44 × 44 logische Einheiten
  wirksamen Touchbereich. Native SwiftUI-Controls behalten ihre native
  Interaktionsfläche.
- Reduced Motion und Zustandsfeedback folgen Vertrag 10. Eigene dauerhafte
  Blur-, Pulse- oder federnde Sheet-Animationen werden nicht ergänzt.

## Theme und Integration

RN-Modal- und Eigenbau-Sheet-Layouts verwenden Unistyles und Tokens aus
[index.ts](../../../src/components/theme/index.ts) und
[ui.tsx](../../../src/constants/ui.tsx). Ein nativer `Host` erhält bei Bedarf
die aktive Theme-Farbe als `seedColor`. Native Inhalte bleiben native; RN-Inhalte
werden nicht ohne Integrationsgrund in SwiftUI gespiegelt. Direkte
SwiftUI-Präsentation wird einer neuen allgemeinen Sheet-Abstraktion vorgezogen,
und ein Sheet, das bereits in einem Scrollcontainer liegt, erhält keine
verschachtelte FlashList (Vertrag 09).

## Verbraucher und Nachweis

Der Showcase in
[showcase-components.tsx](../../../src/features/settings/dev/design-system/showcase-components.tsx)
zeigt RN-Modal, SwiftUI-BottomSheet und `ConfirmationDialog`. Die Beispiele
sind Referenz, kein Migrationsauftrag für Produktcode.

Geschützt durch
[modal-and-sheets-contract.test.ts](../../../test/conventions/modal-and-sheets-contract.test.ts)
und
[native-sheet-showcase-convention.test.ts](../../../test/conventions/native-sheet-showcase-convention.test.ts).
Die Prüfmaßstände aus Vertrag 10 gelten; eine native Präsentation braucht den
iOS-Nachweis.
