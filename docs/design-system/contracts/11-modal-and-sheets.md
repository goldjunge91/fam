# Vertrag: Modal und Sheets

## Zweck und Scope

Dieser Vertrag definiert die iOS-Präsentationssemantik im Design-System. Er gilt
für neue Implementierungen und für neue Showcase-Beispiele. Android, eine
globale Migration des Altbestands und ein Produkt-Redesign sind nicht Teil
dieses Vertrags.

Die Präsentationsart wird nach dem Zweck gewählt, nicht nach der sichtbaren
Form. Ein Action Sheet ist deshalb kein normales Bottom Sheet mit anders
beschrifteten Buttons.

## Semantische Auswahl

| Primitive | Zweck | Verbindliche API | Nicht dafür verwenden |
| --- | --- | --- | --- |
| `Modal` aus `react-native` | Center-Dialoge, Fullscreen-Formulare und begründete System-/Medien-/Scanner-Grenzen | `visible`, `onRequestClose`, bei Bedarf `onDismiss` | Standard-Inhaltsfluss oder Action-Sheet-Ersatz |
| `BottomSheet` aus `@expo/ui/swift-ui` | Inhalts- und Detailfluss von unten mit nativen Höhen | `isPresented`, `onIsPresentedChange`, optional `onDismiss`, `presentationDetents` | Aktionen, die nur eine Auswahl bestätigen oder abbrechen |
| `ConfirmationDialog` aus `@expo/ui/swift-ui` | Echtes iOS-Action-Sheet für eine Auswahl von Aktionen | `Trigger`, `Actions`, optional `Message`, native `cancel`-/`destructive`-Rollen | Inhaltslisten, Formulare oder frei gestaltete Bottom-Sheet-Layouts |

`@expo/ui/community/bottom-sheet` wird auf iOS nicht weiter verwendet. Die
produktiven iOS-Verbraucher nutzen direkte SwiftUI-Präsentation mit
`RNHostView`; bestehende Android-Adapter bleiben außerhalb dieses iOS-Vertrags
unverändert und sind kein Muster für neue iOS-Komponenten.

## State und Lifecycle

- Jede Präsentation besitzt genau einen kontrollierten State im Consumer.
- Das direkte SwiftUI-`BottomSheet` wird deklarativ über `isPresented` und
  `onIsPresentedChange` gesteuert. `onDismiss` synchronisiert optional den
  Abschluss nach dem nativen Dismiss.
- `ConfirmationDialog` verwendet `isPresented`/`onIsPresentedChange`, wenn der
  Dialog aus einer React-Native-Aktion geöffnet wird. Der sichtbare Trigger
  bleibt als `ConfirmationDialog.Trigger` Teil des nativen Baums.
- Ein RN-`Modal` behandelt `onRequestClose` als System-/Back-Navigation und
  synchronisiert den State. Ein Außentap darf nur eine ausdrücklich nicht-
  destruktive, abbrechbare Aktion schließen.
- Kein Mount-then-close-Workaround, keine imperative `ref`-Steuerung und kein
  `useEffect`-Rennen zum Öffnen oder Schließen direkter SwiftUI-Primitives.
- Präsentierter Bottom-Sheet-Inhalt darf erst mit der nativen Präsentation
  gemountet werden. Teure Datenabfragen oder Mutationen werden nicht allein
  durch das Öffnen eines Sheets ausgelöst.

## Dismiss, Safe Area und Keyboard

- Native SwiftUI-Sheets besitzen natives Handle-, Dismiss- und Safe-Area-
  Verhalten. Ein Consumer dupliziert keine Home-Indicator- oder Sheet-Padding-
  Logik außerhalb des nativen Containers.
- Erlaubtes interaktives Dismiss synchronisiert den kontrollierten State. Nach
  programmgesteuertem Schließen bleibt kein veralteter `isPresented`-Wert zurück.
- RN-Modal-Sonderfälle definieren Backdrop, Außentap, `onRequestClose` und
  `onDismiss` explizit. Safe-Area-Padding wird genau einmal vergeben.
- Eingaben in RN-Modals und native Sheets müssen von der Tastatur erreichbar
  bleiben. Keyboard-Toolbar, Scrollcontainer und untere Aktionsfläche werden
  nicht durch doppeltes lokales Padding oder eine feste Bildschirmhöhe verdeckt.
- `Host` beziehungsweise `RNHostView` wird nur an der tatsächlichen UIKit-
  SwiftUI-Grenze verwendet. `ignoreSafeArea` wird nur mit konkreter Begründung
  gesetzt, niemals als pauschaler Layout-Fix.

## Accessibility und Interaktion

- Jeder Trigger und jede Aktion besitzt einen verständlichen sichtbaren Namen.
  Native Action-Sheet-Aktionen verwenden die semantisch passende `cancel`-
  beziehungsweise `destructive`-Rolle.
- VoiceOver erhält beim Öffnen den nativen Präsentationsfokus und kehrt nach dem
  Schließen zum auslösenden Trigger oder zu einer fachlich passenden Aktion
  zurück.
- RN-Trigger und RN-Aktionen besitzen mindestens 44 × 44 logische Einheiten
  wirksamen Touchbereich. Native SwiftUI-Controls behalten ihre native
  Interaktionsfläche.
- Destruktive Aktionen werden nicht durch Farbe allein erklärt. Rolle, Label
  und sichtbarer Zustand bleiben unabhängig vom Theme verständlich.
- Reduced Motion darf kein notwendiges Feedback entfernen. Eigene dauerhafte
  Blur-, Pulse- oder federnde Sheet-Animationen werden nicht ergänzt.

## Tokens, Theme und Performance

- RN-Modal- und Eigenbau-Sheet-Layouts verwenden ausschließlich Unistyles und
  Tokens aus den drei Design-System-Ownern. Feature-Code erfindet keine Palette,
  Typografierolle oder Schattenfarbe.
- Ein nativer `Host` erhält bei Bedarf die aktive Theme-Farbe als `seedColor`.
  Native Inhalte bleiben native; RN-Inhalte werden nicht ohne Integrationsgrund
  in SwiftUI gespiegelt.
- Direkte SwiftUI-Primitives werden gegenüber JS-Animationen, imperativen
  Mount-/Close-Sequenzen und einer neuen allgemeinen Sheet-Abstraktion bevorzugt.
- `FlashList` wird nicht in ein Sheet-Layout verschachtelt, das bereits in einem
  Scrollcontainer liegt. Kleine feste Gruppen werden direkt gerendert.

## Verbraucher und Nachweis

Der Design-System-Showcase unter
`src/features/settings/dev/design-system/showcase-components.tsx` zeigt alle
drei semantischen Kategorien: RN-Modal, direktes SwiftUI-BottomSheet und
`ConfirmationDialog`. Die Beispiele sind als Referenz oder Altbestand
beschriftet und nicht als pauschale Produktmigration zu verstehen.

Der Vertrag wird durch einen fokussierten Contract-Test und den Showcase-
Konventionstest geschützt. Für native Präsentationen sind zusätzlich iOS-
Nachweise mit Öffnen, Interaktion, Dismiss, VoiceOver-Fokus und großer Schrift
erforderlich. Ein Web-Screenshot oder ein Android-Lauf ersetzt den iOS-Nachweis
nicht.
