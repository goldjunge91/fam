# Vertrag: Buttons und Interaktion

## Zweck und öffentliche Grenze

Buttons machen Priorität, Gefahr und Interaktion konsistent. Produktcode importiert
Buttons aus `src/components/ui/buttons/`. Die kanonische beschriftete Produkt-API
verwendet `label`, `onPress`, `variant`, `size`, `loading` und `disabled`.

Tokens stammen aus `index.ts`, die aktive Palette aus dem ThemeProvider.
Typografie, Farbpaare, Größenrezepte, Zustandsdarstellung, Timing und Haptikzuordnung
werden in `ui.tsx` definiert. Produktkomponenten ergänzen Verhalten und Komposition.

Der bestehende Foundation-Button mit `title` und `sm/md/lg` ist ein
Kompatibilitätseinstieg. Er darf nach Konsolidierung nur dieselbe Basis adaptieren.
Eine zusätzliche unabhängige Implementierung bleibt kein zulässiger Endzustand.

## Varianten und Größen

| Variante | Bedeutung und Darstellung |
| --- | --- |
| `primary` | hervorgehobene Aktion, geprüftes Akzentpaar, gefüllt |
| `secondary` | weich hinterlegte Nebenaktion, primärer Text, keine zusätzliche Kontur |
| `danger` | destruktive Aktion, eigenes geprüftes Statuspaar, gefüllt |
| `accent` | belegter Domain-Akzent mit geprüftem Vordergrund, gefüllt |
| `ghost` | transparente Nebenaktion mit primärem Text |
| `link` | transparente Textaktion mit Akzenttext |

Größen bleiben `default`, `large`, `compact`. Gleiche Variante und Größe haben in
Foundation, Produktadapter und Showcase identische Rezepte. Nicht jede Aktion
auf einem Screen verwendet `primary`. Ein `accentKey` ist keine freie Farbwahl.

## Tiefe und Motion

Gefüllte Varianten besitzen 4 Punkte sichtbare Tiefe und 4 Punkte Druckweg.
Der äußere View trägt eine deckende zentrale Tiefenfarbe und reserviert
`BUTTON_DEPTH`. Die Vorderseite bewegt sich bei `onPressIn` in 60 ms um diese
Tiefe nach unten und federt bei `onPressOut` zurück. Features ergänzen keine
weiteren Press-Overlays oder zeitgesteuerten Animationssequenzen.

Die vorhandene `flat`-Ausnahme für kompakte Header-Aktionen darf den Tiefeneffekt
entfernen. Sie erzeugt keine zweite Buttonfamilie. Bei Reduced Motion entfallen
Federüberschwingen und Skalierung. Ein sofortiger Zustand oder ruhiges Farb-/Konturfeedback
bleibt erhalten; die Systempräferenz muss über die reale Implementierung wirken.

## Zustände, Ereignisse und Haptik

- Loading und Disabled blockieren Aktivierung und Haptik. Loading meldet `busy`,
  Disabled meldet `disabled`. Beschriftung bleibt lesbar und wird nicht durch
  eine unbenannte Ladegrafik ersetzt.
- Ein Ladeindikator verschiebt das Label nicht überraschend. Mehrzeilige Labels
  dürfen die Buttonhöhe erhöhen. Es werden keine dauerhaften dekorativen
  Pulse-/Shimmer-Animationen eingeführt.
- Gemeinsame Press-Wrapper führen interne Effekte und externe `onPressIn`-/
  `onPressOut`-Callbacks pro Ereignis genau einmal aus. Unterstützte Props werden
  an das tatsächliche interaktive Element weitergegeben.
- Abbruch oder Disabled-Wechsel hinterlassen keine dauerhaft gedrückte Fläche.
  Adapter erzeugen keine doppelte Aktivierung, Animation oder Haptik.
- Haptik läuft ausschließlich über `src/lib/haptics.ts`: Produktbutton standardmäßig
  Medium, Auswahl Selection, generisches Press Light. Vorhandene dokumentierte
  Overrides und Haptikpräferenzen bleiben wirksam.

## Touch, Fokus und Beschriftung

Normale eigenständige Aktionen besitzen mindestens 44 × 44 logische Einheiten
realen Touchbereich. Kleine sichtbare Icons sind erlaubt, wenn der Trefferbereich
wirksam erweitert wird, nicht am Elterncontainer abgeschnitten wird und keine
Nachbaraktion überlappt. Allein `hitSlop` zu setzen ist kein Nachweis.
Inline-Links innerhalb von Fließtext werden gesondert beurteilt; eigenständige
Link-Buttons sind keine pauschale Ausnahme.

Icon-only-Aktionen benötigen einen verständlichen zugänglichen Namen. Dekorative
Icons erzeugen keinen zweiten Fokus. Auf Web sind Fokusindikator und
Tastaturaktivierung erforderlich. Eine freie `backgroundColor`-Prop bleibt
höchstens Kompatibilitäts-/Integrationsgrenze, keine Erlaubnis für ungeprüfte Farbpaare.

## Beispiel der vorgesehenen Verwendung

```tsx
import { Button } from '@/components/ui/buttons';

<Button label="Speichern" loading={isSaving} onPress={save} />
```

Ein eigener 37-Punkte-Pressable mit lokaler Farbe und Textdarstellung umgeht
Mindestgröße, Theme, Zustände und die gemeinsame Basis.

## Nachweis

Gezielte Tests prüfen Blockierung, einmalige Callbacks, Accessibility-States,
Haptikgrenze und zentrale Farb-/Größenrezepte. Native Interaktion belegt reale
Touchflächen, Druckweg, Abbruch und Reduced Motion. Große Schrift und lange Labels
werden in beiden Themes geprüft. Die heute parallelen Implementierungen und
kleinen Iconflächen bleiben bis zur Codeumstellung Migrationsbestand.
